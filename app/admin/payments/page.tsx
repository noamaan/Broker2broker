import { AdminPayments } from "@/components/admin-payments";
export const metadata={title:"Payment approvals"};
export default async function AdminPaymentsPage({searchParams}:{searchParams:Promise<{userID?:string}>}){const params=await searchParams;return <AdminPayments userID={typeof params.userID==="string"?params.userID.slice(0,100):""}/>;}
