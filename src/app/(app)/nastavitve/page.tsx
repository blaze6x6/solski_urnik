import Link from "next/link";
import {
  CalendarRange,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Mail,
  MailCheck,
  MailWarning,
  Palette,
  Palmtree,
  Plus,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import { householdUsers, requireUser } from "@/lib/auth";
import {
  getAllHouseholds,
  getBreaksForYear,
  getChildren,
  getSchoolYears,
  getSlots,
  getSubjects,
} from "@/lib/data";
import { saveChildAction, deleteChildAction } from "@/app/actions/children";
import { saveSubjectAction, deleteSubjectAction } from "@/app/actions/subjects";
import { activateSchoolYearAction, deleteBreakAction, deleteSchoolYearAction, saveBreakAction, saveSchoolYearAction, setNotifyEmailAction } from "@/app/actions/school";
import { sendDigestNowAction } from "@/app/actions/email";
import { smtpConfigured } from "@/lib/email";
import { CHILD_COLORS, SUBJECT_PALETTE, cn, subjectColor } from "@/lib/colors";
import { ColorPicker } from "@/components/color-picker";
import { SlotsEditor } from "@/components/slots-editor";
import { ModePicker, ThemePicker } from "@/components/theme-picker";
import { modeOf } from "@/lib/themes";
import { PasswordForm } from "@/components/password-form";
import { UsersPanel, type PanelUser } from "@/components/users-panel";
import { SuperadminPanel } from "@/components/superadmin-panel";
import { InstallPanel } from "@/components/pwa";
import { listUserEmails } from "@/lib/recipients";

export const metadata = { title: "Nastavitve" };

const TABS = [
  { key: "otroci", label: "Otroci", icon: Users },
  { key: "predmeti", label: "Predmeti", icon: GraduationCap },
  { key: "leto", label: "Šolsko leto", icon: CalendarRange },
  { key: "ure", label: "Vrstni red ur", icon: Clock3 },
  { key: "uporabniki", label: "Uporabniki", icon: UserCog },
  { key: "videz", label: "Videz", icon: Palette },
  { key: "naprava", label: "Naprava", icon: Smartphone },
  { key: "posta", label: "E-pošta", icon: Mail },
  { key: "racun", label: "Račun", icon: CheckCircle2 },
];

const SUPERADMIN_TAB = { key: "superadmin", label: "Superadmin", icon: ShieldCheck };

const CHILD_COLOR_OPTIONS = CHILD_COLORS.map((c) => ({ value: c.value, label: c.label, color: c.value }));
const SUBJECT_COLOR_OPTIONS = SUBJECT_PALETTE.map((p, i) => ({ value: String(i), label: p.label, color: p.solid }));

type SearchParams = { tab?: string; otrok?: string; poslano?: string; napaka?: string };

export default async function NastavitvePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const tab = sp.tab ?? "otroci";

  const [kids, subjects, years] = await Promise.all([
    getChildren(user.scope),
    getSubjects(user.scope),
    getSchoolYears(user.scope),
  ]);
  const activeYear = years.find((y) => y.isActive) ?? null;
  const activeBreaks = activeYear ? await getBreaksForYear(activeYear.id) : [];

  const slotKid = kids.find((k) => k.id === Number(sp.otrok)) ?? kids[0] ?? null;
  const slots = tab === "ure" && slotKid ? await getSlots(slotKid.id) : [];

  const members: PanelUser[] =
    tab === "uporabniki"
      ? await Promise.all(
          (await householdUsers(user.scope)).map(async (u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            notifyEmail: u.notifyEmail,
            shared: (u.householdId ?? u.id) === user.scope,
            isSelf: u.id === user.id,
            isOwner: u.id === user.scope,
            emails: (await listUserEmails(u.id)).map((e) => ({
              id: e.id,
              email: e.email,
              label: e.label,
              notifyNewEvents: e.notifyNewEvents,
              notifyEventChanges: e.notifyEventChanges,
              notifyReminders: e.notifyReminders,
              notifyDigest: e.notifyDigest,
            })),
          })),
        )
      : [];

  const sectionCard = "card p-6";
  const h2 = "font-display text-xl font-semibold";
  const sub = "mt-1 text-sm text-ink-soft";

  return (
    <div>
      <header className="mb-6">
        <p className="text-xs font-bold tracking-[0.2em] text-amber-strong uppercase">Upravljanje</p>
        <h1 className="font-display mt-2 text-4xl font-medium tracking-tight">Nastavitve</h1>
      </header>

      <div className="mb-6 flex flex-wrap gap-1.5 rounded-2xl border border-line bg-white p-1.5">
        {(user.isSuperadmin ? [...TABS, SUPERADMIN_TAB] : TABS).map((t) => (
          <Link
            key={t.key}
            href={`/nastavitve?tab=${t.key}${t.key === "ure" && slotKid ? `&otrok=${slotKid.id}` : ""}`}
            className={cn("tab-link", tab === t.key && "tab-link-active")}
          >
            <t.icon className="h-4 w-4" strokeWidth={2.2} />
            {t.label}
          </Link>
        ))}
      </div>

      {/* ------------------------- OTROCI ------------------------- */}
      {tab === "otroci" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {kids.map((k) => (
            <div key={k.id} className={sectionCard}>
              <form action={saveChildAction} className="space-y-4">
                <input type="hidden" name="id" value={k.id} />
                <div className="flex items-center justify-between">
                  <h2 className={h2}>{k.name}</h2>
                  <span className="h-5 w-5 rounded-full ring-2 ring-line" style={{ background: k.color }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="label">Ime in priimek</label>
                    <input name="name" required className="input" defaultValue={k.name} />
                  </div>
                  <div>
                    <label className="label">Razred</label>
                    <input name="className" className="input" defaultValue={k.className} placeholder="npr. 3. b" />
                  </div>
                  <div>
                    <label className="label">Barva</label>
                    <ColorPicker name="color" options={CHILD_COLOR_OPTIONS} defaultValue={k.color} />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Šola</label>
                    <input name="school" className="input" defaultValue={k.school} placeholder="npr. OŠ Danile Kumar" />
                  </div>
                  <p className="col-span-2 mt-1 border-t border-line pt-3 text-[11px] font-bold tracking-[0.14em] text-ink-faint uppercase">
                    Dodatni podatki (neobvezno)
                  </p>
                  <div className="col-span-2">
                    <label className="label">Naslov</label>
                    <input name="address" className="input" defaultValue={k.address} placeholder="ulica in hišna številka" />
                  </div>
                  <div>
                    <label className="label">Poštna številka</label>
                    <input name="postalCode" className="input" inputMode="numeric" maxLength={10} defaultValue={k.postalCode} placeholder="npr. 4240" />
                  </div>
                  <div>
                    <label className="label">Kraj</label>
                    <input name="city" className="input" defaultValue={k.city} placeholder="npr. Radovljica" />
                  </div>
                  <div>
                    <label className="label">EMŠO</label>
                    <input name="emso" className="input" inputMode="numeric" maxLength={13} defaultValue={k.emso} placeholder="13 številk" />
                  </div>
                  <div>
                    <label className="label">Davčna številka</label>
                    <input name="taxNumber" className="input" inputMode="numeric" maxLength={10} defaultValue={k.taxNumber} placeholder="8 številk" />
                  </div>
                  <div>
                    <label className="label">Telefon</label>
                    <input name="phone" className="input" inputMode="tel" defaultValue={k.phone} placeholder="npr. 031 123 456" />
                  </div>
                  <div>
                    <label className="label">E-pošta</label>
                    <input name="email" className="input" inputMode="email" defaultValue={k.email} placeholder="ime@primer.si" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="btn btn-primary">Shrani</button>
                </div>
              </form>
              <form
                action={deleteChildAction}
                className="mt-3 border-t border-line pt-3"
              >
                <input type="hidden" name="id" value={k.id} />
                <button className="btn btn-danger" title="Izbriše tudi urnik, ocene, beležke in linije">
                  <Trash2 className="h-4 w-4" strokeWidth={2.2} />
                  Izbriši otroka z vsemi podatki
                </button>
              </form>
            </div>
          ))}

          <div className={cn(sectionCard, "border-dashed")}>
            <h2 className={h2}>Dodaj otroka</h2>
            <p className={sub}>Vrstni red ur se doda samodejno, urnik pa urejate na strani urnika.</p>
            <form action={saveChildAction} className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">Ime in priimek</label>
                  <input name="name" required className="input" placeholder="npr. Ana Novak" />
                </div>
                <div>
                  <label className="label">Razred</label>
                  <input name="className" className="input" placeholder="npr. 5. a" />
                </div>
                <div>
                  <label className="label">Barva</label>
                  <ColorPicker name="color" options={CHILD_COLOR_OPTIONS} defaultValue={CHILD_COLORS[0].value} />
                </div>
                <div className="col-span-2">
                  <label className="label">Šola</label>
                  <input name="school" className="input" placeholder="neobvezno" />
                </div>
                <p className="col-span-2 mt-1 border-t border-line pt-3 text-[11px] font-bold tracking-[0.14em] text-ink-faint uppercase">
                  Dodatni podatki (neobvezno)
                </p>
                <div className="col-span-2">
                  <label className="label">Naslov</label>
                  <input name="address" className="input"  placeholder="ulica in hišna številka" />
                </div>
                <div>
                  <label className="label">Poštna številka</label>
                  <input name="postalCode" className="input" inputMode="numeric" maxLength={10}  placeholder="npr. 4240" />
                </div>
                <div>
                  <label className="label">Kraj</label>
                  <input name="city" className="input"  placeholder="npr. Radovljica" />
                </div>
                <div>
                  <label className="label">EMŠO</label>
                  <input name="emso" className="input" inputMode="numeric" maxLength={13}  placeholder="13 številk" />
                </div>
                <div>
                  <label className="label">Davčna številka</label>
                  <input name="taxNumber" className="input" inputMode="numeric" maxLength={10}  placeholder="8 številk" />
                </div>
                <div>
                  <label className="label">Telefon</label>
                  <input name="phone" className="input" inputMode="tel"  placeholder="npr. 031 123 456" />
                </div>
                <div>
                  <label className="label">E-pošta</label>
                  <input name="email" className="input" inputMode="email"  placeholder="ime@primer.si" />
                </div>
              </div>
              <button className="btn btn-primary">
                <Plus className="h-4 w-4" strokeWidth={2.4} />
                Dodaj otroka
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {/* ------------------------- PREDMETI ------------------------- */}
      {tab === "predmeti" ? (
        <div className={sectionCard}>
          <h2 className={h2}>Predmeti</h2>
          <p className={sub}>
            Kratica se prikaže v urniku ob izbiri prikaza “Kratica”, polno ime pa v standardnem prikazu
            in pri izvozu.
          </p>

          <div className="mt-5 space-y-2">
            {subjects.map((s) => (
              <form
                key={s.id}
                action={saveSubjectAction}
                className="grid grid-cols-[auto_1fr_110px_160px_auto_auto] items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 max-lg:grid-cols-[auto_1fr_auto] max-lg:[&>*]:col-auto"
              >
                <input type="hidden" name="id" value={s.id} />
                <span
                  className="h-4 w-4 rounded-full"
                  style={{ background: subjectColor(s.colorIdx).solid }}
                  title={subjectColor(s.colorIdx).label}
                />
                <input name="name" required className="input !border-transparent !bg-transparent !py-1.5" defaultValue={s.name} />
                <input name="abbr" required maxLength={5} className="input !py-1.5 text-center font-bold uppercase" defaultValue={s.abbr} />
                <ColorPicker name="colorIdx" options={SUBJECT_COLOR_OPTIONS} defaultValue={String(s.colorIdx)} />
                <button className="btn btn-ghost !px-3 !py-1.5 text-xs">Shrani</button>
              </form>
            ))}
          </div>

          <form action={saveSubjectAction} className="mt-6 grid grid-cols-[1fr_110px_160px_auto] items-end gap-2 rounded-xl border border-dashed border-line-strong bg-paper/60 p-3 max-sm:grid-cols-1">
            <div>
              <label className="label">Novo ime predmeta</label>
              <input name="name" required className="input" placeholder="npr. Tuj jezik II" />
            </div>
            <div>
              <label className="label">Kratica</label>
              <input name="abbr" required maxLength={5} className="input text-center font-bold uppercase" placeholder="TJ2" />
            </div>
            <div>
              <label className="label">Barva</label>
              <ColorPicker name="colorIdx" options={SUBJECT_COLOR_OPTIONS} defaultValue={String(subjects.length % SUBJECT_PALETTE.length)} />
            </div>
            <button className="btn btn-primary">
              <Plus className="h-4 w-4" strokeWidth={2.4} />
              Dodaj
            </button>
          </form>

          <div className="mt-6 space-y-1.5">
            {subjects.map((s) => (
              <form key={`del-${s.id}`} action={deleteSubjectAction} className="inline-block">
                <input type="hidden" name="id" value={s.id} />
                <button className="chip mr-1.5 border border-[#fbc9d4] bg-white text-[11px] text-[#d41f45] transition-colors hover:border-[#f6a6b8] hover:bg-[#ffe3e9]" title={`Izbriši ${s.name} (odstrani tudi pripadajoče vnose v urniku in ocene)`}>
                  <Trash2 className="h-3 w-3" strokeWidth={2.4} />
                  {s.abbr}
                </button>
              </form>
            ))}
          </div>
        </div>
      ) : null}

      {/* ------------------------- ŠOLSKO LETO ------------------------- */}
      {tab === "leto" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className={sectionCard}>
            <h2 className={h2}>Šolska leta</h2>
            <p className={sub}>Aktivno leto določa, kateri urnik in katere počitnice se uporabljajo.</p>
            <div className="mt-5 space-y-2">
              {years.map((y) => (
                <div key={y.id} className={cn("rounded-xl border px-4 py-3", y.isActive ? "border-spruce/40 bg-[#eef5ef]" : "border-line bg-white")}>
                  <form action={saveSchoolYearAction} className="grid grid-cols-[1fr_135px_135px_auto] items-center gap-2 max-md:grid-cols-1">
                    <input type="hidden" name="id" value={y.id} />
                    <input name="name" required className="input !border-transparent !bg-transparent !py-1.5 font-bold" defaultValue={y.name} />
                    <input name="startDate" type="date" required className="input !py-1.5" defaultValue={y.startDate} />
                    <input name="endDate" type="date" required className="input !py-1.5" defaultValue={y.endDate} />
                    <button className="btn btn-ghost !px-3 !py-1.5 text-xs">Shrani</button>
                  </form>
                  <div className="mt-2 flex items-center gap-2">
                    {y.isActive ? (
                      <span className="chip bg-gradient-to-br from-spruce to-spruce-2 text-[10px] text-white">
                        <CheckCircle2 className="h-3 w-3" strokeWidth={2.4} />
                        aktivno
                      </span>
                    ) : (
                      <form action={activateSchoolYearAction}>
                        <input type="hidden" name="id" value={y.id} />
                        <button className="chip border border-line-strong bg-white text-[10px] text-ink-soft transition-colors hover:border-brand-border hover:bg-brand-tint hover:text-brand-ink">
                          Aktiviraj
                        </button>
                      </form>
                    )}
                    <form action={deleteSchoolYearAction} className="ml-auto">
                      <input type="hidden" name="id" value={y.id} />
                      <button className="chip text-[10px] text-[#d41f45] transition-colors hover:bg-[#ffe3e9]">
                        <Trash2 className="h-3 w-3" strokeWidth={2.4} />
                        Izbriši
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>

            <form action={saveSchoolYearAction} className="mt-5 grid grid-cols-[1fr_135px_135px_auto] items-end gap-2 rounded-xl border border-dashed border-line-strong bg-paper/60 p-3 max-md:grid-cols-1">
              <div>
                <label className="label">Naziv</label>
                <input name="name" required className="input" placeholder="npr. 2025/2026" />
              </div>
              <div>
                <label className="label">Začetek</label>
                <input name="startDate" type="date" required className="input" />
              </div>
              <div>
                <label className="label">Konec</label>
                <input name="endDate" type="date" required className="input" />
              </div>
              <button className="btn btn-primary">
                <Plus className="h-4 w-4" strokeWidth={2.4} />
                Dodaj leto
              </button>
            </form>
          </div>

          <div className={sectionCard}>
            <h2 className={h2}>
              Počitnice {activeYear ? `· ${activeYear.name}` : ""}
            </h2>
            <p className={sub}>
              {activeYear
                ? "Prikazane so v koledarju, na pregledu in urniku."
                : "Najprej dodajte in aktivirajte šolsko leto."}
            </p>
            {activeYear ? (
              <>
                <div className="mt-5 space-y-2">
                  {activeBreaks.map((b) => (
                    <div key={b.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white px-3 py-2">
                      <form action={saveBreakAction} className="grid flex-1 grid-cols-[1fr_130px_130px_auto] items-center gap-2 max-md:grid-cols-1">
                        <input type="hidden" name="id" value={b.id} />
                        <input type="hidden" name="schoolYearId" value={activeYear.id} />
                        <input name="name" required className="input !border-transparent !bg-transparent !py-1.5 font-medium" defaultValue={b.name} />
                        <input name="startDate" type="date" required className="input !py-1.5" defaultValue={b.startDate} />
                        <input name="endDate" type="date" required className="input !py-1.5" defaultValue={b.endDate} />
                        <button className="btn btn-ghost !px-3 !py-1.5 text-xs">Shrani</button>
                      </form>
                      <form action={deleteBreakAction}>
                        <input type="hidden" name="id" value={b.id} />
                        <input type="hidden" name="schoolYearId" value={activeYear.id} />
                        <button className="rounded-lg p-1.5 text-[#a03d2e] hover:bg-[#faeeea]" title="Izbriši">
                          <Trash2 className="h-4 w-4" strokeWidth={2.2} />
                        </button>
                      </form>
                    </div>
                  ))}
                  {activeBreaks.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-line-strong bg-paper/60 px-4 py-6 text-center text-sm text-ink-faint">
                      Še ni vnesenih počitnic.
                    </p>
                  ) : null}
                </div>

                <form action={saveBreakAction} className="mt-5 grid grid-cols-[1fr_130px_130px_auto] items-end gap-2 rounded-xl border border-dashed border-line-strong bg-paper/60 p-3 max-md:grid-cols-1">
                  <input type="hidden" name="schoolYearId" value={activeYear.id} />
                  <div>
                    <label className="label">Naziv</label>
                    <input name="name" required className="input" list="break-names" placeholder="npr. Zimske počitnice" />
                    <datalist id="break-names">
                      <option value="Jesenske počitnice" />
                      <option value="Novoletne počitnice" />
                      <option value="Zimske počitnice" />
                      <option value="Prvomajske počitnice" />
                      <option value="Poletne počitnice" />
                    </datalist>
                  </div>
                  <div>
                    <label className="label">Od</label>
                    <input name="startDate" type="date" required className="input" />
                  </div>
                  <div>
                    <label className="label">Do</label>
                    <input name="endDate" type="date" required className="input" />
                  </div>
                  <button className="btn btn-primary">
                    <Plus className="h-4 w-4" strokeWidth={2.4} />
                    Dodaj
                  </button>
                </form>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* ------------------------- Vrstni red UR ------------------------- */}
      {tab === "ure" ? (
        <div className={sectionCard}>
          <h2 className={h2}>Vrstni red ur{slotKid ? ` · ${slotKid.name}` : ""}</h2>
          <p className={sub}>
            Vsako vrstico poljubno poimenujte (npr. <strong>Predura</strong>, <strong>1. ura</strong>,{" "}
            <strong>Malica</strong>) in izberite, ali je to učna ura ali odmor ter ali se v urniku prikaže.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {kids.map((k) => (
              <Link
                key={k.id}
                href={`/nastavitve?tab=ure&otrok=${k.id}`}
                className={cn("chip-btn", k.id === slotKid?.id && "chip-btn-active")}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: k.color }} />
                {k.name}
              </Link>
            ))}
          </div>

          {slotKid ? (
            <>
              <SlotsEditor
                key={`${slotKid.id}:${slots
                  .map((x) => `${x.id}.${x.period}.${x.label}.${x.kind}.${x.start}.${x.end}.${x.showInTimetable}`)
                  .join("|")}`}
                childId={slotKid.id}
                slots={slots.map((x) => ({
                  id: x.id,
                  label: x.label,
                  kind: x.kind,
                  start: x.start,
                  end: x.end,
                  showInTimetable: x.showInTimetable,
                }))}
              />
            </>
          ) : (
            <p className="mt-4 text-sm text-ink-faint">Najprej dodajte otroka.</p>
          )}
        </div>
      ) : null}

      {/* ------------------------- UPORABNIKI ------------------------- */}
      {tab === "uporabniki" ? <UsersPanel users={members} /> : null}

      {/* ------------------------- SUPERADMIN ------------------------- */}
      {tab === "superadmin" && user.isSuperadmin ? (
        <SuperadminPanel households={await getAllHouseholds()} selfId={user.id} />
      ) : null}

      {/* ------------------------- NAPRAVA ------------------------- */}
      {tab === "naprava" ? <InstallPanel /> : null}

      {/* ------------------------- E-POŠTA ------------------------- */}
      {tab === "posta" ? (
        <div className="max-w-2xl">
          <div className={sectionCard}>
            <h2 className={h2}>E-poštna obvestila</h2>
            <p className={sub}>Dnevni povzetek urnika in avtobusov na vaš naslov: <strong>{user.email}</strong>.</p>

            {sp.poslano ? (
              <p className="mt-4 flex items-center gap-2 rounded-xl border border-[#cfe0c8] bg-[#eef5ea] px-4 py-3 text-sm font-medium text-[#3c5f2a]">
                <MailCheck className="h-4 w-4" strokeWidth={2.2} />
                Povzetek je bil uspešno poslan na {user.email}.
              </p>
            ) : null}
            {sp.napaka === "smtp" ? (
              <p className="mt-4 flex items-center gap-2 rounded-xl border border-[#e6c4ba] bg-[#faeeea] px-4 py-3 text-sm font-medium text-[#a03d2e]">
                <MailWarning className="h-4 w-4" strokeWidth={2.2} />
                SMTP ni nastavljen. Dodajte SMTP_HOST in ostale spremenljivke v .env.
              </p>
            ) : null}
            {sp.napaka === "poslji" ? (
              <p className="mt-4 flex items-center gap-2 rounded-xl border border-[#e6c4ba] bg-[#faeeea] px-4 py-3 text-sm font-medium text-[#a03d2e]">
                <MailWarning className="h-4 w-4" strokeWidth={2.2} />
                Pošiljanje ni uspelo — preverite SMTP nastavitve in dnevnik strežnika.
              </p>
            ) : null}

            <div className="mt-5 space-y-3">
              <p className="flex items-center justify-between rounded-xl border border-line bg-white px-4 py-3 text-sm">
                <span className="font-medium">Stanje SMTP</span>
                {smtpConfigured() ? (
                  <span className="chip bg-[#eef5ea] text-[#3c5f2a]">
                    <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.4} />
                    nastavljen
                  </span>
                ) : (
                  <span className="chip bg-[#faeeea] text-[#a03d2e]">
                    <MailWarning className="h-3.5 w-3.5" strokeWidth={2.4} />
                    ni nastavljen
                  </span>
                )}
              </p>

              <form action={setNotifyEmailAction} className="flex items-center justify-between rounded-xl border border-line bg-white px-4 py-3">
                <span className="text-sm font-medium">Prejemam dnevni povzetek</span>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="notify" defaultChecked={user.notifyEmail} className="h-4 w-4 accent-spruce" />
                  <button className="btn btn-ghost !px-3 !py-1.5 text-xs">Shrani</button>
                </label>
              </form>

              <form action={sendDigestNowAction}>
                <button className="btn btn-amber w-full" disabled={!smtpConfigured()}>
                  <Mail className="h-4 w-4" strokeWidth={2.2} />
                  Pošlji povzetek zdaj (test)
                </button>
              </form>
            </div>
          </div>

        </div>
      ) : null}

      {/* ------------------------- VIDEZ ------------------------- */}
      {tab === "videz" ? (
        <div className="space-y-6">
          <div className={sectionCard}>
            <h2 className={h2}>Način videza</h2>
            <p className={sub}>
              Svetel ali temen videz. »Samodejno« sledi nastavitvi telefona ali računalnika.
            </p>
            <div className="mt-5">
              <ModePicker current={modeOf(user.mode)} />
            </div>
          </div>
          <div className={sectionCard}>
            <h2 className={h2}>Barvna tema</h2>
            <p className={sub}>
              Izbrana tema velja za vaš račun na vseh napravah in deluje v svetlem in temnem načinu.
              Spremeni barve gumbov, zavihkov, stranske vrstice in poudarkov; pisava in razporeditev
              ostaneta enaki.
            </p>
            <div className="mt-5">
              <ThemePicker current={user.theme} />
            </div>
          </div>
        </div>
      ) : null}

      {/* ------------------------- RAČUN ------------------------- */}
      {tab === "racun" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <PasswordForm />
          <div className={sectionCard}>
            <h2 className={h2}>Podatki računa</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between rounded-xl border border-line bg-white px-4 py-3">
                <dt className="text-ink-soft">Ime</dt>
                <dd className="font-semibold">{user.name}</dd>
              </div>
              <div className="flex justify-between rounded-xl border border-line bg-white px-4 py-3">
                <dt className="text-ink-soft">E-pošta</dt>
                <dd className="font-semibold">{user.email}</dd>
              </div>
              <div className="flex justify-between rounded-xl border border-line bg-white px-4 py-3">
                <dt className="text-ink-soft">Otroci</dt>
                <dd className="font-semibold">{kids.length}</dd>
              </div>
              <div className="flex justify-between rounded-xl border border-line bg-white px-4 py-3">
                <dt className="text-ink-soft">Predmeti</dt>
                <dd className="font-semibold">{subjects.length}</dd>
              </div>
            </dl>
            <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-ink-faint">
              <Palmtree className="mt-0.5 h-4 w-4 shrink-0 text-[#687a25]" strokeWidth={2.2} />
              Nasvet: novemu otroku se ob dodajanju samodejno ustvari privzet vrstni red ur, ki ga
              prilagodite v zavihku “Vrstni red ur”.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
