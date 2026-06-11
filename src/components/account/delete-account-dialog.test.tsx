import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";

const { execute, clearStorage } = vi.hoisted(() => ({
  execute: vi.fn(),
  clearStorage: vi.fn(),
}));

vi.mock("@/actions/auth", () => ({ deleteAccountAction: "deleteAccountAction" }));

vi.mock("next-safe-action/hooks", () => ({
  useAction: () => ({ execute, result: {}, isExecuting: false }),
}));

vi.mock("@/stores/garage", () => ({
  useGarageStore: { persist: { clearStorage } },
}));

import { DeleteAccountDialog } from "./delete-account-dialog";

afterEach(cleanup);
beforeEach(() => {
  execute.mockClear();
  clearStorage.mockClear();
});

function openDialog() {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <DeleteAccountDialog />
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
}

function confirmButton() {
  // The dialog's destructive confirm button (the trigger has the same name).
  const buttons = screen.getAllByRole("button", { name: "Delete account" });
  return buttons[buttons.length - 1];
}

describe("DeleteAccountDialog", () => {
  it("keeps the confirm button disabled until the word is typed", () => {
    openDialog();
    expect(confirmButton()).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), {
      target: { value: "DELET" },
    });
    expect(confirmButton()).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), {
      target: { value: "DELETE" },
    });
    expect(confirmButton()).not.toBeDisabled();
  });

  it("accepts the word case-insensitively and with surrounding spaces", () => {
    openDialog();

    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), {
      target: { value: "delete" },
    });
    expect(confirmButton()).not.toBeDisabled();

    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), {
      target: { value: " Delete " },
    });
    expect(confirmButton()).not.toBeDisabled();
  });

  it("clears the persisted store and executes the action on confirm", () => {
    openDialog();
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), {
      target: { value: "DELETE" },
    });
    fireEvent.click(confirmButton());
    expect(clearStorage).toHaveBeenCalled();
    expect(execute).toHaveBeenCalled();
  });

  it("does not execute when the word does not match", () => {
    openDialog();
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), {
      target: { value: "nope" },
    });
    fireEvent.click(confirmButton());
    expect(execute).not.toHaveBeenCalled();
  });
});
