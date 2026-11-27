import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";
export const metadata: Metadata = { title: "Forgot password" };
export default function ForgotPasswordPage() {
  return <main className="container-page py-16 sm:py-24"><div className="mx-auto max-w-lg rounded-[28px] border border-slate-200 bg-white p-7 shadow-card sm:p-10">
    <Link href="/login" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500"><ArrowLeft size={14}/> Back to sign in</Link>
    <span className="mt-7 grid h-12 w-12 place-items-center rounded-2xl bg-navy-50 text-navy-700"><KeyRound size={22}/></span>
    <h1 className="mt-5 text-2xl font-semibold text-navy-900">Contact an admin to reset your password</h1>
    <p className="mt-3 text-sm leading-6 text-slate-600">Contact the admin and ask for a password reset link. Once they verify your identity, they can send you a private link to choose a new password. The link expires after 30 minutes and can be used once.</p>
    <p className="mt-3 text-sm leading-6 text-slate-600">Never share your password or a reset link with anyone else.</p>
    <Link href="/contact" className="btn-primary mt-7">Contact support</Link>
  </div></main>;
}
