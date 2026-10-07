import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db } from "@/db";
import { passwordResets } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { ResetPasswordForm } from "@/components/reset-forms";
import { SiteFooter } from "@/components/site-footer";

export const metadata = { title: "Nastavitev gesla" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  if (await getSessionUser()) redirect("/");
  const { token = "" } = await searchParams;

  const valid = token
    ? (
        await db
          .select({ id: passwordResets.id })
          .from(passwordResets)
          .where(
            and(
              eq(passwordResets.tokenHash, createHash("sha256").update(token).digest("hex")),
              gt(passwordResets.expiresAt, new Date()),
            ),
          )
          .limit(1)
      ).length > 0
    : false;

  return (
    <main className="safe-login flex min-h-dvh flex-col px-6 pt-12 pb-5">
      <div className="m-auto w-full max-w-sm py-6">
        <h1 className="font-display text-3xl font-medium tracking-tight">Nastavitev novega gesla</h1>
        {valid ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div className="mt-6 space-y-4">
            <p className="rounded-xl border border-[#e6c4ba] bg-[#faeeea] px-4 py-3 text-sm font-medium text-[#a03d2e]">
              Povezava je neveljavna ali je potekla.
            </p>
            <Link href="/pozabljeno" className="btn btn-primary w-full py-3 text-sm">
              Zahtevaj novo povezavo
            </Link>
          </div>
        )}
      </div>
      <SiteFooter />
    </main>
  );
}
