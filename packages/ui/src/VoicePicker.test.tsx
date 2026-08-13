import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { VoicePicker } from "./VoicePicker";

describe("VoicePicker", () => {
  const voices = [
    { id: "dx-piano" as const, displayName: "DX Piano" },
    { id: "chiptune-sq" as const, displayName: "Chiptune SQ" },
  ];

  it("renders each voice", () => {
    render(<VoicePicker voices={voices} selectedId="dx-piano" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "DX Piano" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Chiptune SQ" })).toBeDefined();
  });

  it("calls onChange with the clicked voice id", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<VoicePicker voices={voices} selectedId="dx-piano" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Chiptune SQ" }));
    expect(onChange).toHaveBeenCalledWith("chiptune-sq");
  });
});
