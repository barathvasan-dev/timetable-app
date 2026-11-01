import base64
import hashlib
import hmac
import json
import os
import time


def hash_password(password, salt=None):
    salt = salt or os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 120_000)
    return base64.b64encode(salt).decode() + "$" + base64.b64encode(dk).decode()


def check_password(password, stored):
    try:
        salt_b64, _ = stored.split("$", 1)
        salt = base64.b64decode(salt_b64)
    except Exception:
        return False
    return hmac.compare_digest(hash_password(password, salt), stored)


def make_token(secret, username, hours=12):
    body = base64.urlsafe_b64encode(json.dumps({"u": username, "exp": int(time.time()) + hours * 3600}).encode()).decode()
    sig = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
    return body + "." + sig


def read_token(secret, token):
    """Returns the username, or None when the token is bad or expired."""
    try:
        body, sig = token.rsplit(".", 1)
        good = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, good):
            return None
        data = json.loads(base64.urlsafe_b64decode(body.encode()))
        return data["u"] if data["exp"] > time.time() else None
    except Exception:
        return None
