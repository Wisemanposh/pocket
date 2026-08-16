import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Sequencer } from "./Sequencer";

describe("Sequencer", () => {
  it("selects lanes, toggles steps, and starts", () => {
    const onSelectLane = vi.fn();
    const onToggleStep = vi.fn();
    const onToggleRunning = vi.fn();
    const grid = Array.from({ length: 8 }, () => Array(16).fill(false) as boolean[]);
    grid[0]![0] = true;
    render(
      <Sequencer
        laneLabels={["C", "D", "E", "F", "G", "A", "B", "C+"]}
        selectedLane={0}
        grid={grid}
        currentStep={0}
        running={false}
        onSelectLane={onSelectLane}
        onToggleStep={onToggleStep}
        onToggleRunning={onToggleRunning}
        onClear={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: "step 1" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "sequence lane D" }));
    fireEvent.click(screen.getByRole("button", { name: "step 2" }));
    fireEvent.click(screen.getByRole("button", { name: "start sequence" }));
    expect(onSelectLane).toHaveBeenCalledWith(1);
    expect(onToggleStep).toHaveBeenCalledWith(0, 1);
    expect(onToggleRunning).toHaveBeenCalledOnce();
  });
});
