"use client";

import type { ReactNode } from "react";
import { CircleAlert, RefreshCw } from "lucide-react";
import { LogoLoader } from "@/components/ui/Logo";
import { useCatalogue, type Catalogue } from "@/hooks/use-catalogue";
import { useHydrated } from "@/hooks/use-persistent";
import { useI18n } from "@/hooks/use-i18n";

/** Renders its children once the car catalogue is loaded, with loading and error states. */
export function CatalogueGate({ children }: { children: (catalogue: Catalogue) => ReactNode }) {
  const hydrated = useHydrated();
  const state = useCatalogue();
  const { t } = useI18n();

  if (!hydrated || state.status === "loading") return <LogoLoader label={t.catalogue.loading} />;
  if (state.status === "error") {
    return (
      <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 pt-12 text-center">
        <CircleAlert className="size-10 text-warning" aria-hidden="true" />
        <p>{t.catalogue.error}</p>
        <button type="button" className="btn btn-primary" onClick={state.retry}>
          <RefreshCw className="size-4" aria-hidden="true" />
          {t.catalogue.retry}
        </button>
      </div>
    );
  }
  return <>{children(state.catalogue)}</>;
}
