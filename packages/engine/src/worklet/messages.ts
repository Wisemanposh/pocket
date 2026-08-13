import type { NoteEvent, QuantizeSettings } from "@pocket/model";

// Messages from main thread → worklet
export type MainToWorklet =
  | { type: "load-voice"; voiceId: string; rootMidi: number; samples: Float32Array }
  | { type: "note-on"; voiceId: string; midi: number; envelopeMs: { attack: number; release: number } }
  | { type: "note-off"; voiceId: string; midi: number }
  | { type: "set-active-track"; trackId: number }
  | { type: "rec-start" }
  | { type: "rec-stop" }
  | { type: "fetch-region"; requestId: number; startSample: number; endSample: number }
  | {
      type: "play-events";
      notes: NoteEvent[];
      bpm: number;
      quantize: QuantizeSettings;
      regionStartSample: number;
      envelopeMs: { attack: number; release: number };
    }
  | { type: "set-metronome"; on: boolean }
  | { type: "set-bpm"; bpm: number };

// Messages from worklet → main thread
export type WorkletToMain =
  | { type: "ready" }
  | { type: "rec-region"; trackId: number; startSample: number; endSample: number; notes: NoteEvent[] }
  | { type: "region-data"; requestId: number; left: Float32Array; right: Float32Array }
  | { type: "log"; level: "info" | "warn" | "error"; msg: string };
