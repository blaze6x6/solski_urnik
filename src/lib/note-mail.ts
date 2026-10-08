// ---------------------------------------------------------------------------
// E-poštni opomniki za beležke z rokom (X dni pred rokom, enkrat na rok)
// ---------------------------------------------------------------------------

import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { children, notes } from "@/db/schema";
import { sendMail, smtpConfigured } from "@/lib/email";
import { recipientsFor } from "@/lib/recipients";
import { dueText, reminderStart } from "@/lib/notes";
import { escHtml } from "@/lib/text";
import { formatDateSI, formatDateTimeSI, formatShortSI, toISO, todayISO } from "@/lib/time";

/** Opomnike pošiljamo šele od te ure dalje (ne ob polnoči). */
const FROM_HOUR = 7;

function noteHtml(n: { title: string; content: string; dueDate: string }, childName: string): string {
  const row = (k: string, v: string) =>
    `<tr><td style="padding:7px 0;color:#93a0b0;font-size:12px;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:7px 0 7px 16px;font-size:14px;color:#16202b;font-weight:600">${v}</td></tr>`;
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f6f8;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 18px 44px -28px rgba(22,32,43,.45)">
      <div style="background:linear-gradient(135deg,#f58316,#f0a500);padding:22px 26px;color:#fff">
        <p style="margin:0;font-size:11px;letter-spacing:.18em;text-transform:uppercase;opacity:.85">Opomnik · beležka · ${escHtml(dueText(n.dueDate))}</p>
        <h1 style="margin:6px 0 0;font-size:23px;line-height:1.25">${escHtml(n.title)}</h1>
      </div>
      <div style="padding:20px 26px 24px"><table style="width:100%;border-collapse:collapse">
        ${row("Otrok", escHtml(childName))}
        ${row("Rok", escHtml(formatDateSI(n.dueDate)))}
        ${n.content ? row("Vsebina", escHtml(n.content).replace(/\n/g, "<br>")) : ""}
      </table></div>
      <div style="padding:14px 26px;background:#f4f6f8;color:#93a0b0;font-size:11px">Zasebni šolski urnik · ${formatDateTimeSI()}</div>
    </div></body></html>`;
}

/** Pošlje opomnike za beležke, ki so vstopile v opozorilno okno. Vrne število poslanih. */
export async function processNoteReminders(now = new Date()): Promise<number> {
  if (!smtpConfigured()) return 0;
  if (now.getHours() < FROM_HOUR) return 0;
  const today = todayISO();

  const rows = await db
    .select({ note: notes, child: children })
    .from(notes)
    .innerJoin(children, eq(children.id, notes.childId))
    .where(and(eq(notes.done, false), isNotNull(notes.dueDate)));

  let sent = 0;
  for (const { note, child } of rows) {
    const due = note.dueDate!;
    if (note.reminderSentFor === due) continue;
    const start = reminderStart(due, note.remindDays);
    if (today < start) continue; // še ni čas
    if (today > due) continue; // rok je mimo — ne pošiljamo starih opomnikov

    // beležka, ustvarjena že znotraj okna: opomnik ni potreben (uporabnik jo je ravnokar videl)
    const created = toISO(note.createdAt);
    const alreadySeen = created > start && note.reminderSentFor === null && created === today;
    try {
      if (!alreadySeen) {
        const recipients = await recipientsFor("reminder", child.userId);
        const html = noteHtml({ title: note.title, content: note.content, dueDate: due }, child.name);
        for (const r of recipients) {
          await sendMail(r.email, `Opomnik: ${note.title} — rok ${formatShortSI(due)}`, html);
        }
        if (recipients.length > 0) sent++;
      }
      await db.update(notes).set({ reminderSentFor: due }).where(eq(notes.id, note.id));
    } catch (err) {
      console.error(`[beležke] napaka pri opomniku za beležko ${note.id}:`, err);
    }
  }
  return sent;
}
