import type { Voice } from "@pocket/model";

// Vite supports importing assets as URLs via the `?url` suffix.
import dxPianoUrl from "./samples/dx-piano-C4.wav?url";
import chiptuneSqUrl from "./samples/chiptune-sq-C4.wav?url";
import fmBassUrl from "./samples/fm-bass-C2.wav?url";
import drumKitUrl from "./samples/808-kit.wav?url";

export const VOICES: Voice[] = [
  { id: "dx-piano",    displayName: "DX Piano",    sampleUrl: dxPianoUrl,    rootMidi: 60, drumKit: false },
  { id: "chiptune-sq", displayName: "Chiptune SQ", sampleUrl: chiptuneSqUrl, rootMidi: 60, drumKit: false },
  { id: "fm-bass",     displayName: "FM Bass",     sampleUrl: fmBassUrl,     rootMidi: 36, drumKit: false },
  { id: "808-kit",     displayName: "808 Kit",     sampleUrl: drumKitUrl,    rootMidi: 60, drumKit: true  },
];

export function findVoice(id: string): Voice | undefined {
  return VOICES.find((v) => v.id === id);
}
