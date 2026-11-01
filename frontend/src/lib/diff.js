import { DAYS, SL, key, rng, slotOf, fmtLong, dayDate, addDays } from "./time.js";

/** Heading text used in WhatsApp messages, e.g. "M.Tech IT (AI & DS) · Semester I" */
export const heading = (meta) => {
  const name = [meta.program, meta.track].filter(Boolean).join(" ");
  return [name, meta.semester].filter(Boolean).join(" · ");
};

/** Course lookup that still knows courses removed in `after`, so "removed" lines can name them. */
export const courseMap = (a, b) => {
  const m = {};
  a.courses.forEach((c) => { m[c.id] = c; });
  b.courses.forEach((c) => { m[c.id] = c; });
  return m;
};

export function diff(a, b) {
  const out = [];
  const keys = new Set(Object.keys(a.slots).concat(Object.keys(b.slots)));
  keys.forEach((k) => {
    const f = a.slots[k] || null, t = b.slots[k] || null;
    if (f !== t) { const p = k.split("-"); out.push({ type: "slot", day: p[0], slot: +p[1], from: f, to: t }); }
  });
  const ids = new Set(a.times.map((x) => x.n).concat(b.times.map((x) => x.n)));
  ids.forEach((n) => {
    const f = a.times.find((x) => x.n === n) || null, t = b.times.find((x) => x.n === n) || null;
    if (!f || !t || f.s !== t.s || f.e !== t.e) out.push({ type: "time", slot: n, from: f, to: t });
  });
  const ord = (x) => (x.type === "time" ? 99 : DAYS.findIndex((d) => d.k === x.day));
  out.sort((x, y) => ord(x) - ord(y) || x.slot - y.slot);
  return out;
}

export function groupByDay(changes) {
  const by = {};
  changes.forEach((c) => { const k = c.type === "time" ? "times" : c.day; (by[k] = by[k] || []).push(c); });
  return by;
}

export function changeLine(c, a, b) {
  const C = courseMap(a, b), code = (id) => (C[id] ? C[id].code : id);
  if (c.type === "time") {
    const x = slotOf(c.to ? b : a, c.slot), lbl = "Slot " + (x ? x.i : "");
    if (!c.from) return lbl + " added: " + rng(c.to);
    if (!c.to) return lbl + " removed (" + rng(c.from) + ")";
    return lbl + " timing: " + rng(c.from) + " → " + rng(c.to);
  }
  const x = slotOf(b, c.slot) || slotOf(a, c.slot);
  const when = "Slot " + (x ? x.i : c.slot) + (x ? " (" + rng(x) + ")" : "");
  if (!c.from) return when + ": " + code(c.to) + " added";
  if (!c.to) return when + ": " + code(c.from) + " removed";
  return when + ": " + code(c.from) + " → " + code(c.to);
}

/** Changes to the course list and header that are not schedule changes (shown in the review, not in WhatsApp). */
export function detailLines(a, b) {
  const L = [];
  const ac = {}, bc = {};
  a.courses.forEach((c) => { ac[c.id] = c; });
  b.courses.forEach((c) => { bc[c.id] = c; });
  b.courses.forEach((c) => {
    const o = ac[c.id];
    if (!o) L.push("Course added: " + c.code + " " + c.name);
    else if (o.code !== c.code || o.name !== c.name || o.fac !== c.fac || o.fam !== c.fam || !!o.lab !== !!c.lab) L.push("Course updated: " + c.code + " " + c.name);
  });
  a.courses.forEach((c) => { if (!bc[c.id]) L.push("Course deleted: " + c.code + " " + c.name); });
  const names = { program: "Programme", track: "Track", semester: "Semester", venue: "Venue" };
  Object.keys(names).forEach((f) => {
    if ((a.meta[f] || "") !== (b.meta[f] || "")) L.push(names[f] + ": " + (a.meta[f] || "(empty)") + " → " + (b.meta[f] || "(empty)"));
  });
  return L;
}

export function buildMessage(dayKey, before, after, changes, now = new Date()) {
  const dt = dayDate(dayKey, now), d = DAYS.find((x) => x.k === dayKey);
  const isToday = dt.getTime() === addDays(now, 0).getTime();
  const C = courseMap(before, after);
  const L = ["📢 *Timetable update* — " + fmtLong(dt) + (isToday ? " (today)" : ""), heading(after.meta), "", "*What changed*"];
  changes.forEach((c) => L.push("• " + changeLine(c, before, after)));
  L.push("", "*" + d.n + " schedule*");
  let n = 0;
  SL(after).forEach((s) => {
    const id = after.slots[key(dayKey, s.n)];
    if (!id) return;
    n++;
    const c = C[id];
    L.push(n + ". " + rng(s) + " · " + c.code + " " + c.name + (c.fac ? " · " + c.fac : ""));
  });
  if (!n) L.push("No classes");
  return L.join("\n");
}

export function buildTimeMessage(before, after, changes) {
  const L = ["📢 *Class timings updated*", heading(after.meta), "", "*What changed*"];
  changes.forEach((c) => L.push("• " + changeLine(c, before, after)));
  L.push("", "*New slot timings*");
  SL(after).forEach((s) => L.push("Slot " + s.i + ": " + rng(s)));
  return L.join("\n");
}

/** Everything the server needs to store and send for one save. */
export function planPublish(before, after, now = new Date()) {
  const by = groupByDay(diff(before, after));
  const entries = [], messages = [];
  DAYS.forEach((d) => {
    if (!by[d.k]) return;
    entries.push({ day: d.k, lines: by[d.k].map((c) => changeLine(c, before, after)) });
    messages.push({ label: d.n + " · " + fmtLong(dayDate(d.k, now)), text: buildMessage(d.k, before, after, by[d.k], now) });
  });
  if (by.times) {
    entries.push({ day: "all", lines: by.times.map((c) => changeLine(c, before, after)) });
    messages.push({ label: "Slot timings", text: buildTimeMessage(before, after, by.times) });
  }
  const extra = detailLines(before, after);
  if (extra.length) entries.push({ day: "setup", lines: extra });
  return { entries, messages, by, extra };
}
