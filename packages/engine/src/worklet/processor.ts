/// <reference path="../sample.d.ts" />
import { Envelope } from "../envelope";
import { snap, bpmToGridSamples } from "../quantize";
import type { MainToWorklet, WorkletToMain } from "./messages";

// Globally declared by the AudioWorklet runtime
declare const sampleRate: number;
declare class AudioWorkletProcessor {
  port: MessagePort;
  constructor();
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean;
}
declare function registerProcessor(
  name: string,
  ctor: new () => AudioWorkletProcessor
): void;

interface LoadedVoice {
  samples: Float32Array;
  rootMidi: number;
}

interface ActiveNote {
  voiceId: string;
  midi: number;
  rate: number;
  position: number;
  env: Envelope;
  released: boolean;
}

function midiToFreqRatio(target: number, root: number): number {
  return Math.pow(2, (target - root) / 12);
}

class PocketProcessor extends AudioWorkletProcessor {
  // Always-on tape ring buffer — 10 minutes of 48k stereo float32.
  private readonly ringCapacity = 48000 * 60 * 10;
  private readonly ringL: Float32Array;
  private readonly ringR: Float32Array;
  private ringWritePos = 0;
  private totalWritten = 0;

  private recording = false;
  private recStart = 0;
  private activeTrackId = 0;

  // v0.2: log every note-on/note-off during recording with absolute sample timestamps.
  // openNotes is a multimap (FIFO queue per voiceId/midi key) so simultaneous holds of
  // the same MIDI note — e.g., shared notes between chord-pad triads pressed before the
  // first is released — don't clobber each other's start time.
  private recordedNotes: import("@pocket/model").NoteEvent[] = [];
  private openNotes = new Map<string, { voiceId: string; midi: number; startSample: number }[]>();

  // v0.2: pending scheduled note-on/off triggers for play-events.
  private scheduled: Array<
    | { atSample: number; kind: "on"; voiceId: string; midi: number; envMs: { attack: number; release: number } }
    | { atSample: number; kind: "off"; voiceId: string; midi: number }
  > = [];

  // v0.2: metronome — plays only while recording when enabled.
  private metronomeOn = false;
  private metronomeBpm = 92;
  private clickPhase = 0;          // sample counter within an active click (0 = inactive)
  private clickFreq = 0;
  private clickDurSamples = 0;
  private lastBeatSample = -1;
  private beatIndex = 0;

  private voices = new Map<string, LoadedVoice>();
  private active: ActiveNote[] = [];

  constructor() {
    super();
    this.ringL = new Float32Array(this.ringCapacity);
    this.ringR = new Float32Array(this.ringCapacity);
    this.port.onmessage = (e: MessageEvent<MainToWorklet>) => this.onMessage(e.data);
    this.send({ type: "ready" });
  }

  private send(msg: WorkletToMain): void {
    this.port.postMessage(msg);
  }

