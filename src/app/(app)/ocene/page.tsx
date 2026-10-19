import Link from "next/link";
import { Check, Hourglass, Pencil, Star, Trash2, X } from "lucide-react";
import { requireModule } from "@/lib/auth";
import { gradesAccess } from "@/lib/child-permissions";
import { getGrades, getSubjects, getVisibleChildren } from "@/lib/data";
import { addGradeAction, deleteGradeAction, rejectGradeDeleteAction, updateGradeAction } from "@/app/actions/grades";
import { GRADE_COLORS, cn, subjectColor } from "@/lib/colors";
import { formatShortSI, todayISO } from "@/lib/time";
import { OCENA, count } from "@/lib/plural";

export const metadata = { title: "Ocene" };

const GRADE_TYPES = ["pisni izpit", "krajši pisni izpit", "ustno ocenjevanje", "domača naloga", "praktična naloga", "projektna naloga", "esej", "test", "ostalo"];

type SearchParams = { otrok?: string; uredi?: string };

export default async function OcenePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireModule("ocene");
  const level = gradesAccess(user);
  const canWrite = level === "edit" || level === "full";
  const requestsOnly = level === "edit";
  const sp = await searchParams;
  const kids = await getVisibleChildren(user);

  if (kids.length === 0) {
    return (
      <div className="card mx-auto max-w-xl px-8 py-14 text-center">
        <h1 className="font-display text-2xl font-semibold">Ni dodanih otrok</h1>
        {user.isChild ? null : <Link href="/nastavitve?tab=otroci" className="btn btn-primary mt-6">Odpri nastavitve</Link>}
      </div>
    );
  }

  const selected = kids.find((k) => k.id === Number(sp.otrok)) ?? kids[0];
  const [subjects, rows] = await Promise.all([getSubjects(user.scope), getGrades(selected.id)]);

  const editing = canWrite ? (rows.find((r) => r.grade.id === Number(sp.uredi))?.grade ?? null) : null;
  // otrokove prošnje za izbris (potrdi jih starš)
  const deleteRequests = rows.filter((r) => r.grade.deleteRequestedAt !== null);

  const bySubject = new Map<number, { subject: (typeof rows)[number]["subject"]; grades: (typeof rows)[number]["grade"][] }>();
  for (const r of rows) {
    const bucket = bySubject.get(r.subject.id) ?? { subject: r.subject, grades: [] };
    bucket.grades.push(r.grade);
    bySubject.set(r.subject.id, bucket);
  }

  const avg = (list: number[]) => (list.reduce((a, b) => a + b, 0) / Math.max(1, list.length));
  const allGrades = rows.map((r) => r.grade.grade);
  const totalAvg = allGrades.length ? avg(allGrades) : null;
  const fmt = (n: number) => n.toFixed(2).replace(".", ",");

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-amber-strong uppercase">Spremljanje uspeha</p>
          <h1 className="font-display mt-2 text-4xl font-medium tracking-tight">Ocene</h1>
        </div>
        {totalAvg !== null ? (
          <div className="card flex items-center gap-3 px-5 py-3">
            <Star className="h-5 w-5 text-amber-strong" strokeWidth={2.2} />
            <div>
              <p className="text-[10px] font-bold tracking-[0.14em] text-ink-faint uppercase">Skupno povprečje</p>
              <p className="font-display text-2xl leading-none font-semibold tabular-nums">{fmt(totalAvg)}</p>
            </div>
          </div>
        ) : null}
      </header>

      <div className="mb-5 flex flex-wrap gap-2">
        {kids.map((k) => (
          <Link
            key={k.id}
            href={`/ocene?otrok=${k.id}`}
            className={cn("chip-btn", k.id === selected.id && "chip-btn-active")}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: k.color }} />
            {k.name}
          </Link>
        ))}
      </div>

      {!user.isChild && deleteRequests.length > 0 ? (
        <div className="card mb-5 space-y-2 border-amber/50 bg-[#fffaf0] p-4">
          <p className="flex items-center gap-2 text-sm font-bold">
            <Hourglass className="h-4 w-4 text-amber-strong" strokeWidth={2.4} />
            {selected.name} prosi za izbris {deleteRequests.length === 1 ? "ocene" : "ocen"}
          </p>
          {deleteRequests.map((r) => (
            <div key={r.grade.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-[13px]">
              <span className="font-bold tabular-nums">{r.grade.grade}</span>
              <span className="min-w-0 flex-1 truncate">
                {r.subject.name} · {r.grade.type} · {formatShortSI(r.grade.gradeDate)}
                {r.grade.note ? ` · ${r.grade.note}` : ""}
              </span>
              <form action={deleteGradeAction}>
                <input type="hidden" name="id" value={r.grade.id} />
                <input type="hidden" name="childId" value={selected.id} />
                <button className="btn btn-danger !px-3 !py-1.5 text-xs">
                  <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
                  Potrdi izbris
                </button>
              </form>
              <form action={rejectGradeDeleteAction}>
                <input type="hidden" name="id" value={r.grade.id} />
                <input type="hidden" name="childId" value={selected.id} />
                <button className="btn btn-ghost !px-3 !py-1.5 text-xs">
                  <X className="h-3.5 w-3.5" strokeWidth={2.6} />
                  Zavrni
                </button>
              </form>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div>
          {bySubject.size === 0 ? (
            <div className="card px-6 py-14 text-center">
              <p className="font-display text-xl font-semibold">Še ni ocen</p>
              <p className="mt-2 text-sm text-ink-soft">{canWrite ? "Prvo oceno dodajte v obrazcu desno." : "Ocen še ni."}</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {[...bySubject.values()].map(({ subject, grades }) => {
                const pal = subjectColor(subject.colorIdx);
                const a = avg(grades.map((g) => g.grade));
                return (
                  <div key={subject.id} className="card p-5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-2 text-[14px] font-bold">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: pal.solid }} />
                        {subject.name}
                        <span className="text-[10px] font-semibold text-ink-faint">{subject.abbr}</span>
                      </p>
                      <p className="font-display text-xl font-semibold tabular-nums">{fmt(a)}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2.5">
                      {grades.map((g) => {
                        const st = GRADE_COLORS[g.grade] ?? GRADE_COLORS[3];
                        return (
                          <span key={g.id} className="group relative inline-flex">
                            <span
                              className="flex h-9 w-9 items-center justify-center rounded-xl text-[15px] font-bold"
                              style={{ background: st.bg, color: st.ink }}
                              title={`${g.type} · ${formatShortSI(g.gradeDate)}${g.note ? ` · ${g.note}` : ""}`}
                            >
                              {g.grade}
                            </span>
                            {canWrite ? (
                            <Link
                              href={`/ocene?otrok=${selected.id}&uredi=${g.id}`}
                              className="absolute -top-2 -left-2 flex h-5 w-5 items-center justify-center rounded-full bg-spruce text-white shadow-md ring-2 ring-white"
                              title="Uredi oceno"
                            >
                              <Pencil className="h-2.5 w-2.5" strokeWidth={3} />
                            </Link>
                            ) : null}
                            {canWrite ? (
                            <form action={deleteGradeAction} className="absolute -top-2 -right-2">
                              <input type="hidden" name="id" value={g.id} />
                              <input type="hidden" name="childId" value={selected.id} />
                              <button
                                className={cn(
                                  "flex h-5 w-5 items-center justify-center rounded-full text-white shadow-md ring-2 ring-white",
                                  g.deleteRequestedAt ? "bg-amber-strong" : "bg-[#a03d2e]",
                                )}
                                title={
                                  requestsOnly
                                    ? g.deleteRequestedAt
                                      ? "Čaka na potrditev starša (klik prekliče prošnjo)"
                                      : "Zaprosi starša za izbris ocene"
                                    : "Izbriši oceno"
                                }
                              >
                                {requestsOnly && g.deleteRequestedAt ? (
                                  <Hourglass className="h-2.5 w-2.5" strokeWidth={3} />
                                ) : (
                                  <Trash2 className="h-2.5 w-2.5" strokeWidth={3} />
                                )}
                              </button>
                            </form>
                            ) : null}
                          </span>
                        );
                      })}
                    </div>
                    <p className="mt-3 text-[11px] text-ink-faint">
                      {count(grades.length, OCENA)} · zadnja {formatShortSI(grades[0].gradeDate)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {canWrite ? (
        <div className="xl:sticky xl:top-20 xl:self-start">
          <form key={editing?.id ?? "nova"} action={editing ? updateGradeAction : addGradeAction} className="card space-y-4 p-5">
            <h3 className="font-display text-lg font-semibold">{editing ? "Uredi oceno" : "Dodaj oceno"}</h3>
            {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
            <input type="hidden" name="childId" value={selected.id} />
            <div>
              <label className="label" htmlFor="subjectId">Predmet</label>
              <select id="subjectId" name="subjectId" required className="input" defaultValue={editing?.subjectId}>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.abbr})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="grade">Ocena</label>
                <select id="grade" name="grade" required className="input" defaultValue={String(editing?.grade ?? 5)}>
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="gradeDate">Datum</label>
                <input id="gradeDate" name="gradeDate" type="date" required className="input" defaultValue={editing?.gradeDate ?? todayISO()} />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="type">Vrsta</label>
              <select id="type" name="type" className="input" defaultValue={editing?.type}>
                {GRADE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="note">Opomba</label>
              <input id="note" name="note" className="input" placeholder="npr. Decimalna števila" defaultValue={editing?.note ?? ""} />
            </div>
            <button className="btn btn-primary w-full" disabled={subjects.length === 0}>
              {editing ? "Shrani spremembe" : "Shrani oceno"}
            </button>
            {editing ? (
              <Link href={`/ocene?otrok=${selected.id}`} className="btn btn-ghost w-full">
                Prekliči urejanje
              </Link>
            ) : null}
          </form>
        </div>
        ) : null}
      </div>
    </div>
  );
}
