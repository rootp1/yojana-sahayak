# Yojana Sahayak · योजना सहायक

A voice-first web app that helps rural citizens understand and find Indian government schemes (Sarkari Yojana) in Hindi, English or Hinglish.

- **Ask (AI agent):** speak or type a question. The agent searches the scheme database, checks eligibility with the rules engine, and answers in the user's language with links to each scheme. Answers can be read aloud.
- **My Schemes (eligibility finder):** a one-question-per-screen form (state, age, gender, category, rural/urban, work, income, disability, BPL, and more). It lists the schemes the person is **eligible** for, **may be eligible** for (some details still unknown), and **open** schemes.
- **All Schemes:** search and browse 2,066 central and state schemes, with a page for each scheme (benefits, eligibility, documents, how to apply, FAQ, official links).
- Hindi and English UI (`/hi`, `/en`), installable as a PWA, large touch targets, and saved answers stay on the device.

## Quick start

```bash
pnpm install
cp .env.example .env.local      # add AI_GATEWAY_API_KEY to turn on the AI agent
pnpm dev                        # http://localhost:3000 → redirects to /hi
pnpm test                       # eligibility engine + search tests
```

The app works without any keys. Chat then falls back to keyword search results, and voice uses the browser's built-in speech recognition.

| Env var | Purpose |
|---|---|
| `AI_GATEWAY_API_KEY` | Turns on the AI agent (Vercel AI Gateway). On Vercel, OIDC works automatically. |
| `CHAT_MODEL` | Optional model override; the default is `anthropic/claude-sonnet-5.5`. |
| `SARVAM_API_KEY` | Optional server speech-to-text (Hindi, English and Hinglish) for browsers without built-in voice typing. |

## Data

Scheme data comes from the Hugging Face dataset [`Navraj025/gov_myscheme`](https://huggingface.co/datasets/Navraj025/gov_myscheme), which holds PDF snapshots of myScheme.gov.in pages from around March 2024. The pipeline is:

```bash
pip install -r scripts/requirements.txt
pnpm data:download   # ~2,150 PDFs → data/raw/ (gitignored)
pnpm data:build      # → data/schemes.json (committed; the app reads this)
```

- `scripts/extract_schemes.py` parses each PDF into sections (details, benefits, eligibility, exclusions, application process, documents, FAQ, sources), fixes encoding problems, and removes duplicates.
- `scripts/eligibility_rules.py` turns the eligibility text into machine-checkable rules (age, income, category, occupation, gender, disability, BPL, widow, minority, rural/urban, pregnancy, state). It's conservative: it only adds a rule when the text clearly restricts who can apply.
- `data/overrides.json` holds **hand-reviewed rules** for 20 high-impact schemes (PM-KISAN, PMAY-G, Ujjwala, APY, PMJJBY, PMSBY, NSAP pensions, PMMVY, MGNREGA, and others). These replace the automatic rules. Add more as you verify them.

**Known gaps:** a few major schemes aren't in the dataset (for example Ayushman Bharat PM-JAY and e-Shram). Amounts and dates are from 2024. Every page tells users to confirm on the official site.

## Architecture

```
src/
  proxy.ts                    / → /hi or /en (cookie, then Accept-Language; Hindi default)
  lib/
    eligibility.ts            deterministic rules engine (the LLM never decides eligibility)
    schemes.ts                loads data/schemes.json, MiniSearch index, search
    synonyms.ts               Hindi/Hinglish → English query expansion + transliteration
    i18n.ts                   Hindi & English dictionaries
  app/
    [lang]/                   home, chat, find (wizard), schemes, schemes/[slug]
    api/chat                  AI SDK agent: searchSchemes, getSchemeDetails, checkEligibility tools
    api/eligibility           POST profile → matching schemes
    api/stt                   optional server speech-to-text (Sarvam)
  components/
    voice.tsx                 mic (Web Speech API, MediaRecorder fallback) + read-aloud (speechSynthesis)
    chat-client.tsx, find-wizard.tsx, header.tsx
```

## Deploy

```bash
vercel link && vercel env add AI_GATEWAY_API_KEY && vercel deploy
```

`next.config.ts` bundles `data/schemes.json` with the server functions.
