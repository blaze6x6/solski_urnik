import Link from "next/link";
import {
  Bell,
  CalendarCheck,
  CalendarArrowDown,
  Clock3,
  MailCheck,
  MapPin,
  Pencil,
  Repeat,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { allEventsForChildren, getChildren, getSchoolYears, getSlots, remindersForEvents } from "@/lib/data";
import { deleteEventAction, resendEventMailAction } from "@/app/actions/events";
import { smtpConfigured } from "@/lib/email";
import { eventColor } from "@/lib/colors";
import { formatDayMonthSI, formatShortSI, todayISO } from "@/lib/time";
import { applySchoolYearEnd, isRecurring, nextOccurrence, recurrenceLabel, timeLabel } from "@/lib/recurrence";
import { reminderLabel } from "@/lib/reminder-labels";
import { slotTitle } from "@/lib/week";
import { EventForm, type EventInitial } from "@/components/event-form";

export const metadata = { title: "Dogodki" };

type SearchParams = { uredi?: string; poslano?: string };

export default async function DogodkiPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const kids = await getChildren(user.scope);
  const today = todayISO();

  const evs = await allEventsForChildren(kids.map((k) => k.id), user.scope);
  const reminderMap = await remindersForEvents(evs.map((e) => e.id));

  const slotsByChild: Record<
    number,
    Array<{ id: number; period: number; title: string; kind: string; start: string; end: string }>
  > = {};
  for (const k of kids) {
    slotsByChild[k.id] = (await getSlots(k.id)).map((s) => ({
      id: s.id,
      period: s.period,
      title: slotTitle(s),
      kind: s.kind,
      start: s.start,
      end: s.end,
    }));
  }

  const slotLabel = (childId: number | null, slotId: number | null) => {
    if (!childId || !slotId) return null;
    const s = (slotsByChild[childId] ?? []).find((x) => x.id === slotId);
    return s ? `${s.title} · ${s.start}–${s.end}` : null;
  };

  // razvrstitev: prihajajoči (po naslednji ponovitvi) in pretekli enkratni
  // ponavljanje brez zadnjega dne se konča s koncem šolskega leta
  const years = await getSchoolYears(user.scope);
  const capped = new Map(applySchoolYearEnd(evs, years).map((e) => [e.id, e]));
  const withNext = evs.map((e) => ({ ev: e, next: nextOccurrence(capped.get(e.id) ?? e, today) }));
  const upcoming = withNext
    .filter((x) => x.next !== null)
    .sort((a, b) => a.next!.startDate.localeCompare(b.next!.startDate));
  const past = withNext
    .filter((x) => x.next === null)
    .sort((a, b) => b.ev.startDate.localeCompare(a.ev.startDate))
    .slice(0, 8);

  const editingRow = evs.find((e) => e.id === Number(sp.uredi)) ?? null;
  const editing: EventInitial = editingRow
    ? {
        id: editingRow.id,
        childId: editingRow.childId,
        title: editingRow.title,
        description: editingRow.description,
        location: editingRow.location,
        startDate: editingRow.startDate,
        endDate: editingRow.endDate,
        allDay: editingRow.allDay,
        startTime: editingRow.startTime,
        endTime: editingRow.endTime,
        slotId: editingRow.slotId,
        recurrence: editingRow.recurrence,
        recurrenceUntil: editingRow.recurrenceUntil,
        ignoreYearEnd: editingRow.ignoreYearEnd,
        color: editingRow.color,
        reminders: reminderMap.get(editingRow.id) ?? [],
      }
    : null;

  const kidName = (childId: number | null) =>
    childId === null ? "Vsi otroci" : (kids.find((k) => k.id === childId)?.name ?? "?");

  const Row = ({ ev, next, dim }: { ev: (typeof evs)[number]; next: ReturnType<typeof nextOccurrence>; dim?: boolean }) => {
    const pal = eventColor(ev.color);
    const slot = slotLabel(ev.childId, ev.slotId);
    const mins = reminderMap.get(ev.id) ?? [];
    const occStart = next?.startDate ?? ev.startDate;
    const occEnd = next?.endDate ?? ev.endDate ?? ev.startDate;

    return (
      <li
        className={`group overflow-hidden rounded-2xl border border-line bg-white transition-shadow hover:shadow-[0_14px_34px_-24px_rgba(22,32,43,.55)] ${dim ? "opacity-55" : ""}`}
      >
        <div className="flex items-stretch">
          <span className="w-1.5 shrink-0" style={{ background: pal.solid }} />
          <div className="min-w-0 flex-1 px-4 py-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[14.5px] font-semibold">{ev.title}</p>
              <span className="chip text-[10px]" style={{ background: pal.soft, color: pal.ink }}>
                <Clock3 className="h-3 w-3" strokeWidth={2.6} />
                {slot ?? timeLabel(ev)}
              </span>
              {isRecurring(ev.recurrence) ? (
                <span className="chip bg-[#e3e2fd] text-[10px] text-[#322ca0]">
                  <Repeat className="h-3 w-3" strokeWidth={2.6} />
                  {recurrenceLabel(ev.recurrence)}
                  {ev.recurrenceUntil
                    ? ` do ${formatShortSI(ev.recurrenceUntil)}`
                    : ev.ignoreYearEnd
                      ? " · brez konca"
                      : " · do konca šol. leta"}
                </span>
              ) : null}
              {ev.childId === null ? (
                <span className="chip bg-paper-deep text-[10px] text-ink-soft">
                  <Users className="h-3 w-3" strokeWidth={2.6} />
                  Vsi
                </span>
              ) : null}
            </div>

            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium text-ink-soft">
              <span>{kidName(ev.childId)}</span>
              <span className="text-line-strong">·</span>
              <span className="font-semibold text-ink">
                {next ? "naslednjič " : ""}
                {formatDayMonthSI(occStart)}
                {occEnd !== occStart ? ` – ${formatDayMonthSI(occEnd)}` : ""}
              </span>
              {ev.location ? (
                <>
                  <span className="text-line-strong">·</span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" strokeWidth={2.4} />
                    {ev.location}
                  </span>
                </>
              ) : null}
            </p>

            {ev.description ? (
              <p className="mt-1 text-xs leading-relaxed text-ink-faint">{ev.description}</p>
            ) : null}

            {mins.length > 0 ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Bell className="h-3 w-3 text-amber-strong" strokeWidth={2.6} />
                {mins.map((m) => (
                  <span key={m} className="chip bg-amber-soft px-2 py-0.5 text-[10px] text-amber-ink">
                    {reminderLabel(m)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col items-center justify-center gap-1 px-2 opacity-0 transition-opacity group-hover:opacity-100 max-sm:opacity-100">
            <a
              href={`/api/events/${ev.id}/ics`}
              className="icon-btn hover:!bg-[#dbeafe] hover:!text-[#15539c]"
              title="Prenesi .ics za svoj koledar"
            >
              <CalendarArrowDown className="h-4 w-4" strokeWidth={2.2} />
            </a>
            <Link href={`/dogodki?uredi=${ev.id}`} className="icon-btn" title="Uredi">
              <Pencil className="h-4 w-4" strokeWidth={2.2} />
            </Link>
            {smtpConfigured() ? (
              <form action={resendEventMailAction}>
                <input type="hidden" name="id" value={ev.id} />
                <button className="icon-btn hover:!bg-brand-tint hover:!text-brand-ink" title="Pošlji obvestilo z .ics">
                  <Send className="h-4 w-4" strokeWidth={2.2} />
                </button>
              </form>
            ) : null}
            <form action={deleteEventAction}>
              <input type="hidden" name="id" value={ev.id} />
              <button className="icon-btn hover:!bg-[#ffe3e9] hover:!text-[#d41f45]" title="Izbriši">
                <Trash2 className="h-4 w-4" strokeWidth={2.2} />
              </button>
            </form>
          </div>
        </div>
      </li>
    );
  };

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-amber-strong uppercase">Prekrivanje pouka</p>
          <h1 className="font-display mt-2 text-3xl font-medium tracking-tight sm:text-4xl">Dogodki</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-soft">
            Ročni čas, ponavljanje (teden, 14 dni, 21 dni, mesec), večdnevno trajanje in e-poštni
            opomniki z <strong>.ics</strong> prilogo za druge koledarje.
          </p>
        </div>
        <a href="/api/events/all/ics" className="btn btn-ghost">
          <CalendarArrowDown className="h-4 w-4" strokeWidth={2.2} />
          Izvozi vse (.ics)
        </a>
      </header>

      {sp.poslano ? (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-[#aeeccd] bg-[#d8f8ea] px-4 py-3 text-sm font-medium text-[#046c46]">
          <MailCheck className="h-4 w-4" strokeWidth={2.2} />
          Obvestilo z .ics je bilo poslano.
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <div className="space-y-3">
          {upcoming.length === 0 && past.length === 0 ? (
            <div className="card px-6 py-14 text-center">
              <CalendarCheck className="mx-auto mb-3 h-8 w-8 text-ink-faint" strokeWidth={1.8} />
              <p className="font-display text-xl font-semibold">Še ni dogodkov</p>
              <p className="mt-2 text-sm text-ink-soft">Dodajte prvega v obrazcu ob strani.</p>
            </div>
          ) : (
            <>
              <p className="text-[11px] font-bold tracking-[0.14em] text-ink-faint uppercase">
                Prihajajoči ({upcoming.length})
              </p>
              <ul className="space-y-2.5">
                {upcoming.map(({ ev, next }) => (
                  <Row key={ev.id} ev={ev} next={next} />
                ))}
              </ul>
              {past.length > 0 ? (
                <>
                  <p className="pt-4 text-[11px] font-bold tracking-[0.14em] text-ink-faint uppercase">Pretekli</p>
                  <ul className="space-y-2.5">
                    {past.map(({ ev, next }) => (
                      <Row key={ev.id} ev={ev} next={next} dim />
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          )}
        </div>

        <div className="xl:sticky xl:top-20 xl:self-start">
          <EventForm
            key={editing?.id ?? "nov"}
            kids={kids.map((k) => ({ id: k.id, name: k.name }))}
            slotsByChild={slotsByChild}
            initial={editing}
            smtpReady={smtpConfigured()}
          />
          {editing ? (
            <Link href="/dogodki" className="btn btn-ghost mt-3 w-full">
              Prekliči urejanje
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
