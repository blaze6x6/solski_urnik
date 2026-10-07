// ---------------------------------------------------------------------------
// Živahna barvna paleta predmetov, dogodkov in otrok
// ---------------------------------------------------------------------------

export type PaletteEntry = {
  key: string;
  label: string;
  /** močna, nasičena barva (pike, značke) */
  solid: string;
  /** svetlo ozadje celice */
  soft: string;
  /** barva besedila na mehkem ozadju */
  ink: string;
};

/** 30 razločnih, živih barv za predmete. */
export const SUBJECT_PALETTE: PaletteEntry[] = [
  { key: "emerald", label: "Smaragd", solid: "#06a66b", soft: "#d8f8ea", ink: "#046c46" },
  { key: "azure", label: "Azur", solid: "#1d7ff0", soft: "#dbeafe", ink: "#15539c" },
  { key: "tangerine", label: "Mandarina", solid: "#f58316", soft: "#ffeeda", ink: "#a9540a" },
  { key: "crimson", label: "Karmin", solid: "#ec2f55", soft: "#ffe2e8", ink: "#a2103a" },
  { key: "violet", label: "Vijolična", solid: "#8b45e8", soft: "#eee3fd", ink: "#5c21a8" },
  { key: "turquoise", label: "Turkiz", solid: "#06b3b8", soft: "#d4f7f7", ink: "#0a7175" },
  { key: "coral", label: "Korala", solid: "#fb6a4b", soft: "#ffe6df", ink: "#b23a21" },
  { key: "lime", label: "Limeta", solid: "#7cb518", soft: "#eef8d6", ink: "#4e7409" },
  { key: "magenta", label: "Magenta", solid: "#e0338f", soft: "#ffe1f1", ink: "#9c0f5d" },
  { key: "indigo", label: "Indigo", solid: "#4f46e5", soft: "#e3e2fd", ink: "#322ca0" },
  { key: "gold", label: "Zlata", solid: "#e0a800", soft: "#fff3cf", ink: "#946c00" },
  { key: "teal", label: "Morska", solid: "#0d9488", soft: "#d5f5f0", ink: "#0a615a" },
  { key: "rose", label: "Rožnata", solid: "#f43f6b", soft: "#ffe4ec", ink: "#a81340" },
  { key: "sky", label: "Nebesna", solid: "#0bb3ea", soft: "#d9f2fd", ink: "#07729a" },
  { key: "plum", label: "Sliva", solid: "#a23fc4", soft: "#f6e2fb", ink: "#6c1d87" },
  { key: "forest", label: "Gozd", solid: "#2e8b3d", soft: "#dff5e2", ink: "#1d5c28" },
  { key: "copper", label: "Baker", solid: "#d2691e", soft: "#fdeada", ink: "#8e4310" },
  { key: "steel", label: "Jeklo", solid: "#51708f", soft: "#e3ecf5", ink: "#334c66" },
  { key: "ruby", label: "Rubin", solid: "#c4163a", soft: "#fddde4", ink: "#850b24" },
  { key: "lavender", label: "Sivka", solid: "#9b7fe6", soft: "#ede8fc", ink: "#5d44b0" },
  { key: "mint", label: "Meta", solid: "#27c490", soft: "#d7f8ec", ink: "#0c7552" },
  { key: "peach", label: "Breskev", solid: "#ff9b71", soft: "#ffe9de", ink: "#b0501f" },
  { key: "navy", label: "Mornarska", solid: "#1e4fa3", soft: "#dce6f8", ink: "#143570" },
  { key: "olive", label: "Oljka", solid: "#8a8f1c", soft: "#f2f3d3", ink: "#585c0a" },
  { key: "bubblegum", label: "Žvečilka", solid: "#ff6fb5", soft: "#ffe2f1", ink: "#b02a77" },
  { key: "chocolate", label: "Čokolada", solid: "#8d5a3b", soft: "#f4e6dc", ink: "#5c3720" },
  { key: "aqua", label: "Akva", solid: "#22d3ee", soft: "#d8f8fd", ink: "#0a7a8c" },
  { key: "sunflower", label: "Sončnica", solid: "#f7c600", soft: "#fff6c9", ink: "#8a6d00" },
  { key: "slate", label: "Skrilavec", solid: "#64748b", soft: "#e6eaf0", ink: "#3b4658" },
  { key: "grape", label: "Grozdje", solid: "#6d28d9", soft: "#e9defb", ink: "#46189a" },
];

export function subjectColor(idx: number): PaletteEntry {
  const n = SUBJECT_PALETTE.length;
  return SUBJECT_PALETTE[((idx % n) + n) % n];
}

