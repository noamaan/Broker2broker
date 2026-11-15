"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Activity, Bell, Building2, ChevronDown, CreditCard, DoorOpen, FilePlus2, Heart, LayoutDashboard, LogOut, Menu, MessageSquareText, Search, Settings, Shield, UserRound, X, Wrench } from "lucide-react";
import type { CurrentUser } from "@/lib/types";
import { apiFetch } from "@/lib/client/api";

const memberNav=[
  {href:"/dashboard",label:"Overview",icon:LayoutDashboard},
  {href:"/dashboard/explore",label:"Explore properties",icon:Search},
  {href:"/dashboard/new-listing",label:"Add a listing",icon:FilePlus2},
  {href:"/dashboard/ai-converter",label:"AI converter",icon:MessageSquareText},
  {href:"/dashboard/my-listings",label:"My listings",icon:Building2},
  {href:"/dashboard/saved",label:"Saved properties",icon:Heart},
  {href:"/dashboard/profile",label:"Broker profile",icon:UserRound},
  {href:"/dashboard/notifications",label:"Notifications",icon:Bell},
  {href:"/dashboard/membership",label:"Membership",icon:CreditCard},
  {href:"/dashboard/settings",label:"Account settings",icon:Settings}
];
export function DashboardShell({user,children}:{user:CurrentUser;children:React.ReactNode}){
  const pathname=usePathname();const router=useRouter();const[mobileOpen,setMobileOpen]=useState(false);const[signingOut,setSigningOut]=useState(false);
  async function signOut(){setSigningOut(true);try{await apiFetch("/api/auth/logout",{method:"POST"});router.push("/login");router.refresh();}finally{setSigningOut(false);}}
  const nav=[...memberNav,...(user.role==="ADMIN"||user.role==="DEVELOPER"?[{href:"/admin",label:"Admin dashboard",icon:Shield}]:[]),...(user.role==="DEVELOPER"?[{href:"/developer-control",label:"Developer controls",icon:Wrench}]:[])];
  const active=(href:string)=>href==="/dashboard"?pathname===href:pathname===href||pathname.startsWith(href+"/");
  const initials=user.fullName.split(/\s+/).map(x=>x[0]).slice(0,2).join("").toUpperCase();
  const navList=<>{nav.map(({href,label,icon:Icon})=><Link key={href} href={href} onClick={()=>setMobileOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active(href)?"bg-navy-900 text-white shadow-sm":"text-slate-600 hover:bg-slate-100 hover:text-navy-900"}`}><Icon size={17}/><span>{label}</span></Link>)}</>;
  return <div className="min-h-[calc(100vh-72px)] bg-[#f6f8fb]">
    <div className="container-page grid gap-6 py-5 lg:grid-cols-[245px_minmax(0,1fr)] lg:py-8">
      <aside className="hidden lg:block"><div className="sticky top-[92px] rounded-2xl border border-slate-200 bg-white p-3 shadow-card"><div className="mb-3 flex items-center gap-3 border-b border-slate-100 px-2 pb-4 pt-2"><div className="grid h-10 w-10 place-items-center rounded-xl bg-navy-900 text-sm font-bold text-white">{initials}</div><div className="min-w-0"><p className="truncate text-sm font-semibold text-navy-900">{user.fullName}</p><p className="truncate text-xs text-slate-500">{user.agencyName||user.role.toLowerCase()}</p></div></div><nav className="grid gap-1">{navList}</nav><div className="mt-4 border-t border-slate-100 pt-3"><button type="button" onClick={signOut} disabled={signingOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-700"><LogOut size={17}/>{signingOut?"Signing out…":"Sign out"}</button></div></div></aside>
      <section className="min-w-0">
        <div className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-card lg:px-5"><div className="flex items-center gap-3"><button type="button" onClick={()=>setMobileOpen(v=>!v)} className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-600 lg:hidden" aria-label="Toggle dashboard menu">{mobileOpen?<X size={18}/>:<Menu size={18}/>}</button><div><p className="text-xs font-medium uppercase tracking-[.13em] text-slate-400">Broker2Broker workspace</p><p className="text-sm font-semibold text-navy-900">{user.city||"Your local market"}</p></div></div><div className="flex items-center gap-2"><span className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${user.membershipStatus==="ACTIVE"?"bg-leaf-50 text-leaf-700":"bg-slate-100 text-slate-600"}`}>{user.membershipStatus||"FREE ACCOUNT"}</span><Link href="/dashboard/notifications" className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Notifications"><Bell size={17}/></Link></div></div>
        {mobileOpen&&<div className="mb-5 rounded-2xl border border-slate-200 bg-white p-3 shadow-card lg:hidden"><nav className="grid gap-1">{navList}<button type="button" onClick={signOut} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-500"><LogOut size={17}/>Sign out</button></nav></div>}
        {children}
      </section>
    </div>
  </div>;
}
