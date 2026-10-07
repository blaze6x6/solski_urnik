// ---------------------------------------------------------------------------
// Obvestila v aplikaciji (zvonec) — vezana na skupino (gospodinjstvo).
//
// Vsaka sprememba ali dodatek v skupini zapiše obvestilo, ki ga vidijo vsi
// člani te skupine; druge skupine ga ne vidijo. Stanje (prebrano / izbrisano)
// je shranjeno pri vsakem uporabniku posebej.
// ---------------------------------------------------------------------------

import { and, desc, eq, isNull, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { notificationStates, notifications } from "@/db/schema";

export type NotifKind =
  | "event"
  | "timetable"
  | "bus"
  | "child"
  | "subject"
  | "year"
  | "note"
  | "grade"
  | "user";
export type NotifAction = "created" | "updated" | "deleted";

export type NotificationItem = {
  id: number;
  kind: NotifKind;
  action: NotifAction;
  text: string;
  actorName: string;
  /** ISO čas nastanka */
  createdAt: string;
  unread: boolean;
};

const KEEP_DAYS = 90;

/**
 * Zapiše obvestilo za skupino. Povzročitelj spremembe ga takoj dobi kot
 * »prebrano«, da ga ne moti z lastnimi dejanji. Napaka pri zapisu nikoli
 * ne prekine same akcije.
 */
export async function notifyScope(
  actor: { id: number; name: string; scope: number },
  kind: NotifKind,
  action: NotifAction,
  text: string,
): Promise<void> {
  try {
    const [row] = await db
      .insert(notifications)
      .values({ scopeId: actor.scope, actorId: actor.id, actorName: actor.name, kind, action, text })
      .returning({ id: notifications.id });
    await db
      .insert(notificationStates)
      .values({ userId: actor.id, notificationId: row.id })
      .onConflictDoNothing();
    // pospravi stara obvestila te skupine
    await db
      .delete(notifications)
      .where(
        and(
          eq(notifications.scopeId, actor.scope),
          lt(notifications.createdAt, new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000)),
        ),
      );
  } catch (err) {
    console.error("[obvestila] zapis ni uspel:", err);
  }
}

/** Zadnja obvestila skupine za uporabnika (brez njegovih izbrisanih). */
export async function listNotifications(
  userId: number,
  scope: number,
  limit = 50,
): Promise<NotificationItem[]> {
  try {
    const rows = await db
      .select({ n: notifications, readBy: notificationStates.userId })
      .from(notifications)
      .leftJoin(
        notificationStates,
        and(eq(notificationStates.notificationId, notifications.id), eq(notificationStates.userId, userId)),
      )
      .where(
        and(
          eq(notifications.scopeId, scope),
          or(isNull(notificationStates.userId), eq(notificationStates.hidden, false)),
        ),
      )
      .orderBy(desc(notifications.id))
      .limit(limit);
    return rows.map((r) => ({
      id: r.n.id,
      kind: r.n.kind as NotifKind,
      action: r.n.action as NotifAction,
      text: r.n.text,
      actorName: r.n.actorName,
      createdAt: r.n.createdAt.toISOString(),
      unread: r.readBy === null,
    }));
  } catch (err) {
    console.error("[obvestila] branje ni uspelo:", err);
    return [];
  }
}
