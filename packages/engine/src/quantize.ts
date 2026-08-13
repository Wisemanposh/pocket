import type { GridDivision } from "@pocket/model";

/**
 * Shift `t` toward the nearest multiple of `gridSamples` by `strength` (0..1).
 * strength=0 returns t unchanged. strength=1 snaps exactly to the grid.
 */
export function snap(t: number, gridSamples: number, strength: number): number {
  const nearest = Math.round(t / gridSamples) * gridSamples;
  return t + strength * (nearest - t);
}

const RATIO: Record<GridDivision, number> = {
  "1/4": 1,
  "1/8": 0.5,
  "1/16": 0.25,
};

export function bpmToGridSamples(
  bpm: number,
  division: GridDivision,
  sampleRate: number
): number {
  return (60 / bpm) * sampleRate * RATIO[division];
}
