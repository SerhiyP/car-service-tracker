import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import { useGarageStore } from "@/stores/garage";

// vi.mock factories are hoisted above imports — anything they capture
// must come from vi.hoisted, or it is "accessed before initialization".
const { actions } = vi.hoisted(() => ({
  actions: { rule: vi.fn(), log: vi.fn(), visit: vi.fn() },
}));

vi.mock("@/actions/rules", () => ({
  createRuleAction: actions.rule,
  updateRuleAction: actions.rule,
  deleteRuleAction: actions.rule,
  addStandardRulesAction: actions.rule,
}));
vi.mock("@/actions/logs", () => ({
  deleteLogAction: actions.log,
}));
vi.mock("@/actions/visits", () => ({
  createVisitAction: actions.visit,
  updateVisitAction: actions.visit,
}));

import { CarDetail } from "./car-detail";

const carA = {
  id: "65f1a2b3c4d5e6f7a8b9c0d1",
  name: "Octavia",
  currentMileage: 120000,
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const carB = {
  id: "65f1a2b3c4d5e6f7a8b9c0d2",
  name: "Golf",
  currentMileage: 287000,
  updatedAt: "2026-01-01T00:00:00.000Z",
};

afterEach(cleanup);
beforeEach(() => {
  useGarageStore.setState({
    cars: [carA, carB],
    rules: [],
    logs: [],
    visits: [],
    selectedCarId: carA.id,
    hasHydrated: true,
  });
});

describe("CarDetail", () => {
  it("selects the viewed car in the garage store", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <CarDetail carId={carB.id} />
      </NextIntlClientProvider>,
    );
    expect(useGarageStore.getState().selectedCarId).toBe(carB.id);
  });

  it("does not select an unknown car id", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <CarDetail carId="000000000000000000000000" />
      </NextIntlClientProvider>,
    );
    expect(useGarageStore.getState().selectedCarId).toBe(carA.id);
  });

  it("shows the action buttons above the history and rules sections", () => {
    useGarageStore.setState({
      rules: [
        { id: "r1", carId: carB.id, componentName: "Engine oil", intervalKm: 10000 },
      ],
    });
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <CarDetail carId={carB.id} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("button", { name: /Log services/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Add rule/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add standard rules/ })).toBeInTheDocument();
    // History section precedes the rules section in the DOM.
    const history = screen.getByText("Service history");
    const rules = screen.getByText("Maintenance rules");
    expect(
      history.compareDocumentPosition(rules) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
