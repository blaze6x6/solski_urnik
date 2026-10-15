import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { findValidInvite } from "@/lib/invites";
import { AcceptInviteForm } from "@/components/invite-forms";
import { SiteFooter } from "@/components/site-footer";

export const metadata = { title: "Vabilo" };

export default async function InvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  if (await getSessionUser()) redirect("/");
  const { token = "" } = await searchParams;
  const invite = await findValidInvite(token);

  let groupOwner: string | null = null;
  if (invite && invite.scopeId !== null) {
    const owner = await db.select({ name: users.name }).from(users).where(eq(users.id, invite.scopeId)).limit(1);
    groupOwner = owner[0]?.name ?? null;
  }

  return (
    <main className="safe-login flex min-h-dvh flex-col px-6 pt-12 pb-5">
      <div className="m-auto w-full max-w-sm py-6">
        {invite ? (
          <>
            <h1 className="font-display text-3xl font-medium tracking-tight">Dobrodošli</h1>
            <p className="mt-2 text-sm text-ink-soft">
              {invite.scopeId === null
                ? "Ustvarite svoj račun v aplikaciji Šolski urnik. Postali boste administrator svoje družine in lahko povabili še druge člane."
                : `Ustvarite račun in se pridružite skupini${groupOwner ? ` »${groupOwner}«` : ""}. Videli boste iste otroke, urnike in dogodke.`}
            </p>
            <AcceptInviteForm token={token} email={invite.email} />
          </>
        ) : (
          <>
            <h1 className="font-display text-3xl font-medium tracking-tight">Vabilo ni veljavno</h1>
            <p className="mt-2 text-sm text-ink-soft">
              Povezava je potekla, je bila že uporabljena ali jo je pošiljatelj preklical. Prosite za novo vabilo.
            </p>
            <Link href="/login" className="btn btn-ghost mt-6 w-full">
              Na prijavo
            </Link>
          </>
        )}
      </div>
      <SiteFooter />
    </main>
  );
}
