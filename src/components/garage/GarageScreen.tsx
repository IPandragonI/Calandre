"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Play, RotateCcw, Search } from "lucide-react";
import type { Car } from "@/types/car";
import { carName, formatYears, thumbnailUrl } from "@/lib/data/dataset";
import { normalizeAnswer } from "@/lib/game/answer-validation";
import { carInCategory, STYLE_CATEGORIES, type CategoryId } from "@/lib/game/categories";
import { CatalogueGate } from "@/components/ui/CatalogueGate";
import { LogoMark } from "@/components/ui/Logo";
import { useStatistics } from "@/hooks/use-persistent";
import { useI18n } from "@/hooks/use-i18n";

const PAGE = 48;
const SORTS = ["recent", "name", "make", "oldest", "newest", "body"] as const;
type Sort = (typeof SORTS)[number];
type Scope = "mine" | "all";

const decadeOf = (car: Car) => (car.years ? Math.floor(car.years.from / 10) * 10 : null);

/** The player's collection (or the whole catalogue), with search, filters and sorting. */
export function GarageScreen() {
  const { t } = useI18n();
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-6 sm:pt-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-2xl sm:text-3xl">{t.garage.title}</h1>
        <p className="text-base-content/75">{t.garage.lead}</p>
      </header>
      <CatalogueGate>{({ cars }) => <Garage cars={cars} />}</CatalogueGate>
    </div>
  );
}

