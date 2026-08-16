/// <reference path="../sample.d.ts" />
import { Envelope } from "../envelope";
import { filterHzFromMacro, shapeSample } from "../macros";
import { snap, bpmToGridSamples } from "../quantize";
import type { MainToWorklet, WorkletToMain } from "./messages";

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
  noteId: number;
  voiceId: string;
  midi: number;
  rate: number;
  position: number;
  env: Envelope;
  released: boolean;
  exhausted: boolean;
  source: "live" | "playback" | "sequence";
  gain: number;
}

type ScheduledEvent =
  | {
      atSample: number;
      kind: "on";
      noteId: number;
      voiceId: string;
      midi: number;
      envMs: { attack: number; release: number };
      source: ActiveNote["source"];
      gain: number;
    }
  | { atSample: number; kind: "off"; noteId: number; source: ActiveNote["source"] };

function midiToFreqRatio(target: number, root: number): number {
  return Math.pow(2, (target - root) / 12);
}

function toInt16(sample: number): number {
  const clamped = Number.isFinite(sample) ? Math.max(-1, Math.min(1, sample)) : 0;
  return Math.round(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff);
}

function clampOutput(sample: number): number {
  return Number.isFinite(sample) ? Math.max(-1, Math.min(1, sample)) : 0;
}

class PocketProcessor extends AudioWorkletProcessor {
  // Ten minutes of 48 kHz stereo tape. Int16 storage keeps the worklet's
  // fixed allocation near 110 MiB while matching the current 16-bit export.
  private readonly ringCapacity = Math.max(1, Math.round(sampleRate * 60 * 10));
  private readonly ringL = new Int16Array(this.ringCapacity);
  private readonly ringR = new Int16Array(this.ringCapacity);
  private ringWritePos = 0;
  private totalWritten = 0;

  private recording = false;
  private recStart = 0;
  private activeTrackId = 0;
  private recordedNotes: import("@pocket/model").NoteEvent[] = [];
  private openNotes = new Map<
    number,
    { voiceId: string; midi: number; startSample: number }
  >();

  private scheduled: ScheduledEvent[] = [];
  private nextPlaybackNoteId = -1;
  private playing = false;

  private sequenceRunning = false;
  private sequenceSteps: import("./messages").SequenceNote[][] = Array.from(
    { length: 16 },
    () => []
  );
  private sequenceStep = 0;
  private nextSequenceSample = 0;
  private sequenceEnvelope = { attack: 5, release: 80 };

  private metronomeOn = false;
  private metronomeBpm = 92;
  private clickPhase = -1;
  private clickFreq = 0;
  private readonly clickDurSamples = Math.max(1, Math.floor(sampleRate * 0.01));
  private lastBeatSample = -1;
  private beatIndex = 0;

  private shape = 0.25;
  private filter = 1;
  private filterStateL = 0;
  private filterStateR = 0;

  private fxReverb = 0;
  private fxDelay = 0;
  private fxSaturation = 0;
  private fxWow = 0;
  private readonly delayL = new Float32Array(Math.max(2, Math.round(sampleRate * 2)));
  private readonly delayR = new Float32Array(Math.max(2, Math.round(sampleRate * 2)));
  private delayWrite = 0;
  private readonly reverbL = new Float32Array(Math.max(2, Math.round(sampleRate * 0.173)));
  private readonly reverbR = new Float32Array(Math.max(2, Math.round(sampleRate * 0.227)));
  private reverbWriteL = 0;
  private reverbWriteR = 0;

  private voices = new Map<string, LoadedVoice>();
  private active: ActiveNote[] = [];

  constructor() {
    super();
    this.port.onmessage = (event: MessageEvent<MainToWorklet>) => this.onMessage(event.data);
    this.send({ type: "ready" });
  }

  private send(msg: WorkletToMain): void {
    this.port.postMessage(msg);
  }

