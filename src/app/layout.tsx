import type { Metadata, Viewport } from "next";
// Self-hosted variable Archivo (weight + width axes, upright and italic): no network needed to build.
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/archivo/wdth-italic.css";
import { AppHeader } from "@/components/layout/AppHeader";
import { DocumentSync } from "@/components/layout/DocumentSync";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { ServiceWorkerRegistration } from "@/components/layout/ServiceWorkerRegistration";
import { fr } from "@/lib/i18n/fr";
import { PREFERENCES_SCRIPT, THEME_COLORS, THEME_NAMES } from "@/lib/settings";
import "./globals.css";

export const metadata: Metadata = {
  // Absolute URLs for social previews; set NEXT_PUBLIC_SITE_URL when deploying.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: fr.meta.title, template: "%s · Calandre" },
  description: fr.meta.description,
  applicationName: "Calandre",
  appleWebApp: { capable: true, title: "Calandre", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    title: "Calandre",
    description: fr.meta.description,
    type: "website",
    locale: "fr_FR",
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: "Calandre" }],
  },
};

export const viewport: Viewport = {
  themeColor: THEME_COLORS.light,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Keeps the answer field visible above the on-screen keyboard (Chromium).
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      data-theme={THEME_NAMES.light}
      // The inline script below may switch theme/lang before hydration.
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFERENCES_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <AppHeader />
        <OfflineBanner />
        <main id="content" className="flex flex-1 flex-col pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {children}
        </main>
        <DocumentSync />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
