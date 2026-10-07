"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bus,
  Calendar,
  CalendarDays,
  CalendarRange,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  NotebookPen,
  Settings,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { LiveClock } from "@/components/clock";
import { InstallBanner } from "@/components/pwa";
import { BellButton, NotificationsModal, NotificationsProvider } from "@/components/notifications";
import type { NotificationItem } from "@/lib/notifications";
import { cn } from "@/lib/colors";
import { SiteFooter } from "@/components/site-footer";

const NAV = [
  { href: "/", label: "Pregled", icon: LayoutDashboard, exact: true },
  { href: "/urnik", label: "Urnik", icon: CalendarRange },
  { href: "/avtobus", label: "Avtobus", icon: Bus },
  { href: "/dogodki", label: "Dogodki", icon: CalendarDays },
  { href: "/koledar", label: "Koledar", icon: Calendar },
  { href: "/ocene", label: "Ocene", icon: GraduationCap },
  { href: "/belezke", label: "Beležke", icon: NotebookPen },
  { href: "/nastavitve", label: "Nastavitve", icon: Settings },
];

type ShellProps = {
  userName: string;
  userEmail: string;
  yearName: string | null;
  dateLabel: string;
  notifications: NotificationItem[];
  children: ReactNode;
};

export function Shell({ userName, userEmail, yearName, dateLabel, notifications, children }: ShellProps) {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <NotificationsProvider items={notifications}>
    <div className="safe-x min-h-dvh">
      {/* Namizna stranska vrstica */}
      <aside className="safe-aside no-print fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-line bg-side text-ink lg:flex">
        <div className="flex items-center gap-3 px-6 pt-7 pb-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-spruce to-spruce-2 text-white shadow-[0_10px_24px_-12px_color-mix(in_srgb,var(--color-spruce)_70%,transparent)]">
            <CalendarDays className="h-5.5 w-5.5" strokeWidth={2.2} />
          </span>
          <div>
            <p className="font-display text-lg leading-tight font-semibold">Šolski urnik</p>
            <p className="text-[10px] font-semibold tracking-[0.2em] text-ink-faint uppercase">
              zasebni pregled
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] font-medium transition-colors",
                isActive(item.href, item.exact)
                  ? "bg-gradient-to-br from-spruce to-spruce-2 text-white shadow-[0_10px_24px_-10px_color-mix(in_srgb,var(--color-spruce)_65%,transparent)]"
                  : "text-ink-soft hover:bg-spruce/10 hover:text-brand-ink",
              )}
            >
              <item.icon className="h-4.5 w-4.5" strokeWidth={2.1} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="space-y-4 px-4 pt-4 pb-6">
          {yearName ? (
            <div className="rounded-xl border border-line bg-card/70 px-4 py-3">
              <p className="text-[10px] font-semibold tracking-[0.18em] text-ink-faint uppercase">
                Šolsko leto
              </p>
              <p className="font-display mt-1 text-lg font-semibold text-ink">{yearName}</p>
            </div>
          ) : null}

          <div className="flex items-center gap-3 px-1">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-spruce/15 text-xs font-bold text-brand-ink">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-ink">{userName}</p>
              <p className="truncate text-[11px] text-ink-faint">{userEmail}</p>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                title="Odjava"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-spruce/10 hover:text-brand-ink"
              >
                <LogOut className="h-4 w-4" strokeWidth={2.1} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Mobilna zgornja vrstica */}
      <header className="safe-topbar no-print sticky top-0 z-30 flex items-center justify-between border-b border-line bg-paper/85 px-4 pb-3 backdrop-blur-md lg:hidden">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-spruce text-amber">
            <CalendarDays className="h-4.5 w-4.5" strokeWidth={2.2} />
          </span>
          <span className="font-display text-base font-semibold">Šolski urnik</span>
        </Link>
        <div className="flex items-center gap-2">
          <LiveClock dateLabel={dateLabel} />
          <BellButton />
          <form action={logoutAction}>
            <button
              type="submit"
              title="Odjava"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-white"
            >
              <LogOut className="h-4 w-4" strokeWidth={2.1} />
            </button>
          </form>
        </div>
      </header>

      {/* Mobilna spodnja navigacija */}
      <nav className="safe-bottomnav no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 backdrop-blur-md lg:hidden">
        <div className="flex overflow-x-auto px-2 py-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-[68px] flex-1 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-semibold",
                isActive(item.href, item.exact) ? "text-spruce" : "text-ink-faint",
              )}
            >
              <item.icon
                className={cn("h-5 w-5", isActive(item.href, item.exact) && "text-amber-strong")}
                strokeWidth={2.1}
              />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      <InstallBanner />

      {/* Vsebina */}
      <div className="lg:pl-[264px]">
        <div className="safe-topbar no-print sticky top-0 z-30 hidden items-center justify-end gap-3 border-b border-line/70 bg-paper/80 px-8 pb-3 backdrop-blur-md lg:flex">
          <LiveClock dateLabel={dateLabel} />
          <BellButton />
        </div>
        <main className="mx-auto w-full max-w-[1380px] px-4 pt-6 pb-24 sm:px-6 lg:px-10 lg:py-8">
          {children}
          <SiteFooter className="mt-10" />
        </main>
      </div>
      <NotificationsModal />
    </div>
    </NotificationsProvider>
  );
}
