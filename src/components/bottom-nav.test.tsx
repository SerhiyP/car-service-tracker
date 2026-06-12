import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import { useGarageStore } from "@/stores/garage";

// vi.mock factories are hoisted above imports — anything they capture
// must come from vi.hoisted, or it is "accessed before initialization".
const { pathnameMock, routerPush } = vi.hoisted(() => ({
  pathnameMock: vi.fn(() => "/"),
  routerPush: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: pathnameMock,
  useRouter: () => ({ push: routerPush }),
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
  routerPush.mockReset();
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
    expect(screen.getByRole("button", { name: "Service" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "Car" })).toHaveAttribute(
      "href",
      `/cars/${carId}`,
    );
    expect(screen.getByRole("link", { name: "Garage" })).toHaveAttribute("href", "/cars");
  });

  it("navigates to the log-visit page for the selected car", () => {
    renderNav();
    fireEvent.click(screen.getByRole("button", { name: "Service" }));
    expect(routerPush).toHaveBeenCalledWith(`/cars/${carId}/log-visit`);
  });

  it("disables Log when the selected car has no rules", () => {
    useGarageStore.setState({ rules: [] });
    renderNav();
    expect(screen.getByRole("button", { name: "Service" })).toBeDisabled();
  });

  it("disables Log and Car when there are no cars", () => {
    useGarageStore.setState({ cars: [], rules: [], selectedCarId: null });
    renderNav();
    expect(screen.getByRole("button", { name: "Service" })).toBeDisabled();
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

  it("navigates to the log-visit page of the newly selected car", () => {
    const otherId = "65f1a2b3c4d5e6f7a8b9c0d2";
    useGarageStore.setState((s) => ({
      cars: [...s.cars, { ...car, id: otherId, name: "Golf" }],
      rules: [...s.rules, { id: "r2", carId: otherId, componentName: "Engine oil", intervalKm: 10000 }],
      selectedCarId: otherId,
    }));
    renderNav();
    fireEvent.click(screen.getByRole("button", { name: "Service" }));
    expect(routerPush).toHaveBeenCalledWith(`/cars/${otherId}/log-visit`);
  });
});
