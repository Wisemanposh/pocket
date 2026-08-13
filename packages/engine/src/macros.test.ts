import { describe, expect, it } from "vitest";
import {
  attackMsFromMacro,
  clampMacro,
  filterHzFromMacro,
  releaseMsFromMacro,
  shapeSample,
} from "./macros";

describe("macro mappings", () => {
  it("clamps invalid and out-of-range values", () => {
    expect(clampMacro(-1)).toBe(0);
    expect(clampMacro(2)).toBe(1);
    expect(clampMacro(Number.NaN)).toBe(0);
  });

  it("maps attack, release, and filter to safe audio ranges", () => {
    expect(attackMsFromMacro(0)).toBe(5);
    expect(attackMsFromMacro(1)).toBe(2000);
    expect(releaseMsFromMacro(0)).toBe(20);
    expect(releaseMsFromMacro(1)).toBe(2020);
    expect(filterHzFromMacro(0)).toBe(250);
    expect(filterHzFromMacro(1)).toBeCloseTo(20000);
  });

  it("leaves the signal clean at zero shape and remains bounded when driven", () => {
    expect(shapeSample(0.4, 0)).toBe(0.4);
    expect(Math.abs(shapeSample(2, 1))).toBeLessThanOrEqual(1);
  });
});
