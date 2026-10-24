"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleAlert } from "lucide-react";
import type { GameState } from "@/types/game";
import { DailyDone } from "@/components/game/DailyDone";
import { GameScreen } from "@/components/game/GameScreen";
import { initGame, type GameRequest } from "@/hooks/use-game";
import { useHydrated } from "@/hooks/use-persistent";
import { useI18n } from "@/hooks/use-i18n";
import { parsePlayParams, playHref } from "@/lib/game/routes";

export function PlayClient() {
  const searchParams = useSearchParams();
  const hydrated = useHydrated();
  const router = useRouter();
  const [round, setRound] = useState(0);
  const request = parsePlayParams(searchParams);

  if (!hydrated) return <GameLoading />;

  const playAgain = (finished: GameState) => {
    router.replace(playHref(finished.config), { scroll: true });
    setRound((r) => r + 1);
  };

  return <GameSession key={`${round}-${searchParams.toString()}`} request={request} onPlayAgain={playAgain} />;
}

function GameSession({ request, onPlayAgain }: { request: GameRequest; onPlayAgain: (finished: GameState) => void }) {
  const { t } = useI18n();
  // Created once per mount; storage and the clock are only read on the client.
  const [init] = useState(() => initGame(request, Date.now()));

  if (init.kind === "daily-done") return <DailyDone dateKey={init.dateKey} result={init.result} />;
  if (init.kind === "unavailable") {
    return (
      <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 pt-12 text-center">
        <CircleAlert className="size-10 text-warning" aria-hidden="true" />
        <p>{t.game.notEnoughCars}</p>
        <Link href="/" className="btn btn-primary">
          {t.results.home}
        </Link>
      </div>
    );
  }
  return <GameScreen initial={init.state} onPlayAgain={onPlayAgain} />;
}

function GameLoading() {
  const { t } = useI18n();
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pt-4" aria-busy="true">
      <p className="sr-only">{t.game.loading}</p>
      <div className="h-12 animate-pulse rounded-box bg-base-200" />
      <div className="aspect-[16/10] w-full animate-pulse rounded-box bg-base-200 lg:w-3/5" />
    </div>
  );
}
