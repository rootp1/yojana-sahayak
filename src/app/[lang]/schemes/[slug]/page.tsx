import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SpeakButton } from "@/components/voice";
import { summarize } from "@/lib/eligibility";
import { toFaq, toLines } from "@/lib/format";
import { getDictionary, hasLocale, stateLabel } from "@/lib/i18n";
import { getScheme } from "@/lib/schemes";

export async function generateMetadata({ params }: PageProps<"/[lang]/schemes/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const s = getScheme(slug);
  return s ? { title: s.name, description: summarize(s.details, 160) } : {};
}

const SECTIONS = ["details", "benefits", "eligibility", "exclusions", "applicationProcess", "documents"] as const;

export default async function SchemePage({ params }: PageProps<"/[lang]/schemes/[slug]">) {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) notFound();
  const s = getScheme(slug);
  if (!s) notFound();
  const t = getDictionary(lang);
  const faq = toFaq(s.faq);
  const ask = (q: string) => `/${lang}/chat?${new URLSearchParams({ q })}`;
  const speakText = [s.name, s.details, t.scheme.benefits, s.benefits, t.scheme.eligibility, s.eligibility].join(". ");

  return (
    <article className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-brand">
          {s.state ? stateLabel(s.state, lang) : t.scheme.central}
          {s.ministry ? ` · ${s.ministry}` : ""}
        </p>
        <h1 className="text-2xl font-bold leading-tight text-balance">{s.name}</h1>
        {s.tags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {s.tags.slice(0, 6).map((tag) => (
              <li key={tag} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-sm text-muted">
                {tag}
              </li>
            ))}
          </ul>
        )}
        {s.reviewed && <p className="text-sm text-green">✓ {t.scheme.reviewed}</p>}
        <div className="mt-1 flex flex-wrap gap-2">
          <SpeakButton text={speakText} labels={{ listen: t.chat.listen, stop: t.chat.stopListen }} />
          <Link
            href={ask(lang === "hi" ? `"${s.name}" योजना को आसान हिंदी में समझाइए: लाभ, कौन ले सकता है, कागज़ और आवेदन कैसे करें।` : `Explain "${s.name}" in simple Hindi: benefits, who can apply, documents and how to apply.`)}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-sm font-semibold text-brand-ink"
          >
            🗣️ {t.scheme.explainHindi}
          </Link>
          <Link
            href={ask(lang === "hi" ? `"${s.name}" के बारे में मेरा सवाल है: ` : `I have a question about "${s.name}": `)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-semibold text-brand"
          >
            💬 {t.scheme.askAbout}
          </Link>
        </div>
      </header>

      {SECTIONS.map((key) =>
        s[key] ? (
          <section key={key} className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="mb-2 text-xl font-bold">{t.scheme[key]}</h2>
            <ul className="flex flex-col gap-1.5">
              {toLines(s[key]).map((line, i) => (
                <li key={i} className="text-pretty">
                  {line}
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}

      {faq.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="mb-2 text-xl font-bold">{t.scheme.faq}</h2>
          {faq.slice(0, 12).map((item, i) => (
            <details key={i} className="border-t border-border py-2 first-of-type:border-t-0">
              <summary className="cursor-pointer py-1 font-semibold">{item.q}</summary>
              <p className="mt-1 text-pretty">{item.a}</p>
            </details>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-xl font-bold">{t.scheme.sources}</h2>
        <a href={s.officialUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand underline">
          {t.scheme.official} ↗
        </a>
        {s.sources.map((u) => (
          <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="break-all text-sm text-brand underline">
            {u}
          </a>
        ))}
      </section>
    </article>
  );
}
