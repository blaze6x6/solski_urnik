import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  date,
  timestamp,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Uporabniki (administratorji) in seje
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  notifyEmail: boolean("notify_email").notNull().default(true),
  /** superadministrator: lahko odstrani vse ostale administratorje in uporabnike */
  isSuperadmin: boolean("is_superadmin").notNull().default(false),
  /** izbrana barvna tema videza (ključ iz lib/themes.ts) */
  theme: text("theme").notNull().default("smaragd"),
  /** način videza: "light" | "dark" | "auto" (po nastavitvi naprave) */
  mode: text("mode").notNull().default("light"),
  /**
   * Skupina (gospodinjstvo), ki si deli otroke, urnike in dogodke.
   * null = uporabnik je lastnik svoje skupine (uporabi se njegov id).
   */
  householdId: integer("household_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Otroci in predmeti
// ---------------------------------------------------------------------------

export const children = pgTable("children", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  className: text("class_name").notNull().default(""),
  school: text("school").notNull().default(""),
  color: text("color").notNull().default("#1F4A38"),
  /** neobvezni osebni podatki otroka */
  address: text("address").notNull().default(""),
  postalCode: text("postal_code").notNull().default(""),
  city: text("city").notNull().default(""),
  emso: text("emso").notNull().default(""),
  taxNumber: text("tax_number").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  abbr: text("abbr").notNull(),
  colorIdx: integer("color_idx").notNull().default(0),
});

// ---------------------------------------------------------------------------
// Vrstni red ur in urnik
// ---------------------------------------------------------------------------

export const timeSlots = pgTable("time_slots", {
  id: serial("id").primaryKey(),
  childId: integer("child_id")
    .notNull()
    .references(() => children.id, { onDelete: "cascade" }),
  /** vrstni red prikaza (lahko tudi 0 za preduro) */
  period: integer("period").notNull(),
  /** poljubno ime: "Predura", "1. ura", "Malica", "Kosilo" … */
  label: text("label").notNull().default(""),
  /** 'lesson' = učna ura, 'break' = odmor */
  kind: text("kind").notNull().default("lesson"),
  /** ali se vrstica prikaže v urniku */
  showInTimetable: boolean("show_in_timetable").notNull().default(true),
  start: text("start").notNull(),
  end: text("end").notNull(),
}, (t) => [uniqueIndex("timeslot_child_period").on(t.childId, t.period)]);

export const timetableEntries = pgTable("timetable_entries", {
  id: serial("id").primaryKey(),
  childId: integer("child_id")
    .notNull()
    .references(() => children.id, { onDelete: "cascade" }),
  /** 0 = ponedeljek … 4 = petek */
  weekday: integer("weekday").notNull(),
  slotId: integer("slot_id")
    .notNull()
    .references(() => timeSlots.id, { onDelete: "cascade" }),
  subjectId: integer("subject_id").references(() => subjects.id, {
    onDelete: "cascade",
  }),
}, (t) => [uniqueIndex("entry_child_day_slot").on(t.childId, t.weekday, t.slotId)]);

// ---------------------------------------------------------------------------
// Vozni red avtobusa
// ---------------------------------------------------------------------------

export const busRoutes = pgTable("bus_routes", {
  id: serial("id").primaryKey(),
  childId: integer("child_id")
    .notNull()
    .references(() => children.id, { onDelete: "cascade" }),
  /** 'to' = v šolo, 'from' = iz šole */
  direction: text("direction").notNull(),
  /** opuščeno v vmesniku (nadomestila sta ga odhod in prihod); stolpec ostane zaradi starih podatkov */
  line: text("line").notNull().default(""),
  stop: text("stop").notNull().default(""),
  /** odhod (HH:MM) */
  time: text("time").notNull(),
  /** prihod (HH:MM), neobvezno */
  arrivalTime: text("arrival_time"),
  /** dnevi 0=pon .. 4=pet */
  days: integer("days").array().notNull().default([0, 1, 2, 3, 4]),
  note: text("note").notNull().default(""),
});

