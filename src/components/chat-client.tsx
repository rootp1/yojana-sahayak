"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Dictionary, Locale } from "@/lib/i18n";
import { MicButton, SpeakButton } from "./voice";

const TOOL_ICONS: Record<string, string> = {
  "tool-searchSchemes": "🔍",
  "tool-checkEligibility": "✅",
  "tool-getSchemeDetails": "📄",
};

export function ChatClient({ lang, t, initialQuestion }: { lang: Locale; t: Dictionary["chat"]; initialQuestion?: string }) {
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat", body: { lang } }), [lang]);
  const { messages, sendMessage, status, error, regenerate } = useChat({ transport });
  const [input, setInput] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sentInitial = useRef(false);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (initialQuestion && !sentInitial.current) {
      sentInitial.current = true;
      void sendMessage({ text: initialQuestion });
    }
  }, [initialQuestion, sendMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setNotice(null);
    void sendMessage({ text: q });
  }

  const toolLabel: Record<string, string> = {
    "tool-searchSchemes": t.searchedFor,
    "tool-checkEligibility": t.checked,
    "tool-getSchemeDetails": t.opened,
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t.title}</h1>

      {messages.length === 0 && (
        <div className="flex flex-col gap-2">
          {t.suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className="hover-lift rounded-xl border border-border bg-surface px-4 py-3 text-left active:bg-surface-2"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <ol className="flex flex-col gap-3" aria-live="polite">
        {messages.map((m, idx) => {
          const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
          const isLast = idx === messages.length - 1;
          if (m.role === "user") {
            return (
              <li key={m.id} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-brand-ink">
                {text}
              </li>
            );
          }
          return (
            <li key={m.id} className="mr-auto w-full max-w-[95%] rounded-2xl rounded-bl-md border border-border bg-surface px-4 py-3">
              <div className="mb-1 flex flex-wrap gap-1.5">
                {m.parts
                  .filter((p) => p.type in TOOL_ICONS)
                  .map((p, i) => {
                    const input = (p as { input?: { query?: string } }).input;
                    return (
                      <span key={i} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-muted">
                        {TOOL_ICONS[p.type]} {toolLabel[p.type]}
                        {input?.query ? `: ${input.query}` : ""}
                      </span>
                    );
                  })}
              </div>
              <div className="prose-chat">
                <ReactMarkdown
                  components={{
                    a: ({ href = "", children }) =>
                      href.startsWith("/") ? (
                        <Link href={href}>{children}</Link>
                      ) : (
                        <a href={href} target="_blank" rel="noopener noreferrer">
                          {children}
                        </a>
                      ),
                  }}
                >
                  {text}
                </ReactMarkdown>
              </div>
              {text && !(isLast && busy) && (
                <div className="mt-2">
                  <SpeakButton text={text} labels={{ listen: t.listen, stop: t.stopListen }} />
                </div>
              )}
            </li>
          );
        })}
        {status === "submitted" && (
          <li className="mr-auto rounded-2xl border border-border bg-surface px-4 py-3 text-muted">{t.thinking}</li>
        )}
      </ol>

      {error && (
        <div className="rounded-xl border border-danger/40 p-3 text-danger">
          {t.error}{" "}
          <button type="button" className="font-semibold underline" onClick={() => regenerate()}>
            {t.retry}
          </button>
        </div>
      )}

      <p className="text-sm text-muted">{t.disclaimer}</p>
      <div ref={bottomRef} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur"
      >
        {notice && <p className="mx-auto mb-2 max-w-3xl text-sm text-danger">{notice}</p>}
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <MicButton
            lang={lang}
            labels={{ start: t.micStart, stop: t.micStop, listening: t.listening }}
            onInterim={setInput}
            onFinal={(text) => send(text)}
            onUnsupported={() => setNotice(t.noVoice)}
          />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.placeholder}
            aria-label={t.placeholder}
            enterKeyHint="send"
            className="h-14 min-w-0 flex-1 rounded-full border border-border bg-bg px-4 outline-none focus:border-brand"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="h-14 shrink-0 rounded-full bg-brand px-5 font-semibold text-brand-ink disabled:opacity-50"
          >
            {t.send}
          </button>
        </div>
      </form>
    </div>
  );
}
