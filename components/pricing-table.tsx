"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, Check, CircleHelp, ShieldCheck } from "lucide-react";

type Prices = { monthlyPrice?: number; yearlyPrice?: number; monthlyDurationDays?: number; yearlyDurationDays?: number };
const fallback: Required<Prices> = { monthlyPrice: 199, yearlyPrice: 1999, monthlyDurationDays: 30, yearlyDurationDays: 365 };
const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export function PricingTable() {
  const [prices, setPrices] = useState<Required<Prices>>(fallback);
  useEffect(() => { fetch("/api/public/settings").then((r) => r.ok ? r.json() : null).then((v) => { if (v?.settings) setPrices({ ...fallback, ...v.settings }); }).catch(() => {}); }, []);
  return <div className="grid gap-5 md:grid-cols-2">
    {[{ id: "monthly", name: "Monthly", price: prices.monthlyPrice, days: prices.monthlyDurationDays, description: "Flexible access, renewed month to month." }, { id: "yearly", name: "Yearly", price: prices.yearlyPrice, days: prices.yearlyDurationDays, description: "A full year of broker network access." }].map((plan, i) => <article key={plan.id} className={`relative rounded-3xl border p-7 sm:p-8 ${i === 1 ? "border-navy-900 bg-navy-900 text-white shadow-soft" : "border-slate-200 bg-white"}`}>
      {i === 1 && <span className="absolute right-6 top-6 rounded-full bg-leaf-500 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">Best value</span>}
      <div className="flex items-center gap-2"><BadgeCheck size={18} className={i === 1 ? "text-leaf-300" : "text-leaf-600"}/><h3 className={`font-semibold ${i === 1 ? "text-white" : "text-navy-900"}`}>{plan.name} membership</h3></div>
      <p className={`mt-3 text-sm ${i === 1 ? "text-slate-300" : "text-slate-600"}`}>{plan.description}</p>
      <div className="mt-7 flex items-end gap-2"><span className="text-4xl font-semibold tracking-tight">{inr(plan.price)}</span><span className={`pb-1 text-sm ${i === 1 ? "text-slate-300" : "text-slate-500"}`}>/ {plan.days} days</span></div>
      <div className={`my-7 h-px ${i === 1 ? "bg-white/15" : "bg-slate-100"}`}/>
      <ul className="space-y-3 text-sm">{["Private property network access", "Broker profile and listing tools", "Local market search", "Manual payment review"].map((item) => <li key={item} className="flex items-center gap-2.5"><Check size={16} className="shrink-0 text-leaf-500"/><span className={i === 1 ? "text-slate-200" : "text-slate-600"}>{item}</span></li>)}</ul>
      <Link href={`/register?plan=${plan.id}`} className={`mt-8 w-full ${i === 1 ? "btn-green" : "btn-primary"}`}>Choose {plan.name.toLowerCase()} <ArrowRight size={16}/></Link>
    </article>)}
    <div className="md:col-span-2 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-navy-700"/><p>Membership is activated only after an administrator verifies the payment against the receiving UPI account. Payment links, QR codes and screenshots are not proof of funds received.</p></div>
  </div>;
}
