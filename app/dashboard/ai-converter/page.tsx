import { MemberGate } from "@/components/member-gate";
import { AIConverter } from "@/components/ai-converter";
export const metadata={title:"AI property converter"};
export default function AIConverterPage(){return <MemberGate><AIConverter/></MemberGate>;}
