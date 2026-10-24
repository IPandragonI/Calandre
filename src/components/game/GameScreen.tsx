"use client";

import { useRef } from "react";
import { Eye, SkipForward, Square } from "lucide-react";
import type { GameState } from "@/types/game";
import { carName } from "@/lib/data/dataset";
import { useGame } from "@/hooks/use-game";
import { useI18n } from "@/hooks/use-i18n";
import { AnswerForm } from "./AnswerForm";
import { CarPhoto } from "./CarPhoto";
import { FeedbackPanel } from "./FeedbackPanel";
import { GameHud } from "./GameHud";
import { HintPanel } from "./HintPanel";
import { ResultsScreen } from "./ResultsScreen";

interface GameScreenProps {
  initial: GameState;
  onPlayAgain: (finished: GameState) => void;
}

export function GameScreen({ initial, onPlayAgain }: GameScreenProps) {
  const game = useGame(initial);
  const { state, question, car } = game;
  const { t } = useI18n();
  const quitDialog = useRef<HTMLDialogElement>(null);

  if (state.phase === "over") {
    return (
      <ResultsScreen
        state={state}
        previousBest={game.previousBest}
        onPlayAgain={state.config.mode === "daily" ? undefined : () => onPlayAgain(state)}
      />
    );
  }

  const { mode, maxAttempts } = state.config;
  const revealed = state.phase === "feedback";
  // One-shot modes (endless) have nothing to count down.
  const attemptsLeft = maxAttempts === null || maxAttempts === 1 ? null : maxAttempts - question.guesses.length;
  const giveUpLabel = mode === "timed" ? t.game.skip : mode === "endless" ? t.game.revealEndless : t.game.reveal;
  const GiveUpIcon = mode === "timed" ? SkipForward : Eye;
  const announcement = !revealed
    ? ""
    : question.status === "solved"
      ? t.game.announceCorrect(carName(car), question.points)
      : t.game.announceMissed(carName(car));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pt-4">
      <GameHud state={state} remainingMs={game.remainingMs} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
        <CarPhoto
          key={`${state.questions.length}-${car.id}`}
          car={car}
          number={state.questions.length}
          revealed={revealed}
          onReplace={mode === "daily" ? undefined : game.replaceCar}
        />

        <div className="flex flex-col gap-4">
          {revealed ? (
            <FeedbackPanel
              key={state.questions.length}
              car={car}
              question={question}
              verdict={state.lastVerdict}
              state={state}
              onNext={game.next}
            />
          ) : (
            <>
              <AnswerForm
                key={state.questions.length}
                onSubmit={game.submit}
                verdict={state.lastVerdict}
                verdictCount={state.verdictCount}
                attemptsLeft={attemptsLeft}
              />
              <HintPanel car={car} hintsUsed={question.hintsUsed} onHint={game.hint} disabled={revealed} />
              <div className="flex items-center justify-between gap-2 border-t border-base-content/10 pt-3">
                <button type="button" className="btn btn-ghost min-h-11" onClick={game.reveal}>
                  <GiveUpIcon className="size-4" aria-hidden="true" />
                  {giveUpLabel}
                </button>
                <button type="button" className="btn btn-ghost min-h-11 text-base-content/70" onClick={() => quitDialog.current?.showModal()}>
                  <Square className="size-4" aria-hidden="true" />
                  {t.game.quit}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <p className="sr-only" aria-live="assertive">
        {announcement}
      </p>

      <dialog ref={quitDialog} className="modal modal-bottom sm:modal-middle" aria-labelledby="quit-title">
        <div className="modal-box">
          <h2 id="quit-title" className="text-lg font-semibold">
            {t.game.quitConfirm}
          </h2>
          <form method="dialog" className="modal-action">
            <button className="btn" autoFocus>
              {t.game.quitCancel}
            </button>
            <button className="btn btn-primary" onClick={game.quit}>
              {t.game.quit}
            </button>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button tabIndex={-1}>{t.common.close}</button>
        </form>
      </dialog>
    </div>
  );
}
