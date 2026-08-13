import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { BpmPicker } from "./BpmPicker";

describe("BpmPicker", () => {
  it("renders TAP button and current BPM value", () => {
    render(<BpmPicker value={92} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "TAP" })).toBeDefined();
    expect(screen.getByRole("spinbutton").textContent).toBe("92");
  });

  it("fires onChange after two well-spaced TAPs", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<BpmPicker value={92} onChange={onChange} />);
    const btn = screen.getByRole("button", { name: "TAP" });
    await user.click(btn);
    await user.click(btn);
    expect(onChange).toHaveBeenCalled();
  });

  it("supports bounded keyboard adjustment", () => {
    const onChange = vi.fn();
    const { rerender } = render(<BpmPicker value={92} onChange={onChange} />);
    const value = screen.getByRole("spinbutton", { name: "BPM" });
    fireEvent.keyDown(value, { key: "ArrowUp" });
    expect(onChange).toHaveBeenLastCalledWith(93);

    rerender(<BpmPicker value={240} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("spinbutton", { name: "BPM" }), { key: "ArrowUp" });
    expect(onChange).toHaveBeenLastCalledWith(240);
  });
});
