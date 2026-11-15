"use client";

import {useState} from "react";
import Link from "next/link";
import {DeveloperFinance} from "@/components/developer-finance";
import {DeveloperAdmins} from "@/components/developer-admins";
import {DeveloperSettings} from "@/components/developer-settings";
import {DeveloperSecurity} from "@/components/developer-security";
import {PageTitle} from "@/components/dashboard-ui";
import {BarChart3,Database,Settings2,ShieldCheck,UsersRound,Wrench} from "lucide-react";
const tabs=[{id:"overview",label:"Finance & health",icon:BarChart3},{id:"admins",label:"Users & admins",icon:UsersRound},{id:"security",label:"Security events",icon:ShieldCheck},{id:"settings",label:"Platform controls",icon:Settings2}];
export function DeveloperDashboard(){const[tab,setTab]=useState("overview");return <div><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><PageTitle eyebrow="Private owner console" title="Developer control" description="Exclusive platform controls. Financial totals include approved payments only."/><span className="badge-green"><ShieldCheck size={13} className="mr-1"/>Original developer</span></div><div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3">{tabs.map(({id,label,icon:Icon})=><button key={id} onClick={()=>setTab(id)} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${tab===id?"bg-navy-900 text-white":"bg-white text-slate-600 hover:bg-slate-100"}`}><Icon size={16}/>{label}</button>)}</div>{tab==="overview"?<DeveloperFinance/>:tab==="admins"?<DeveloperAdmins/>:tab==="security"?<DeveloperSecurity/>:<DeveloperSettings/>}<div className="mt-7 grid gap-3 sm:grid-cols-2"><Link href="/admin/settings" className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-navy-900 hover:bg-slate-50"><Database size={16} className="mr-2 inline text-navy-600"/>Payment configuration & prices</Link><Link href="/admin" className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-navy-900 hover:bg-slate-50"><Wrench size={16} className="mr-2 inline text-navy-600"/>Open admin operations</Link></div></div>;}
