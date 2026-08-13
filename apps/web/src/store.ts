import { create } from "zustand";
import type { KeyCenter, VoiceId, Region, QuantizeSettings } from "@pocket/model";

export interface AppState {
  key: KeyCenter;
  tonicMidi: number;
  bpm: number;
  voiceId: VoiceId;
  recording: boolean;
  lastRegion: Region | null;
  litChordPosition: number | null;
  litMelodyIndex: number | null;
  metronome: boolean;
  quantize: QuantizeSettings;

  setKey: (k: KeyCenter) => void;
  setVoice: (v: VoiceId) => void;
  setRecording: (b: boolean) => void;
  setLastRegion: (r: Region) => void;
  setLitChordPosition: (i: number | null) => void;
  setLitMelodyIndex: (i: number | null) => void;
  setMetronome: (b: boolean) => void;
  setQuantize: (q: QuantizeSettings) => void;
  setBpm: (b: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  key: { root: 0, mode: "minor" },
  tonicMidi: 60,
  bpm: 92,
  voiceId: "dx-piano",
  recording: false,
  lastRegion: null,
  litChordPosition: null,
  litMelodyIndex: null,
  metronome: false,
  quantize: { strength: 0.75, gridDivision: "1/8" },

  setKey: (k) => set({ key: k }),
  setVoice: (v) => set({ voiceId: v }),
  setRecording: (b) => set({ recording: b }),
  setLastRegion: (r) => set({ lastRegion: r }),
  setLitChordPosition: (i) => set({ litChordPosition: i }),
  setLitMelodyIndex: (i) => set({ litMelodyIndex: i }),
  setMetronome: (b) => set({ metronome: b }),
  setQuantize: (q) => set({ quantize: q }),
  setBpm: (b) => set({ bpm: b }),
}));
