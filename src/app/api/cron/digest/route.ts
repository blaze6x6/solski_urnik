import { NextRequest, NextResponse } from "next/server";
import { sendDigestToAllUsers } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Zunanji cron endpoint za dnevni e-poštni povzetek.
 * GET /api/cron/digest?secret=<CRON_SECRET>  (ali Authorization: Bearer <CRON_SECRET>)
 * Če CRON_SECRET ni nastavljen, je klic dovoljen (lokalna/poskusna raba).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const given =
      req.nextUrl.searchParams.get("secret") ??
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
      "";
    if (given !== secret) {
      return NextResponse.json({ ok: false, error: "Neveljaven CRON_SECRET." }, { status: 401 });
    }
  }
  try {
    const sent = await sendDigestToAllUsers();
    return NextResponse.json({ ok: true, sent });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
