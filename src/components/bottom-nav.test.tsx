import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import { useGarageStore } from "@/stores/garage";

// vi.mock factories are hoisted above imports — anything they capture
// must come from vi.hoisted, or it is "accessed before initialization".
const { pathnameMock } = vi.hoisted(() => ({
  pathnameMock: vi.fn(() => "/"),
}));

vi.mock("next/navigation", () => ({
  usePathname: pathnameMock,
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
    isServerSyncing: false,
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
    expect(screen.getByRole("link", { name: "Service" })).toHaveAttribute(
      "href",
      `/cars/${carId}/log-visit`,
    );
    expect(screen.getByRole("link", { name: "Car" })).toHaveAttribute(
      "href",
      `/cars/${carId}`,
    );
    expect(screen.getByRole("link", { name: "Garage" })).toHaveAttribute("href", "/cars");
  });

  it("disables Log when the selected car has no rules", () => {
    useGarageStore.setState({ rules: [] });
    renderNav();
    expect(screen.queryByRole("link", { name: "Service" })).not.toBeInTheDocument();
    expect(screen.getByText("Service")).toBeInTheDocument();
  });

  it("disables Log and Car when there are no cars", () => {
    useGarageStore.setState({ cars: [], rules: [], selectedCarId: null });
    renderNav();
    expect(screen.queryByRole("link", { name: "Service" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Car" })).not.toBeInTheDocument();
  });

  it("marks Service current on the log-visit page", () => {
    pathnameMock.mockReturnValue(`/cars/${carId}/log-visit`);
    renderNav();
    expect(screen.getByRole("link", { name: "Service" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Car" })).not.toHaveAttribute("aria-current");
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

  it("links Service to the log-visit page of the newly selected car", () => {
    const otherId = "65f1a2b3c4d5e6f7a8b9c0d2";
    useGarageStore.setState((s) => ({
      cars: [...s.cars, { ...car, id: otherId, name: "Golf" }],
      rules: [...s.rules, { id: "r2", carId: otherId, componentName: "Engine oil", intervalKm: 10000 }],
      selectedCarId: otherId,
    }));
    renderNav();
    expect(screen.getByRole("link", { name: "Service" })).toHaveAttribute(
      "href",
      `/cars/${otherId}/log-visit`,
    );
  });
});
