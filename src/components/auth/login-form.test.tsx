import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";

// vi.mock factories are hoisted above imports — anything they capture
// must come from vi.hoisted, or it is "accessed before initialization".
const { loginWithGoogleAction } = vi.hoisted(() => ({
  loginWithGoogleAction: vi.fn(async () => {}),
}));

vi.mock("@/actions/auth", () => ({ loginWithGoogleAction }));

import { LoginForm } from "./login-form";

afterEach(() => {
  cleanup();
  loginWithGoogleAction.mockClear();
});

function renderForm(error = false) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <LoginForm error={error} />
    </NextIntlClientProvider>,
  );
}

describe("LoginForm", () => {
  it("invokes the Google sign-in action on submit", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    await waitFor(() => expect(loginWithGoogleAction).toHaveBeenCalled());
  });

  it("shows a generic error when redirected back with an error param", () => {
    renderForm(true);
    expect(
      screen.getByText("Google sign-in failed. Please try again."),
    ).toBeInTheDocument();
  });

  it("shows no error by default", () => {
    renderForm();
    expect(
      screen.queryByText("Google sign-in failed. Please try again."),
    ).not.toBeInTheDocument();
  });
});
