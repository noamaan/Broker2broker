import { AdminMembers } from "@/components/admin-members";
import { getCurrentUser } from "@/lib/server/auth";
export const metadata={title:"Manage members"};
export default async function AdminMembersPage(){const user=await getCurrentUser();return <AdminMembers canGrant={user?.role==="DEVELOPER"}/>;}
