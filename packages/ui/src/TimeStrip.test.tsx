import { act, render, screen } from "@testing-library/react";
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

  it("opens precision control on long press without also cycling", async () => {
    const onCycleQuant = vi.fn();
    const user = userEvent.setup();
    render(<TimeStrip {...baseProps} onCycleQuant={onCycleQuant} />);
    const quant = screen.getByRole("button", { name: /quant 75%/i });
    await user.pointer({ keys: "[MouseLeft>]", target: quant, coords: { clientX: 10, clientY: 10 } });
    await act(() => new Promise((resolve) => setTimeout(resolve, 320)));
    expect(document.querySelector("[class*='slider']")).not.toBeNull();
    await user.pointer({ keys: "[/MouseLeft]", coords: { clientX: 10, clientY: 10 } });
    expect(onCycleQuant).not.toHaveBeenCalled();
  });
});
