import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import { useGarageStore } from "@/stores/garage";
import { STANDARD_RULES } from "@/lib/standard-rules";

// vi.mock factories are hoisted above imports — anything they capture
// must come from vi.hoisted, or it is "accessed before initialization".
const { addStandardRules } = vi.hoisted(() => ({
  addStandardRules: vi.fn(),
}));

vi.mock("@/actions/rules", () => ({
  addStandardRulesAction: addStandardRules,
}));

import { StandardRulesDialog } from "./standard-rules-dialog";

const carId = "65f1a2b3c4d5e6f7a8b9c0d1";

afterEach(cleanup);
beforeEach(() => {
  addStandardRules.mockReset();
  useGarageStore.setState({ cars: [], rules: [], logs: [], selectedCarId: carId });
});

function renderDialog() {
  render(
    <NextIntlClientProvider locale="en" timeZone="UTC" messages={en}>
      <StandardRulesDialog carId={carId} trigger={<button>open</button>} />
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "open" }));
}

describe("StandardRulesDialog", () => {
  it("lists all standard rules pre-checked", () => {
    renderDialog();
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(STANDARD_RULES.length);
    for (const box of boxes) expect(box).toBeChecked();
    expect(
      screen.getByRole("button", { name: `Add selected (${STANDARD_RULES.length})` }),
    ).toBeEnabled();
  });

  it("disables and unchecks rules that already exist on the car (case-insensitive)", () => {
    useGarageStore.setState({
      rules: [
        {
          id: "r1",
          carId,
          componentName: "ENGINE OIL & OIL FILTER",
          intervalKm: 15000,
        },
      ],
    });
    renderDialog();
    const oilBox = screen.getByRole("checkbox", { name: /Engine oil & oil filter/ });
    expect(oilBox).toBeDisabled();
    expect(oilBox).not.toBeChecked();
    expect(screen.getByText("Already added")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `Add selected (${STANDARD_RULES.length - 1})` }),
    ).toBeEnabled();
  });

  it("submits only the checked keys and upserts the created rules", async () => {
    const created = [
      {
        id: "n1",
        carId,
        componentName: "Engine oil & oil filter",
        intervalKm: 10000,
        intervalMonths: 12,
      },
    ];
    addStandardRules.mockResolvedValue({ data: created });
    renderDialog();
    // Uncheck everything except engine oil
    for (const box of screen.getAllByRole("checkbox")) {
      if (!/Engine oil/.test(box.getAttribute("aria-label") ?? "")) fireEvent.click(box);
    }
    fireEvent.click(screen.getByRole("button", { name: "Add selected (1)" }));
    await vi.waitFor(() =>
      expect(addStandardRules).toHaveBeenCalledWith({ carId, keys: ["engineOil"] }),
    );
    await vi.waitFor(() => expect(useGarageStore.getState().rules).toEqual(created));
  });

  it("shows a translated error toast and keeps the store unchanged on failure", async () => {
    addStandardRules.mockResolvedValue({ serverError: "errors.notFound" });
    renderDialog();
    fireEvent.click(
      screen.getByRole("button", { name: `Add selected (${STANDARD_RULES.length})` }),
    );
    await vi.waitFor(() => expect(addStandardRules).toHaveBeenCalled());
    expect(useGarageStore.getState().rules).toEqual([]);
  });
});
