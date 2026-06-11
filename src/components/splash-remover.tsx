"use client";

import { useEffect } from "react";

export function SplashRemover() {
  useEffect(() => {
    const el = document.getElementById("app-splash");
    if (!el) return;
    el.style.opacity = "0";
    el.style.pointerEvents = "none";
    const remove = () => el.remove();
    const tid = setTimeout(remove, 400);
    const handler = () => { clearTimeout(tid); remove(); };
    el.addEventListener("transitionend", handler, { once: true });
    return () => { clearTimeout(tid); el.removeEventListener("transitionend", handler); };
  }, []);
  return null;
}
