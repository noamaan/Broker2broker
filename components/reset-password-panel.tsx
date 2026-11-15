"use client";
import { useSearchParams } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth-forms";
export function ResetPasswordPanel(){const params=useSearchParams();const token=params.get("token")||"";if(!token)return <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">This reset link is missing its token. Request a new password reset link.</div>;return <ResetPasswordForm token={token}/>;}
