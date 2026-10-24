"use client";

import Link from "next/link";
import { BatteryCharging, Car, Flag, Gauge, Gem, Globe2, Hourglass, Star, Sun, Zap } from "lucide-react";
import { CARS } from "@/lib/data/dataset";
import { availableCategories, type CategoryId } from "@/lib/game/categories";
import { playHref } from "@/lib/game/routes";
import { useHydrated, useStatistics } from "@/hooks/use-persistent";
import { useI18n } from "@/hooks/use-i18n";

const ICONS: Record<CategoryId, typeof Car> = {
  european: Globe2,
  japanese: Sun,
  american: Star,
  supercar: Gauge,
  sports: Zap,
  classic: Hourglass,
  electric: BatteryCharging,
  racing: Flag,
  everyday: Car,
  rare: Gem,
};

/** Only categories with enough cars in the dataset are offered. */
const CATEGORIES = availableCategories(CARS);

export function CategoryPicker() {
  const { t, percent } = useI18n();
  const stats = useStatistics();
  const hydrated = useHydrated();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pt-6 sm:pt-10">
      <header className="flex flex-col gap-2">
        <p className="eyebrow">{t.modes.category.name}</p>
        <h1 className="font-display text-3xl sm:text-4xl">{t.categories.title}</h1>
        <p className="text-base-content/75">{t.categories.lead}</p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map(({ id, count }) => {
          const Icon = ICONS[id];
          const plays = stats.categoryPlays[id] ?? 0;
          const tally = stats.categoryResults[id];
          return (
            <li key={id}>
              <Link
                href={playHref({ mode: "category", category: id })}
                className="flex h-full items-center gap-4 rounded-box border border-base-content/10 bg-base-100 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-field bg-primary/10 text-primary">
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="font-wide text-lg font-bold">{t.categories.names[id]}</span>
                  <span className="text-sm text-base-content/70">
                    {t.categories.count(count)}
                    {hydrated && plays > 0 && ` · ${t.categories.played(plays)}`}
                    {hydrated && tally && tally.seen > 0 && ` · ${percent(tally.correct / tally.seen)}`}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
