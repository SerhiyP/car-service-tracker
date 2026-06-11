import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";

const { nextData, push } = vi.hoisted(() => ({
  nextData: new Map<unknown, unknown>(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/actions/auth", () => ({
  requestPasswordResetAction: "requestPasswordResetAction",
  resetPasswordAction: "resetPasswordAction",
}));

vi.mock("next-safe-action/hooks", () => ({
  useAction: (
    action: unknown,
    opts?: {
      onSuccess?: (args: { data: unknown }) => void;
      onError?: (args: { error: unknown }) => void;
    },
  ) => ({
    execute: () => {
      const preset = nextData.get(action) as { error?: unknown } | undefined;
      if (preset && typeof preset === "object" && "error" in preset) {
        opts?.onError?.({ error: preset.error });
      } else {
        opts?.onSuccess?.({ data: preset });
      }
    },
    result: {},
    isExecuting: false,
  }),
}));

import { ForgotForm } from "./forgot-form";

afterEach(cleanup);
beforeEach(() => {
  nextData.clear();
  push.mockClear();
});

function renderForm(initialEmail = "user@example.com") {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ForgotForm initialEmail={initialEmail} />
    </NextIntlClientProvider>,
  );
}

function requestCode() {
  fireEvent.click(screen.getByRole("button", { name: "Send code" }));
}

describe("ForgotForm", () => {
  it("starts in the request stage without code or password fields", () => {
    renderForm();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.queryByLabelText("Verification code")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
  });

  it("advances to the reset stage when the code was sent", () => {
    nextData.set("requestPasswordResetAction", { status: "sent", retryAfterSec: 60 });
    renderForm();
    requestCode();
    expect(screen.getByText("A new code was sent")).toBeInTheDocument();
    expect(screen.getByLabelText("Verification code")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resend available in 60s" })).toBeDisabled();
  });

  it("advances to the reset stage on cooldown too (an earlier code may still be valid)", () => {
    nextData.set("requestPasswordResetAction", { status: "cooldown", retryAfterSec: 42 });
    renderForm();
    requestCode();
    expect(screen.getByLabelText("Verification code")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resend available in 42s" })).toBeDisabled();
  });

  it("redirects to login with the reset flag on success", () => {
    nextData.set("requestPasswordResetAction", { status: "sent", retryAfterSec: 60 });
    nextData.set("resetPasswordAction", { status: "reset" });
    renderForm();
    requestCode();
    fireEvent.change(screen.getByLabelText("Verification code"), {
      target: { value: "123456" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "new-password-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Set new password" }));
    expect(push).toHaveBeenCalledWith("/login?reset=1");
  });

  it("shows remaining attempts after a wrong code", () => {
    nextData.set("requestPasswordResetAction", { status: "sent", retryAfterSec: 60 });
    nextData.set("resetPasswordAction", { status: "codeInvalid", attemptsLeft: 2 });
    renderForm();
    requestCode();
    fireEvent.change(screen.getByLabelText("Verification code"), {
      target: { value: "000000" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "new-password-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Set new password" }));
    expect(screen.getByText("Wrong code — 2 attempts left")).toBeInTheDocument();
    expect(screen.getByLabelText("Verification code")).toHaveValue("");
  });

  it("locks the form after too many attempts", () => {
    nextData.set("requestPasswordResetAction", { status: "sent", retryAfterSec: 60 });
    nextData.set("resetPasswordAction", { status: "tooManyAttempts" });
    renderForm();
    requestCode();
    fireEvent.change(screen.getByLabelText("Verification code"), {
      target: { value: "000000" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "new-password-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Set new password" }));
    expect(
      screen.getByText("Too many wrong attempts. Request a new code."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set new password" })).toBeDisabled();
  });

  it("shows a translated server error (unknown email)", () => {
    nextData.set("requestPasswordResetAction", {
      error: { serverError: "auth.emailNotFound" },
    });
    renderForm();
    requestCode();
    expect(screen.getByText("No account with this email")).toBeInTheDocument();
  });
});
