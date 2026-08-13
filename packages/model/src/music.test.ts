import { describe, it, expect } from "vitest";
import { chordAtDegree, midiToFreq, playbackRate, scaleNotes } from "./music";
import type { KeyCenter } from "./types";

const C_major: KeyCenter = { root: 0, mode: "major" };
const C_minor: KeyCenter = { root: 0, mode: "minor" };

describe("scaleNotes", () => {
  it("returns C major scale starting at C4 (MIDI 60)", () => {
    expect(scaleNotes(C_major, 60)).toEqual([60, 62, 64, 65, 67, 69, 71]);
  });

  it("returns C natural minor scale starting at C4", () => {
    expect(scaleNotes(C_minor, 60)).toEqual([60, 62, 63, 65, 67, 68, 70]);
  });
});

describe("chordAtDegree", () => {
  it("I chord in C major rooted at C4 is C-E-G", () => {
    expect(chordAtDegree(C_major, 0, 60)).toEqual({
      root: 60,
      notes: [60, 64, 67],
    });
  });

  it("V chord in C major rooted at C4 is G-B-D", () => {
    expect(chordAtDegree(C_major, 4, 60)).toEqual({
      root: 67,
      notes: [67, 71, 74],
    });
  });

  it("i chord in C minor rooted at C4 is C-Eb-G", () => {
    expect(chordAtDegree(C_minor, 0, 60)).toEqual({
      root: 60,
      notes: [60, 63, 67],
    });
  });

  it("iv chord in C minor rooted at C4 is F-Ab-C", () => {
    expect(chordAtDegree(C_minor, 3, 60)).toEqual({
      root: 65,
      notes: [65, 68, 72],
    });
  });

  it("V7 in C major rooted at C4 is G-B-D-F (scale-tone 7th)", () => {
    expect(chordAtDegree(C_major, 4, 60, { seventh: true })).toEqual({
      root: 67,
      notes: [67, 71, 74, 77],   // G B D F
    });
  });

  it("v7 in C minor rooted at C4 is G-Bb-D-F (scale-tone 7th)", () => {
    expect(chordAtDegree(C_minor, 4, 60, { seventh: true })).toEqual({
      root: 67,
      notes: [67, 70, 74, 77],   // G Bb D F
    });
  });
});

describe("midiToFreq", () => {
  it("A4 (MIDI 69) is 440 Hz", () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 4);
  });

  it("A5 (MIDI 81) is 880 Hz", () => {
    expect(midiToFreq(81)).toBeCloseTo(880, 4);
  });

  it("C4 (MIDI 60) is ~261.626 Hz", () => {
    expect(midiToFreq(60)).toBeCloseTo(261.6256, 3);
  });
});

describe("playbackRate", () => {
  it("same note returns 1.0", () => {
    expect(playbackRate(60, 60)).toBeCloseTo(1, 6);
  });

  it("one octave up returns 2.0", () => {
    expect(playbackRate(72, 60)).toBeCloseTo(2, 6);
  });

  it("one octave down returns 0.5", () => {
    expect(playbackRate(48, 60)).toBeCloseTo(0.5, 6);
  });
});
