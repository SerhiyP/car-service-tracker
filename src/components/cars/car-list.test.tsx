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

describe("CarList", () => {
  beforeEach(() => {
    useGarageStore.setState({ cars: [] });
  });

  it("shows the empty state when there are no cars", () => {
    renderList();
    expect(screen.getByText(en.garage.noCars)).toBeInTheDocument();
    expect(screen.getByText(en.garage.noCarsHint)).toBeInTheDocument();
  });
});
