import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getActiveSchoolYear, getBreaksForYear, getChildren, getSubjects } from "@/lib/data";
import { buildChildWeek } from "@/lib/week";
import { cn } from "@/lib/colors";
import { ChildDetailsTrigger } from "@/components/child-details-modal";
import { TimetableGrid } from "@/components/timetable-grid";
import { OTROK, count } from "@/lib/plural";

export const metadata = { title: "Urnik" };

type SearchParams = { otrok?: string; teden?: string; prikaz?: string };

export default async function UrnikPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const sp = await searchParams;

  const kids = await getChildren(user.scope);
  const year = await getActiveSchoolYear(user.scope);
  const breaks = year ? await getBreaksForYear(year.id) : [];

  if (kids.length === 0) {
    return (
      <div className="card mx-auto max-w-xl px-8 py-14 text-center">
        <h1 className="font-display text-2xl font-semibold">Ni dodanih otrok</h1>
        <p className="mt-3 text-sm text-ink-soft">Najprej dodajte otroka v nastavitvah.</p>
        <Link href="/nastavitve?tab=otroci" className="btn btn-primary mt-6">
          Odpri nastavitve
        </Link>
      </div>
    );
  }

  const showAll = sp.otrok === "vsi" && kids.length > 1;
  const selected = kids.find((k) => k.id === Number(sp.otrok)) ?? kids[0];
  const weekOffset = Math.max(-52, Math.min(52, Number(sp.teden ?? 0) || 0));
  const initialMode = sp.prikaz === "krajsi" ? "abbr" : "full";

  const subjects = await getSubjects(user.scope);
  const shown = showAll ? kids : [selected];
  const weeks = await Promise.all(shown.map((k) => buildChildWeek(k.id, weekOffset, breaks, user.scope, year?.endDate ?? null)));

  const qs = (over: Partial<{ otrok: number | "vsi"; teden: number; prikaz: string }>) => {
    const p = new URLSearchParams();
    const otrok = over.otrok ?? (showAll ? "vsi" : selected.id);
    const teden = over.teden ?? weekOffset;
    const prikaz = over.prikaz ?? sp.prikaz;
    p.set("otrok", String(otrok));
    if (teden !== 0) p.set("teden", String(teden));
    if (prikaz) p.set("prikaz", prikaz);
    return `/urnik?${p.toString()}`;
  };

  const subjectOptions = subjects.map((s) => ({
    id: s.id,
    name: s.name,
    abbr: s.abbr,
    colorIdx: s.colorIdx,
  }));
  const weekLabel = weeks[0]?.weekLabel ?? "";

  return (
    <div>
      <header className="no-print mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-amber-strong uppercase">Tedenski urnik</p>
          <h1 className="font-display mt-2 text-3xl font-medium tracking-tight sm:text-4xl">
            {showAll ? (
              <>
                Vsi urniki <span className="text-ink-soft italic">· {count(kids.length, OTROK)}</span>
              </>
            ) : (
              <>
                {selected.name} <span className="text-ink-soft italic">· {selected.className}</span>
              </>
            )}
          </h1>
          {showAll ? null : <p className="mt-1 text-sm text-ink-soft">{weekLabel}</p>}
        </div>

      </header>

      {/* Izbira otroka / vsi */}
      <div className="no-print mb-5 flex flex-wrap gap-2">
        {kids.length > 1 ? (
          <Link href={qs({ otrok: "vsi" })} className={cn("chip-btn", showAll && "chip-btn-active")}>
            <LayoutGrid className="h-3.5 w-3.5" strokeWidth={2.4} />
            Vsi
          </Link>
        ) : null}
        {kids.map((k) => (
          <Link
            key={k.id}
            href={qs({ otrok: k.id })}
            className={cn("chip-btn", !showAll && k.id === selected.id && "chip-btn-active")}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: !showAll && k.id === selected.id ? "#ffffff" : k.color }}
            />
            {k.name}
          </Link>
        ))}
      </div>

      <div className="print-area space-y-8">
        {shown.map((kid, i) => {
          const built = weeks[i];
          return (
            <section key={kid.id} className={cn(i < shown.length - 1 && "print:break-after-page")}>
              {/* naslov otroka — vedno pri "Vsi", pri tisku vedno */}
              <div className={cn("mb-3 flex items-center gap-3", !showAll && "hidden print:flex")}>
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[13px] font-bold text-white"
                  style={{ background: kid.color }}
                >
                  {kid.name
                    .split(" ")
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </span>
                <div>
                  <ChildDetailsTrigger child={kid} className="cursor-pointer text-left underline-offset-4 hover:underline">
                    <h2 className="font-display text-xl leading-tight font-semibold">
                      {kid.name} <span className="text-ink-soft">· {kid.className}</span>
                    </h2>
                  </ChildDetailsTrigger>
                  <p className="text-xs text-ink-soft">
                    {kid.school ? `${kid.school} · ` : ""}
                    {year ? `Šolsko leto ${year.name} · ` : ""}
                    {built.weekLabel}
                  </p>
                </div>
              </div>

              <TimetableGrid
                key={`${kid.id}-${weekOffset}`}
                childId={kid.id}
                studentName={kid.name}
                weekOffset={weekOffset}
                weekLabel={built.weekLabel}
                days={built.days}
                slots={built.slots}
                cells={built.cells}
                eventChips={built.eventChips}
                subjects={subjectOptions}
                initialMode={initialMode}
                todayHref={qs({ teden: 0 })}
                prevHref={qs({ teden: weekOffset - 1 })}
                nextHref={qs({ teden: weekOffset + 1 })}
                independent={showAll}
              />
            </section>
          );
        })}
      </div>
    </div>
  );
}
