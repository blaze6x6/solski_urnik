"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellRing,
  BookOpen,
  Bus,
  CalendarDays,
  CalendarRange,
  CheckCheck,
  GraduationCap,
  NotebookPen,
  Trash2,
  UserPlus,
  Users,
  X,
  Palmtree,
} from "lucide-react";
import {
  clearAllNotificationsAction,
  fetchNotificationsAction,
  markAllNotificationsReadAction,
} from "@/app/actions/notifications";
import type { NotificationItem } from "@/lib/notifications";
import { cn } from "@/lib/colors";
import { agoLabel } from "@/lib/plural";
import { formatShortSI, toISO } from "@/lib/time";

const SEEN_KEY = "urnik_obvestila_videna";

type Ctx = {
  items: NotificationItem[];
  unread: number;
  open: boolean;
  setOpen: (v: boolean) => void;
  reload: () => Promise<void>;
};
const NotificationsContext = createContext<Ctx | null>(null);

function useNotifications(): Ctx {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("NotificationsProvider manjka");
  return ctx;
}

/**
 * Drži stanje zvonca. Ob obisku strani/aplikacije se okno samo odpre, če so
 * neprebrana obvestila (enkrat na sejo za vsako novo obvestilo). Ko se
 * aplikacija vrne v ospredje, se podatki osvežijo.
 */
export function NotificationsProvider({
  items: serverItems,
  children,
}: {
  items: NotificationItem[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  // Postavka (layout) se ob menjavi strani NE izriše znova, zato števca ne moremo
  // vezati samo na strežniške podatke: hranimo lastno kopijo in jo sami osvežujemo.
  const [items, setItems] = useState<NotificationItem[]>(serverItems);
  useEffect(() => setItems(serverItems), [serverItems]);

  const reload = useCallback(async () => {
    try {
      setItems(await fetchNotificationsAction());
    } catch {
      /* brez povezave */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const fresh = await fetchNotificationsAction();
        if (!cancelled) setItems(fresh);
      } catch {
        /* brez povezave — poskusimo ob naslednjem krogu */
      }
    };
    refresh();
    const id = setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, []);

  const unreadItems = useMemo(() => items.filter((i) => i.unread), [items]);
  const unread = unreadItems.length;
  const maxUnreadId = unreadItems.reduce((m, i) => Math.max(m, i.id), 0);

  // samodejni odpiralnik ob obisku / ob novih neprebranih
  useEffect(() => {
    if (maxUnreadId === 0) return;
    let seen = 0;
    try {
      seen = Number(sessionStorage.getItem(SEEN_KEY) ?? 0);
    } catch {
      /* prezri */
    }
    if (maxUnreadId > seen) {
      setOpen(true);
      try {
        sessionStorage.setItem(SEEN_KEY, String(maxUnreadId));
      } catch {
        /* prezri */
      }
    }
  }, [maxUnreadId]);

  // značka na ikoni nameščene aplikacije (kjer brskalnik to podpira)
  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    try {
      if (unread > 0) void nav.setAppBadge?.(unread);
      else void nav.clearAppBadge?.();
    } catch {
      /* prezri */
    }
  }, [unread]);

  return (
    <NotificationsContext.Provider value={{ items, unread, open, setOpen, reload }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function BellButton({ className, dark }: { className?: string; dark?: boolean }) {
  const { unread, setOpen } = useNotifications();
  const Icon = unread > 0 ? BellRing : Bell;
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      title={unread > 0 ? `${unread} neprebranih obvestil` : "Obvestila"}
      aria-label="Obvestila"
      className={cn(
        "relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
        dark ? "text-[#b9bdb2] hover:bg-white/8 hover:text-[#f2eee1]" : "text-ink-soft hover:bg-spruce/10",
        className,
      )}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={2.1} />
      {unread > 0 ? (
        <span className="absolute -top-0.5 -right-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#e0344f] px-1 text-[10px] font-bold text-white ring-2 ring-paper">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </button>
  );
}

const KIND_ICON = {
  event: CalendarDays,
  timetable: CalendarRange,
  bus: Bus,
  child: Users,
  subject: BookOpen,
  year: Palmtree,
  note: NotebookPen,
  grade: GraduationCap,
  user: UserPlus,
} as const;

const ACTION_STYLE = {
  created: { bg: "#e3f6ec", fg: "#046c46", label: "Dodano" },
  updated: { bg: "#fff0d2", fg: "#9a5e04", label: "Spremenjeno" },
  deleted: { bg: "#ffe3e9", fg: "#a4123a", label: "Izbrisano" },
} as const;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 7 * 24 * 60) return agoLabel(min);
  return formatShortSI(toISO(new Date(iso)));
}

export function NotificationsModal() {
  const { items, unread, open, setOpen, reload } = useNotifications();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      await fn();
      await reload();
      router.refresh();
    });

  return (
    <div
      className="no-print fixed inset-0 z-[60] flex items-end justify-center bg-[#16202b]/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onClick={() => setOpen(false)}
    >
      <div
        className="sheet-in flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-soft text-amber-strong">
            <BellRing className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg leading-tight font-semibold">Obvestila</h2>
            <p className="text-xs text-ink-soft">
              {unread > 0 ? `${unread} neprebranih` : items.length > 0 ? "Vse prebrano" : "Ni obvestil"}
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Zapri"
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft hover:bg-paper-deep"
          >
            <X className="h-4 w-4" strokeWidth={2.4} />
          </button>
        </div>

        <div className="min-h-[120px] flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center text-ink-faint">
              <Bell className="h-8 w-8" strokeWidth={1.6} />
              <p className="text-sm">Ni novih obvestil.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {items.map((n) => {
                const Icon = KIND_ICON[n.kind] ?? Bell;
                const a = ACTION_STYLE[n.action] ?? ACTION_STYLE.updated;
                return (
                  <li key={n.id} className={cn("flex gap-3 px-5 py-3.5", n.unread && "bg-[#fffaf0]")}>
                    <span
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: a.bg, color: a.fg }}
                    >
                      <Icon className="h-4 w-4" strokeWidth={2.2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] leading-snug font-medium break-words">{n.text}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-ink-faint">
                        <span className="font-bold" style={{ color: a.fg }}>
                          {a.label}
                        </span>
                        {n.actorName ? <span>· {n.actorName}</span> : null}
                        <span>· {timeAgo(n.createdAt)}</span>
                      </p>
                    </div>
                    {n.unread ? <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#e0344f]" /> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex gap-2 border-t border-line bg-paper/60 px-5 py-3.5">
          <button
            disabled={pending || unread === 0}
            onClick={() => run(markAllNotificationsReadAction)}
            className="btn btn-ghost flex-1 !py-2 text-[13px]"
          >
            <CheckCheck className="h-4 w-4" strokeWidth={2.3} />
            Preberi vse
          </button>
          <button
            disabled={pending || items.length === 0}
            onClick={() => run(clearAllNotificationsAction)}
            className="btn btn-danger flex-1 !py-2 text-[13px]"
          >
            <Trash2 className="h-4 w-4" strokeWidth={2.3} />
            Izbriši vse
          </button>
        </div>
      </div>
    </div>
  );
}
