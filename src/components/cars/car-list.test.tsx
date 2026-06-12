import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import { useGarageStore } from "@/stores/garage";
import { CarList } from "./car-list";

vi.mock("@/actions/cars", () => ({
  createCarAction: vi.fn(),
  renameCarAction: vi.fn(),
  deleteCarAction: vi.fn(),
}));

function renderList() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <CarList />
    </NextIntlClientProvider>,
  );
}

afterEach(cleanup);

beforeEach(() => {
  useGarageStore.setState({
    ...useGarageStore.getInitialState(),
    isServerSyncing: false,
  });
});

describe("CarList", () => {
  it("shows skeleton while isServerSyncing", () => {
    useGarageStore.setState({ isServerSyncing: true });
    renderList();
    expect(document.querySelector("[data-slot='skeleton']")).toBeInTheDocument();
    expect(screen.queryByText(en.garage.noCars)).not.toBeInTheDocument();
  });

  it("shows the empty state when there are no cars", () => {
    renderList();
    expect(screen.getByText(en.garage.noCars)).toBeInTheDocument();
    expect(screen.getByText(en.garage.noCarsHint)).toBeInTheDocument();
  });

  it("lists cars and hides the empty state when cars exist", () => {
    useGarageStore.setState({
      cars: [{ id: "car-1", name: "My Honda", currentMileage: 42000, updatedAt: "2026-06-01T00:00:00.000Z" }],
    });
    renderList();
    expect(screen.getByText("My Honda")).toBeInTheDocument();
    expect(screen.queryByText(en.garage.noCars)).not.toBeInTheDocument();
  });

  it("shows rules count and last service date on a car card", () => {
    const carId = "car-1";
    useGarageStore.setState({
      cars: [{ id: carId, name: "My Honda", currentMileage: 42000, updatedAt: "2026-06-01T00:00:00.000Z" }],
      rules: [{ id: "r1", carId, componentName: "Oil", intervalKm: 10000 }],
      logs: [{
        id: "l1",
        carId,
        componentName: "Oil",
        mileageAtService: 38000,
        dateAtService: "2025-06-01T00:00:00.000Z",
      }],
    });
    renderList();
    expect(screen.getByText(/1 rule/)).toBeInTheDocument();
    expect(screen.getByText(/Last:/)).toBeInTheDocument();
  });

  it("shows 'Never serviced' when a car has no logs", () => {
    useGarageStore.setState({
      cars: [{ id: "car-1", name: "My Honda", currentMileage: 42000, updatedAt: "2026-06-01T00:00:00.000Z" }],
      rules: [],
      logs: [],
    });
    renderList();
    expect(screen.getByText(en.garage.neverServiced)).toBeInTheDocument();
  });
});
