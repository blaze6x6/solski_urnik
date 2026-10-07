// Ob zagonu strežnika: migracije baze, seed demo vsebine in (opcijsko)
// načrtovano dnevno e-poštno obveščanje.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.DATABASE_URL) return;

  const g = globalThis as typeof globalThis & { __urnik_booted?: boolean };
  if (g.__urnik_booted) return;
  g.__urnik_booted = true;

  try {
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const { db } = await import("@/db");
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("[boot] migracije uspešne");
  } catch (err) {
    console.error("[boot] napaka pri migracijah baze:", err);
  }

  try {
    const { ensureSeed } = await import("@/lib/seed");
    const seeded = await ensureSeed();
    if (seeded) console.log("[boot] demo vsebina ustvarjena");
  } catch (err) {
    console.error("[boot] napaka pri seedanju baze:", err);
  }

  // Dnevni e-poštni povzetek (ENABLE_DIGEST=1 + SMTP_* spremenljivke)
  if (process.env.ENABLE_DIGEST === "1" && process.env.SMTP_HOST) {
    scheduleDigest();
  }

  // Opomniki za dogodke — preverjanje vsakih 5 minut
  if (process.env.SMTP_HOST && process.env.ENABLE_REMINDERS !== "0") {
    scheduleReminders();
  }
}

function scheduleReminders() {
  const everyMs = Math.max(1, Number(process.env.REMINDER_INTERVAL_MIN ?? 5)) * 60_000;
  console.log(`[opomniki] preverjanje vsakih ${everyMs / 60000} min`);
  const timer = setInterval(async () => {
    try {
      const { processDueReminders } = await import("@/lib/event-mail");
      const sent = await processDueReminders();
      if (sent > 0) console.log(`[opomniki] poslanih: ${sent}`);
    } catch (err) {
      console.error("[opomniki] napaka:", err);
    }
  }, everyMs);
  timer.unref?.();
}

function scheduleDigest() {
  const time = process.env.DIGEST_TIME ?? "06:30";
  const [h, m] = time.split(":").map(Number);
  const now = new Date();
  const next = new Date(now);
  next.setHours(h || 6, m || 30, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  const delay = next.getTime() - now.getTime();
  console.log(`[digest] naslednji pošiljanje: ${next.toLocaleString("sl-SI")}`);

  const timer = setTimeout(async () => {
    try {
      const { sendDigestToAllUsers } = await import("@/lib/email");
      const sent = await sendDigestToAllUsers();
      console.log(`[digest] poslanih: ${sent}`);
    } catch (err) {
      console.error("[digest] napaka:", err);
    } finally {
      scheduleDigest();
    }
  }, delay);
  timer.unref?.();
}
