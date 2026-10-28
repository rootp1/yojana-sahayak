import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, hasLocale } from "@/lib/i18n";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang);
  const cards = [
    { href: `/${lang}/chat`, icon: "🎙️", title: t.home.askTitle, body: t.home.askBody, primary: true },
    { href: `/${lang}/find`, icon: "✅", title: t.home.findTitle, body: t.home.findBody },
    { href: `/${lang}/schemes`, icon: "📚", title: t.home.browseTitle, body: t.home.browseBody },
  ];
  return (
    <div className="flex flex-col gap-4">
      <section className="pt-2">
        <h1 className="text-3xl font-bold leading-tight text-balance">{t.appName}</h1>
        <p className="mt-1 text-lg text-muted text-pretty">{t.tagline}</p>
      </section>
      {cards.map((c) => (
        <Link
          key={c.href}
          href={c.href}
          className={`hover-lift flex items-start gap-4 rounded-2xl border-2 p-5 transition-colors ${
            c.primary ? "border-brand bg-brand-soft" : "border-border bg-surface"
          }`}
        >
          <span aria-hidden className="text-4xl leading-none">{c.icon}</span>
          <span>
            <span className="block text-xl font-bold">{c.title}</span>
            <span className="mt-1 block text-muted">{c.body}</span>
          </span>
        </Link>
      ))}
      <p className="rounded-xl border border-amber/40 bg-amber-soft p-4 text-base">⚠️ {t.home.safety}</p>
    </div>
  );
}
