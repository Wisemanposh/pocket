import { render, screen } from "@testing-library/react";
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
});
