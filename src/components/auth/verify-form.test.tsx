import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";

// vi.mock factories are hoisted above imports — anything they capture
// must come from vi.hoisted, or it is "accessed before initialization".
const { nextData, push } = vi.hoisted(() => ({
  nextData: new Map<unknown, unknown>(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

// Action references are only used as map keys by the mocked useAction.
vi.mock("@/actions/auth", () => ({
  verifyEmailAction: "verifyEmailAction",
  resendVerificationCodeAction: "resendVerificationCodeAction",
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

import { VerifyForm } from "./verify-form";

afterEach(cleanup);
beforeEach(() => {
  nextData.clear();
  push.mockClear();
});

function renderForm(initialEmail = "user@example.com") {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <VerifyForm initialEmail={initialEmail} />
    </NextIntlClientProvider>,
  );
}

function submitCode(code: string) {
  fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: code } });
  fireEvent.click(screen.getByRole("button", { name: "Verify" }));
}

describe("VerifyForm", () => {
  it("redirects to login with the verified flag on success", () => {
    nextData.set("verifyEmailAction", { status: "verified" });
    renderForm();
    submitCode("123456");
    expect(push).toHaveBeenCalledWith("/login?verified=1");
  });

  it("shows remaining attempts after a wrong code and clears the input", () => {
    nextData.set("verifyEmailAction", { status: "codeInvalid", attemptsLeft: 3 });
    renderForm();
    submitCode("000000");
    expect(screen.getByText("Wrong code — 3 attempts left")).toBeInTheDocument();
    expect(screen.getByLabelText("Verification code")).toHaveValue("");
  });

  it("locks the form after too many attempts and unlocks on resend", () => {
    nextData.set("verifyEmailAction", { status: "tooManyAttempts" });
    renderForm();
    submitCode("000000");
    expect(
      screen.getByText("Too many wrong attempts. Request a new code."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Verification code")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Verify" })).toBeDisabled();

    nextData.set("resendVerificationCodeAction", { status: "sent", retryAfterSec: 60 });
    fireEvent.click(screen.getByRole("button", { name: "Resend code" }));
    expect(screen.getByLabelText("Verification code")).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Verify" })).not.toBeDisabled();
    expect(screen.getByText("A new code was sent")).toBeInTheDocument();
  });

  it("locks the form when the code expired", () => {
    nextData.set("verifyEmailAction", { status: "codeExpired" });
    renderForm();
    submitCode("123456");
    expect(screen.getByText("This code has expired. Request a new code.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verify" })).toBeDisabled();
  });

  it("locks the form when there is no active code", () => {
    nextData.set("verifyEmailAction", { status: "noActiveCode" });
    renderForm();
    submitCode("123456");
    expect(
      screen.getByText("No active code for this email. Request a new one."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verify" })).toBeDisabled();
  });

  it("editing the email clears the locked state", () => {
    nextData.set("verifyEmailAction", { status: "noActiveCode" });
    renderForm();
    submitCode("123456");
    expect(screen.getByRole("button", { name: "Verify" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "other@example.com" },
    });
    expect(screen.getByRole("button", { name: "Verify" })).not.toBeDisabled();
  });

  it("shows a disabled countdown when the server reports a cooldown", () => {
    nextData.set("resendVerificationCodeAction", { status: "cooldown", retryAfterSec: 42 });
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Resend code" }));
    expect(screen.getByRole("button", { name: "Resend available in 42s" })).toBeDisabled();
  });

  it("redirects to login when the account is already verified", () => {
    nextData.set("resendVerificationCodeAction", { status: "alreadyVerified" });
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Resend code" }));
    expect(push).toHaveBeenCalledWith("/login?verified=1");
  });

  it("shows a translated server error from the error path", () => {
    nextData.set("verifyEmailAction", { error: { serverError: "errors.server" } });
    renderForm();
    submitCode("123456");
    expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument();
  });
});
