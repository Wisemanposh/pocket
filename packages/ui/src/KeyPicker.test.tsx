import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { KeyPicker } from "./KeyPicker";

describe("KeyPicker", () => {
  it("renders all 12 root notes and MAJ/MIN", () => {
    render(<KeyPicker value={{ root: 0, mode: "minor" }} onChange={() => {}} />);
    for (const n of ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"]) {
      expect(screen.getByRole("button", { name: n })).toBeDefined();
    }
    expect(screen.getByRole("button", { name: "MAJ" })).toBeDefined();
    expect(screen.getByRole("button", { name: "MIN" })).toBeDefined();
  });

  it("calls onChange when a root is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<KeyPicker value={{ root: 0, mode: "minor" }} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "G" }));
    expect(onChange).toHaveBeenCalledWith({ root: 7, mode: "minor" });
  });

  it("calls onChange when MAJ is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<KeyPicker value={{ root: 0, mode: "minor" }} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "MAJ" }));
    expect(onChange).toHaveBeenCalledWith({ root: 0, mode: "major" });
  });
});
