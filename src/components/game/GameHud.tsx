"use client";

import { Heart, Timer } from "lucide-react";
import type { GameState } from "@/types/game";
import { currentQuestion, TIMED_LIMIT_MS } from "@/lib/game/engine";
import { useI18n } from "@/hooks/use-i18n";

interface GameHudProps {
  state: GameState;
  remainingMs: number;
}

export function GameHud({ state, remainingMs }: GameHudProps) {
  const { t, number } = useI18n();
  const fixed = state.config.questionCount !== null;
  const position = state.questions.length;
  const question = currentQuestion(state);
  const justScored = question.status === "solved" && state.phase === "feedback";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">{t.modes[state.config.mode].name}</p>
          <p className="text-sm font-semibold tabular-nums">
            {fixed ? t.game.progress(position, state.queue.length) : t.game.progressOpen(position)}
          </p>
        </div>

        <dl className="flex items-center gap-4">
          {state.livesLeft !== null && state.config.lives !== null && (
            <div className="flex flex-col items-end">
              <dt className="sr-only">{t.game.lives}</dt>
              <dd className="flex gap-0.5" aria-label={t.game.livesLeft(state.livesLeft)}>
                {Array.from({ length: state.config.lives }, (_, i) => (
                  <Heart
                    key={i}
                    aria-hidden="true"
                    className={`size-5 ${i < state.livesLeft! ? "fill-primary text-primary" : "text-base-content/25"}`}
                  />
                ))}
              </dd>
            </div>
          )}
          <div className="flex flex-col items-end">
            <dt className="eyebrow flex items-center gap-1">
              {t.game.streak}
            </dt>
            <dd className="text-lg font-semibold leading-tight tabular-nums">{state.streak}</dd>
          </div>
          <div className="relative flex flex-col items-end">
            <dt className="eyebrow">{t.game.score}</dt>
            <dd className="text-lg font-semibold leading-tight tabular-nums">{number(state.score)}</dd>
            {justScored && question.points > 0 && (
              <span
                key={state.verdictCount}
                aria-hidden="true"
                className="animate-rise pointer-events-none absolute -top-4 right-0 text-sm font-bold text-success"
              >
                {t.game.feedback.points(question.points)}
              </span>
            )}
          </div>
        </dl>
      </div>

      {fixed && (
        <div className="flex gap-1" aria-hidden="true">
          {state.queue.map((id, i) => {
            const q = state.questions[i];
            const tone =
              !q || q.status === "playing"
                ? i === position - 1
                  ? "bg-base-content/60"
                  : "bg-base-content/15"
                : q.status === "solved"
                  ? "bg-success/80"
                  : "bg-error/60";
            return <span key={`${id}-${i}`} className={`h-1 flex-1 rounded-full transition-colors ${tone}`} />;
          })}
        </div>
      )}

      {state.endsAt !== null && <TimerBar remainingMs={remainingMs} />}
    </div>
  );
}

function TimerBar({ remainingMs }: { remainingMs: number }) {
  const { t } = useI18n();
  const seconds = Math.ceil(remainingMs / 1000);
  const urgent = seconds <= 10;
  const ratio = Math.min(1, remainingMs / TIMED_LIMIT_MS);
  return (
    <div className="flex items-center gap-3" role="timer" aria-label={t.game.timeLeft(seconds)}>
      <Timer className={`size-5 shrink-0 text-base-content/60 ${urgent ? "text-error" : ""}`} aria-hidden="true" />
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-base-300">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ease-linear ${urgent ? "bg-error" : "bg-base-content/70"}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <span
        aria-hidden="true"
        className={`font-display min-w-[3.5ch] text-right text-2xl tabular-nums ${urgent ? "text-error" : ""}`}
      >
        {seconds}
      </span>
    </div>
  );
}
