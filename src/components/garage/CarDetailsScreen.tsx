"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Camera, Database, Play, Share2, Warehouse } from "lucide-react";
import type { Car, CarTag } from "@/types/car";
import { carName, formatYears, imageSrcSet } from "@/lib/data/dataset";
import { loadCarDetails, type CarDetails } from "@/lib/data/details";
import type { CategoryId } from "@/lib/game/categories";
import { playHref } from "@/lib/game/routes";
import { canShare, shareText } from "@/lib/share";
import { CatalogueGate } from "@/components/ui/CatalogueGate";
import { LogoMark } from "@/components/ui/Logo";
import { useHydrated, useStatistics } from "@/hooks/use-persistent";
import { useI18n } from "@/hooks/use-i18n";

const LEVELS = ["easy", "medium", "hard", "expert"] as const;
/** Tags shown as categories, mapped to their category label. */
const TAG_LABEL: Partial<Record<CarTag, CategoryId>> = {
  hypercar: "supercar",
  supercar: "supercar",
  sports: "sports",
  "hot-hatch": "hot-hatch",
  luxury: "luxury",
  classic: "classic",
  electric: "electric",
  racing: "racing",
  everyday: "everyday",
  concept: "concept",
  rare: "rare",
};

export function CarDetailsScreen({ id }: { id: string }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-4 sm:pt-8">
      <CatalogueGate>{({ engine }) => <CarPage car={engine.carsById.get(id) ?? null} />}</CatalogueGate>
    </div>
  );
}

