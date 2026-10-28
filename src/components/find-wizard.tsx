"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { CATEGORIES, GENDERS, MARITAL, OCCUPATIONS, type MatchStatus, type Profile, type RuleField } from "@/lib/types";

const STORAGE_KEY = "yojana-profile-v1";

type Result = {
  slug: string;
  name: string;
  level: "central" | "state";
  state: string | null;
  tags: string[];
  summary: string;
  status: MatchStatus;
  specificity: number;
  matched: RuleField[];
  unknown: RuleField[];
  reviewed: boolean;
};

type StepId = "state" | "age" | "gender" | "category" | "area" | "occupation" | "income" | "disability" | "extra";
const STEPS: StepId[] = ["state", "age", "gender", "category", "area", "occupation", "income", "disability", "extra"];

const loadProfile = (): Profile | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
};
const saveProfile = (p: Profile | null) => {
  try {
    if (p) localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode: nothing to do */
  }
};

const formatINR = (n: number) => "₹" + n.toLocaleString("en-IN");

export function FindWizard({ lang, t, states }: { lang: Locale; t: Dictionary; states: { value: string; label: string }[] }) {
  const f = t.find;
  const [profile, setProfile] = useState<Profile>({});
  const [step, setStep] = useState(0);
  const [results, setResults] = useState<Result[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  // localStorage only exists in the browser, so restore saved answers after hydration.
  useEffect(() => {
    const saved = loadProfile();
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from browser storage
      setProfile(saved);
      void fetchResults(saved);
    }
  }, []);

  async function fetchResults(p: Profile) {
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch("/api/eligibility", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(p),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { results: Result[] };
      setResults(data.results);
      saveProfile(p);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => setProfile((p) => ({ ...p, [key]: value }));
  const id = STEPS[step];
  const last = step === STEPS.length - 1;
  const next = () => (last ? fetchResults(profile) : setStep((s) => s + 1));
  const skip = () => {
    setProfile((p) => {
      const copy = { ...p };
      if (id !== "extra") delete copy[id as keyof Profile];
      return copy;
    });
    next();
  };

  if (results || loading || failed) {
    return (
      <Results
        lang={lang}
        t={t}
        results={results ?? []}
        loading={loading}
        failed={failed}
        onRetry={() => fetchResults(profile)}
        onEdit={() => {
          setResults(null);
          setFailed(false);
          setStep(0);
        }}
        onReset={() => {
          saveProfile(null);
          setProfile({});
          setResults(null);
          setFailed(false);
          setStep(0);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">{f.title}</h1>
        <p className="text-sm text-muted">
          {f.step} {step + 1} {f.of} {STEPS.length} · {f.savedNote}
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
          <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-xl font-bold">{f.q[id]}</legend>

        {id === "state" && (
          <select
            value={profile.state ?? ""}
            onChange={(e) => set("state", e.target.value || undefined)}
            className="h-14 rounded-xl border-2 border-border bg-surface px-3"
          >
            <option value="">—</option>
            {states.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        )}

        {id === "age" && (
          <NumberInput value={profile.age} placeholder={f.agePlaceholder} max={120} onChange={(v) => set("age", v)} />
        )}

        {id === "gender" && (
          <Choices options={GENDERS} labels={t.options.gender} value={profile.gender} onChange={(v) => set("gender", v)} />
        )}

        {id === "category" && (
          <Choices options={CATEGORIES} labels={t.options.category} value={profile.category} onChange={(v) => set("category", v)} />
        )}

        {id === "area" && (
          <Choices options={["rural", "urban"] as const} labels={t.options.area} value={profile.area} onChange={(v) => set("area", v)} />
        )}

        {id === "occupation" && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {OCCUPATIONS.map((o) => {
              const on = profile.occupation?.includes(o) ?? false;
              return (
                <button
                  key={o}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    set(
                      "occupation",
                      on ? profile.occupation?.filter((x) => x !== o) : [...(profile.occupation ?? []), o],
                    )
                  }
                  className={choiceClass(on)}
                >
                  {on ? "✓ " : ""}
                  {t.options.occupation[o]}
                </button>
              );
            })}
          </div>
        )}

        {id === "income" && (
          <>
            <NumberInput value={profile.income} placeholder={f.incomePlaceholder} max={100000000} onChange={(v) => set("income", v)} />
            <div className="flex flex-wrap gap-2">
              {[50000, 100000, 200000, 300000, 500000, 800000].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => set("income", n)}
                  className={`rounded-full border-2 px-3 py-1.5 ${profile.income === n ? "border-brand bg-brand-soft" : "border-border"}`}
                >
                  {formatINR(n)}
                </button>
              ))}
            </div>
          </>
        )}

        {id === "disability" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={choiceClass(profile.disability === 0)} onClick={() => set("disability", 0)}>
                {f.no}
              </button>
              <button
                type="button"
                className={choiceClass((profile.disability ?? 0) > 0)}
                onClick={() => set("disability", profile.disability || 40)}
              >
                {f.yes}
              </button>
            </div>
            {(profile.disability ?? 0) > 0 && (
              <label className="flex flex-col gap-1">
                <span className="text-muted">{f.disabilityPercent}</span>
                <NumberInput value={profile.disability} placeholder="40" max={100} onChange={(v) => set("disability", v ?? 40)} />
              </label>
            )}
          </>
        )}

        {id === "extra" && (
          <div className="flex flex-col gap-4">
            {(["bpl", "incomeTaxPayer", "govtEmployee", "hasPuccaHouse", "minority", "pregnant"] as const)
              .filter((k) => k !== "pregnant" || profile.gender === "female")
              .map((k) => (
              <div key={k} className="flex flex-col gap-2">
                <span>{t.options.extra[k]}</span>
                <div className="grid grid-cols-2 gap-2">
                  {[true, false].map((v) => (
                    <button key={String(v)} type="button" className={choiceClass(profile[k] === v)} onClick={() => set(k, profile[k] === v ? undefined : v)}>
                      {v ? f.yes : f.no}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex flex-col gap-2">
              <span>{t.options.extra.maritalStatus}</span>
              <Choices options={MARITAL} labels={t.options.maritalStatus} value={profile.maritalStatus} onChange={(v) => set("maritalStatus", v)} />
            </div>
          </div>
        )}
      </fieldset>

      <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur">
        <button type="button" disabled={step === 0} onClick={() => setStep((s) => s - 1)} className="h-14 rounded-xl border-2 border-border px-4 font-semibold disabled:opacity-40">
          {f.back}
        </button>
        {!last && (
          <button type="button" onClick={skip} className="h-14 rounded-xl px-3 text-muted underline">
            {f.skip}
          </button>
        )}
        <button type="button" onClick={next} className="ml-auto h-14 rounded-xl bg-brand px-6 font-bold text-brand-ink">
          {last ? f.seeResults : f.next}
        </button>
      </div>
    </div>
  );
}

const choiceClass = (on: boolean) =>
  `min-h-14 rounded-xl border-2 px-4 py-3 text-left text-lg font-medium transition-colors ${
    on ? "border-brand bg-brand-soft" : "border-border bg-surface active:bg-surface-2"
  }`;

function Choices<T extends string>({
  options,
  labels,
  value,
  onChange,
}: {
  options: readonly T[];
  labels: Record<T, string>;
  value?: T;
  onChange: (v: T | undefined) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {options.map((o) => (
        <button key={o} type="button" aria-pressed={value === o} onClick={() => onChange(value === o ? undefined : o)} className={choiceClass(value === o)}>
          {labels[o]}
        </button>
      ))}
    </div>
  );
}

function NumberInput({ value, placeholder, max, onChange }: { value?: number; placeholder: string; max: number; onChange: (v: number | undefined) => void }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => {
        const digits = e.target.value.replace(/[^\d]/g, "");
        onChange(digits ? Math.min(Number(digits), max) : undefined);
      }}
      className="h-14 rounded-xl border-2 border-border bg-surface px-4 text-xl outline-none focus:border-brand"
    />
  );
}

function Results({
  lang,
  t,
  results,
  loading,
  failed,
  onRetry,
  onEdit,
  onReset,
}: {
  lang: Locale;
  t: Dictionary;
  results: Result[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  onEdit: () => void;
  onReset: () => void;
}) {
  const f = t.find;
  const [filter, setFilter] = useState("");
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return results;
    return results.filter((r) => `${r.name} ${r.tags.join(" ")} ${r.summary}`.toLowerCase().includes(q));
  }, [results, filter]);

  const groups = [
    { key: "eligible", title: f.eligible, items: filtered.filter((r) => r.status === "eligible" && r.specificity > 0), tone: "green" },
    { key: "maybe", title: f.maybe, items: filtered.filter((r) => r.status === "maybe"), tone: "amber" },
    { key: "general", title: f.general, items: filtered.filter((r) => r.status === "eligible" && r.specificity === 0), tone: "muted" },
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-bold">{f.results}</h1>
        <button type="button" onClick={onEdit} className="rounded-xl border-2 border-border px-3 py-2 font-semibold">
          {f.edit}
        </button>
        <button type="button" onClick={onReset} className="rounded-xl px-3 py-2 text-muted underline">
          {f.startOver}
        </button>
      </div>

      {loading && <p className="text-muted">…</p>}
      {failed && (
        <p className="text-danger">
          {t.chat.error}{" "}
          <button type="button" onClick={onRetry} className="font-semibold underline">
            {t.chat.retry}
          </button>
        </p>
      )}

      {!loading && !failed && (
        <>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={f.filter}
            aria-label={f.filter}
            className="h-12 rounded-xl border-2 border-border bg-surface px-4 outline-none focus:border-brand"
          />
          {filtered.length === 0 && <p className="text-muted">{f.noneFound}</p>}
          {groups.map((g) => (g.items.length ? <Group key={g.key} lang={lang} t={t} title={g.title} tone={g.tone} items={g.items} /> : null))}
        </>
      )}
    </div>
  );
}

function Group({ lang, t, title, tone, items }: { lang: Locale; t: Dictionary; title: string; tone: "green" | "amber" | "muted"; items: Result[] }) {
  const [shown, setShown] = useState(15);
  const badge = { green: "bg-green-soft text-green", amber: "bg-amber-soft text-amber", muted: "bg-surface-2 text-muted" }[tone];
  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center gap-2 text-xl font-bold">
        {title}
        <span className={`rounded-full px-2.5 py-0.5 text-sm ${badge}`}>
          {items.length} {t.find.count}
        </span>
      </h2>
      <ul className="flex flex-col gap-2">
        {items.slice(0, shown).map((r) => (
          <li key={r.slug}>
            <Link href={`/${lang}/schemes/${r.slug}`} className="hover-lift block rounded-2xl border border-border bg-surface p-4">
              <span className="block text-lg font-bold leading-snug">{r.name}</span>
              <span className="mt-0.5 block text-sm text-muted">{r.state ?? t.scheme.central}</span>
              {r.summary && <span className="mt-1.5 block text-base text-pretty">{r.summary}</span>}
              {(r.matched.length > 0 || r.unknown.length > 0) && (
                <span className="mt-2 flex flex-wrap gap-1.5 text-sm">
                  {r.matched
                    .filter((m) => m !== "state")
                    .map((m) => (
                      <span key={m} className="rounded-full bg-green-soft px-2 py-0.5 text-green">
                        ✓ {t.fields[m]}
                      </span>
                    ))}
                  {r.unknown.map((m) => (
                    <span key={m} className="rounded-full bg-amber-soft px-2 py-0.5 text-amber">
                      ? {t.fields[m]}
                    </span>
                  ))}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
      {items.length > shown && (
        <button type="button" onClick={() => setShown((s) => s + 30)} className="rounded-xl border-2 border-border py-3 font-semibold">
          {t.find.showMore} ({items.length - shown})
        </button>
      )}
    </section>
  );
}
