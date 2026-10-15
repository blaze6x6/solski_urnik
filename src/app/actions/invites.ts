"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { invitations, users } from "@/db/schema";
import { createSession, hashPassword, requireSuperadmin, requireUser } from "@/lib/auth";
import { sendMail, smtpConfigured } from "@/lib/email";
import { appOrigin, createInvite, findValidInvite, inviteMailHtml } from "@/lib/invites";
import { notifyScope } from "@/lib/notifications";

export type InviteState = { error?: string; ok?: string; link?: string } | undefined;
export type AcceptState = { error?: string } | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function sendInvite(opts: {
  email: string;
  scopeId: number | null;
  inviter: { id: number; name: string };
  groupOwnerName?: string;
}): Promise<InviteState> {
  const { token } = await createInvite({ email: opts.email, scopeId: opts.scopeId, invitedBy: opts.inviter.id });
  const link = `${await appOrigin()}/vabilo?token=${token}`;

  if (!smtpConfigured()) {
    return {
      ok: `Vabilo je ustvarjeno, a pošiljanje e-pošte na strežniku ni nastavljeno. Povezavo pošljite ročno (velja 7 dni).`,
      link,
    };
  }
  try {
    await sendMail(
      opts.email,
      opts.scopeId === null ? "Vabilo v Šolski urnik" : "Vabilo v skupino — Šolski urnik",
      inviteMailHtml({
        link,
        inviterName: opts.inviter.name,
        newGroup: opts.scopeId === null,
        groupOwnerName: opts.groupOwnerName,
      }),
    );
  } catch (err) {
    console.error("[vabilo] pošiljanje ni uspelo:", err);
    return { error: "Pošiljanje e-pošte ni uspelo. Povezavo lahko pošljete ročno.", link };
  }
  return { ok: `Vabilo je poslano na ${opts.email}.`, link };
}

/** Superadministrator povabi nekoga, da ustvari NOVO, ločeno skupino. */
export async function createGroupInviteAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const me = await requireSuperadmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "Vnesite veljaven e-poštni naslov." };

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) return { error: "Uporabnik s to e-pošto že obstaja." };

  const result = await sendInvite({ email, scopeId: null, inviter: { id: me.id, name: me.name } });
  revalidatePath("/nastavitve");
  return result;
}

/** Administrator skupine povabi novega člana v svojo skupino. */
export async function createMemberInviteAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const me = await requireUser();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "Vnesite veljaven e-poštni naslov." };

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) return { error: "Uporabnik s to e-pošto že obstaja." };

  const owner = (await db.select({ name: users.name }).from(users).where(eq(users.id, me.scope)).limit(1))[0];
  const result = await sendInvite({
    email,
    scopeId: me.scope,
    inviter: { id: me.id, name: me.name },
    groupOwnerName: owner?.name,
  });
  revalidatePath("/nastavitve");
  return result;
}

/** Prekliče čakajoče vabilo (superadmin vsa; administrator samo vabila svoje skupine). */
export async function revokeInviteAction(formData: FormData): Promise<void> {
  const me = await requireUser();
  const id = Number(formData.get("id") ?? 0);
  if (!id) return;
  const rows = await db.select().from(invitations).where(eq(invitations.id, id)).limit(1);
  const inv = rows[0];
  if (!inv) return;
  const allowed = inv.scopeId === null ? me.isSuperadmin : inv.scopeId === me.scope;
  if (!allowed) return;
  await db.delete(invitations).where(eq(invitations.id, id));
  revalidatePath("/nastavitve");
}

/** Registracija povabljenca: ustvari račun in ga prijavi. */
export async function acceptInviteAction(_prev: AcceptState, formData: FormData): Promise<AcceptState> {
  const token = String(formData.get("token") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const inv = await findValidInvite(token);
  if (!inv) return { error: "Vabilo je neveljavno, preteklo ali že uporabljeno." };
  if (!name) return { error: "Vnesite ime in priimek." };
  if (password.length < 6) return { error: "Geslo mora imeti vsaj 6 znakov." };
  if (password !== confirm) return { error: "Gesli se ne ujemata." };

  const clash = await db.select({ id: users.id }).from(users).where(eq(users.email, inv.email)).limit(1);
  if (clash[0]) return { error: "Račun s to e-pošto že obstaja. Prijavite se." };

  // vabilo porabimo pred ustvarjanjem računa, da ga dvakratni klik ne izkoristi dvakrat
  const claimed = await db
    .update(invitations)
    .set({ usedAt: new Date() })
    .where(and(eq(invitations.id, inv.id), isNull(invitations.usedAt)))
    .returning({ id: invitations.id });
  if (!claimed[0]) return { error: "Vabilo je neveljavno, preteklo ali že uporabljeno." };

  // skupina mora še obstajati (lastnik ni bil vmes odstranjen)
  if (inv.scopeId !== null) {
    const owner = await db.select({ id: users.id }).from(users).where(eq(users.id, inv.scopeId)).limit(1);
    if (!owner[0]) return { error: "Skupina, v katero ste povabljeni, ne obstaja več." };
  }

  const created = await db
    .insert(users)
    .values({
      name,
      email: inv.email,
      passwordHash: hashPassword(password),
      // null = lastnik svoje (nove) skupine; sicer član povabljene skupine
      householdId: inv.scopeId,
    })
    .returning();
  const user = created[0];

  if (inv.scopeId !== null) {
    await notifyScope({ ...user, scope: inv.scopeId }, "user", "created", `se je pridružil(a) skupini`);
  }

  await createSession(user.id);
  redirect("/");
}
