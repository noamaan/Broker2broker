"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, ArrowUpRight, Building2 } from "lucide-react";
import { BRAND_NAME } from "@/lib/branding";

const links = [
  ["Properties", "/properties"],
  ["How it works", "/how-it-works"],
  ["About", "/about"],
  ["Pricing", "/pricing"],
  ["Contact", "/contact"]
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur-xl">
    <div className="container-page flex h-[72px] items-center justify-between gap-5">
      <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label={`${BRAND_NAME} home`} onClick={() => setOpen(false)}>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-navy-900 text-white"><Building2 size={21} strokeWidth={2.1} /></span>
        <span className="leading-tight"><span className="block text-base font-bold tracking-tight text-navy-900">Broker<span className="text-leaf-600">2</span>Broker</span><span className="hidden text-[10px] font-medium tracking-[.12em] text-slate-500 sm:block">PROPERTY NETWORK</span></span>
      </Link>
      <nav className="hidden items-center gap-8 lg:flex" aria-label="Main navigation">
        {links.map(([label, href]) => <Link key={href} href={href} className="text-sm font-medium text-slate-600 transition hover:text-navy-900">{label}</Link>)}
      </nav>
      <div className="hidden items-center gap-3 lg:flex">
        <Link href="/login" className="px-3 py-2 text-sm font-semibold text-navy-900 transition hover:text-leaf-700">Log in</Link>
        <Link href="/register" className="btn-primary !px-4 !py-2.5">Join the network <ArrowUpRight size={15} /></Link>
      </div>
      <button type="button" className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-700 lg:hidden" onClick={() => setOpen((v) => !v)} aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open}>{open ? <X size={20} /> : <Menu size={20} />}</button>
    </div>
    {open && <nav className="border-t border-slate-100 bg-white px-4 pb-5 pt-3 lg:hidden" aria-label="Mobile navigation">
      <div className="mx-auto grid max-w-7xl gap-1">
        {links.map(([label, href]) => <Link key={href} href={href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">{label}</Link>)}
        <div className="mt-2 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
          <Link href="/login" onClick={() => setOpen(false)} className="btn-secondary !py-2.5">Log in</Link>
          <Link href="/register" onClick={() => setOpen(false)} className="btn-primary !py-2.5">Join free</Link>
        </div>
      </div>
    </nav>}
  </header>;
}
