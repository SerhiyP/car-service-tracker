import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import { StatusCard } from "./status-card";

afterEach(cleanup);

function renderCard(props: Parameters<typeof StatusCard>[0]) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <StatusCard {...props} />
    </NextIntlClientProvider>,
  );
}

describe("StatusCard", () => {
  it("shows remaining km and days for a green component", () => {
    renderCard({
      componentName: "Engine Oil",
      info: { status: "green", remainingKm: 8000, remainingDays: 120 },
      lastService: null,
      onLogService: () => {},
    });
    expect(screen.getByText("Engine Oil")).toBeInTheDocument();
    expect(screen.getByText(/8[,\s.]?000 km left/)).toBeInTheDocument();
    expect(screen.getByText(/120 days left/)).toBeInTheDocument();
  });

  it("shows never-serviced for red with no history", () => {
    renderCard({
      componentName: "Cabin Filter",
      info: { status: "red", remainingKm: null, remainingDays: null },
      lastService: null,
      onLogService: () => {},
    });
    expect(screen.getByText("Never serviced")).toBeInTheDocument();
  });

  it("shows overdue wording for negative remaining km", () => {
    renderCard({
      componentName: "Brakes",
      info: { status: "red", remainingKm: -500, remainingDays: null },
      lastService: null,
      onLogService: () => {},
    });
    expect(screen.getByText(/500 km overdue/)).toBeInTheDocument();
  });

  it("shows the OK pill for a green component", () => {
    renderCard({
      componentName: "Engine Oil",
      info: { status: "green", remainingKm: 8000, remainingDays: 120 },
      lastService: null,
      onLogService: () => {},
    });
    expect(screen.getByText("OK")).toBeInTheDocument();
  });

  it("shows the Overdue pill for a red component", () => {
    renderCard({
      componentName: "Brakes",
      info: { status: "red", remainingKm: -500, remainingDays: null },
      lastService: null,
      onLogService: () => {},
    });
    expect(screen.getByText("Overdue")).toBeInTheDocument();
  });

  it("shows the Due soon pill for a yellow component", () => {
    renderCard({
      componentName: "Air Filter",
      info: { status: "yellow", remainingKm: 500, remainingDays: 10 },
      lastService: null,
      onLogService: () => {},
    });
    expect(screen.getByText("Due soon")).toBeInTheDocument();
  });
});
