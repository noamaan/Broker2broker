"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import type { Listing } from "@/lib/types";
import { apiFetch } from "@/lib/client/api";
import { AlertBox,LoadingState } from "@/components/dashboard-ui";
import { ListingComposer } from "@/components/listing-composer";
import { ArrowLeft } from "lucide-react";
export function EditListing({listingID}:{listingID:string}){const[listing,setListing]=useState<Listing|null>(null);const[error,setError]=useState("");useEffect(()=>{apiFetch<{listing:Listing}>(`/api/listings/${encodeURIComponent(listingID)}`).then(v=>setListing(v.listing)).catch(e=>setError(e instanceof Error?e.message:"Could not load this listing."));},[listingID]);if(error)return <div className="space-y-4"><AlertBox message={error}/><Link href="/dashboard/my-listings" className="btn-secondary"><ArrowLeft size={15}/>My listings</Link></div>;if(!listing)return <LoadingState label="Loading listing for editing…"/>;return <div><Link href="/dashboard/my-listings" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500"><ArrowLeft size={15}/>My listings</Link><h1 className="mb-5 text-2xl font-semibold tracking-tight text-navy-900">Edit listing</h1><ListingComposer existingID={listingID} initialDraft={listing}/></div>;}
