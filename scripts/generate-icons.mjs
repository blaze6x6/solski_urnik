// ---------------------------------------------------------------------------
// Ustvari vse PWA ikone iz public/icons/icon-master.png
//
//   icon-192.png            Android / Chrome (namestitev)
//   icon-512.png            Android / Chrome (splash, trgovina)
//   icon-512-maskable.png   Android prilagodljiva ikona (varno območje 62 %)
//   apple-touch-icon.png    iPhone / iPad (180×180, brez prosojnosti)
//
// Zagon (potrebuje paket sharp):
//   npm i --no-save sharp && node scripts/generate-icons.mjs
//
// Pri gradnji v Dockerju se zažene samodejno, če icon-master.png obstaja.
// Priporočilo: master naj bo kvadraten, vsaj 1024×1024 px.
// ---------------------------------------------------------------------------

import { existsSync } from "node:fs";
import sharp from "sharp";

const DIR = "public/icons";
const MASTER = `${DIR}/icon-master.png`;
const BRAND = "#06a66b"; // enako kot theme_color v manifestu
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

if (!existsSync(MASTER)) {
  console.error(`Manjka ${MASTER}`);
  process.exit(1);
}

/** Navadna ikona (prosojno ozadje ostane). */
async function plain(size, name) {
  await sharp(MASTER).resize(size, size, { fit: "contain", background: CLEAR }).png().toFile(`${DIR}/${name}`);
}

/** Motiv na polnem ozadju z blagovno barvo, motiv v sredini (maskable). */
async function onBrand(size, name, inner) {
  const px = Math.round(size * inner);
  const motif = await sharp(MASTER).resize(px, px, { fit: "contain", background: CLEAR }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BRAND } })
    .composite([{ input: motif, gravity: "centre" }])
    .png()
    .toFile(`${DIR}/${name}`);
}

await plain(192, "icon-192.png");
await plain(512, "icon-512.png");
await onBrand(512, "icon-512-maskable.png", 0.62);
// iOS ne mara prosojnosti (naredi jo črno) — zato polno ozadje, motiv skoraj čez celo ikono
await onBrand(180, "apple-touch-icon.png", 0.82);

console.log("Ikone ustvarjene v", DIR);
