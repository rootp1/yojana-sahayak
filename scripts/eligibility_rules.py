"""Heuristic extraction of machine-checkable eligibility rules from scheme text.

Rules are deliberately conservative: a rule is emitted only when the text clearly
restricts who can apply. Anything we can't parse stays in the free-text
eligibility section that the user (and the AI agent) can still read.
"""
import re

AMOUNT = r"(?:₹|rs\.?|inr|rupees)?\s*([\d,]+(?:\.\d+)?)\s*(lakhs?|lacs?|crores?|k)?"
LTE_WORDS = r"(?:not\s+(?:exceed(?:ing)?|be\s+more\s+than|more\s+than|be\s+above|above)|less\s+than|below|up\s*to|within|maximum|max\.?|under|does\s+not\s+exceed|lower\s+than|<=?|≤)"


def sentences(text):
    # Sections are often glued: "...application.The age of..." so split on [.;] even without a space.
    parts = re.split(r"(?<=[a-z0-9\)%][.;])\s*(?=[A-Z])|(?<=[a-z0-9\)])(?=[A-Z][a-z]+ )", text or "")
    return [s.strip() for s in parts if s and s.strip()]


def to_rupees(num, unit):
    try:
        v = float(num.replace(",", ""))
    except ValueError:
        return None
    unit = (unit or "").lower()
    if unit.startswith(("lakh", "lac")):
        v *= 1e5
    elif unit.startswith("crore"):
        v *= 1e7
    elif unit == "k":
        v *= 1e3
    return int(v)


def extract_age(elig):
    lo, hi, src = None, None, []
    for s in sentences(elig):
        low = s.lower()
        if not re.search(r"\bage|aged|years old|yrs", low) or re.search(r"\bexit|retire|start of pension|pension (starts|begins)", low):
            continue
        m_min = re.search(r"minimum age[^.]{0,30}?(\d{1,2})\s*(?:years?|yrs)", low) or re.search(r"(\d{1,2})\s*(?:years?|yrs)\s*(?:of age\s*)?(?:or|and)\s*(?:above|more|older)", low)
        m_max = re.search(r"maximum(?: age)?[^.]{0,30}?(\d{1,2})\s*(?:years?|yrs)", low) or re.search(r"(\d{1,2})\s*(?:years?|yrs)\s*(?:of age\s*)?(?:or|and)\s*(?:below|less|younger)", low)
        if m_min or m_max:
            if m_min:
                lo = max(lo or 0, int(m_min.group(1)))
            if m_max:
                hi = min(hi or 200, int(m_max.group(1)))
            src.append(s)
            continue
        m = re.search(r"(\d{1,2})\s*(?:years?|yrs)?\s*(?:to|-|–|and)\s*(\d{1,2})\s*(?:years?|yrs)", low)
        if m and int(m.group(1)) < int(m.group(2)) <= 100:
            lo = max(lo or 0, int(m.group(1)))
            hi = min(hi or 200, int(m.group(2)))
            src.append(s)
            continue
        m = re.search(r"(?:above|more than|at least|minimum(?: age)?(?: of)?|not less than|attained(?: the age of)?|completed|over|≥|>=?)\s*(?:the age of\s*)?(\d{1,2})\s*(?:years?|yrs)", low)
        if m and int(m.group(1)) <= 100:
            lo = max(lo or 0, int(m.group(1)))
            src.append(s)
        m = re.search(r"(?:below|less than|not (?:be )?(?:more than|exceed(?:ing)?|above)|up ?to|maximum(?: age)?(?: of)?|under|≤|<=?)\s*(?:the age of\s*)?(\d{1,2})\s*(?:years?|yrs)", low)
        if m and int(m.group(1)) <= 100:
            hi = min(hi or 200, int(m.group(1)))
            src.append(s)
    rules = []
    if lo is not None and lo > 0:
        rules.append({"field": "age", "op": "gte", "value": lo, "source": src[0][:240]})
    if hi is not None and hi < 200 and (lo is None or hi >= lo):
        rules.append({"field": "age", "op": "lte", "value": hi, "source": src[-1][:240]})
    return rules


