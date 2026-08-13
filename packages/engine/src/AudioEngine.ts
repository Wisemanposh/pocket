import type { Voice, VoiceId, Region, QuantizeSettings } from "@pocket/model";
import { VOICES } from "./voices";
import {
  DEFAULT_MACROS,
  attackMsFromMacro,
  clampMacro,
  releaseMsFromMacro,
  type MacroValues,
} from "./macros";
import type { MainToWorklet, WorkletToMain } from "./worklet/messages";

// Vite-specific: import the worklet entry as a URL.
import workletUrl from "./worklet/processor.ts?worker&url";

export interface RegionListener {
  (region: Region & { trackId: number }): void;
}

export interface PlaybackListener {
  (playing: boolean): void;
}

interface PendingFetch {
  resolve: (data: { left: Float32Array; right: Float32Array }) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private regionListeners = new Set<RegionListener>();
  private playbackListeners = new Set<PlaybackListener>();
  private rawPlaybackSources = new Set<AudioBufferSourceNode>();
  private nextNoteId = 1;

  private nextRequestId = 1;
  private pendingFetches = new Map<number, PendingFetch>();

  // Public read-only view of current envelope settings — wires to knobs in v0.3.
  attackMs = attackMsFromMacro(DEFAULT_MACROS.attack);
  releaseMs = releaseMsFromMacro(DEFAULT_MACROS.release);
  macros: MacroValues = { ...DEFAULT_MACROS };

  // v0.2 — current settings used for playback + metronome scheduling
  quantize: QuantizeSettings = { strength: 0.75, gridDivision: "1/8" };
  bpm = 92;

  async start(): Promise<void> {
    if (this.ctx) return;
    if (typeof AudioContext === "undefined" || typeof AudioWorkletNode === "undefined") {
      throw new Error("This browser does not support AudioWorklet audio.");
    }
    const ctx = new AudioContext({ sampleRate: 48000, latencyHint: "interactive" });
    this.ctx = ctx;
    try {
      await ctx.audioWorklet.addModule(workletUrl);
      this.node = new AudioWorkletNode(ctx, "pocket-processor", {
        outputChannelCount: [2],
      });
      this.node.connect(ctx.destination);
      this.node.port.onmessage = (e: MessageEvent<WorkletToMain>) => this.handle(e.data);

      for (const voice of VOICES) await this.loadVoice(voice);
      this.send({ type: "set-bpm", bpm: this.bpm });
      this.send({
        type: "set-macros",
        values: { shape: this.macros.shape, filter: this.macros.filter },
      });
      if (ctx.state !== "running") await ctx.resume();
    } catch (error) {
      this.node?.disconnect();
      this.node = null;
      this.ctx = null;
      await ctx.close().catch(() => undefined);
      throw error;
    }
  }

  private async loadVoice(voice: Voice): Promise<void> {
    const res = await fetch(voice.sampleUrl);
    if (!res.ok) throw new Error(`Could not load ${voice.displayName} (${res.status}).`);
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

  noteOn(voiceId: VoiceId, midi: number): number {
    const noteId = this.nextNoteId++;
    if (this.ctx?.state === "suspended") void this.ctx.resume();
    this.send({
      type: "note-on",
      noteId,
      voiceId,
      midi,
      envelopeMs: { attack: this.attackMs, release: this.releaseMs },
    });
    return noteId;
  }

  noteOff(noteId: number): void {
    this.send({ type: "note-off", noteId });
  }

  allNotesOff(): void {
    this.send({ type: "all-notes-off" });
  }

  setQuantize(q: QuantizeSettings): void {
    this.quantize = {
      strength: clampMacro(q.strength),
      gridDivision: q.gridDivision,
    };
  }

  setBpm(bpm: number): void {
    this.bpm = Math.max(40, Math.min(240, Number.isFinite(bpm) ? bpm : 92));
    this.send({ type: "set-bpm", bpm: this.bpm });
  }

  setMetronome(on: boolean): void {
    this.send({ type: "set-metronome", on });
  }

  setMacros(values: MacroValues): void {
    this.macros = {
      shape: clampMacro(values.shape),
      filter: clampMacro(values.filter),
      attack: clampMacro(values.attack),
      release: clampMacro(values.release),
    };
    this.attackMs = attackMsFromMacro(this.macros.attack);
    this.releaseMs = releaseMsFromMacro(this.macros.release);
    this.send({
      type: "set-macros",
      values: { shape: this.macros.shape, filter: this.macros.filter },
    });
  }

  async playRegionWithQuantize(region: import("@pocket/model").Region): Promise<void> {
    if (!this.ctx) throw new Error("AudioEngine not started");
    if (region.notes.length === 0) {
      await this.playRegion(region);
      return;
    }
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
    this.stopPlayback();
    this.send({ type: "rec-start" });
  }

  stopRecording(): void {
    this.send({ type: "rec-stop" });
  }

  onRegion(fn: RegionListener): () => void {
    this.regionListeners.add(fn);
    return () => this.regionListeners.delete(fn);
  }

  onPlaybackState(fn: PlaybackListener): () => void {
    this.playbackListeners.add(fn);
    return () => this.playbackListeners.delete(fn);
  }

  async fetchRegion(region: Region): Promise<{ left: Float32Array; right: Float32Array }> {
    const requestId = this.nextRequestId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingFetches.delete(requestId);
        reject(new Error("Timed out while reading the recorded take."));
      }, 10_000);
      this.pendingFetches.set(requestId, { resolve, reject, timeout });
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
    this.stopPlayback();
    const { left, right } = await this.fetchRegion(region);
    const sampleRate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(2, left.length, sampleRate);
    buffer.copyToChannel(left, 0);
    buffer.copyToChannel(right, 1);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.ctx.destination);
    this.rawPlaybackSources.add(src);
    src.onended = () => {
      this.rawPlaybackSources.delete(src);
      if (this.rawPlaybackSources.size === 0) this.notifyPlayback(false);
    };
    this.notifyPlayback(true);
    src.start();
  }

  stopPlayback(): void {
    if (this.node) this.send({ type: "stop-playback" });
    for (const source of this.rawPlaybackSources) {
      try {
        source.stop();
      } catch {
        // A source that ended between the state check and STOP needs no action.
      }
    }
    this.rawPlaybackSources.clear();
    this.notifyPlayback(false);
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

  async dispose(): Promise<void> {
    this.stopPlayback();
    for (const pending of this.pendingFetches.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Audio engine closed before the take was read."));
    }
    this.pendingFetches.clear();
    this.playbackListeners.clear();
    this.regionListeners.clear();
    this.node?.disconnect();
    this.node = null;
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx && ctx.state !== "closed") await ctx.close();
  }

  private notifyPlayback(playing: boolean): void {
    this.playbackListeners.forEach((fn) => fn(playing));
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
        const pending = this.pendingFetches.get(msg.requestId);
        if (pending) {
          this.pendingFetches.delete(msg.requestId);
          clearTimeout(pending.timeout);
          pending.resolve({ left: msg.left, right: msg.right });
        }
        return;
      }
      case "region-error": {
        const pending = this.pendingFetches.get(msg.requestId);
        if (pending) {
          this.pendingFetches.delete(msg.requestId);
          clearTimeout(pending.timeout);
          pending.reject(new Error(msg.message));
        }
        return;
      }
      case "playback-state":
        this.notifyPlayback(msg.playing);
        return;
    }
  }
}
