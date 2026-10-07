# Zasebni šolski urnik

Družinska spletna aplikacija za tedenske urnike otrok: urnik s sledenjem trenutni uri,
vozni redi avtobusov, dogodki s prekrivanjem pouka, koledar s slovenskimi prazniki in
počitnicami, ocene, beležke, e-poštni povzetki ter tiskanje in izvoz v PDF.

## Funkcije

- **Pregled** — današnji urnik vseh otrok z označeno uro, ki ravnokar poteka (s potekom ure),
  naslednji avtobus, dogodki tedna.
- **Urnik** — tedenska mreža pon–pet, preklop **polno ime / kratica**, označba praznikov in
  počitnic, urejanje celic s klikom (svinčnik), **tiskanje** in **izvoz v PDF** (s slovenskimi šumniki).
- **Avtobus** — linije v šolo in iz šole z dnevi, postajami in opombami. Zavihek »Vozni redi (za tisk)« omogoča stalni vozni red (postaje × vožnje) z izvozom v PDF.
- **Nastavitve → Vrstni red ur** — ure in odmore lahko premikate gor/dol (časi se prilagodijo, trajanja ostanejo), brišete in dodajate; spremembe veljajo šele po »Shrani vrstni red«.
- **Dogodki** — celodnevni (prekrijejo ves dan) ali vezani na posamezno uro; večdnevni dogodki
  (npr. šola v naravi). Prikazani tudi v koledarju in na urniku (prečrtan predmet → dogodek).
- **Koledar** — mesečni pogled s slovenskimi državnimi prazniki (vkl. računanje velike noči),
  šolskimi počitnicami in vašimi dogodki.
- **Ocene in beležke** — po predmetih, s povprečji; pripete beležke na vrhu.
- **Šolsko leto** — več let, aktivno leto, počitnice (jesenske, novoletne, zimske,
  prvomajske, poletne).
- **E-pošta** — dnevni povzetek (samodejno ob izbrani uri, ročno s tipko ali prek cron endpointa).
  Vsak administrator ima lahko **več e-poštnih naslovov**, za vsakega posebej pa se določi, katere
  vrste obvestil prejema: novi dogodki, spremembe dogodkov, opomniki in dnevni povzetek.

## Videz: barvne teme in temni način

V **Nastavitve → Videz** vsak uporabnik izbere:

- **Način**: svetlo, temno ali samodejno (sledi nastavitvi naprave);
- **Barvno temo** (11 tem: Smaragd, Ocean, Sliva, Mandarina, Turkiz, Roza, Indigo, Gozd, Rubin, Korala,
  Skrilavec). Vsaka tema deluje v svetlem in temnem načinu, stranska vrstica pa se obarva z njo.

Izbira se shrani na račun (stolpca `theme` in `mode`) in v piškotka, zato velja na vseh napravah.
Novo temo dodate v `src/lib/themes.ts` (ključ, ime, barve predogleda) in v `src/app/globals.css`
(blok `:root[data-theme="…"]` s spremenljivkami `--color-spruce*`, `--color-brand-*`, `--color-amber*`).
Temni način se izpelje samodejno iz teme. Tiskanje in izvoz PDF sta vedno svetla.

## Namestitev kot aplikacija (Android, iPhone, namizje)

Aplikacija je polna PWA (manifest + service worker), zato se na telefonu obnaša kot nameščena
aplikacija: lastna ikona, celozaslonski način brez naslovne vrstice, bližnjice do urnika,
koledarja in dogodkov ter stran »Ni povezave«, ko omrežja ni.

- **Android (Chrome/Edge/Samsung):** v aplikaciji se pojavi pasica **Namesti**, ali meni ⋮ →
  **Namesti aplikacijo**.
- **iPhone / iPad (Safari):** gumb **Deli** → **Dodaj na domači zaslon** → **Dodaj**
  (navodila po korakih so v aplikaciji).
  Če je bila aplikacija na domači zaslon dodana pred posodobitvijo, ikono odstranite in jo dodajte
  znova — iOS nastavitve statusne vrstice prebere samo ob namestitvi.
- **Namizje (Chrome/Edge):** ikona za namestitev v naslovni vrstici.

Stanje namestitve, gumb za namestitev in navodila najdete v **Nastavitve → Naprava**.

