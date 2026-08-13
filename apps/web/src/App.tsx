import { useEffect, useMemo, useRef, useState } from "react";
import { AudioEngine, VOICES } from "@pocket/engine";
import { chordAtDegree, scaleNotes, type Chord, type GridDivision } from "@pocket/model";
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

export function App() {
  const [engine, setEngine] = useState<AudioEngine | null>(null);
  const [transportText, setTransportText] = useState("▶ 00:00");
  const activeChord = useRef<Chord | null>(null);
  const heldMidi = useRef<Set<number>>(new Set());

  const [modal, setModal] = useState<null | "key" | "bpm" | "voice">(null);

  const {
    key, tonicMidi, bpm, voiceId,
    recording, lastRegion,
    litMelodyIndex,
    metronome, quantize,
    setKey, setVoice,
    setRecording, setLastRegion,
    setLitMelodyIndex,
    setMetronome, setQuantize, setBpm,
  } = useAppStore();

  const startEngine = async () => {
    const eng = new AudioEngine();
    await eng.start();
    eng.setActiveTrack(1);
    eng.setBpm(bpm);
    eng.setQuantize(quantize);
    eng.setMetronome(metronome);
    eng.onRegion((r) => setLastRegion(r));
    setEngine(eng);
  };

  const melodyLabels = useMemo(() => {
    const scale = scaleNotes(key, tonicMidi);
    return [...scale, scale[0]! + 12].map(noteLabel);
  }, [key, tonicMidi]);

  const lastRecordedText = useRef("▶ 00:00");

  useEffect(() => {
    if (!recording) {
      // Freeze on whatever the last shown time was (00:00 on first load,
      // the duration of the most recent take after STOP).
      setTransportText(lastRecordedText.current.replace("● REC ", "▶ "));
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const sec = Math.floor((performance.now() - start) / 1000);
      const m = String(Math.floor(sec / 60)).padStart(2, "0");
      const s = String(sec % 60).padStart(2, "0");
      const text = `● REC ${m}:${s}`;
      lastRecordedText.current = text;
      setTransportText(text);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [recording]);

  const handleChordPress = (degree: number, seventh: boolean) => {
    if (!engine) return;
    const chord = chordAtDegree(key, degree as 0 | 1 | 2 | 3 | 4 | 5 | 6, tonicMidi, { seventh });
    activeChord.current = chord;
    for (const n of chord.notes) {
      engine.noteOn(voiceId, n);
      heldMidi.current.add(n);
    }
  };

  const handleChordRelease = (degree: number, seventh: boolean) => {
    if (!engine) return;
    const chord = chordAtDegree(key, degree as 0 | 1 | 2 | 3 | 4 | 5 | 6, tonicMidi, { seventh });
    for (const n of chord.notes) {
      engine.noteOff(voiceId, n);
      heldMidi.current.delete(n);
    }
  };

  const handleMelodyPress = (i: number) => {
    if (!engine) return;
    const scale = scaleNotes(key, tonicMidi);
    const midi = i < scale.length ? scale[i]! : scale[0]! + 12;
    engine.noteOn(voiceId, midi);
    heldMidi.current.add(midi);
    setLitMelodyIndex(i);
  };

  const handleMelodyRelease = (i: number) => {
    if (!engine) return;
    const scale = scaleNotes(key, tonicMidi);
    const midi = i < scale.length ? scale[i]! : scale[0]! + 12;
    engine.noteOff(voiceId, midi);
    heldMidi.current.delete(midi);
    if (litMelodyIndex === i) setLitMelodyIndex(null);
  };

  const handleRec = () => {
    if (!engine || recording) return;
    engine.startRecording();
    setRecording(true);
  };

  const handlePlay = async () => {
    if (!engine || !lastRegion) return;
    await engine.playRegionWithQuantize(lastRegion);
  };

  const handleToggleMetro = () => {
    if (!engine) return;
    const next = !metronome;
    setMetronome(next);
    engine.setMetronome(next);
  };

  const handleCycleQuant = () => {
    if (!engine) return;
    const i = QUANT_STEPS.findIndex((s) => Math.abs(s - quantize.strength) < 1e-3);
    const nextStrength = QUANT_STEPS[(i + 1) % QUANT_STEPS.length]!;
    const nextQ = { ...quantize, strength: nextStrength };
    setQuantize(nextQ);
    engine.setQuantize(nextQ);
  };

  const handleCycleGrid = () => {
    if (!engine) return;
    const i = GRID_STEPS.indexOf(quantize.gridDivision);
    const next = GRID_STEPS[(i + 1) % GRID_STEPS.length]!;
    const nextQ = { ...quantize, gridDivision: next };
    setQuantize(nextQ);
    engine.setQuantize(nextQ);
  };

  const handleStop = () => {
    if (!engine) return;
    if (recording) {
      engine.stopRecording();
      setRecording(false);
    }
  };

  const handleExport = async () => {
    if (!engine || !lastRegion) return;
    const wav = await engine.exportRegionAsWav(lastRegion);
    const blob = new Blob([wav], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pocket-${Date.now()}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!engine) {
    return (
      <div className={styles.shell}>
        <button className={styles.startBtn} onClick={startEngine}>
          ▶  START POCKET
        </button>
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
          onClickField={(f) => {
            if (f === "key" || f === "voice") setModal(f);
            else if (f === "transport") setModal("bpm");
          }}
        />
        <div className={styles.label}>CHORDS</div>
        <ChordPadGrid
          mode={key.mode}
          onPress={handleChordPress}
          onRelease={handleChordRelease}
        />
        <div className={styles.label}>MELODY</div>
        <MelodyPadRow
          labels={melodyLabels}
          litIndex={litMelodyIndex ?? undefined}
          onPress={handleMelodyPress}
          onRelease={handleMelodyRelease}
        />
        <KnobRow />
        <ModeTabs active="CHRD" enabled={["CHRD"]} />
        <TimeStrip
          metroOn={metronome}
          quantStrength={quantize.strength}
          gridDivision={quantize.gridDivision}
          onToggleMetro={handleToggleMetro}
          onCycleQuant={handleCycleQuant}
          onCycleGrid={handleCycleGrid}
          onQuantChange={(v) => {
            const nextQ = { ...quantize, strength: v };
            setQuantize(nextQ);
            engine?.setQuantize(nextQ);
          }}
          onQuantCommit={(v) => {
            const nextQ = { ...quantize, strength: v };
            setQuantize(nextQ);
            engine?.setQuantize(nextQ);
          }}
        />
        <Transport recording={recording} onRec={handleRec} onPlay={handlePlay} onStop={handleStop} />
        <button
          className={styles.startBtn}
          style={{ fontSize: 11, padding: "6px 10px" }}
          onClick={handleExport}
          disabled={!lastRegion}
        >
          BOUNCE → WAV
        </button>
        <Modal open={modal === "key"} onClose={() => setModal(null)} title="KEY">
          <KeyPicker value={key} onChange={(k) => setKey(k)} />
        </Modal>
        <Modal open={modal === "bpm"} onClose={() => setModal(null)} title="BPM">
          <BpmPicker
            value={bpm}
            onChange={(b) => {
              setBpm(b);
              engine?.setBpm(b);
            }}
          />
        </Modal>
        <Modal open={modal === "voice"} onClose={() => setModal(null)} title="VOICE">
          <VoicePicker
            voices={VOICES.map(({ id, displayName }) => ({ id, displayName }))}
            selectedId={voiceId}
            onChange={(id) => {
              setVoice(id);
              setModal(null);
            }}
          />
        </Modal>
      </div>
    </div>
  );
}