  private onMessage(msg: MainToWorklet): void {
    switch (msg.type) {
      case "load-voice":
        this.voices.set(msg.voiceId, { samples: msg.samples, rootMidi: msg.rootMidi });
        return;
      case "note-on": {
        const voice = this.voices.get(msg.voiceId);
        if (!voice) return;
        const env = new Envelope({
          sampleRate,
          attackSec: msg.envelopeMs.attack / 1000,
          releaseSec: msg.envelopeMs.release / 1000,
        });
        env.trigger();
        this.active.push({
          voiceId: msg.voiceId,
          midi: msg.midi,
          rate: midiToFreqRatio(msg.midi, voice.rootMidi),
          position: 0,
          env,
          released: false,
        });
        if (this.recording) {
          const key = `${msg.voiceId}/${msg.midi}`;
          const queue = this.openNotes.get(key) ?? [];
          queue.push({
            voiceId: msg.voiceId,
            midi: msg.midi,
            startSample: this.totalWritten,
          });
          this.openNotes.set(key, queue);
        }
        return;
      }
      case "note-off": {
        for (const n of this.active) {
          if (n.voiceId === msg.voiceId && n.midi === msg.midi && !n.released) {
            n.env.release();
            n.released = true;
          }
        }
        if (this.recording) {
          const key = `${msg.voiceId}/${msg.midi}`;
          const queue = this.openNotes.get(key);
          if (queue && queue.length > 0) {
            const open = queue.shift()!;   // FIFO: close oldest
            this.recordedNotes.push({
              voiceId: open.voiceId as import("@pocket/model").VoiceId,
              midi: open.midi,
              rawStartSample: open.startSample,
              rawEndSample: this.totalWritten,
            });
            if (queue.length === 0) this.openNotes.delete(key);
          }
        }
        return;
      }
      case "set-active-track":
        this.activeTrackId = msg.trackId;
        return;
      case "rec-start":
        this.recording = true;
        this.recStart = this.totalWritten;
        this.recordedNotes = [];
        this.openNotes.clear();
        return;
      case "rec-stop": {
        for (const queue of this.openNotes.values()) {
          for (const open of queue) {
            this.recordedNotes.push({
              voiceId: open.voiceId as import("@pocket/model").VoiceId,
              midi: open.midi,
              rawStartSample: open.startSample,
              rawEndSample: this.totalWritten,
            });
          }
        }
        this.openNotes.clear();
        const endSample = this.totalWritten;
        const startSample = this.recStart;
        const notes = this.recordedNotes;
        this.recording = false;
        this.recordedNotes = [];
        this.send({
          type: "rec-region",
          trackId: this.activeTrackId,
          startSample,
          endSample,
          notes,
        });
        return;
      }
      case "fetch-region": {
        const len = msg.endSample - msg.startSample;
        const oldest = Math.max(0, this.totalWritten - this.ringCapacity);
        if (msg.startSample < oldest || msg.endSample > this.totalWritten || len <= 0) {
          this.send({
            type: "log",
            level: "warn",
            msg: `region out of range: ${msg.startSample}..${msg.endSample}`,
          });
          return;
        }
        const outL = new Float32Array(len);
        const outR = new Float32Array(len);
        for (let i = 0; i < len; i++) {
          const ringIdx = (msg.startSample + i) % this.ringCapacity;
          outL[i] = this.ringL[ringIdx]!;
          outR[i] = this.ringR[ringIdx]!;
        }
        this.port.postMessage(
          { type: "region-data", requestId: msg.requestId, left: outL, right: outR },
          [outL.buffer, outR.buffer]
        );
        return;
      }
      case "play-events": {
        const gridSamples = bpmToGridSamples(msg.bpm, msg.quantize.gridDivision, sampleRate);
        const fireAtBase = this.totalWritten;
        for (const note of msg.notes) {
          const relativeStart = note.rawStartSample - msg.regionStartSample;
          const quantizedStart = snap(relativeStart, gridSamples, msg.quantize.strength);
          const duration = note.rawEndSample - note.rawStartSample;
          const quantizedEnd = msg.quantize.strength >= 1
            ? snap(relativeStart + duration, gridSamples, 1)
            : quantizedStart + duration;
          const safeEnd = Math.max(quantizedStart + 1, quantizedEnd);
          this.scheduled.push({
            atSample: fireAtBase + Math.max(0, Math.round(quantizedStart)),
            kind: "on",
            voiceId: note.voiceId,
            midi: note.midi,
            envMs: msg.envelopeMs,
          });
          this.scheduled.push({
            atSample: fireAtBase + Math.max(0, Math.round(safeEnd)),
            kind: "off",
            voiceId: note.voiceId,
            midi: note.midi,
          });
        }
        this.scheduled.sort((a, b) => a.atSample - b.atSample);
        return;
      }
      case "set-metronome":
        this.metronomeOn = msg.on;
        if (!msg.on) {
          this.clickPhase = 0;
          this.beatIndex = 0;
          this.lastBeatSample = -1;
        }
        return;
      case "set-bpm":
        this.metronomeBpm = msg.bpm;
        return;
      default:
        return;
    }
  }

