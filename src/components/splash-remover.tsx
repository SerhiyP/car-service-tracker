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
    el.addEventListener("transitionend", () => { clearTimeout(tid); remove(); }, { once: true });
    return () => { clearTimeout(tid); };
  }, []);
  return null;
}
