import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { cookies } from "next/headers";
import { ServiceWorkerRegistrar } from "@/components/pwa";
import { DARK_THEME_COLOR, MODE_COOKIE, THEME_COOKIE, modeOf, themeOf } from "@/lib/themes";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Zasebni šolski urnik",
    template: "%s · Šolski urnik",
  },
  description:
    "Zasebni družinski šolski urnik: tedenski urniki otrok, vozni redi avtobusov, dogodki, koledar s prazniki, ocene in beležke.",
  applicationName: "Šolski urnik",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    // "default": iOS vsebine ne riše pod statusno vrstico, ikone ure/baterije so temne in vidne
    statusBarStyle: "default",
    title: "Urnik",
  },
  formatDetection: { telephone: false },
  other: { "application-name": "Šolski urnik" },
};

export async function generateViewport(): Promise<Viewport> {
  const jar = await cookies();
  const theme = themeOf(jar.get(THEME_COOKIE)?.value);
  const mode = modeOf(jar.get(MODE_COOKIE)?.value);
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor:
      mode === "dark"
        ? DARK_THEME_COLOR
        : mode === "auto"
          ? [
              { media: "(prefers-color-scheme: light)", color: theme.themeColor },
              { media: "(prefers-color-scheme: dark)", color: DARK_THEME_COLOR },
            ]
          : theme.themeColor,
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const jar = await cookies();
  const theme = themeOf(jar.get(THEME_COOKIE)?.value);
  const mode = modeOf(jar.get(MODE_COOKIE)?.value);
  return (
    <html lang="sl" data-theme={theme.key} data-mode={mode} className={`${inter.variable} ${fraunces.variable}`}>
      <body className="grain bg-paper font-sans text-ink antialiased">
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
