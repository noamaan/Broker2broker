import { PageIntro } from "@/components/page-intro";

type Section = { title: string; body: string };
export function LegalPage({ eyebrow, title, copy, sections, updated = "15 November 2026" }: { eyebrow: string; title: string; copy: string; sections: Section[]; updated?: string }) {
  return <main><PageIntro eyebrow={eyebrow} title={title} copy={copy}/><section className="container-page max-w-4xl py-12 sm:py-16"><p className="text-xs font-medium text-slate-500">Last updated: {updated}</p><div className="mt-8 space-y-8">{sections.map((section)=><article key={section.title}><h2 className="text-lg font-semibold text-navy-900">{section.title}</h2><p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-600">{section.body}</p></article>)}</div><div className="mt-10 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">These platform policies should be reviewed by the platform operator and qualified Indian legal counsel before production launch. Configure the correct legal entity, support contact, retention schedule and applicable tax/refund terms before accepting live payments.</div></section></main>;
}
