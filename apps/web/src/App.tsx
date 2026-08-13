import { useEffect, useMemo, useRef, useState } from "react";
import { AudioEngine, VOICES, type MacroValues } from "@pocket/engine";
import { chordAtDegree, scaleNotes, type GridDivision } from "@pocket/model";
import {
  BpmPicker,
  ChordPadGrid,
  KeyPicker,
  KnobRow,
  Lcd,
  MelodyPadRow,
  Modal,
  ModeTabs,
  TimeStrip,
  Transport,
  VoicePicker,
} from "@pocket/ui";
import { useAppStore } from "./store";
import styles from "./App.module.css";

const NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
const QUANT_STEPS = [0, 0.25, 0.5, 0.75, 0.9, 1];
const GRID_STEPS: GridDivision[] = ["1/4", "1/8", "1/16"];

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

  const {
    key,
    tonicMidi,
    bpm,
    voiceId,
    recording,
    lastRegion,
    metronome,
    quantize,
    macros,
    setKey,
    setVoice,
    setRecording,
    setLastRegion,
    setMetronome,
    setQuantize,
    setBpm,
    setMacro,
  } = useAppStore();

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

  const startEngine = async () => {
    if (starting || engine) return;
    setStarting(true);
    setError(null);
    const nextEngine = new AudioEngine();
    try {
      await nextEngine.start();
      nextEngine.setActiveTrack(1);
      nextEngine.setBpm(bpm);
      nextEngine.setQuantize(quantize);
      nextEngine.setMetronome(metronome);
      nextEngine.setMacros(macros);
      nextEngine.onRegion((region) => setLastRegion(region));
      nextEngine.onPlaybackState(setPlaying);
      setEngine(nextEngine);
    } catch (startError) {
      await nextEngine.dispose().catch(() => undefined);
      setError(errorMessage(startError));
    } finally {
      setStarting(false);
    }
  };

  const selectedVoice = useMemo(
    () => VOICES.find((voice) => voice.id === voiceId) ?? VOICES[0]!,
    [voiceId]
  );

  const melodyLabels = useMemo(() => {
    if (selectedVoice.drumKit) return Array.from({ length: 8 }, (_, index) => `D${index + 1}`);
    const scale = scaleNotes(key, tonicMidi);
    return [...scale, scale[0]! + 12].map(noteLabel);
  }, [key, selectedVoice, tonicMidi]);

  useEffect(() => {
    if (!recording) {
      setTransportText(playing ? "▶ PLAY" : lastRecordedText.current.replace("● REC ", "▶ "));
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
  }, [playing, recording]);

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
    const scale = scaleNotes(key, tonicMidi);
    const midi = selectedVoice.drumKit
      ? selectedVoice.rootMidi + index
      : index < scale.length
        ? scale[index]!
        : scale[0]! + 12;
    heldInputs.current.set(inputId, [engine.noteOn(voiceId, midi)]);
  };

  const handleRec = () => {
    if (!engine || recording) return;
    setError(null);
    engine.startRecording();
    setRecording(true);
  };

  const handlePlay = async () => {
    if (!engine || !lastRegion || recording) return;
    setError(null);
    try {
      await engine.playRegionWithQuantize(lastRegion);
    } catch (playError) {
      setError(errorMessage(playError));
    }
  };

  const handleToggleMetro = () => {
    if (!engine) return;
    const next = !metronome;
    setMetronome(next);
    engine.setMetronome(next);
  };

  const handleCycleQuant = () => {
    if (!engine) return;
    const index = QUANT_STEPS.findIndex((strength) => Math.abs(strength - quantize.strength) < 1e-3);
    const nextStrength = QUANT_STEPS[(index + 1) % QUANT_STEPS.length]!;
    const next = { ...quantize, strength: nextStrength };
    setQuantize(next);
    engine.setQuantize(next);
  };

  const handleCycleGrid = () => {
    if (!engine) return;
    const index = GRID_STEPS.indexOf(quantize.gridDivision);
    const nextDivision = GRID_STEPS[(index + 1) % GRID_STEPS.length]!;
    const next = { ...quantize, gridDivision: nextDivision };
    setQuantize(next);
    engine.setQuantize(next);
  };

  const handleStop = () => {
    if (!engine) return;
    if (recording) {
      engine.stopRecording();
      setRecording(false);
    } else {
      engine.stopPlayback();
    }
  };

  const handleExport = async () => {
    if (!engine || !lastRegion || exporting) return;
    setExporting(true);
    setError(null);
    try {
      const wav = await engine.exportRegionAsWav(lastRegion);
      const blob = new Blob([wav], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `pocket-${Date.now()}.wav`;
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
    setMacro(name, value);
    engine.setMacros(next);
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
        <div className={styles.label}>CHORDS</div>
        <ChordPadGrid
          mode={key.mode}
          onPress={handleChordPress}
          onRelease={(degree, seventh) => releaseInput(`chord:${degree}:${seventh}`)}
        />
        <div className={styles.label}>MELODY</div>
        <MelodyPadRow
          labels={melodyLabels}
          onPress={handleMelodyPress}
          onRelease={(index) => releaseInput(`melody:${index}`)}
        />
        <KnobRow values={macros} onChange={handleMacroChange} />
        <ModeTabs active="CHRD" enabled={["CHRD"]} />
        <TimeStrip
          metroOn={metronome}
          quantStrength={quantize.strength}
          gridDivision={quantize.gridDivision}
          onToggleMetro={handleToggleMetro}
          onCycleQuant={handleCycleQuant}
          onCycleGrid={handleCycleGrid}
          onQuantChange={(value) => {
            const next = { ...quantize, strength: value };
            setQuantize(next);
            engine.setQuantize(next);
          }}
          onQuantCommit={(value) => {
            const next = { ...quantize, strength: value };
            setQuantize(next);
            engine.setQuantize(next);
          }}
        />
        <Transport
          recording={recording}
          canPlay={!!lastRegion && !recording}
          canStop={recording || playing}
          onRec={handleRec}
          onPlay={() => void handlePlay()}
          onStop={handleStop}
        />
        <button
          className={styles.startBtn}
          style={{ fontSize: 11, padding: "6px 10px" }}
          onClick={() => void handleExport()}
          disabled={!lastRegion || recording || exporting}
        >
          {exporting ? "BOUNCING…" : "BOUNCE → WAV"}
        </button>
        <Modal open={modal === "key"} onClose={() => setModal(null)} title="KEY">
          <KeyPicker
            value={key}
            onChange={(nextKey) => {
              releaseAllInputs();
              setKey(nextKey);
            }}
          />
        </Modal>
        <Modal open={modal === "bpm"} onClose={() => setModal(null)} title="BPM">
          <BpmPicker
            value={bpm}
            onChange={(nextBpm) => {
              setBpm(nextBpm);
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
              setVoice(nextVoice);
              setModal(null);
            }}
          />
        </Modal>
      </div>
    </div>
  );
}
