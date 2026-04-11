"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

/**
 * Debounced URL search parameter hook.
 * Updates a URL query param after a delay using startTransition,
 * so React keeps the old UI visible during the server re-fetch.
 */
export function useDebouncedSearch(paramKey = "query", delay = 300) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const urlValue = searchParams.get(paramKey) ?? "";
  const [inputValue, setInputValue] = useState(urlValue);

  // Sync input when URL changes externally (browser back/forward)
  const prevUrlValue = useRef(urlValue);
  useEffect(() => {
    if (urlValue !== prevUrlValue.current) {
      setInputValue(urlValue);
      prevUrlValue.current = urlValue;
    }
  }, [urlValue]);

  // Debounce: fire URL update after delay
  useEffect(() => {
    if (inputValue.trim() === urlValue) return;

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const trimmed = inputValue.trim();

      if (trimmed) {
        params.set(paramKey, trimmed);
      } else {
        params.delete(paramKey);
      }

      prevUrlValue.current = trimmed;
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname);
      });
    }, delay);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue]);

  return { inputValue, setInputValue, isPending };
}
