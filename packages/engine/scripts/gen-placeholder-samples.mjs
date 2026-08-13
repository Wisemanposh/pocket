// Generates the 4 v0.1 placeholder voice samples as 48 kHz 16-bit mono WAVs.
// Re-run with `node scripts/gen-placeholder-samples.mjs` from packages/engine.
// Output: src/samples/{dx-piano-C4,chiptune-sq-C4,fm-bass-C2,808-kit}.wav

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "src", "samples");

const SR = 48000;

function encodeMonoWav(samples, sampleRate) {
  const dataSize = samples.length * 2;
  const fileSize = 44 + dataSize;
  const buf = new ArrayBuffer(fileSize);
  const v = new DataView(buf);
  const ascii = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
  ascii(0, "RIFF"); v.setUint32(4, fileSize - 8, true); ascii(8, "WAVE");
  ascii(12, "fmt "); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);            // PCM
  v.setUint16(22, 1, true);            // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  ascii(36, "data"); v.setUint32(40, dataSize, true);
  let off = 44;
  for (const s of samples) {
    const c = Math.max(-1, Math.min(1, s));
    v.setInt16(off, c < 0 ? c * 0x8000 : c * 0x7fff, true);
    off += 2;
  }
  return new Uint8Array(buf);
}

function tone({ freq, durSec, amp, wave, fadeOutSec = 0.05 }) {
  const n = Math.round(SR * durSec);
  const out = new Float32Array(n);
  const fadeOutSamples = Math.round(SR * fadeOutSec);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v;
    if (wave === "sine") v = Math.sin(2 * Math.PI * freq * t);
    else if (wave === "square") v = Math.sign(Math.sin(2 * Math.PI * freq * t));
    else if (wave === "drum") {
      // Simple drum-ish: sine + exponential amp decay
      v = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 25);
    } else v = 0;
    // Fade-in 5 ms, fade-out
    const fadeIn = Math.min(1, i / Math.round(SR * 0.005));
    const fadeOut = i >= n - fadeOutSamples ? (n - i) / fadeOutSamples : 1;
    out[i] = v * amp * fadeIn * fadeOut;
  }
  return out;
}

const samples = [
  { file: "dx-piano-C4.wav",    spec: { freq: 261.626, durSec: 1.5, amp: 0.5, wave: "sine"   } },
  { file: "chiptune-sq-C4.wav", spec: { freq: 261.626, durSec: 1.5, amp: 0.3, wave: "square" } },
  { file: "fm-bass-C2.wav",     spec: { freq: 65.406,  durSec: 1.5, amp: 0.5, wave: "sine"   } },
  { file: "808-kit.wav",        spec: { freq: 60,      durSec: 0.3, amp: 0.8, wave: "drum", fadeOutSec: 0.05 } },
];

for (const { file, spec } of samples) {
  const wav = encodeMonoWav(tone(spec), SR);
  const out = join(OUT_DIR, file);
  writeFileSync(out, wav);
  console.log(`wrote ${out} (${wav.length} bytes)`);
}
