import Link from "next/link";
import { ArrowRight, ArrowUpRight, BadgeCheck, Building, Building2, Check, Compass, Handshake, MapPin, MessageSquareText, Search, ShieldCheck, Sparkles, UsersRound } from "lucide-react";

const benefits = [
  { icon: Compass, title: "Local by nature", text: "Find and share opportunities by city, locality, transaction and property type." },
  { icon: MessageSquareText, title: "Turn WhatsApp into structure", text: "Convert broker messages into reviewable property listings—without losing the original details." },
  { icon: ShieldCheck, title: "Built around broker trust", text: "Member access, broker profiles, reporting and human-reviewed payment approvals." }
];

const steps = [
  { n: "01", title: "Join free", text: "Create your broker profile and choose your local markets." },
  { n: "02", title: "Activate membership", text: "Pay by UPI and share your UTR. An administrator verifies the payment manually." },
  { n: "03", title: "Work the network", text: "Publish opportunities, search listings and connect with other brokers." }
];

export default function HomePage() {
  return <main>
    <section className="relative overflow-hidden bg-white">
      <div className="pointer-events-none absolute -right-36 -top-36 h-[520px] w-[520px] rounded-full bg-navy-50/70 blur-3xl" />
      <div className="pointer-events-none absolute -left-40 bottom-0 h-72 w-72 rounded-full bg-leaf-50 blur-3xl" />
      <div className="container-page relative grid min-h-[650px] items-center gap-14 py-16 lg:grid-cols-[1.08fr_.92fr] lg:py-24">
        <div className="max-w-2xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-leaf-100 bg-leaf-50/80 px-3.5 py-2 text-xs font-semibold text-leaf-700"><span className="h-2 w-2 rounded-full bg-leaf-500" /> A focused network for real estate brokers</div>
          <h1 className="text-[2.8rem] font-semibold leading-[1.07] tracking-[-.045em] text-navy-900 sm:text-6xl">One Network.<br /><span className="text-leaf-600">Every Property</span><br />Opportunity.</h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">Meet serious brokers, organize property leads and uncover the right opportunity in the neighbourhoods you know best.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/register" className="btn-primary !px-6 !py-3.5">Join the network <ArrowRight size={17} /></Link>
            <Link href="/how-it-works" className="btn-secondary !px-6 !py-3.5">See how it works</Link>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-600">
            <span className="flex items-center gap-2"><Check size={16} className="text-leaf-600" /> Free to register</span>
            <span className="flex items-center gap-2"><Check size={16} className="text-leaf-600" /> Manual UPI approval</span>
            <span className="flex items-center gap-2"><Check size={16} className="text-leaf-600" /> Built for local markets</span>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-[540px] lg:ml-auto">
          <div className="absolute -left-6 top-16 hidden h-24 w-24 rounded-[28px] border border-white/70 bg-leaf-100/70 shadow-soft sm:block" />
          <div className="absolute -right-5 bottom-10 hidden h-28 w-28 rounded-full border-[18px] border-navy-50 sm:block" />
          <div className="relative rounded-[32px] border border-slate-200 bg-[#f8fafc] p-3 shadow-[0_28px_90px_rgba(16,39,68,.14)] sm:p-5">
            <div className="overflow-hidden rounded-[24px] bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-navy-50 text-navy-700"><Building2 size={18} /></span><div><div className="text-sm font-bold text-navy-900">Local opportunities</div><div className="text-[11px] text-slate-500">Mira Road · Bhayandar</div></div></div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-leaf-50 text-leaf-700"><Search size={17} /></div>
              </div>
              <div className="relative h-52 overflow-hidden bg-[#edf2f2] p-5 sm:h-64">
                <div className="absolute inset-0 opacity-70" style={{ backgroundImage: "linear-gradient(28deg, transparent 43%, white 44%, white 47%, transparent 48%), linear-gradient(118deg, transparent 37%, white 38%, white 41%, transparent 42%), linear-gradient(84deg, transparent 67%, #d8e3dc 68%, #d8e3dc 70%, transparent 71%), linear-gradient(12deg, transparent 70%, #d8e3dc 71%, #d8e3dc 73%, transparent 74%)", backgroundSize: "180px 150px, 200px 170px, 130px 110px, 170px 140px" }} />
                <div className="absolute left-[20%] top-[31%] flex items-center gap-2 rounded-full bg-white px-3 py-2 shadow-card"><MapPin size={14} className="text-leaf-600" /><span className="text-[11px] font-bold text-navy-900">Mira Road</span></div>
                <div className="absolute right-[12%] top-[17%] grid h-9 w-9 place-items-center rounded-full border-4 border-white bg-leaf-500 text-white shadow-card"><MapPin size={15} /></div>
                <div className="absolute bottom-[17%] left-[47%] grid h-9 w-9 place-items-center rounded-full border-4 border-white bg-navy-700 text-white shadow-card"><MapPin size={15} /></div>
                <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/80 bg-white/90 p-3 shadow-card backdrop-blur sm:left-5 sm:right-5">
                  <div className="flex items-center justify-between gap-3"><div><div className="text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">Neighbourhood network</div><div className="mt-1 text-sm font-bold text-navy-900">Local knowledge. Shared opportunities.</div></div><span className="rounded-xl bg-leaf-50 p-2.5 text-leaf-700"><Handshake size={20} /></span></div>
                </div>
              </div>
              <div className="grid grid-cols-3 divide-x divide-slate-100 px-4 py-4 sm:px-6">
                {[{ icon: Building, label: "Property-led" }, { icon: UsersRound, label: "Broker-first" }, { icon: BadgeCheck, label: "Human verified" }].map(({ icon: Icon, label }) => <div key={label} className="flex flex-col items-center gap-1.5 text-center"><Icon size={17} className="text-navy-700" /><span className="text-[10px] font-semibold text-slate-600 sm:text-xs">{label}</span></div>)}
              </div>
            </div>
          </div>
          <div className="absolute -left-4 top-[37%] hidden items-center gap-2 rounded-2xl border border-slate-100 bg-white px-3 py-2.5 shadow-card sm:flex"><span className="grid h-8 w-8 place-items-center rounded-xl bg-leaf-50 text-leaf-600"><Sparkles size={16} /></span><span className="text-xs font-semibold text-navy-900">AI-assisted listing entry</span></div>
        </div>
      </div>
    </section>

    <section className="border-y border-slate-100 bg-slate-50/70">
      <div className="container-page flex flex-col gap-6 py-7 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-xs text-sm font-semibold leading-6 text-navy-900">Made for brokers who know their market—and know the value of a good connection.</p><div className="flex flex-wrap gap-2">{["Residential", "Commercial", "Rent", "Sale", "Resale", "Lease"].map((tag) => <span key={tag} className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600">{tag}</span>)}</div></div>
    </section>

    <section className="container-page py-24">
      <div className="max-w-2xl"><p className="eyebrow">A sharper way to collaborate</p><h2 className="section-title mt-3">A better network, built around the way brokers work.</h2><p className="section-copy mt-4">Bring your local expertise into one organized, searchable place—while keeping important conversations and decisions in your hands.</p></div>
      <div className="mt-11 grid gap-5 md:grid-cols-3">{benefits.map(({ icon: Icon, title, text }, index) => <article key={title} className="card p-6 sm:p-7"><span className={`grid h-12 w-12 place-items-center rounded-2xl ${index === 1 ? "bg-leaf-50 text-leaf-700" : "bg-navy-50 text-navy-700"}`}><Icon size={22} /></span><h3 className="mt-5 text-lg font-semibold text-navy-900">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></article>)}</div>
    </section>

    <section className="bg-navy-900 py-20 text-white">
      <div className="container-page grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
        <div><p className="text-xs font-bold uppercase tracking-[.17em] text-leaf-300">Simple to get started</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">From local broker to connected network.</h2><p className="mt-4 max-w-md text-sm leading-7 text-slate-300">Create your profile for free. When you're ready to access the private property network, choose a plan and complete manual UPI verification.</p><Link href="/how-it-works" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-leaf-300">Explore the process <ArrowUpRight size={16} /></Link></div>
        <div className="grid gap-4 sm:grid-cols-3">{steps.map((step) => <div key={step.n} className="rounded-2xl border border-white/10 bg-white/[.06] p-5"><div className="text-xs font-bold tracking-[.16em] text-leaf-300">{step.n}</div><h3 className="mt-5 text-base font-semibold">{step.title}</h3><p className="mt-2 text-sm leading-6 text-slate-300">{step.text}</p></div>)}</div>
      </div>
    </section>

    <section className="container-page py-24">
      <div className="relative overflow-hidden rounded-[28px] bg-leaf-50 px-6 py-10 sm:px-10 sm:py-12 lg:flex lg:items-center lg:justify-between">
        <div className="absolute -right-12 -top-24 h-64 w-64 rounded-full border-[38px] border-white/50" />
        <div className="relative max-w-xl"><p className="eyebrow">Make your next connection count</p><h2 className="mt-3 text-3xl font-semibold tracking-tight text-navy-900">Bring your local market into one network.</h2><p className="mt-3 text-sm leading-6 text-slate-600">Register free. Build a complete broker profile. Join when you're ready.</p></div>
        <Link href="/register" className="btn-green relative mt-7 lg:mt-0">Create your free account <ArrowRight size={16} /></Link>
      </div>
    </section>
  </main>;
}
