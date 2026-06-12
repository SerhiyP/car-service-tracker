import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SplashRemover } from "./splash-remover";

describe("SplashRemover", () => {
  afterEach(() => {
    document.getElementById("app-splash")?.remove();
  });

  it("hides the splash without detaching it from the DOM", () => {
    const splash = document.createElement("div");
    splash.id = "app-splash";
    document.body.appendChild(splash);

    render(<SplashRemover />);
    splash.dispatchEvent(new Event("transitionend"));

    // The splash div is rendered by React (root layout). Detaching it outside
    // React desyncs the body fiber's child list and the next route transition
    // throws insertBefore/removeChild NotFoundError — so it must stay connected.
    expect(splash.isConnected).toBe(true);
    expect(splash.style.opacity).toBe("0");
    expect(splash.style.display).toBe("none");
  });
});
