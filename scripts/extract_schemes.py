"""Extract structured scheme records from the myScheme PDF dump.

Usage: python scripts/extract_schemes.py data/raw/myscheme_pdfs data/schemes.json
Requires: pip install pypdf ftfy
"""
import json
import os
import re
import sys

import ftfy
from pypdf import PdfReader

from eligibility_rules import extract_rules

SECTIONS = [
    "Details",
    "Benefits",
    "Eligibility",
    "Exclusions",
    "Application Process",
    "Documents Required",
    "Frequently Asked Questions",
    "Sources And References",
]

STATES = [
    "Andaman And Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
    "Chandigarh", "Chhattisgarh", "Dadra And Nagar Haveli And Daman And Diu", "Delhi", "Goa",
    "Gujarat", "Haryana", "Himachal Pradesh", "Jammu And Kashmir", "Jharkhand", "Karnataka",
    "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
    "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
    "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
]

BOILERPLATE = [
    "Are you sure you want to sign out?CancelSign Out",
    "Something went wrong. Please try again later.Ok",
    "You need to sign in before applying for schemesCancelSign In",
    "It seems you have already initiated your application earlier.To know more please visit CancelApply Now",
]


def read_pdf(path):
    reader = PdfReader(path)
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    text = ftfy.fix_text(text).replace("\t", " ").replace("﻿", " ")
    # PDF line wraps are not meaningful; keep one flowing string.
    text = re.sub(r"\s*\n\s*", " ", text)
    return re.sub(r" {2,}", " ", text)


def split_camel(s):
    return [p.strip() for p in re.split(r"(?<=[a-z\)\.'])(?=[A-Z])", s) if p.strip()]


# Mojibake ftfy can't repair because the PDF dropped the undefined cp1252 byte (0x9D).
LEFTOVER_MOJIBAKE = {"â€\u200b": "”", "Â\u200b": "", "Â ": " ", "Ã ": "à "}


def parse(text, slug):
    for bad, good in LEFTOVER_MOJIBAKE.items():
        text = text.replace(bad, good)
    title = text.split("Are you sure", 1)[0].strip()
    nav = text.split("Back", 1)[1].split("Feedback", 1)[0] if "Back" in text else ""
    order = [s for s in SECTIONS if s in nav] or SECTIONS

    start = text.find("Check Eligibility")
    if start < 0:
        return None
    body = text[start + len("Check Eligibility"):]
    end = body.find("Was this helpful?")
    if end > 0:
        body = body[:end]

    # Header block: "<state or ministry><title><tags...>Details..."
    details_at = body.find("Details")
    header = body[:details_at] if details_at >= 0 else ""
    level, state, ministry = "central", None, None
    norm = re.sub(r"^The ", "", header).replace("&", "And")
    for st in sorted(STATES, key=len, reverse=True):
        if norm.lower().startswith(st.lower()):
            level, state = "state", st
            header = header[len(st) + (len(header) - len(norm)) :]
            break
    else:
        m = re.match(r"(Ministry Of .+?|Department Of .+?)(?=" + re.escape(title[:12]) + ")", header)
        if m:
            ministry = m.group(1).strip()
            header = header[len(m.group(1)):]
    if header.startswith(title):
        header = header[len(title):]
    tags = [t for t in split_camel(header) if 2 < len(t) < 60]

    sections = {}
    pos = 0
    positions = []
    for name in order:
        # Real headers are glued to the following text (e.g. "BenefitsThe ...").
        m = re.compile(re.escape(name) + r"(?=[A-Z0-9₹\"'“(])").search(body, pos)
        if not m:
            continue
        positions.append((name, m.start(), m.end()))
        pos = m.end()
    for i, (name, _s, e) in enumerate(positions):
        nxt = positions[i + 1][1] if i + 1 < len(positions) else len(body)
        sections[name] = re.sub(r"^" + re.escape(name) + r"\s*", "", body[e:nxt].strip())

    for bp in BOILERPLATE:
        for k in sections:
            sections[k] = sections[k].replace(bp, " ").strip()

    def sec(name):
        return sections.get(name, "")

    sources = re.findall(r"https?://[^\s\"'<>]+", sec("Sources And References") + " " + sec("Application Process"))
    record = {
        "slug": slug,
        "name": title,
        "level": level,
        "state": state,
        "ministry": ministry,
        "tags": tags,
        "details": sec("Details"),
        "benefits": sec("Benefits"),
        "eligibility": sec("Eligibility"),
        "exclusions": sec("Exclusions"),
        "applicationProcess": sec("Application Process"),
        "documents": sec("Documents Required"),
        "faq": sec("Frequently Asked Questions"),
        "sources": list(dict.fromkeys(u.rstrip(".,)") for u in sources))[:8],
        "officialUrl": f"https://www.myscheme.gov.in/schemes/{slug}",
    }
    record["rules"] = extract_rules(record)
    return record


def main(src, out):
    # PDF parsing is slow (~7 min); cache raw text so rule tweaks re-run in seconds.
    cache_path = os.path.join(os.path.dirname(src.rstrip("/")), "text_cache.json")
    cache = json.load(open(cache_path, encoding="utf-8")) if os.path.exists(cache_path) else {}
    best = {}
    for fname in sorted(os.listdir(src)):
        if not fname.endswith(".pdf"):
            continue
        slug = re.sub(r"\(\d+\)$", "", fname[:-4])
        try:
            if fname not in cache:
                cache[fname] = read_pdf(os.path.join(src, fname))
            rec = parse(cache[fname], slug)
        except Exception as exc:  # noqa: BLE001 - keep going on bad PDFs
            print(f"skip {fname}: {exc}", file=sys.stderr)
            continue
        if not rec or not rec["name"]:
            print(f"skip {fname}: unparsable", file=sys.stderr)
            continue
        size = sum(len(rec[k]) for k in ("details", "benefits", "eligibility"))
        if slug not in best or size > best[slug][0]:
            best[slug] = (size, rec)
    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False)
    records = [r for _, r in sorted(best.values(), key=lambda x: x[1]["name"])]
    overrides_path = os.path.join(os.path.dirname(out), "overrides.json")
    if os.path.exists(overrides_path):
        overrides = json.load(open(overrides_path, encoding="utf-8"))
        for r in records:
            if r["slug"] in overrides:
                state_rules = [x for x in r["rules"] if x["field"] == "state"]
                r["rules"] = [dict(x, source="") for x in overrides[r["slug"]]] + state_rules
                r["reviewed"] = True
    with open(out, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=0)
    print(f"wrote {len(records)} schemes to {out}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
