import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import { useGarageStore } from "@/stores/garage";

const { actions, routerPush } = vi.hoisted(() => ({
  actions: { deleteVisit: vi.fn(), deleteLog: vi.fn() },
  routerPush: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: routerPush }) }));
vi.mock("@/actions/visits", () => ({ deleteVisitAction: actions.deleteVisit }));
vi.mock("@/actions/logs", () => ({ deleteLogAction: actions.deleteLog }));

import { ServiceHistory } from "./service-history";

const carId = "65f1a2b3c4d5e6f7a8b9c0d1";

function renderHistory() {
  render(
    <NextIntlClientProvider locale="en" timeZone="UTC" messages={en}>
      <ServiceHistory carId={carId} />
    </NextIntlClientProvider>,
  );
}

afterEach(cleanup);
beforeEach(() => {
  actions.deleteVisit.mockReset();
  actions.deleteLog.mockReset();
  routerPush.mockReset();
  useGarageStore.setState({
    cars: [{ id: carId, name: "Octavia", currentMileage: 152000, updatedAt: "2026-01-01T00:00:00.000Z" }],
    rules: [
      { id: "r1", carId, componentName: "Engine oil", intervalKm: 10000, icon: "oil" },
      { id: "r2", carId, componentName: "Air filter", intervalKm: 30000, icon: "filter" },
    ],
    visits: [
      { id: "v1", carId, mileageAtService: 152000, dateAtService: "2026-06-13T00:00:00.000Z", totalCost: 4500 },
    ],
    logs: [
      { id: "l1", carId, componentName: "Engine oil", mileageAtService: 152000, dateAtService: "2026-06-13T00:00:00.000Z", visitId: "v1" },
      { id: "l2", carId, componentName: "Air filter", mileageAtService: 152000, dateAtService: "2026-06-13T00:00:00.000Z", visitId: "v1" },
      { id: "legacy1", carId, componentName: "Brake pads", mileageAtService: 90000, dateAtService: "2025-01-01T00:00:00.000Z" },
    ],
    selectedCarId: carId,
    isServerSyncing: false,
  });
});

describe("ServiceHistory", () => {
  it("renders one card per visit with an icon per service", () => {
    renderHistory();
    expect(screen.getByLabelText("Engine oil")).toBeInTheDocument();
    expect(screen.getByLabelText("Air filter")).toBeInTheDocument();
    expect(screen.getByText(/Visit total/)).toBeInTheDocument();
  });

  it("renders a legacy log as its own card", () => {
    renderHistory();
    expect(screen.getByLabelText("Brake pads")).toBeInTheDocument();
  });

  it("deletes the whole visit optimistically and calls the action", async () => {
    actions.deleteVisit.mockResolvedValue({ data: { ok: true } });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderHistory();

    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => expect(actions.deleteVisit).toHaveBeenCalledWith({ carId, visitId: "v1" }));
    expect(useGarageStore.getState().visits.some((v) => v.id === "v1")).toBe(false);
    expect(useGarageStore.getState().logs.some((l) => l.visitId === "v1")).toBe(false);
  });
});
