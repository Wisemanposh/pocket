import type { Voice, Region } from "@pocket/model";
import { VOICES } from "./voices";
import type { MainToWorklet, WorkletToMain } from "./worklet/messages";

// Vite-specific: import the worklet entry as a URL.
import workletUrl from "./worklet/processor.ts?worker&url";

export interface RegionListener {
  (region: Region & { trackId: number }): void;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private regionListeners = new Set<RegionListener>();

  private nextRequestId = 1;
  private pendingFetches = new Map<
    number,
    (data: { left: Float32Array; right: Float32Array }) => void
  >();

  // Public read-only view of current envelope settings — wires to knobs in v0.3.
  attackMs = 5;
  releaseMs = 200;

  // v0.2 — current settings used for playback + metronome scheduling
  quantize: import("@pocket/model").QuantizeSettings = { strength: 0.75, gridDivision: "1/8" };
  bpm = 92;

  async start(): Promise<void> {
    if (this.ctx) return;
    this.ctx = new AudioContext({ sampleRate: 48000, latencyHint: "interactive" });
    await this.ctx.audioWorklet.addModule(workletUrl);
    this.node = new AudioWorkletNode(this.ctx, "pocket-processor", {
      outputChannelCount: [2],
    });
    this.node.connect(this.ctx.destination);
    this.node.port.onmessage = (e: MessageEvent<WorkletToMain>) => this.handle(e.data);

    for (const v of VOICES) {
      await this.loadVoice(v);
    }
    this.send({ type: "set-bpm", bpm: this.bpm });
  }

  private async loadVoice(voice: Voice): Promise<void> {
    const res = await fetch(voice.sampleUrl);
    const buf = await res.arrayBuffer();
    const decoded = await this.ctx!.decodeAudioData(buf);
    const samples = decoded.getChannelData(0).slice();
    this.send({
      type: "load-voice",
      voiceId: voice.id,
      rootMidi: voice.rootMidi,
      samples,
    });
  }

  noteOn(voiceId: string, midi: number): void {
    this.send({
      type: "note-on",
      voiceId,
      midi,
      envelopeMs: { attack: this.attackMs, release: this.releaseMs },
    });
  }

  noteOff(voiceId: string, midi: number): void {
    this.send({ type: "note-off", voiceId, midi });
  }

  setQuantize(q: import("@pocket/model").QuantizeSettings): void {
    this.quantize = q;
  }

  setBpm(bpm: number): void {
    this.bpm = bpm;
    this.send({ type: "set-bpm", bpm });
  }

  setMetronome(on: boolean): void {
    this.send({ type: "set-metronome", on });
  }

  async playRegionWithQuantize(region: import("@pocket/model").Region): Promise<void> {
    if (!this.ctx) throw new Error("AudioEngine not started");
    this.send({
      type: "play-events",
      notes: region.notes,
      bpm: this.bpm,
      quantize: this.quantize,
      regionStartSample: region.startSample,
      envelopeMs: { attack: this.attackMs, release: this.releaseMs },
    });
  }

  setActiveTrack(trackId: number): void {
    this.send({ type: "set-active-track", trackId });
  }

  startRecording(): void {
    this.send({ type: "rec-start" });
  }

  stopRecording(): void {
    this.send({ type: "rec-stop" });
  }

  onRegion(fn: RegionListener): () => void {
    this.regionListeners.add(fn);
    return () => this.regionListeners.delete(fn);
  }

  async fetchRegion(region: Region): Promise<{ left: Float32Array; right: Float32Array }> {
    const requestId = this.nextRequestId++;
    return new Promise((resolve) => {
      this.pendingFetches.set(requestId, resolve);
      this.send({
        type: "fetch-region",
        requestId,
        startSample: region.startSample,
        endSample: region.endSample,
      });
    });
  }

  async playRegion(region: Region): Promise<void> {
    if (!this.ctx) throw new Error("AudioEngine not started");
    const { left, right } = await this.fetchRegion(region);
    const sampleRate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(2, left.length, sampleRate);
    buffer.copyToChannel(left, 0);
    buffer.copyToChannel(right, 1);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.ctx.destination);
    src.start();
  }

  async exportRegionAsWav(region: Region): Promise<Uint8Array> {
    if (!this.ctx) throw new Error("AudioEngine not started");
    const { left, right } = await this.fetchRegion(region);
    const { encodeWav } = await import("./wav");
    return encodeWav({
      sampleRate: this.ctx.sampleRate,
      channels: [left, right],
      bitDepth: 16,
    });
  }

  private send(msg: MainToWorklet): void {
    if (!this.node) throw new Error("AudioEngine not started");
    this.node.port.postMessage(msg);
  }

  private handle(msg: WorkletToMain): void {
    switch (msg.type) {
      case "ready":
        return;
      case "log":

        console[msg.level === "error" ? "error" : "log"](`[worklet] ${msg.msg}`);
        return;
      case "rec-region":
        this.regionListeners.forEach((fn) =>
          fn({
            trackId: msg.trackId,
            startSample: msg.startSample,
            endSample: msg.endSample,
            gain: 1,
            notes: msg.notes,
          })
        );
        return;
      case "region-data": {
        const resolver = this.pendingFetches.get(msg.requestId);
        if (resolver) {
          this.pendingFetches.delete(msg.requestId);
          resolver({ left: msg.left, right: msg.right });
        }
        return;
      }
    }
  }
}
