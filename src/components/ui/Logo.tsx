/** Brand mark: a stylised radiator grille with one racing-orange slat. */
export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <rect x="1.5" y="5.5" width="29" height="21" rx="7" fill="none" stroke="currentColor" strokeWidth="3" />
      <rect x="7" y="11" width="18" height="2.6" rx="1.3" fill="currentColor" />
      <rect x="7" y="14.7" width="18" height="2.6" rx="1.3" className="fill-primary" />
      <rect x="7" y="18.4" width="18" height="2.6" rx="1.3" fill="currentColor" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <LogoMark />
      <span className="font-display text-xl leading-none">Calandre</span>
    </span>
  );
}
