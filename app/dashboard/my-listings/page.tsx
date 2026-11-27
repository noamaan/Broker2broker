import { MyListings } from "@/components/my-listings";
import { getCurrentUser, isMembershipActive } from "@/lib/server/auth";
export const metadata={title:"My listings"};
export default async function MyListingsPage(){const user=await getCurrentUser();return <MyListings canPublish={!!user&&isMembershipActive(user)} canEdit={!!user&&(isMembershipActive(user)||user.role==="ADMIN"||user.role==="DEVELOPER")}/>;}
