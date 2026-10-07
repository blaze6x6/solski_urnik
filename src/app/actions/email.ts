"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { sendDigestToUser, smtpConfigured } from "@/lib/email";

/** Ročno pošiljanje dnevnega povzetka trenutnemu uporabniku (test). */
export async function sendDigestNowAction(): Promise<void> {
  const user = await requireUser();
  if (!smtpConfigured()) {
    redirect("/nastavitve?tab=posta&napaka=smtp");
  }
  try {
    await sendDigestToUser(user);
  } catch (err) {
    console.error("[posta] napaka pri pošiljanju:", err);
    redirect("/nastavitve?tab=posta&napaka=poslji");
  }
  redirect("/nastavitve?tab=posta&poslano=1");
}
