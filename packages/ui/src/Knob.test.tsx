import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Knob } from "./Knob";

describe("Knob", () => {
  it("exposes its value and supports keyboard control", () => {
    const onChange = vi.fn();
    render(<Knob label="FILTER" value={0.5} onChange={onChange} />);
    const knob = screen.getByRole("slider", { name: "FILTER" });
    expect(knob.getAttribute("aria-valuenow")).toBe("50");
    fireEvent.keyDown(knob, { key: "ArrowUp" });
    expect(onChange).toHaveBeenCalledWith(0.55);
    fireEvent.keyDown(knob, { key: "End" });
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("clamps pointer drags to the macro range", () => {
    const onChange = vi.fn();
    render(<Knob label="SHAPE" value={0.5} onChange={onChange} />);
    const knob = screen.getByRole("slider", { name: "SHAPE" });
    fireEvent(knob, new MouseEvent("pointerdown", { bubbles: true, clientY: 100 }));
    fireEvent(knob, new MouseEvent("pointermove", { bubbles: true, clientY: -100 }));
    expect(onChange).toHaveBeenLastCalledWith(1);
  });
});
