import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { findSchemes, summarize } from "@/lib/eligibility";
import { hasLocale, type Locale } from "@/lib/i18n";
import { profileSchema } from "@/lib/profile-schema";
import { allSchemes, getScheme, searchSchemes, states } from "@/lib/schemes";

export const maxDuration = 60;

const MODEL = process.env.CHAT_MODEL ?? "anthropic/claude-sonnet-5.5";
const hasModel = () => Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);

function systemPrompt(lang: Locale) {
  return `You are "Yojana Mitra", a friendly helper for people in rural India who want to understand Indian government schemes (Sarkari Yojana).

Language:
- Reply in the same language and script the user writes in: Hindi (Devanagari), English, or Hinglish (Roman script). If unclear, use ${lang === "hi" ? "simple Hindi in Devanagari" : "simple English"}.
- Use very simple words, short sentences and bullet points, as if explaining to someone with 5th-standard schooling. Avoid bureaucratic Hindi.
- Answers may be read aloud, so keep them short (under ~180 words) unless the user asks for detail.

Grounding:
- ALWAYS use the tools before answering about a scheme. The scheme database is in English, so search with English keywords (translate Hindi words: kisan -> farmer, pension, chhatravritti -> scholarship, etc.).
- Only state facts found in tool results. If the database does not have it, say you are not sure and suggest the official website, the nearest CSC (Common Service Centre) or the scheme helpline.
- Eligibility must come from the checkEligibility tool, never from your own guess. If the user tells you about themselves (age, state, caste category, income, work, etc.), call checkEligibility with what you know and ask for the 1–2 most important missing details.
- When you mention a scheme, link to it as a markdown link using the "url" from the tool result, e.g. [PM-KISAN](/${lang}/schemes/pm-kisan).
- Data is from myScheme.gov.in (2024), so amounts and dates may have changed; say "please confirm on the official site" for money amounts and deadlines.

Safety:
- Never ask for Aadhaar number, bank account number, OTP, PIN or passwords.
- Remind users that applying to government schemes is free and to beware of agents asking for money.
- Stay on topic: government schemes, documents, applications and related welfare questions.

Valid state names for tools: ${states().join(", ")}.`;
}

function tools(lang: Locale) {
  const url = (slug: string) => `/${lang}/schemes/${slug}`;
  return {
    searchSchemes: tool({
      description: "Search the government scheme database by keywords. Use English keywords.",
      inputSchema: z.object({
        query: z.string().describe("English keywords, e.g. 'farmer income support' or 'widow pension'"),
        state: z.string().optional().describe("Limit state schemes to this state; central schemes are always included"),
      }),
      execute: async ({ query, state }) =>
        searchSchemes(query, { state, limit: 8 }).map((s) => ({
          slug: s.slug,
          name: s.name,
          level: s.level,
          state: s.state,
          tags: s.tags.slice(0, 5),
          summary: summarize(s.details || s.benefits, 300),
          url: url(s.slug),
        })),
    }),
    getSchemeDetails: tool({
      description: "Get full details of one scheme: benefits, eligibility, documents, how to apply, FAQ.",
      inputSchema: z.object({ slug: z.string() }),
      execute: async ({ slug }) => {
        const s = getScheme(slug);
        if (!s) return { error: "not found" };
        const cut = (t: string) => summarize(t, 1800);
        return {
          name: s.name,
          level: s.level,
          state: s.state,
          ministry: s.ministry,
          details: cut(s.details),
          benefits: cut(s.benefits),
          eligibility: cut(s.eligibility),
          exclusions: cut(s.exclusions),
          applicationProcess: cut(s.applicationProcess),
          documents: cut(s.documents),
          faq: cut(s.faq),
          officialLinks: s.sources.slice(0, 4),
          url: url(s.slug),
          myschemeUrl: s.officialUrl,
        };
      },
    }),
    checkEligibility: tool({
      description:
        "Deterministically find schemes a person is eligible for from their profile. Pass only fields the user actually told you.",
      inputSchema: profileSchema,
      execute: async (profile) => {
        const results = findSchemes(allSchemes(), profile);
        const pick = (r: (typeof results)[number]) => ({
          name: r.name,
          url: url(r.slug),
          state: r.state,
          summary: r.summary,
          matchedOn: r.matched.map((m) => m.field),
          stillToCheck: r.unknown,
        });
        const eligible = results.filter((r) => r.status === "eligible" && r.specificity > 0);
        const maybe = results.filter((r) => r.status === "maybe");
        return {
          eligibleCount: eligible.length,
          maybeCount: maybe.length,
          topEligible: eligible.slice(0, 10).map(pick),
          topMaybe: maybe.slice(0, 5).map(pick),
          fullListUrl: `/${lang}/find`,
        };
      },
    }),
  };
}

function lastUserText(messages: UIMessage[]) {
  const last = [...messages].reverse().find((m) => m.role === "user");
  return last?.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ") ?? "";
}

/** Without an AI key the assistant still answers with keyword search results. */
function fallbackResponse(messages: UIMessage[], lang: Locale) {
  const q = lastUserText(messages);
  const hits = searchSchemes(q, { limit: 5 });
  const intro =
    lang === "hi"
      ? "AI सहायक अभी चालू नहीं है। आपके सवाल से मिलती योजनाएँ:"
      : "The AI assistant is not configured yet. Schemes matching your question:";
  const body = hits.length
    ? hits.map((s) => `- [${s.name}](/${lang}/schemes/${s.slug}) — ${summarize(s.details || s.benefits, 160)}`).join("\n")
    : lang === "hi"
      ? "- कोई योजना नहीं मिली। दूसरे शब्दों में पूछें।"
      : "- No schemes found. Try other words.";
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({ type: "start" });
      writer.write({ type: "text-start", id: "t" });
      writer.write({ type: "text-delta", id: "t", delta: `${intro}\n\n${body}` });
      writer.write({ type: "text-end", id: "t" });
      writer.write({ type: "finish" });
    },
  });
  return createUIMessageStreamResponse({ stream });
}

export async function POST(req: Request) {
  const { messages, lang: rawLang }: { messages: UIMessage[]; lang?: string } = await req.json();
  const lang: Locale = rawLang && hasLocale(rawLang) ? rawLang : "hi";
  // Keep the context small and cheap: the last 12 messages are plenty for this use case.
  const recent = messages.slice(-12);

  if (!hasModel()) return fallbackResponse(recent, lang);

  const result = streamText({
    model: MODEL,
    system: systemPrompt(lang),
    messages: await convertToModelMessages(recent),
    tools: tools(lang),
    stopWhen: isStepCount(6),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
