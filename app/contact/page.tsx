import type { Metadata } from "next";
import { PageIntro } from "@/components/page-intro";
import { ContactPanel } from "@/components/contact-panel";
export const metadata: Metadata = { title: "Contact" };
export default function ContactPage() { return <main><PageIntro eyebrow="Contact" title="We're here to help you connect." copy="Reach the support team through the contact details configured by the platform administrator."/><section className="container-page max-w-5xl py-14 sm:py-20"><ContactPanel/><p className="mt-6 text-xs leading-5 text-slate-500">If support contact details are not yet configured, please contact the platform owner directly. Do not share passwords, one-time codes or full payment credentials.</p></section></main>; }
