"""Storage. MongoDB for real use; an in-memory twin for tests (TT_MEMORY=1)."""
import os
import secrets
import time

from default_data import DEFAULT_COURSES, DEFAULT_META, DEFAULT_SETTINGS, DEFAULT_SLOTS, DEFAULT_TIMES
from security import hash_password


class MemoryStore:
    def __init__(self):
        self.docs, self.log = {}, []

    def get(self, name):
        return self.docs.get(name)

    def put(self, name, data):
        self.docs[name] = dict(data)

    def add_log(self, entries):
        self.log = list(entries) + self.log
        self.log = self.log[:50]

    def recent_log(self, n=12):
        return self.log[:n]


class MongoStore:
    def __init__(self, url, dbname):
        from pymongo import MongoClient
        self.client = MongoClient(url, serverSelectionTimeoutMS=2500)
        self.client.admin.command("ping")  # fail fast with a clear message
        self.db = self.client[dbname]

    def get(self, name):
        d = self.db.config.find_one({"_id": name})
        if d:
            d.pop("_id", None)
        return d

    def put(self, name, data):
        self.db.config.replace_one({"_id": name}, dict(data), upsert=True)

    def add_log(self, entries):
        if entries:
            self.db.log.insert_many([dict(e) for e in entries])

    def recent_log(self, n=12):
        return [{k: v for k, v in d.items() if k != "_id"} for d in self.db.log.find().sort("at", -1).limit(n)]


def open_store():
    if os.environ.get("TT_MEMORY") == "1":
        print("WARNING: TT_MEMORY=1, data is kept in memory only and is lost when the server stops.")
        s = MemoryStore()
    else:
        url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        try:
            s = MongoStore(url, os.environ.get("MONGO_DB", "timetable"))
        except Exception as e:
            raise SystemExit("Cannot reach MongoDB at %s (%s).\nStart MongoDB first, or run with TT_MEMORY=1 for a throw-away demo." % (url, e))
    seed(s)
    return s


def seed(s):
    if not s.get("secret"):
        s.put("secret", {"value": secrets.token_hex(32)})
    if not s.get("admin"):
        s.put("admin", {"username": "admin", "password": hash_password("admin"), "default": True})
    if not s.get("settings"):
        s.put("settings", DEFAULT_SETTINGS)
    if not s.get("timetable"):
        s.put("timetable", {
            "meta": DEFAULT_META, "courses": DEFAULT_COURSES, "times": DEFAULT_TIMES,
            "slots": DEFAULT_SLOTS, "updated": None,
        })
