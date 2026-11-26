"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function Pwa() {
  const [install, setInstall] = useState<InstallEvent | null>(null);
  useEffect(() => {
    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
      navigator.serviceWorker.register("/sw.js").catch(() => { /* The website remains usable without a worker. */ });
    }
    const onInstall = (event: Event) => { event.preventDefault(); setInstall(event as InstallEvent); };
    const onInstalled = () => setInstall(null);
    window.addEventListener("beforeinstallprompt", onInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onInstall); window.removeEventListener("appinstalled", onInstalled); };
  }, []);
  if (!install) return null;
  return <div className="fixed bottom-24 left-4 right-4 lg:bottom-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:left-auto sm:right-6">
    <div className="min-w-0 flex-1"><p className="text-sm font-bold text-navy-900">Install Broker2Broker</p><p className="mt-1 text-xs text-slate-500">Quick access from your home screen.</p></div>
    <button className="btn-primary !px-3 !py-2" onClick={async () => { try { await install.prompt(); await install.userChoice; } catch { /* Browser declined or dismissed the prompt. */ } finally { setInstall(null); } }}><Download size={15}/>Install</button>
    <button className="p-1 text-slate-500" aria-label="Dismiss install prompt" onClick={() => setInstall(null)}><X size={18}/></button>
  </div>;
}
