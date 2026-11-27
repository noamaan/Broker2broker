import { MemberGate } from "@/components/member-gate";
import { ExploreProperties } from "@/components/explore-properties";
export const metadata={title:"Explore properties"};
export default function ExplorePage(){return <MemberGate allowStaff><ExploreProperties/></MemberGate>;}
