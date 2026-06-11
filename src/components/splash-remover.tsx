"use client";

import { useEffect } from "react";

export function SplashRemover() {
  useEffect(() => {
    const el = document.getElementById("app-splash");
    if (!el) return;
    el.style.opacity = "0";
    const remove = () => el.remove();
    el.addEventListener("transitionend", remove, { once: true });
    return () => el.removeEventListener("transitionend", remove);
  }, []);
  return null;
}
