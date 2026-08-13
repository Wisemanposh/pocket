export interface MacroValues {
  shape: number;
  filter: number;
  attack: number;
  release: number;
}

export const DEFAULT_MACROS: MacroValues = {
  shape: 0.25,
  filter: 1,
  attack: 0,
  release: 0.3,
};

export function clampMacro(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function attackMsFromMacro(value: number): number {
  const normalized = clampMacro(value);
  return 5 + 1995 * normalized * normalized;
}

export function releaseMsFromMacro(value: number): number {
  const normalized = clampMacro(value);
  return 20 + 2000 * normalized * normalized;
}

export function filterHzFromMacro(value: number): number {
  return 250 * Math.pow(80, clampMacro(value));
}

export function shapeSample(sample: number, value: number): number {
  const amount = clampMacro(value);
  if (amount === 0) return sample;
  const drive = 1 + amount * 8;
  const saturated = Math.tanh(sample * drive) / Math.tanh(drive);
  return Math.max(-1, Math.min(1, sample * (1 - amount) + saturated * amount));
}
