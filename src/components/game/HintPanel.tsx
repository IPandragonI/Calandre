"use client";

import { Lightbulb } from "lucide-react";
import type { Car } from "@/types/car";
import { hintsFor } from "@/lib/data/dataset";
import { HINT_PENALTY } from "@/lib/game/scoring";
import { useI18n } from "@/hooks/use-i18n";

interface HintPanelProps {
  car: Car;
  hintsUsed: number;
  onHint: () => void;
  disabled: boolean;
  /** Brand challenge: the make is known, so it isn't offered as a hint. */
  makeKnown?: boolean;
}

/** Progressive hints: only those the car's data supports (2 to 4), each costing points. */
export function HintPanel({ car, hintsUsed, onHint, disabled, makeKnown = false }: HintPanelProps) {
  const { t, locale } = useI18n();
  const all = hintsFor(car, t, locale, { makeKnown });
  const shown = all.slice(0, hintsUsed);
  const remaining = all.length - hintsUsed;
  if (all.length === 0) return null;

  return (
    <section aria-labelledby="hints-title" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 id="hints-title" className="eyebrow">
          {t.game.hintsTitle} · {hintsUsed}/{all.length}
        </h2>
        <button
          type="button"
          onClick={onHint}
          disabled={disabled || remaining <= 0}
          className="btn btn-sm min-h-11 gap-1.5 border-base-content/20 bg-base-100 font-medium"
        >
          <Lightbulb className="size-4" aria-hidden="true" />
          {t.game.hint}
          <span className="text-xs font-normal opacity-70">{t.game.hintCost(HINT_PENALTY)}</span>
        </button>
      </div>
      {shown.length > 0 && (
        <ol className="flex flex-col gap-1.5" aria-live="polite">
          {shown.map((hint) => (
            <li key={hint.kind} className="animate-fade-up flex gap-3 border-l-2 border-base-content/20 py-1 pl-3 text-sm">
              <span className="eyebrow shrink-0 pt-px">{t.game.hintLabels[hint.kind]}</span>
              <span>{hint.text}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
