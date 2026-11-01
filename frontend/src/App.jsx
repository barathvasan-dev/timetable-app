import { useCallback, useEffect, useState } from "react";
import { api, getToken, setToken, setUnauthorizedHandler } from "./api.js";
import Login from "./components/Login.jsx";
import Timetable from "./components/Timetable.jsx";
import Settings from "./components/Settings.jsx";

/* Screens: "login" (first screen) -> "timetable" <-> "settings".
   Students can press "View timetable" on the login screen: same page, no edit buttons. */
export default function App() {
  const [screen, setScreen] = useState("login");
  const [user, setUser] = useState(null); // { username, defaultPassword }
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const logout = useCallback(() => { setToken(""); setUser(null); setScreen("login"); }, []);
  useEffect(() => { setUnauthorizedHandler(logout); }, [logout]);

  const load = useCallback(async () => {
    try { setData(await api.timetable()); setError(""); }
    catch (e) { setError(e.message); }
  }, []);

  // Already signed in from earlier? Skip the login screen.
  useEffect(() => {
    load();
    if (!getToken()) return;
    api.me().then((m) => { setUser({ username: m.username, defaultPassword: m.default_password }); setScreen("timetable"); }).catch(() => setToken(""));
  }, [load]);

  const signedIn = (r) => { setToken(r.token); setUser({ username: r.username, defaultPassword: !!r.default_password }); setScreen("timetable"); };

  if (screen === "login") return <Login onSignedIn={signedIn} onView={() => setScreen("timetable")} serverError={error} />;
  if (!data) return <div className="auth"><div className="auth-card">{error ? <p className="err">{error}</p> : <p>Loading…</p>}{error && <button className="btn" onClick={load}>Try again</button>}</div></div>;
  if (screen === "settings" && user) return <Settings user={user} setUser={setUser} onBack={() => setScreen("timetable")} onLogout={logout} />;
  return <Timetable data={data} setData={setData} user={user} onSettings={() => setScreen("settings")} onLogin={() => setScreen("login")} onLogout={logout} />;
}
