export const DAYS = [
  { k: "Mon", n: "Monday" }, { k: "Tue", n: "Tuesday" }, { k: "Wed", n: "Wednesday" },
  { k: "Thu", n: "Thursday" }, { k: "Fri", n: "Friday" }, { k: "Sat", n: "Saturday" }, { k: "Sun", n: "Sunday" },
];
export const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const pad = (n) => String(n).padStart(2, "0");
export const fmt = (m) => { const h = Math.floor(m / 60); return (h % 12 || 12) + ":" + pad(m % 60) + " " + (h >= 12 ? "PM" : "AM"); };
export const rng = (t) => fmt(t.s) + " - " + fmt(t.e);
export const toHM = (m) => pad(Math.floor(m / 60)) + ":" + pad(m % 60);
export const fromHM = (v) => { const p = String(v || "").split(":"); return p.length < 2 || isNaN(+p[0]) || isNaN(+p[1]) ? NaN : +p[0] * 60 + +p[1]; };
export const key = (d, n) => d + "-" + n;
export const clone = (o) => JSON.parse(JSON.stringify(o));
export const dayIndex = (now = new Date()) => (now.getDay() + 6) % 7;
export const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
export const weekDates = (now = new Date()) => DAYS.map((_, i) => addDays(now, i - dayIndex(now)));
export const dayDate = (k, now = new Date()) => { const i = DAYS.findIndex((d) => d.k === k); return addDays(now, (i - dayIndex(now) + 7) % 7); };
export const fmtLong = (dt) => DAYS[(dt.getDay() + 6) % 7].n + ", " + dt.getDate() + " " + MON[dt.getMonth()];
export const fmtStamp = (iso) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
/** Slots in time order, numbered 1..n for display. */
export const SL = (st) => st.times.slice().sort((a, b) => a.s - b.s).map((t, i) => ({ n: t.n, s: t.s, e: t.e, i: i + 1 }));
export const slotOf = (st, n) => SL(st).find((x) => x.n === n);
