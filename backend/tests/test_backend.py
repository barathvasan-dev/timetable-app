"""Run:  python tests/test_backend.py   (no extra packages needed; FastAPI is stubbed so the handlers can be called directly)."""
import os, sys, types

os.environ["TT_MEMORY"] = "1"
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# --- tiny stand-in for fastapi so main.py can be imported without installing it ---
fa = types.ModuleType("fastapi")
class HTTPException(Exception):
    def __init__(self, status, detail=""): self.status, self.detail = status, detail
class FastAPI:
    def __init__(self, **k): pass
    def add_middleware(self, *a, **k): pass
    def _d(self, *a, **k): return lambda fn: fn
    get = put = post = _d
fa.FastAPI, fa.HTTPException = FastAPI, HTTPException
fa.Depends = lambda f=None: f
fa.Header = lambda default="": default
mw = types.ModuleType("fastapi.middleware"); cors = types.ModuleType("fastapi.middleware.cors"); cors.CORSMiddleware = object
sys.modules.update({"fastapi": fa, "fastapi.middleware": mw, "fastapi.middleware.cors": cors})

import main, logic, whatsapp
from security import make_token, read_token, check_password, hash_password

ok = fail = 0
def check(cond, name, extra=""):
    global ok, fail
    if cond: ok += 1; print("PASS", name)
    else: fail += 1; print("FAIL", name, extra)
def raises(fn, status=None, exc=HTTPException):
    try: fn()
    except exc as e: return status is None or getattr(e, "status", None) == status
    return False

# seed
t = main.get_timetable()
check(len(t["courses"]) == 9 and t["meta"]["program"] == "M.Tech IT" and len(t["slots"]) == 16, "first run seeds the Semester I timetable")
check(all("hall" not in c and "floor" not in c and "room" not in c for c in t["courses"]) and "rooms" not in t, "no room, hall or floor fields anywhere")

# login
check(raises(lambda: main.login({"username": "admin", "password": "nope"}), 401), "wrong password is refused")
r = main.login({"username": "admin", "password": "admin"})
check(r["default_password"] is True and read_token(main.secret(), r["token"]) == "admin", "admin / admin signs in")
auth = "Bearer " + r["token"]
check(main.current_user(auth) == "admin", "token accepted")
check(raises(lambda: main.current_user(""), 401) and raises(lambda: main.current_user("Bearer abc.def"), 401), "missing or forged token refused")
check(read_token(main.secret(), make_token(main.secret(), "admin", hours=-1)) is None, "expired token refused")

# settings
s = main.get_settings("admin")
check(s["whatsapp"]["enabled"] is False and s["whatsapp"]["access_token_set"] is False and "access_token" not in s["whatsapp"], "settings start empty, token never returned")
s = main.put_settings({"whatsapp": {"enabled": True, "phone_number_id": "12 34", "access_token": "TOKEN123", "recipients": "+91 98765 43210, 919999999999\n123"}}, "admin")
check(s["whatsapp"]["recipients"] == ["919876543210", "919999999999"] and s["whatsapp"]["phone_number_id"] == "1234" and s["whatsapp"]["access_token_set"], "numbers cleaned, bad number dropped, token stored")
main.put_settings({"whatsapp": {"enabled": True, "phone_number_id": "1234", "access_token": "", "recipients": ["919876543210"]}}, "admin")
check(main.store.get("settings")["whatsapp"]["access_token"] == "TOKEN123", "blank token keeps the saved token")

