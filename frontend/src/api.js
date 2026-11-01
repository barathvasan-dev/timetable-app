const TOKEN_KEY = "tt-token";
const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; } };
export const setToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ } };

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

async function call(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  const t = getToken();
  if (t) headers.Authorization = "Bearer " + t;
  let res;
  try {
    res = await fetch(API_BASE + "/api" + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new Error("Cannot reach the server. Is the backend running on port 8000?");
  }
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (res.status === 401 && path !== "/login") onUnauthorized();
  if (!res.ok) throw new Error((data && data.detail) || "Something went wrong (" + res.status + ").");
  return data;
}

export const api = {
  login: (username, password) => call("POST", "/login", { username, password }),
  me: () => call("GET", "/me"),
  timetable: () => call("GET", "/timetable"),
  saveTimetable: (body) => call("PUT", "/timetable", body),
  settings: () => call("GET", "/settings"),
  saveSettings: (whatsapp) => call("PUT", "/settings", { whatsapp }),
  testWhatsapp: (to, text) => call("POST", "/whatsapp/test", { to, text }),
  account: (body) => call("POST", "/account", body),
};
