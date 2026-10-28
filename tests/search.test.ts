import { describe, expect, it } from "vitest";
import { searchSchemes } from "../src/lib/schemes";

const top = (q: string, n = 3, state?: string) => searchSchemes(q, { limit: n, state }).map((s) => s.slug);

describe("searchSchemes", () => {
  it("finds PM-KISAN from a Hinglish question", () => {
    expect(top("kisan ko paisa kaise milega")).toContain("pm-kisan");
  });
  it("finds PM-KISAN from a Hindi question", () => {
    expect(top("किसान सम्मान निधि", 5)).toContain("pm-kisan");
  });
  it("finds the national widow pension", () => {
    expect(top("vidhwa pension", 5)).toContain("ignwps");
  });
  it("finds Ujjwala for a gas cylinder question", () => {
    expect(top("gas cylinder ujjwala", 3)).toEqual(expect.arrayContaining(["pmuy"]));
  });
  it("filters state schemes to the chosen state", () => {
    const results = searchSchemes("scholarship", { state: "Bihar", limit: 30 });
    expect(results.every((s) => !s.state || s.state === "Bihar")).toBe(true);
  });
});