def extract_income(elig):
    best, src = None, None
    for s in sentences(elig):
        low = s.lower()
        if "income" not in low or not re.search(LTE_WORDS, low):
            continue
        for m in re.finditer(AMOUNT, low):
            if not re.search(r"₹|rs|inr|rupee|lakh|lac|crore|/-", low[max(0, m.start() - 6): m.end() + 4]):
                continue
            v = to_rupees(m.group(1), m.group(2))
            if not v:
                continue
            if "month" in low and v < 200000:
                v *= 12
            if 10000 <= v <= 5e7 and (best is None or v > best):
                best, src = v, s
    if best:
        return [{"field": "income", "op": "lte", "value": best, "source": src[:240]}]
    return []


# Abbreviations are matched case-sensitively so "B.Sc" or "1st" never count as SC/ST.
CATS = {
    "SC": r"(?<![\w.])SCs?\b|[Ss]cheduled [Cc]astes?",
    "ST": r"(?<![\w.])STs?\b|[Ss]cheduled [Tt]ribes?|[Tt]ribal|[Aa]divasi",
    "OBC": r"\bOBCs?\b|[Oo]ther [Bb]ackward|[Bb]ackward [Cc]lass|\bMBC\b|\bEBC\b|\bDNTs?\b|[Dd]enotified",
    "EWS": r"\bEWS\b|[Ee]conomically [Ww]eaker",
}


def extract_category(name, tags, elig):
    found = set()
    head = name + " " + " ".join(tags)
    for cat, pat in CATS.items():
        if re.search(pat, head):
            found.add(cat)
    for s in sentences(elig):
        low = s.lower()
        # Only a direct restriction counts; lists of alternative groups ("SC/ST, PMAY, AAY or BPL")
        # and relaxations do not.
        if re.search(r"relax|reserv|preference|priorit|concession|viz|such as|including|categor|\bor\b.*(bpl|pmay|antyodaya|women|woman|minorit|disab)|any of", low):
            continue
        for cat, pat in CATS.items():
            if re.search(r"(belong(s|ing)?\s+to|be\s+from|should\s+be|must\s+be|shall\s+be)\s+(an?\s+|the\s+)?(member\s+of\s+)?(the\s+)?[^.]{0,25}(" + pat + ")", s):
                found.add(cat)
    if found and len(found) < 4:
        return [{"field": "category", "op": "in", "value": sorted(found), "source": ""}]
    return []


OCCUPATIONS = {
    "farmer": r"farmer|kisan|krishak|cultivator|agricultur|horticultur|land ?holding",
    "construction_worker": r"construction worker|building and other construction|bocw|building worker",
    "fisherman": r"fisher|fish farmer|fishing",
    "artisan": r"artisan|weaver|handloom|handicraft|craftsm|potter|carpenter|vishwakarma",
    "street_vendor": r"street vendor|hawker",
    "student": r"\bstudents?\b|scholarship|fellowship|pursuing|enrolled in",
    "unorganised_worker": r"unorgani[sz]ed|labourer|laborer|daily wage|migrant worker|domestic worker",
    "entrepreneur": r"entrepreneur|startup|start-up|msme|enterprise|self[- ]employ|business",
    "ex_serviceman": r"ex-?servicem|veteran|armed forces|defence personnel|war widow",
    "sports_person": r"sports ?person|athlete|player",
}


def extract_occupation(name, tags, elig):
    head = (name + " " + " ".join(tags)).lower()
    first = " ".join(sentences(elig)[:2]).lower()
    found = set()
    for occ, pat in OCCUPATIONS.items():
        if re.search(pat, head):
            found.add(occ)
        elif re.search(r"(applicant|beneficiary|candidate|person)s?\s+(should|must|shall)\s+be\s+(an?\s+)?(registered\s+|bonafide\s+|active\s+)?(" + pat + ")", first):
            found.add(occ)
    # Scholarships are often tagged with many things; student wins.
    if "student" in found and len(found) > 2:
        found = {"student"}
    if found:
        return [{"field": "occupation", "op": "in", "value": sorted(found), "source": ""}]
    return []


