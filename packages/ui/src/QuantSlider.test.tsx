import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuantSlider } from "./QuantSlider";

describe("QuantSlider", () => {
  it("commits the release position rather than the previous render value", () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    const { container } = render(
      <QuantSlider value={0.75} onChange={onChange} onCommit={onCommit} />
    );
    const track = container.querySelector("[class*='track']") as HTMLDivElement;
    vi.spyOn(track, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 10, bottom: 100,
      width: 10, height: 100, toJSON: () => ({}),
    });

    fireEvent(window, new MouseEvent("pointerup", { bubbles: true, clientY: 20 }));
    expect(onChange).toHaveBeenLastCalledWith(0.8);
    expect(onCommit).toHaveBeenCalledWith(0.8);
    expect(screen.getByText("75%")).toBeDefined();
  });
});
