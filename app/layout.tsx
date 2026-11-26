import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { Pwa } from "@/components/pwa";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: { default: "Broker2Broker | One Network. Every Property Opportunity.", template: "%s | Broker2Broker" },
  description: "A trusted property network built for real estate brokers. Share listings, find opportunities and grow together.",
  applicationName: "Broker2Broker",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Broker2Broker", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" }
};

export const viewport: Viewport = { themeColor: "#102744", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><SiteHeader />{children}<SiteFooter /><Pwa /></body></html>;
}
