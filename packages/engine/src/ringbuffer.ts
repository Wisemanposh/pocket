/**
 * StereoRingBuffer — fixed-capacity ring buffer of (L,R) float samples.
 *
 * Coordinates: callers refer to samples by their absolute index (0 = first
 * sample ever written). The buffer holds the most recent `capacity` samples;
 * older samples are overwritten silently.
 */
export class StereoRingBuffer {
  private readonly left: Float32Array;
  private readonly right: Float32Array;
  private writePos = 0;          // ring position [0, capacity)
  private writtenTotal = 0;      // monotonic count of samples ever written

  constructor(public readonly capacity: number) {
    if (capacity <= 0) throw new Error("capacity must be > 0");
    // Allocated as SharedArrayBuffer so a future cross-thread variant works.
    const sab = new SharedArrayBuffer(capacity * 4 * 2);
    this.left = new Float32Array(sab, 0, capacity);
    this.right = new Float32Array(sab, capacity * 4, capacity);
  }

  write(l: Float32Array, r: Float32Array): void {
    if (l.length !== r.length) throw new Error("L and R must match length");
    for (let i = 0; i < l.length; i++) {
      this.left[this.writePos] = l[i]!;
      this.right[this.writePos] = r[i]!;
      this.writePos = (this.writePos + 1) % this.capacity;
      this.writtenTotal++;
    }
  }

  totalWritten(): number {
    return this.writtenTotal;
  }

  oldestAvailable(): number {
    return Math.max(0, this.writtenTotal - this.capacity);
  }

  /** Read `out.length` samples starting at absolute sample index `start`. */
  read(start: number, outL: Float32Array, outR: Float32Array): void {
    if (outL.length !== outR.length) throw new Error("L and R must match length");
    const oldest = this.oldestAvailable();
    if (start < oldest || start + outL.length > this.writtenTotal) {
      throw new Error(
        `read range out of range: [${start}..${start + outL.length}) not in [${oldest}..${this.writtenTotal})`
      );
    }
    for (let i = 0; i < outL.length; i++) {
      const ringIdx = (start + i) % this.capacity;
      outL[i] = this.left[ringIdx]!;
      outR[i] = this.right[ringIdx]!;
    }
  }
}
