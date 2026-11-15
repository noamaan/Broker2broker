"use client";

import { useEffect,useMemo,useState,type FormEvent } from "react";
import Link from "next/link";
import { useApiData,PageTitle,LoadingState,AlertBox,EmptyState } from "@/components/dashboard-ui";
import { ListingCard } from "@/components/listing-card";
import type { Listing } from "@/lib/types";
import { Building2,Filter,Search,X } from "lucide-react";

type SearchData={items:Listing[];total:number;page:number;limit:number};
type Location={localityID:string;city:string;name:string;state:string};
type Filters={q:string;city:string;locality:string;transactionType:string;propertyType:string;bhk:string;furnishing:string;availability:string;minPrice:string;maxPrice:string;minRent:string;maxRent:string;minDeposit:string;maxDeposit:string;minArea:string;maxArea:string};
const emptyFilters:Filters={q:"",city:"",locality:"",transactionType:"",propertyType:"",bhk:"",furnishing:"",availability:"",minPrice:"",maxPrice:"",minRent:"",maxRent:"",minDeposit:"",maxDeposit:"",minArea:"",maxArea:""};
export function ExploreProperties(){const[filters,setFilters]=useState<Filters>(emptyFilters);const[applied,setApplied]=useState<Filters>(emptyFilters);const[page,setPage]=useState(1);const[locations,setLocations]=useState<Location[]>([]);
  const url=useMemo(()=>{const p=new URLSearchParams({page:String(page),limit:"18"});Object.entries(applied).forEach(([k,v])=>{if(v)p.set(k,v);});return `/api/listings?${p.toString()}`;},[applied,page]);
  const{data,loading,error,reload}=useApiData<SearchData>(url);
  useEffect(()=>{fetch("/api/localities").then(r=>r.ok?r.json():null).then(v=>setLocations(v?.items||[])).catch(()=>{});},[]);
  function submit(e:FormEvent){e.preventDefault();setApplied(filters);setPage(1);}
  const cityOptions=[...new Set(locations.map(x=>x.city))];const localities=locations.filter(x=>!filters.city||x.city===filters.city);
  function set(key:keyof Filters,value:string){setFilters(f=>({...f,[key]:value}));}
  return <div><PageTitle eyebrow="Property network" title="Explore properties" description="Search current opportunities shared by brokers. Contact details are only available to members with approved active access." action={<Link href="/dashboard/new-listing" className="btn-primary"><Building2 size={16}/>Add listing</Link>}/>
    <form onSubmit={submit} className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5"><div className="mb-4 flex items-center gap-2 text-sm font-semibold text-navy-900"><Filter size={17}/>Refine your search</div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <input aria-label="Search properties" className="input" value={filters.q} onChange={e=>set("q",e.target.value)} placeholder="Locality, landmark, keyword"/>
      <select className="input" value={filters.city} onChange={e=>{setFilters(f=>({...f,city:e.target.value,locality:""}));}}><option value="">All cities</option>{cityOptions.map(c=><option key={c}>{c}</option>)}</select>
      <select className="input" value={filters.locality} onChange={e=>set("locality",e.target.value)}><option value="">All localities</option>{localities.map(l=><option key={l.localityID} value={l.name}>{l.name}</option>)}</select>
      <select className="input" value={filters.transactionType} onChange={e=>set("transactionType",e.target.value)}><option value="">Any transaction</option>{[["RENT","Rent"],["SALE","Sale"],["RESALE","Resale"],["HEAVY_DEPOSIT","Heavy Deposit"],["LEASE","Lease"],["COMMERCIAL_RENT","Commercial Rent"],["COMMERCIAL_SALE","Commercial Sale"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
      <input className="input" aria-label="Property type" value={filters.propertyType} onChange={e=>set("propertyType",e.target.value)} placeholder="Property type (e.g. 2BHK)"/>
      <input className="input" aria-label="BHK" value={filters.bhk} onChange={e=>set("bhk",e.target.value)} placeholder="BHK / RK"/>
      <select className="input" value={filters.furnishing} onChange={e=>set("furnishing",e.target.value)}><option value="">Any furnishing</option><option value="FURNISHED">Furnished</option><option value="SEMI_FURNISHED">Semi-furnished</option><option value="UNFURNISHED">Unfurnished</option></select>
      <input className="input" aria-label="Availability" value={filters.availability} onChange={e=>set("availability",e.target.value)} placeholder="Availability (e.g. Immediate)"/>
      <input className="input" aria-label="Minimum price" inputMode="numeric" value={filters.minPrice} onChange={e=>set("minPrice",e.target.value)} placeholder="Min sale price (₹)"/>
      <input className="input" aria-label="Maximum price" inputMode="numeric" value={filters.maxPrice} onChange={e=>set("maxPrice",e.target.value)} placeholder="Max sale price (₹)"/>
      <input className="input" aria-label="Minimum rent" inputMode="numeric" value={filters.minRent} onChange={e=>set("minRent",e.target.value)} placeholder="Min monthly rent (₹)"/>
      <input className="input" aria-label="Maximum rent" inputMode="numeric" value={filters.maxRent} onChange={e=>set("maxRent",e.target.value)} placeholder="Max monthly rent (₹)"/>
      <input className="input" aria-label="Minimum deposit" inputMode="numeric" value={filters.minDeposit} onChange={e=>set("minDeposit",e.target.value)} placeholder="Min deposit (₹)"/>
      <input className="input" aria-label="Maximum deposit" inputMode="numeric" value={filters.maxDeposit} onChange={e=>set("maxDeposit",e.target.value)} placeholder="Max deposit (₹)"/>
      <input className="input" aria-label="Minimum area" inputMode="decimal" value={filters.minArea} onChange={e=>set("minArea",e.target.value)} placeholder="Min area (sq ft)"/>
      <input className="input" aria-label="Maximum area" inputMode="decimal" value={filters.maxArea} onChange={e=>set("maxArea",e.target.value)} placeholder="Max area (sq ft)"/>
    </div><div className="mt-4 flex flex-wrap gap-2"><button className="btn-primary !py-2.5"><Search size={15}/>Search listings</button><button type="button" className="btn-secondary !py-2.5" onClick={()=>{setFilters(emptyFilters);setApplied(emptyFilters);setPage(1);}}><X size={15}/>Clear filters</button></div></form>
    {loading?<LoadingState label="Searching current listings…"/>:error?<div className="space-y-4"><AlertBox message={error} tone={error.toLowerCase().includes("membership")?"warning":"error"}/>{error.toLowerCase().includes("membership")&&<div className="card p-5"><h2 className="font-semibold text-navy-900">Membership access is required</h2><p className="mt-2 text-sm leading-6 text-slate-600">Choose a monthly or yearly plan and submit your UPI reference. Listings unlock after manual administrator approval.</p><Link href="/dashboard/membership" className="btn-primary mt-4">View membership <span>→</span></Link></div>}<button onClick={reload} className="btn-secondary">Try again</button></div>:data?.items.length?<><p className="mb-4 text-sm text-slate-500">{data.total} {data.total===1?"property":"properties"} found</p><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{data.items.map(item=><ListingCard key={item.listingID} listing={item}/>)}</div><div className="mt-6 flex items-center justify-between"><button className="btn-secondary" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button><span className="text-xs text-slate-500">Page {data.page} of {Math.max(1,Math.ceil(data.total/data.limit))}</span><button className="btn-secondary" disabled={page*data.limit>=data.total} onClick={()=>setPage(p=>p+1)}>Next</button></div></>:<EmptyState title="No listings match your search" copy="Try a wider location or remove a filter. Listings are hidden from search when availability needs to be reconfirmed." icon={Search} action={<button className="btn-secondary" onClick={reload}>Refresh results</button>}/>}
  </div>;
}
