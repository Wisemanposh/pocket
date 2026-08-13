// MIDI note number, 0..127. C4 = 60.
export type MidiNote = number;

// 12 pitch classes, 0 = C, 11 = B.
export type PitchClass = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export type Mode = "major" | "minor";

export interface KeyCenter {
  root: PitchClass;
  mode: Mode;
}

// Diatonic chord degree indices into a 7-note scale.
export type ChordDegree = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Chord {
  root: MidiNote;
  notes: MidiNote[];   // sorted ascending, triad in v0.1
}

export type VoiceId =
  | "dx-piano"
  | "chiptune-sq"
  | "fm-bass"
  | "808-kit";

export interface Voice {
  id: VoiceId;
  displayName: string;
  sampleUrl: string;       // URL relative to engine package
  rootMidi: MidiNote;      // pitch the sample was recorded at
  drumKit: boolean;        // 808-kit = true; ignores chord harmony
}

// A recorded span in the always-on ring buffer, by sample index.
export interface Region {
  startSample: number;
  endSample: number;
  gain: number;            // linear, default 1
  notes: NoteEvent[];      // v0.2
}

// v0.2: event log captured during recording, used for playback-time quantize.
export interface NoteEvent {
  voiceId: VoiceId;
  midi: MidiNote;
  rawStartSample: number;
  rawEndSample: number;
}

export type GridDivision = "1/4" | "1/8" | "1/16";

export interface QuantizeSettings {
  strength: number;          // 0..1
  gridDivision: GridDivision;
}
