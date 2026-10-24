"use client";

import { useEffect, useState } from "react";
import { ImageOff, Info, RefreshCw, Shuffle, X } from "lucide-react";
import type { Car } from "@/types/car";
import { carName, imageSrcSet } from "@/lib/data/dataset";
import { useI18n } from "@/hooks/use-i18n";
import { useOnline } from "@/components/layout/OfflineBanner";
import { LogoMark } from "@/components/ui/Logo";

interface CarPhotoProps {
  car: Car;
  /** Questions are numbered like magazine plates: "N°04". */
  number: number;
  revealed: boolean;
  /** Zoom mode: 1 = full photo, larger = close-up on the centre. */
  zoom?: number;
  /** Offered when the photo fails to load. */
  onReplace?: () => void;
}

/** After this long without the photo, the player is offered a way out. */
const SLOW_MS = 10_000;

/**
 * The hero photo, hotlinked from Wikimedia Commons in a fixed 16:10 frame so nothing
 * shifts while it loads. The descriptive alt text is withheld until the answer is revealed.
 */
export function CarPhoto({ car, number, revealed, zoom = 1, onReplace }: CarPhotoProps) {
  const { t, locale } = useI18n();
  const online = useOnline();
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [slow, setSlow] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [infoOpen, setInfoOpen] = useState(false);
  const { image } = car;

  useEffect(() => {
    if (status !== "loading") return;
    const timer = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(timer);
  }, [status, attempt]);

  const showFallback = status === "error" || (slow && status === "loading");

  return (
    <figure className="flex flex-col gap-1.5" data-car-id={car.id}>
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-box bg-base-300 shadow-sm ring-1 ring-base-content/10">
        {status !== "error" && (
          // Plain <img>: the photo stays on Wikimedia's servers; an optimisation proxy would re-host it.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={attempt}
            src={image.url}
            srcSet={imageSrcSet(image)}
            sizes="(min-width: 1024px) 640px, (min-width: 768px) 90vw, 100vw"
            width={image.width}
            height={image.height}
            alt={revealed ? t.game.photoAltRevealed(carName(car)) : t.game.photoAlt}
            fetchPriority="high"
            decoding="async"
            draggable={false}
            onLoad={() => {
              setStatus("loaded");
              setSlow(false);
            }}
            onError={() => setStatus("error")}
            style={{
              objectPosition: image.position ?? "center",
              transform: revealed ? undefined : `scale(${zoom})`,
            }}
            className={`absolute inset-0 size-full object-cover transition-[opacity,transform] duration-500 ease-out ${
              status === "loaded" ? "opacity-100" : "opacity-0"
            } ${revealed ? "animate-reveal" : ""}`}
          />
        )}

        {status === "loading" && !slow && (
          <div className="absolute inset-0 grid place-items-center bg-base-300" aria-hidden="true">
            <LogoMark className="size-12 animate-glide text-base-content/25" />
          </div>
        )}

        {showFallback && (
          <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-base-300/95 p-4 text-center">
            <ImageOff className="size-8 text-base-content/60" aria-hidden="true" />
            <p className="max-w-sm text-sm font-medium">
              {!online ? t.game.imageOffline : status === "error" ? t.game.imageError : t.game.imageSlow}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {online && (
                <button
                  type="button"
                  className="btn btn-sm min-h-11"
                  onClick={() => {
                    setStatus("loading");
                    setSlow(false);
                    setAttempt((a) => a + 1);
                  }}
                >
                  <RefreshCw className="size-4" aria-hidden="true" />
                  {t.game.retry}
                </button>
              )}
              {onReplace && (
                <button type="button" className="btn btn-sm btn-primary min-h-11" onClick={onReplace}>
                  <Shuffle className="size-4" aria-hidden="true" />
                  {t.game.changeCar}
                  <span className="text-xs font-normal opacity-80">· {t.game.changeCarHelp}</span>
                </button>
              )}
            </div>
          </div>
        )}

        <span
          aria-hidden="true"
          className="font-display pointer-events-none absolute left-3 top-2.5 rounded-md bg-base-100/85 px-2 py-0.5 text-sm tabular-nums shadow-sm"
        >
          N°{String(number).padStart(2, "0")}
        </span>
        {zoom > 1 && !revealed && <span className="sr-only">{t.game.zoomed}</span>}

        <button
          type="button"
          onClick={() => setInfoOpen((open) => !open)}
          aria-expanded={infoOpen}
          aria-label={t.game.photoInfo}
          className="btn btn-circle btn-sm absolute right-2.5 top-2.5 border-0 bg-base-100/85 shadow-sm"
        >
          {infoOpen ? <X className="size-4" aria-hidden="true" /> : <Info className="size-4" aria-hidden="true" />}
        </button>
        {infoOpen && (
          <div className="animate-fade-up absolute inset-x-2.5 bottom-2.5 rounded-field bg-base-100/95 p-3 text-xs shadow-md">
            <p className="font-semibold">{t.game.photoInfo}</p>
            <p>
              {t.game.photoBy} {image.author}
            </p>
            <p>
              {t.game.license}
              {t.common.colon}{" "}
              {image.licenseUrl ? (
                <a className="link" href={image.licenseUrl} target="_blank" rel="noopener noreferrer license">
                  {image.license}
                </a>
              ) : (
                image.license
              )}
            </p>
            {/* The file page names the car: only linked once the answer is out. */}
            {revealed && (
              <a className="link" href={image.sourcePage} target="_blank" rel="noopener noreferrer">
                {t.game.source} — Wikimedia Commons
              </a>
            )}
          </div>
        )}
      </div>

      <figcaption className="truncate px-1 text-[0.7rem] text-base-content/60" title={`${image.author} · ${image.license}`} lang={locale}>
        {t.game.photoBy} {image.author} · {image.license}
      </figcaption>
    </figure>
  );
}
