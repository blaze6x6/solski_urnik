// ---------------------------------------------------------------------------
// Vabila po e-pošti (nova skupina / pridružitev obstoječi skupini)
// ---------------------------------------------------------------------------

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { invitations, users, type Invitation } from "@/db/schema";
import { escHtml } from "@/lib/text";

export const INVITE_TTL_DAYS = 7;

export const hashInviteToken = (t: string) => createHash("sha256").update(t).digest("hex");

export async function appOrigin(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Ustvari vabilo; vrne nešifriran žeton (v bazi je samo zgoščena vrednost). */
export async function createInvite(opts: {
  email: string;
  scopeId: number | null;
  invitedBy: number;
}): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  // novo vabilo za isti naslov in skupino nadomesti prejšnje neuporabljeno
  const pending = await db
    .select()
    .from(invitations)
    .where(and(eq(invitations.email, opts.email), isNull(invitations.usedAt)));
  for (const p of pending) {
    if ((p.scopeId ?? null) === (opts.scopeId ?? null)) await db.delete(invitations).where(eq(invitations.id, p.id));
  }
  await db.insert(invitations).values({
    tokenHash: hashInviteToken(token),
    email: opts.email,
    scopeId: opts.scopeId,
    invitedBy: opts.invitedBy,
    expiresAt,
  });
  return { token, expiresAt };
}

/** Veljavno (neuporabljeno, nepotečeno) vabilo za žeton ali null. */
export async function findValidInvite(token: string): Promise<Invitation | null> {
  if (!token) return null;
  const rows = await db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.tokenHash, hashInviteToken(token)),
        isNull(invitations.usedAt),
        gt(invitations.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export type PendingInvite = {
  id: number;
  email: string;
  expiresAt: string;
  /** ime povabljenca ni znano; pri vabilih v skupino se pokaže, kdo je povabil */
  invitedByName: string;
};

/** Čakajoča vabila (neuporabljena, nepotečena). `scopeId` = null → vabila za nove skupine. */
export async function pendingInvites(scopeId: number | null): Promise<PendingInvite[]> {
  const rows = await db
    .select({ inv: invitations, by: users.name })
    .from(invitations)
    .innerJoin(users, eq(users.id, invitations.invitedBy))
    .where(and(isNull(invitations.usedAt), gt(invitations.expiresAt, new Date())))
    .orderBy(desc(invitations.id));
  return rows
    .filter((r) => (r.inv.scopeId ?? null) === scopeId)
    .map((r) => ({ id: r.inv.id, email: r.inv.email, expiresAt: r.inv.expiresAt.toISOString(), invitedByName: r.by }));
}

export function inviteMailHtml(opts: {
  link: string;
  inviterName: string;
  newGroup: boolean;
  groupOwnerName?: string;
}): string {
  const intro = opts.newGroup
    ? `${escHtml(opts.inviterName)} vas vabi, da ustvarite svoj račun v aplikaciji <strong>Šolski urnik</strong>. Postali boste administrator svoje družine (lastni otroci, urniki in dogodki) in lahko nato povabite še druge člane.`
    : `${escHtml(opts.inviterName)} vas vabi v skupino${opts.groupOwnerName ? ` »${escHtml(opts.groupOwnerName)}«` : ""} v aplikaciji <strong>Šolski urnik</strong>. Po registraciji boste videli iste otroke, urnike in dogodke.`;
  return `<div style="font-family:system-ui,sans-serif;max-width:480px">
    <p>Pozdravljeni,</p>
    <p>${intro}</p>
    <p><a href="${opts.link}" style="display:inline-block;background:#06a66b;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:600">Ustvari račun</a></p>
    <p style="color:#6b7280;font-size:13px">Povezava velja ${INVITE_TTL_DAYS} dni in jo je mogoče uporabiti samo enkrat. Če vabila niste pričakovali, tega sporočila preprosto prezrite.</p>
    <p style="color:#9ca3af;font-size:12px;word-break:break-all">Če gumb ne deluje, odprite: ${opts.link}</p>
  </div>`;
}
