import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import { useGarageStore } from "@/stores/garage";

// vi.mock factories are hoisted above imports — anything they capture
// must come from vi.hoisted, or it is "accessed before initialization".
const { updateMileage, createVisit } = vi.hoisted(() => ({
  updateMileage: vi.fn(),
  createVisit: vi.fn(),
}));

vi.mock("@/actions/cars", () => ({
  updateCarMileageAction: updateMileage,
}));
vi.mock("@/actions/visits", () => ({
  createVisitAction: createVisit,
}));

import { Dashboard } from "./dashboard";

const carId = "65f1a2b3c4d5e6f7a8b9c0d1";
const car = {
  id: carId,
  name: "Octavia",
  currentMileage: 120000,
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const rules = [
  { id: "r1", carId, componentName: "Engine oil", intervalKm: 10000 },
  { id: "r2", carId, componentName: "Air filter", intervalKm: 20000 },
  { id: "r3", carId, componentName: "Coolant", intervalKm: 40000 },
];
const oilLog = {
  id: "l1",
  carId,
  componentName: "Engine oil",
  mileageAtService: 115000,
  dateAtService: "2026-05-01T00:00:00.000Z",
};

afterEach(cleanup);
beforeEach(() => {
  useGarageStore.setState({
    cars: [car],
    rules,
    logs: [oilLog],
    visits: [],
    selectedCarId: carId,
    hasHydrated: true,
  });
});

function renderDashboard() {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <Dashboard />
    </NextIntlClientProvider>,
  );
}

describe("Dashboard auto-hide", () => {
  it("shows cards only for serviced rules and a hint for the rest", () => {
    renderDashboard();
    expect(screen.getByText("Engine oil")).toBeInTheDocument();
    expect(screen.queryByText("Air filter")).not.toBeInTheDocument();
    expect(screen.queryByText("Coolant")).not.toBeInTheDocument();
    const hint = screen.getByRole("link", { name: "2 items not serviced yet" });
    expect(hint).toHaveAttribute("href", `/cars/${carId}`);
  });

  it("shows only the hint when nothing is serviced yet", () => {
    useGarageStore.setState({ logs: [] });
    renderDashboard();
    expect(screen.queryByText("Engine oil")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "3 items not serviced yet" }),
    ).toBeInTheDocument();
  });

  it("shows no hint when every rule is serviced", () => {
    useGarageStore.setState({
      logs: rules.map((r, i) => ({
        id: `log-${i}`,
        carId,
        componentName: r.componentName,
        mileageAtService: 115000,
        dateAtService: "2026-05-01T00:00:00.000Z",
      })),
    });
    renderDashboard();
    expect(screen.getByText("Coolant")).toBeInTheDocument();
    expect(screen.queryByText(/not serviced yet/)).not.toBeInTheDocument();
  });
});
