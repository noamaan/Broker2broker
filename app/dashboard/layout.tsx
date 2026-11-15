import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/auth";
import { DashboardShell } from "@/components/dashboard-shell";
export const dynamic="force-dynamic";
export default async function DashboardLayout({children}:{children:React.ReactNode}){let user=null;try{user=await getCurrentUser();}catch{}if(!user)redirect("/login");if(user.maintenanceMode&&user.role==="USER")redirect("/maintenance");return <DashboardShell user={user}>{children}</DashboardShell>;}
