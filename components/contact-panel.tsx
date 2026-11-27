"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Mail, MapPin, Clock3 } from "lucide-react";

type Support = { whatsappNumber?: string; customerSupportMessage?: string; supportEmail?: string; supportHours?: string };
export function ContactPanel() {
  const [support, setSupport] = useState<Support>({});
  useEffect(() => { fetch("/api/public/settings").then((r) => r.ok ? r.json() : null).then((v) => setSupport(v?.settings ?? {})).catch(() => {}); }, []);
  const digits = (support.whatsappNumber || "").replace(/[^0-9]/g, "");
  const number = digits.length === 10 ? `91${digits}` : digits;
  return <div className="grid gap-5 md:grid-cols-2">
    <div className="card p-6"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-leaf-50 text-leaf-700"><MessageCircle size={22}/></span><h2 className="mt-4 text-lg font-semibold text-navy-900">WhatsApp support</h2><p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">{support.customerSupportMessage || "WhatsApp support details will appear here once the platform administrator configures them."}</p>{number ? <a className="btn-green mt-5 w-full" href={`https://wa.me/${number}`} target="_blank" rel="noreferrer">Message support</a> : <span className="mt-5 inline-flex rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">Support contact not configured yet</span>}</div>
    <div className="card p-6"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-navy-50 text-navy-700"><Mail size={22}/></span><h2 className="mt-4 text-lg font-semibold text-navy-900">Email & platform information</h2><div className="mt-4 space-y-3 text-sm text-slate-600">{support.supportEmail && <p className="flex items-center gap-2"><Mail size={15}/><a className="text-navy-700 underline" href={`mailto:${support.supportEmail}`}>{support.supportEmail}</a></p>}<p className="flex items-center gap-2"><MapPin size={15}/> India</p>{support.supportHours && <p className="flex items-center gap-2"><Clock3 size={15}/>{support.supportHours}</p>}</div>{!support.supportEmail && !support.supportHours && <p className="mt-4 text-sm leading-6 text-slate-500">For payment questions, use the WhatsApp number displayed in your payment page. Never send a password or OTP to support.</p>}</div>
  </div>;
}
