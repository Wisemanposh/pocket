import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { MelodyPadRow } from "./MelodyPadRow";

describe("MelodyPadRow", () => {
  it("renders 8 pads with the provided labels", () => {
    const labels = ["C", "D", "E♭", "F", "G", "A♭", "B♭", "C"];
    render(
      <MelodyPadRow labels={labels} onPress={() => {}} onRelease={() => {}} />
    );
    for (const l of labels) {
      const matches = screen.getAllByRole("button", { name: l });
      expect(matches.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("invokes onPress with the pad index", async () => {
    const onPress = vi.fn();
    const labels = ["C", "D", "E", "F", "G", "A", "B", "C"];
    const user = userEvent.setup();
    render(
      <MelodyPadRow labels={labels} onPress={onPress} onRelease={() => {}} />
    );
    const allPads = screen.getAllByRole("button");
    await user.pointer({ keys: "[MouseLeft>]", target: allPads[2]! });
    expect(onPress).toHaveBeenCalledWith(2);
    await user.pointer({ keys: "[/MouseLeft]" });
  });
});
