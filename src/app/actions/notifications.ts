"use server";

import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { listNotifications, type NotificationItem } from "@/lib/notifications";

/** Vsa neprebrana obvestila skupine označi kot prebrana (za tega uporabnika). */
export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await requireUser();
  await db.execute(sql`
    INSERT INTO notification_states (user_id, notification_id)
    SELECT ${user.id}, n.id FROM notifications n WHERE n.scope_id = ${user.scope}
    ON CONFLICT DO NOTHING
  `);
  revalidatePath("/", "layout");
}

/** Skrije (izbriše) vsa obvestila skupine za tega uporabnika; drugim članom ostanejo. */
export async function clearAllNotificationsAction(): Promise<void> {
  const user = await requireUser();
  await db.execute(sql`
    INSERT INTO notification_states (user_id, notification_id, hidden)
    SELECT ${user.id}, n.id, true FROM notifications n WHERE n.scope_id = ${user.scope}
    ON CONFLICT (user_id, notification_id) DO UPDATE SET hidden = true
  `);
  revalidatePath("/", "layout");
}

/** Sveža obvestila za zvonec (poizvedba brez osveževanja cele strani). */
export async function fetchNotificationsAction(): Promise<NotificationItem[]> {
  const user = await requireUser();
  return listNotifications(user.id, user.scope);
}
