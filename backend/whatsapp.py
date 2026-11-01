"""WhatsApp Cloud API sender (Meta Graph API). Uses only the standard library."""
import json
import urllib.error
import urllib.request


def send_text(wa, to, text, timeout=15):
    url = "https://graph.facebook.com/%s/%s/messages" % (wa["api_version"], wa["phone_number_id"])
    payload = {"messaging_product": "whatsapp", "to": to, "type": "text", "text": {"preview_url": False, "body": text}}
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode(), method="POST",
        headers={"Authorization": "Bearer " + wa["access_token"], "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return {"to": to, "ok": True, "status": r.status}
    except urllib.error.HTTPError as e:
        try:
            detail = json.loads(e.read().decode()).get("error", {}).get("message", "")
        except Exception:
            detail = ""
        return {"to": to, "ok": False, "error": "WhatsApp said %s %s" % (e.code, detail)}
    except Exception as e:  # network down, DNS, timeout
        return {"to": to, "ok": False, "error": str(e)}


def ready(wa):
    return bool(wa.get("enabled") and wa.get("phone_number_id") and wa.get("access_token") and wa.get("recipients"))


def broadcast(wa, texts, sender=send_text):
    """Sends every text to every recipient. Returns {"sent": n, "failed": [..]}"""
    sent, failed = 0, []
    for text in texts:
        for to in wa["recipients"]:
            r = sender(wa, to, text)
            if r["ok"]:
                sent += 1
            else:
                failed.append({"to": to, "error": r["error"]})
    return {"sent": sent, "failed": failed}
