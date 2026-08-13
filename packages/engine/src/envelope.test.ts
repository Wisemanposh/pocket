import { describe, it, expect } from "vitest";
import { Envelope } from "./envelope";

const SR = 48000;

describe("Envelope", () => {
  it("starts at 0 and rises during attack", () => {
    const env = new Envelope({ sampleRate: SR, attackSec: 0.01, releaseSec: 0.1 });
    env.trigger();
    expect(env.next()).toBeCloseTo(0, 6);
    // After half the attack window (~240 samples), should be ~0.5
    for (let i = 0; i < SR * 0.005 - 1; i++) env.next();
    expect(env.next()).toBeGreaterThan(0.4);
    expect(env.next()).toBeLessThan(0.6);
  });

  it("reaches 1.0 by end of attack", () => {
    const env = new Envelope({ sampleRate: SR, attackSec: 0.001, releaseSec: 0.1 });
    env.trigger();
    for (let i = 0; i < SR * 0.001; i++) env.next();
    expect(env.next()).toBeCloseTo(1, 3);
  });

  it("decays toward 0 after release()", () => {
    const env = new Envelope({ sampleRate: SR, attackSec: 0.001, releaseSec: 0.01 });
    env.trigger();
    for (let i = 0; i < SR * 0.002; i++) env.next();
    env.release();
    for (let i = 0; i < SR * 0.01; i++) env.next();
    expect(env.next()).toBeLessThan(0.05);
  });

  it("isFinished returns true after release decays", () => {
    const env = new Envelope({ sampleRate: SR, attackSec: 0.001, releaseSec: 0.005 });
    env.trigger();
    for (let i = 0; i < SR * 0.002; i++) env.next();
    env.release();
    for (let i = 0; i < SR * 0.02; i++) env.next();
    expect(env.isFinished()).toBe(true);
  });
});
