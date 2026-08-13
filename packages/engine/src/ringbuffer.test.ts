import { describe, it, expect } from "vitest";
import { StereoRingBuffer } from "./ringbuffer";

describe("StereoRingBuffer", () => {
  it("writes and reads back samples in order", () => {
    const rb = new StereoRingBuffer(10);
    rb.write(new Float32Array([1, 2, 3]), new Float32Array([10, 20, 30]));

    const outL = new Float32Array(3);
    const outR = new Float32Array(3);
    rb.read(0, outL, outR);

    expect(Array.from(outL)).toEqual([1, 2, 3]);
    expect(Array.from(outR)).toEqual([10, 20, 30]);
  });

  it("wraps around when capacity is exceeded", () => {
    const rb = new StereoRingBuffer(4);
    rb.write(new Float32Array([1, 2, 3, 4, 5]), new Float32Array([10, 20, 30, 40, 50]));
    // After writing 5 into a 4-sample buffer, total writes = 5, capacity 4.
    // Position 1 (oldest still in buffer) onward should read 2,3,4,5.
    const outL = new Float32Array(4);
    const outR = new Float32Array(4);
    rb.read(1, outL, outR);
    expect(Array.from(outL)).toEqual([2, 3, 4, 5]);
    expect(Array.from(outR)).toEqual([20, 30, 40, 50]);
  });

  it("totalWritten counts all samples ever written", () => {
    const rb = new StereoRingBuffer(4);
    rb.write(new Float32Array([1, 2, 3]), new Float32Array([1, 2, 3]));
    rb.write(new Float32Array([4, 5, 6]), new Float32Array([4, 5, 6]));
    expect(rb.totalWritten()).toBe(6);
  });

  it("reading before the oldest available sample throws", () => {
    const rb = new StereoRingBuffer(4);
    rb.write(new Float32Array([1, 2, 3, 4, 5]), new Float32Array([1, 2, 3, 4, 5]));
    // Oldest still in buffer is sample index 1. Reading from 0 should throw.
    const outL = new Float32Array(1);
    const outR = new Float32Array(1);
    expect(() => rb.read(0, outL, outR)).toThrow(/out of range/i);
  });
});
