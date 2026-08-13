import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Modal } from "./Modal";

describe("Modal", () => {
  it("renders children when open", () => {
    render(
      <Modal open onClose={() => {}} title="TEST">
        <div>body content</div>
      </Modal>
    );
    expect(screen.getByText("body content")).toBeDefined();
    expect(screen.getByText("TEST")).toBeDefined();
  });

  it("does not render when closed", () => {
    render(
      <Modal open={false} onClose={() => {}} title="TEST">
        <div>body content</div>
      </Modal>
    );
    expect(screen.queryByText("body content")).toBeNull();
  });

  it("calls onClose when backdrop is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open onClose={onClose} title="TEST">
        <div>body</div>
      </Modal>
    );
    await user.click(screen.getByTestId("modal-backdrop"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose on Escape key", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open onClose={onClose} title="TEST">
        <div>body</div>
      </Modal>
    );
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });
});
