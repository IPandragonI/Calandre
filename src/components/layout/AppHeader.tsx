"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { useI18n } from "@/hooks/use-i18n";
import { updateSettings, useSettings } from "@/hooks/use-persistent";
import { NAV_ITEMS } from "./nav-items";

export function AppHeader() {
  const { t, locale } = useI18n();
  const { theme } = useSettings();

  return (
    <header className="sticky top-0 z-30 border-b border-base-content/10 bg-base-100/90 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-base-100/80">
      <a href="#content" className="btn btn-sm sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50">
        {t.nav.skipToContent}
      </a>
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4">
        <Link href="/" aria-label={t.nav.home} className="-ml-1 rounded-field px-1 py-1">
          <Logo />
        </Link>
        <nav aria-label={t.nav.mainLabel} className="flex items-center gap-0.5">
          {/* The current path is request data: the links render first, the highlight follows. */}
          <Suspense fallback={<HeaderLinks pathname={null} />}>
            <ActiveHeaderLinks />
          </Suspense>
          <button
            type="button"
            className="btn btn-ghost btn-square min-h-11 min-w-11"
            onClick={() => updateSettings({ theme: theme === "dark" ? "light" : "dark" })}
            aria-label={`${t.settings.theme} : ${theme === "dark" ? t.settings.light : t.settings.dark}`}
          >
            {theme === "dark" ? <Sun className="size-5" aria-hidden="true" /> : <Moon className="size-5" aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-square min-h-11 min-w-11 text-xs font-semibold tracking-wide"
            onClick={() => updateSettings({ locale: locale === "fr" ? "en" : "fr" })}
            aria-label={locale === "fr" ? "Switch to English" : "Passer en français"}
            lang={locale === "fr" ? "en" : "fr"}
          >
            {locale === "fr" ? "EN" : "FR"}
          </button>
        </nav>
      </div>
    </header>
  );
}

function ActiveHeaderLinks() {
  return <HeaderLinks pathname={usePathname()} />;
}

/** Desktop navigation links (on phones they live in the bottom tab bar). */
function HeaderLinks({ pathname }: { pathname: string | null }) {
  const { t } = useI18n();
  return (
    <div className="hidden items-center gap-0.5 md:flex">
      {NAV_ITEMS.filter((item) => item.href !== "/").map(({ href, label }) => {
        const active = pathname !== null && (pathname === href || pathname.startsWith(`${href}/`));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`btn btn-ghost min-h-11 px-3 text-sm font-medium decoration-primary decoration-2 underline-offset-[0.6rem] ${active ? "bg-transparent! text-base-content underline" : "text-base-content/65"}`}
          >
            {label(t)}
          </Link>
        );
      })}
    </div>
  );
}
