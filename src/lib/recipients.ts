// ---------------------------------------------------------------------------
// Izbira prejemnikov e-pošte glede na vrsto obvestila
// ---------------------------------------------------------------------------

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userEmails, users } from "@/db/schema";

export type NotifyKind = "newEvent" | "eventChange" | "reminder" | "digest";

export const NOTIFY_LABELS: Record<NotifyKind, string> = {
  newEvent: "Novi dogodki",
  eventChange: "Spremembe dogodkov",
  reminder: "Opomniki pred dogodkom",
  digest: "Dnevni povzetek in ostala obvestila",
};

export type Recipient = { email: string; name: string };

function wants(
  row: { notifyNewEvents: boolean; notifyEventChanges: boolean; notifyReminders: boolean; notifyDigest: boolean },
  kind: NotifyKind,
): boolean {
  switch (kind) {
    case "newEvent":
      return row.notifyNewEvents;
    case "eventChange":
      return row.notifyEventChanges;
    case "reminder":
      return row.notifyReminders;
    case "digest":
      return row.notifyDigest;
  }
}

/**
 * Vsi naslovi, ki želijo prejeti obvestilo dane vrste.
 * `scopeId` omeji na uporabnike istega gospodinjstva (null = vsi).
 *
 * Primarni naslov uporabnika velja za vse vrste, če ima vklopljena obvestila
 * (stikalo `users.notifyEmail`); dodatni naslovi imajo lastne nastavitve.
 */
export async function recipientsFor(kind: NotifyKind, scopeId: number | null): Promise<Recipient[]> {
  const allUsers = await db.select().from(users);
  const members =
    scopeId === null ? allUsers : allUsers.filter((u) => (u.householdId ?? u.id) === scopeId);
  const pool = members.length ? members : allUsers;

  const out = new Map<string, Recipient>();

  for (const u of pool) {
    if (u.notifyEmail) {
      out.set(u.email.toLowerCase(), { email: u.email, name: u.name });
    }
    const extra = await db.select().from(userEmails).where(eq(userEmails.userId, u.id));
    for (const e of extra) {
      if (!wants(e, kind)) continue;
      const key = e.email.toLowerCase();
      if (!out.has(key)) {
        out.set(key, { email: e.email, name: e.label || u.name });
      }
    }
  }

  return [...out.values()];
}

/** Vsi dodatni naslovi uporabnika. */
export async function listUserEmails(userId: number) {
  return db.select().from(userEmails).where(eq(userEmails.userId, userId));
}
