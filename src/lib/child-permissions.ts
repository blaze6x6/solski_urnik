// ---------------------------------------------------------------------------
// Pravice otroškega profila. Administrator skupine jih nastavi pri vsakem
// otroku posebej; shranjene so kot JSON v users.child_perms (null = privzeto).
// ---------------------------------------------------------------------------

export type NotesLevel = "off" | "view" | "own" | "all";
export type GradesLevel = "off" | "view" | "edit" | "full";

export type ChildPerms = {
  /** strani */
  pregled: boolean;
  urnik: boolean;
  koledar: boolean;
  avtobus: boolean;
  /** beležke: skrito / ogled / svoje (dodaja, ureja, briše svoje) / vse (tudi starševe) */
  belezke: NotesLevel;
  /** ocene: skrito / ogled / dodaja in ureja (brisanje s potrditvijo starša) / tudi briše */
  ocene: GradesLevel;
  /** nastavitve: videz je vedno na voljo */
  push: boolean;
  geslo: boolean;
};

export const DEFAULT_CHILD_PERMS: ChildPerms = {
  pregled: true,
  urnik: true,
  koledar: true,
  avtobus: false,
  belezke: "own",
  ocene: "edit",
  push: true,
  geslo: true,
};

export const NOTES_LEVELS: Array<{ value: NotesLevel; label: string }> = [
  { value: "off", label: "Skrito" },
  { value: "view", label: "Samo ogled" },
  { value: "own", label: "Svoje beležke (dodaja, ureja, briše)" },
  { value: "all", label: "Vse beležke (tudi starševe)" },
];

export const GRADES_LEVELS: Array<{ value: GradesLevel; label: string }> = [
  { value: "off", label: "Skrito" },
  { value: "view", label: "Samo ogled" },
  { value: "edit", label: "Dodaja in ureja (brisanje potrdi starš)" },
  { value: "full", label: "Dodaja, ureja in briše" },
];

const isNotes = (v: unknown): v is NotesLevel => v === "off" || v === "view" || v === "own" || v === "all";
const isGrades = (v: unknown): v is GradesLevel => v === "off" || v === "view" || v === "edit" || v === "full";

/** Razčleni shranjeni JSON; manjkajoče ali neveljavne vrednosti dobijo privzeto. */
export function parseChildPerms(raw: string | null | undefined): ChildPerms {
  let o: Record<string, unknown> = {};
  if (raw) {
    try {
      const p = JSON.parse(raw);
      if (p && typeof p === "object") o = p as Record<string, unknown>;
    } catch {
      /* privzeto */
    }
  }
  const d = DEFAULT_CHILD_PERMS;
  const bool = (k: keyof ChildPerms, def: boolean) => (typeof o[k] === "boolean" ? (o[k] as boolean) : def);
  return {
    pregled: bool("pregled", d.pregled),
    urnik: bool("urnik", d.urnik),
    koledar: bool("koledar", d.koledar),
    avtobus: bool("avtobus", d.avtobus),
    belezke: isNotes(o.belezke) ? o.belezke : d.belezke,
    ocene: isGrades(o.ocene) ? o.ocene : d.ocene,
    push: bool("push", d.push),
    geslo: bool("geslo", d.geslo),
  };
}

/** Pravice iz obrazca (polja perm_*; kljukice so prisotne samo, če so obkljukane). */
export function childPermsFromForm(fd: FormData): ChildPerms {
  const notes = fd.get("perm_belezke");
  const grades = fd.get("perm_ocene");
  return {
    pregled: fd.get("perm_pregled") !== null,
    urnik: fd.get("perm_urnik") !== null,
    koledar: fd.get("perm_koledar") !== null,
    avtobus: fd.get("perm_avtobus") !== null,
    belezke: isNotes(notes) ? notes : DEFAULT_CHILD_PERMS.belezke,
    ocene: isGrades(grades) ? grades : DEFAULT_CHILD_PERMS.ocene,
    push: fd.get("perm_push") !== null,
    geslo: fd.get("perm_geslo") !== null,
  };
}

export type ChildModule = "pregled" | "urnik" | "koledar" | "avtobus" | "belezke" | "ocene";

export function moduleAllowed(p: ChildPerms, m: ChildModule): boolean {
  if (m === "belezke") return p.belezke !== "off";
  if (m === "ocene") return p.ocene !== "off";
  return p[m];
}

const MODULE_HREF: Array<[ChildModule, string]> = [
  ["pregled", "/"],
  ["urnik", "/urnik"],
  ["koledar", "/koledar"],
  ["avtobus", "/avtobus"],
  ["ocene", "/ocene"],
  ["belezke", "/belezke"],
];

/** Povezave v navigaciji otroškega profila (Nastavitve so vedno na voljo zaradi videza). */
export function childNavHrefs(p: ChildPerms): string[] {
  return [...MODULE_HREF.filter(([m]) => moduleAllowed(p, m)).map(([, h]) => h), "/nastavitve"];
}

/** Kam preusmeriti, ko stran ni dovoljena. */
export function firstAllowedHref(p: ChildPerms): string {
  return childNavHrefs(p)[0];
}

/** Ali otrok z danimi pravicami sme videti obvestilo te vrste. */
export function notifAllowed(p: ChildPerms, kind: string): boolean {
  switch (kind) {
    case "event":
      return p.pregled || p.koledar || p.urnik;
    case "timetable":
      return p.urnik || p.pregled;
    case "bus":
      return p.avtobus;
    case "note":
      return p.belezke !== "off";
    case "grade":
      return p.ocene !== "off";
    default:
      return false;
  }
}

export const NOTIF_KINDS_ALL = ["event", "timetable", "bus", "note", "grade"] as const;

/** Vrste obvestil, ki jih sme otrok videti (za poizvedbo). */
export function allowedNotifKinds(p: ChildPerms): string[] {
  return NOTIF_KINDS_ALL.filter((k) => notifAllowed(p, k));
}

/** Zavihki Nastavitev otroškega profila. */
export function childSettingsTabs(p: ChildPerms): string[] {
  return ["videz", ...(p.push ? ["naprava"] : []), ...(p.geslo ? ["racun"] : [])];
}

/** Raven dostopa do beležk: administrator vse, otrok po nastavitvi. */
export function notesAccess(user: { perms: ChildPerms | null }): NotesLevel {
  return user.perms ? user.perms.belezke : "all";
}

/** Raven dostopa do ocen: administrator vse, otrok po nastavitvi. */
export function gradesAccess(user: { perms: ChildPerms | null }): GradesLevel {
  return user.perms ? user.perms.ocene : "full";
}
