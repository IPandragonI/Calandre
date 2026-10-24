"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BatteryCharging,
  Car as CarIcon,
  Crown,
  Flag,
  Gauge,
  Gem,
  Globe2,
  Hourglass,
  Lightbulb,
  MapPin,
  Mountain,
  Search,
  Star,
  Sun,
  Zap,
} from "lucide-react";
import type { Car } from "@/types/car";
import { availableCategories, availableMakes, ORIGIN_CATEGORIES, STYLE_CATEGORIES, type CategoryId } from "@/lib/game/categories";
import { playHref } from "@/lib/game/routes";
import { CatalogueGate } from "@/components/ui/CatalogueGate";
import { useStatistics } from "@/hooks/use-persistent";
import { useI18n } from "@/hooks/use-i18n";

const ICONS: Record<CategoryId, typeof CarIcon> = {
  european: Globe2,
  france: MapPin,
  germany: MapPin,
  italy: MapPin,
  uk: MapPin,
  sweden: MapPin,
  japanese: Sun,
  american: Star,
  korean: MapPin,
  chinese: MapPin,
  supercar: Gauge,
  sports: Zap,
  "hot-hatch": Zap,
  luxury: Crown,
  classic: Hourglass,
  electric: BatteryCharging,
  racing: Flag,
  suv: Mountain,
  everyday: CarIcon,
  concept: Lightbulb,
  rare: Gem,
};

export function CategoryPicker() {
  const { t } = useI18n();
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-6 sm:pt-10">
      <header className="flex flex-col gap-2">
        <p className="eyebrow">{t.modes.category.name}</p>
        <h1 className="font-display text-3xl sm:text-4xl">{t.categories.title}</h1>
        <p className="text-base-content/75">{t.categories.lead}</p>
      </header>
      <CatalogueGate>{({ cars }) => <Sections cars={cars} />}</CatalogueGate>
    </div>
  );
}

function Sections({ cars }: { cars: readonly Car[] }) {
  const { t, percent } = useI18n();
  const stats = useStatistics();
  const origins = useMemo(() => availableCategories(cars, ORIGIN_CATEGORIES), [cars]);
  const styles = useMemo(() => availableCategories(cars, STYLE_CATEGORIES), [cars]);
  const makes = useMemo(() => availableMakes(cars), [cars]);
  const [query, setQuery] = useState("");
  const filteredMakes = makes.filter((m) => m.make.toLowerCase().includes(query.trim().toLowerCase()));

  const categoryCard = ({ id, count }: { id: CategoryId; count: number }) => {
    const Icon = ICONS[id];
    const plays = stats.categoryPlays[id] ?? 0;
    const tally = stats.categoryResults[id];
    return (
      <li key={id}>
        <Link
          href={playHref({ mode: "category", category: id })}
          className="flex h-full items-center gap-3 rounded-box border border-base-content/10 bg-base-100 p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-field bg-primary/10 text-primary">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="font-wide font-bold">{t.categories.names[id]}</span>
            <span className="text-sm text-base-content/70">
              {t.categories.count(count)}
              {plays > 0 && ` · ${t.categories.played(plays)}`}
              {tally && tally.seen > 0 && ` · ${percent(tally.correct / tally.seen)}`}
            </span>
          </span>
        </Link>
      </li>
    );
  };

  return (
    <>
      <section aria-labelledby="origins-title" className="flex flex-col gap-3">
        <h2 id="origins-title" className="eyebrow">
          {t.categories.origins}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{origins.map(categoryCard)}</ul>
      </section>

      <section aria-labelledby="styles-title" className="flex flex-col gap-3">
        <h2 id="styles-title" className="eyebrow">
          {t.categories.styles}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{styles.map(categoryCard)}</ul>
      </section>

      <section aria-labelledby="brands-title" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="brands-title" className="eyebrow">
              {t.categories.brands}
            </h2>
            <p className="text-sm text-base-content/70">{t.categories.brandsLead}</p>
          </div>
          <label className="input input-sm w-full sm:w-64">
            <Search className="size-4 opacity-60" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.categories.searchBrand}
              aria-label={t.categories.searchBrand}
            />
          </label>
        </div>
        {filteredMakes.length === 0 ? (
          <p className="text-sm text-base-content/70">{t.categories.noBrand}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {filteredMakes.map(({ make, count }) => (
              <li key={make}>
                <Link
                  href={playHref({ mode: "category", make })}
                  aria-label={t.categories.brandChallenge(make)}
                  className="flex h-full min-h-11 flex-col justify-center rounded-field border border-base-content/10 bg-base-100 px-3 py-2 transition hover:border-primary/40 hover:bg-base-200/60"
                >
                  <span className="truncate font-semibold">{make}</span>
                  <span className="text-xs text-base-content/60 tabular-nums">{t.categories.count(count)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
