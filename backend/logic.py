"""Pure functions: validation and shaping. No database, no web framework, so they are easy to test."""
import re
import uuid

DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
MAX_FAM = 7  # colour families 0..7


class Invalid(ValueError):
    pass


def _s(v, limit=120):
    return str(v if v is not None else "").strip()[:limit]


def clean_meta(m):
    m = m if isinstance(m, dict) else {}
    out = {
        "program": _s(m.get("program")),
        "track": _s(m.get("track")),
        "semester": _s(m.get("semester")),
        "venue": _s(m.get("venue")),
    }
    if not out["program"]:
        raise Invalid("Programme name cannot be empty.")
    return out


def clean_courses(lst):
    if not isinstance(lst, list):
        raise Invalid("courses must be a list.")
    out, seen = [], set()
    for c in lst:
        if not isinstance(c, dict):
            raise Invalid("Bad course entry.")
        code, name = _s(c.get("code"), 40), _s(c.get("name"), 160)
        if not code or not name:
            raise Invalid("Every course needs a code and a name.")
        cid = _s(c.get("id"), 40) or ("c" + uuid.uuid4().hex[:8])
        if cid in seen:
            raise Invalid("Duplicate course id: " + cid)
        seen.add(cid)
        try:
            fam = int(c.get("fam", 0))
        except (TypeError, ValueError):
            fam = 0
        out.append({
            "id": cid, "code": code, "name": name, "fac": _s(c.get("fac"), 120),
            "fam": max(0, min(MAX_FAM, fam)), "lab": bool(c.get("lab")),
        })
    return out


def clean_times(lst):
    if not isinstance(lst, list) or not lst:
        raise Invalid("Keep at least one slot.")
    if len(lst) > 12:
        raise Invalid("A day can have up to 12 slots.")
    out, seen = [], set()
    for t in lst:
        try:
            n, s, e = int(t["n"]), int(t["s"]), int(t["e"])
        except (KeyError, TypeError, ValueError):
            raise Invalid("Bad slot time.")
        if n in seen:
            raise Invalid("Duplicate slot number.")
        seen.add(n)
        if not (0 <= s < e <= 1439):
            raise Invalid("A slot must end after it starts.")
        out.append({"n": n, "s": s, "e": e})
    ordered = sorted(out, key=lambda x: x["s"])
    for a, b in zip(ordered, ordered[1:]):
        if b["s"] < a["e"]:
            raise Invalid("Slots overlap.")
    return out


_KEY = re.compile(r"^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)-(\d+)$")


def clean_slots(slots, courses, times):
    """Keep only cells that point at a real course and a real slot."""
    if not isinstance(slots, dict):
        raise Invalid("slots must be an object.")
    ids = {c["id"] for c in courses}
    ns = {t["n"] for t in times}
    out = {}
    for k, v in slots.items():
        m = _KEY.match(str(k))
        if m and int(m.group(2)) in ns and v in ids:
            out[k] = v
    return out


def clean_log_entries(entries):
    out = []
    for e in (entries or [])[:20]:
        if not isinstance(e, dict):
            continue
        lines = [_s(x, 300) for x in (e.get("lines") or []) if _s(x, 300)]
        day = _s(e.get("day"), 8)
        if lines and (day in DAYS or day == "all" or day == "setup"):
            out.append({"day": day, "lines": lines[:40]})
    return out


def clean_messages(msgs):
    out = []
    for m in (msgs or [])[:10]:
        if isinstance(m, dict) and _s(m.get("text"), 4000):
            out.append({"label": _s(m.get("label"), 80), "text": _s(m.get("text"), 4000)})
    return out


def validate_timetable(body):
    if not isinstance(body, dict):
        raise Invalid("Bad request.")
    meta = clean_meta(body.get("meta"))
    courses = clean_courses(body.get("courses"))
    times = clean_times(body.get("times"))
    slots = clean_slots(body.get("slots") or {}, courses, times)
    return {"meta": meta, "courses": courses, "times": times, "slots": slots}


def split_numbers(text_or_list):
    """Phone numbers in international format, digits only (e.g. 919876543210)."""
    raw = text_or_list if isinstance(text_or_list, list) else re.split(r"[,\n;]+", str(text_or_list or ""))
    out = []
    for x in raw:
        d = re.sub(r"\D", "", str(x))
        if 8 <= len(d) <= 15 and d not in out:
            out.append(d)
    return out


def clean_whatsapp(new, old):
    new = new if isinstance(new, dict) else {}
    token = _s(new.get("access_token"), 600)
    return {
        "enabled": bool(new.get("enabled")),
        "api_version": _s(new.get("api_version"), 12) or old.get("api_version", "v21.0"),
        "phone_number_id": re.sub(r"\D", "", _s(new.get("phone_number_id"), 40)),
        "access_token": token or old.get("access_token", ""),  # blank means "keep the saved one"
        "recipients": split_numbers(new.get("recipients", old.get("recipients", []))),
    }


def public_settings(settings):
    w = dict(settings.get("whatsapp", {}))
    w["access_token_set"] = bool(w.pop("access_token", ""))
    return {"whatsapp": w}
