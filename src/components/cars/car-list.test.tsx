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
  useGarageStore.setState(useGarageStore.getInitialState());
});

describe("CarList", () => {
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
});
