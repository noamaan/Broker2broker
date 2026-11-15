import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";
import { ForgotPasswordForm } from "@/components/auth-forms";
export const metadata:Metadata={title:"Forgot password"};
export default function ForgotPasswordPage(){return <main className="container-page py-16 sm:py-24"><div className="mx-auto max-w-lg rounded-[28px] border border-slate-200 bg-white p-7 shadow-card sm:p-10"><Link href="/login" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500"><ArrowLeft size={14}/> Back to sign in</Link><span className="mt-7 grid h-12 w-12 place-items-center rounded-2xl bg-navy-50 text-navy-700"><KeyRound size={22}/></span><h1 className="mt-5 text-2xl font-semibold text-navy-900">Reset your password</h1><p className="mt-2 text-sm leading-6 text-slate-600">Enter your account email. If an account exists, a time-limited reset link will be emailed to you.</p><div className="mt-7"><ForgotPasswordForm/></div></div></main>;}
