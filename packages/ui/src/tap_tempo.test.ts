import { describe, it, expect } from "vitest";
import { TapTempo } from "./tap_tempo";

describe("TapTempo", () => {
  it("returns null on first tap", () => {
    const t = new TapTempo();
    expect(t.tap(1000)).toBeNull();
  });

  it("returns BPM after second tap (interval becomes the basis)", () => {
    const t = new TapTempo();
    t.tap(1000);
    expect(t.tap(1500)).toBeCloseTo(120, 1);
  });

  it("averages multiple intervals", () => {
    const t = new TapTempo();
    t.tap(1000);
    t.tap(1500);             // interval 500
    t.tap(2050);             // interval 550
    // After 4 taps (2575), intervals over last 3 entries = {500, 550, 525}; mean=525 → ~114 BPM
    expect(t.tap(2575)).toBeCloseTo(114, 0);
  });

  it("resets if more than 2 seconds between taps", () => {
    const t = new TapTempo();
    t.tap(1000);
    t.tap(1500);
    expect(t.tap(5000)).toBeNull();
  });

  it("clamps BPM to range 40..240", () => {
    const t = new TapTempo();
    t.tap(1000);
    expect(t.tap(1010)).toBe(240);
    const t2 = new TapTempo();
    t2.tap(0);
    expect(t2.tap(1900)).toBe(40);
  });
});
