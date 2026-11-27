import { MemberGate } from "@/components/member-gate";
import { Enquiries } from "@/components/enquiries";
export const metadata = { title: "Enquiries" };
export default function EnquiriesPage(){return <MemberGate><Enquiries/></MemberGate>;}
