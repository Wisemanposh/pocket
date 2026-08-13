import { describe, it, expect } from "vitest";
import { encodeWav } from "./wav";

describe("encodeWav", () => {
  it("produces a valid RIFF/WAVE header for stereo 48kHz 16-bit", () => {
    const left = new Float32Array([0, 0.5, -0.5, 1]);
    const right = new Float32Array([0, -0.5, 0.5, -1]);
    const bytes = encodeWav({
      sampleRate: 48000,
      channels: [left, right],
      bitDepth: 16,
    });
    const view = new DataView(bytes.buffer);

    // "RIFF"
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("RIFF");
    // "WAVE"
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe("WAVE");
    // "fmt "
    expect(String.fromCharCode(...bytes.slice(12, 16))).toBe("fmt ");
    // PCM format = 1
    expect(view.getUint16(20, true)).toBe(1);
    // channels = 2
    expect(view.getUint16(22, true)).toBe(2);
    // sample rate = 48000
    expect(view.getUint32(24, true)).toBe(48000);
    // bits per sample = 16
    expect(view.getUint16(34, true)).toBe(16);
    // "data" sub-chunk follows fmt
    expect(String.fromCharCode(...bytes.slice(36, 40))).toBe("data");
    // data size = 4 frames * 2 channels * 2 bytes = 16
    expect(view.getUint32(40, true)).toBe(16);
  });

  it("clips samples above +1.0 and below -1.0", () => {
    const left = new Float32Array([2, -2]); // out of range
    const right = new Float32Array([0, 0]);
    const bytes = encodeWav({ sampleRate: 48000, channels: [left, right], bitDepth: 16 });
    const view = new DataView(bytes.buffer);
    const sample0L = view.getInt16(44, true);
    const sample1L = view.getInt16(48, true);
    expect(sample0L).toBe(32767);   // clipped +1.0
    expect(sample1L).toBe(-32768);  // clipped -1.0
  });

  it("interleaves stereo samples L,R,L,R", () => {
    const left = new Float32Array([1, 0]);
    const right = new Float32Array([0, 1]);
    const bytes = encodeWav({ sampleRate: 48000, channels: [left, right], bitDepth: 16 });
    const view = new DataView(bytes.buffer);
    expect(view.getInt16(44, true)).toBe(32767);    // L0
    expect(view.getInt16(46, true)).toBe(0);        // R0
    expect(view.getInt16(48, true)).toBe(0);        // L1
    expect(view.getInt16(50, true)).toBe(32767);    // R1
  });
});
