import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Zasebni šolski urnik",
    short_name: "Urnik",
    description:
      "Družinski šolski urnik: tedenski urniki otrok, vozni redi avtobusov, dogodki, koledar s prazniki, ocene in beležke.",
    lang: "sl",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#f4f6f8",
    theme_color: "#06a66b",
    categories: ["education", "productivity", "lifestyle"],
    prefer_related_applications: false,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Tedenski urnik",
        short_name: "Urnik",
        url: "/urnik",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Koledar",
        short_name: "Koledar",
        url: "/koledar",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Dogodki",
        short_name: "Dogodki",
        url: "/dogodki",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
