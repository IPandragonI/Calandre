"use client";

import { useEffect, useRef } from "react";
import { ArrowRight, CheckCircle2, Flag, Sparkles, XCircle } from "lucide-react";
import type { Car } from "@/types/car";
import type { GameState, QuestionState } from "@/types/game";
import type { AnswerVerdict } from "@/lib/game/answer-validation";
import { carName } from "@/lib/data/dataset";
import { useI18n } from "@/hooks/use-i18n";

interface FeedbackPanelProps {
  car: Car;
  question: QuestionState;
  verdict: AnswerVerdict | null;
  state: GameState;
  onNext: () => void;
}

/** Shown once a car is solved, missed or revealed: the answer, a fun fact, and "next". */
export function FeedbackPanel({ car, question, verdict, state, onNext }: FeedbackPanelProps) {
  const { t, locale } = useI18n();
  const nextRef = useRef<HTMLButtonElement>(null);
  const solved = question.status === "solved";
  const timed = state.config.mode === "timed";
  const willEnd =
    (state.livesLeft !== null && state.livesLeft <= 0) ||
    (state.config.questionCount !== null && state.questions.length >= state.queue.length);

  // Move focus to "Next" so Enter keeps the game flowing.
  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true });
  }, []);

  const headline = solved ? t.game.feedback.correct : question.status === "skipped" ? t.game.feedback.skipped : t.game.feedback.missed;
  const Icon = solved ? CheckCircle2 : question.status === "skipped" ? Flag : XCircle;

  return (
    <section
      className={`animate-pop flex flex-col gap-3 rounded-box border p-4 ${
        solved ? "border-success/40 bg-success/10" : "border-base-content/15 bg-base-200"
      }`}
    >
      <p className={`flex items-center gap-2 font-semibold ${solved ? "text-success" : "text-base-content/80"}`}>
        <Icon className="size-5 shrink-0" aria-hidden="true" />
        {headline}
        {solved && <span className="ml-auto font-wide tabular-nums">{t.game.feedback.points(question.points)}</span>}
      </p>

      <div>
        <p className="text-sm text-base-content/70">{t.game.feedback.itWas}</p>
        <p className="font-display text-2xl leading-tight sm:text-3xl">{carName(car)}</p>
        <p className="text-sm text-base-content/70 tabular-nums">
          {car.years.to === null ? `${car.years.from} –` : car.years.from === car.years.to ? car.years.from : `${car.years.from} – ${car.years.to}`}
        </p>
      </div>

      {solved && verdict?.kind === "correct" && (verdict.precise || verdict.typoTolerated) && (
        <p className="flex items-center gap-1.5 text-sm">
          <Sparkles className="size-4 text-primary" aria-hidden="true" />
          {verdict.precise ? t.game.feedback.precise : t.game.feedback.typo}
        </p>
      )}

      {!timed && (
        <div className="rounded-field bg-base-100 p-3 text-sm leading-relaxed">
          <p className="eyebrow mb-1">{t.game.funFact}</p>
          <p>{car.funFact[locale]}</p>
        </div>
      )}

      {!(timed && solved) && (
        <button ref={nextRef} type="button" onClick={onNext} className="btn btn-primary btn-lg w-full sm:w-auto sm:self-end">
          {willEnd ? t.game.seeResults : t.game.next}
          <ArrowRight className="size-5" aria-hidden="true" />
        </button>
      )}
    </section>
  );
}
