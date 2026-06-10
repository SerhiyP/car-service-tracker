"use client";

import { useEffect } from "react";
import { getGarageDataAction } from "@/actions/garage";
import { useGarageStore } from "@/stores/garage";

export function GarageProvider({ children }: { children: React.ReactNode }) {
  const setAll = useGarageStore((s) => s.setAll);

  useEffect(() => {
    let cancelled = false;
    getGarageDataAction().then((result) => {
      if (!cancelled && result?.data) setAll(result.data);
    });
    const onOnline = () => {
      getGarageDataAction().then((result) => {
        if (!cancelled && result?.data) setAll(result.data);
      });
    };
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
    };
  }, [setAll]);

  return <>{children}</>;
}
