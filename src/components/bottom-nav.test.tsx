import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import { useGarageStore } from "@/stores/garage";

// vi.mock factories are hoisted above imports — anything they capture
// must come from vi.hoisted, or it is "accessed before initialization".
const { pathnameMock, createVisit } = vi.hoisted(() => ({
  pathnameMock: vi.fn(() => "/"),
  createVisit: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: pathnameMock,
}));
vi.mock("@/actions/visits", () => ({
  createVisitAction: createVisit,
}));

import { BottomNav } from "./bottom-nav";

const carId = "65f1a2b3c4d5e6f7a8b9c0d1";
const car = {
  id: carId,
  name: "Octavia",
  currentMileage: 120000,
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const rule = { id: "r1", carId, componentName: "Engine oil", intervalKm: 10000 };

afterEach(cleanup);
beforeEach(() => {
  pathnameMock.mockReturnValue("/");
  useGarageStore.setState({
    cars: [car],
    rules: [rule],
    logs: [],
    visits: [],
    selectedCarId: carId,
    hasHydrated: true,
  });
});

function renderNav() {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <BottomNav />
    </NextIntlClientProvider>,
  );
}

describe("BottomNav", () => {
  it("renders all four items", () => {
    renderNav();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: "Log" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "Car" })).toHaveAttribute(
      "href",
      `/cars/${carId}`,
    );
    expect(screen.getByRole("link", { name: "Garage" })).toHaveAttribute("href", "/cars");
  });

  it("opens the log visit dialog for the selected car", () => {
    renderNav();
    fireEvent.click(screen.getByRole("button", { name: "Log" }));
    expect(screen.getByText("Log services")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Engine oil" })).toBeInTheDocument();
  });

  it("disables Log when the selected car has no rules", () => {
    useGarageStore.setState({ rules: [] });
    renderNav();
    expect(screen.getByRole("button", { name: "Log" })).toBeDisabled();
  });

  it("disables Log and Car when there are no cars", () => {
    useGarageStore.setState({ cars: [], rules: [], selectedCarId: null });
    renderNav();
    expect(screen.getByRole("button", { name: "Log" })).toBeDisabled();
    expect(screen.queryByRole("link", { name: "Car" })).not.toBeInTheDocument();
  });

  it("marks Car (not Garage) current on the selected car's page", () => {
    pathnameMock.mockReturnValue(`/cars/${carId}`);
    renderNav();
    expect(screen.getByRole("link", { name: "Car" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Garage" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("marks Garage current on the garage page", () => {
    pathnameMock.mockReturnValue("/cars");
    renderNav();
    expect(screen.getByRole("link", { name: "Garage" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("closes the log dialog when the selected car changes", async () => {
    renderNav();
    fireEvent.click(screen.getByRole("button", { name: "Log" }));
    expect(screen.getByText("Log services")).toBeInTheDocument();
    const otherId = "65f1a2b3c4d5e6f7a8b9c0d2";
    act(() =>
      useGarageStore.setState((s) => ({
        cars: [...s.cars, { ...car, id: otherId, name: "Golf" }],
        selectedCarId: otherId,
      })),
    );
    await waitFor(() =>
      expect(screen.queryByText("Log services")).not.toBeInTheDocument(),
    );
  });
});
