"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/hooks/use-i18n";
import { NAV_ITEMS } from "./nav-items";

/** Phone navigation, within thumb reach. Hidden while playing so the game keeps the screen. */
export function TabBar() {
  const { t } = useI18n();
  const pathname = usePathname();
  if (pathname.startsWith("/play")) return null;

  return (
    <nav
      aria-label={t.nav.mainLabel}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-base-content/10 bg-base-100/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.68rem] font-medium transition-colors ${
                  active ? "text-primary" : "text-base-content/65"
                }`}
              >
                <Icon className="size-5" aria-hidden="true" />
                {label(t)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
