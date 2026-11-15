import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: { default: "Broker2Broker | One Network. Every Property Opportunity.", template: "%s | Broker2Broker" },
  description: "A trusted property network built for real estate brokers. Share listings, find opportunities and grow together.",
  applicationName: "Broker2Broker"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><SiteHeader />{children}<SiteFooter /></body></html>;
}
