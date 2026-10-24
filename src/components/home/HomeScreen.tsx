"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Flame,
  Gauge,
  Infinity as InfinityIcon,
  Layers,
  LayoutGrid,
  Play,
  Timer,
  Trophy,
  Warehouse,
  ZoomIn,
} from "lucide-react";
import type { GameMode } from "@/types/game";
import { localDateKey, dailyNumber } from "@/lib/game/daily-challenge";
import { DIFFICULTY_FILTERS } from "@/lib/game/question-selection";
import { playHref } from "@/lib/game/routes";
import { bestScoreOverall, dailyStreak } from "@/lib/stats/statistics";
import { dailyGrid } from "@/lib/share";
import { LogoMark } from "@/components/ui/Logo";
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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-6 sm:pt-10">
      {resumable && (
        <section className="animate-fade-up flex flex-wrap items-center justify-between gap-3 rounded-box border border-primary/30 bg-primary/5 p-4">
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
        <section aria-labelledby="home-title" className="relative flex flex-col justify-center gap-4">
          {/* The emblem as a quiet watermark behind the headline. */}
          <LogoMark className="pointer-events-none absolute -right-4 -top-6 -z-10 size-56 text-base-content/[0.05] sm:size-72" />
          <p className="eyebrow">{t.home.kicker}</p>
          <h1 id="home-title" className="font-display text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
            {t.home.title}
          </h1>
          <p className="max-w-prose text-lg text-base-content/75">{t.home.lead}</p>
          {total !== null && (
            <p className="flex items-center gap-2 text-sm font-semibold text-accent">
              <span className="inline-block size-1.5 rounded-full bg-accent" aria-hidden="true" />
              {t.home.catalogueSize(number(total))}
            </p>
          )}

          <fieldset className="flex flex-col gap-1.5">
            <legend className="eyebrow mb-1.5">{t.home.difficulty}</legend>
            <div className="join w-full sm:w-auto">
              {DIFFICULTY_FILTERS.map((level) => (
                <label
                  key={level}
                  className="join-item btn btn-sm min-h-11 flex-1 px-2 text-xs sm:flex-none sm:px-3.5 sm:text-sm has-[:checked]:btn-neutral has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary"
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
            <p className="text-sm text-base-content/65" aria-live="polite">
              {t.difficultyHelp[difficulty]}
            </p>
          </fieldset>

          <Link href={playHref({ mode: "classic", difficulty })} className="btn btn-primary btn-lg w-full text-lg sm:w-fit sm:px-10">
            <Play className="size-5 fill-current" aria-hidden="true" />
            {t.home.play}
          </Link>
        </section>

        <DailyCard />
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: t.home.bestScore, value: show(bestScoreOverall(stats)), Icon: Trophy, href: "/stats" },
          { label: t.home.streak, value: show(stats.currentStreak), Icon: Flame, href: "/stats" },
          {
            label: t.home.garage,
            value: hydrated && total !== null ? t.home.garageValue(number(found), number(total)) : show(found),
            Icon: Warehouse,
            href: "/garage",
          },
        ].map(({ label, value, Icon, href }) => (
          <Link
            key={label}
            href={href}
            className="flex flex-col gap-1 rounded-box border border-base-content/10 bg-base-200/60 p-3 transition hover:border-primary/30 sm:p-4"
          >
            <span className="flex items-center gap-1.5 text-xs text-base-content/70 sm:text-sm">
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {label}
            </span>
            <span className="font-wide truncate text-xl font-bold tabular-nums sm:text-3xl">{value}</span>
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
                  className="group flex h-full gap-3 rounded-box border border-base-content/10 bg-base-100 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-field bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-wide text-lg font-bold">{t.modes[mode].name}</span>
                      {hydrated && best !== undefined && (
                        <span className="shrink-0 text-xs text-base-content/60 tabular-nums">
                          <Trophy className="mr-1 inline size-3" aria-hidden="true" />
                          {number(best)}
                        </span>
                      )}
                    </span>
                    <span className="text-sm text-base-content/70">{t.modes[mode].description}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="how-title" className="rounded-box bg-base-200/60 p-5">
        <h2 id="how-title" className="eyebrow mb-3">
          {t.home.howTitle}
        </h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {t.home.howSteps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="font-display text-2xl leading-none text-primary">{i + 1}</span>
              <span className="text-sm">{step}</span>
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
      className="relative flex flex-col justify-between gap-4 overflow-hidden rounded-box bg-neutral p-5 text-neutral-content shadow-md sm:p-6"
    >
      <div className="livery absolute inset-x-0 top-0" aria-hidden="true" />
      <LogoMark className="pointer-events-none absolute -bottom-6 -right-6 size-40 text-neutral-content/[0.06]" />
      <div className="flex flex-col gap-1 pt-1">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-content/70">
          <CalendarDays className="size-4" aria-hidden="true" />
          {today ? `${t.daily.number(dailyNumber(today))} · ${date(today, { weekday: "long", day: "numeric", month: "long" })}` : t.daily.title}
        </p>
        <h2 id="daily-title" className="font-display text-3xl">
          {t.daily.title}
        </h2>
        <p className="text-neutral-content/80">{result ? t.daily.comeBack : t.daily.text}</p>
      </div>

      {result ? (
        <div className="flex flex-col gap-1">
          <p className="text-2xl tracking-widest" aria-hidden="true">
            {dailyGrid(result.outcomes)}
          </p>
          <p className="font-wide font-semibold tabular-nums">
            {t.daily.done} · {t.daily.result(result.correct, result.total, result.score)}
          </p>
          {streak > 1 && <p className="text-sm text-neutral-content/70">{t.daily.streak(streak)}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Empty result grid: five cars to find. */}
          <div className="flex gap-1.5" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className="size-9 rounded-md border-2 border-neutral-content/25" />
            ))}
          </div>
          {streak > 0 && <p className="text-sm text-neutral-content/70">{t.daily.streak(streak)}</p>}
          <Link href={inProgress ? "/play?resume=1" : playHref({ mode: "daily" })} className="btn btn-primary btn-lg w-full sm:w-fit">
            {inProgress ? t.daily.resume : t.daily.play}
            <ArrowRight className="size-5" aria-hidden="true" />
          </Link>
        </div>
      )}
    </section>
  );
}