  private setPlaying(playing: boolean): void {
    if (this.playing === playing) return;
    this.playing = playing;
    this.send({ type: "playback-state", playing });
  }

  private addNote(
    noteId: number,
    voiceId: string,
    midi: number,
    envelopeMs: { attack: number; release: number },
    source: ActiveNote["source"],
    gain = 1
  ): void {
    const voice = this.voices.get(voiceId);
    if (!voice) return;
    const env = new Envelope({
      sampleRate,
      attackSec: envelopeMs.attack / 1000,
      releaseSec: envelopeMs.release / 1000,
    });
    env.trigger();
    this.active.push({
      noteId,
      voiceId,
      midi,
      rate: midiToFreqRatio(midi, voice.rootMidi),
      position: 0,
      env,
      released: false,
      exhausted: false,
      source,
      gain: Number.isFinite(gain) ? Math.max(0, Math.min(2, gain)) : 1,
    });
    if (this.recording && source !== "playback") {
      this.openNotes.set(noteId, { voiceId, midi, startSample: this.totalWritten });
    }
  }

  private releaseNote(noteId: number): void {
    const note = this.active.find((candidate) => candidate.noteId === noteId);
    if (note && !note.released) {
      note.env.release();
      note.released = true;
    }
    const open = this.openNotes.get(noteId);
    if (this.recording && open) {
      this.recordedNotes.push({
        voiceId: open.voiceId as import("@pocket/model").VoiceId,
        midi: open.midi,
        rawStartSample: open.startSample,
        rawEndSample: this.totalWritten,
      });
      this.openNotes.delete(noteId);
    }
  }

  private stopPlayback(): void {
    this.scheduled = this.scheduled.filter((event) => event.source !== "playback");
    this.active = this.active.filter((note) => note.source !== "playback");
    this.setPlaying(false);
  }

