import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateRule, findSchemes, matchScheme } from "../src/lib/eligibility";
import { expandQuery } from "../src/lib/synonyms";
import type { Scheme } from "../src/lib/types";

const schemes = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "schemes.json"), "utf8")) as Scheme[];
const bySlug = new Map(schemes.map((s) => [s.slug, s]));
const get = (slug: string) => {
  const s = bySlug.get(slug);
  if (!s) throw new Error(`missing ${slug}`);
  return s;
};

describe("evaluateRule", () => {
  it("treats missing profile fields as unknown, not a failure", () => {
    expect(evaluateRule({ field: "age", op: "gte", value: 18 }, {})).toBe("unknown");
  });
  it("checks numeric bounds", () => {
    expect(evaluateRule({ field: "age", op: "lte", value: 40 }, { age: 40 })).toBe("pass");
    expect(evaluateRule({ field: "age", op: "lte", value: 40 }, { age: 41 })).toBe("fail");
    expect(evaluateRule({ field: "income", op: "lte", value: 200000 }, { income: 250000 })).toBe("fail");
  });
  it("matches any of several occupations", () => {
    const rule = { field: "occupation", op: "in", value: ["farmer", "fisherman"] } as const;
    expect(evaluateRule({ ...rule, value: [...rule.value] }, { occupation: ["student", "farmer"] })).toBe("pass");
    expect(evaluateRule({ ...rule, value: [...rule.value] }, { occupation: ["student"] })).toBe("fail");
  });
  it("treats no disability (0%) as failing a disability requirement", () => {
    expect(evaluateRule({ field: "disability", op: "gte", value: 40 }, { disability: 0 })).toBe("fail");
  });
});

describe("real schemes", () => {
  it("PM-KISAN: farmer who does not pay income tax", () => {
    const farmer = { occupation: ["farmer" as const], incomeTaxPayer: false, govtEmployee: false };
    expect(matchScheme(get("pm-kisan"), farmer).status).toBe("eligible");
    expect(matchScheme(get("pm-kisan"), { ...farmer, incomeTaxPayer: true }).status).toBe("ineligible");
    expect(matchScheme(get("pm-kisan"), { occupation: ["student"] }).status).toBe("ineligible");
  });

  it("Atal Pension Yojana: age 18–40", () => {
    expect(matchScheme(get("apy"), { age: 30, incomeTaxPayer: false }).status).toBe("eligible");
    expect(matchScheme(get("apy"), { age: 45, incomeTaxPayer: false }).status).toBe("ineligible");
  });

  it("old age pension needs 60+ and BPL", () => {
    expect(matchScheme(get("nsap-ignoaps"), { age: 65, bpl: true }).status).toBe("eligible");
    expect(matchScheme(get("nsap-ignoaps"), { age: 65 }).status).toBe("maybe");
    expect(matchScheme(get("nsap-ignoaps"), { age: 50, bpl: true }).status).toBe("ineligible");
  });

  it("state schemes only show for residents of that state", () => {
    const wb = get("wbkanyashree");
    expect(matchScheme(wb, { state: "Bihar" }).status).toBe("ineligible");
    expect(matchScheme(wb, { state: "West Bengal", gender: "female", age: 15, occupation: ["student"], income: 100000 }).status).toBe("eligible");
  });

  it("a 65-year-old rural BPL widow in UP gets pensions near the top", () => {
    const results = findSchemes(schemes, {
      age: 65, gender: "female", maritalStatus: "widowed", bpl: true, state: "Uttar Pradesh", area: "rural", category: "OBC",
      occupation: ["other"], income: 40000, disability: 0,
    });
    const top = results.filter((r) => r.status === "eligible").slice(0, 40).map((r) => r.slug);
    expect(top).toContain("nsap-ignoaps");
    expect(results.some((r) => r.state && r.state !== "Uttar Pradesh")).toBe(false);
  });

  it("every rule in the dataset is well formed", () => {
    const fields = new Set(["age", "income", "category", "occupation", "gender", "disability", "bpl", "maritalStatus", "minority", "area", "state", "incomeTaxPayer", "govtEmployee", "hasPuccaHouse", "pregnant"]);
    for (const s of schemes) {
      for (const r of s.rules) {
        expect(fields.has(r.field), `${s.slug}: ${r.field}`).toBe(true);
        if (r.field === "age") expect(Number(r.value)).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("expandQuery", () => {
  it("maps Hindi and Hinglish words to English search terms", () => {
    expect(expandQuery("किसान को पैसा कैसे मिलेगा")).toContain("farmer");
    expect(expandQuery("vidhwa pension kaise milegi")).toContain("widow");
    expect(expandQuery("SC chhatravritti")).toContain("scholarship");
  });
});

describe("maternity schemes", () => {
  it("PMMVY needs pregnancy, so it does not show for a 65-year-old", () => {
    expect(matchScheme(get("pmmvy"), { age: 65, gender: "female", pregnant: false }).status).toBe("ineligible");
    expect(matchScheme(get("pmmvy"), { age: 24, gender: "female", pregnant: true }).status).toBe("eligible");
  });
});

describe("transliterate", () => {
  it("romanizes common scheme words", async () => {
    const { transliterate } = await import("../src/lib/synonyms");
    expect(transliterate("सम्मान")).toBe("samman");
    expect(transliterate("निधि")).toBe("nidhi");
    expect(transliterate("योजना")).toBe("yojana");
    expect(transliterate("उज्ज्वला")).toBe("ujjvala");
  });
});
