import { MemberGate } from "@/components/member-gate";
import { EditListing } from "@/components/edit-listing";
export const metadata={title:"Edit listing"};
type Props={params:Promise<{id:string}>};
export default async function EditListingPage({params}:Props){const{id}=await params;return <MemberGate allowStaff><EditListing listingID={id}/></MemberGate>;}
