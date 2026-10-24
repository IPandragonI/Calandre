"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleAlert } from "lucide-react";
import type { GameState } from "@/types/game";
import type { EngineContext } from "@/lib/game/engine";
import { DailyDone } from "@/components/game/DailyDone";
import { GameScreen } from "@/components/game/GameScreen";
import { CatalogueGate } from "@/components/ui/CatalogueGate";
import { initGame, type GameRequest } from "@/hooks/use-game";
import { useI18n } from "@/hooks/use-i18n";
import { parsePlayParams, playHref } from "@/lib/game/routes";

export function PlayClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [round, setRound] = useState(0);
  const request = parsePlayParams(searchParams);

  const playAgain = (finished: GameState) => {
    router.replace(playHref(finished.config), { scroll: true });
    setRound((r) => r + 1);
  };

  return (
    <CatalogueGate>
      {({ engine }) => (
        <GameSession key={`${round}-${searchParams.toString()}`} engine={engine} request={request} onPlayAgain={playAgain} />
      )}
    </CatalogueGate>
  );
}

function GameSession({
  engine,
  request,
  onPlayAgain,
}: {
  engine: EngineContext;
  request: GameRequest;
  onPlayAgain: (finished: GameState) => void;
}) {
  const { t } = useI18n();
  // Created once per mount; storage and the clock are only read on the client.
  const [init] = useState(() => initGame(engine, request, Date.now()));

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
  return <GameScreen engine={engine} initial={init.state} onPlayAgain={onPlayAgain} />;
}
