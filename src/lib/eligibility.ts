import type { MatchResult, Profile, Rule, RuleField, Scheme } from "./types";

type Outcome = "pass" | "fail" | "unknown";

/**
 * Deterministic eligibility check. The LLM never decides eligibility; it only
 * explains what this function returns.
 */
export function evaluateRule(rule: Rule, profile: Profile): Outcome {
  const v = profile[rule.field as keyof Profile];
  if (v === undefined || v === null || (Array.isArray(v) && v.length === 0)) {
    return "unknown";
  }
  switch (rule.op) {
    case "gte":
      return Number(v) >= Number(rule.value) ? "pass" : "fail";
    case "lte":
      return Number(v) <= Number(rule.value) ? "pass" : "fail";
    case "eq":
      return v === rule.value ? "pass" : "fail";
    case "in": {
      const allowed = (rule.value as string[]).map((x) => x.toLowerCase());
      const have = (Array.isArray(v) ? v : [v]).map((x) => String(x).toLowerCase());
      return have.some((x) => allowed.includes(x)) ? "pass" : "fail";
    }
  }
}

export function matchScheme(scheme: Scheme, profile: Profile): MatchResult {
  const matched: Rule[] = [];
  const failed: Rule[] = [];
  const unknown = new Set<RuleField>();
  for (const rule of scheme.rules) {
    const outcome = evaluateRule(rule, profile);
    if (outcome === "pass") matched.push(rule);
    else if (outcome === "fail") failed.push(rule);
    else unknown.add(rule.field);
  }
  const status = failed.length ? "ineligible" : unknown.size ? "maybe" : "eligible";
  return {
    slug: scheme.slug,
    name: scheme.name,
    level: scheme.level,
    state: scheme.state,
    tags: scheme.tags.slice(0, 4),
    summary: summarize(scheme.benefits || scheme.details),
    status,
    specificity: matched.filter((r) => r.field !== "state").length,
    matched,
    failed,
    unknown: [...unknown],
    reviewed: Boolean(scheme.reviewed),
  };
}

const STATUS_ORDER = { eligible: 0, maybe: 1, ineligible: 2 } as const;

export function findSchemes(schemes: Scheme[], profile: Profile, opts: { includeIneligible?: boolean } = {}) {
  return schemes
    .map((s) => matchScheme(s, profile))
    .filter((r) => opts.includeIneligible || r.status !== "ineligible")
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        Number(b.reviewed) - Number(a.reviewed) ||
        b.specificity - a.specificity ||
        a.unknown.length - b.unknown.length ||
        a.name.localeCompare(b.name),
    );
}

export function summarize(text: string, max = 220) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)) + "…";
}
