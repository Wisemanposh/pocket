import { useEffect, useMemo, useRef, useState } from "react";
import {
  AudioEngine,
  VOICES,
  type FxValues,
  type MacroValues,
  type RegionPlayback,
} from "@pocket/engine";
import { chordAtDegree, scaleNotes, type GridDivision } from "@pocket/model";
import {
  BpmPicker,
  ChordPadGrid,
  FxPanel,
  KeyPicker,
  KnobRow,
  Lcd,
  MelodyPadRow,
  Modal,
  ModeTabs,
  Sequencer,
  TapeMode,
  TimeStrip,
  Transport,
  VoicePicker,
} from "@pocket/ui";
import { useAppStore, type InstrumentMode } from "./store";
import styles from "./App.module.css";

const NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const QUANT_STEPS = [0, 0.25, 0.5, 0.75, 0.9, 1];
const GRID_STEPS: GridDivision[] = ["1/4", "1/8", "1/16"];
const INTERNAL_SAMPLE_RATE = 48_000;

function keyDisplay(rootIdx: number, mode: "major" | "minor"): string {
  return `${NOTE_NAMES[rootIdx] ?? "?"}${mode === "minor" ? "m" : ""}`;
}

function noteLabel(midi: number): string {
  return NOTE_NAMES[midi % 12] ?? "?";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "An unexpected audio error occurred.";
}

