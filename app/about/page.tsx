import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Building2, Handshake, MapPin } from "lucide-react";
import { PageIntro } from "@/components/page-intro";
export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return <main><PageIntro eyebrow="About Broker2Broker" title="A broker network shaped by local knowledge." copy="Real estate moves through relationships. Broker2Broker gives property professionals a focused place to organize opportunities and build trusted connections." />
    <section className="container-page grid gap-12 py-16 lg:grid-cols-2 lg:items-center lg:py-24"><div><h2 className="text-2xl font-semibold tracking-tight text-navy-900">A practical place to work together</h2><p className="mt-4 leading-7 text-slate-600">Broker2Broker is designed around the day-to-day work of property brokers: a clear broker profile, listings organized by market, searchable opportunities and a membership model that keeps private network access accountable.</p><p className="mt-4 leading-7 text-slate-600">The platform supports a manual payment approval process. A payment screenshot or WhatsApp link is not proof of payment; membership access is granted only after an administrator checks the actual UPI credit.</p><Link className="btn-primary mt-7" href="/register">Join free</Link></div><div className="grid gap-4 sm:grid-cols-2">{[{icon:Building2,title:"Property-first",text:"Structured listings that are easier to review and search."},{icon:MapPin,title:"Neighbourhood-aware",text:"Start with localities you know, then expand across India."},{icon:Handshake,title:"Built for collaboration",text:"Make space for clear broker-to-broker communication."},{icon:BadgeCheck,title:"Human-reviewed",text:"Payment status changes only after an authorized person approves."}].map(({icon:Icon,title,text})=><div key={title} className="card p-5"><span className="grid h-11 w-11 place-items-center rounded-xl bg-navy-50 text-navy-700"><Icon size={21}/></span><h3 className="mt-4 font-semibold text-navy-900">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></div>)}</div></section>
  </main>;
}
