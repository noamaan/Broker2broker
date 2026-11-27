import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { getCurrentUser, isMembershipActive } from "@/lib/server/auth";

// This is only an explanatory UI gate. The backend independently checks membership on every protected request.
export async function MemberGate({children,allowStaff=false}:{children:React.ReactNode;allowStaff?:boolean}) {
  const user = await getCurrentUser();
  const staff = allowStaff && (user?.role === "ADMIN" || user?.role === "DEVELOPER");
  if (user && (staff || isMembershipActive(user))) return <>{children}</>;
  return <section className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-white p-6 shadow-card sm:p-8"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-700"><LockKeyhole size={22}/></span><p className="eyebrow mt-5">Members only</p><h1 className="mt-2 text-2xl font-semibold text-navy-900">Active membership required</h1><p className="mt-3 text-sm leading-7 text-slate-600">An approved, unexpired membership is required for this feature. A pending or rejected payment does not activate access. You can still manage your account and submit a payment request.</p><Link href="/dashboard/membership" className="btn-primary mt-5">View membership</Link></section>;
}