def extract_gender(name, tags, elig):
    head = (name + " " + " ".join(tags)).lower()
    low = elig.lower()
    if re.search(r"transgender", head):
        return [{"field": "gender", "op": "in", "value": ["transgender"], "source": ""}]
    female_head = r"\b(women|woman|girls?|female|widows?|mahila|kanya|beti|daughters?|mothers?|maternity|pregnan)"
    female_body = r"(applicant|beneficiary|candidate|student)s?\s+(should|must|shall)\s+be\s+(an?\s+)?(female|woman|girl|widow|pregnant|lactating|mother)|\b(only|exclusively)\s+(for\s+)?(women|girls|female)|\bgirl students?\b"
    if re.search(female_head, head) or re.search(female_body, low):
        # Schemes "for a girl child" are claimed by the parents; keep gender but note it.
        return [{"field": "gender", "op": "in", "value": ["female"], "source": ""}]
    return []


def extract_flags(name, tags, elig):
    head = (name + " " + " ".join(tags)).lower()
    low = elig.lower()
    rules = []
    if re.search(r"disab|divyang|handicap|\bpwd\b|blind|deaf|leprosy|cerebral|autism|special(ly)? (abled|needs)", head) or re.search(
        r"(applicant|person|student|candidate)s?\s+(should|must|shall)\s+(be|have)\s+(an?\s+)?(person with )?(benchmark )?disab", low
    ):
        m = re.search(r"(\d{2})\s*%\s*(?:or more|and above)?\s*(?:of\s+)?(?:disab|benchmark)", low) or re.search(r"disab\w*\s+of\s+(?:at least|minimum|not less than)?\s*(\d{2})\s*%", low)
        rules.append({"field": "disability", "op": "gte", "value": int(m.group(1)) if m else 40, "source": ""})
    if re.search(r"\bbpl\b|below poverty line|antyodaya|\baay\b", head) or re.search(
        r"(belong|should be|must be|holder|having)[^.]{0,40}(\bbpl\b|below poverty line|antyodaya)", low
    ):
        rules.append({"field": "bpl", "op": "eq", "value": True, "source": ""})
    if re.search(r"matern|pregnan|lactating|janani|matru", head) or re.search(
        r"(applicant|beneficiary|woman)\s+(should|must)\s+be\s+(a\s+)?pregnant", low
    ):
        rules.append({"field": "pregnant", "op": "eq", "value": True, "source": ""})
    if re.search(r"\bwidow", head) or re.search(r"(applicant|beneficiary)\s+(should|must)\s+be\s+(a\s+)?widow", low):
        rules.append({"field": "maritalStatus", "op": "in", "value": ["widowed"], "source": ""})
    if re.search(r"minorit", head) or re.search(r"(belong|should be|must be)[^.]{0,40}minorit", low):
        rules.append({"field": "minority", "op": "eq", "value": True, "source": ""})
    if re.search(r"\brural\b|gramin|grameen", head) or re.search(r"(resid\w*|live|living|located)\s+in\s+(a\s+|the\s+)?rural", low):
        rules.append({"field": "area", "op": "in", "value": ["rural"], "source": ""})
    elif re.search(r"\burban\b|shahari|nagar", head) or re.search(r"(resid\w*|live|living)\s+in\s+(an\s+|the\s+)?urban", low):
        rules.append({"field": "area", "op": "in", "value": ["urban"], "source": ""})
    return rules


def extract_rules(rec):
    name, tags, elig = rec["name"], rec["tags"], rec["eligibility"]
    rules = []
    rules += extract_age(elig)
    rules += extract_income(elig)
    rules += extract_category(name, tags, elig)
    rules += extract_occupation(name, tags, elig)
    rules += extract_gender(name, tags, elig)
    rules += extract_flags(name, tags, elig)
    if rec.get("state"):
        rules.append({"field": "state", "op": "in", "value": [rec["state"]], "source": ""})
    return rules