function CarPage({ car }: { car: Car | null }) {
  const { t, locale, number, date } = useI18n();
  const hydrated = useHydrated();
  const { collection } = useStatistics();
  const [details, setDetails] = useState<CarDetails | null | "loading">("loading");
  const [shared, setShared] = useState<string | null>(null);

  useEffect(() => {
    if (!car) return;
    let alive = true;
    loadCarDetails(car.id)
      .then((d) => alive && setDetails(d))
      .catch(() => alive && setDetails(null));
    return () => {
      alive = false;
    };
  }, [car]);

  const back = (
    <Link href="/garage" className="btn btn-ghost btn-sm w-fit gap-1.5 px-2">
      <ArrowLeft className="size-4" aria-hidden="true" />
      {t.carPage.back}
    </Link>
  );

  if (!car) {
    return (
      <>
        {back}
        <div className="flex flex-col items-center gap-4 rounded-box bg-base-200 p-10 text-center">
          <LogoMark className="h-14 w-20 text-base-content/40" />
          <p>{t.carPage.notFound}</p>
        </div>
      </>
    );
  }

  const name = carName(car);
  const years = formatYears(car);
  const foundOn = collection[car.id];
  const loaded = details === "loading" ? null : details;
  const other = locale === "fr" ? "en" : "fr";
  const descriptionLang = loaded?.description?.[locale] ? locale : other;
  const description = loaded?.description?.[descriptionLang];
  const wiki = car.links?.[descriptionLang] ?? car.links?.[locale] ?? car.links?.[other];
  const facts = loaded?.facts ?? {};
  const country = new Intl.DisplayNames([locale], { type: "region" }).of(car.country) ?? car.country;
  const categories = [...new Set(car.tags.map((tag) => TAG_LABEL[tag]).filter((c): c is CategoryId => Boolean(c)))];
  const unit = (value: number, suffix: string) => `${number(value)} ${suffix}`;

  const rows: [string, string | undefined | null][] = [
    [t.carPage.labels.origin, country],
    [t.carPage.labels.years, years],
    [t.carPage.labels.generation, car.generation],
    [t.carPage.labels.body, car.bodyType && t.bodyTypeNames[car.bodyType]],
    [t.carPage.labels.designers, facts.designers?.join(", ")],
    [t.carPage.labels.engines, facts.engines?.join(", ")],
    [t.carPage.labels.assembly, facts.assembly?.[locale]],
    [t.carPage.labels.produced, facts.produced ? number(facts.produced) : null],
    [t.carPage.labels.topSpeed, facts.topSpeedKmh ? unit(facts.topSpeedKmh, "km/h") : null],
    [t.carPage.labels.mass, facts.massKg ? unit(facts.massKg, "kg") : null],
    [t.carPage.labels.length, facts.lengthMm ? unit(facts.lengthMm, "mm") : null],
    [t.carPage.labels.difficulty, t.difficulty[LEVELS[car.difficulty - 1]]],
  ];

  const share = async () => {
    const outcome = await shareText(`${name} — ${window.location.href}`);
    setShared(outcome === "copied" ? t.results.copied : null);
  };

  return (
    <>
      {back}
      <article className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start lg:gap-10">
        <figure className="flex flex-col gap-2 lg:sticky lg:top-24">
          <div
            className="relative w-full overflow-hidden rounded-box bg-base-300 shadow-md ring-1 ring-base-content/10"
            style={{ aspectRatio: `${car.image.width} / ${car.image.height}` }}
          >
            {/* Hotlinked from Wikimedia Commons, like every photo in the game. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={car.image.url}
              srcSet={imageSrcSet(car.image)}
              sizes="(min-width: 1024px) 640px, 100vw"
              width={car.image.width}
              height={car.image.height}
              alt={t.game.photoAltRevealed(name)}
              decoding="async"
              onError={(e) => (e.currentTarget.style.visibility = "hidden")}
              style={{ objectPosition: car.image.position ?? "center" }}
              className="size-full object-cover"
            />
          </div>
          <figcaption className="px-1 text-xs text-base-content/60">
            {t.game.photoBy} {car.image.author} ·{" "}
            {car.image.licenseUrl ? (
              <a href={car.image.licenseUrl} target="_blank" rel="noopener noreferrer license" className="link">
                {car.image.license}
              </a>
            ) : (
              car.image.license
            )}
          </figcaption>
        </figure>

        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-2">
            <p className="eyebrow">
              {car.make} · {country}
            </p>
            <h1 className="font-display text-3xl leading-tight sm:text-4xl">{name}</h1>
            {categories.length > 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-label={t.carPage.labels.categories}>
                {categories.map((c) => (
                  <li key={c} className="badge badge-outline">
                    {t.categories.names[c]}
                  </li>
                ))}
              </ul>
            )}
            {hydrated && (
              <p className={`flex items-center gap-1.5 text-sm ${foundOn ? "text-success" : "text-base-content/60"}`}>
                <Warehouse className="size-4" aria-hidden="true" />
                {foundOn ? t.carPage.inGarage(date(foundOn, { day: "numeric", month: "long", year: "numeric" })) : t.carPage.notInGarage}
              </p>
            )}
          </header>

          <section aria-labelledby="about-title" className="flex flex-col gap-2">
            <h2 id="about-title" className="eyebrow">
              {t.carPage.about}
            </h2>
            {details === "loading" ? (
              <p className="text-sm text-base-content/60">{t.carPage.loadingDetails}</p>
            ) : description ? (
              <>
                <p className="text-[1.02rem] leading-relaxed" lang={descriptionLang}>
                  {description}
                </p>
                <p className="text-xs text-base-content/60">
                  {wiki ? (
                    <a href={wiki} target="_blank" rel="noopener noreferrer" className="link">
                      {t.carPage.descriptionSource}
                    </a>
                  ) : (
                    t.carPage.descriptionSource
                  )}
                </p>
              </>
            ) : (
              !car.funFact && <p className="text-sm text-base-content/60">{t.carPage.noDescription}</p>
            )}
            {car.funFact && (
              <div className="rounded-field border-l-4 border-primary bg-base-200/70 p-3 text-sm leading-relaxed">
                <p className="eyebrow mb-1">{t.game.funFact}</p>
                <p>{car.funFact[locale]}</p>
              </div>
            )}
          </section>

          <section aria-labelledby="facts-title" className="flex flex-col gap-2">
            <h2 id="facts-title" className="eyebrow">
              {t.carPage.facts}
            </h2>
            <dl className="divide-y divide-base-content/10 rounded-box border border-base-content/10 bg-base-100">
              {rows
                .filter((row): row is [string, string] => Boolean(row[1]))
                .map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[minmax(7.5rem,40%)_1fr] gap-3 px-4 py-2.5 text-sm">
                    <dt className="text-base-content/65">{label}</dt>
                    <dd className="font-medium tabular-nums">{value}</dd>
                  </div>
                ))}
            </dl>
            {loaded?.facts && <p className="text-xs text-base-content/60">{t.carPage.factsSource}</p>}
          </section>

          <section aria-labelledby="links-title" className="flex flex-col gap-3">
            <h2 id="links-title" className="sr-only">
              {t.carPage.links}
            </h2>
            <div className="flex flex-wrap gap-2">
              <Link href={playHref({ mode: "category", make: car.make })} className="btn btn-primary">
                <Play className="size-4" aria-hidden="true" />
                {t.carPage.playBrand(car.make)}
              </Link>
              {wiki && (
                <a href={wiki} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                  <BookOpen className="size-4" aria-hidden="true" />
                  {t.game.wikipedia}
                </a>
              )}
              <a href={car.image.sourcePage} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                <Camera className="size-4" aria-hidden="true" />
                {t.carPage.photoPage}
              </a>
              {car.wikidata && (
                <a href={`https://www.wikidata.org/wiki/${car.wikidata}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                  <Database className="size-4" aria-hidden="true" />
                  Wikidata
                </a>
              )}
              {hydrated && canShare() && (
                <button type="button" className="btn btn-ghost" onClick={share}>
                  <Share2 className="size-4" aria-hidden="true" />
                  {t.results.share}
                </button>
              )}
            </div>
            <p role="status" className="min-h-5 text-sm text-success">
              {shared}
            </p>
          </section>
        </div>
      </article>
    </>
  );
}