  private onMessage(msg: MainToWorklet): void {
    switch (msg.type) {
      case "load-voice":
        if (msg.samples.length > 1) {
          this.voices.set(msg.voiceId, { samples: msg.samples, rootMidi: msg.rootMidi });
        }
        return;
      case "note-on":
        this.addNote(msg.noteId, msg.voiceId, msg.midi, msg.envelopeMs, "live");
        return;
      case "note-off":
        this.releaseNote(msg.noteId);
        return;
      case "all-notes-off":
        for (const note of this.active) {
          if (note.source === "live" && !note.released) this.releaseNote(note.noteId);
        }
        return;
      case "set-active-track":
        this.activeTrackId = msg.trackId;
        return;
      case "rec-start":
        if (this.recording) return;
        this.stopPlayback();
        this.recording = true;
        this.recStart = this.totalWritten;
        this.recordedNotes = [];
        this.openNotes.clear();
        for (const note of this.active) {
          if (note.source !== "playback" && !note.released) {
            this.openNotes.set(note.noteId, {
              voiceId: note.voiceId,
              midi: note.midi,
              startSample: this.recStart,
            });
          }
        }
        this.lastBeatSample = -1;
        this.beatIndex = 0;
        return;
      case "rec-stop": {
        if (!this.recording) return;
        for (const [noteId, open] of this.openNotes) {
          this.recordedNotes.push({
            voiceId: open.voiceId as import("@pocket/model").VoiceId,
            midi: open.midi,
            rawStartSample: open.startSample,
            rawEndSample: this.totalWritten,
          });
          this.openNotes.delete(noteId);
        }
        const endSample = this.totalWritten;
        const notes = this.recordedNotes;
        this.recording = false;
        this.recordedNotes = [];
        this.clickPhase = -1;
        if (endSample <= this.recStart) {
          this.send({ type: "log", level: "warn", msg: "recording was too short to keep" });
          return;
        }
        this.send({
          type: "rec-region",
          trackId: this.activeTrackId,
          startSample: this.recStart,
          endSample,
          notes,
        });
        return;
      }
      case "fetch-region": {
        const len = msg.endSample - msg.startSample;
        const oldest = Math.max(0, this.totalWritten - this.ringCapacity);
        const valid =
          Number.isSafeInteger(msg.startSample) &&
          Number.isSafeInteger(msg.endSample) &&
          msg.startSample >= oldest &&
          msg.endSample <= this.totalWritten &&
          len > 0 &&
          len <= this.ringCapacity;
        if (!valid) {
          this.send({
            type: "region-error",
            requestId: msg.requestId,
            message: `Take is no longer available (${msg.startSample}..${msg.endSample}).`,
          });
          return;
        }
        const outL = new Float32Array(len);
        const outR = new Float32Array(len);
        for (let i = 0; i < len; i++) {
          const ringIndex = (msg.startSample + i) % this.ringCapacity;
          outL[i] = this.ringL[ringIndex]! / 0x8000;
          outR[i] = this.ringR[ringIndex]! / 0x8000;
        }
        this.port.postMessage(
          { type: "region-data", requestId: msg.requestId, left: outL, right: outR },
          [outL.buffer, outR.buffer]
        );
        return;
      }
      case "play-events": {
        if (this.recording) {
          this.send({ type: "log", level: "warn", msg: "playback ignored while recording" });
          return;
        }
        this.stopPlayback();
        const gridSamples = bpmToGridSamples(msg.bpm, msg.quantize.gridDivision, sampleRate);
        const fireAtBase = this.totalWritten;
        for (const note of msg.notes) {
          const relativeStart = note.rawStartSample - msg.regionStartSample;
          const quantizedStart = snap(relativeStart, gridSamples, msg.quantize.strength);
          const duration = Math.max(1, note.rawEndSample - note.rawStartSample);
          const quantizedEnd =
            msg.quantize.strength >= 1
              ? snap(relativeStart + duration, gridSamples, 1)
              : quantizedStart + duration;
          const safeEnd = Math.max(quantizedStart + 1, quantizedEnd);
          const noteId = this.nextPlaybackNoteId--;
          this.scheduled.push({
            atSample: fireAtBase + Math.max(0, Math.round(quantizedStart)),
            kind: "on",
            noteId,
            voiceId: note.voiceId,
            midi: note.midi,
            envMs: msg.envelopeMs,
            source: "playback",
            gain: msg.gain ?? 1,
          });
          this.scheduled.push({
            atSample: fireAtBase + Math.max(1, Math.round(safeEnd)),
            kind: "off",
            noteId,
            source: "playback",
          });
        }
        this.scheduled.sort((a, b) => a.atSample - b.atSample);
        this.setPlaying(this.scheduled.length > 0);
        return;
      }
      case "stop-playback":
        this.stopPlayback();
        return;
      case "set-metronome":
        this.metronomeOn = msg.on;
        if (!msg.on) {
          this.clickPhase = -1;
          this.beatIndex = 0;
          this.lastBeatSample = -1;
        }
        return;
      case "set-bpm":
        this.metronomeBpm = Number.isFinite(msg.bpm)
          ? Math.max(40, Math.min(240, msg.bpm))
          : 92;
        return;
      case "set-macros":
        this.shape = Number.isFinite(msg.values.shape)
          ? Math.max(0, Math.min(1, msg.values.shape))
          : 0;
        this.filter = Number.isFinite(msg.values.filter)
          ? Math.max(0, Math.min(1, msg.values.filter))
          : 1;
        return;
      case "set-fx":
        this.fxReverb = Number.isFinite(msg.values.reverb)
          ? Math.max(0, Math.min(1, msg.values.reverb))
          : 0;
        this.fxDelay = Number.isFinite(msg.values.delay)
          ? Math.max(0, Math.min(1, msg.values.delay))
          : 0;
        this.fxSaturation = Number.isFinite(msg.values.saturation)
          ? Math.max(0, Math.min(1, msg.values.saturation))
          : 0;
        this.fxWow = Number.isFinite(msg.values.wow)
          ? Math.max(0, Math.min(1, msg.values.wow))
          : 0;
        return;
      case "set-sequence": {
        this.sequenceSteps = Array.from({ length: 16 }, (_, index) =>
          (msg.steps[index] ?? []).slice(0, 8)
        );
        this.metronomeBpm = Number.isFinite(msg.bpm)
          ? Math.max(40, Math.min(240, msg.bpm))
          : this.metronomeBpm;
        this.sequenceEnvelope = msg.envelopeMs;
        if (msg.running && !this.sequenceRunning) {
          this.sequenceStep = 0;
          this.nextSequenceSample = this.totalWritten;
        }
        this.sequenceRunning = msg.running;
        if (!msg.running) {
          this.scheduled = this.scheduled.filter((event) => event.source !== "sequence");
          for (const note of this.active) {
            if (note.source === "sequence" && !note.released) this.releaseNote(note.noteId);
          }
          this.send({ type: "sequence-step", step: -1 });
        }
        return;
      }
      default:
        return;
    }
  }

