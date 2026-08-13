import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Lcd } from "./Lcd";

describe("Lcd", () => {
  it("renders three readouts", () => {
    render(<Lcd transport="▶ 00:42" key2="KEY Cm ♩=92" voice="VOICE: DX-PIANO" />);
    expect(screen.getByText("▶ 00:42")).toBeDefined();
    expect(screen.getByText("KEY Cm ♩=92")).toBeDefined();
    expect(screen.getByText("VOICE: DX-PIANO")).toBeDefined();
  });

  it("fires onClickField('key') when the KEY field is clicked", async () => {
    const onClickField = vi.fn();
    const user = userEvent.setup();
    render(
      <Lcd
        transport="▶ 00:00"
        key2="KEY Cm ♩=92"
        voice="VOICE: DX-PIANO"
        onClickField={onClickField}
      />
    );
    await user.click(screen.getByText("KEY Cm ♩=92"));
    expect(onClickField).toHaveBeenCalledWith("key");
  });
});
