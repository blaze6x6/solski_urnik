import Link from "next/link";
import { NotebookPen, Pin, PinOff, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getChildren, getNotes, getSubjects } from "@/lib/data";
import { addNoteAction, deleteNoteAction, togglePinNoteAction } from "@/app/actions/notes";
import { cn, subjectColor } from "@/lib/colors";
import { formatShortSI, todayISO } from "@/lib/time";

export const metadata = { title: "Beležke" };

type SearchParams = { otrok?: string };

export default async function BelezkePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
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
  const [subjects, noteRows] = await Promise.all([getSubjects(user.scope), getNotes(selected.id)]);

  return (
    <div>
      <header className="mb-6">
        <p className="text-xs font-bold tracking-[0.2em] text-amber-strong uppercase">Hitri zaznamki</p>
        <h1 className="font-display mt-2 text-4xl font-medium tracking-tight">Beležke</h1>
      </header>

      <div className="mb-5 flex flex-wrap gap-2">
        {kids.map((k) => (
          <Link
            key={k.id}
            href={`/belezke?otrok=${k.id}`}
            className={cn("chip-btn", k.id === selected.id && "chip-btn-active")}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: k.color }} />
            {k.name}
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div>
          {noteRows.length === 0 ? (
            <div className="card px-6 py-14 text-center">
              <NotebookPen className="mx-auto mb-3 h-8 w-8 text-ink-faint" strokeWidth={1.8} />
              <p className="font-display text-xl font-semibold">Še ni beležk</p>
              <p className="mt-2 text-sm text-ink-soft">Prvo beležko dodajte v obrazcu desno.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {noteRows.map(({ note, subject }) => {
                const pal = subject ? subjectColor(subject.colorIdx) : null;
                return (
                  <article
                    key={note.id}
                    className={cn(
                      "card group relative p-5",
                      note.pinned && "border-amber/50 bg-[#fffaf0]",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display text-[17px] leading-snug font-semibold">{note.title}</h3>
                      {note.pinned ? <Pin className="h-4 w-4 shrink-0 rotate-45 text-amber-strong" strokeWidth={2.4} /> : null}
                    </div>
                    {note.content ? (
                      <p className="mt-2 text-[13px] leading-relaxed whitespace-pre-line text-ink-soft">{note.content}</p>
                    ) : null}
                    <div className="mt-4 flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
                        <span className="tabular-nums">{formatShortSI(note.noteDate)}</span>
                        {subject && pal ? (
                          <span
                            className="chip px-2 py-0.5 text-[10px]"
                            style={{ background: pal.soft, color: pal.ink }}
                          >
                            {subject.abbr}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex gap-1">
                        <form action={togglePinNoteAction}>
                          <input type="hidden" name="id" value={note.id} />
                          <input type="hidden" name="childId" value={selected.id} />
                          <button className="icon-btn" title={note.pinned ? "Odpni" : "Pripni"}>
                            {note.pinned ? (
                              <PinOff className="h-4 w-4" strokeWidth={2.2} />
                            ) : (
                              <Pin className="h-4 w-4" strokeWidth={2.2} />
                            )}
                          </button>
                        </form>
                        <form action={deleteNoteAction}>
                          <input type="hidden" name="id" value={note.id} />
                          <input type="hidden" name="childId" value={selected.id} />
                          <button className="rounded-lg p-1.5 text-[#a03d2e] hover:bg-[#faeeea]" title="Izbriši">
                            <Trash2 className="h-4 w-4" strokeWidth={2.2} />
                          </button>
                        </form>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="xl:sticky xl:top-20 xl:self-start">
          <form action={addNoteAction} className="card space-y-4 p-5">
            <h3 className="font-display text-lg font-semibold">Nova beležka</h3>
            <input type="hidden" name="childId" value={selected.id} />
            <div>
              <label className="label" htmlFor="title">Naslov</label>
              <input id="title" name="title" required className="input" placeholder="npr. Portfelj za likum" />
            </div>
            <div>
              <label className="label" htmlFor="content">Vsebina</label>
              <textarea id="content" name="content" rows={4} className="input resize-none" placeholder="neobvezno" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="noteDate">Datum</label>
                <input id="noteDate" name="noteDate" type="date" required className="input" defaultValue={todayISO()} />
              </div>
              <div>
                <label className="label" htmlFor="subjectId">Predmet</label>
                <select id="subjectId" name="subjectId" className="input" defaultValue="">
                  <option value="">— splošno —</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.abbr} · {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-3.5 py-2.5">
              <input type="checkbox" name="pinned" className="h-4 w-4 rounded accent-spruce" />
              <span className="text-sm font-medium">Pripni na vrh</span>
            </label>
            <button className="btn btn-primary w-full">Shrani beležko</button>
          </form>
        </div>
      </div>
    </div>
  );
}
