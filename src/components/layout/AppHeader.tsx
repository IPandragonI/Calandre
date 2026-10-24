"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Moon, Settings, Sun } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { useI18n } from "@/hooks/use-i18n";
import { updateSettings, useSettings } from "@/hooks/use-persistent";

export function AppHeader() {
  const { t, locale } = useI18n();
  const { theme } = useSettings();
  const pathname = usePathname();

  const navLink = (href: "/stats" | "/settings", label: string, Icon: typeof Settings) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`btn btn-ghost btn-square min-h-11 min-w-11 sm:w-auto sm:px-3 ${active ? "bg-base-200" : ""}`}
      >
        <Icon className="size-5" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only sm:text-sm">{label}</span>
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-30 bg-base-100/90 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-base-100/75">
      <a href="#content" className="btn btn-sm sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50">
        {t.nav.skipToContent}
      </a>
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4">
        <Link href="/" aria-label={t.nav.home} className="-ml-1 rounded-field px-1 py-1">
          <Logo />
        </Link>
        <nav aria-label={t.nav.mainLabel} className="flex items-center gap-0.5">
          {navLink("/stats", t.nav.stats, BarChart3)}
          {navLink("/settings", t.nav.settings, Settings)}
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
            className="btn btn-ghost btn-square min-h-11 min-w-11 text-sm font-bold font-wide"
            onClick={() => updateSettings({ locale: locale === "fr" ? "en" : "fr" })}
            aria-label={locale === "fr" ? "Switch to English" : "Passer en français"}
            lang={locale === "fr" ? "en" : "fr"}
          >
            {locale === "fr" ? "EN" : "FR"}
          </button>
        </nav>
      </div>
      <div className="livery" aria-hidden="true" />
    </header>
  );
}
