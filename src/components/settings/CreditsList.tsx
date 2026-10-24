"use client";

import { ExternalLink } from "lucide-react";
import { CARS, carName } from "@/lib/data/dataset";
import { useI18n } from "@/hooks/use-i18n";

const SORTED = [...CARS].sort((a, b) => carName(a).localeCompare(carName(b)));

/** Attribution for every bundled photo, as their licenses require. */
export function CreditsList() {
  const { t } = useI18n();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-6 sm:pt-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl sm:text-4xl">{t.credits.title}</h1>
        <p className="text-base-content/75">{t.credits.lead}</p>
      </header>
      <ul className="divide-y divide-base-content/10 rounded-box border border-base-content/10">
        {SORTED.map((car) => (
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
    </div>
  );
}
