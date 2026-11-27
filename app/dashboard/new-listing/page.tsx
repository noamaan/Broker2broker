import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ListingComposer } from "@/components/listing-composer";
export const metadata={title:"Add a listing"};
export default function NewListingPage(){return <div><Link href="/dashboard" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-navy-900"><ArrowLeft size={15}/>Workspace</Link><div className="mb-6"><p className="eyebrow">New opportunity</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-navy-900 sm:text-3xl">Create a property listing</h1><p className="mt-2 text-sm leading-6 text-slate-600">Review your information carefully. Listings start as drafts and are shown in search only after you publish.</p></div><ListingComposer/></div>;}
