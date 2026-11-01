import { useState } from "react";
import { api } from "../api.js";

export default function Login({ onSignedIn, onView, serverError }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    try { onSignedIn(await api.login(username, password)); }
    catch (x) { setErr(x.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="auth">
      <form className="auth-card" onSubmit={submit}>
        <p className="eyebrow">Class timetable</p>
        <h1>Teacher sign in</h1>
        <label className="lbl" htmlFor="u">Username</label>
        <input id="u" className="txt" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus />
        <label className="lbl" htmlFor="p">Password</label>
        <input id="p" className="txt" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        {(err || serverError) && <p className="err">{err || serverError}</p>}
        <p className="help">First time? The username and password are both <b>admin</b>. Change them in Settings after signing in.</p>
        <button className="btn primary" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <button className="link" type="button" onClick={onView}>Just view the timetable</button>
      </form>
    </div>
  );
}
