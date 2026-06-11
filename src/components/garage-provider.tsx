"use client";

import { useEffect } from "react";
import { getGarageDataAction } from "@/actions/garage";
import { useGarageStore } from "@/stores/garage";

export function GarageProvider({ children }: { children: React.ReactNode }) {
  const setAll = useGarageStore((s) => s.setAll);
  const setIsServerSyncing = useGarageStore((s) => s.setIsServerSyncing);

  useEffect(() => {
    let cancelled = false;
    getGarageDataAction()
      .then((result) => {
        if (!cancelled && result?.data) setAll(result.data);
      })
      .catch(() => {
        // offline — keep the persisted cached data
      })
      .finally(() => {
        if (!cancelled) setIsServerSyncing(false);
      });
    const onOnline = () => {
      getGarageDataAction()
        .then((result) => {
          if (!cancelled && result?.data) setAll(result.data);
        })
        .catch(() => {});
      // No isServerSyncing change on reconnect — that's a silent background refresh.
    };
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
    };
  }, [setAll, setIsServerSyncing]);

  return <>{children}</>;
}
