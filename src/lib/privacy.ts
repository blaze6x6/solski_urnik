import { cache } from "react";
import { getImpersonator, getSessionUser } from "@/lib/auth";

/** Nadomestek za občutljive podatke v pogledu »oddaljena pomoč« (superadmin odpre račun kot uporabnik). */
export const MASK = "••••••••";

/**
 * Ali je trenutna seja superadminov ogled »kot« drug uporabnik ali otroški profil? V tem pogledu
 * se EMŠO in davčna številka skrijeta že na strežniku (v brskalnik sploh ne
 * pridejo). Zunaj zahtevka (opomniki, povzetki) vedno vrne false.
 */
export const isMaskedView = cache(async (): Promise<boolean> => {
  try {
    if ((await getImpersonator()) !== null) return true;
    // otroški profil nikoli ne vidi EMŠO in davčne številke
    return (await getSessionUser())?.isChild === true;
  } catch {
    return false;
  }
});
