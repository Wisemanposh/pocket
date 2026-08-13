import { create } from "zustand";
import type { KeyCenter, VoiceId, Region, QuantizeSettings } from "@pocket/model";
import { DEFAULT_MACROS, type MacroValues } from "@pocket/engine";

export interface AppState {
  key: KeyCenter;
  tonicMidi: number;
  bpm: number;
  voiceId: VoiceId;
  recording: boolean;
  lastRegion: Region | null;
  metronome: boolean;
  quantize: QuantizeSettings;
  macros: MacroValues;

  setKey: (k: KeyCenter) => void;
  setVoice: (v: VoiceId) => void;
  setRecording: (b: boolean) => void;
  setLastRegion: (r: Region) => void;
  setMetronome: (b: boolean) => void;
  setQuantize: (q: QuantizeSettings) => void;
  setBpm: (b: number) => void;
  setMacro: (name: keyof MacroValues, value: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  key: { root: 0, mode: "minor" },
  tonicMidi: 60,
  bpm: 92,
  voiceId: "dx-piano",
  recording: false,
  lastRegion: null,
  metronome: false,
  quantize: { strength: 0.75, gridDivision: "1/8" },
  macros: { ...DEFAULT_MACROS },

  setKey: (k) => set({ key: k }),
  setVoice: (v) => set({ voiceId: v }),
  setRecording: (b) => set({ recording: b }),
  setLastRegion: (r) => set({ lastRegion: r }),
  setMetronome: (b) => set({ metronome: b }),
  setQuantize: (q) => set({ quantize: q }),
  setBpm: (b) => set({ bpm: b }),
  setMacro: (name, value) => set((state) => ({ macros: { ...state.macros, [name]: value } })),
}));
