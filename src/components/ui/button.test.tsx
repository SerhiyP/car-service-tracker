import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { Button } from "./button";

afterEach(cleanup);

it("is disabled and renders a spinner svg when loading", () => {
  render(<Button loading>Save</Button>);
  const btn = screen.getByRole("button");
  expect(btn).toBeDisabled();
  expect(btn.querySelector("svg")).toBeTruthy();
});

it("is not disabled and renders no extra svg when not loading", () => {
  render(<Button>Save</Button>);
  const btn = screen.getByRole("button");
  expect(btn).not.toBeDisabled();
  expect(btn.querySelector("svg")).toBeFalsy();
});

it("stays disabled when both disabled and loading are true", () => {
  render(<Button loading disabled>Save</Button>);
  expect(screen.getByRole("button")).toBeDisabled();
});
