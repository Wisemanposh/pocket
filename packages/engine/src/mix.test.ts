import { describe, expect, it } from "vitest";
import { mixStereoTracks } from "./mix";

describe("mixStereoTracks", () => {
  it("aligns tracks at their start and applies gain", () => {
    const mixed = mixStereoTracks([
      {
        left: new Float32Array([0.25, 0.5]),
        right: new Float32Array([0.1, 0.2]),
        gain: 1,
      },
      {
        left: new Float32Array([0.5]),
        right: new Float32Array([0.5]),
        gain: 0.5,
      },
    ]);
    expect(Array.from(mixed.left)).toEqual([0.5, 0.5]);
    expect(mixed.right[0]).toBeCloseTo(0.35);
    expect(mixed.right[1]).toBeCloseTo(0.2);
  });

  it("clamps the mixed bus to the PCM range", () => {
    const mixed = mixStereoTracks([
      { left: new Float32Array([0.8]), right: new Float32Array([-0.8]), gain: 1 },
      { left: new Float32Array([0.8]), right: new Float32Array([-0.8]), gain: 1 },
    ]);
    expect(mixed.left[0]).toBe(1);
    expect(mixed.right[0]).toBe(-1);
  });

  it("sums the full bus before clipping so cancellation is not order-dependent", () => {
    const mixed = mixStereoTracks([
      { left: new Float32Array([0.8]), right: new Float32Array([0.8]), gain: 1 },
      { left: new Float32Array([0.8]), right: new Float32Array([0.8]), gain: 1 },
      { left: new Float32Array([-0.6]), right: new Float32Array([-0.6]), gain: 1 },
    ]);
    expect(mixed.left[0]).toBeCloseTo(1);
    expect(mixed.right[0]).toBeCloseTo(1);
  });

  it("ignores corrupt samples and safely defaults a non-finite gain", () => {
    const mixed = mixStereoTracks([
      {
        left: new Float32Array([Number.NaN, 0.25]),
        right: new Float32Array([Number.POSITIVE_INFINITY, 0.5]),
        gain: Number.NaN,
      },
    ]);
    expect(Array.from(mixed.left)).toEqual([0, 0.25]);
    expect(Array.from(mixed.right)).toEqual([0, 0.5]);
  });
});
