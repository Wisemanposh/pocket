import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ChordPadGrid } from "./ChordPadGrid";

describe("ChordPadGrid", () => {
  it("renders 8 pads in major-mode order I ii iii IV V vi viio V7", () => {
    render(<ChordPadGrid mode="major" onPress={() => {}} onRelease={() => {}} />);
    const labels = ["I", "ii", "iii", "IV", "V", "vi", "viio", "V7"];
    for (const l of labels) {
      expect(screen.getByRole("button", { name: l })).toBeDefined();
    }
  });

  it("renders minor-mode labels i, iio, III, iv, v, VI, VII, V7", () => {
    render(<ChordPadGrid mode="minor" onPress={() => {}} onRelease={() => {}} />);
    const labels = ["i", "iio", "III", "iv", "v", "VI", "VII", "V7"];
    for (const l of labels) {
      expect(screen.getByRole("button", { name: l })).toBeDefined();
    }
  });

  it("invokes onPress with the degree index when a pad is clicked", async () => {
    const onPress = vi.fn();
    const user = userEvent.setup();
    render(<ChordPadGrid mode="major" onPress={onPress} onRelease={() => {}} />);
    const ivPad = screen.getByRole("button", { name: "IV" });
    await user.pointer({ keys: "[MouseLeft>]", target: ivPad });
    expect(onPress).toHaveBeenCalledWith(3, false);
    await user.pointer({ keys: "[/MouseLeft]" });
  });

  it("invokes onPress with seventh=true on the V7 pad", async () => {
    const onPress = vi.fn();
    const user = userEvent.setup();
    render(<ChordPadGrid mode="major" onPress={onPress} onRelease={() => {}} />);
    const v7Pad = screen.getByRole("button", { name: "V7" });
    await user.pointer({ keys: "[MouseLeft>]", target: v7Pad });
    expect(onPress).toHaveBeenCalledWith(4, true);
    await user.pointer({ keys: "[/MouseLeft]" });
  });

  it("keeps independently held pads lit", () => {
    render(<ChordPadGrid mode="major" onPress={() => {}} onRelease={() => {}} />);
    const first = screen.getByRole("button", { name: "I" });
    const fourth = screen.getByRole("button", { name: "IV" });
    fireEvent.keyDown(first, { key: " " });
    fireEvent.keyDown(fourth, { key: " " });
    expect(first.className).toMatch(/lit/);
    expect(fourth.className).toMatch(/lit/);
    fireEvent.keyUp(first, { key: " " });
    fireEvent.keyUp(fourth, { key: " " });
  });
});
