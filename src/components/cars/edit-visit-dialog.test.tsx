import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import { useGarageStore } from "@/stores/garage";
import type { ServiceLog } from "@/lib/types";

// vi.mock factories are hoisted above imports — anything they capture
// must come from vi.hoisted, or it is "accessed before initialization".
const { updateVisit } = vi.hoisted(() => ({
  updateVisit: vi.fn(),
}));

vi.mock("@/actions/visits", () => ({
  updateVisitAction: updateVisit,
}));

import { EditVisitDialog } from "./edit-visit-dialog";

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
];
const visit = {
  id: "v1",
  carId,
  mileageAtService: 110000,
  dateAtService: "2026-03-05T00:00:00.000Z",
  totalCost: 800,
};
const visitLog: ServiceLog = {
  id: "l1",
  carId,
  componentName: "Engine oil",
  mileageAtService: 110000,
  dateAtService: "2026-03-05T00:00:00.000Z",
  visitId: "v1",
};
const legacyLog: ServiceLog = {
  id: "l9",
  carId,
  componentName: "Brake fluid",
  mileageAtService: 90000,
  dateAtService: "2025-11-20T00:00:00.000Z",
};

afterEach(cleanup);
beforeEach(() => {
  updateVisit.mockReset();
  useGarageStore.setState({
    cars: [car],
    rules,
    logs: [visitLog, legacyLog],
    visits: [visit],
    selectedCarId: carId,
  });
});

function renderDialog(editedLog: ServiceLog) {
  const onOpenChange = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <EditVisitDialog car={car} editedLog={editedLog} onOpenChange={onOpenChange} />
    </NextIntlClientProvider>,
  );
  return onOpenChange;
}

describe("EditVisitDialog", () => {
  it("prefills from the visit: components checked, date/mileage/cost filled", () => {
    renderDialog(visitLog);
    expect(screen.getByRole("checkbox", { name: "Engine oil" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Air filter" })).not.toBeChecked();
    expect(screen.getByLabelText("Mileage at service (km)")).toHaveValue(110000);
    expect(screen.getByLabelText("Service date")).toHaveValue("2026-03-05");
    expect(screen.getByLabelText(/Total cost/)).toHaveValue(800);
    expect(screen.getByRole("button", { name: "Save changes (1)" })).toBeEnabled();
  });

  it("prefills from a legacy log and lists its component even without a rule", () => {
    renderDialog(legacyLog);
    expect(screen.getByRole("checkbox", { name: "Brake fluid" })).toBeChecked();
    expect(screen.getByLabelText("Mileage at service (km)")).toHaveValue(90000);
    expect(screen.getByLabelText("Service date")).toHaveValue("2025-11-20");
    expect(screen.getByLabelText(/Total cost/)).toHaveValue(null);
  });

  it("submits a visit target with the edited selection and applies the result", async () => {
    const updatedVisit = { ...visit, mileageAtService: 111000, totalCost: 950 };
    const newLogs = [
      { ...visitLog, mileageAtService: 111000 },
      {
        id: "l2",
        carId,
        componentName: "Air filter",
        mileageAtService: 111000,
        dateAtService: "2026-03-05T00:00:00.000Z",
        visitId: "v1",
      },
    ];
    updateVisit.mockResolvedValue({
      data: { visit: updatedVisit, logs: newLogs, newCarMileage: null },
    });

    const onOpenChange = renderDialog(visitLog);
    fireEvent.click(screen.getByRole("checkbox", { name: "Air filter" }));
    fireEvent.change(screen.getByLabelText("Mileage at service (km)"), {
      target: { value: "111000" },
    });
    fireEvent.change(screen.getByLabelText(/Total cost/), { target: { value: "950" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes (2)" }));

    await vi.waitFor(() =>
      expect(updateVisit).toHaveBeenCalledWith(
        expect.objectContaining({
          carId,
          target: { visitId: "v1" },
          componentNames: ["Engine oil", "Air filter"],
          mileageAtService: 111000,
          totalCost: 950,
        }),
      ),
    );
    await vi.waitFor(() =>
      expect(useGarageStore.getState().visits).toEqual([updatedVisit]),
    );
    expect(useGarageStore.getState().logs.map((l) => l.id).sort()).toEqual([
      "l1",
      "l2",
      "l9",
    ]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("submits a log target for a legacy row and removes the converted log", async () => {
    const newVisit = {
      id: "v2",
      carId,
      mileageAtService: 90000,
      dateAtService: "2025-11-20T00:00:00.000Z",
    };
    const newLogs = [{ ...legacyLog, id: "l10", visitId: "v2" }];
    updateVisit.mockResolvedValue({
      data: { visit: newVisit, logs: newLogs, newCarMileage: null },
    });

    renderDialog(legacyLog);
    fireEvent.click(screen.getByRole("button", { name: "Save changes (1)" }));

    await vi.waitFor(() =>
      expect(updateVisit).toHaveBeenCalledWith(
        expect.objectContaining({
          target: { logId: "l9" },
          componentNames: ["Brake fluid"],
        }),
      ),
    );
    expect(updateVisit.mock.calls[0][0]).not.toHaveProperty("totalCost");
    await vi.waitFor(() =>
      expect(useGarageStore.getState().logs.map((l) => l.id).sort()).toEqual([
        "l1",
        "l10",
      ]),
    );
  });

  it("submits without totalCost when the prefilled cost is cleared", async () => {
    updateVisit.mockResolvedValue({
      data: { visit: { ...visit, totalCost: undefined }, logs: [visitLog], newCarMileage: null },
    });
    renderDialog(visitLog);
    fireEvent.change(screen.getByLabelText(/Total cost/), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes (1)" }));
    await vi.waitFor(() => expect(updateVisit).toHaveBeenCalled());
    expect(updateVisit.mock.calls[0][0]).not.toHaveProperty("totalCost");
  });

  it("keeps the store unchanged and stays open on failure", async () => {
    updateVisit.mockResolvedValue({ serverError: "errors.notFound" });
    const onOpenChange = renderDialog(visitLog);
    fireEvent.click(screen.getByRole("button", { name: "Save changes (1)" }));
    await vi.waitFor(() => expect(updateVisit).toHaveBeenCalled());
    expect(useGarageStore.getState().visits).toEqual([visit]);
    expect(useGarageStore.getState().logs).toEqual([visitLog, legacyLog]);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
