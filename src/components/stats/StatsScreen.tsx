"use client";

import Link from "next/link";
import { Award, BarChart3, CalendarDays, Lock, Play } from "lucide-react";
import { GAME_MODES } from "@/types/game";
import { CATEGORY_IDS } from "@/lib/game/categories";
import { localDateKey } from "@/lib/game/daily-challenge";
import { dailyStreak, favoriteCategory, overallAccuracy } from "@/lib/stats/statistics";
import { achievements } from "@/lib/stats/achievements";
import { useHydrated, useStatistics } from "@/hooks/use-persistent";
import { useI18n } from "@/hooks/use-i18n";

const RECENT_GAMES = 20;
const DAILY_DAYS = 14;

export function StatsScreen() {
  const { t, number, percent, date } = useI18n();
  const hydrated = useHydrated();
  const stats = useStatistics();

  if (!hydrated) return <div className="mx-auto mt-10 h-64 w-[calc(100%-2rem)] max-w-5xl animate-pulse rounded-box bg-base-200" />;

  const accuracy = overallAccuracy(stats);
  const favorite = favoriteCategory(stats);
  const recent = stats.history.slice(-RECENT_GAMES);
  const maxScore = Math.max(1, ...recent.map((g) => g.score));
  const categories = CATEGORY_IDS.map((id) => ({ id, tally: stats.categoryResults[id] })).filter(
    (c): c is { id: (typeof CATEGORY_IDS)[number]; tally: { seen: number; correct: number } } => !!c.tally && c.tally.seen > 0,
  );
  const today = new Date();
  const days = Array.from({ length: DAILY_DAYS }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (DAILY_DAYS - 1 - i));
    const key = localDateKey(d);
    return { key, result: stats.daily[key] };
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-6 sm:pt-10">
      <h1 className="font-display text-2xl sm:text-3xl">{t.stats.title}</h1>

      {stats.gamesPlayed === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-box border border-dashed border-base-content/15 p-8 text-center">
          <BarChart3 className="size-10 text-base-content/50" aria-hidden="true" />
          <p>{t.stats.empty}</p>
          <Link href="/play?mode=classic" className="btn btn-primary">
            <Play className="size-4" aria-hidden="true" />
            {t.home.play}
          </Link>
        </div>
      ) : (
        <>
          <dl className="surface grid grid-cols-2 sm:grid-cols-5 [&>div]:border-base-content/10 [&>div:not(:last-child)]:border-b sm:[&>div:not(:last-child)]:border-b-0 sm:[&>div:not(:last-child)]:border-r">
            {[
              { label: t.stats.gamesPlayed, value: number(stats.gamesPlayed) },
              { label: t.stats.correctAnswers, value: number(stats.correctAnswers) },
              { label: t.stats.accuracy, value: accuracy === null ? "—" : percent(accuracy) },
              { label: t.stats.currentStreak, value: number(stats.currentStreak) },
              { label: t.stats.bestStreak, value: number(stats.bestStreak) },
            ].map(({ label, value }) => (
              <div key={label} className="px-4 py-3 last:col-span-2 sm:last:col-span-1">
                <dt className="text-xs text-base-content/60 sm:text-sm">{label}</dt>
                <dd className="font-display text-2xl tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          {favorite && (
            <p className="border-l-2 border-base-content/20 py-1 pl-4">
              <span className="eyebrow block">{t.stats.favorite}</span>
              {t.stats.favoriteText(t.categories.names[favorite.id], favorite.tally.seen)}
            </p>
          )}

          <div className="grid gap-8 lg:grid-cols-2">
            <section aria-labelledby="records-title" className="flex flex-col gap-3">
              <h2 id="records-title" className="eyebrow">
                {t.stats.records}
              </h2>
              <ul className="divide-y divide-base-content/10 rounded-box border border-base-content/10">
                {GAME_MODES.map((mode) => (
                  <li key={mode} className="flex items-center justify-between px-4 py-2.5">
                    <span>{t.modes[mode].name}</span>
                    <span className="font-semibold tabular-nums">
                      {stats.bestScores[mode] !== undefined ? t.common.points(stats.bestScores[mode]!) : t.stats.noRecord}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="recent-title" className="flex flex-col gap-3">
              <div>
                <h2 id="recent-title" className="eyebrow">
                  {t.stats.recentGames}
                </h2>
                <p className="text-xs text-base-content/60">{t.stats.recentGamesHint}</p>
              </div>
              {/* Single series: one hue, no legend; each bar has a title and an accessible label. */}
              <ol className="flex h-40 items-end gap-0.5 border-b border-base-content/20 pb-px" aria-label={t.stats.recentGames}>
                {recent.map((game) => {
                  const label = `${t.modes[game.mode].name}, ${date(game.dateKey)}${t.common.colon} ${t.common.points(game.score)}`;
                  return (
                    <li key={game.id} className="group relative flex h-full max-w-8 flex-1 items-end" title={label}>
                      <span className="sr-only">{label}</span>
                      <span
                        aria-hidden="true"
                        className="w-full rounded-t-[4px] bg-primary/80 transition-colors group-hover:bg-primary"
                        style={{ height: `${Math.max(2, (game.score / maxScore) * 100)}%` }}
                      />
                    </li>
                  );
                })}
              </ol>
              <p className="text-right text-xs text-base-content/60 tabular-nums">max {t.common.points(maxScore)}</p>
            </section>
          </div>

          {categories.length > 0 && (
            <section aria-labelledby="categories-title" className="flex flex-col gap-3">
              <div>
                <h2 id="categories-title" className="eyebrow">
                  {t.stats.byCategory}
                </h2>
                <p className="text-xs text-base-content/60">{t.stats.byCategoryHint}</p>
              </div>
              <ul className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
                {categories.map(({ id, tally }) => {
                  const ratio = tally.correct / tally.seen;
                  return (
                    <li key={id} className="flex flex-col gap-1">
                      <div className="flex justify-between text-sm">
                        <span>{t.categories.names[id]}</span>
                        <span className="tabular-nums text-base-content/70">
                          {t.stats.answers(tally.correct, tally.seen)} · <strong className="text-base-content">{percent(ratio)}</strong>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-base-300" aria-hidden="true">
                        <div className="h-full rounded-full bg-base-content/60" style={{ width: `${ratio * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}

      <AchievementList stats={stats} />

      <section aria-labelledby="daily-stats-title" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="daily-stats-title" className="eyebrow flex items-center gap-1.5">
            <CalendarDays className="size-4" aria-hidden="true" />
            {t.stats.daily} · {t.stats.dailyLast}
          </h2>
          <p className="text-sm text-base-content/70">
            {t.stats.dailyStreak}
            {t.common.colon} <strong className="tabular-nums text-base-content">{dailyStreak(stats.daily, today)}</strong> ·{" "}
            {t.stats.dailyPlayed}
            {t.common.colon} <strong className="tabular-nums text-base-content">{Object.keys(stats.daily).length}</strong>
          </p>
        </div>
        <ol className="grid grid-cols-7 gap-1.5 sm:grid-cols-14">
          {days.map(({ key, result }) => {
            const label = `${date(key, { weekday: "short", day: "numeric", month: "short" })}${t.common.colon} ${
              result ? t.daily.result(result.correct, result.total, result.score) : t.stats.dailyMissing
            }`;
            return (
              <li
                key={key}
                title={label}
                className={`flex aspect-square flex-col items-center justify-center rounded-field text-[0.65rem] leading-tight ${
                  result ? "bg-primary text-primary-content" : "border border-dashed border-base-content/20 text-base-content/50"
                }`}
              >
                <span className="sr-only">{label}</span>
                <span aria-hidden="true">{date(key, { day: "numeric" })}</span>
                {result && (
                  <span aria-hidden="true" className="font-bold tabular-nums">
                    {result.correct}/{result.total}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function AchievementList({ stats }: { stats: Parameters<typeof achievements>[0] }) {
  const { t, number } = useI18n();
  const list = achievements(stats);
  const unlocked = list.filter((a) => a.unlocked).length;
  return (
    <section aria-labelledby="achievements-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="achievements-title" className="eyebrow">
          {t.stats.achievements}
        </h2>
        <p className="text-sm text-base-content/70">{t.stats.achievementsHint(unlocked, list.length)}</p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((a) => {
          const copy = t.achievements[a.id];
          return (
            <li
              key={a.id}
              className={`surface flex gap-3 p-3 ${a.unlocked ? "border-base-content/25" : ""}`}
            >
              <span
                className={`grid size-6 shrink-0 place-items-center ${a.unlocked ? "text-primary" : "text-base-content/35"}`}
              >
                {a.unlocked ? <Award className="size-5" aria-hidden="true" /> : <Lock className="size-4" aria-hidden="true" />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-semibold leading-tight">{copy.name}</span>
                <span className="text-xs text-base-content/70">{copy.description}</span>
                {!a.unlocked && (
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-base-300" aria-hidden="true">
                      <span className="block h-full rounded-full bg-base-content/60" style={{ width: `${(a.progress / a.target) * 100}%` }} />
                    </span>
                    <span className="text-[0.7rem] text-base-content/60 tabular-nums">
                      {number(a.progress)}/{number(a.target)}
                    </span>
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
