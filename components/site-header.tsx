"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X, ArrowUpRight, Building2 } from "lucide-react";
import { BRAND_NAME } from "@/lib/branding";
import { apiFetch, AUTH_CHANGED_EVENT, AUTH_CHANGED_STORAGE_KEY } from "@/lib/client/api";

type SessionState = "checking" | "signed-out" | "signed-in";
const links = [
  ["Properties", "/properties"],
  ["How it works", "/how-it-works"],
  ["About", "/about"],
  ["Pricing", "/pricing"],
  ["Contact", "/contact"]
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<SessionState>("checking");
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let disposed = false;
    let sequence = 0;
    async function refreshSession() {
      const request = ++sequence;
      try {
        const response = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
        if (disposed || request !== sequence) return;
        if (response.ok) {
          const body = await response.json();
          if (!disposed && request === sequence) setSession(body?.user ? "signed-in" : "checking");
        } else if (response.status === 401) {
          setSession("signed-out");
        }
        // A network/server failure is not evidence that the user logged out.
      } catch { /* Keep the last known state until a later retry. */ }
    }
    const onVisibility = () => { if (document.visibilityState === "visible") void refreshSession(); };
    const onStorage = (event: StorageEvent) => { if (event.key === AUTH_CHANGED_STORAGE_KEY) void refreshSession(); };
    void refreshSession();
    window.addEventListener("focus", refreshSession);
    window.addEventListener(AUTH_CHANGED_EVENT, refreshSession);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true;
      window.removeEventListener("focus", refreshSession);
      window.removeEventListener(AUTH_CHANGED_EVENT, refreshSession);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pathname]);

  async function signOut() {
    setError("");
    setSigningOut(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      setOpen(false);
      router.push("/login");
      router.refresh();
    } catch {
      setError("Could not sign out. Please try again.");
    } finally { setSigningOut(false); }
  }
  const accountLinks = (mobile: boolean) => {
    const close = () => setOpen(false);
    if (session === "signed-out") return <>
      <Link href="/login" onClick={close} className={mobile ? "btn-secondary !py-2.5" : "px-3 py-2 text-sm font-semibold text-navy-900 transition hover:text-leaf-700"}>Log in</Link>
      <Link href="/register" onClick={close} className={mobile ? "btn-primary !py-2.5" : "btn-primary !px-4 !py-2.5"}>{mobile ? "Join free" : "Join the network"}{!mobile && <ArrowUpRight size={15}/>}</Link>
    </>;
    if (session === "checking") return <Link href="/dashboard" onClick={close} className="btn-secondary !py-2.5">Account</Link>;
    return <>
      <Link href="/dashboard" onClick={close} className="btn-primary !px-4 !py-2.5">Dashboard</Link>
      <Link href="/dashboard/profile" onClick={close} className="btn-secondary !py-2.5">Profile</Link>
      <button type="button" onClick={signOut} disabled={signingOut} className="btn-secondary !py-2.5">{signingOut ? "Signing out…" : "Sign out"}</button>
    </>;
  };
  return <header className={`site-header ${pathname === "/dashboard" || pathname.startsWith("/dashboard/") ? "member-site-header" : ""} sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur-xl`}>
    <div className="container-page flex h-[72px] items-center justify-between gap-5">
      <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label={`${BRAND_NAME} home`} onClick={() => setOpen(false)}>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-navy-900 text-white"><Building2 size={21} strokeWidth={2.1} /></span>
        <span className="leading-tight"><span className="block text-base font-bold tracking-tight text-navy-900">Broker<span className="text-leaf-600">2</span>Broker</span><span className="hidden text-[10px] font-medium tracking-[.12em] text-slate-500 sm:block">PROPERTY NETWORK</span></span>
      </Link>
      <nav className="hidden items-center gap-8 lg:flex" aria-label="Main navigation">
        {links.map(([label, href]) => <Link key={href} href={href} className="text-sm font-medium text-slate-600 transition hover:text-navy-900">{label}</Link>)}
      </nav>
      <div className="hidden items-center gap-3 lg:flex" aria-label="Account navigation">{accountLinks(false)}</div>
      <button type="button" className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-700 lg:hidden" onClick={() => { if (!open) window.dispatchEvent(new Event(AUTH_CHANGED_EVENT)); setOpen((v) => !v); }} aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open}>{open ? <X size={20} /> : <Menu size={20} />}</button>
    </div>
    {open && <nav className="border-t border-slate-100 bg-white px-4 pb-5 pt-3 lg:hidden" aria-label="Mobile navigation">
      <div className="mx-auto grid max-w-7xl gap-1">
        {links.map(([label, href]) => <Link key={href} href={href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">{label}</Link>)}
        <div className="mt-2 flex flex-wrap gap-3 border-t border-slate-100 pt-4">{accountLinks(true)}</div>
      </div>
    </nav>}
    {error && <p role="alert" className="container-page pb-3 text-sm text-red-700">{error}</p>}
  </header>;
}
