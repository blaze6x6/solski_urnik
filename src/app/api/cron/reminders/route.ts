import { NextRequest, NextResponse } from "next/server";
import { processDueReminders } from "@/lib/event-mail";

export const dynamic = "force-dynamic";

/**
 * Pošlje vse zapadle e-poštne opomnike za dogodke.
 * GET /api/cron/reminders?secret=<CRON_SECRET>
 * Aplikacija to kliče tudi sama vsakih 5 minut (če je SMTP nastavljen).
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
    const sent = await processDueReminders();
    return NextResponse.json({ ok: true, sent });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
