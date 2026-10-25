"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarCheck, Home, Play, Share2 } from "lucide-react";
import { dailyNumber } from "@/lib/game/daily-challenge";
import { playHref } from "@/lib/game/routes";
import { canShare, dailyGrid, shareText } from "@/lib/share";
import type { DailyResult } from "@/lib/stats/statistics";
import { useHydrated } from "@/hooks/use-persistent";
import { useI18n } from "@/hooks/use-i18n";

/** Shown when today's challenge has already been played on this device. */
export function DailyDone({ dateKey, result }: { dateKey: string; result: DailyResult }) {
  const { t, date } = useI18n();
  const hydrated = useHydrated();
  const [status, setStatus] = useState<string | null>(null);
  const grid = dailyGrid(result.outcomes);

  const share = async () => {
    const outcome = await shareText(t.results.shareDaily(dailyNumber(dateKey), grid, result.score));
    setStatus(outcome === "copied" ? t.results.copied : null);
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 pt-10 text-center">
      <CalendarCheck className="size-8 text-base-content/50" aria-hidden="true" />
      <p className="eyebrow">
        {t.daily.title} · {t.daily.number(dailyNumber(dateKey))} · {date(dateKey, { day: "numeric", month: "long" })}
      </p>
      <h1 className="font-display text-2xl">{t.daily.done}</h1>
      <p className="text-2xl tracking-widest" role="img" aria-label={t.daily.result(result.correct, result.total, result.score)}>
        {grid}
      </p>
      <p className="font-semibold tabular-nums">{t.daily.result(result.correct, result.total, result.score)}</p>
      <p className="text-base-content/70">{t.daily.comeBack}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href={playHref({ mode: "classic" })} className="btn btn-primary">
          <Play className="size-4" aria-hidden="true" />
          {t.modes.classic.name}
        </Link>
        <Link href="/" className="btn border-base-content/20 bg-base-100">
          <Home className="size-4" aria-hidden="true" />
          {t.results.home}
        </Link>
        {hydrated && canShare() && (
          <button type="button" className="btn btn-ghost" onClick={share}>
            <Share2 className="size-4" aria-hidden="true" />
            {t.results.share}
          </button>
        )}
      </div>
      <p role="status" className="min-h-5 text-sm text-success">
        {status}
      </p>
    </div>
  );
}