function Garage({ cars }: { cars: readonly Car[] }) {
  const { t, number, locale } = useI18n();
  const { collection } = useStatistics();
  const [scope, setScope] = useState<Scope>("mine");
  const [query, setQuery] = useState("");
  const [make, setMake] = useState("");
  const [category, setCategory] = useState<CategoryId | "">("");
  const [decade, setDecade] = useState<number | "">("");
  const [sort, setSort] = useState<Sort>("recent");
  const [limit, setLimit] = useState(PAGE);

  const found = useMemo(() => cars.filter((car) => collection[car.id]), [cars, collection]);
  const pool = scope === "mine" ? found : cars;

  // Only offer filter values that exist in the current scope.
  const makes = useMemo(() => [...new Set(pool.map((c) => c.make))].sort((a, b) => a.localeCompare(b)), [pool]);
  const categories = useMemo(() => STYLE_CATEGORIES.filter((id) => pool.some((c) => carInCategory(c, id))), [pool]);
  const decades = useMemo(
    () => [...new Set(pool.map(decadeOf).filter((d): d is number => d !== null))].sort((a, b) => a - b),
    [pool],
  );
  const sorts = SORTS.filter((s) => (s === "recent" ? scope === "mine" : s === "oldest" || s === "newest" ? decades.length > 0 : true));
  const activeSort = sorts.includes(sort) ? sort : "name";

  const needle = normalizeAnswer(query);
  const matches = useMemo(() => {
    const list = pool.filter(
      (car) =>
        (!make || car.make === make) &&
        (!category || carInCategory(car, category)) &&
        (decade === "" || decadeOf(car) === decade) &&
        (!needle || normalizeAnswer([carName(car), ...car.acceptedAnswers].join(" ")).includes(needle)),
    );
    const byName = (a: Car, b: Car) => carName(a).localeCompare(carName(b), locale);
    // Cars without years go last whatever the direction.
    const byYear = (dir: 1 | -1) => (a: Car, b: Car) =>
      (a.years ? 0 : 1) - (b.years ? 0 : 1) || dir * ((a.years?.from ?? 0) - (b.years?.from ?? 0)) || byName(a, b);
    const compare: Record<Sort, (a: Car, b: Car) => number> = {
      recent: (a, b) => (collection[b.id] ?? "").localeCompare(collection[a.id] ?? "") || byName(a, b),
      name: byName,
      make: (a, b) => a.make.localeCompare(b.make, locale) || byName(a, b),
      oldest: byYear(1),
      newest: byYear(-1),
      body: (a, b) =>
        (a.bodyType ? 0 : 1) - (b.bodyType ? 0 : 1) ||
        (a.bodyType && b.bodyType ? t.bodyTypeNames[a.bodyType].localeCompare(t.bodyTypeNames[b.bodyType], locale) : 0) ||
        byName(a, b),
    };
    return [...list].sort(compare[activeSort]);
  }, [pool, make, category, decade, needle, activeSort, collection, locale, t]);
  const shown = matches.slice(0, limit);

  const filtered = Boolean(query || make || category || decade !== "" || sort !== "recent");
  const reset = () => {
    setQuery("");
    setMake("");
    setCategory("");
    setDecade("");
    setSort("recent");
    setLimit(PAGE);
  };
  const update = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setLimit(PAGE);
  };
  const ratio = cars.length > 0 ? found.length / cars.length : 0;

  return (
    <>
      <section className="flex flex-col gap-3 surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2">
          <p className="font-display text-lg tabular-nums">{t.garage.progress(number(found.length), number(cars.length))}</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-base-300" aria-hidden="true">
            <div className="h-full rounded-full bg-base-content/70" style={{ width: `${Math.max(ratio * 100, found.length > 0 ? 1 : 0)}%` }} />
          </div>
        </div>
        <div role="radiogroup" aria-label={t.garage.title} className="join self-start sm:self-center">
          {(["mine", "all"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={scope === value}
              onClick={() => update(setScope)(value)}
              className={`join-item btn btn-sm min-h-11 font-medium ${scope === value ? "border-neutral bg-neutral text-neutral-content" : "border-base-content/15 bg-base-100"}`}
            >
              {value === "mine" ? t.garage.scopeMine : t.garage.scopeAll}
            </button>
          ))}
        </div>
      </section>

      {scope === "mine" && found.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-box border border-dashed border-base-content/15 p-8 text-center">
          <LogoMark className="h-14 w-20 text-base-content/40" />
          <p>{t.garage.empty}</p>
          <Link href="/play?mode=classic" className="btn btn-primary">
            <Play className="size-4" aria-hidden="true" />
            {t.home.play}
          </Link>
        </div>
      ) : (
        <>
          <section aria-label={t.garage.filters} className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))]">
              <label className="input col-span-2 w-full lg:col-span-1">
                <Search className="size-4 opacity-60" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => update(setQuery)(e.target.value)}
                  placeholder={t.garage.search}
                  aria-label={t.garage.search}
                />
              </label>
              <select className="select w-full" value={make} onChange={(e) => update(setMake)(e.target.value)} aria-label={t.garage.allMakes}>
                <option value="">{t.garage.allMakes}</option>
                {makes.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                className="select w-full"
                value={category}
                onChange={(e) => update(setCategory)(e.target.value as CategoryId | "")}
                aria-label={t.garage.allCategories}
              >
                <option value="">{t.garage.allCategories}</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {t.categories.names[c]}
                  </option>
                ))}
              </select>
              {decades.length > 0 && (
                <select
                  className="select w-full"
                  value={decade}
                  onChange={(e) => update(setDecade)(e.target.value === "" ? "" : Number(e.target.value))}
                  aria-label={t.garage.allDecades}
                >
                  <option value="">{t.garage.allDecades}</option>
                  {decades.map((d) => (
                    <option key={d} value={d}>
                      {t.garage.decade(d)}
                    </option>
                  ))}
                </select>
              )}
              <select className="select w-full" value={activeSort} onChange={(e) => update(setSort)(e.target.value as Sort)} aria-label={t.garage.sort}>
                {sorts.map((s) => (
                  <option key={s} value={s}>
                    {t.garage.sort}{t.common.colon} {t.garage.sorts[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between gap-2">
              <p role="status" className="text-sm font-medium tabular-nums text-base-content/75">
                {t.garage.count(number(matches.length))}
              </p>
              {filtered && (
                <button type="button" className="btn btn-ghost btn-sm min-h-11" onClick={reset}>
                  <RotateCcw className="size-4" aria-hidden="true" />
                  {t.garage.reset}
                </button>
              )}
            </div>
          </section>

          {matches.length === 0 ? (
            <p className="rounded-box border border-dashed border-base-content/15 p-6 text-center text-sm text-base-content/70">{t.garage.noMatch}</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {shown.map((car) => (
                <li key={car.id}>
                  <GarageCard car={car} foundOn={collection[car.id]} />
                </li>
              ))}
            </ul>
          )}
          {shown.length < matches.length && (
            <button type="button" className="btn self-center" onClick={() => setLimit((n) => n + PAGE)}>
              {t.garage.showMore}
            </button>
          )}
        </>
      )}
    </>
  );
}

function GarageCard({ car, foundOn }: { car: Car; foundOn?: string }) {
  const { t, date } = useI18n();
  const years = formatYears(car);
  return (
    <Link
      href={`/garage/${car.id}`}
      className="group flex h-full flex-col overflow-hidden surface transition-colors hover:border-base-content/25 hover:bg-base-200/60"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-base-300">
        {/* Remote thumbnail, loaded only when scrolled into view. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbnailUrl(car.image, 330)}
          alt=""
          width={330}
          height={206}
          loading="lazy"
          decoding="async"
          onError={(e) => (e.currentTarget.style.visibility = "hidden")}
          style={{ objectPosition: car.image.position ?? "center" }}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      </div>
      <div className="flex flex-1 flex-col gap-0.5 p-3">
        <p className="eyebrow truncate">{car.make}</p>
        <p className="text-sm font-semibold leading-snug">
          {car.model}
          {car.generation && <span className="font-normal text-base-content/65"> ({car.generation})</span>}
        </p>
        {years && <p className="text-xs text-base-content/60 tabular-nums">{years}</p>}
        {foundOn && (
          <p className="mt-auto pt-1 text-[0.7rem] text-success">
            {t.garage.foundOn(date(foundOn, { day: "numeric", month: "short", year: "numeric" }))}
          </p>
        )}
      </div>
    </Link>
  );
}
