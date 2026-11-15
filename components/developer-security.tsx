"use client";

import { useState } from "react";
import { AlertBox, EmptyState, LoadingState, PageTitle, useApiData } from "@/components/dashboard-ui";
import { dateLabel } from "@/lib/client/api";
import { RefreshCw, ShieldAlert } from "lucide-react";

type SecurityEvent = {
  securityLogID: string;
  actorID: string;
  eventType: string;
  subject: string;
  ipHash: string;
  userAgent: string;
  details: Record<string, unknown>;
  createdAt: string;
};
type SecurityData = { items: SecurityEvent[]; total: number; page: number; limit: number };

export function DeveloperSecurity() {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useApiData<SecurityData>(`/api/developer/security-logs?page=${page}&limit=30`);

  return (
    <div>
      <PageTitle
        eyebrow="Private security monitoring"
        title="Security events"
        description="Review recent authentication and account-security signals. IP addresses are stored only as keyed fingerprints, not raw addresses."
        action={<button type="button" onClick={reload} className="btn-secondary"><RefreshCw size={14} />Refresh</button>}
      />
      {error && <div className="mb-4"><AlertBox message={error} /></div>}
      {loading ? <LoadingState label="Loading security events…" /> : data?.items.length ? (
        <>
          <div className="mb-3 text-xs text-slate-500">{data.total} recorded event{data.total === 1 ? "" : "s"}</div>
          <div className="space-y-3">
            {data.items.map((event) => (
              <article key={event.securityLogID} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="badge bg-amber-50 text-amber-800">{event.eventType.replaceAll("_", " ")}</span>
                      <span className="text-xs text-slate-500">{dateLabel(event.createdAt)}</span>
                    </div>
                    <p className="mt-2 break-all text-sm font-semibold text-navy-900">{event.subject || "No subject"}</p>
                    <p className="mt-1 break-all text-[11px] text-slate-500">Actor: {event.actorID || "Unauthenticated"} · Fingerprint: {event.ipHash || "—"}</p>
                  </div>
                  <code className="max-w-full break-all rounded-lg bg-slate-50 p-2 text-[10px] text-slate-500 sm:max-w-[45%]">{event.userAgent || "No user agent"}</code>
                </div>
                {Object.keys(event.details || {}).length > 0 && <pre className="mt-3 overflow-auto rounded-xl bg-slate-50 p-3 text-[10px] leading-5 text-slate-600">{JSON.stringify(event.details, null, 2)}</pre>}
              </article>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between">
            <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
            <span className="text-xs text-slate-500">Page {data.page} of {Math.max(1, Math.ceil(data.total / data.limit))}</span>
            <button className="btn-secondary" disabled={page * data.limit >= data.total} onClick={() => setPage((value) => value + 1)}>Next</button>
          </div>
        </>
      ) : error ? null : (
        <EmptyState title="No security events recorded" copy="Failed sign-in attempts and password-reset events will appear here after the connected backend records them." icon={ShieldAlert} />
      )}
    </div>
  );
}
