"use client";

/**
 * Global navigation feedback — the millisecond a nav link is clicked.
 *
 * THE PROBLEM
 * Every dashboard route is a server component that awaits Supabase before it
 * can render. Next.js keeps the OUTGOING page fully interactive and at 100%
 * opacity for that whole window, so a click on the sidebar looks like nothing
 * happened for 2–3s. `loading.tsx` only helps once the new segment commits,
 * and per-component `useTransition` only sees its own navigations.
 *
 * THE APPROACH — intercept at the DOM, clear on commit
 * A single capture-phase click listener on `document` sees every `<Link>` in
 * the app (sidebar, report nav pills, anything added later) without those
 * components knowing this exists. That's the key architectural choice: it's
 * zero-touch, so nobody has to remember to wire a new link up.
 *
 * We flip `routePendingStore` on, and clear it when `usePathname()` /
 * `useSearchParams()` change — i.e. when the new route actually commits. For a
 * route with a `loading.tsx`, that commit IS the skeleton appearing, so the
 * hand-off is seamless: outgoing page dims → skeleton appears and the dim
 * lifts. Programmatic `router.push`es can't be seen by a click listener, which
 * is correct — those are same-route param changes that already mirror into the
 * in-page `navigationPendingStore` and dim only their own cards.
 *
 * Only genuine cross-PATH navigations count: modified clicks (new tab), new
 * targets, downloads, external origins, hash links and same-path clicks are all
 * ignored, so the bar never appears for something that isn't a page load.
 */

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { routePendingStore, useRoutePending } from "@/lib/navigation-pending";
import { cn } from "@/lib/utils";

/** Failsafe: clear the indicator if a navigation never commits (a redirect
 *  back to the same URL, or a server action that swallows the nav). Without
 *  this the bar could animate forever on an edge case. */
const STUCK_TIMEOUT_MS = 8000;

export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pending = useRoutePending();

  // Start: any left-click on an internal link heading somewhere new.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }

      const target = e.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (anchor.hasAttribute("download")) return;
      const anchorTarget = anchor.getAttribute("target");
      if (anchorTarget && anchorTarget !== "_self") return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // Same path = either a no-op or a query-only update handled locally.
      if (url.pathname === window.location.pathname) return;

      routePendingStore.start();
    };

    document.addEventListener("click", onClick, { capture: true });
    return () =>
      document.removeEventListener("click", onClick, { capture: true });
  }, []);

  // Clear: the new route committed (pathname and/or query changed).
  useEffect(() => {
    routePendingStore.reset();
  }, [pathname, searchParams]);

  // Clear: nothing committed within the timeout — don't animate forever.
  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => routePendingStore.reset(), STUCK_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [pending]);

  return (
    <div
      aria-hidden={!pending}
      role="progressbar"
      aria-busy={pending}
      aria-label="Loading page"
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden transition-opacity duration-200",
        pending ? "opacity-100" : "opacity-0",
      )}
    >
      {pending && (
        <div className="h-full w-full origin-left animate-route-progress bg-gradient-to-r from-indigo-400 via-indigo-600 to-violet-500 shadow-[0_0_12px_rgba(79,70,229,0.6)]" />
      )}
    </div>
  );
}

/**
 * Wraps the routed content and makes the OUTGOING page visibly inert while the
 * next route resolves: slightly faded, a hair blurred, and pointer-events off
 * so a second impatient click can't queue a second navigation.
 *
 * Deliberately subtle (and 150ms in / 200ms out) so a fast, prefetched nav
 * reads as a gentle flicker rather than a flash of "loading" — while a genuinely
 * slow one is unmistakably busy.
 */
export function RouteTransitionDimmer({
  children,
}: {
  children: React.ReactNode;
}) {
  const pending = useRoutePending();
  return (
    <div
      className={cn(
        "min-w-0 transition-[opacity,filter] duration-200 ease-out",
        pending && "pointer-events-none opacity-60 blur-[1.5px] duration-150",
      )}
    >
      {children}
    </div>
  );
}
