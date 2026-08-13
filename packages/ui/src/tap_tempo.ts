/**
 * Tap-tempo derivation from a series of tap timestamps (ms).
 * Returns BPM after the 2nd+ tap, or null on the 1st or after a > 2s gap.
 * Clamps to [40, 240].
 */
export class TapTempo {
  private taps: number[] = [];
  private static readonly MAX_HISTORY = 4;
  private static readonly RESET_GAP_MS = 2000;
  private static readonly MIN_BPM = 40;
  private static readonly MAX_BPM = 240;

  tap(nowMs: number): number | null {
    const last = this.taps[this.taps.length - 1];
    if (last !== undefined && nowMs - last > TapTempo.RESET_GAP_MS) {
      this.taps = [nowMs];
      return null;
    }
    this.taps.push(nowMs);
    if (this.taps.length > TapTempo.MAX_HISTORY) {
      this.taps.shift();
    }
    if (this.taps.length < 2) return null;
    const intervals: number[] = [];
    for (let i = 1; i < this.taps.length; i++) {
      intervals.push(this.taps[i]! - this.taps[i - 1]!);
    }
    const meanMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const bpm = 60000 / meanMs;
    return Math.round(Math.max(TapTempo.MIN_BPM, Math.min(TapTempo.MAX_BPM, bpm)));
  }
}
