"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Gauge, Infinity as InfinityIcon, Layers, LayoutGrid, Timer, ZoomIn } from "lucide-react";
import type { GameMode } from "@/types/game";
import { localDateKey, dailyNumber } from "@/lib/game/daily-challenge";
import { DIFFICULTY_FILTERS } from "@/lib/game/question-selection";
import { playHref } from "@/lib/game/routes";
import { bestScoreOverall, dailyStreak } from "@/lib/stats/statistics";
import { dailyGrid } from "@/lib/share";
import { sessionStore, updateSettings, useHydrated, usePersistent, useSettings, useStatistics } from "@/hooks/use-persistent";
import { useCatalogue } from "@/hooks/use-catalogue";
import { useI18n } from "@/hooks/use-i18n";
import { savedSession } from "@/hooks/use-game";

const MODE_ICONS: Record<GameMode, typeof Gauge> = {
  classic: Gauge,
  daily: CalendarDays,
  endless: InfinityIcon,
  timed: Timer,
  category: LayoutGrid,
  generation: Layers,
  zoom: ZoomIn,
};

const MODE_CARDS = ["classic", "endless", "timed", "generation", "zoom", "category"] as const;

export function HomeScreen() {
  const { t, number } = useI18n();
  const hydrated = useHydrated();
  const stats = useStatistics();
  const { difficulty } = useSettings();
  const catalogue = useCatalogue();
  // Re-read whenever the saved session changes (e.g. "Abandon").
  usePersistent(sessionStore);
  const resumable = catalogue.status === "ready" ? savedSession(catalogue.catalogue.engine) : null;
  const total = catalogue.status === "ready" ? catalogue.catalogue.cars.length : null;

  const show = (value: number) => (hydrated ? number(value) : "—");
  const found = Object.keys(stats.collection).length;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 pt-6 sm:pt-12">
      {resumable && (
        <section className="surface animate-fade-up flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="eyebrow">{t.home.resumeTitle}</p>
            <p className="font-semibold">{t.home.resumeText(t.modes[resumable.config.mode].name, resumable.questions.length)}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => sessionStore.set(null)}>
              {t.home.discard}
            </button>
            <Link href="/play?resume=1" className="btn btn-primary">
              {t.home.resume}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      )}

      <div className="grid gap-6 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:items-stretch">
        <section aria-labelledby="home-title" className="flex flex-col justify-center gap-6">
          <div className="flex flex-col gap-3">
            <p className="eyebrow">{t.home.kicker}</p>
            <h1 id="home-title" className="font-display text-3xl leading-tight sm:text-4xl lg:text-5xl">
              {t.home.title}
            </h1>
            <p className="max-w-prose text-base text-base-content/70 sm:text-lg">{t.home.lead}</p>
            {total !== null && <p className="text-sm text-base-content/55">{t.home.catalogueSize(number(total))}</p>}
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="eyebrow mb-2">{t.home.difficulty}</legend>
            <div className="join w-full sm:w-auto">
              {DIFFICULTY_FILTERS.map((level) => (
                <label
                  key={level}
                  className="join-item btn btn-sm min-h-11 flex-1 border-base-content/15 bg-base-100 px-2 text-sm font-medium sm:flex-none sm:px-4 has-[:checked]:border-neutral has-[:checked]:bg-neutral has-[:checked]:text-neutral-content has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary"
                >
                  <input
                    type="radio"
                    name="difficulty"
                    value={level}
                    checked={difficulty === level}
                    onChange={() => updateSettings({ difficulty: level })}
                    className="sr-only"
                  />
                  {t.difficulty[level]}
                </label>
              ))}
            </div>
            <p className="text-sm text-base-content/60" aria-live="polite">
              {t.difficultyHelp[difficulty]}
            </p>
          </fieldset>

          <Link href={playHref({ mode: "classic", difficulty })} className="btn btn-primary min-h-12 w-full px-8 sm:w-fit">
            {t.home.play}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </section>

        <DailyCard />
      </div>

      <div className="surface grid grid-cols-3 divide-x divide-base-content/10 overflow-hidden">
        {[
          { label: t.home.bestScore, value: show(bestScoreOverall(stats)), href: "/stats" },
          { label: t.home.streak, value: show(stats.currentStreak), href: "/stats" },
          {
            label: t.home.garage,
            value: hydrated && total !== null ? t.home.garageValue(number(found), number(total)) : show(found),
            href: "/garage",
          },
        ].map(({ label, value, href }) => (
          <Link key={label} href={href} className="flex min-w-0 flex-col gap-1 px-3 py-3 transition-colors hover:bg-base-200/60 sm:px-5 sm:py-4">
            <span className="truncate text-xs text-base-content/60 sm:text-sm">{label}</span>
            <span className="truncate font-display text-lg tabular-nums sm:text-2xl">{value}</span>
          </Link>
        ))}
      </div>

      <section aria-labelledby="modes-title" className="flex flex-col gap-3">
        <h2 id="modes-title" className="eyebrow">
          {t.home.modesTitle}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODE_CARDS.map((mode) => {
            const Icon = MODE_ICONS[mode];
            const best = stats.bestScores[mode];
            const usesDifficulty = mode === "classic" || mode === "zoom";
            return (
              <li key={mode}>
                <Link
                  href={mode === "category" ? "/categories" : playHref({ mode, difficulty: usesDifficulty ? difficulty : "mixed" })}
                  className="surface surface-link group flex h-full gap-3 p-4"
                >
                  <Icon className="mt-0.5 size-5 shrink-0 text-base-content/45 transition-colors group-hover:text-primary" aria-hidden="true" />
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold">{t.modes[mode].name}</span>
                      {hydrated && best !== undefined && (
                        <span className="shrink-0 text-xs text-base-content/55 tabular-nums">{t.home.bestShort(number(best))}</span>
                      )}
                    </span>
                    <span className="text-sm text-base-content/65">{t.modes[mode].description}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="how-title" className="border-t border-base-content/10 pt-6">
        <h2 id="how-title" className="eyebrow mb-4">
          {t.home.howTitle}
        </h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {t.home.howSteps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="text-sm font-semibold tabular-nums text-base-content/40">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-sm text-base-content/80">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <footer className="flex flex-wrap justify-center gap-x-4 gap-y-1 pb-2 text-xs text-base-content/60">
        <Link href="/credits" className="link-hover">
          {t.nav.credits}
        </Link>
        <span aria-hidden="true">·</span>
        <span>Wikidata · Wikimedia Commons</span>
      </footer>
    </div>
  );
}

function DailyCard() {
  const { t, date } = useI18n();
  const hydrated = useHydrated();
  const stats = useStatistics();
  const session = usePersistent(sessionStore);
  // Before hydration the date is unknown to the server render: show a neutral card.
  const today = hydrated ? localDateKey() : null;
  const result = today ? stats.daily[today] : undefined;
  const inProgress = today !== null && session?.config.mode === "daily" && session.config.dateKey === today;
  const streak = hydrated ? dailyStreak(stats.daily, new Date()) : 0;

  return (
    <section
      aria-labelledby="daily-title"
      className="surface flex flex-col justify-between gap-6 bg-base-200/50 p-5 sm:p-6"
    >
      <div className="flex flex-col gap-2">
        <p className="eyebrow flex items-center gap-2">
          <CalendarDays className="size-3.5" aria-hidden="true" />
          {today ? `${t.daily.number(dailyNumber(today))} · ${date(today, { weekday: "long", day: "numeric", month: "long" })}` : t.daily.title}
        </p>
        <h2 id="daily-title" className="font-display text-2xl">
          {t.daily.title}
        </h2>
        <p className="text-base-content/70">{result ? t.daily.comeBack : t.daily.text}</p>
      </div>

      {result ? (
        <div className="flex flex-col gap-1">
          <p className="text-xl tracking-widest" aria-hidden="true">
            {dailyGrid(result.outcomes)}
          </p>
          <p className="font-semibold tabular-nums">
            {t.daily.done} · {t.daily.result(result.correct, result.total, result.score)}
          </p>
          {streak > 1 && <p className="text-sm text-base-content/60">{t.daily.streak(streak)}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Empty result grid: five cars to find. */}
          {/* Five cars to find. */}
          <div className="flex gap-1" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className="h-1.5 w-8 rounded-full bg-base-content/15" />
            ))}
          </div>
          {streak > 0 && <p className="text-sm text-base-content/60">{t.daily.streak(streak)}</p>}
          <Link href={inProgress ? "/play?resume=1" : playHref({ mode: "daily" })} className="btn btn-neutral min-h-12 w-full sm:w-fit sm:px-6">
            {inProgress ? t.daily.resume : t.daily.play}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      )}
    </section>
  );
}