/** 20 barv za dogodke. */
export const EVENT_COLORS: Record<string, { label: string; solid: string; soft: string; ink: string }> = {
  amber: { label: "Jantar", solid: "#f59e0b", soft: "#fff0d2", ink: "#9a5e04" },
  sky: { label: "Nebo", solid: "#0ea5e9", soft: "#ddf1fd", ink: "#0a6894" },
  rose: { label: "Vrtnica", solid: "#f43f5e", soft: "#ffe3e9", ink: "#a4123a" },
  violet: { label: "Vijola", solid: "#8b5cf6", soft: "#ece3fe", ink: "#5a26b8" },
  green: { label: "Zelena", solid: "#16a34a", soft: "#dcf7e5", ink: "#0d6b31" },
  orange: { label: "Oranžna", solid: "#f97316", soft: "#ffe9d6", ink: "#a74707" },
  cyan: { label: "Cijan", solid: "#06b6d4", soft: "#d3f6fb", ink: "#0a7284" },
  magenta: { label: "Magenta", solid: "#db2777", soft: "#fde0ef", ink: "#920a4d" },
  lime: { label: "Limeta", solid: "#84cc16", soft: "#f0fad4", ink: "#4f7a08" },
  indigo: { label: "Indigo", solid: "#6366f1", soft: "#e4e5fe", ink: "#3a3bb5" },
  red: { label: "Rdeča", solid: "#dc2626", soft: "#fee2e2", ink: "#8f1414" },
  teal: { label: "Morska", solid: "#0d9488", soft: "#d5f5f0", ink: "#0a615a" },
  navy: { label: "Mornarska", solid: "#1d4ed8", soft: "#dbe5fd", ink: "#13338f" },
  purple: { label: "Škrlatna", solid: "#a21caf", soft: "#f8dffb", ink: "#6b1273" },
  brown: { label: "Rjava", solid: "#a0643c", soft: "#f6e7db", ink: "#68391a" },
  gold: { label: "Zlata", solid: "#d4a017", soft: "#fdf1cc", ink: "#86640a" },
  mint: { label: "Meta", solid: "#10b981", soft: "#d3f6e8", ink: "#0a7050" },
  pink: { label: "Roza", solid: "#ec4899", soft: "#fde1ef", ink: "#a0235f" },
  slate: { label: "Skrilavec", solid: "#64748b", soft: "#e6eaf0", ink: "#3b4658" },
  coral: { label: "Korala", solid: "#fb7185", soft: "#ffe4e8", ink: "#b02a42" },
};

export function eventColor(key: string) {
  return EVENT_COLORS[key] ?? EVENT_COLORS.amber;
}

/** 24 barv za otroke. */
export const CHILD_COLORS = [
  { value: "#06a66b", label: "Smaragdna" },
  { value: "#1d7ff0", label: "Azurna" },
  { value: "#f58316", label: "Mandarina" },
  { value: "#ec2f55", label: "Karminska" },
  { value: "#8b45e8", label: "Vijolična" },
  { value: "#06b3b8", label: "Turkizna" },
  { value: "#e0338f", label: "Magenta" },
  { value: "#7cb518", label: "Limetina" },
  { value: "#0bb3ea", label: "Nebesna" },
  { value: "#d2691e", label: "Bakrena" },
  { value: "#4f46e5", label: "Indigo" },
  { value: "#f43f6b", label: "Rožnata" },
  { value: "#c4163a", label: "Rubinasta" },
  { value: "#0d9488", label: "Morska" },
  { value: "#1e4fa3", label: "Mornarska" },
  { value: "#6d28d9", label: "Grozdna" },
  { value: "#a23fc4", label: "Slivna" },
  { value: "#2e8b3d", label: "Gozdna" },
  { value: "#e0a800", label: "Zlata" },
  { value: "#ff6fb5", label: "Žvečilkasta" },
  { value: "#27c490", label: "Metina" },
  { value: "#8d5a3b", label: "Čokoladna" },
  { value: "#51708f", label: "Jeklena" },
  { value: "#64748b", label: "Skrilasta" },
];

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Relativna svetlost za izbiro kontrastnega besedila. */
export function readableOn(hex: string): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.6 ? "#1d2126" : "#ffffff";
}

/** Barve za ocene 1–5. */
export const GRADE_COLORS: Record<number, { bg: string; ink: string }> = {
  5: { bg: "#06a66b", ink: "#ffffff" },
  4: { bg: "#7cb518", ink: "#ffffff" },
  3: { bg: "#f0a500", ink: "#ffffff" },
  2: { bg: "#f97316", ink: "#ffffff" },
  1: { bg: "#ec2f55", ink: "#ffffff" },
};
