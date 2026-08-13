import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Pad } from "./Pad";

describe("Pad", () => {
  it("renders its label", () => {
    render(<Pad label="I" onPress={() => {}} onRelease={() => {}} />);
    expect(screen.getByRole("button", { name: "I" })).toBeDefined();
  });

  it("calls onPress on pointer down and onRelease on pointer up", async () => {
    const onPress = vi.fn();
    const onRelease = vi.fn();
    const user = userEvent.setup();
    render(<Pad label="I" onPress={onPress} onRelease={onRelease} />);
    const btn = screen.getByRole("button", { name: "I" });

    await user.pointer({ keys: "[MouseLeft>]", target: btn });
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onRelease).not.toHaveBeenCalled();

    await user.pointer({ keys: "[/MouseLeft]" });
    expect(onRelease).toHaveBeenCalledTimes(1);
  });

  it("applies lit class when lit prop is true", () => {
    render(<Pad label="I" lit onPress={() => {}} onRelease={() => {}} />);
    const btn = screen.getByRole("button", { name: "I" });
    expect(btn.className).toMatch(/lit/);
  });
});
