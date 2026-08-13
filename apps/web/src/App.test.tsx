import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Region } from "@pocket/model";
import { DEFAULT_MACROS } from "@pocket/engine";
import { useAppStore } from "./store";

const mock = vi.hoisted(() => {
  let nextNoteId = 1;
  let nextStartError: Error | null = null;
  const instances: MockEngine[] = [];

  class MockEngine {
    start = vi.fn(async () => {
      const error = nextStartError;
      nextStartError = null;
      if (error) throw error;
    });
    dispose = vi.fn(async () => undefined);
    setActiveTrack = vi.fn();
    setBpm = vi.fn();
    setQuantize = vi.fn();
    setMetronome = vi.fn();
    setMacros = vi.fn();
    noteOn = vi.fn(() => nextNoteId++);
    noteOff = vi.fn();
    startRecording = vi.fn();
    stopRecording = vi.fn();
    playRegionWithQuantize = vi.fn(async () => undefined);
    stopPlayback = vi.fn();
    exportRegionAsWav = vi.fn(async () => new Uint8Array(44));
    regionListener: ((region: Region & { trackId: number }) => void) | null = null;
    playbackListener: ((playing: boolean) => void) | null = null;

    constructor() {
      instances.push(this);
    }

    onRegion(listener: (region: Region & { trackId: number }) => void) {
      this.regionListener = listener;
      return () => {
        this.regionListener = null;
      };
    }

    onPlaybackState(listener: (playing: boolean) => void) {
      this.playbackListener = listener;
      return () => {
        this.playbackListener = null;
      };
    }
  }

  return {
    MockEngine,
    instances,
    reset() {
      instances.length = 0;
      nextNoteId = 1;
      nextStartError = null;
    },
    failNextStart(message: string) {
      nextStartError = new Error(message);
    },
  };
});

vi.mock("@pocket/engine", async (importOriginal) => {
  const original = await importOriginal<typeof import("@pocket/engine")>();
  return {
    ...original,
    AudioEngine: mock.MockEngine,
  };
});

import { App } from "./App";

const region: Region & { trackId: number } = {
  trackId: 1,
  startSample: 0,
  endSample: 4800,
  gain: 1,
  notes: [
    {
      voiceId: "dx-piano",
      midi: 60,
      rawStartSample: 0,
      rawEndSample: 2400,
    },
  ],
};

async function boot(): Promise<InstanceType<typeof mock.MockEngine>> {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: /start pocket/i }));
  await screen.findByRole("button", { name: "i" });
  return mock.instances.at(-1)!;
}

beforeEach(() => {
  mock.reset();
  useAppStore.setState({
    key: { root: 0, mode: "minor" },
    tonicMidi: 60,
    bpm: 92,
    voiceId: "dx-piano",
    recording: false,
    lastRegion: null,
    metronome: false,
    quantize: { strength: 0.75, gridDivision: "1/8" },
    macros: { ...DEFAULT_MACROS },
  });
});

afterEach(() => cleanup());

describe("App", () => {
  it("boots and applies every persisted audio setting", async () => {
    const engine = await boot();
    expect(engine.start).toHaveBeenCalledOnce();
    expect(engine.setActiveTrack).toHaveBeenCalledWith(1);
    expect(engine.setBpm).toHaveBeenCalledWith(92);
    expect(engine.setQuantize).toHaveBeenCalledWith({ strength: 0.75, gridDivision: "1/8" });
    expect(engine.setMacros).toHaveBeenCalledWith(DEFAULT_MACROS);
  });

  it("releases only the note identities owned by a pad", async () => {
    const engine = await boot();
    const tonic = screen.getByRole("button", { name: "i" });
    const third = screen.getByRole("button", { name: "III" });
    fireEvent.keyDown(tonic, { key: " " });
    fireEvent.keyDown(third, { key: " " });
    expect(engine.noteOn).toHaveBeenCalledTimes(6);

    fireEvent.keyUp(tonic, { key: " " });
    expect(engine.noteOff.mock.calls.map(([noteId]) => noteId)).toEqual([1, 2, 3]);
    fireEvent.keyUp(third, { key: " " });
    expect(engine.noteOff.mock.calls.map(([noteId]) => noteId)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("records, receives a region, plays it, and stops playback", async () => {
    const engine = await boot();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "rec" }));
    expect(engine.startRecording).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "play" }).hasAttribute("disabled")).toBe(true);

    await user.click(screen.getByRole("button", { name: "stop" }));
    expect(engine.stopRecording).toHaveBeenCalledOnce();
    act(() => engine.regionListener?.(region));
    await waitFor(() => expect(screen.getByRole("button", { name: "play" }).hasAttribute("disabled")).toBe(false));
    await user.click(screen.getByRole("button", { name: "play" }));
    expect(engine.playRegionWithQuantize).toHaveBeenCalledWith(region);

    act(() => engine.playbackListener?.(true));
    await waitFor(() => expect(screen.getByRole("button", { name: "stop" }).hasAttribute("disabled")).toBe(false));
    await user.click(screen.getByRole("button", { name: "stop" }));
    expect(engine.stopPlayback).toHaveBeenCalled();
  });

  it("wires the visible macro knobs to the audio engine", async () => {
    const engine = await boot();
    const filter = screen.getByRole("slider", { name: "FILTER" });
    fireEvent.keyDown(filter, { key: "ArrowDown" });
    expect(engine.setMacros).toHaveBeenLastCalledWith({
      ...DEFAULT_MACROS,
      filter: 0.95,
    });
  });

  it("treats the 808 voice as drum cells instead of harmonic chords", async () => {
    useAppStore.setState({ voiceId: "808-kit" });
    const engine = await boot();
    const pad = screen.getByRole("button", { name: "III" });
    fireEvent.keyDown(pad, { key: " " });
    expect(engine.noteOn).toHaveBeenCalledOnce();
    expect(engine.noteOn).toHaveBeenCalledWith("808-kit", 62);
    fireEvent.keyUp(pad, { key: " " });
  });

  it("shows a recoverable startup error and succeeds on retry", async () => {
    mock.failNextStart("Audio device unavailable.");
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /start pocket/i }));
    expect((await screen.findByRole("alert")).textContent).toContain("Audio device unavailable.");
    expect(mock.instances[0]?.dispose).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: /retry pocket/i }));
    await screen.findByRole("button", { name: "i" });
    expect(mock.instances).toHaveLength(2);
    expect(mock.instances[1]?.start).toHaveBeenCalledOnce();
  });
});
