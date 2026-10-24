"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

export function OfflineBanner() {
  const online = useOnline();
  const { t } = useI18n();
  if (online) return null;
  return (
    <div role="status" className="bg-neutral text-neutral-content">
      <p className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-1.5 text-sm">
        <WifiOff className="size-4 shrink-0" aria-hidden="true" />
        {t.offline.banner}
      </p>
    </div>
  );
}
