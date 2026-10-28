import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChatClient } from "@/components/chat-client";
import { getDictionary, hasLocale } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/chat">): Promise<Metadata> {
  const { lang } = await params;
  return { title: getDictionary(hasLocale(lang) ? lang : "hi").chat.title };
}

export default async function ChatPage({ params, searchParams }: PageProps<"/[lang]/chat">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const { q } = await searchParams;
  const t = getDictionary(lang);
  return <ChatClient lang={lang} t={t.chat} initialQuestion={typeof q === "string" ? q.slice(0, 500) : undefined} />;
}
