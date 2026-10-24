"use client";

import { useState } from "react";
import { ImageOff, RefreshCw, Shuffle } from "lucide-react";
import type { Car } from "@/types/car";
import { imageRendition } from "@/lib/data/dataset";
import { useI18n } from "@/hooks/use-i18n";
import { useOnline } from "@/components/layout/OfflineBanner";

interface CarPhotoProps {
  car: Car;
  /** Questions are numbered like magazine plates: "N°04". */
  number: number;
  revealed: boolean;
  /** Offered when the photo fails to load (not in the daily challenge). */
  onReplace?: () => void;
}

/**
 * The hero photo, in a fixed 16:10 frame so nothing shifts while it loads.
 * The descriptive alt text is withheld until the answer is revealed.
 */
export function CarPhoto({ car, number, revealed, onReplace }: CarPhotoProps) {
  const { t, locale } = useI18n();
  const online = useOnline();
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const { image } = car;

  return (
    <figure className="flex flex-col gap-1.5">
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-box bg-base-300 shadow-sm ring-1 ring-base-content/10">
        {status !== "error" && (
          // Plain <img>: renditions are pre-generated, so the page also works on static hosting.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={attempt}
            src={imageRendition(image, 1200)}
            srcSet={`${imageRendition(image, 640)} 640w, ${imageRendition(image, 1200)} 1200w`}
            sizes="(min-width: 1024px) 640px, (min-width: 768px) 90vw, 100vw"
            width={image.width}
            height={image.height}
            alt={revealed ? image.alt[locale] : t.game.photoAlt}
            fetchPriority="high"
            decoding="async"
            draggable={false}
            onLoad={() => setStatus("loaded")}
            onError={() => setStatus("error")}
            style={{ objectPosition: image.position ?? "center" }}
            className={`absolute inset-0 size-full object-cover transition-opacity duration-300 ${
              status === "loaded" ? "opacity-100" : "opacity-0"
            } ${revealed ? "animate-reveal" : ""}`}
          />
        )}

        {status === "loading" && <div className="absolute inset-0 animate-pulse bg-base-300" aria-hidden="true" />}

        {status === "error" && (
          <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
            <ImageOff className="size-8 text-base-content/60" aria-hidden="true" />
            <p className="text-sm font-medium">{online ? t.game.imageError : t.game.imageOffline}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                className="btn btn-sm min-h-11"
                onClick={() => {
                  setStatus("loading");
                  setAttempt((a) => a + 1);
                }}
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                {t.game.retry}
              </button>
              {onReplace && (
                <button type="button" className="btn btn-sm btn-primary min-h-11" onClick={onReplace}>
                  <Shuffle className="size-4" aria-hidden="true" />
                  {t.game.changeCar}
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
      </div>

      <figcaption className="truncate px-1 text-[0.7rem] text-base-content/60" title={`${image.author} · ${image.license}`}>
        {t.game.photoBy} {image.author} · {image.license}
        {revealed && (
          <>
            {" · "}
            <a href={image.sourcePage} target="_blank" rel="noopener noreferrer" className="link">
              {t.game.source}
            </a>
          </>
        )}
      </figcaption>
    </figure>
  );
}
