# Yojana Sahayak — Implementation Plan

A voice-first web app that helps rural citizens (1) ask questions about government schemes (Sarkari Yojanas) in Hindi, English or Hinglish, and (2) find every scheme they're eligible for from their profile (age, gender, category, income, state, occupation, disability, and so on).

---

## 1. What the app does

| Feature | Description |
|---|---|
| **Ask Yojana Mitra (AI agent)** | Chat with text or voice. Example questions: "PM Kisan ka paisa kab aata hai?", "Ayushman card kaise banega?" Answers come back in the user's language and can be read aloud. Every answer links to the official source. |
| **Eligibility Finder** | A short form (or a voice conversation) collects the profile, and the app lists the schemes the person qualifies for, each with the reason, benefits, required documents and how to apply. |
| **Scheme pages** | One simple page per scheme: benefits, eligibility, documents, application steps, official link, helpline. Available in Hindi and English. |
| **Language toggle** | The whole UI works in Hindi and English. More languages (Marathi, Bengali, Tamil and others) can be added later through the same pipeline. |

---

## 2. Data sources: where the scheme data comes from

**There is no official, openly documented public API for "all government schemes" today.** Here are the realistic options, from most to least preferred:

| # | Source | What it gives | Notes |
|---|---|---|---|
| 1 | **myScheme.gov.in** (MeitY / NeGD) | 3,000+ central and state schemes with structured eligibility, benefits, documents and application process, in English and Hindi | The best source. The website runs on an internal JSON API (`api.myscheme.gov.in/search/v6/schemes`, which needs an `x-api-key`). It is **undocumented and not licensed for public use**, so don't build production on it without permission. **Action:** email NeGD/myScheme to request official data access or a partnership. As a govt-tech/rural-development project you have a reasonable chance. Also check **API Setu** (apisetu.gov.in), the government's official API exchange. |
| 2 | **Hugging Face dataset `Navraj025/gov_myscheme`** | A community extract of myScheme in CSV/JSON/Parquet | Useful as **seed data for prototyping**. It may be outdated or contain errors, so verify against official pages before launch. |
| 3 | **data.gov.in (OGD Platform)** | Official open datasets with a free API key, under the Government Open Data License – India | It doesn't have one clean "all schemes" dataset, but it does have scheme-wise beneficiary, budget and district data. Good for extras like "how many people in your district got PM-KISAN". |
| 4 | **Ministry and state portals** (pmkisan.gov.in, pmjay.gov.in, nsp.gov.in, state welfare department sites) | The authoritative details for each scheme | Use these to verify facts and to fill gaps for state schemes. |
| 5 | **Manual curation** | The top ~100 high-impact rural schemes, hand-verified | **Do this regardless.** Accuracy matters more than coverage for this audience. |

### Recommended data strategy
1. Prototype with the HF dataset plus around 100 manually verified top schemes (PM-KISAN, PMAY-G, Ayushman Bharat, Ujjwala, MGNREGA, PM-SYM, Sukanya Samriddhi, NSP scholarships, Atal Pension, PMJJBY/PMSBY, widow and old-age pensions, and the major state schemes).
2. Apply for official myScheme or API Setu access in parallel.
3. Build an **ingestion pipeline** that normalises every source into **your own database**. The app never calls third-party scheme APIs at request time.
4. Use an LLM to convert free-text eligibility ("Applicant must be a woman aged 18–60 belonging to BPL family…") into **structured JSON rules**, with **human review** before publishing.
5. Re-sync weekly with a cron job and flag changed schemes for review.

---

## 3. Architecture

```
┌──────────────────────── Browser (PWA, Hindi/English) ────────────────────────┐
│  Mic button → record audio (MediaRecorder)     Eligibility form / voice form │
│  Chat UI (streaming)   ← TTS audio playback    Scheme list & detail pages    │
└───────────────┬───────────────────────────────────────────┬──────────────────┘
                │ audio / text                              │ profile JSON
┌───────────────▼───────────────────────────────────────────▼──────────────────┐
│                     Next.js (App Router) on Vercel                           │
│  /api/stt   → Bhashini ASR (fallback: Sarvam / Google STT)                   │
│  /api/chat  → LLM agent (AI SDK) with tools:                                 │
│                 • searchSchemes(query, filters)   (hybrid vector + keyword)  │
│                 • getSchemeDetails(id)                                       │
│                 • checkEligibility(profile)       (deterministic engine)     │
│  /api/tts   → Bhashini TTS (fallback: browser speechSynthesis)               │
│  /api/eligibility → Rules engine (pure code, no LLM)                         │
└───────────────┬──────────────────────────────────────────────────────────────┘
                │
┌───────────────▼──────────────┐   ┌───────────────────────────────────────────┐
│ Postgres (Neon) + pgvector   │◄──│ Ingestion worker (cron, weekly)           │
│ schemes, rules, embeddings,  │   │ myScheme/HF/data.gov.in → normalise →     │
│ translations, sources        │   │ LLM rule extraction → human review queue  │
└──────────────────────────────┘   └───────────────────────────────────────────┘
```

