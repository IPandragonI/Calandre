import type { MetadataRoute } from "next";
import { fr } from "@/lib/i18n/fr";
import { THEME_COLORS } from "@/lib/settings";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: fr.meta.title,
    short_name: "Calandre",
    description: fr.meta.description,
    lang: "fr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: THEME_COLORS.light,
    theme_color: THEME_COLORS.light,
    categories: ["games", "entertainment"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
