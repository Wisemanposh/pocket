import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FxPanel } from "./FxPanel";

describe("FxPanel", () => {
  it("renders and adjusts all four live effects", () => {
    const onChange = vi.fn();
    render(
      <FxPanel
        values={{ reverb: 0, delay: 0.2, saturation: 0.4, wow: 0.6 }}
        onChange={onChange}
      />
    );
    expect(screen.getAllByRole("slider")).toHaveLength(4);
    fireEvent.keyDown(screen.getByRole("slider", { name: "REVERB" }), { key: "ArrowUp" });
    expect(onChange).toHaveBeenCalledWith("reverb", 0.05);
  });
});
