import Link from "next/link";
import { Star, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getChildren, getGrades, getSubjects } from "@/lib/data";
import { addGradeAction, deleteGradeAction } from "@/app/actions/grades";
import { GRADE_COLORS, cn, subjectColor } from "@/lib/colors";
import { formatShortSI, todayISO } from "@/lib/time";
import { OCENA, count } from "@/lib/plural";

export const metadata = { title: "Ocene" };

const GRADE_TYPES = ["pisni izpit", "krajši pisni izpit", "ustno ocenjevanje", "domača naloga", "praktična naloga", "projektna naloga", "esej", "test", "ostalo"];

type SearchParams = { otrok?: string };

export default async function OcenePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const kids = await getChildren(user.scope);

  if (kids.length === 0) {
    return (
      <div className="card mx-auto max-w-xl px-8 py-14 text-center">
        <h1 className="font-display text-2xl font-semibold">Ni dodanih otrok</h1>
        <Link href="/nastavitve?tab=otroci" className="btn btn-primary mt-6">Odpri nastavitve</Link>
      </div>
    );
  }

  const selected = kids.find((k) => k.id === Number(sp.otrok)) ?? kids[0];
  const [subjects, rows] = await Promise.all([getSubjects(user.scope), getGrades(selected.id)]);

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

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div>
          {bySubject.size === 0 ? (
            <div className="card px-6 py-14 text-center">
              <p className="font-display text-xl font-semibold">Še ni ocen</p>
              <p className="mt-2 text-sm text-ink-soft">Prvo oceno dodajte v obrazcu desno.</p>
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
                            <form action={deleteGradeAction} className="absolute -top-2 -right-2">
                              <input type="hidden" name="id" value={g.id} />
                              <input type="hidden" name="childId" value={selected.id} />
                              <button
                                className="flex h-5 w-5 items-center justify-center rounded-full bg-[#a03d2e] text-white shadow-md ring-2 ring-white"
                                title="Izbriši oceno"
                              >
                                <Trash2 className="h-2.5 w-2.5" strokeWidth={3} />
                              </button>
                            </form>
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

        <div className="xl:sticky xl:top-20 xl:self-start">
          <form action={addGradeAction} className="card space-y-4 p-5">
            <h3 className="font-display text-lg font-semibold">Dodaj oceno</h3>
            <input type="hidden" name="childId" value={selected.id} />
            <div>
              <label className="label" htmlFor="subjectId">Predmet</label>
              <select id="subjectId" name="subjectId" required className="input">
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
                <select id="grade" name="grade" required className="input" defaultValue="5">
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="gradeDate">Datum</label>
                <input id="gradeDate" name="gradeDate" type="date" required className="input" defaultValue={todayISO()} />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="type">Vrsta</label>
              <select id="type" name="type" className="input">
                {GRADE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="note">Opomba</label>
              <input id="note" name="note" className="input" placeholder="npr. Decimalna števila" />
            </div>
            <button className="btn btn-primary w-full" disabled={subjects.length === 0}>
              Shrani oceno
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
