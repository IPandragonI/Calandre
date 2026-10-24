"use client";

import { Lightbulb } from "lucide-react";
import type { Car } from "@/types/car";
import { hintsFor } from "@/lib/data/dataset";
import { HINT_COUNT } from "@/lib/game/engine";
import { HINT_PENALTY } from "@/lib/game/scoring";
import { useI18n } from "@/hooks/use-i18n";

interface HintPanelProps {
  car: Car;
  hintsUsed: number;
  onHint: () => void;
  disabled: boolean;
}

export function HintPanel({ car, hintsUsed, onHint, disabled }: HintPanelProps) {
  const { t, locale } = useI18n();
  const hints = hintsFor(car, t, locale).slice(0, hintsUsed);
  const remaining = HINT_COUNT - hintsUsed;

  return (
    <section aria-labelledby="hints-title" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 id="hints-title" className="eyebrow">
          {t.game.hintsTitle} · {hintsUsed}/{HINT_COUNT}
        </h2>
        <button
          type="button"
          onClick={onHint}
          disabled={disabled || remaining === 0}
          className="btn btn-sm btn-outline min-h-11 gap-1.5"
        >
          <Lightbulb className="size-4" aria-hidden="true" />
          {t.game.hint}
          <span className="text-xs font-normal opacity-70">{t.game.hintCost(HINT_PENALTY)}</span>
        </button>
      </div>
      {hints.length > 0 && (
        <ol className="flex flex-col gap-1.5" aria-live="polite">
          {hints.map((hint, i) => (
            <li key={i} className="animate-fade-up flex gap-2 rounded-field bg-base-200 px-3 py-2 text-sm">
              <span className="eyebrow shrink-0 pt-px">{t.game.hintLabels[i]}</span>
              <span>{hint}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
