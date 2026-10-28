import "server-only";
import fs from "node:fs";
import path from "node:path";
import MiniSearch from "minisearch";
import type { Scheme } from "./types";
import { expandQuery } from "./synonyms";

let cache: { list: Scheme[]; bySlug: Map<string, Scheme>; index: MiniSearch<Scheme> } | null = null;

function load() {
  if (cache) return cache;
  const file = path.join(process.cwd(), "data", "schemes.json");
  const list = JSON.parse(fs.readFileSync(file, "utf8")) as Scheme[];
  const index = new MiniSearch<Scheme>({
    idField: "slug",
    fields: ["name", "tagText", "details", "benefits", "eligibility"],
    extractField: (doc, field) =>
      field === "tagText" ? doc.tags.join(" ") : (doc[field as keyof Scheme] as string),
    searchOptions: {
      boost: { name: 5, tagText: 3, eligibility: 1.2 },
      prefix: (term) => term.length > 3,
      fuzzy: (term) => (term.length > 5 ? 0.15 : false),
      combineWith: "OR",
    },
  });
  index.addAll(list);
  cache = { list, bySlug: new Map(list.map((s) => [s.slug, s])), index };
  return cache;
}

export function allSchemes() {
  return load().list;
}

export function getScheme(slug: string) {
  return load().bySlug.get(slug);
}

export function searchSchemes(query: string, opts: { state?: string; limit?: number } = {}) {
  const { index, bySlug } = load();
  const q = expandQuery(query);
  if (!q.trim()) return [];
  // Nationally applicable and hand-reviewed schemes are what most people are asking about.
  const hits = index.search(q, {
    boostDocument: (id) => {
      const s = bySlug.get(String(id));
      return (s?.level === "central" ? 1.6 : 1) * (s?.reviewed ? 2 : 1);
    },
  });
  const out: Scheme[] = [];
  for (const hit of hits) {
    const s = bySlug.get(String(hit.id));
    if (!s) continue;
    // Central schemes apply everywhere; state schemes only in that state.
    if (opts.state && s.state && s.state !== opts.state) continue;
    out.push(s);
    if (out.length >= (opts.limit ?? 20)) break;
  }
  return out;
}

export function states() {
  return [...new Set(allSchemes().map((s) => s.state).filter(Boolean) as string[])].sort();
}
