import { create } from "zustand";
import type { KeyCenter, VoiceId, Region, QuantizeSettings } from "@pocket/model";
import {
  DEFAULT_FX,
  DEFAULT_MACROS,
  type FxValues,
  type MacroValues,
} from "@pocket/engine";

export type InstrumentMode = "CHRD" | "SEQ" | "TAPE" | "FX";

export interface TapeTrackState {
  id: number;
  name: string;
  region: Region | null;
  volume: number;
  muted: boolean;
  solo: boolean;
}

export function createSequenceGrid(): boolean[][] {
  return Array.from({ length: 8 }, (_, lane) =>
    Array.from({ length: 16 }, (_, step) => lane === 0 && step % 4 === 0)
  );
}

export function createTapeTracks(): TapeTrackState[] {
  return ["CHORD", "BASS", "SEQ", "AUX"].map((name, index) => ({
    id: index + 1,
    name,
    region: null,
    volume: 1,
    muted: false,
    solo: false,
  }));
}

export interface AppState {
  key: KeyCenter;
  tonicMidi: number;
  bpm: number;
  voiceId: VoiceId;
  mode: InstrumentMode;
  recording: boolean;
  metronome: boolean;
  quantize: QuantizeSettings;
  macros: MacroValues;
  fx: FxValues;
  tracks: TapeTrackState[];
  activeTrackId: number;
  sequenceGrid: boolean[][];
  sequenceLane: number;
  sequenceStep: number;
  sequenceRunning: boolean;

  setKey: (key: KeyCenter) => void;
  setVoice: (voice: VoiceId) => void;
  setMode: (mode: InstrumentMode) => void;
  setRecording: (recording: boolean) => void;
  setMetronome: (metronome: boolean) => void;
  setQuantize: (quantize: QuantizeSettings) => void;
  setBpm: (bpm: number) => void;
  setMacro: (name: keyof MacroValues, value: number) => void;
  setFx: (name: keyof FxValues, value: number) => void;
  setActiveTrack: (trackId: number) => void;
  setTrackRegion: (trackId: number, region: Region) => void;
  toggleTrackMute: (trackId: number) => void;
  toggleTrackSolo: (trackId: number) => void;
  setTrackVolume: (trackId: number, volume: number) => void;
  clearTrack: (trackId: number) => void;
  setSequenceLane: (lane: number) => void;
  setSequenceStep: (step: number) => void;
  setSequenceRunning: (running: boolean) => void;
  toggleSequenceStep: (lane: number, step: number) => void;
  clearSequence: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  key: { root: 0, mode: "minor" },
  tonicMidi: 60,
  bpm: 92,
  voiceId: "dx-piano",
  mode: "CHRD",
  recording: false,
  metronome: false,
  quantize: { strength: 0.75, gridDivision: "1/8" },
  macros: { ...DEFAULT_MACROS },
  fx: { ...DEFAULT_FX },
  tracks: createTapeTracks(),
  activeTrackId: 1,
  sequenceGrid: createSequenceGrid(),
  sequenceLane: 0,
  sequenceStep: -1,
  sequenceRunning: false,

  setKey: (key) => set({ key }),
  setVoice: (voiceId) => set({ voiceId }),
  setMode: (mode) => set({ mode }),
  setRecording: (recording) => set({ recording }),
  setMetronome: (metronome) => set({ metronome }),
  setQuantize: (quantize) => set({ quantize }),
  setBpm: (bpm) => set({ bpm }),
  setMacro: (name, value) => set((state) => ({ macros: { ...state.macros, [name]: value } })),
  setFx: (name, value) => set((state) => ({ fx: { ...state.fx, [name]: value } })),
  setActiveTrack: (activeTrackId) => set({ activeTrackId }),
  setTrackRegion: (trackId, region) =>
    set((state) => ({
      tracks: state.tracks.map((track) => (track.id === trackId ? { ...track, region } : track)),
    })),
  toggleTrackMute: (trackId) =>
    set((state) => ({
      tracks: state.tracks.map((track) =>
        track.id === trackId ? { ...track, muted: !track.muted } : track
      ),
    })),
  toggleTrackSolo: (trackId) =>
    set((state) => ({
      tracks: state.tracks.map((track) =>
        track.id === trackId ? { ...track, solo: !track.solo } : track
      ),
    })),
  setTrackVolume: (trackId, volume) =>
    set((state) => ({
      tracks: state.tracks.map((track) =>
        track.id === trackId ? { ...track, volume: Math.max(0, Math.min(1.25, volume)) } : track
      ),
    })),
  clearTrack: (trackId) =>
    set((state) => ({
      tracks: state.tracks.map((track) =>
        track.id === trackId ? { ...track, region: null } : track
      ),
    })),
  setSequenceLane: (sequenceLane) => set({ sequenceLane }),
  setSequenceStep: (sequenceStep) => set({ sequenceStep }),
  setSequenceRunning: (sequenceRunning) => set({ sequenceRunning }),
  toggleSequenceStep: (lane, step) =>
    set((state) => ({
      sequenceGrid: state.sequenceGrid.map((row, rowIndex) =>
        rowIndex === lane
          ? row.map((enabled, stepIndex) => (stepIndex === step ? !enabled : enabled))
          : row
      ),
    })),
  clearSequence: () => set({ sequenceGrid: Array.from({ length: 8 }, () => Array(16).fill(false)) }),
}));
