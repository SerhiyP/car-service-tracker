import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import { useGarageStore } from "@/stores/garage";

// vi.mock factories are hoisted above imports — anything they capture
// must come from vi.hoisted, or it is "accessed before initialization".
const { actions, routerPush } = vi.hoisted(() => ({
  actions: { rule: vi.fn(), log: vi.fn(), visit: vi.fn() },
  routerPush: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
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
    isServerSyncing: false,
  });
});

describe("CarDetail", () => {
  it("selects the viewed car in the garage store", () => {
    render(
      <NextIntlClientProvider locale="en" timeZone="UTC" messages={en}>
        <CarDetail carId={carB.id} />
      </NextIntlClientProvider>,
    );
    expect(useGarageStore.getState().selectedCarId).toBe(carB.id);
  });

  it("does not select an unknown car id", () => {
    render(
      <NextIntlClientProvider locale="en" timeZone="UTC" messages={en}>
        <CarDetail carId="000000000000000000000000" />
      </NextIntlClientProvider>,
    );
    expect(useGarageStore.getState().selectedCarId).toBe(carA.id);
  });

  it("shows History by default and reveals Rules when its tab is selected", () => {
    useGarageStore.setState({
      rules: [
        { id: "r1", carId: carB.id, componentName: "Engine oil", intervalKm: 10000 },
      ],
    });
    render(
      <NextIntlClientProvider locale="en" timeZone="UTC" messages={en}>
        <CarDetail carId={carB.id} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("button", { name: /Log services/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Add rule/ })).toBeInTheDocument();
    const historyTab = screen.getByRole("button", { name: "Service history" });
    expect(historyTab).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Engine oil")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Maintenance rules" }));
    expect(screen.getByText("Engine oil")).toBeInTheDocument();
  });

  it("hides Add standard rules once the car has more than 3 rules", () => {
    useGarageStore.setState({
      rules: ["Engine oil", "Air filter", "Cabin filter", "Brake fluid"].map(
        (componentName, i) => ({
          id: `r${i}`,
          carId: carB.id,
          componentName,
          intervalKm: 10000,
        }),
      ),
    });
    render(
      <NextIntlClientProvider locale="en" timeZone="UTC" messages={en}>
        <CarDetail carId={carB.id} />
      </NextIntlClientProvider>,
    );
    expect(
      screen.queryByRole("button", { name: /Add standard rules/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add rule/ })).toBeInTheDocument();
  });

  it("disables Log services when the car has no rules", () => {
    render(
      <NextIntlClientProvider locale="en" timeZone="UTC" messages={en}>
        <CarDetail carId={carB.id} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("button", { name: /Log services/ })).toBeDisabled();
  });

  it("shows skeleton while isServerSyncing and hides car content", () => {
    useGarageStore.setState({ isServerSyncing: true });
    render(
      <NextIntlClientProvider locale="en" timeZone="UTC" messages={en}>
        <CarDetail carId={carB.id} />
      </NextIntlClientProvider>,
    );
    expect(document.querySelector("[data-slot='skeleton']")).toBeInTheDocument();
    expect(screen.queryByText("Service history")).not.toBeInTheDocument();
    expect(screen.queryByText("Maintenance rules")).not.toBeInTheDocument();
  });
});
