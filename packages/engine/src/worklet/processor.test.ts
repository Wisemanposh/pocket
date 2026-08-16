import { beforeAll, describe, expect, it, vi } from "vitest";
import type { MainToWorklet, WorkletToMain } from "./messages";

class FakePort {
  onmessage: ((event: MessageEvent<MainToWorklet>) => void) | null = null;
  messages: WorkletToMain[] = [];

  postMessage(message: WorkletToMain): void {
    this.messages.push(message);
  }
}

interface TestProcessor {
  port: FakePort;
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean;
}

let Processor: new () => TestProcessor;

beforeAll(async () => {
  class FakeAudioWorkletProcessor {
    port = new FakePort();
  }
  vi.stubGlobal("sampleRate", 1000);
  vi.stubGlobal("AudioWorkletProcessor", FakeAudioWorkletProcessor);
  vi.stubGlobal("registerProcessor", (_name: string, ctor: new () => TestProcessor) => {
    Processor = ctor;
  });
  await import("./processor");
});

function send(processor: TestProcessor, message: MainToWorklet): void {
  processor.port.onmessage?.({ data: message } as MessageEvent<MainToWorklet>);
}

function render(processor: TestProcessor, frames: number): [Float32Array, Float32Array] {
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  processor.process([], [[left, right]], {});
  return [left, right];
}

function loadVoice(processor: TestProcessor, length = 10_000): void {
  send(processor, {
    type: "load-voice",
    voiceId: "dx-piano",
    rootMidi: 60,
    samples: new Float32Array(length).fill(0.25),
  });
}

function latest<T extends WorkletToMain["type"]>(
  processor: TestProcessor,
  type: T
): Extract<WorkletToMain, { type: T }> | undefined {
  for (let index = processor.port.messages.length - 1; index >= 0; index--) {
    const message = processor.port.messages[index];
    if (message?.type === type) {
      return message as Extract<WorkletToMain, { type: T }>;
    }
  }
  return undefined;
}

