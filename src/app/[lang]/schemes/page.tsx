import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { summarize } from "@/lib/eligibility";
import { getDictionary, hasLocale, stateLabel } from "@/lib/i18n";
import { allSchemes, searchSchemes, states } from "@/lib/schemes";

const PAGE = 40;

export async function generateMetadata({ params }: PageProps<"/[lang]/schemes">): Promise<Metadata> {
  const { lang } = await params;
  return { title: getDictionary(hasLocale(lang) ? lang : "hi").browse.title };
}

export default async function BrowsePage({ params, searchParams }: PageProps<"/[lang]/schemes">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 200) : "";
  const state = typeof sp.state === "string" ? sp.state : "";
  const page = Math.max(1, Number(sp.page) || 1);

  let list = q ? searchSchemes(q, { state: state && state !== "central" ? state : undefined, limit: 400 }) : allSchemes();
  if (state === "central") list = list.filter((s) => s.level === "central");
  else if (state) list = list.filter((s) => !s.state || s.state === state);
  if (!q && state && state !== "central") list = [...list].sort((a, b) => Number(Boolean(b.state)) - Number(Boolean(a.state)));

  const shown = list.slice(0, page * PAGE);
  const moreHref = `/${lang}/schemes?${new URLSearchParams({ ...(q && { q }), ...(state && { state }), page: String(page + 1) })}`;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t.browse.title}</h1>
      <form className="flex flex-col gap-2 sm:flex-row" action={`/${lang}/schemes`}>
        <input
          name="q"
          defaultValue={q}
          placeholder={t.browse.search}
          aria-label={t.browse.search}
          className="h-14 flex-1 rounded-xl border-2 border-border bg-surface px-4 outline-none focus:border-brand"
        />
        <select name="state" defaultValue={state} aria-label={t.find.q.state} className="h-14 rounded-xl border-2 border-border bg-surface px-3">
          <option value="">{t.browse.allStates}</option>
          <option value="central">{t.browse.centralOnly}</option>
          {states().map((s) => (
            <option key={s} value={s}>
              {stateLabel(s, lang)}
            </option>
          ))}
        </select>
        <button className="h-14 rounded-xl bg-brand px-6 font-bold text-brand-ink">🔍</button>
      </form>
      <p className="text-sm text-muted">
        {t.browse.showing} {shown.length} / {list.length} {t.browse.results}
      </p>
      <ul className="flex flex-col gap-2">
        {shown.map((s) => (
          <li key={s.slug}>
            <Link href={`/${lang}/schemes/${s.slug}`} className="hover-lift block rounded-2xl border border-border bg-surface p-4">
              <span className="block text-lg font-bold leading-snug">{s.name}</span>
              <span className="mt-0.5 block text-sm text-muted">
                {s.state ? stateLabel(s.state, lang) : t.scheme.central}
                {s.tags.length ? ` · ${s.tags.slice(0, 3).join(" · ")}` : ""}
              </span>
              <span className="mt-1.5 block text-base">{summarize(s.details || s.benefits, 180)}</span>
            </Link>
          </li>
        ))}
      </ul>
      {list.length > shown.length && (
        <Link href={moreHref} scroll={false} className="rounded-xl border-2 border-border py-3 text-center font-semibold">
          {t.find.showMore}
        </Link>
      )}
    </div>
  );
}