/**
 * Stalni vozni red (postaje × vožnje) za tisk ali izvoz v PDF. Ni vezan na
 * posameznega otroka — velja za skupino (gospodinjstvo).
 */
/** Žetoni za ponastavitev pozabljenega gesla (shranjen je samo zgoščen žeton, veljajo 1 uro). */
export const passwordResets = pgTable("password_resets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const busTimetables = pgTable("bus_timetables", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** npr. »Velja od 1. 9. 2026« */
  subtitle: text("subtitle").notNull().default(""),
  /** opomba pod tabelo (npr. legenda znakov) */
  note: text("note").notNull().default(""),
  /** JSON: { stops: string[], trips: [{ label, times: string[] }] } */
  data: text("data").notNull().default('{"stops":[],"trips":[]}'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Dogodki
// ---------------------------------------------------------------------------

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  /** null = velja za vse otroke */
  childId: integer("child_id").references(() => children.id, {
    onDelete: "cascade",
  }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  location: text("location").notNull().default(""),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }),
  allDay: boolean("all_day").notNull().default(true),
  /** ročno vnesen čas "HH:MM" (ko dogodek ni celodnevni in ni vezan na šolsko uro) */
  startTime: text("start_time"),
  endTime: text("end_time"),
  slotId: integer("slot_id").references(() => timeSlots.id, {
    onDelete: "set null",
  }),
  /** skupina (gospodinjstvo), ki ji dogodek pripada — za obveščanje */
  scopeId: integer("scope_id"),
  /** 'none' | 'weekly' | 'biweekly' | 'triweekly' | 'monthly' */
  recurrence: text("recurrence").notNull().default("none"),
  /** zadnji dan ponavljanja (vključno); null = brez omejitve */
  recurrenceUntil: date("recurrence_until", { mode: "string" }),
  /**
   * Ponavljajoč dogodek brez zadnjega dne se samodejno konča s koncem šolskega
   * leta; ta kljukica to omejitev izklopi (ponavlja se brez konca).
   */
  ignoreYearEnd: boolean("ignore_year_end").notNull().default(false),
  color: text("color").notNull().default("amber"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * Dodatni e-poštni naslovi uporabnika (npr. službeni, partnerjev).
 * Za vsakega posebej določimo, katere vrste obvestil prejema.
 */
export const userEmails = pgTable(
  "user_emails",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    label: text("label").notNull().default(""),
    /** novi dogodki (ob dodajanju) */
    notifyNewEvents: boolean("notify_new_events").notNull().default(true),
    /** spremembe obstoječih dogodkov */
    notifyEventChanges: boolean("notify_event_changes").notNull().default(true),
    /** opomniki pred dogodkom */
    notifyReminders: boolean("notify_reminders").notNull().default(true),
    /** dnevni povzetek urnika in ostala obvestila */
    notifyDigest: boolean("notify_digest").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("user_email_unique").on(t.userId, t.email)],
);

/**
 * Odpadle ponovitve dogodka (npr. ta teden krožek odpade).
 * Dogodek ostane, v urniku pa je ta termin siv, prečrtan in označen z »Odpade«.
 */
export const eventCancellations = pgTable(
  "event_cancellations",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    /** začetni datum konkretne ponovitve dogodka */
    occurrenceDate: date("occurrence_date", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("event_cancel_once").on(t.eventId, t.occurrenceDate)],
);

/**
 * Odpadle ure pouka (npr. učitelj je odsoten): predmet ostane v urniku,
 * ta konkretni datum pa je prečrtan in označen z »Odpade«.
 */
export const lessonCancellations = pgTable(
  "lesson_cancellations",
  {
    id: serial("id").primaryKey(),
    childId: integer("child_id")
      .notNull()
      .references(() => children.id, { onDelete: "cascade" }),
    slotId: integer("slot_id")
      .notNull()
      .references(() => timeSlots.id, { onDelete: "cascade" }),
    /** datum, na katerega ura odpade */
    date: date("date", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("lesson_cancel_once").on(t.childId, t.slotId, t.date)],
);

/** E-poštni opomniki pred dogodkom (lahko jih je več na dogodek). */
export const eventReminders = pgTable("event_reminders", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  /** koliko minut pred začetkom se pošlje opomnik */
  minutesBefore: integer("minutes_before").notNull(),
});

/** Dnevnik poslanih opomnikov, da se isti termin ne pošlje dvakrat. */
export const reminderLog = pgTable(
  "reminder_log",
  {
    id: serial("id").primaryKey(),
    reminderId: integer("reminder_id")
      .notNull()
      .references(() => eventReminders.id, { onDelete: "cascade" }),
    /** datum konkretne ponovitve dogodka */
    occurrenceDate: date("occurrence_date", { mode: "string" }).notNull(),
    sentAt: timestamp("sent_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("reminder_once").on(t.reminderId, t.occurrenceDate)],
);

// ---------------------------------------------------------------------------
// Šolsko leto in počitnice
// ---------------------------------------------------------------------------

export const schoolYears = pgTable("school_years", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  isActive: boolean("is_active").notNull().default(false),
});

export const schoolBreaks = pgTable("school_breaks", {
  id: serial("id").primaryKey(),
  schoolYearId: integer("school_year_id")
    .notNull()
    .references(() => schoolYears.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
});

// ---------------------------------------------------------------------------
// Obvestila (zvonec) — vezana na skupino (gospodinjstvo)
// ---------------------------------------------------------------------------

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    /** skupina, ki ji obvestilo pripada (users.id lastnika skupine) */
    scopeId: integer("scope_id").notNull(),
    actorId: integer("actor_id"),
    actorName: text("actor_name").notNull().default(""),
    /** event | timetable | bus | child | subject | year | note | grade | user */
    kind: text("kind").notNull(),
    /** created | updated | deleted */
    action: text("action").notNull(),
    text: text("text").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("notifications_scope_idx").on(t.scopeId, t.id)],
);

/** Stanje obvestila pri posameznem uporabniku: vrstica = prebrano, hidden = izbrisano. */
export const notificationStates = pgTable(
  "notification_states",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    notificationId: integer("notification_id")
      .notNull()
      .references(() => notifications.id, { onDelete: "cascade" }),
    hidden: boolean("hidden").notNull().default(false),
    readAt: timestamp("read_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.notificationId] })],
);

// ---------------------------------------------------------------------------
// Beležke in ocene
// ---------------------------------------------------------------------------

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  childId: integer("child_id")
    .notNull()
    .references(() => children.id, { onDelete: "cascade" }),
  subjectId: integer("subject_id").references(() => subjects.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  noteDate: date("note_date", { mode: "string" }).notNull(),
  pinned: boolean("pinned").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const grades = pgTable("grades", {
  id: serial("id").primaryKey(),
  childId: integer("child_id")
    .notNull()
    .references(() => children.id, { onDelete: "cascade" }),
  subjectId: integer("subject_id")
    .notNull()
    .references(() => subjects.id, { onDelete: "cascade" }),
  grade: integer("grade").notNull(),
  gradeDate: date("grade_date", { mode: "string" }).notNull(),
  type: text("type").notNull().default("pisni izpit"),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

export type User = typeof users.$inferSelect;
export type UserEmail = typeof userEmails.$inferSelect;
export type Child = typeof children.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type TimeSlot = typeof timeSlots.$inferSelect;
export type TimetableEntry = typeof timetableEntries.$inferSelect;
export type BusRoute = typeof busRoutes.$inferSelect;
export type BusTimetable = typeof busTimetables.$inferSelect;
export type SchoolEvent = typeof events.$inferSelect;
export type EventReminder = typeof eventReminders.$inferSelect;
export type SchoolYear = typeof schoolYears.$inferSelect;
export type SchoolBreak = typeof schoolBreaks.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type Grade = typeof grades.$inferSelect;
