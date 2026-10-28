import { findSchemes } from "@/lib/eligibility";
import { profileSchema } from "@/lib/profile-schema";
import { allSchemes } from "@/lib/schemes";

export async function POST(req: Request) {
  const parsed = profileSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid profile", issues: parsed.error.issues }, { status: 400 });
  }
  // Keep the payload small for slow rural connections: no rule source text, no failed rules.
  const results = findSchemes(allSchemes(), parsed.data).map((r) => ({
    ...r,
    failed: undefined,
    matched: [...new Set(r.matched.map((m) => m.field))],
  }));
  return Response.json({ total: results.length, results });
}
