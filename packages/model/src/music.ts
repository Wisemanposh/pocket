import type { ChordDegree, Chord, KeyCenter, MidiNote } from "./types";

// Intervals in semitones from the tonic for the major and natural-minor scales.
const SCALE_INTERVALS: Record<KeyCenter["mode"], readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};

export function scaleNotes(key: KeyCenter, tonic: MidiNote): MidiNote[] {
  return SCALE_INTERVALS[key.mode].map((iv) => tonic + iv);
}

export interface ChordOptions {
  seventh?: boolean;     // add scale-tone 7th above root (V7-style voicing)
}

// Builds a stacked-third triad at the given degree of the scale.
// With `{ seventh: true }`, appends the scale-tone 7th above the root.
export function chordAtDegree(
  key: KeyCenter,
  degree: ChordDegree,
  tonic: MidiNote,
  opts: ChordOptions = {}
): Chord {
  // Build a three-octave scale so any extension stays in-scale.
  const oneOctave = scaleNotes(key, tonic);
  const scale = [
    ...oneOctave,
    ...oneOctave.map((n) => n + 12),
    ...oneOctave.map((n) => n + 24),
  ];
  const root = scale[degree]!;
  const third = scale[degree + 2]!;
  const fifth = scale[degree + 4]!;
  const notes: MidiNote[] = [root, third, fifth];
  if (opts.seventh) {
    notes.push(scale[degree + 6]!);
  }
  return { root, notes };
}

export function midiToFreq(note: MidiNote): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

// Ratio to play a sample (recorded at sampleRoot) to make it sound at targetNote.
export function playbackRate(targetNote: MidiNote, sampleRoot: MidiNote): number {
  return Math.pow(2, (targetNote - sampleRoot) / 12);
}