### Tech stack
| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 16 (App Router), Tailwind, shadcn/ui, **PWA** | Fast, installable on Android, works on weak networks |
| i18n | `next-intl` (`/hi`, `/en` routes) | Locale routing plus message files |
| Backend | Next.js route handlers on Vercel (Node runtime) | One deployable unit |
| Database | Postgres (Neon via Vercel Marketplace) + **pgvector** | Structured rules and semantic search in one DB |
| ORM | Drizzle | Typed and lightweight |
| LLM | Claude (Sonnet for chat, Haiku for cheap tasks such as rule extraction and query rewriting) via AI SDK / AI Gateway | Strong multilingual reasoning, tool calling and Hindi quality |
| Embeddings | A multilingual embedding model (for example Cohere multilingual or OpenAI `text-embedding-3-small`) | Hindi and Hinglish queries must match English scheme text |
| Speech-to-text | **Bhashini ASR** (primary), with **Sarvam AI "Saarika"** or Google Cloud STT as fallback | Bhashini is the Government of India's language stack: Indian accents, 22 languages, free for registered developers. Sarvam handles Hinglish code-mixing well. |
| Text-to-speech | Bhashini TTS, with browser `speechSynthesis` as fallback | Low-literacy users need answers read aloud |
| Hosting | Vercel | Simple deploys, cron, env management |

---

## 4. Eligibility engine (the most important design decision)

**Eligibility must be decided by deterministic code, not by the LLM.** An LLM can hallucinate "yes, you're eligible", which wastes a poor family's time and money. The LLM only *explains* results that the engine computed.

### User profile (input)
```ts
type Profile = {
  age: number;
  gender: 'male' | 'female' | 'transgender';
  category: 'GEN' | 'OBC' | 'SC' | 'ST' | 'EWS';
  isPwD: boolean; disabilityPercent?: number;
  isMinority?: boolean;
  annualFamilyIncome: number;             // ₹
  state: string; district?: string;
  area: 'rural' | 'urban';
  occupation: 'farmer' | 'agri_labourer' | 'student' | 'unorganised_worker' |
              'self_employed' | 'unemployed' | 'govt_employee' | 'other';
  landHoldingAcres?: number;
  isBPL?: boolean; rationCardType?: 'AAY' | 'PHH' | 'NONE';
  maritalStatus?: 'single' | 'married' | 'widowed' | 'divorced';
  educationLevel?: string; isStudent?: boolean;
  hasPuccaHouse?: boolean; payIncomeTax?: boolean;
};
```

### Rule format (stored per scheme as JSON)
```json
{
  "all": [
    { "field": "age", "op": "between", "value": [18, 40] },
    { "field": "occupation", "op": "in", "value": ["unorganised_worker", "agri_labourer"] },
    { "field": "annualFamilyIncome", "op": "lte", "value": 180000 },
    { "field": "payIncomeTax", "op": "eq", "value": false }
  ],
  "any": [],
  "states": ["ALL"]
}
```

### Output for each scheme
- ✅ **Eligible**: every rule passed
- 🟡 **Possibly eligible**: no rule failed, but some fields are missing ("Tell us your land holding to confirm")
- ❌ **Not eligible**: hidden by default, with the reason shown on tap

Results are sorted by benefit value and relevance, so pension, health, housing and income-support schemes come first.

---

## 5. AI agent design

- **System prompt:** "You are Yojana Mitra. Answer only about Indian government schemes. Reply in the user's language and script (Hindi in Devanagari, English, or Hinglish in Roman script). Use simple words a person with 5th-standard education understands. Always cite the official link. Never ask for Aadhaar number, bank details or OTP. If unsure, say so and give the helpline."
- **Tools:**
  - `searchSchemes`: hybrid search (pgvector plus Postgres full-text) over scheme content in both languages
  - `getSchemeDetails`: the full record for a scheme
  - `checkEligibility`: calls the deterministic engine. If the user mentioned profile details in chat ("main 45 saal ka kisan hoon, UP se"), the agent extracts them and calls this tool.
- **Grounding:** the agent answers only from retrieved scheme data. With no match, it says "mujhe pakka nahi pata" and points to the helpline or myScheme.
- **Safety:** an anti-fraud message ("Government schemes never charge a fee to apply. Don't pay agents."), no collection of personal identifiers, and reporting links for scam calls.
- **Memory:** profile kept in local storage (with consent), so returning users don't refill the form.

---

## 6. Voice pipeline

