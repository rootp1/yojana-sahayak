import type { Metadata, Viewport } from "next";
import { Noto_Sans, Noto_Sans_Devanagari } from "next/font/google";
import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { getDictionary, hasLocale, LOCALES } from "@/lib/i18n";
import "../globals.css";

const noto = Noto_Sans({ subsets: ["latin"], variable: "--font-noto", display: "swap" });
const notoDeva = Noto_Sans_Devanagari({ subsets: ["devanagari"], variable: "--font-noto-deva", display: "swap" });

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  const t = getDictionary(hasLocale(lang) ? lang : "hi");
  return { title: { default: t.appName, template: `%s · ${t.appName}` }, description: t.tagline, manifest: "/manifest.webmanifest" };
}

export const viewport: Viewport = {
  themeColor: "#c2410c",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = getDictionary(lang);
  return (
    <html lang={lang} className={`${noto.variable} ${notoDeva.variable} antialiased`}>
      <body className="min-h-dvh flex flex-col font-sans">
        <Header lang={lang} t={t} />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-4">{children}</main>
        <footer className="mx-auto w-full max-w-3xl px-4 pb-8 text-sm text-muted">{t.footer}</footer>
      </body>
    </html>
  );
}