describe("PocketProcessor", () => {
  it("releases overlapping notes by unique press identity", () => {
    const processor = new Processor();
    loadVoice(processor);
    send(processor, {
      type: "note-on",
      noteId: 1,
      voiceId: "dx-piano",
      midi: 60,
      envelopeMs: { attack: 0, release: 5 },
    });
    send(processor, {
      type: "note-on",
      noteId: 2,
      voiceId: "dx-piano",
      midi: 60,
      envelopeMs: { attack: 0, release: 5 },
    });
    render(processor, 10);
    send(processor, { type: "note-off", noteId: 1 });
    const [left] = render(processor, 20);
    expect(left.at(-1)).toBeGreaterThan(0.1);

    send(processor, { type: "note-off", noteId: 2 });
    const [released] = render(processor, 20);
    expect(Math.abs(released.at(-1) ?? 1)).toBeLessThan(0.001);
  });

  it("records a note that was already held when REC began", () => {
    const processor = new Processor();
    loadVoice(processor);
    send(processor, {
      type: "note-on",
      noteId: 7,
      voiceId: "dx-piano",
      midi: 64,
      envelopeMs: { attack: 0, release: 5 },
    });
    render(processor, 10);
    send(processor, { type: "rec-start" });
    render(processor, 20);
    send(processor, { type: "rec-stop" });

    const region = latest(processor, "rec-region");
    expect(region?.startSample).toBe(10);
    expect(region?.endSample).toBe(30);
    expect(region?.notes).toEqual([
      {
        voiceId: "dx-piano",
        midi: 64,
        rawStartSample: 10,
        rawEndSample: 30,
      },
    ]);
  });

  it("returns an explicit error for an unavailable region", () => {
    const processor = new Processor();
    render(processor, 10);
    send(processor, {
      type: "fetch-region",
      requestId: 3,
      startSample: 0,
      endSample: 20,
    });
    expect(latest(processor, "region-error")?.requestId).toBe(3);
  });

  it("keeps the monitoring metronome out of recorded tape", () => {
    const processor = new Processor();
    send(processor, { type: "set-metronome", on: true });
    send(processor, { type: "rec-start" });
    const [monitor] = render(processor, 20);
    send(processor, { type: "rec-stop" });
    send(processor, {
      type: "fetch-region",
      requestId: 4,
      startSample: 0,
      endSample: 20,
    });

    expect(Array.from(monitor).some((sample) => Math.abs(sample) > 0)).toBe(true);
    const data = latest(processor, "region-data");
    expect(data && Array.from(data.left).every((sample) => sample === 0)).toBe(true);
  });

  it("stops scheduled playback and finishes naturally exhausted samples", () => {
    const processor = new Processor();
    loadVoice(processor, 4);
    send(processor, {
      type: "play-events",
      notes: [
        {
          voiceId: "dx-piano",
          midi: 60,
          rawStartSample: 0,
          rawEndSample: 100,
        },
      ],
      bpm: 120,
      quantize: { strength: 0, gridDivision: "1/8" },
      regionStartSample: 0,
      envelopeMs: { attack: 0, release: 5 },
    });
    expect(latest(processor, "playback-state")?.playing).toBe(true);
    render(processor, 120);
    expect(latest(processor, "playback-state")?.playing).toBe(false);

    send(processor, {
      type: "play-events",
      notes: [
        {
          voiceId: "dx-piano",
          midi: 60,
          rawStartSample: 0,
          rawEndSample: 100,
        },
      ],
      bpm: 120,
      quantize: { strength: 0, gridDivision: "1/8" },
      regionStartSample: 0,
      envelopeMs: { attack: 0, release: 5 },
    });
    send(processor, { type: "stop-playback" });
    expect(latest(processor, "playback-state")?.playing).toBe(false);
  });

  it("runs a 16-step sequence and records its generated notes", () => {
    const processor = new Processor();
    loadVoice(processor);
    const steps = Array.from({ length: 16 }, () => [] as Array<{ voiceId: string; midi: number }>);
    steps[0] = [{ voiceId: "dx-piano", midi: 60 }];
    send(processor, {
      type: "set-sequence",
      running: true,
      bpm: 120,
      steps,
      envelopeMs: { attack: 0, release: 5 },
    });
    send(processor, { type: "rec-start" });
    render(processor, 140);
    send(processor, { type: "rec-stop" });
    send(processor, {
      type: "set-sequence",
      running: false,
      bpm: 120,
      steps,
      envelopeMs: { attack: 0, release: 5 },
    });

    expect(latest(processor, "sequence-step")?.step).toBe(-1);
    expect(latest(processor, "rec-region")?.notes[0]).toMatchObject({
      voiceId: "dx-piano",
      midi: 60,
      rawStartSample: 0,
    });
  });

  it("applies audible delay FX while preserving a bounded output", () => {
    const processor = new Processor();
    loadVoice(processor, 5);
    send(processor, {
      type: "set-fx",
      values: { reverb: 0, delay: 1, saturation: 0.5, wow: 0 },
    });
    send(processor, {
      type: "note-on",
      noteId: 10,
      voiceId: "dx-piano",
      midi: 60,
      envelopeMs: { attack: 0, release: 5 },
    });
    const [left] = render(processor, 500);
    expect(Array.from(left).some((sample, index) => index > 250 && Math.abs(sample) > 0)).toBe(true);
    expect(Array.from(left).every((sample) => Number.isFinite(sample))).toBe(true);
    expect(Array.from(left).every((sample) => Math.abs(sample) <= 1)).toBe(true);
  });

  it("applies tape-track gain to quantized event playback", () => {
    const renderAtGain = (gain: number) => {
      const processor = new Processor();
      loadVoice(processor);
      send(processor, { type: "set-macros", values: { shape: 0, filter: 1 } });
      send(processor, {
        type: "play-events",
        notes: [{ voiceId: "dx-piano", midi: 60, rawStartSample: 0, rawEndSample: 10 }],
        bpm: 120,
        quantize: { strength: 0, gridDivision: "1/8" },
        regionStartSample: 0,
        gain,
        envelopeMs: { attack: 0, release: 5 },
      });
      return render(processor, 2)[0][1]!;
    };

    expect(renderAtGain(0.5)).toBeCloseTo(renderAtGain(1) * 0.5);
  });
});