1. User taps a big mic button. `MediaRecorder` captures audio (opus/webm, 16 kHz mono).
2. `POST /api/stt` sends it to Bhashini ASR with language auto-detect, or with the UI language as a hint. On failure or timeout it falls back to Sarvam or Google.
3. The transcript appears in the input box so the user can confirm or edit it, then it goes to `/api/chat`.
4. The answer streams as text, then `/api/tts` turns it into audio that auto-plays (with a toggle to turn this off).
5. **Hinglish handling:** STT may return mixed-script text, so the LLM is told to understand code-mixed input and reply in the same style.
6. **Quick fallback:** the browser Web Speech API (`hi-IN` / `en-IN`) works in Chrome on Android at zero cost and is good enough for the MVP demo.

---

## 7. Database schema (core tables)

```
schemes(id, slug, level: central|state, state_code, ministry, category_tags[],
        official_url, helpline, last_verified_at, status: draft|published)
scheme_translations(scheme_id, lang, name, summary, benefits_md,
                    eligibility_md, documents_md, how_to_apply_md)
scheme_rules(scheme_id, rules_json, rule_version, reviewed_by, reviewed_at)
scheme_chunks(id, scheme_id, lang, content, embedding vector(1024))
sources(scheme_id, source: myscheme|hf|ogd|manual, source_ref, fetched_at, raw_json)
feedback(id, scheme_id?, message_id?, rating, comment, created_at)   -- "was this correct?"
```

---

## 8. UX for rural users

- **Voice-first**: a large mic button on every screen, and text and icons on every button.
- **Profile form as a wizard**: one question per screen with icon cards (for example a 👨‍🌾 Farmer card), a number pad for age and income, and income ranges instead of exact values.
- **Low bandwidth**: PWA with offline cache of scheme pages, compressed audio, lightweight pages (under 200 KB first load), no heavy images.
- **Readable**: 18px+ font, high contrast, simple Hindi (not bureaucratic Hindi).
- **Shareable**: a "Share on WhatsApp" button on each scheme, since that's how information spreads in villages.
- **Assisted mode**: a CSC operator or NGO volunteer can fill the profile for someone else.

---

## 9. Phased roadmap

| Phase | Duration | Deliverables |
|---|---|---|
| **0. Setup** | Week 1 | Next.js app, Neon DB, i18n scaffold, deploy to Vercel. Register for Bhashini, data.gov.in key and Anthropic key. Email myScheme/NeGD for data access. |
| **1. Data** | Weeks 1–3 | Ingest the HF myScheme dataset. LLM rule extraction with a review UI (admin page). Hand-verify the top 100 schemes in Hindi and English. Embeddings. |
| **2. Eligibility Finder** | Weeks 3–4 | Wizard form, rules engine with unit tests per scheme, results page, scheme detail pages. |
| **3. AI chat** | Weeks 4–6 | Chat UI, agent with 3 tools, grounding and citations, Hindi/English/Hinglish replies, evaluation set of 200 real questions. |
| **4. Voice** | Weeks 6–7 | Mic, Bhashini STT and TTS with fallbacks, audio playback. |
| **5. Pilot** | Weeks 8–10 | Field test in 2–3 villages with an NGO or CSC partner, collect feedback, fix wrong answers, measure accuracy. |
| **6. Scale** | Later | More languages, WhatsApp bot (same agent, WhatsApp Business API), state-specific schemes, application status tracking, document checklist reminders. |

---

## 10. Quality, legal and privacy

- **Accuracy evals:** a gold set of questions and profiles with expected answers, run on every change. Track the "wrong eligibility" rate, which should be close to 0%.
- **"Last verified on" date** on every scheme page, plus the disclaimer "Final eligibility is decided by the department."
- **DPDP Act 2023 compliance:** collect the minimum data, get consent for any saved profile, offer anonymous use by default, never store voice recordings after transcription, and provide a delete-my-data option.
- **Data licensing:** follow the myScheme terms of use and the Government Open Data License – India for data.gov.in. Attribute sources.
- **Cost control:** cache frequent Q&A, use Haiku for cheap steps, rate-limit per device.

---

## 11. Rough monthly cost (MVP, about 10k users)

| Item | Estimate |
|---|---|
| Vercel Pro | about $20 |
| Neon Postgres | $0–19 |
| LLM (Claude, with caching) | about $50–150 |
| Bhashini STT/TTS | Free (government) |
| Fallback STT | about $0–30 |
| **Total** | **about $70–220/month** |

---

## 12. Immediate next steps
1. Register on **bhashini.gov.in** (ULCA) for ASR/TTS API keys.
2. Get a **data.gov.in** API key.
3. Email **myScheme / NeGD** (and check **API Setu**) asking for official scheme data access, explaining that this is a rural-development project.
4. Download the HF `gov_myscheme` dataset to prototype.
5. Scaffold the Next.js app and build the Eligibility Finder first, because it needs no AI and gives immediate value.
