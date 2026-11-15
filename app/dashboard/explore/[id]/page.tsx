import { ListingDetail } from "@/components/listing-detail";
export const metadata={title:"Property details"};
type Props={params:Promise<{id:string}>};
export default async function ListingDetailPage({params}:Props){const {id}=await params;return <ListingDetail listingID={id}/>;}
