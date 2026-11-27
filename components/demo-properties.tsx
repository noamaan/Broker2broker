"use client";

import { useMemo, useState } from "react";
import { Building2, Globe2, MapPin, SlidersHorizontal } from "lucide-react";

// Entirely fictional UI examples. They never enter the application database or search APIs.
const samples = [
  { id:"demo-india-1",city:"Mira Road",country:"India",locality:"Sample neighbourhood",type:"Apartment",layout:"2 BHK",transaction:"SALE",price:8500000 },
  { id:"demo-india-2",city:"Bhayandar",country:"India",locality:"Sample neighbourhood",type:"Apartment",layout:"1 BHK",transaction:"RENT",price:22000 },
  { id:"demo-uae",city:"Dubai",country:"UAE",locality:"Sample neighbourhood",type:"Apartment",layout:"2 bedroom",transaction:"SALE",price:15000000 },
  { id:"demo-uk",city:"London",country:"United Kingdom",locality:"Sample neighbourhood",type:"Apartment",layout:"1 bedroom",transaction:"RENT",price:110000 },
  { id:"demo-us",city:"New York",country:"United States",locality:"Sample neighbourhood",type:"Apartment",layout:"2 bedroom",transaction:"SALE",price:35000000 },
  { id:"demo-sg",city:"Singapore",country:"Singapore",locality:"Sample neighbourhood",type:"Apartment",layout:"3 bedroom",transaction:"RENT",price:180000 }
] as const;

export function DemoProperties() {
  const [query,setQuery] = useState("");
  const [type,setType] = useState("ALL");
  const visible=useMemo(()=>samples.filter(item=>`${item.city} ${item.country} ${item.locality}`.toLowerCase().includes(query.trim().toLowerCase())&&(type==="ALL"||item.transaction===type)),[query,type]);
  return <main className="container-page py-12 sm:py-16">
    <div className="mx-auto max-w-5xl">
      <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900"><Globe2 size={14}/> LOCAL SANDBOX · NOT REAL LISTINGS</div>
      <h1 className="section-title mt-4">Explore sample properties</h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">A safe visual preview of fictional properties in India and abroad. These samples are not saved to Supabase, shown to members, or connected to enquiries, payments or broker contacts.</p>
      <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><strong>For demonstration only:</strong> all locations, details and amounts are invented. Amounts are illustrative rupee placeholders—not local currency, conversions, market prices or offers. International currencies and country-specific workflows are not yet supported.</div>
      <div className="mt-8 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:grid-cols-[1fr_220px]"><label><span className="label">Search city or country</span><input value={query} onChange={e=>setQuery(e.target.value)} className="input" placeholder="Try Dubai, London or Mira Road"/></label><label><span className="label">Transaction</span><select className="input" value={type} onChange={e=>setType(e.target.value)}><option value="ALL">All samples</option><option value="SALE">Sale</option><option value="RENT">Rent</option></select></label></div>
      <div className="mt-6 flex items-center justify-between text-sm text-slate-500"><p className="flex items-center gap-2"><SlidersHorizontal size={16}/>{visible.length} fictional example{visible.length===1?"":"s"}</p><span>Local preview only</span></div>
      {visible.length?<div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map(item=><article key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card"><div className="flex h-32 items-center justify-center bg-gradient-to-br from-navy-900 to-navy-700 text-white/80"><Building2 size={42}/></div><div className="p-5"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800">FICTIONAL DEMO</span><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{item.transaction}</span></div><h2 className="mt-3 text-lg font-semibold text-navy-900">{item.layout} {item.type}</h2><p className="mt-2 flex items-center gap-1 text-sm text-slate-500"><MapPin size={14}/>{item.city}, {item.country}</p><p className="mt-4 font-bold text-navy-900">{new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(item.price)}{item.transaction==="RENT"?" / month":""}</p><p className="mt-1 text-xs text-slate-400">Illustrative placeholder amount</p></div></article>)}</div>:<div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No examples match. Try a different city or transaction.</div>}
    </div>
  </main>;
}
