import { and, asc, desc, eq, gte, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  busRoutes,
  busTimetables,
  children,
  eventCancellations,
  eventReminders,
  events,
  grades,
  lessonCancellations,
  notes,
  schoolBreaks,
  schoolYears,
  subjects,
  timeSlots,
  timetableEntries,
  users,
} from "@/db/schema";
import { applySchoolYearEnd, expandEvents } from "@/lib/recurrence";

// ---------------------------------------------------------------------------
// Osnovni poizvedovalni pomožki
// ---------------------------------------------------------------------------

export async function getChildren(userId: number) {
  return db.select().from(children).where(eq(children.userId, userId)).orderBy(asc(children.id));
}

export async function getSubjects(userId: number) {
  return db.select().from(subjects).where(eq(subjects.userId, userId)).orderBy(asc(subjects.id));
}

export async function getSlots(childId: number) {
  return db
    .select()
    .from(timeSlots)
    .where(eq(timeSlots.childId, childId))
    .orderBy(asc(timeSlots.period));
}

export async function getSchoolYears(userId: number) {
  return db
    .select()
    .from(schoolYears)
    .where(eq(schoolYears.userId, userId))
    .orderBy(desc(schoolYears.startDate));
}

export async function getActiveSchoolYear(userId: number) {
  const rows = await db
    .select()
    .from(schoolYears)
    .where(and(eq(schoolYears.userId, userId), eq(schoolYears.isActive, true)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getBreaksForYear(schoolYearId: number) {
  return db
    .select()
    .from(schoolBreaks)
    .where(eq(schoolBreaks.schoolYearId, schoolYearId))
    .orderBy(asc(schoolBreaks.startDate));
}

export async function getTimetableRows(childId: number) {
  return db
    .select({ entry: timetableEntries, subject: subjects })
    .from(timetableEntries)
    .innerJoin(subjects, eq(subjects.id, timetableEntries.subjectId))
    .where(eq(timetableEntries.childId, childId))
    .orderBy(asc(timetableEntries.weekday));
}

/** Odpadle ure otroka v obdobju: ključ `slotId|datum`. */
export async function getCancelledLessons(childId: number, start: string, end: string): Promise<Set<string>> {
  const rows = await db
    .select()
    .from(lessonCancellations)
    .where(
      and(
        eq(lessonCancellations.childId, childId),
        gte(lessonCancellations.date, start),
        lte(lessonCancellations.date, end),
      ),
    );
  return new Set(rows.map((r) => lessonKey(r.slotId, r.date)));
}

export function lessonKey(slotId: number, date: string): string {
  return `${slotId}|${date}`;
}

export async function getBusRoutes(childId: number) {
  return db
    .select()
    .from(busRoutes)
    .where(eq(busRoutes.childId, childId))
    .orderBy(asc(busRoutes.direction), asc(busRoutes.time));
}

/**
 * Obseg dogodkov ene skupine (gospodinjstva): dogodki njenih otrok in
 * dogodki »Vsi otroci«, ki pripadajo **samo tej skupini** (scopeId).
 * Tako ločeni računi ne vidijo dogodkov drug drugega.
 */
export function eventScopeFilter(childIds: number[], scopeId: number) {
  const everyone = and(isNull(events.childId), eq(events.scopeId, scopeId));
  return childIds.length === 0 ? everyone : or(everyone, inArray(events.childId, childIds));
}

/**
 * Osnovni zapisi dogodkov, ki bi se lahko dotaknili obdobja — vključno s
 * ponavljajočimi se, ki so se začeli prej. Razširi jih `expandEvents`.
 */
export async function eventsInRange(childIds: number[], start: string, end: string, scopeId: number) {
  const scope = eventScopeFilter(childIds, scopeId);
  return db
    .select()
    .from(events)
    .where(
      and(
        lte(events.startDate, end),
        or(
          // enkratni dogodki: morajo segati v obdobje
          and(
            eq(events.recurrence, "none"),
            gte(sql`coalesce(${events.endDate}, ${events.startDate})`, start),
          ),
          // ponavljajoči: ponavljanje se še ni izteklo
          and(
            ne(events.recurrence, "none"),
            or(isNull(events.recurrenceUntil), gte(events.recurrenceUntil, start)),
          ),
        ),
        scope,
      ),
    )
    .orderBy(asc(events.startDate));
}

/** Odpadle ponovitve (ključ `eventId|datum začetka`) za dane dogodke. */
export async function cancelledOccurrenceKeys(eventIds: number[]): Promise<Set<string>> {
  const set = new Set<string>();
  if (eventIds.length === 0) return set;
  const rows = await db
    .select()
    .from(eventCancellations)
    .where(inArray(eventCancellations.eventId, eventIds));
  for (const r of rows) set.add(`${r.eventId}|${r.occurrenceDate}`);
  return set;
}

export function occurrenceKey(eventId: number, startDate: string): string {
  return `${eventId}|${startDate}`;
}

/** Dogodki, razširjeni v konkretne termine znotraj obdobja (z oznako odpadlih). */
export async function occurrencesInWindow(childIds: number[], start: string, end: string, scopeId: number) {
  const [raw, years] = await Promise.all([
    eventsInRange(childIds, start, end, scopeId),
    db.select().from(schoolYears).where(eq(schoolYears.userId, scopeId)),
  ]);
  // ponavljanje brez zadnjega dne se konča s koncem šolskega leta
  const base = applySchoolYearEnd(raw, years);
  const occs = expandEvents(base, start, end);
  const cancelled = await cancelledOccurrenceKeys([...new Set(occs.map((o) => o.event.id))]);
  for (const o of occs) o.cancelled = cancelled.has(occurrenceKey(o.event.id, o.startDate));
  return occs;
}

/** Vsi opomniki za seznam dogodkov (map: eventId -> minute). */
export async function remindersForEvents(eventIds: number[]): Promise<Map<number, number[]>> {
  const map = new Map<number, number[]>();
  if (eventIds.length === 0) return map;
  const rows = await db
    .select()
    .from(eventReminders)
    .where(inArray(eventReminders.eventId, eventIds))
    .orderBy(asc(eventReminders.minutesBefore));
  for (const r of rows) {
    map.set(r.eventId, [...(map.get(r.eventId) ?? []), r.minutesBefore]);
  }
  return map;
}

/** Vsi dogodki uporabnikove skupine (za opomnike in izvoz). */
export async function allEventsForChildren(childIds: number[], scopeId: number) {
  const scope = eventScopeFilter(childIds, scopeId);
  return db.select().from(events).where(scope).orderBy(asc(events.startDate));
}

export async function getNotes(childId: number) {
  return db
    .select({ note: notes, subject: subjects })
    .from(notes)
    .leftJoin(subjects, eq(subjects.id, notes.subjectId))
    .where(eq(notes.childId, childId))
    .orderBy(desc(notes.pinned), desc(notes.noteDate), desc(notes.id));
}

/** Odprte (neopravljene) beležke otroka — za pregled. */
export async function getOpenNotes(childId: number) {
  return db
    .select()
    .from(notes)
    .where(and(eq(notes.childId, childId), eq(notes.done, false)))
    .orderBy(asc(sql`(${notes.dueDate} is null)`), asc(notes.dueDate), desc(notes.pinned), desc(notes.id));
}

export async function getGrades(childId: number) {
  return db
    .select({ grade: grades, subject: subjects })
    .from(grades)
    .innerJoin(subjects, eq(subjects.id, grades.subjectId))
    .where(eq(grades.childId, childId))
    .orderBy(asc(subjects.name), desc(grades.gradeDate));
}

export async function getOwnedChild(userId: number, childId: number) {
  const rows = await db
    .select()
    .from(children)
    .where(and(eq(children.id, childId), eq(children.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export type HouseholdOverview = {
  ownerId: number;
  childCount: number;
  eventCount: number;
  people: Array<{
    id: number;
    name: string;
    email: string;
    isOwner: boolean;
    isSuperadmin: boolean;
  }>;
};

/** Pregled vseh skupin (gospodinjstev) in njihovih uporabnikov — za superadministratorja. */
export async function getAllHouseholds(): Promise<HouseholdOverview[]> {
  const [allUsers, kids, evs] = await Promise.all([
    db.select().from(users).orderBy(asc(users.id)),
    db.select({ userId: children.userId }).from(children),
    db.select({ scopeId: events.scopeId }).from(events),
  ]);
  const groups = new Map<number, HouseholdOverview>();
  for (const u of allUsers) {
    const scope = u.householdId ?? u.id;
    const g = groups.get(scope) ?? { ownerId: scope, childCount: 0, eventCount: 0, people: [] };
    g.people.push({
      id: u.id,
      name: u.name,
      email: u.email,
      isOwner: u.id === scope,
      isSuperadmin: u.isSuperadmin,
    });
    groups.set(scope, g);
  }
  for (const k of kids) {
    const g = groups.get(k.userId);
    if (g) g.childCount++;
  }
  for (const e of evs) {
    const g = e.scopeId !== null ? groups.get(e.scopeId) : undefined;
    if (g) g.eventCount++;
  }
  return [...groups.values()].sort((a, b) => a.ownerId - b.ownerId);
}

/** Stalni vozni redi skupine (od najnovejšega). */
export async function getBusTimetables(userId: number) {
  return db
    .select()
    .from(busTimetables)
    .where(eq(busTimetables.userId, userId))
    .orderBy(desc(busTimetables.updatedAt));
}
