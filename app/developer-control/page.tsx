import Link from "next/link";
import { getCurrentUser } from "@/lib/server/auth";
import { DashboardShell } from "@/components/dashboard-shell";
import { DeveloperPortal } from "@/components/developer-portal";
import { DeveloperDashboard } from "@/components/developer-dashboard";
import { ShieldX } from "lucide-react";
export const dynamic="force-dynamic";
export const metadata={title:"Developer control"};
export default async function DeveloperControlPage(){let user=null;try{user=await getCurrentUser();}catch{}if(user?.role==="DEVELOPER")return <DashboardShell user={user}><DeveloperDashboard/></DashboardShell>;if(user)return <main className="container-page py-20"><div className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-white p-7 text-center shadow-card"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-700"><ShieldX size={22}/></span><h1 className="mt-4 text-xl font-semibold text-navy-900">Developer access restricted</h1><p className="mt-2 text-sm leading-6 text-slate-600">This signed-in account does not have the original developer role. A hidden URL or administrator role cannot grant developer access.</p><Link className="btn-secondary mt-5" href="/dashboard">Return to workspace</Link></div></main>;return <DeveloperPortal/>;}
