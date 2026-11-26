import Link from "next/link";
import { Building2, ArrowUpRight } from "lucide-react";
import { DEVELOPER_CREDIT, TAGLINE } from "@/lib/branding";

export function SiteFooter() {
  return <footer className="mt-24 border-t border-slate-200 bg-slate-50">
    <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
      <div>
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-navy-900 text-white"><Building2 size={19} /></span>
          <span className="text-base font-bold text-navy-900">Broker<span className="text-leaf-600">2</span>Broker</span>
        </Link>
        <p className="mt-4 max-w-sm text-sm leading-6 text-slate-600">{TAGLINE} A better way for property professionals to connect, collaborate and move opportunities forward.</p>
        <p className="mt-4 text-xs font-semibold text-slate-500">{DEVELOPER_CREDIT}</p>
      </div>
      <div>
        <h3 className="text-sm font-bold text-navy-900">Explore</h3>
        <div className="mt-4 grid gap-3 text-sm text-slate-600">
          <Link className="hover:text-leaf-700" href="/about">About us</Link><Link className="hover:text-leaf-700" href="/how-it-works">How it works</Link><Link className="hover:text-leaf-700" href="/pricing">Membership</Link><Link className="hover:text-leaf-700" href="/contact">Contact</Link><Link className="hover:text-leaf-700" href="/install">Install the app</Link>
        </div>
      </div>
      <div>
        <h3 className="text-sm font-bold text-navy-900">Information</h3>
        <div className="mt-4 grid gap-3 text-sm text-slate-600">
          <Link className="hover:text-leaf-700" href="/terms">Terms of use</Link><Link className="hover:text-leaf-700" href="/privacy">Privacy policy</Link><Link className="hover:text-leaf-700" href="/refund-policy">Refund policy</Link><Link className="hover:text-leaf-700" href="/developer-control">Developer access <ArrowUpRight className="inline" size={13} /></Link>
        </div>
      </div>
    </div>
    <div className="border-t border-slate-200"><div className="container-page flex flex-col gap-2 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between"><span>© {new Date().getFullYear()} Broker2Broker. All rights reserved.</span><span>Built for brokers. Powered by collaboration.</span></div></div>
  </footer>;
}
