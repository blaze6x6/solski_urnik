import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { children, eventReminders, events, schoolYears, timeSlots } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { buildIcs, icsFileName } from "@/lib/ics";
import { buildScopeCalendar } from "@/lib/event-mail";
import { applySchoolYearEnd } from "@/lib/recurrence";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Potrebna je prijava." }, { status: 401 });

  const { id } = await ctx.params;

  // celoten koledar skupine
  if (id === "all") {
    const ics = await buildScopeCalendar(user.scope);
    return new NextResponse(ics, {
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": 'attachment; filename="solski-urnik-dogodki.ics"',
      },
    });
  }

  const eventId = Number(id);
  if (!Number.isFinite(eventId)) return NextResponse.json({ error: "Neveljaven dogodek." }, { status: 400 });

  const rows = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  const rawEv = rows[0];
  const ev = rawEv
    ? applySchoolYearEnd(
        [rawEv],
        await db.select().from(schoolYears).where(eq(schoolYears.userId, user.scope)),
      )[0]
    : undefined;
  if (!ev) return NextResponse.json({ error: "Dogodka ni." }, { status: 404 });

  let childName: string | null = null;
  if (ev.childId === null && ev.scopeId !== user.scope) {
    return NextResponse.json({ error: "Ni dostopa." }, { status: 403 });
  }
  if (ev.childId !== null) {
    const kid = await db.select().from(children).where(eq(children.id, ev.childId)).limit(1);
    if (!kid[0] || kid[0].userId !== user.scope) {
      return NextResponse.json({ error: "Ni dostopa." }, { status: 403 });
    }
    childName = kid[0].name;
  }

  let slotTime: { start: string; end: string } | null = null;
  if (ev.slotId !== null) {
    const s = await db
      .select({ start: timeSlots.start, end: timeSlots.end })
      .from(timeSlots)
      .where(eq(timeSlots.id, ev.slotId))
      .limit(1);
    slotTime = s[0] ?? null;
  }

  const mins = await db.select().from(eventReminders).where(eq(eventReminders.eventId, ev.id));

  const ics = buildIcs([
    { event: ev, childName, slotTime, reminderMinutes: mins.map((m) => m.minutesBefore) },
  ]);

  return new NextResponse(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${icsFileName(ev.title)}"`,
    },
  });
}
