import { SWAN_BODY, SWAN_EYE, SWAN_FEATHERS, SWAN_FEATHERS_SMALL, SWAN_VIEWBOX } from "@/lib/brand/ornament";

/**
 * The swan mascot, in the current text colour (works on any theme).
 * `simplified` drops detail for very small sizes (≤ 24 px).
 */
export function LogoMark({ className = "h-8 w-12", simplified = false }: { className?: string; simplified?: boolean }) {
  const feathers = simplified ? SWAN_FEATHERS_SMALL : SWAN_FEATHERS;
  return (
    <svg viewBox={SWAN_VIEWBOX} className={className} fill="currentColor" aria-hidden="true" focusable="false">
      {feathers.map((d) => (
        <path key={d} d={d} />
      ))}
      <path d={simplified ? SWAN_BODY : `${SWAN_BODY} ${SWAN_EYE}`} fillRule="evenodd" />
    </svg>
  );
}

/** Full logo: mascot and wordmark. */
export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <LogoMark className="h-7 w-[2.6rem]" />
      <span className="wordmark text-[1.05rem] leading-none">Calandre</span>
    </span>
  );
}

/** Loading state: the swan gently gliding. */
export function LogoLoader({ label }: { label: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-10 text-base-content/70">
      <LogoMark className="h-12 w-[4.5rem] animate-glide text-primary" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
