"use client";

import { useEffect } from "react";

export function SplashRemover() {
  useEffect(() => {
    const el = document.getElementById("app-splash");
    if (!el) return;
    el.style.opacity = "0";
    el.style.pointerEvents = "none";
    // The splash div is a React-rendered node (root layout), so it must never
    // be detached outside React: the body fiber would still list it as a child
    // and the next route transition would crash with insertBefore/removeChild
    // NotFoundError. Hide it instead of removing it.
    const hide = () => { el.style.display = "none"; };
    const tid = setTimeout(hide, 400);
    const handler = () => { clearTimeout(tid); hide(); };
    el.addEventListener("transitionend", handler, { once: true });
    return () => { clearTimeout(tid); el.removeEventListener("transitionend", handler); };
  }, []);
  return null;
}
