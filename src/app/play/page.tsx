import { Suspense } from "react";
import { PlayClient } from "./PlayClient";

export default function PlayPage() {
  return (
    // The game reads its mode from the URL and its state from localStorage: client-only.
    <Suspense fallback={<div className="mx-auto mt-6 aspect-[16/10] w-[calc(100%-2rem)] max-w-5xl animate-pulse rounded-box bg-base-200" />}>
      <PlayClient />
    </Suspense>
  );
}
