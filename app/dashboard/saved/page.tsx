import { MemberGate } from "@/components/member-gate";
import { SavedProperties } from "@/components/saved-properties";
export const metadata={title:"Saved properties"};
export default function SavedPage(){return <MemberGate><SavedProperties/></MemberGate>;}
