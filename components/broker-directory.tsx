"use client";
import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, MessageCircle, UsersRound } from "lucide-react";
import { AlertBox, EmptyState, LoadingState, PageTitle, useApiData } from "@/components/dashboard-ui";

type Broker = { userID: string; fullName: string; agencyName: string; city: string; bio: string; isVerified: boolean; mobile?: string; whatsappNumber?: string };
type Result = { items: Broker[]; page: number; hasMore: boolean; canContact: boolean };
export function BrokerDirectory() {
  const [city, setCity] = useState("");
  const [page, setPage] = useState(1);
  const { data, loading, error } = useApiData<Result>(`/api/brokers?city=${encodeURIComponent(city)}&page=${page}`);
  return <div><PageTitle eyebrow="Your network" title="Broker directory" description="Discover brokers in your market. Active members can view contact details." />
    <label className="mb-5 block max-w-xs"><span className="label">City</span><input className="input" placeholder="All cities" value={city} onChange={e => { setCity(e.target.value); setPage(1); }}/></label>
    {loading ? <LoadingState label="Loading brokers…"/> : error ? <AlertBox message={error}/> : <>
      {!data?.canContact && <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Contact details are available with an active membership. <Link href="/dashboard/membership" className="font-bold underline">View membership</Link></div>}
      {!data?.items.length ? <EmptyState icon={UsersRound} title="No brokers found" copy="Try another city or check back as the network grows."/> : <div className="grid gap-4 md:grid-cols-2">{data.items.map(b => {
        const digits = (b.whatsappNumber || "").replace(/\D/g, "");
        const wa = digits.length === 10 ? `91${digits}` : digits;
        return <article key={b.userID} className="card p-5"><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-navy-50 font-bold text-navy-700">{b.fullName.slice(0,1).toUpperCase()}</span><div><h2 className="flex items-center gap-1.5 font-semibold text-navy-900">{b.fullName}{b.isVerified && <BadgeCheck size={16} className="text-leaf-600" aria-label="Verified broker"/>}</h2><p className="mt-1 text-sm text-slate-500">{b.agencyName} · {b.city}</p></div></div>{b.bio && <p className="mt-4 text-sm leading-6 text-slate-600">{b.bio}</p>}{data.canContact && <div className="mt-4 flex flex-wrap gap-2">{b.mobile && <a className="btn-secondary !px-3 !py-2" href={`tel:${b.mobile.replace(/[^+\d]/g, "")}`}>Call {b.mobile}</a>}{wa && <a className="btn-green !px-3 !py-2" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={15}/>WhatsApp</a>}</div>}</article>;
      })}</div>}
      <div className="mt-5 flex gap-3"><button className="btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button><button className="btn-secondary" disabled={!data?.hasMore} onClick={() => setPage(p => p + 1)}>Next</button></div>
    </>}
  </div>;
}
