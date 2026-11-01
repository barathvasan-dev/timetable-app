"""Timetable API. Run:  uvicorn main:app --reload --port 8000"""
import os
import time
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import logic
import whatsapp
from security import check_password, hash_password, make_token, read_token
from store import open_store

app = FastAPI(title="Timetable API")
origins = [origin.strip() for origin in os.environ.get(
    "APP_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",") if origin.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins,
                   allow_methods=["*"], allow_headers=["*"])
store = open_store()


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def secret():
    return store.get("secret")["value"]


def current_user(authorization: str = Header(default="")):
    token = authorization[7:] if authorization.lower().startswith("bearer ") else ""
    user = read_token(secret(), token) if token else None
    if not user or user != store.get("admin")["username"]:
        raise HTTPException(401, "Please sign in again.")
    return user


def timetable_view():
    t = dict(store.get("timetable"))
    t["log"] = store.recent_log()
    return t


@app.get("/api/health")
def health():
    return {"ok": True}


@app.post("/api/login")
def login(body: dict):
    admin = store.get("admin")
    if str(body.get("username", "")).strip() != admin["username"] or not check_password(str(body.get("password", "")), admin["password"]):
        raise HTTPException(401, "Wrong username or password.")
    return {"token": make_token(secret(), admin["username"]), "username": admin["username"], "default_password": bool(admin.get("default"))}


@app.get("/api/me")
def me(user: str = Depends(current_user)):
    return {"username": user, "default_password": bool(store.get("admin").get("default"))}


@app.post("/api/account")
def change_account(body: dict, user: str = Depends(current_user)):
    admin = store.get("admin")
    if not check_password(str(body.get("current_password", "")), admin["password"]):
        raise HTTPException(400, "Current password is wrong.")
    username = str(body.get("username") or admin["username"]).strip()
    password = str(body.get("new_password") or "")
    if len(username) < 3:
        raise HTTPException(400, "Username needs at least 3 characters.")
    if password and len(password) < 4:
        raise HTTPException(400, "New password needs at least 4 characters.")
    store.put("admin", {"username": username, "password": hash_password(password) if password else admin["password"], "default": False if password else admin.get("default", False)})
    return {"token": make_token(secret(), username), "username": username}


@app.get("/api/timetable")
def get_timetable():
    return timetable_view()


@app.put("/api/timetable")
def put_timetable(body: dict, user: str = Depends(current_user)):
    try:
        data = logic.validate_timetable(body)
        entries = logic.clean_log_entries(body.get("log_entries"))
        messages = logic.clean_messages(body.get("messages"))
    except logic.Invalid as e:
        raise HTTPException(400, str(e))
    stamp = now_iso()
    data["updated"] = stamp
    store.put("timetable", data)
    store.add_log([dict(e, at=stamp) for e in entries])

    wa_result = {"status": "skipped"}
    if body.get("notify") and messages:
        wa = store.get("settings")["whatsapp"]
        if whatsapp.ready(wa):
            r = whatsapp.broadcast(wa, [m["text"] for m in messages])
            wa_result = {"status": "sent" if not r["failed"] else "partial", **r}
        else:
            wa_result = {"status": "not_configured"}
    return {"timetable": timetable_view(), "whatsapp": wa_result}


@app.get("/api/settings")
def get_settings(user: str = Depends(current_user)):
    return logic.public_settings(store.get("settings"))


@app.put("/api/settings")
def put_settings(body: dict, user: str = Depends(current_user)):
    old = store.get("settings")
    store.put("settings", {"whatsapp": logic.clean_whatsapp(body.get("whatsapp"), old["whatsapp"])})
    return logic.public_settings(store.get("settings"))


@app.post("/api/whatsapp/test")
def whatsapp_test(body: dict, user: str = Depends(current_user)):
    wa = dict(store.get("settings")["whatsapp"])
    nums = logic.split_numbers(body.get("to")) or wa["recipients"]
    if not (wa["phone_number_id"] and wa["access_token"]):
        raise HTTPException(400, "Save the Phone number ID and Access token first.")
    if not nums:
        raise HTTPException(400, "Add at least one recipient number.")
    wa["recipients"] = nums
    text = str(body.get("text") or "Test message from the timetable app.")[:500]
    return whatsapp.broadcast(wa, [text])
