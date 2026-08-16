import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TapeMode, type TapeTrackView } from "./TapeMode";

const tracks: TapeTrackView[] = [
  { id: 1, name: "CHORD", durationSeconds: 2.5, volume: 1, muted: false, solo: false },
  { id: 2, name: "BASS", durationSeconds: null, volume: 1, muted: false, solo: false },
];

describe("TapeMode", () => {
  it("renders regions, empty tracks, and the armed track", () => {
    render(
      <TapeMode
        tracks={tracks}
        activeTrackId={1}
        onArm={() => {}}
        onMute={() => {}}
        onSolo={() => {}}
        onVolume={() => {}}
        onClear={() => {}}
      />
    );
    expect(screen.getByLabelText("CHORD 2.5s")).toBeDefined();
    expect(screen.getByLabelText("BASS EMPTY")).toBeDefined();
    expect(screen.getByRole("button", { name: "arm CHORD" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("dispatches arm, mute, volume, and clear operations", () => {
    const onArm = vi.fn();
    const onMute = vi.fn();
    const onVolume = vi.fn();
    const onClear = vi.fn();
    render(
      <TapeMode
        tracks={tracks}
        activeTrackId={1}
        onArm={onArm}
        onMute={onMute}
        onSolo={() => {}}
        onVolume={onVolume}
        onClear={onClear}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "arm BASS" }));
    fireEvent.click(screen.getByRole("button", { name: "mute CHORD" }));
    fireEvent.change(screen.getByRole("slider", { name: "volume CHORD" }), { target: { value: "0.5" } });
    fireEvent.click(screen.getByRole("button", { name: "clear CHORD" }));
    expect(onArm).toHaveBeenCalledWith(2);
    expect(onMute).toHaveBeenCalledWith(1);
    expect(onVolume).toHaveBeenCalledWith(1, 0.5);
    expect(onClear).toHaveBeenCalledWith(1);
  });
});
