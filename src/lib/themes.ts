// ---------------------------------------------------------------------------
// Barvne teme — vrednosti barv so v globals.css (blok [data-theme="…"]).
// Tukaj so samo ključi, imena in barve za predogled v izbirniku.
// ---------------------------------------------------------------------------

export type ThemeDef = {
  key: string;
  label: string;
  description: string;
  /** glavna, druga in poudarna barva za predogled */
  preview: [primary: string, secondary: string, accent: string];
  /** barva vrstice brskalnika na telefonu */
  themeColor: string;
};

export const THEMES: ThemeDef[] = [
  {
    key: "smaragd",
    label: "Smaragd",
    description: "Zelena z oranžnim poudarkom",
    preview: ["#06a66b", "#06b3b8", "#f58316"],
    themeColor: "#06a66b",
  },
  {
    key: "ocean",
    label: "Ocean",
    description: "Modra z oranžnim poudarkom",
    preview: ["#1d7ff0", "#0bb3ea", "#f58316"],
    themeColor: "#1d7ff0",
  },
  {
    key: "sliva",
    label: "Sliva",
    description: "Vijolična z rožnatim poudarkom",
    preview: ["#8b45e8", "#c13fd9", "#e0338f"],
    themeColor: "#8b45e8",
  },
  {
    key: "mandarina",
    label: "Mandarina",
    description: "Oranžna z modrim poudarkom",
    preview: ["#ea6a0a", "#f0a500", "#1d7ff0"],
    themeColor: "#ea6a0a",
  },
  {
    key: "turkiz",
    label: "Turkiz",
    description: "Turkizna z jantarnim poudarkom",
    preview: ["#0d9488", "#22b8cf", "#f59e0b"],
    themeColor: "#0d9488",
  },
  {
    key: "roza",
    label: "Roza",
    description: "Rožnata z vijoličnim poudarkom",
    preview: ["#e11d74", "#fb6fa6", "#7c3aed"],
    themeColor: "#e11d74",
  },
  {
    key: "indigo",
    label: "Indigo",
    description: "Indigo z rožnatim poudarkom",
    preview: ["#4f46e5", "#7c83f5", "#ec4899"],
    themeColor: "#4f46e5",
  },
  {
    key: "gozd",
    label: "Gozd",
    description: "Gozdno zelena z oranžnim poudarkom",
    preview: ["#2e8b3d", "#7cb518", "#d97706"],
    themeColor: "#2e8b3d",
  },
  {
    key: "rubin",
    label: "Rubin",
    description: "Rdeča z modrim poudarkom",
    preview: ["#d92d43", "#f2607a", "#0ea5e9"],
    themeColor: "#d92d43",
  },
  {
    key: "korala",
    label: "Korala",
    description: "Korala z morskim poudarkom",
    preview: ["#f0654a", "#ff9b71", "#0d9488"],
    themeColor: "#f0654a",
  },
  {
    key: "skrilavec",
    label: "Skrilavec",
    description: "Umirjena siva z modrim poudarkom",
    preview: ["#475569", "#64748b", "#0ea5e9"],
    themeColor: "#475569",
  },
];

export const DEFAULT_THEME = "smaragd";
export const THEME_COOKIE = "urnik_tema";

export function isTheme(key: string | null | undefined): key is string {
  return !!key && THEMES.some((t) => t.key === key);
}

export function themeOf(key: string | null | undefined): ThemeDef {
  return THEMES.find((t) => t.key === key) ?? THEMES[0];
}

// ---------------------------------------------------------------------------
// Način videza (svetlo / temno / samodejno) — neodvisen od barvne teme,
// zato je vsaka tema na voljo v svetli in temni različici.
// ---------------------------------------------------------------------------
export const MODES = [
  { key: "light", label: "Svetlo", description: "Vedno svetel videz" },
  { key: "dark", label: "Temno", description: "Vedno temen videz" },
  { key: "auto", label: "Samodejno", description: "Sledi nastavitvi naprave" },
] as const;

export type ModeKey = (typeof MODES)[number]["key"];
export const DEFAULT_MODE: ModeKey = "light";
export const MODE_COOKIE = "urnik_nacin";

export function isMode(key: string | null | undefined): key is ModeKey {
  return !!key && MODES.some((m) => m.key === key);
}

export function modeOf(key: string | null | undefined): ModeKey {
  return isMode(key) ? key : DEFAULT_MODE;
}

/** Barva vrstice brskalnika na telefonu v temnem načinu. */
export const DARK_THEME_COLOR = "#0e1217";
