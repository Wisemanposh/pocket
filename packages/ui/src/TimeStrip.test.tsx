import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { TimeStrip } from "./TimeStrip";

describe("TimeStrip", () => {
  const baseProps = {
    metroOn: false,
    quantStrength: 0.75,
    gridDivision: "1/8" as const,
    onToggleMetro: () => {},
    onCycleQuant: () => {},
    onCycleGrid: () => {},
    onQuantChange: () => {},
    onQuantCommit: () => {},
  };

  it("renders METRO + QUANT + GRID chips with current values", () => {
    render(<TimeStrip {...baseProps} />);
    expect(screen.getByRole("button", { name: /metro/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /quant 75%/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /grid 1\/8/i })).toBeDefined();
  });

  it("METRO button calls onToggleMetro when clicked", async () => {
    const onToggleMetro = vi.fn();
    const user = userEvent.setup();
    render(<TimeStrip {...baseProps} onToggleMetro={onToggleMetro} />);
    await user.click(screen.getByRole("button", { name: /metro/i }));
    expect(onToggleMetro).toHaveBeenCalledOnce();
  });

  it("shows OFF when quant strength is 0", () => {
    render(<TimeStrip {...baseProps} quantStrength={0} gridDivision="1/4" />);
    expect(screen.getByRole("button", { name: /quant off/i })).toBeDefined();
  });
});
