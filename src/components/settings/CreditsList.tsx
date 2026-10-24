"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import type { Car } from "@/types/car";
import { carName } from "@/lib/data/dataset";
import { normalizeAnswer } from "@/lib/game/answer-validation";
import { CatalogueGate } from "@/components/ui/CatalogueGate";
import { useI18n } from "@/hooks/use-i18n";

const PAGE = 60;

/** Attribution for every photo in the catalogue, as their licences require. */
export function CreditsList() {
  const { t } = useI18n();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-6 sm:pt-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl sm:text-4xl">{t.credits.title}</h1>
        <p className="text-base-content/75">{t.credits.lead}</p>
      </header>
      <CatalogueGate>{({ cars }) => <Credits cars={cars} />}</CatalogueGate>
    </div>
  );
}

function Credits({ cars }: { cars: readonly Car[] }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const sorted = useMemo(() => [...cars].sort((a, b) => carName(a).localeCompare(carName(b))), [cars]);
  const needle = normalizeAnswer(query);
  const matches = needle
    ? sorted.filter((car) => normalizeAnswer(`${carName(car)} ${car.image.author}`).includes(needle))
    : sorted;
  const shown = matches.slice(0, limit);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="input w-full sm:w-80">
          <Search className="size-4 opacity-60" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
            placeholder={t.credits.search}
            aria-label={t.credits.search}
          />
        </label>
        <p className="text-sm text-base-content/70 tabular-nums" role="status">
          {t.credits.count(shown.length, matches.length)}
        </p>
      </div>
      <ul className="divide-y divide-base-content/10 rounded-box border border-base-content/10">
        {shown.map((car) => (
          <li key={car.id} className="flex flex-col gap-0.5 px-4 py-3 text-sm">
            <span className="font-semibold">{carName(car)}</span>
            <span className="text-base-content/75">
              {t.credits.author}
              {t.common.colon} {car.image.author}
            </span>
            <span className="flex flex-wrap gap-x-3 text-base-content/75">
              <span>
                {t.credits.license}
                {t.common.colon}{" "}
                {car.image.licenseUrl ? (
                  <a href={car.image.licenseUrl} target="_blank" rel="noopener noreferrer license" className="link">
                    {car.image.license}
                  </a>
                ) : (
                  car.image.license
                )}
              </span>
              <a href={car.image.sourcePage} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1">
                {t.credits.source}
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            </span>
          </li>
        ))}
      </ul>
      {shown.length < matches.length && (
        <button type="button" className="btn self-center" onClick={() => setLimit((n) => n + PAGE)}>
          {t.credits.showMore}
        </button>
      )}
    </>
  );
}
