import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import { MileageForm } from "./mileage-form";

afterEach(cleanup);

function renderForm(onSubmit: (mileage: number) => void) {
  const { container } = render(
    <NextIntlClientProvider locale="en" messages={en}>
      <MileageForm currentMileage={120000} onSubmit={onSubmit} />
    </NextIntlClientProvider>,
  );
  return within(container);
}

describe("MileageForm", () => {
  it("submits the entered mileage", () => {
    const onSubmit = vi.fn();
    const view = renderForm(onSubmit);
    fireEvent.change(view.getByRole("spinbutton"), { target: { value: "121500" } });
    fireEvent.click(view.getByRole("button", { name: "Update" }));
    expect(onSubmit).toHaveBeenCalledWith(121500);
  });

  it("does not submit an empty value", () => {
    const onSubmit = vi.fn();
    const view = renderForm(onSubmit);
    fireEvent.change(view.getByRole("spinbutton"), { target: { value: "" } });
    fireEvent.click(view.getByRole("button", { name: "Update" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
