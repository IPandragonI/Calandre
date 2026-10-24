"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import type { AnswerVerdict } from "@/lib/game/answer-validation";
import { useI18n } from "@/hooks/use-i18n";

interface AnswerFormProps {
  onSubmit: (answer: string) => void;
  verdict: AnswerVerdict | null;
  /** Changes on every submission, to replay the feedback animation. */
  verdictCount: number;
  attemptsLeft: number | null;
}

export function AnswerForm({ onSubmit, verdict, verdictCount, attemptsLeft }: AnswerFormProps) {
  const { t } = useI18n();
  const [answer, setAnswer] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus on mount (each new car remounts the form); skip on touch devices
  // so the keyboard doesn't hide the photo before the player has seen it.
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus();
  }, []);

  const wrong = verdict?.kind === "wrong";

  // Shake on a wrong answer, without remounting (and unfocusing) the input.
  const fieldRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!wrong || !fieldRef.current) return;
    const reduced =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.dataset.reducedMotion === "true";
    if (reduced) return;
    fieldRef.current.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-6px)" },
        { transform: "translateX(5px)" },
        { transform: "translateX(-3px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 360, easing: "ease-in-out" },
    );
  }, [wrong, verdictCount]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(answer);
    // Selected text is replaced by the next attempt, yet stays editable for a near miss.
    inputRef.current?.select();
  };
  const message = feedbackText(verdict, attemptsLeft, t);
  const messageId = "answer-feedback";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2" noValidate>
      <label htmlFor="answer" className="sr-only">
        {t.game.inputLabel}
      </label>
      <div ref={fieldRef} className="join w-full">
        <input
          ref={inputRef}
          id="answer"
          name="answer"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
          enterKeyHint="go"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder={t.game.placeholder}
          aria-describedby={messageId}
          aria-invalid={wrong || undefined}
          className={`input join-item input-lg w-full min-w-0 text-base sm:text-lg ${wrong ? "input-error" : ""}`}
        />
        <button type="submit" className="btn btn-primary btn-lg join-item min-w-14 px-4 sm:px-6">
          <span className="hidden sm:inline">{t.game.submit}</span>
          <ArrowRight className="size-5" aria-hidden="true" />
          <span className="sr-only sm:hidden">{t.game.submit}</span>
        </button>
      </div>
      <p id={messageId} role="status" aria-live="polite" className="min-h-5 text-sm">
        {message && (
          <span key={verdictCount} className={`animate-fade-up inline-block ${message.tone}`}>
            {message.text}
          </span>
        )}
      </p>
    </form>
  );
}

function feedbackText(
  verdict: AnswerVerdict | null,
  attemptsLeft: number | null,
  t: ReturnType<typeof useI18n>["t"],
): { text: string; tone: string } | null {
  if (!verdict) {
    return attemptsLeft !== null && attemptsLeft < 3 ? { text: t.game.attemptsLeft(attemptsLeft), tone: "text-base-content/70" } : null;
  }
  switch (verdict.kind) {
    case "empty":
      return { text: t.game.feedback.empty, tone: "text-base-content/70" };
    case "close":
      return { text: `${t.game.feedback.close[verdict.reason]} ${t.game.feedback.notCounted}`, tone: "text-info font-medium" };
    case "wrong":
      return {
        text: attemptsLeft === null ? t.game.feedback.wrong : t.game.feedback.wrongTryAgain(attemptsLeft),
        tone: "text-error font-medium",
      };
    case "correct":
      return null;
  }
}
