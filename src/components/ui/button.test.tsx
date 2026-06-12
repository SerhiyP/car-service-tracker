import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { Button } from "./button";

afterEach(cleanup);

it("is disabled, aria-busy, and renders an animate-spin svg when loading", () => {
  render(<Button loading>Save</Button>);
  const btn = screen.getByRole("button");
  expect(btn).toBeDisabled();
  expect(btn).toHaveAttribute("aria-busy", "true");
  const svg = btn.querySelector("svg");
  expect(svg).toBeTruthy();
  expect(svg?.classList.contains("animate-spin")).toBe(true);
});

it("is not disabled, not aria-busy, and renders no extra svg when not loading", () => {
  render(<Button>Save</Button>);
  const btn = screen.getByRole("button");
  expect(btn).not.toBeDisabled();
  expect(btn).not.toHaveAttribute("aria-busy");
  expect(btn.querySelector("svg")).toBeFalsy();
});

it("stays disabled when both disabled and loading are true", () => {
  render(<Button loading disabled>Save</Button>);
  expect(screen.getByRole("button")).toBeDisabled();
});