  private fireScheduled(event: ScheduledEvent): void {
    if (event.kind === "on") {
      this.addNote(event.noteId, event.voiceId, event.midi, event.envMs, event.source, event.gain);
    } else {
      this.releaseNote(event.noteId);
    }
  }

  override process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const out = outputs[0];
    const left = out?.[0];
    if (!left) return true;
    const right = out[1] ?? left;
    const numFrames = left.length;
    left.fill(0);
    if (right !== left) right.fill(0);

    const cutoff = Math.min(sampleRate * 0.45, filterHzFromMacro(this.filter));
    const filterAlpha = 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
    const samplesPerBeat = Math.max(1, Math.round((60 / this.metronomeBpm) * sampleRate));
    const sequenceStepSamples = Math.max(1, Math.round(samplesPerBeat / 4));

    for (let frame = 0; frame < numFrames; frame++) {
      const absoluteSample = this.totalWritten;
      if (this.sequenceRunning && absoluteSample >= this.nextSequenceSample) {
        const notes = this.sequenceSteps[this.sequenceStep] ?? [];
        this.send({ type: "sequence-step", step: this.sequenceStep });
        for (const note of notes) {
          const noteId = this.nextPlaybackNoteId--;
          this.addNote(
            noteId,
            note.voiceId,
            note.midi,
            this.sequenceEnvelope,
            "sequence",
            1
          );
          this.scheduled.push({
            atSample: absoluteSample + Math.max(1, Math.round(sequenceStepSamples * 0.72)),
            kind: "off",
            noteId,
            source: "sequence",
          });
        }
        this.scheduled.sort((first, second) => first.atSample - second.atSample);
        this.sequenceStep = (this.sequenceStep + 1) % 16;
        this.nextSequenceSample += sequenceStepSamples;
      }
      while (this.scheduled.length > 0 && this.scheduled[0]!.atSample <= absoluteSample) {
        this.fireScheduled(this.scheduled.shift()!);
      }

      let sampleL = 0;
      let sampleR = 0;
      for (const note of this.active) {
        const voice = this.voices.get(note.voiceId);
        if (!voice) continue;
        if (note.exhausted) {
          note.env.next();
          continue;
        }
        const index0 = Math.floor(note.position);
        const index1 = index0 + 1;
        if (index1 >= voice.samples.length) {
          if (!note.released) {
            note.env.release();
            note.released = true;
          }
          note.exhausted = true;
          note.env.next();
          continue;
        }
        const fraction = note.position - index0;
        const sample =
          voice.samples[index0]! * (1 - fraction) + voice.samples[index1]! * fraction;
        const value = sample * note.env.next() * note.gain;
        sampleL += value;
        sampleR += value;
        const time = absoluteSample / sampleRate;
        const wow =
          1 +
          this.fxWow *
            (0.008 * Math.sin(2 * Math.PI * 0.7 * time) +
              0.0025 * Math.sin(2 * Math.PI * 6.1 * time));
        note.position += note.rate * wow;
      }

      sampleL = shapeSample(sampleL, this.shape);
      sampleR = shapeSample(sampleR, this.shape);
      this.filterStateL += filterAlpha * (sampleL - this.filterStateL);
      this.filterStateR += filterAlpha * (sampleR - this.filterStateR);
      sampleL = this.filterStateL;
      sampleR = this.filterStateR;

      if (this.fxSaturation > 0) {
        const drive = 1 + this.fxSaturation * 12;
        const normalization = Math.tanh(drive);
        sampleL = Math.tanh(sampleL * drive) / normalization;
        sampleR = Math.tanh(sampleR * drive) / normalization;
      }

      if (this.fxDelay > 0) {
        const delaySamples = Math.max(
          1,
          Math.min(this.delayL.length - 1, Math.round(samplesPerBeat * 0.75))
        );
        const read = (this.delayWrite - delaySamples + this.delayL.length) % this.delayL.length;
        const delayedL = this.delayL[read]!;
        const delayedR = this.delayR[read]!;
        this.delayL[this.delayWrite] = sampleL + delayedR * (0.2 + this.fxDelay * 0.45);
        this.delayR[this.delayWrite] = sampleR + delayedL * (0.2 + this.fxDelay * 0.45);
        sampleL += delayedL * this.fxDelay * 0.65;
        sampleR += delayedR * this.fxDelay * 0.65;
        this.delayWrite = (this.delayWrite + 1) % this.delayL.length;
      }

      if (this.fxReverb > 0) {
        const wetL = this.reverbL[this.reverbWriteL]!;
        const wetR = this.reverbR[this.reverbWriteR]!;
        const feedback = 0.45 + this.fxReverb * 0.42;
        this.reverbL[this.reverbWriteL] = sampleL + wetR * feedback;
        this.reverbR[this.reverbWriteR] = sampleR + wetL * feedback;
        sampleL += wetL * this.fxReverb * 0.55;
        sampleR += wetR * this.fxReverb * 0.55;
        this.reverbWriteL = (this.reverbWriteL + 1) % this.reverbL.length;
        this.reverbWriteR = (this.reverbWriteR + 1) % this.reverbR.length;
      }

      // Tape captures the instrument bus, not the monitoring metronome.
      this.ringL[this.ringWritePos] = toInt16(sampleL);
      this.ringR[this.ringWritePos] = toInt16(sampleR);

      if (this.metronomeOn && this.recording) {
        if (this.lastBeatSample < 0) {
          this.lastBeatSample = this.recStart - samplesPerBeat;
          this.beatIndex = 0;
        }
        if (absoluteSample >= this.lastBeatSample + samplesPerBeat) {
          this.clickPhase = 0;
          this.clickFreq = this.beatIndex % 4 === 0 ? 1200 : 600;
          this.lastBeatSample += samplesPerBeat;
          this.beatIndex++;
        }
      }

      if (this.clickPhase >= 0) {
        const clickEnvelope = 1 - this.clickPhase / this.clickDurSamples;
        const click =
          0.25 *
          clickEnvelope *
          Math.sin(2 * Math.PI * this.clickFreq * (this.clickPhase / sampleRate));
        sampleL += click;
        sampleR += click;
        this.clickPhase++;
        if (this.clickPhase >= this.clickDurSamples) this.clickPhase = -1;
      }

      left[frame] = clampOutput(sampleL);
      right[frame] = clampOutput(sampleR);
      this.ringWritePos = (this.ringWritePos + 1) % this.ringCapacity;
      this.totalWritten++;
    }

    this.active = this.active.filter((note) => !note.env.isFinished());
    if (
      this.playing &&
      this.scheduled.length === 0 &&
      !this.active.some((note) => note.source === "playback")
    ) {
      this.setPlaying(false);
    }
    return true;
  }
}

registerProcessor("pocket-processor", PocketProcessor);
