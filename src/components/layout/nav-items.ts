import { BarChart3, Home, LayoutGrid, Settings, Warehouse } from "lucide-react";
import type { Messages } from "@/lib/i18n";

export interface NavItem {
  href: "/" | "/categories" | "/garage" | "/stats" | "/settings";
  label: (t: Messages) => string;
  Icon: typeof Home;
}

/** Main destinations: header links on desktop, bottom tab bar on phones. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: (t) => t.nav.home, Icon: Home },
  { href: "/categories", label: (t) => t.nav.challenges, Icon: LayoutGrid },
  { href: "/garage", label: (t) => t.nav.garage, Icon: Warehouse },
  { href: "/stats", label: (t) => t.nav.stats, Icon: BarChart3 },
  { href: "/settings", label: (t) => t.nav.settings, Icon: Settings },
];