> Za samodejni poziv k namestitvi mora biti stran dostopna prek **HTTPS** (ali `localhost`).
> Pri dostopu po HTTP/IP v domačem omrežju je mogoča ročna bližnjica na domači zaslon.

### Ikone

V `public/icons/` morajo obstajati `icon-192.png`, `icon-512.png`, `icon-512-maskable.png` in
`apple-touch-icon.png` — brez njih Android ne ponudi namestitve, iPhone pa pokaže le sliko zaslona.
Dobite jih iz svoje slike `public/icons/icon-master.png` (kvadratna, vsaj 1024×1024 px):

- **samodejno** — pri `docker compose up -d --build` se ikone ustvarijo, če `icon-master.png` obstaja;
- **ročno** — brez nameščenega Nodea:

```bash
docker run --rm -v "$PWD":/app -w /app node:20-alpine \
  sh -c "npm i --no-save sharp && node scripts/generate-icons.mjs"
```

Priložene so rezervne ikone (koledar na zeleni podlagi); ustvarjene ikone jih prepišejo.

## Zagon z Dockerjem

```bash
docker compose up -d --build
```

Aplikacija: http://localhost:3000 — baza se ob prvem zagonu sama migrira in napolni
z demo vsebino. Prijava: **admin@urnik.si / urnik123** (spremenite prek `ADMIN_EMAIL` /
`ADMIN_PASSWORD` pred prvim zagonom ali v nastavitvah aplikacije).

## Lokalni razvoj

```bash
cp .env.example .env
npm install
npx drizzle-kit push   # ali pustite, da aplikacija sama migrira ob zagonu
npm run dev
```

## E-poštna obvestila

Nastavite `SMTP_*` spremenljivke (glej `.env.example`). Za samodejni dnevni povzetek:

- `ENABLE_DIGEST=1` in `DIGEST_TIME=06:30` — aplikacija sama pošlje vsak dan, ali
- zunanji cron: `curl http://localhost:3000/api/cron/digest?secret=<CRON_SECRET>`.

Opomniki za dogodke se preverjajo samodejno vsakih 5 minut (`REMINDER_INTERVAL_MIN`), lahko pa jih
sprožite tudi z `curl http://localhost:3000/api/cron/reminders?secret=<CRON_SECRET>`.

V nastavitvah (zavihek E-pošta) je tudi tipka »Pošlji povzetek zdaj« za test.

## Tehnologije

Next.js (App Router) · PostgreSQL + Drizzle ORM · Tailwind CSS · jsPDF · Nodemailer · Lucide ikone.

## Gesla

Gesla so v bazi shranjena samo kot zgoščena vrednost (scrypt), zato jih nihče, tudi superadministrator, ne more prebrati.

- **Pozabljeno geslo:** na prijavi »Pozabljeno geslo?« pošlje povezavo (velja 1 uro) na e-pošto računa. Potrebuje nastavljen SMTP; za pravilne povezave nastavite še `APP_URL` (npr. `https://urnik.tekavec.net`).
- **Superadministrator:** Nastavitve → Superadmin → »Ponastavi geslo« ustvari novo začasno geslo (prikazano enkrat) in uporabnika odjavi z vseh naprav.

## PDF izvoz

Urnik in vozni red se izvozita v treh slogih: »Črno-bel« (za tisk), »Barvni« in »Kot v aplikaciji« (zaobljene celice, pilule dogodkov, ikone, barve izbrane teme; nad urnikom samo ime otroka).

## Varnostne kopije baze

V `docker-compose.yml` je vsebnik `backup`, ki vsak dan naredi `pg_dump` baze v mapo `./backups`
(nastavljivo z `BACKUP_DIR`; urnik `BACKUP_SCHEDULE`, privzeto `@daily`). Hrani 7 dnevnih,
4 tedenske in 6 mesečnih kopij (`BACKUP_KEEP_DAYS/WEEKS/MONTHS`). Mapo občasno kopirajte
tudi izven strežnika (NAS, oblak).

Takojšnja kopija:

```bash
docker compose exec backup /backup.sh
```

Obnova (najnovejša dnevna kopija; aplikacijo prej ustavite):

```bash
docker compose stop app
gunzip -c backups/last/app_db-latest.sql.gz | docker compose exec -T db psql -U postgres -d app_db
docker compose start app
```

Kopije vsebujejo osebne podatke otrok — mapo zaščitite pred nepooblaščenim dostopom.
