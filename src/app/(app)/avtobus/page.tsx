import Link from "next/link";
import { ArrowRight, Pencil, Plus, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getBusRoutes, getBusTimetables, getChildren } from "@/lib/data";
import { parseTimetable } from "@/lib/bus-timetable";
import { BusTimetableCard } from "@/components/bus-timetable-card";
import { BusTimetableEditor } from "@/components/bus-timetable-editor";
import { deleteBusRouteAction } from "@/app/actions/bus";
import { cn } from "@/lib/colors";
import { DNEVI_3 } from "@/lib/time";
import { BusForm } from "@/components/bus-form";

export const metadata = { title: "Avtobus" };

type SearchParams = { otrok?: string; uredi?: string; pogled?: string; vr?: string };

export default async function AvtobusPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const sp = await searchParams;

  const Tabs = ({ active }: { active: "poti" | "redi" }) => (
    <div className="mb-5 flex flex-wrap gap-2">
      <Link href="/avtobus" className={cn("chip-btn", active === "poti" && "chip-btn-active")}>
        Moji avtobusi
      </Link>
      <Link href="/avtobus?pogled=redi" className={cn("chip-btn", active === "redi" && "chip-btn-active")}>
        Vozni redi (za tisk)
      </Link>
    </div>
  );

  if (sp.pogled === "redi") {
    const all = await getBusTimetables(user.scope);
    const isNew = sp.vr === "nov";
    const edit = isNew ? null : all.find((t) => t.id === Number(sp.vr)) ?? null;
    const showEditor = isNew || edit !== null;
    return (
      <div>
        <header className="mb-6">
          <p className="text-xs font-bold tracking-[0.2em] text-amber-strong uppercase">Vozni red</p>
          <h1 className="font-display mt-2 text-4xl font-medium tracking-tight">Avtobus</h1>
        </header>
        <Tabs active="redi" />
        {showEditor ? (
          <BusTimetableEditor
            key={edit?.id ?? "nov"}
            id={edit?.id ?? null}
            name={edit?.name ?? ""}
            subtitle={edit?.subtitle ?? ""}
            note={edit?.note ?? ""}
            data={edit ? parseTimetable(edit.data) : { to: [], from: [] }}
          />
        ) : (
          <div className="space-y-5">
            <Link href="/avtobus?pogled=redi&vr=nov" className="btn btn-primary">
              <Plus className="h-4 w-4" /> Nov vozni red
            </Link>
            {all.length === 0 ? (
              <p className="card px-6 py-10 text-center text-sm text-ink-faint">
                Še ni voznih redov. Ustvarite stalni vozni red (postaje × vožnje) in ga izvozite v PDF za tisk.
              </p>
            ) : (
              all.map((t) => (
                <BusTimetableCard
                  key={t.id}
                  id={t.id}
                  name={t.name}
                  subtitle={t.subtitle}
                  note={t.note}
                  data={parseTimetable(t.data)}
                />
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  const kids = await getChildren(user.scope);

  if (kids.length === 0) {
    return (
      <div className="card mx-auto max-w-xl px-8 py-14 text-center">
        <h1 className="font-display text-2xl font-semibold">Ni dodanih otrok</h1>
        <p className="mt-3 text-sm text-ink-soft">Najprej dodajte otroka v nastavitvah.</p>
        <Link href="/nastavitve?tab=otroci" className="btn btn-primary mt-6">Odpri nastavitve</Link>
      </div>
    );
  }

  const selected = kids.find((k) => k.id === Number(sp.otrok)) ?? kids[0];
  const routes = await getBusRoutes(selected.id);
  const editing = routes.find((r) => r.id === Number(sp.uredi)) ?? null;

  const toRoutes = routes.filter((r) => r.direction === "to");
  const fromRoutes = routes.filter((r) => r.direction === "from");

  const Column = ({ title, list }: { title: string; list: typeof routes }) => (
    <div className="card p-5">
      <h3 className="font-display mb-4 text-lg font-semibold">{title}</h3>
      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong bg-paper/60 px-4 py-6 text-center text-sm text-ink-faint">
          Ni vnesenih avtobusov.
        </p>
      ) : (
        <ul className="space-y-3">
          {list.map((r) => (
            <li key={r.id} className="group rounded-2xl border border-line bg-white px-4 py-3.5 transition-shadow hover:shadow-[0_12px_32px_-20px_rgba(29,33,38,0.4)]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-end gap-3">
                  <div>
                    <p className="text-[10px] font-bold tracking-wide text-ink-faint uppercase">Odhod</p>
                    <span className="font-display text-3xl leading-none font-semibold tabular-nums">{r.time}</span>
                  </div>
                  {r.arrivalTime ? (
                    <>
                      <ArrowRight className="mb-1.5 h-4 w-4 text-ink-faint" strokeWidth={2.4} />
                      <div>
                        <p className="text-[10px] font-bold tracking-wide text-ink-faint uppercase">Prihod</p>
                        <span className="font-display text-3xl leading-none font-semibold text-spruce tabular-nums">
                          {r.arrivalTime}
                        </span>
                      </div>
                    </>
                  ) : null}
                </div>
                <div className="no-print flex shrink-0 gap-1">
                  <Link href={`/avtobus?otrok=${selected.id}&uredi=${r.id}`} className="icon-btn" title="Uredi">
                    <Pencil className="h-4 w-4" strokeWidth={2.2} />
                  </Link>
                  <form action={deleteBusRouteAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="childId" value={selected.id} />
                    <button className="icon-btn hover:!bg-[#ffe3e9] hover:!text-[#d41f45]" title="Izbriši">
                      <Trash2 className="h-4 w-4" strokeWidth={2.2} />
                    </button>
                  </form>
                </div>
              </div>
              {r.stop ? <p className="mt-1 text-sm text-ink-soft">{r.stop}</p> : null}
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {DNEVI_3.slice(0, 5).map((d, i) => (
                  <span
                    key={d}
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-[10px] font-bold",
                      r.days.includes(i) ? "bg-paper-deep text-ink" : "text-line-strong",
                    )}
                  >
                    {d}
                  </span>
                ))}
                {sp.uredi === String(r.id) ? (
                  <span className="chip ml-1 bg-amber-soft text-amber-strong">urejanje</span>
                ) : null}
              </div>
              {r.note ? <p className="mt-2 text-xs text-ink-faint italic">{r.note}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div>
      <header className="mb-6">
        <p className="text-xs font-bold tracking-[0.2em] text-amber-strong uppercase">Vozni red</p>
        <h1 className="font-display mt-2 text-4xl font-medium tracking-tight">Avtobus</h1>
      </header>

      <Tabs active="poti" />

      <div className="mb-5 flex flex-wrap gap-2">
        {kids.map((k) => (
          <Link
            key={k.id}
            href={`/avtobus?otrok=${k.id}`}
            className={cn("chip-btn", k.id === selected.id && "chip-btn-active")}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: k.color }} />
            {k.name}
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr_360px]">
        <Column title="V šolo" list={toRoutes} />
        <Column title="Iz šole" list={fromRoutes} />
        <div className="xl:sticky xl:top-20">
          <BusForm key={editing?.id ?? "nov"} childId={selected.id} route={editing} />
          {editing ? (
            <Link href={`/avtobus?otrok=${selected.id}`} className="btn btn-ghost mt-3 w-full">
              Prekliči urejanje
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
