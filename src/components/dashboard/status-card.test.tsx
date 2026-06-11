import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import { StatusCard } from "./status-card";

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
});
