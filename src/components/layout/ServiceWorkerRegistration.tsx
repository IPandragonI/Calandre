"use client";

import { useEffect } from "react";
import { captureInstallPrompt } from "@/hooks/use-install-prompt";

/** Registers the offline service worker (production builds only, so dev stays uncached). */
export function ServiceWorkerRegistration() {
  useEffect(() => captureInstallPrompt(), []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}
