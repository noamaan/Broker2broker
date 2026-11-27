"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Activity, Bell, Building2, ChevronDown, CreditCard, DoorOpen, FilePlus2, Heart, LayoutDashboard, LogOut, Menu, MessageSquareText, Search, Settings, Shield, UserRound, UsersRound, X, Wrench } from "lucide-react";
import type { CurrentUser } from "@/lib/types";
import { apiFetch } from "@/lib/client/api";

const memberNav=[
  {href:"/dashboard",label:"Overview",icon:LayoutDashboard},
  {href:"/dashboard/explore",label:"Explore properties",icon:Search},
  {href:"/dashboard/new-listing",label:"Add a listing",icon:FilePlus2},
  {href:"/dashboard/brokers",label:"Broker directory",icon:UsersRound},
  {href:"/dashboard/enquiries",label:"Enquiries",icon:MessageSquareText},
  {href:"/dashboard/ai-converter",label:"AI converter",icon:MessageSquareText},
  {href:"/dashboard/my-listings",label:"My listings",icon:Building2},
  {href:"/dashboard/saved",label:"Saved properties",icon:Heart},
  {href:"/dashboard/profile",label:"Broker profile",icon:UserRound},
  {href:"/dashboard/notifications",label:"Notifications",icon:Bell},
  {href:"/dashboard/membership",label:"Membership",icon:CreditCard},
  {href:"/dashboard/settings",label:"Account settings",icon:Settings}
];
export function DashboardShell({user,children}:{user:CurrentUser;children:React.ReactNode}){
  const pathname=usePathname();const router=useRouter();const[mobileOpen,setMobileOpen]=useState(false);const[signingOut,setSigningOut]=useState(false);const[standalone,setStandalone]=useState(false);const menuRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{setMobileOpen(false);},[pathname]);
  useEffect(()=>{
    if(!window.matchMedia)return;
    const query=window.matchMedia("(display-mode: standalone) and (max-width: 1023px)");
    const update=()=>setStandalone(query.matches);update();
    if(query.addEventListener)query.addEventListener("change",update);else query.addListener(update);
    return ()=>{if(query.removeEventListener)query.removeEventListener("change",update);else query.removeListener(update);};
  },[]);
  useEffect(()=>{
    if(!mobileOpen)return;
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const previousOverflow=document.body.style.overflow;
    if(standalone){document.body.style.overflow="hidden";menuRef.current?.querySelector<HTMLButtonElement>(".app-close-menu")?.focus();}
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){setMobileOpen(false);return;}
      if(!standalone||event.key!=="Tab"||!menuRef.current)return;
      const focusable=Array.from(menuRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(el=>el.offsetParent!==null);
      if(!focusable.length){event.preventDefault();return;}
      const first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    window.addEventListener("keydown",onKey);
    return ()=>{window.removeEventListener("keydown",onKey);if(standalone){document.body.style.overflow=previousOverflow;previous?.focus();}};
  },[mobileOpen,standalone]);
  async function signOut(){setSigningOut(true);try{await apiFetch("/api/auth/logout",{method:"POST"});router.push("/login");router.refresh();}finally{setSigningOut(false);}}
  const nav=[...memberNav,...(user.role==="ADMIN"||user.role==="DEVELOPER"?[{href:"/admin",label:"Admin dashboard",icon:Shield}]:[]),...(user.role==="DEVELOPER"?[{href:"/developer-control",label:"Developer controls",icon:Wrench}]:[])];
  const active=(href:string)=>href==="/dashboard"?pathname===href:pathname===href||pathname.startsWith(href+"/");
  const initials=user.fullName.split(/\s+/).map(x=>x[0]).slice(0,2).join("").toUpperCase();
  const navList=<>{nav.map(({href,label,icon:Icon})=><Link key={href} href={href} onClick={()=>setMobileOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active(href)?"bg-navy-900 text-white shadow-sm":"text-slate-600 hover:bg-slate-100 hover:text-navy-900"}`}><Icon size={17}/><span>{label}</span></Link>)}</>;
  return <div className="dashboard-shell min-h-[calc(100vh-72px)] bg-[#f6f8fb]">
    <div className="app-topbar"><div className="app-topbar-inner"><div className="app-avatar" aria-hidden="true">{initials}</div><div className="min-w-0 flex-1"><p className="app-topbar-label">YOUR WORKSPACE</p><p className="app-topbar-name">{user.fullName}</p></div><Link href="/dashboard/notifications" aria-label="Notifications" className="app-topbar-action"><Bell size={20}/></Link></div></div>
    <div className="container-page grid gap-6 py-5 lg:grid-cols-[245px_minmax(0,1fr)] lg:py-8">
      <aside className="hidden lg:block"><div className="sticky top-[92px] rounded-2xl border border-slate-200 bg-white p-3 shadow-card"><div className="mb-3 flex items-center gap-3 border-b border-slate-100 px-2 pb-4 pt-2"><div className="grid h-10 w-10 place-items-center rounded-xl bg-navy-900 text-sm font-bold text-white">{initials}</div><div className="min-w-0"><p className="truncate text-sm font-semibold text-navy-900">{user.fullName}</p><p className="truncate text-xs text-slate-500">{user.agencyName||user.role.toLowerCase()}</p></div></div><nav className="grid gap-1">{navList}</nav><div className="mt-4 border-t border-slate-100 pt-3"><button type="button" onClick={signOut} disabled={signingOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-700"><LogOut size={17}/>{signingOut?"Signing out…":"Sign out"}</button></div></div></aside>
      <section className="min-w-0">
        <div className="workspace-toolbar mb-5 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-card lg:px-5"><div className="flex items-center gap-3"><button type="button" onClick={()=>setMobileOpen(v=>!v)} className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-600 lg:hidden" aria-label={mobileOpen?"Close dashboard menu":"Open dashboard menu"} aria-expanded={mobileOpen} aria-controls="dashboard-menu">{mobileOpen?<X size={18}/>:<Menu size={18}/>}</button><div><p className="text-xs font-medium uppercase tracking-[.13em] text-slate-400">Broker2Broker workspace</p><p className="text-sm font-semibold text-navy-900">{user.city||"Your local market"}</p></div></div><div className="flex items-center gap-2"><span className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${user.membershipStatus==="ACTIVE"?"bg-leaf-50 text-leaf-700":"bg-slate-100 text-slate-600"}`}>{user.membershipStatus||"FREE ACCOUNT"}</span><Link href="/dashboard/notifications" className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Notifications"><Bell size={17}/></Link></div></div>
        {mobileOpen&&<div className="workspace-menu-overlay lg:hidden"><button type="button" className="workspace-menu-backdrop" aria-label="Close dashboard menu" onClick={()=>setMobileOpen(false)}/><div id="dashboard-menu" ref={menuRef} role={standalone?"dialog":"region"} aria-modal={standalone?true:undefined} aria-label="Workspace menu" className="workspace-menu mb-5 rounded-2xl border border-slate-200 bg-white p-3 shadow-card"><div className="app-menu-heading"><div><p className="app-topbar-label">BROKER2BROKER</p><h2>Everything you need</h2></div><button type="button" onClick={()=>setMobileOpen(false)} aria-label="Close menu" className="app-close-menu"><X size={20}/></button></div><nav aria-label="Dashboard menu" className="grid gap-1">{navList}<Link href="/" onClick={()=>setMobileOpen(false)} className="app-website-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600"><DoorOpen size={17}/>Visit website</Link><button type="button" onClick={signOut} disabled={signingOut} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-500"><LogOut size={17}/>{signingOut?"Signing out…":"Sign out"}</button></nav></div></div>}
        {children}
      </section>
    </div>
    <nav aria-label="Quick navigation" className="browser-quick-nav fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-slate-200 bg-white/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(16,39,68,.06)] backdrop-blur lg:hidden">{[memberNav[0],memberNav[1],memberNav[2],memberNav[7],memberNav[10]].map(({href,label,icon:Icon})=><Link key={href} href={href} aria-current={active(href)?"page":undefined} className={`flex min-w-0 flex-1 flex-col items-center gap-1 py-1 text-[10px] font-semibold ${active(href)?"text-leaf-700":"text-slate-500"}`}><Icon size={19}/><span>{href==="/dashboard"?"Home":href==="/dashboard/explore"?"Explore":href==="/dashboard/new-listing"?"Add":href==="/dashboard/saved"?"Saved":"Membership"}</span></Link>)}</nav>
    <nav aria-label="App navigation" className="app-tab-bar">{[memberNav[0],memberNav[1],memberNav[2],memberNav[6]].map(({href,label,icon:Icon})=><Link key={href} href={href} aria-current={active(href)?"page":undefined} className={`app-tab ${active(href)?"is-active":""}`}><span className="app-tab-icon"><Icon size={20}/></span><span>{href==="/dashboard"?"Home":href==="/dashboard/explore"?"Explore":href==="/dashboard/new-listing"?"Add":"Listings"}</span></Link>)}<button type="button" className={`app-tab ${mobileOpen?"is-active":""}`} onClick={()=>setMobileOpen(v=>!v)} aria-label={mobileOpen?"Close menu":"More options"} aria-expanded={mobileOpen} aria-controls="dashboard-menu"><span className="app-tab-icon"><Menu size={20}/></span><span>More</span></button></nav>
    <div className="workspace-bottom-space h-20 lg:hidden" aria-hidden="true" />
  </div>;
}