export function App() {
  const [engine, setEngine] = useState<AudioEngine | null>(null);
  const [starting, setStarting] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transportText, setTransportText] = useState("▶ 00:00");
  const heldInputs = useRef(new Map<string, number[]>());
  const lastRecordedText = useRef("▶ 00:00");
  const [modal, setModal] = useState<null | "key" | "bpm" | "voice">(null);

  const store = useAppStore();
  const {
    key,
    tonicMidi,
    bpm,
    voiceId,
    mode,
    recording,
    metronome,
    quantize,
    macros,
    fx,
    tracks,
    activeTrackId,
    sequenceGrid,
    sequenceLane,
    sequenceStep,
    sequenceRunning,
  } = store;

  const selectedVoice = useMemo(
    () => VOICES.find((voice) => voice.id === voiceId) ?? VOICES[0]!,
    [voiceId]
  );

  const laneMidi = useMemo(() => {
    if (selectedVoice.drumKit) {
      return Array.from({ length: 8 }, (_, index) => selectedVoice.rootMidi + index);
    }
    const scale = scaleNotes(key, tonicMidi);
    return [...scale, scale[0]! + 12];
  }, [key, selectedVoice, tonicMidi]);

  const laneLabels = useMemo(
    () =>
      selectedVoice.drumKit
        ? Array.from({ length: 8 }, (_, index) => `D${index + 1}`)
        : laneMidi.map(noteLabel),
    [laneMidi, selectedVoice]
  );

  const sequenceSteps = useMemo(
    () =>
      Array.from({ length: 16 }, (_, step) =>
        laneMidi.flatMap((midi, lane) =>
          sequenceGrid[lane]?.[step] ? [{ voiceId, midi }] : []
        )
      ),
    [laneMidi, sequenceGrid, voiceId]
  );

  const audibleTracks = useMemo<RegionPlayback[]>(() => {
    const hasSolo = tracks.some((track) => track.solo && track.region);
    return tracks.flatMap((track) =>
      track.region && !track.muted && (!hasSolo || track.solo)
        ? [{ region: track.region, gain: track.volume * track.region.gain }]
        : []
    );
  }, [tracks]);

  const releaseInput = (inputId: string) => {
    const noteIds = heldInputs.current.get(inputId);
    if (!engine || !noteIds) return;
    heldInputs.current.delete(inputId);
    for (const noteId of noteIds) engine.noteOff(noteId);
  };

  const releaseAllInputs = () => {
    if (!engine) return;
    for (const noteIds of heldInputs.current.values()) {
      for (const noteId of noteIds) engine.noteOff(noteId);
    }
    heldInputs.current.clear();
  };

  useEffect(() => {
    if (!engine) return;
    const onVisibility = () => {
      if (document.hidden) releaseAllInputs();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      releaseAllInputs();
      void engine.dispose();
    };
  }, [engine]);

  useEffect(() => {
    if (engine && sequenceRunning) engine.setSequence(true, sequenceSteps);
  }, [bpm, engine, macros.attack, macros.release, sequenceRunning, sequenceSteps]);

  const startEngine = async () => {
    if (starting || engine) return;
    setStarting(true);
    setError(null);
    const nextEngine = new AudioEngine();
    try {
      await nextEngine.start();
      nextEngine.setActiveTrack(activeTrackId);
      nextEngine.setBpm(bpm);
      nextEngine.setQuantize(quantize);
      nextEngine.setMetronome(metronome);
      nextEngine.setMacros(macros);
      nextEngine.setFx(fx);
      nextEngine.onRegion((region) => store.setTrackRegion(region.trackId, region));
      nextEngine.onPlaybackState(setPlaying);
      nextEngine.onSequenceStep(store.setSequenceStep);
      setEngine(nextEngine);
    } catch (startError) {
      await nextEngine.dispose().catch(() => undefined);
      setError(errorMessage(startError));
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    if (!recording) {
      const idle = sequenceRunning
        ? `▦ SEQ ${String(Math.max(0, sequenceStep) + 1).padStart(2, "0")}`
        : lastRecordedText.current.replace("● REC ", "▶ ");
      setTransportText(playing ? "▶ PLAY" : idle);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = () => {
      const seconds = Math.floor((performance.now() - start) / 1000);
      const minutesText = String(Math.floor(seconds / 60)).padStart(2, "0");
      const secondsText = String(seconds % 60).padStart(2, "0");
      const text = `● REC ${minutesText}:${secondsText}`;
      lastRecordedText.current = text;
      setTransportText(text);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, recording, sequenceRunning, sequenceStep]);

  const handleChordPress = (degree: number, seventh: boolean) => {
    if (!engine) return;
    const inputId = `chord:${degree}:${seventh}`;
    if (heldInputs.current.has(inputId)) return;
    const midiNotes = selectedVoice.drumKit
      ? [selectedVoice.rootMidi + (seventh ? 7 : degree)]
      : chordAtDegree(key, degree as 0 | 1 | 2 | 3 | 4 | 5 | 6, tonicMidi, { seventh }).notes;
    heldInputs.current.set(
      inputId,
      midiNotes.map((midi) => engine.noteOn(voiceId, midi))
    );
  };

  const handleMelodyPress = (index: number) => {
    if (!engine) return;
    const inputId = `melody:${index}`;
    if (heldInputs.current.has(inputId)) return;
    heldInputs.current.set(inputId, [engine.noteOn(voiceId, laneMidi[index] ?? tonicMidi)]);
  };

  const stopSequence = () => {
    if (!engine || !sequenceRunning) return;
    engine.setSequence(false, sequenceSteps);
    store.setSequenceRunning(false);
    store.setSequenceStep(-1);
  };

  const handleRec = () => {
    if (!engine || recording) return;
    setError(null);
    engine.setActiveTrack(activeTrackId);
    engine.startRecording();
    store.setRecording(true);
  };

  const handlePlay = async () => {
    if (!engine || audibleTracks.length === 0 || recording) return;
    setError(null);
    stopSequence();
    try {
      if (mode === "CHRD" && audibleTracks.length === 1) {
        await engine.playRegionWithQuantize(
          audibleTracks[0]!.region,
          audibleTracks[0]!.gain
        );
      } else {
        await engine.playRegions(audibleTracks);
      }
    } catch (playError) {
      setError(errorMessage(playError));
    }
  };

  const handleStop = () => {
    if (!engine) return;
    if (recording) {
      engine.stopRecording();
      store.setRecording(false);
    }
    stopSequence();
    engine.stopPlayback();
  };

  const handleToggleSequence = () => {
    if (!engine) return;
    const next = !sequenceRunning;
    if (next) engine.stopPlayback();
    engine.setSequence(next, sequenceSteps);
    store.setSequenceRunning(next);
    if (!next) store.setSequenceStep(-1);
  };

  const handleExport = async () => {
    if (!engine || audibleTracks.length === 0 || exporting) return;
    setExporting(true);
    setError(null);
    try {
      const wav = await engine.exportRegionsAsWav(audibleTracks);
      const blob = new Blob([wav], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `pocket-mix-${Date.now()}.wav`;
      anchor.hidden = true;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (exportError) {
      setError(errorMessage(exportError));
    } finally {
      setExporting(false);
    }
  };

  const handleMacroChange = (name: keyof MacroValues, value: number) => {
    if (!engine) return;
    const next = { ...useAppStore.getState().macros, [name]: value };
    store.setMacro(name, value);
    engine.setMacros(next);
  };

  const handleFxChange = (name: keyof FxValues, value: number) => {
    if (!engine) return;
    const next = { ...useAppStore.getState().fx, [name]: value };
    store.setFx(name, value);
    engine.setFx(next);
  };

  const handleMode = (nextMode: InstrumentMode) => {
    releaseAllInputs();
    store.setMode(nextMode);
  };

  if (!engine) {
    return (
      <div className={styles.shell}>
        <div className={styles.bootPanel}>
          <button className={styles.startBtn} onClick={() => void startEngine()} disabled={starting}>
            {starting ? "STARTING…" : error ? "↻  RETRY POCKET" : "▶  START POCKET"}
          </button>
          {error && <div className={styles.error} role="alert">{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <div className={styles.device}>
        <Lcd
          transport={transportText}
          key2={`KEY ${keyDisplay(key.root, key.mode)} ♩=${bpm}`}
          voice={`VOICE: ${voiceId.toUpperCase()}`}
          onClickField={(field) => {
            if (field === "key" || field === "voice") setModal(field);
            else setModal("bpm");
          }}
        />
        {error && <div className={styles.error} role="alert">{error}</div>}

        <div className={styles.modeSurface}>
          {mode === "CHRD" && (
            <>
              <div className={styles.label}>CHORDS</div>
              <ChordPadGrid
                mode={key.mode}
                onPress={handleChordPress}
                onRelease={(degree, seventh) => releaseInput(`chord:${degree}:${seventh}`)}
              />
              <div className={styles.label}>MELODY</div>
              <MelodyPadRow
                labels={laneLabels}
                onPress={handleMelodyPress}
                onRelease={(index) => releaseInput(`melody:${index}`)}
              />
            </>
          )}
          {mode === "SEQ" && (
            <Sequencer
              laneLabels={laneLabels}
              selectedLane={sequenceLane}
              grid={sequenceGrid}
              currentStep={sequenceStep}
              running={sequenceRunning}
              onSelectLane={store.setSequenceLane}
              onToggleStep={store.toggleSequenceStep}
              onToggleRunning={handleToggleSequence}
              onClear={() => {
                store.clearSequence();
                if (sequenceRunning) engine.setSequence(true, Array.from({ length: 16 }, () => []));
              }}
            />
          )}
          {mode === "TAPE" && (
            <TapeMode
              tracks={tracks.map((track) => ({
                ...track,
                durationSeconds: track.region
                  ? (track.region.endSample - track.region.startSample) / INTERNAL_SAMPLE_RATE
                  : null,
              }))}
              activeTrackId={activeTrackId}
              onArm={(trackId) => {
                store.setActiveTrack(trackId);
                engine.setActiveTrack(trackId);
              }}
              onMute={store.toggleTrackMute}
              onSolo={store.toggleTrackSolo}
              onVolume={store.setTrackVolume}
              onClear={(trackId) => {
                engine.stopPlayback();
                store.clearTrack(trackId);
              }}
            />
          )}
          {mode === "FX" && <FxPanel values={fx} onChange={handleFxChange} />}
        </div>

        <KnobRow values={macros} onChange={handleMacroChange} />
        <ModeTabs active={mode} enabled={["CHRD", "SEQ", "TAPE", "FX"]} onSelect={handleMode} />
        <TimeStrip
          metroOn={metronome}
          quantStrength={quantize.strength}
          gridDivision={quantize.gridDivision}
          onToggleMetro={() => {
            const next = !metronome;
            store.setMetronome(next);
            engine.setMetronome(next);
          }}
          onCycleQuant={() => {
            const index = QUANT_STEPS.findIndex(
              (strength) => Math.abs(strength - quantize.strength) < 1e-3
            );
            const next = { ...quantize, strength: QUANT_STEPS[(index + 1) % QUANT_STEPS.length]! };
            store.setQuantize(next);
            engine.setQuantize(next);
          }}
          onCycleGrid={() => {
            const index = GRID_STEPS.indexOf(quantize.gridDivision);
            const next = { ...quantize, gridDivision: GRID_STEPS[(index + 1) % GRID_STEPS.length]! };
            store.setQuantize(next);
            engine.setQuantize(next);
          }}
          onQuantChange={(value) => {
            const next = { ...quantize, strength: value };
            store.setQuantize(next);
            engine.setQuantize(next);
          }}
          onQuantCommit={(value) => {
            const next = { ...quantize, strength: value };
            store.setQuantize(next);
            engine.setQuantize(next);
          }}
        />
        <Transport
          recording={recording}
          canPlay={audibleTracks.length > 0 && !recording}
          canStop={recording || playing || sequenceRunning}
          onRec={handleRec}
          onPlay={() => void handlePlay()}
          onStop={handleStop}
        />
        <button
          className={styles.startBtn}
          style={{ fontSize: 11, padding: "6px 10px" }}
          onClick={() => void handleExport()}
          disabled={audibleTracks.length === 0 || recording || exporting}
        >
          {exporting ? "BOUNCING MIX…" : "BOUNCE MIX → WAV"}
        </button>

        <Modal open={modal === "key"} onClose={() => setModal(null)} title="KEY">
          <KeyPicker
            value={key}
            onChange={(nextKey) => {
              releaseAllInputs();
              store.setKey(nextKey);
            }}
          />
        </Modal>
        <Modal open={modal === "bpm"} onClose={() => setModal(null)} title="BPM">
          <BpmPicker
            value={bpm}
            onChange={(nextBpm) => {
              store.setBpm(nextBpm);
              engine.setBpm(nextBpm);
            }}
          />
        </Modal>
        <Modal open={modal === "voice"} onClose={() => setModal(null)} title="VOICE">
          <VoicePicker
            voices={VOICES.map(({ id, displayName }) => ({ id, displayName }))}
            selectedId={voiceId}
            onChange={(nextVoice) => {
              releaseAllInputs();
              store.setVoice(nextVoice);
              setModal(null);
            }}
          />
        </Modal>
      </div>
    </div>
  );
}
