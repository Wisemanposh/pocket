import { describe, it, expect } from "vitest";
import { snap, bpmToGridSamples } from "./quantize";

describe("snap", () => {
  it("returns t unchanged when strength = 0", () => {
    expect(snap(100, 50, 0)).toBe(100);
    expect(snap(127, 50, 0)).toBe(127);
  });

  it("snaps exactly to nearest grid slot when strength = 1", () => {
    expect(snap(100, 50, 1)).toBe(100);
    expect(snap(110, 50, 1)).toBe(100);
    expect(snap(126, 50, 1)).toBe(150);
    expect(snap(125, 50, 1)).toBe(150);
  });

  it("interpolates partway at intermediate strength", () => {
    expect(snap(120, 100, 0.5)).toBe(110);
    expect(snap(120, 100, 0.75)).toBe(105);
  });

  it("handles fractional samples", () => {
    expect(snap(99.6, 100, 1)).toBeCloseTo(100, 6);
  });
});

describe("bpmToGridSamples", () => {
  it("at 60 BPM 48kHz, 1/4 = 48000 samples", () => {
    expect(bpmToGridSamples(60, "1/4", 48000)).toBe(48000);
  });

  it("at 120 BPM 48kHz, 1/4 = 24000 samples", () => {
    expect(bpmToGridSamples(120, "1/4", 48000)).toBe(24000);
  });

  it("1/8 is half of 1/4", () => {
    expect(bpmToGridSamples(120, "1/8", 48000)).toBe(12000);
  });

  it("1/16 is quarter of 1/4", () => {
    expect(bpmToGridSamples(120, "1/16", 48000)).toBe(6000);
  });
});
