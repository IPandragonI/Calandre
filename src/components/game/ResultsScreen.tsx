"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Flag, Home, RotateCcw, Share2, Trophy, XCircle } from "lucide-react";
import type { GameState, QuestionStatus } from "@/types/game";
import { carName, imageRendition } from "@/lib/data/dataset";
import { dailyNumber } from "@/lib/game/daily-challenge";
import { summarizeGame } from "@/lib/game/engine";
import { canShare, dailyGrid, shareText } from "@/lib/share";
import { dailyOutcomes } from "@/lib/stats/statistics";
import { useHydrated } from "@/hooks/use-persistent";
import { useI18n } from "@/hooks/use-i18n";
import { engine } from "@/hooks/use-game";

interface ResultsScreenProps {
  state: GameState;
  previousBest: number;
  onPlayAgain?: () => void;
}

const STATUS_ICON: Record<QuestionStatus, typeof CheckCircle2> = {
  solved: CheckCircle2,
  missed: XCircle,
  skipped: Flag,
  playing: Flag,
};

export function ResultsScreen({ state, previousBest, onPlayAgain }: ResultsScreenProps) {
  const { t, number, percent } = useI18n();
  const hydrated = useHydrated();
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const summary = summarizeGame(state);
  const { mode } = state.config;
  const newRecord = summary.score > 0 && summary.score > previousBest;
  const played = state.questions.filter((q) => q.status !== "playing");

  const title =
    mode === "timed" ? t.results.timeUp : mode === "endless" ? t.results.gameOver : mode === "daily" ? t.daily.done : t.results.title;

  const share = async () => {
    const text =
      mode === "daily" && state.config.dateKey
        ? t.results.shareDaily(dailyNumber(state.config.dateKey), dailyGrid(dailyOutcomes(state)), summary.score)
        : t.results.shareText(t.modes[mode].name, summary.score, summary.correct, summary.answered);
    const outcome = await shareText(text);
    setShareStatus(outcome === "copied" ? t.results.copied : null);
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-6">
      <section className="animate-pop flex flex-col items-center gap-2 text-center" aria-labelledby="results-title">
        <p className="eyebrow">{t.modes[mode].name}</p>
        <h1 id="results-title" className="font-display text-3xl sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-base-content/70">{t.results.finalScore}</p>
        <p className="font-display text-6xl leading-none text-primary tabular-nums sm:text-7xl">{number(summary.score)}</p>
        {newRecord && (
          <p className="badge badge-primary badge-lg mt-2 gap-1.5 font-semibold">
            <Trophy className="size-4" aria-hidden="true" />
            {t.results.newRecord}
          </p>
        )}
      </section>

      <dl className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          [t.results.accuracy, summary.accuracy === null ? "—" : percent(summary.accuracy)],
          [t.results.correct, `${summary.correct}/${summary.answered}`],
          [t.results.bestStreak, String(summary.bestStreak)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-box border border-base-content/10 bg-base-200 p-3 text-center">
            <dt className="text-xs text-base-content/70 sm:text-sm">{label}</dt>
            <dd className="font-wide text-xl font-bold tabular-nums sm:text-2xl">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap justify-center gap-2">
        {onPlayAgain && (
          <button type="button" className="btn btn-primary btn-lg" onClick={onPlayAgain} autoFocus>
            <RotateCcw className="size-5" aria-hidden="true" />
            {t.results.playAgain}
          </button>
        )}
        <Link href="/" className="btn btn-lg">
          <Home className="size-5" aria-hidden="true" />
          {t.results.home}
        </Link>
        {hydrated && canShare() && (
          <button type="button" className="btn btn-lg btn-ghost" onClick={share}>
            <Share2 className="size-5" aria-hidden="true" />
            {t.results.share}
          </button>
        )}
      </div>
      <p role="status" className="min-h-5 text-center text-sm text-success">
        {shareStatus}
      </p>

      {played.length > 0 && (
        <section aria-labelledby="breakdown-title" className="flex flex-col gap-3">
          <h2 id="breakdown-title" className="eyebrow">
            {t.results.breakdown}
          </h2>
          <ol className="flex flex-col gap-2">
            {played.map((q, i) => {
              const car = engine.carsById.get(q.carId);
              if (!car) return null;
              const Icon = STATUS_ICON[q.status];
              const solved = q.status === "solved";
              return (
                <li key={`${q.carId}-${i}`} className="flex gap-3 rounded-box border border-base-content/10 bg-base-100 p-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageRendition(car.image, 640)}
                    alt=""
                    width={96}
                    height={60}
                    loading="lazy"
                    decoding="async"
                    style={{ objectPosition: car.image.position ?? "center" }}
                    className="h-15 w-24 shrink-0 rounded-field bg-base-300 object-cover"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold leading-snug">{carName(car)}</p>
                      <span className="font-wide shrink-0 text-sm font-bold tabular-nums">{t.common.points(q.points)}</span>
                    </div>
                    <p className={`flex items-center gap-1 text-xs font-medium ${solved ? "text-success" : "text-error"}`}>
                      <Icon className="size-3.5" aria-hidden="true" />
                      {t.results.status[q.status]}
                      {q.hintsUsed > 0 && <span className="text-base-content/60"> · {t.results.hintsUsed(q.hintsUsed)}</span>}
                    </p>
                    <p className="truncate text-xs text-base-content/70">
                      {t.results.yourAnswer} {q.guesses.length > 0 ? q.guesses.join(" · ") : t.results.noAnswer}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}
