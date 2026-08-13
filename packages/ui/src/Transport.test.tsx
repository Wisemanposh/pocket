import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Transport } from "./Transport";

describe("Transport", () => {
  it("renders REC, PLAY, STOP buttons", () => {
    render(<Transport recording={false} onRec={() => {}} onPlay={() => {}} onStop={() => {}} />);
    expect(screen.getByRole("button", { name: /rec/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /play/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /stop/i })).toBeDefined();
  });

  it("clicks dispatch correct handlers", async () => {
    const onRec = vi.fn();
    const onPlay = vi.fn();
    const onStop = vi.fn();
    const user = userEvent.setup();
    render(<Transport recording={false} onRec={onRec} onPlay={onPlay} onStop={onStop} />);
    await user.click(screen.getByRole("button", { name: /rec/i }));
    await user.click(screen.getByRole("button", { name: /play/i }));
    await user.click(screen.getByRole("button", { name: /stop/i }));
    expect(onRec).toHaveBeenCalledOnce();
    expect(onPlay).toHaveBeenCalledOnce();
    expect(onStop).toHaveBeenCalledOnce();
  });

  it("shows recording state visually when recording", () => {
    render(<Transport recording onRec={() => {}} onPlay={() => {}} onStop={() => {}} />);
    const rec = screen.getByRole("button", { name: /rec/i });
    expect(rec.className).toMatch(/active/);
  });
});
