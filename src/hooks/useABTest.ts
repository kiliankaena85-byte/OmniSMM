'use client';

import { useEffect, useState } from "react";

export type ABVariant = "A" | "B" | "C";

const STORAGE_KEY = "smmplan_ab_variant";

export function useABTest(): ABVariant | null {
  const [variant, setVariant] = useState<ABVariant | null>(null);

  useEffect(() => {
    // 1. Check emergency override env variable
    const forceEnv = process.env.NEXT_PUBLIC_FORCE_AB_VARIANT as ABVariant | undefined;
    if (forceEnv && ["A", "B", "C"].includes(forceEnv)) {
      setVariant(forceEnv);
      return;
    }

    // 2. Check URL query parameter (e.g., ?ab_variant=B)
    // We use window.location directly inside useEffect to prevent Next.js static deopt of useSearchParams
    const urlParams = new URLSearchParams(window.location.search);
    const urlVariant = urlParams.get("ab_variant")?.toUpperCase() as ABVariant | null;

    if (urlVariant && ["A", "B", "C"].includes(urlVariant)) {
      localStorage.setItem(STORAGE_KEY, urlVariant);
      setVariant(urlVariant);
      return;
    }

    // 3. Check localStorage
    const saved = localStorage.getItem(STORAGE_KEY) as ABVariant | null;
    if (saved && ["A", "B", "C"].includes(saved)) {
      setVariant(saved);
      return;
    }

    // 4. Random distribution (33% A, 33% B, 34% C)
    const rand = Math.random();
    let chosen: ABVariant = "A";
    if (rand >= 0.33 && rand < 0.66) {
      chosen = "B";
    } else if (rand >= 0.66) {
      chosen = "C";
    }

    localStorage.setItem(STORAGE_KEY, chosen);
    setVariant(chosen);
  }, []);

  return variant;
}
