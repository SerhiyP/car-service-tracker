import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import { useGarageStore } from "@/stores/garage";

// vi.mock factories are hoisted above imports — anything they capture
// must come from vi.hoisted, or it is "accessed before initialization".
const { createVisit } = vi.hoisted(() => ({
  createVisit: vi.fn(),
}));

vi.mock("@/actions/visits", () => ({
  createVisitAction: createVisit,
}));

import { LogVisitDialog } from "./log-visit-dialog";

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

afterEach(cleanup);
beforeEach(() => {
  createVisit.mockReset();
  useGarageStore.setState({
    cars: [car],
    rules,
    logs: [],
    visits: [],
    selectedCarId: carId,
  });
});

function renderDialog(preselectedComponent: string | null = null) {
  const onOpenChange = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <LogVisitDialog
        car={car}
        open
        onOpenChange={onOpenChange}
        preselectedComponent={preselectedComponent}
      />
    </NextIntlClientProvider>,
  );
  return onOpenChange;
}

/**
 * Renders the dialog and returns a `setProps` function for re-rendering with
 * new open / preselectedComponent values. The onOpenChange callback is also
 * exchangeable on each call so tests can swap in a fresh spy.
 */
function renderControlled(
  initial: {
    open: boolean;
    preselectedComponent: string | null;
    onOpenChange?: (open: boolean) => void;
  },
) {
  const { rerender } = render(
    <NextIntlClientProvider locale="en" messages={en}>
      <LogVisitDialog
        car={car}
        open={initial.open}
        onOpenChange={initial.onOpenChange ?? (() => {})}
        preselectedComponent={initial.preselectedComponent}
      />
    </NextIntlClientProvider>,
  );

  function setProps(next: {
    open: boolean;
    preselectedComponent: string | null;
    onOpenChange?: (open: boolean) => void;
  }) {
    rerender(
      <NextIntlClientProvider locale="en" messages={en}>
        <LogVisitDialog
          car={car}
          open={next.open}
          onOpenChange={next.onOpenChange ?? (() => {})}
          preselectedComponent={next.preselectedComponent}
        />
      </NextIntlClientProvider>,
    );
  }

  return { setProps };
}

describe("LogVisitDialog", () => {
  it("lists a checkbox per rule, unchecked, with submit disabled", () => {
    renderDialog();
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(rules.length);
    for (const box of boxes) expect(box).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Log selected (0)" })).toBeDisabled();
  });

  it("pre-checks the preselected component", () => {
    renderDialog("Engine oil");
    expect(screen.getByRole("checkbox", { name: "Engine oil" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Air filter" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Log selected (1)" })).toBeEnabled();
  });

  it("submits selection with shared mileage/date/cost and applies the result", async () => {
    const visit = {
      id: "v1",
      carId,
      mileageAtService: 121000,
      dateAtService: "2026-06-10T00:00:00.000Z",
      totalCost: 1500,
    };
    const logs = [
      {
        id: "l1",
        carId,
        componentName: "Engine oil",
        mileageAtService: 121000,
        dateAtService: "2026-06-10T00:00:00.000Z",
        visitId: "v1",
      },
    ];
    createVisit.mockResolvedValue({ data: { visit, logs, newCarMileage: 121000 } });

    const onOpenChange = renderDialog();
    fireEvent.click(screen.getByRole("checkbox", { name: "Engine oil" }));
    fireEvent.change(screen.getByLabelText("Mileage at service (km)"), {
      target: { value: "121000" },
    });
    fireEvent.change(screen.getByLabelText(/Total cost/), {
      target: { value: "1500" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log selected (1)" }));

    await vi.waitFor(() =>
      expect(createVisit).toHaveBeenCalledWith(
        expect.objectContaining({
          carId,
          componentNames: ["Engine oil"],
          mileageAtService: 121000,
          totalCost: 1500,
        }),
      ),
    );
    await vi.waitFor(() => expect(useGarageStore.getState().visits).toEqual([visit]));
    expect(useGarageStore.getState().logs).toEqual(logs);
    expect(useGarageStore.getState().cars[0].currentMileage).toBe(121000);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("omits totalCost when the cost field is left empty", async () => {
    createVisit.mockResolvedValue({
      data: {
        visit: { id: "v2", carId, mileageAtService: 120000, dateAtService: "2026-06-10T00:00:00.000Z" },
        logs: [],
        newCarMileage: null,
      },
    });
    renderDialog("Engine oil");
    fireEvent.click(screen.getByRole("button", { name: "Log selected (1)" }));
    await vi.waitFor(() => expect(createVisit).toHaveBeenCalled());
    expect(createVisit.mock.calls[0][0]).not.toHaveProperty("totalCost");
  });

  it("keeps the store unchanged and stays open on failure", async () => {
    createVisit.mockResolvedValue({ serverError: "errors.notFound" });
    const onOpenChange = renderDialog("Engine oil");
    fireEvent.click(screen.getByRole("button", { name: "Log selected (1)" }));
    await vi.waitFor(() => expect(createVisit).toHaveBeenCalled());
    expect(useGarageStore.getState().visits).toEqual([]);
    expect(useGarageStore.getState().logs).toEqual([]);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("clears manual checkbox state on close and honours a new preselectedComponent on reopen", () => {
    // Open with no preselect, manually check "Air filter"
    const { setProps } = renderControlled({ open: true, preselectedComponent: null });
    fireEvent.click(screen.getByRole("checkbox", { name: "Air filter" }));
    expect(screen.getByRole("checkbox", { name: "Air filter" })).toBeChecked();

    // Close via the dialog's own close button (renders as a button with sr-only "Close")
    // This routes through handleOpenChange(false) which calls setChecked({})
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    // Re-render closed so the component receives open=false through handleOpenChange's
    // onOpenChange(false) call — simulate that by re-rendering with open=false first
    setProps({ open: false, preselectedComponent: null });

    // Reopen with a new preselect
    setProps({ open: true, preselectedComponent: "Engine oil" });

    // "Engine oil" is pre-checked by prop; "Air filter" must NOT carry over stale state
    expect(screen.getByRole("checkbox", { name: "Engine oil" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Air filter" })).not.toBeChecked();
  });

  it("excludes rules belonging to other cars", () => {
    // Add a rule for a different car — it must never appear in this dialog
    useGarageStore.setState({
      rules: [
        ...rules,
        {
          id: "r3",
          carId: "65f1a2b3c4d5e6f7a8b9c0d2",
          componentName: "Coolant",
          intervalKm: 40000,
        },
      ],
    });

    renderDialog();

    // Only the 2 rules for `carId` should render
    expect(screen.getAllByRole("checkbox")).toHaveLength(rules.length);
    expect(screen.queryByRole("checkbox", { name: "Coolant" })).toBeNull();
  });
});
