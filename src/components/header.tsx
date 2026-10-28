import Link from "next/link";
import { Suspense } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { LangSwitch } from "./lang-switch";

export function Header({ lang, t }: { lang: Locale; t: Dictionary }) {
  const links = [
    { href: `/${lang}/chat`, label: t.nav.chat },
    { href: `/${lang}/find`, label: t.nav.find },
    { href: `/${lang}/schemes`, label: t.nav.browse },
  ];
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-2">
        <Link href={`/${lang}`} className="mr-auto flex items-center gap-2 py-1 font-bold text-brand">
          <span aria-hidden className="grid size-9 place-items-center rounded-xl bg-brand text-lg text-brand-ink">यो</span>
          <span className="hidden text-lg sm:inline">{t.appName}</span>
        </Link>
        <nav className="flex items-center gap-1 text-base">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-lg px-2.5 py-2 font-medium text-text active:bg-surface-2">
              {l.label}
            </Link>
          ))}
        </nav>
        <Suspense fallback={<span className="px-3 py-1.5 text-base font-semibold text-brand">{t.switchLang}</span>}>
          <LangSwitch lang={lang} label={t.switchLang} />
        </Suspense>
      </div>
    </header>
  );
}
