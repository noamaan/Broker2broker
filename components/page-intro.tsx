export function PageIntro({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return <section className="bg-slate-50/80 py-16 sm:py-20"><div className="container-page"><p className="eyebrow">{eyebrow}</p><h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight text-navy-900 sm:text-5xl">{title}</h1><p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">{copy}</p></div></section>;
}