# timetable edit: new semester courses, edited header
body = {
  "meta": {"program": "M.Tech IT", "track": "(AI & DS)", "semester": "Semester II", "venue": ""},
  "courses": t["courses"] + [{"code": "DS3201", "name": "Machine Learning", "fac": "Dr. X", "fam": 3, "lab": False}],
  "times": t["times"], "slots": dict(t["slots"], **{"Sat-1": "DS3101", "Sat-2": "ghost"}),
  "log_entries": [{"day": "Sat", "lines": ["Slot 1: DS3101 added"]}], "messages": [{"label": "Saturday", "text": "hello"}], "notify": True,
}
sent = []
whatsapp_send = lambda wa, to, text: (sent.append((to, text)) or {"to": to, "ok": True})
real = whatsapp.broadcast
whatsapp.broadcast = lambda wa, texts: real(wa, texts, sender=whatsapp_send)
res = main.put_timetable(body, "admin")
whatsapp.broadcast = real
tt = res["timetable"]
check(tt["meta"]["semester"] == "Semester II" and len(tt["courses"]) == 10, "header and a new course saved")
check(tt["courses"][-1]["id"].startswith("c") and tt["courses"][-1]["code"] == "DS3201", "new course gets an id")
check("Sat-1" in tt["slots"] and "Sat-2" not in tt["slots"], "cells pointing at unknown courses are dropped")
check(res["whatsapp"]["status"] == "sent" and res["whatsapp"]["sent"] == 1 and sent == [("919876543210", "hello")], "update messages go to every saved number", str(res["whatsapp"]))
check(tt["log"] and tt["log"][0]["lines"] == ["Slot 1: DS3101 added"] and tt["updated"], "change log kept")

# delete a course: its blocks go with it
body2 = dict(body, courses=[c for c in tt["courses"] if c["id"] != "DS3101"], slots=tt["slots"], notify=False, log_entries=[], messages=[])
tt2 = main.put_timetable(body2, "admin")["timetable"]
check(all(v != "DS3101" for v in tt2["slots"].values()) and len(tt2["slots"]) < len(tt["slots"]), "deleting a course clears its blocks")

# not configured / disabled
main.put_settings({"whatsapp": {"enabled": False, "phone_number_id": "1234", "access_token": "", "recipients": ["919876543210"]}}, "admin")
res = main.put_timetable(dict(body2, notify=True, messages=[{"label": "x", "text": "hi"}]), "admin")
check(res["whatsapp"]["status"] == "not_configured", "WhatsApp off: timetable still saves, no message sent")

# validation
bad = lambda **k: raises(lambda: main.put_timetable(dict(body2, **k), "admin"), 400)
check(bad(courses=[{"code": "", "name": "x"}]), "course needs code and name")
check(bad(courses=[{"id": "a", "code": "a", "name": "a"}, {"id": "a", "code": "b", "name": "b"}]), "duplicate course id refused")
check(bad(times=[]), "at least one slot")
check(bad(times=[{"n": 1, "s": 600, "e": 600}]), "slot must end after it starts")
check(bad(times=[{"n": 1, "s": 600, "e": 700}, {"n": 2, "s": 650, "e": 720}]), "overlapping slots refused")
check(bad(meta={"program": " "}), "programme name required")

# account
check(raises(lambda: main.change_account({"current_password": "zzz", "new_password": "newpass"}, "admin"), 400), "account change needs the current password")
r2 = main.change_account({"current_password": "admin", "username": "teacher", "new_password": "secret1"}, "admin")
check(r2["username"] == "teacher" and raises(lambda: main.login({"username": "admin", "password": "admin"}), 401), "default login stops working after change")
check(main.login({"username": "teacher", "password": "secret1"})["default_password"] is False, "new login works")
check(raises(lambda: main.current_user(auth), 401), "old token no longer valid after username change")

# whatsapp helpers
wa = {"api_version": "v21.0", "phone_number_id": "1", "access_token": "t", "recipients": ["1", "2"], "enabled": True}
out = whatsapp.broadcast(wa, ["a", "b"], sender=lambda w, to, x: {"to": to, "ok": to != "2", "error": "boom"})
check(out["sent"] == 2 and len(out["failed"]) == 2, "partial failures are reported")
check(whatsapp.ready(wa) and not whatsapp.ready(dict(wa, enabled=False)) and not whatsapp.ready(dict(wa, recipients=[])), "ready() needs enabled, ids, token and numbers")

print("\n%d passed, %d failed" % (ok, fail))
sys.exit(1 if fail else 0)
