"use client";

/**
 * Sub-navigation for the Analytics suite: one pill-nav that switches between the
 * single-employee Overview and the six per-metric Compare views. Real routes
 * (Link, prefetched, shareable) — the active pill is derived from usePathname.
 *
 * Compare→Compare links carry the current `?ids=` through, so changing metric
 * keeps the same people selected; the Overview link stays bare because it uses a
 * different single-select param (?employeeId=). The strip is the same frosted,
 * softly-elevated surface as the data Toolbar, and scrolls horizontally on narrow
 * screens (scrollbar hidden) rather than wrapping.
 */

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Handshake,
  LayoutDashboard,
  MapPin,
  Route,
  Target,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon };

const OVERVIEW: NavItem = {
  href: "/report",
  label: "Overview",
  icon: LayoutDashboard,
};

const COMPARE: NavItem[] = [
  { href: "/report/compare/meetings", label: "Meetings", icon: Handshake },
  { href: "/report/compare/dispatch", label: "Dispatch", icon: Truck },
  { href: "/report/compare/visits", label: "Visits", icon: MapPin },
  { href: "/report/compare/conversion", label: "Conversion", icon: Target },
  { href: "/report/compare/tour", label: "Tour", icon: Route },
  { href: "/report/compare/costing", label: "Costing", icon: Wallet },
];

export function ReportNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const ids = searchParams.get("ids");
  const compareQs = ids ? `?ids=${ids}` : "";

  const isActive = (href: string) =>
    href === "/report" ? pathname === "/report" : pathname === href;

  return (
    <nav
      className={cn(
        "flex items-center gap-1 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/85 p-1.5 backdrop-blur-md",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-20px_rgba(79,70,229,0.25)]",
        "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      )}
      aria-label="Report views"
    >
      <PillLink
        item={OVERVIEW}
        href={OVERVIEW.href}
        active={isActive(OVERVIEW.href)}
      />

      <span
        className="mx-0.5 h-5 w-px shrink-0 self-center bg-slate-200"
        aria-hidden
      />
      <span className="shrink-0 px-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        Compare
      </span>

      {COMPARE.map((item) => (
        <PillLink
          key={item.href}
          item={item}
          href={`${item.href}${compareQs}`}
          active={isActive(item.href)}
        />
      ))}
    </nav>
  );
}

function PillLink({
  item,
  href,
  active,
}: {
  item: NavItem;
  href: string;
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100 shadow-[0_1px_2px_rgba(79,70,229,0.08)]"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 transition-colors",
          active
            ? "text-indigo-500"
            : "text-slate-400 group-hover:text-slate-500",
        )}
      />
      {item.label}
    </Link>
  );
}