  override process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const out = outputs[0]!;
    const left = out[0]!;
    const right = out[1] ?? left;
    const numFrames = left.length;

    left.fill(0);
    if (right !== left) right.fill(0);

    // v0.2: schedule metronome click trigger if a beat boundary falls inside this block.
    if (this.metronomeOn && this.recording) {
      const samplesPerBeat = Math.round((60 / this.metronomeBpm) * sampleRate);
      if (this.lastBeatSample < 0) {
        this.lastBeatSample = this.recStart - samplesPerBeat;
        this.beatIndex = 0;
      }
      let nextBeat = this.lastBeatSample + samplesPerBeat;
      while (nextBeat < this.totalWritten + numFrames) {
        const downbeat = this.beatIndex % 4 === 0;
        this.clickPhase = 1;
        this.clickFreq = downbeat ? 1200 : 600;
        this.clickDurSamples = Math.floor(sampleRate * 0.01);
        this.lastBeatSample = nextBeat;
        this.beatIndex++;
        nextBeat += samplesPerBeat;
      }
    }

    // v0.2: drain scheduled note-on/off events that should fire this block.
    const blockEnd = this.totalWritten + numFrames;
    while (this.scheduled.length > 0 && this.scheduled[0]!.atSample < blockEnd) {
      const ev = this.scheduled.shift()!;
      if (ev.kind === "on") {
        const voice = this.voices.get(ev.voiceId);
        if (voice) {
          const env = new Envelope({
            sampleRate,
            attackSec: ev.envMs.attack / 1000,
            releaseSec: ev.envMs.release / 1000,
          });
          env.trigger();
          this.active.push({
            voiceId: ev.voiceId,
            midi: ev.midi,
            rate: midiToFreqRatio(ev.midi, voice.rootMidi),
            position: 0,
            env,
            released: false,
          });
        }
      } else {
        for (const n of this.active) {
          if (n.voiceId === ev.voiceId && n.midi === ev.midi && !n.released) {
            n.env.release();
            n.released = true;
          }
        }
      }
    }

    for (const n of this.active) {
      const voice = this.voices.get(n.voiceId);
      if (!voice) continue;
      for (let i = 0; i < numFrames; i++) {
        const idx = n.position;
        const i0 = Math.floor(idx);
        const i1 = i0 + 1;
        if (i1 >= voice.samples.length) {
          n.env.release();
          n.released = true;
          break;
        }
        const frac = idx - i0;
        const s = voice.samples[i0]! * (1 - frac) + voice.samples[i1]! * frac;
        const amp = n.env.next();
        const v = s * amp;
        left[i]! += v;
        right[i]! += v;
        n.position += n.rate;
      }
    }

    this.active = this.active.filter((n) => !n.env.isFinished());

    // v0.2: render any active metronome click into the bus.
    if (this.clickPhase > 0) {
      for (let i = 0; i < numFrames; i++) {
        if (this.clickPhase >= this.clickDurSamples) {
          this.clickPhase = 0;
          break;
        }
        const env = 1 - this.clickPhase / this.clickDurSamples;
        const sample = 0.25 * env * Math.sin(2 * Math.PI * this.clickFreq * (this.clickPhase / sampleRate));
        left[i]! += sample;
        if (right !== left) right[i]! += sample;
        this.clickPhase++;
      }
    }

    // Always-on capture of whatever the bus produced this block.
    for (let i = 0; i < numFrames; i++) {
      this.ringL[this.ringWritePos] = left[i]!;
      this.ringR[this.ringWritePos] = right[i]!;
      this.ringWritePos = (this.ringWritePos + 1) % this.ringCapacity;
      this.totalWritten++;
    }

    return true;
  }
}

registerProcessor("pocket-processor", PocketProcessor);
