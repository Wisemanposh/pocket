export interface EncodeWavOptions {
  sampleRate: number;
  channels: Float32Array[];      // 1 = mono, 2 = stereo
  bitDepth: 16 | 24;
}

export function encodeWav(opts: EncodeWavOptions): Uint8Array {
  if (opts.bitDepth !== 16) {
    throw new Error("v0.1 only supports 16-bit PCM");
  }
  const channels = opts.channels;
  const numChannels = channels.length;
  if (numChannels < 1 || numChannels > 2) {
    throw new Error("encodeWav supports mono or stereo only");
  }
  const numFrames = channels[0]!.length;
  for (const ch of channels) {
    if (ch.length !== numFrames) {
      throw new Error("all channels must have equal length");
    }
  }

  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const fileSize = 44 + dataSize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // RIFF header
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, fileSize - 8, true);
  writeAscii(view, 8, "WAVE");

  // fmt chunk
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);              // chunk size
  view.setUint16(20, 1, true);               // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, opts.sampleRate, true);
  view.setUint32(28, opts.sampleRate * blockAlign, true);  // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);              // bits per sample

  // data chunk
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = clamp(channels[c]![i]!, -1, 1);
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Uint8Array(buffer);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function writeAscii(view: DataView, offset: number, ascii: string): void {
  for (let i = 0; i < ascii.length; i++) {
    view.setUint8(offset + i, ascii.charCodeAt(i));
  }
}
