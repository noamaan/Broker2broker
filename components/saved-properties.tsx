"use client";
import { useApiData,PageTitle,LoadingState,AlertBox,EmptyState } from "@/components/dashboard-ui";
import { ListingCard } from "@/components/listing-card";
import type { Listing } from "@/lib/types";
import Link from "next/link";
import { Heart,Search } from "lucide-react";
export function SavedProperties(){const{data,loading,error,reload}=useApiData<{items:Listing[]}>("/api/favourites");if(loading)return <LoadingState label="Loading saved properties…"/>;return <div><PageTitle eyebrow="Your shortlist" title="Saved properties" description="Keep a private shortlist of opportunities to revisit." action={<Link href="/dashboard/explore" className="btn-secondary"><Search size={15}/>Explore properties</Link>}/>{error&&<AlertBox message={error} tone={error.toLowerCase().includes("membership")?"warning":"error"}/ >}{data?.items.length?<div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{data.items.map(item=><ListingCard key={item.listingID} listing={item}/>)}</div>:<EmptyState title="No saved properties yet" copy="Save an opportunity from Explore Properties to keep it here. Saved opportunities may disappear if their availability is no longer current." icon={Heart} action={<Link href="/dashboard/explore" className="btn-primary">Explore properties</Link>}/>}</div>;}
