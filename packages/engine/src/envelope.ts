export interface EnvelopeOptions {
  sampleRate: number;
  attackSec: number;
  releaseSec: number;
}

type Stage = "idle" | "attack" | "sustain" | "release" | "done";

export class Envelope {
  private stage: Stage = "idle";
  private value = 0;
  private readonly attackStep: number;
  private readonly releaseStep: number;

  constructor(opts: EnvelopeOptions) {
    const aSamples = Math.max(1, Math.floor(opts.attackSec * opts.sampleRate));
    const rSamples = Math.max(1, Math.floor(opts.releaseSec * opts.sampleRate));
    this.attackStep = 1 / aSamples;
    this.releaseStep = 1 / rSamples;
  }

  trigger(): void {
    this.value = 0;
    this.stage = "attack";
  }

  release(): void {
    if (this.stage === "attack" || this.stage === "sustain") {
      this.stage = "release";
    }
  }

  next(): number {
    const sample = this.value;
    if (this.stage === "attack") {
      this.value += this.attackStep;
      if (this.value >= 1) {
        this.value = 1;
        this.stage = "sustain";
      }
    } else if (this.stage === "release") {
      this.value -= this.releaseStep;
      if (this.value <= 0) {
        this.value = 0;
        this.stage = "done";
      }
    }
    return sample;
  }

  isFinished(): boolean {
    return this.stage === "done";
  }
}
