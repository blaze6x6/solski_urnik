import nodemailer from "nodemailer";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import {
  getActiveSchoolYear,
  getBusRoutes,
  getChildren,
  getSlots,
  getCancelledLessons,
  getOpenNotes,
  getTimetableRows,
  lessonKey,
  occurrencesInWindow,
} from "@/lib/data";
import { addDaysISO, DNEVI, formatDateSI, formatDateTimeSI, formatShortSI, todayISO, weekdayIndex } from "@/lib/time";
import { escHtml } from "@/lib/text";
import { dueText, isDueSoon } from "@/lib/notes";
import { recipientsFor } from "@/lib/recipients";
import { eventsForSlot, timeLabel } from "@/lib/recurrence";
import { slotTitle } from "@/lib/week";

export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

function transporter() {
  const port = Number(process.env.SMTP_PORT ?? 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === "1" || port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

export type MailAttachment = { filename: string; content: string; contentType?: string };

export async function sendMail(
  to: string,
  subject: string,
  html: string,
  attachments?: MailAttachment[],
): Promise<void> {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "urnik@localhost";
  await transporter().sendMail({ from, to, subject, html, attachments });
}

/** Naslednji šolski dan (danes, če je delavnik, sicer ponedeljek). */
export function nextSchoolDayISO(fromISO = todayISO()): string {
  let d = fromISO;
  while (weekdayIndex(d) > 4) d = addDaysISO(d, 1);
  return d;
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 12px;color:#6b7280;font-size:13px;white-space:nowrap;border-bottom:1px solid #eee">${label}</td>
    <td style="padding:6px 12px;font-size:13px;border-bottom:1px solid #eee">${value}</td>
  </tr>`;
}

export async function buildDigestHtmlForUser(user: User): Promise<string | null> {
  const kids = await getChildren(user.householdId ?? user.id);
  if (kids.length === 0) return null;
  const target = nextSchoolDayISO();
  const wd = weekdayIndex(target);
  const scope = user.householdId ?? user.id;
  const occs = await occurrencesInWindow(kids.map((k) => k.id), target, target, scope);
  // po koncu šolskega leta predmetov ne omenjamo (v novem letu je razpored drugačen)
  const year = await getActiveSchoolYear(scope);
  const afterYear = year !== null && target > year.endDate;

  let body = "";
  for (const kid of kids) {
    const [slots, rows, bus, cancelledLessons] = await Promise.all([
      getSlots(kid.id),
      getTimetableRows(kid.id),
      getBusRoutes(kid.id),
      getCancelledLessons(kid.id, target, target),
    ]);
    const subjectAt = new Map(
      afterYear ? [] : rows.filter((r) => r.entry.weekday === wd).map((r) => [r.entry.slotId, r.subject]),
    );
    // vse vidne vrstice — dogodki se izpišejo tudi, kadar predmeta ni
    const todayEntries = slots
      .filter((slot) => slot.showInTimetable)
      .map((slot) => {
        const subject = subjectAt.get(slot.id) ?? null;
        const hits = eventsForSlot(
          occs,
          target,
          { id: slot.id, start: slot.start, end: slot.end },
          (o) => o.event.childId === null || o.event.childId === kid.id,
        );
        if (!subject && hits.length === 0) return null;
        return { slot, subject, hits, lessonOff: subject !== null && cancelledLessons.has(lessonKey(slot.id, target)) };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const kidOccs = occs.filter((o) => o.event.childId === null || o.event.childId === kid.id);
    const busTo = bus.filter((b) => b.direction === "to" && b.days.includes(wd));
    const busFrom = bus.filter((b) => b.direction === "from" && b.days.includes(wd));

    body += `
      <h2 style="font-family:Georgia,serif;font-size:20px;color:#1f2937;margin:24px 0 4px">${escHtml(kid.name)} <span style="font-size:13px;color:#6b7280">${escHtml(kid.className)}</span></h2>
      <p style="margin:0 0 12px;color:#6b7280;font-size:13px">${formatDateSI(target)} — ${DNEVI[wd]}</p>`;

    for (const o of kidOccs) {
      const e = o.event;
      body += o.cancelled
        ? `<p style="background:#eceff2;border-left:4px solid #b4bcc5;padding:8px 12px;border-radius:8px;font-size:13px;margin:8px 0;color:#6b7480"><strong>Odpade:</strong> <s>${escHtml(e.title)}</s> <span>(${escHtml(timeLabel(e))})</span></p>`
        : `<p style="background:#fff0da;border-left:4px solid #f58316;padding:8px 12px;border-radius:8px;font-size:13px;margin:8px 0"><strong>Dogodek:</strong> ${escHtml(e.title)} <span style="color:#9a5e04">(${escHtml(timeLabel(e))})</span></p>`;
    }

    body += `<table style="width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden">`;
    for (const x of todayEntries) {
      const label = `${escHtml(slotTitle(x.slot))} · ${x.slot.start}–${x.slot.end}`;
      const active = x.hits.filter((h) => !h.cancelled);
      const evText = x.hits
        .map((h) =>
          h.cancelled
            ? `<span style="color:#9ca3af"><s>${escHtml(h.event.title)}</s> (odpade)</span>`
            : `<strong style="color:#9a5e04">${escHtml(h.event.title)}</strong>${
                h.event.startTime ? ` <span style="color:#9ca3af">${escHtml(timeLabel(h.event))}</span>` : ""
              }`,
        )
        .join("<br>");
      const value =
        x.lessonOff && active.length === 0
          ? `<span style="color:#9ca3af"><s>${escHtml(x.subject!.name)}</s> (odpade)</span>${x.hits.length ? `<br>${evText}` : ""}`
          : x.hits.length === 0
          ? escHtml(x.subject!.name)
          : x.subject
            ? active.length > 0
              ? `<s style="color:#9ca3af">${escHtml(x.subject.name)}</s> &rarr; ${evText}`
              : `${escHtml(x.subject.name)}<br>${evText}`
            : evText;
      body += row(label, value);
    }
    body += `</table>`;

    const fmtBus = (list: typeof busTo) =>
      list.length
        ? list
            .map(
              (b) =>
                `odhod ${b.time}${b.arrivalTime ? ` → prihod ${b.arrivalTime}` : ""}${b.stop ? ` · ${escHtml(b.stop)}` : ""}`,
            )
            .join("<br>")
        : "—";
    const dueNotes = (await getOpenNotes(kid.id)).filter((n) => isDueSoon(n, target));
    if (dueNotes.length > 0) {
      body += `<p style="background:#fff0da;border-left:4px solid #f58316;padding:8px 12px;border-radius:8px;font-size:13px;margin:10px 0"><strong>Beležke z rokom:</strong><br>${dueNotes
        .map(
          (n) =>
            `${escHtml(n.title)} <span style="color:#9a5e04">(rok ${formatShortSI(n.dueDate!)} · ${escHtml(dueText(n.dueDate!, target))})</span>`,
        )
        .join("<br>")}</p>`;
    }
    body += `<p style="font-size:13px;color:#374151;margin:10px 0"><strong>Avtobus v šolo:</strong> ${fmtBus(busTo)}<br><strong>Avtobus iz šole:</strong> ${fmtBus(busFrom)}</p>`;
  }

  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f2ec;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:640px;margin:0 auto;background:#fffdf8;border:1px solid #e7e2d6;border-radius:16px;padding:28px">
      <h1 style="font-family:Georgia,serif;font-size:24px;margin:0;color:#1f4a38">Dnevni povzetek urnika</h1>
      <p style="color:#6b7280;font-size:13px;margin:6px 0 0">${formatDateSI(target)}</p>
      ${body}
      <p style="font-size:12px;color:#9ca3af;margin-top:28px">Poslal Zasebni šolski urnik · ${formatDateTimeSI()}</p>
    </div></body></html>`;
}

/** Pošlje povzetek na uporabnikov primarni naslov in vse dodatne, ki to želijo. */
export async function sendDigestToUser(user: User): Promise<number> {
  const html = await buildDigestHtmlForUser(user);
  if (!html) return 0;
  const target = nextSchoolDayISO();
  const scope = user.householdId ?? user.id;

  const all = await recipientsFor("digest", scope);
  // pri ročnem pošiljanju vedno vključi tudi primarni naslov uporabnika
  const seen = new Set(all.map((r) => r.email.toLowerCase()));
  const list = user.notifyEmail && !seen.has(user.email.toLowerCase())
    ? [{ email: user.email, name: user.name }, ...all]
    : all;

  let sent = 0;
  for (const r of list) {
    await sendMail(r.email, `Urnik za ${formatDateSI(target)}`, html);
    sent++;
  }
  return sent;
}

export async function sendDigestToAllUsers(): Promise<number> {
  if (!smtpConfigured()) throw new Error("SMTP ni nastavljen (manjka SMTP_HOST).");
  const all = await db.select().from(users);
  let sent = 0;
  for (const u of all) {
    try {
      const n = await sendDigestToUser(u);
      sent += n;
    } catch (err) {
      console.error(`[digest] napaka pri ${u.email}:`, err);
    }
  }
  return sent;
}
