import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FindWizard } from "@/components/find-wizard";
import { getDictionary, hasLocale, stateLabel } from "@/lib/i18n";
import { states } from "@/lib/schemes";

export async function generateMetadata({ params }: PageProps<"/[lang]/find">): Promise<Metadata> {
  const { lang } = await params;
  return { title: getDictionary(hasLocale(lang) ? lang : "hi").find.title };
}

export default async function FindPage({ params }: PageProps<"/[lang]/find">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang);
  const stateOptions = states().map((s) => ({ value: s, label: stateLabel(s, lang) }));
  return <FindWizard lang={lang} t={t} states={stateOptions} />;
}
