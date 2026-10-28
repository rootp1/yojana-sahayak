import { NextResponse, type NextRequest } from "next/server";

const LOCALES = ["hi", "en"];

// Hindi is the default: most of our users read Hindi. English only if the browser prefers it.
function pickLocale(req: NextRequest) {
  const saved = req.cookies.get("lang")?.value;
  if (saved && LOCALES.includes(saved)) return saved;
  const accept = req.headers.get("accept-language") ?? "";
  const first = accept.split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("en") && !accept.includes("hi") ? "en" : "hi";
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))) return;
  req.nextUrl.pathname = `/${pickLocale(req)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(req.nextUrl);
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|icon|manifest|.*\\..*).*)"],
};
