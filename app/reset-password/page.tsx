import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { ResetPasswordPanel } from "@/components/reset-password-panel";
export const metadata:Metadata={title:"Choose a new password"};
export default function ResetPasswordPage(){return <main className="container-page py-16 sm:py-24"><div className="mx-auto max-w-lg rounded-[28px] border border-slate-200 bg-white p-7 shadow-card sm:p-10"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-navy-50 text-navy-700"><KeyRound size={22}/></span><h1 className="mt-5 text-2xl font-semibold text-navy-900">Choose a new password</h1><p className="mt-2 text-sm leading-6 text-slate-600">Reset links expire after 30 minutes and can be used only once.</p><div className="mt-7"><Suspense fallback={<p className="text-sm text-slate-500">Loading reset link…</p>}><ResetPasswordPanel/></Suspense></div><p className="mt-6 text-center text-xs text-slate-500"><Link className="font-semibold text-navy-700" href="/login">Return to sign in</Link></p></div></main>;}
