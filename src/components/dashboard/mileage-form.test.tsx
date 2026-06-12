import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import { MileageForm } from "./mileage-form";

afterEach(cleanup);

function renderForm(onSubmit: (mileage: number) => Promise<boolean>) {
  const { container } = render(
    <NextIntlClientProvider locale="en" timeZone="UTC" messages={en}>
      <MileageForm currentMileage={120000} onSubmit={onSubmit} />
    </NextIntlClientProvider>,
  );
  return within(container);
}

function expand(view: ReturnType<typeof within>) {
  fireEvent.click(view.getByRole("button", { name: "Edit" }));
}

describe("MileageForm", () => {
  it("is collapsed by default, showing the formatted mileage", () => {
    const view = renderForm(vi.fn().mockResolvedValue(true));
    expect(view.getByText("120,000 km")).toBeInTheDocument();
    expect(view.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("expands on edit with the current value focused", () => {
    const view = renderForm(vi.fn().mockResolvedValue(true));
    expand(view);
    const input = view.getByRole("spinbutton");
    expect(input).toHaveValue(120000);
    expect(input).toHaveFocus();
  });

  it("submits the entered mileage and collapses", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    const view = renderForm(onSubmit);
    expand(view);
    fireEvent.change(view.getByRole("spinbutton"), { target: { value: "121500" } });
    fireEvent.click(view.getByRole("button", { name: "Update" }));
    expect(onSubmit).toHaveBeenCalledWith(121500);
    await waitFor(() => expect(view.queryByRole("spinbutton")).not.toBeInTheDocument());
  });

  it("stays expanded when the update fails", async () => {
    const onSubmit = vi.fn().mockResolvedValue(false);
    const view = renderForm(onSubmit);
    expand(view);
    fireEvent.change(view.getByRole("spinbutton"), { target: { value: "121500" } });
    fireEvent.click(view.getByRole("button", { name: "Update" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(view.getByRole("spinbutton")).toBeInTheDocument();
    expect(view.getByRole("spinbutton")).toHaveValue(121500);
  });

  it("does not submit an empty value and stays expanded", () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    const view = renderForm(onSubmit);
    expand(view);
    fireEvent.change(view.getByRole("spinbutton"), { target: { value: "" } });
    fireEvent.click(view.getByRole("button", { name: "Update" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(view.getByRole("spinbutton")).toBeInTheDocument();
  });

  it("collapses without submitting on Escape", () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    const view = renderForm(onSubmit);
    expand(view);
    fireEvent.keyDown(view.getByRole("spinbutton"), { key: "Escape" });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(view.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("resets the expanded input when currentMileage changes externally", () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    const { rerender, container } = render(
      <NextIntlClientProvider locale="en" timeZone="UTC" messages={en}>
        <MileageForm currentMileage={120000} onSubmit={onSubmit} />
      </NextIntlClientProvider>,
    );
    const view = within(container);
    expand(view);
    rerender(
      <NextIntlClientProvider locale="en" timeZone="UTC" messages={en}>
        <MileageForm currentMileage={125000} onSubmit={onSubmit} />
      </NextIntlClientProvider>,
    );
    expect(view.getByRole("spinbutton")).toHaveValue(125000);
  });

  it("ignores Escape while a submit is pending", async () => {
    const onSubmit = vi.fn(() => new Promise<boolean>(() => {}));
    const view = renderForm(onSubmit);
    expand(view);
    fireEvent.change(view.getByRole("spinbutton"), { target: { value: "121500" } });
    fireEvent.click(view.getByRole("button", { name: "Update" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    fireEvent.keyDown(view.getByRole("spinbutton"), { key: "Escape" });
    expect(view.getByRole("spinbutton")).toBeInTheDocument();
  });
});
