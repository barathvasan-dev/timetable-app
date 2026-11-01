import { useEffect, useState } from "react";
import { api, setToken } from "../api.js";

export default function Settings({ user, setUser, onBack, onLogout }) {
  const [wa, setWa] = useState(null);
  const [token, setTok] = useState("");
  const [recipients, setRecipients] = useState("");
  const [msg, setMsg] = useState({ wa: null, test: null, acct: null });
  const [testTo, setTestTo] = useState("");
  const [acct, setAcct] = useState({ username: user.username, current: "", next: "" });

  useEffect(() => {
    api.settings().then((s) => { setWa(s.whatsapp); setRecipients((s.whatsapp.recipients || []).join("\n")); })
      .catch((e) => setMsg((m) => ({ ...m, wa: { bad: true, text: e.message } })));
  }, []);

  const say = (k, bad, text) => setMsg((m) => ({ ...m, [k]: { bad, text } }));
  const set = (k, v) => setWa((w) => ({ ...w, [k]: v }));

  async function saveWa() {
    try {
      const s = await api.saveSettings({ ...wa, access_token: token, recipients });
      setWa(s.whatsapp); setTok(""); setRecipients(s.whatsapp.recipients.join("\n"));
      say("wa", false, "Saved.");
    } catch (e) { say("wa", true, e.message); }
  }
  async function sendTest() {
    say("test", false, "Sending…");
    try {
      const r = await api.testWhatsapp(testTo, "Test message from the timetable app.");
      say("test", r.failed.length > 0, r.failed.length ? r.failed.map((f) => f.to + ": " + f.error).join(" | ") : "Sent to " + r.sent + " number(s).");
    } catch (e) { say("test", true, e.message); }
  }
  async function saveAcct() {
    try {
      const r = await api.account({ current_password: acct.current, username: acct.username, new_password: acct.next });
      setToken(r.token); setUser({ username: r.username, defaultPassword: false });
      setAcct({ username: r.username, current: "", next: "" });
      say("acct", false, "Saved. Use the new details next time you sign in.");
    } catch (e) { say("acct", true, e.message); }
  }

  const note = (m) => m && <p className={m.bad ? "err" : "ok"}>{m.text}</p>;

  return (
    <div className="page">
      <header className="top">
        <div><p className="eyebrow">Settings</p><h1>API &amp; account</h1></div>
        <div className="top-r"><button className="btn" onClick={onBack}>Back to timetable</button><button className="btn" onClick={onLogout}>Sign out</button></div>
      </header>
      <div className="settings">
        <section className="card">
          <h2>WhatsApp Cloud API</h2>
          <p className="help">Create these in Meta for Developers → your app → WhatsApp → API setup. Nothing is sent until you turn it on and save.</p>
          {!wa ? <p className="help">Loading…</p> : (<>
            <label className="switch"><input type="checkbox" checked={!!wa.enabled} onChange={(e) => set("enabled", e.target.checked)} /><span>Send timetable changes on WhatsApp</span></label>
            <label className="lbl" htmlFor="pid">Phone number ID</label>
            <input id="pid" className="txt" inputMode="numeric" value={wa.phone_number_id} onChange={(e) => set("phone_number_id", e.target.value)} placeholder="e.g. 106540352242922" />
            <label className="lbl" htmlFor="tok">Access token</label>
            <input id="tok" className="txt" type="password" autoComplete="off" value={token} onChange={(e) => setTok(e.target.value)} placeholder={wa.access_token_set ? "Saved. Type a new one to replace it" : "Paste your permanent token"} />
            <label className="lbl" htmlFor="ver">API version</label>
            <input id="ver" className="txt" value={wa.api_version} onChange={(e) => set("api_version", e.target.value)} />
            <label className="lbl" htmlFor="rec">Student numbers</label>
            <textarea id="rec" className="txt" value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder={"919876543210\n919812345678"} />
            <p className="help">One per line, with the country code and no + sign. Each number gets the message. Free-form messages reach a person only if they wrote to your business number in the last 24 hours; for everyone else Meta requires an approved message template.</p>
            <div className="mrow left"><button className="btn primary" onClick={saveWa}>Save WhatsApp settings</button></div>
            {note(msg.wa)}
            <label className="lbl" htmlFor="tst">Send a test message</label>
            <input id="tst" className="txt" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="Number to test (leave blank to use the list above)" />
            <div className="mrow left"><button className="btn" onClick={sendTest}>Send test</button></div>
            {note(msg.test)}
          </>)}
        </section>

        <section className="card">
          <h2>Teacher login</h2>
          {user.defaultPassword && <p className="warn">You are still using the default admin / admin. Change it below.</p>}
          <label className="lbl" htmlFor="au">Username</label>
          <input id="au" className="txt" value={acct.username} onChange={(e) => setAcct({ ...acct, username: e.target.value })} autoComplete="username" />
          <label className="lbl" htmlFor="ac">Current password</label>
          <input id="ac" className="txt" type="password" value={acct.current} onChange={(e) => setAcct({ ...acct, current: e.target.value })} autoComplete="current-password" />
          <label className="lbl" htmlFor="an">New password (leave blank to keep it)</label>
          <input id="an" className="txt" type="password" value={acct.next} onChange={(e) => setAcct({ ...acct, next: e.target.value })} autoComplete="new-password" />
          <div className="mrow left"><button className="btn primary" onClick={saveAcct}>Save login</button></div>
          {note(msg.acct)}
        </section>
      </div>
    </div>
  );
}
