/**
 * The PDF text is one flowing string with sentences glued together
 * ("...50 years.The applicant must..."). Split it back into readable lines.
 */
export function toLines(text: string): string[] {
  return text
    .replace(/([.?:;])(?=[A-Z₹“"(])/g, "$1\n")
    .replace(/\s*(Step\s*\d+\s*:)/gi, "\n$1")
    .replace(/(?<=\S)\s*(?=\d{1,2}\.\s+[A-Z])/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 1);
}

/** FAQ text is "Question?Answer.Question?Answer." — pair questions with answers. */
export function toFaq(text: string): { q: string; a: string }[] {
  const out: { q: string; a: string }[] = [];
  const re = /([A-Z][^?]{8,240}\?)\s*([\s\S]*?)(?=(?:[A-Z][^?.!]{8,240}\?)|$)/g;
  for (const m of text.matchAll(re)) {
    const a = m[2].trim();
    if (a) out.push({ q: m[1].trim(), a });
  }
  return out;
}
