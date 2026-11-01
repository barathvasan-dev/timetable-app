import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api.js";
import { DAYS, MON, SL, clone, dayIndex, fmt, fmtStamp, key, weekDates } from "../lib/time.js";
import { detailLines, diff, planPublish } from "../lib/diff.js";
import { CourseDialog, DeleteDialog, DetailsDialog, ResultDialog, ReviewDialog, TimesDialog } from "./Dialogs.jsx";

const toState = (d) => ({ meta: clone(d.meta), courses: clone(d.courses), times: clone(d.times), slots: clone(d.slots) });
const srcOf = (el) => (el.dataset.drag === "block"
  ? { course: el.dataset.course, from: { day: el.dataset.day, slot: +el.dataset.slot } }
  : { course: el.dataset.course, from: null });
const newId = () => "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

export default function Timetable({ data, setData, user, onSettings, onLogin, onLogout }) {
  const pub = useMemo(() => toState(data), [data]);
  const [draft, setDraftState] = useState(null);
  const [undo, setUndo] = useState([]);
  const [active, setActive] = useState(DAYS[dayIndex()].k);
  const [carry, setCarry] = useState(null);
  const [modal, setModal] = useState(null);
  const [toastText, setToastText] = useState("");
  const [armed, setArmed] = useState(false);
  const [pulse, setPulse] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pubErr, setPubErr] = useState("");
  const [now, setNow] = useState(new Date());

  const editing = !!draft;
  const st = draft || pub;
  const todayKey = DAYS[dayIndex(now)].k;
  const C = useMemo(() => { const m = {}; st.courses.forEach((c) => { m[c.id] = c; }); return m; }, [st.courses]);

  /* latest values for the window-level drag handlers */
  const draftRef = useRef(null);
  const L = useRef({});
  draftRef.current = draft;

  const toast = useCallback((t) => { setToastText(t); clearTimeout(toast.t); toast.t = setTimeout(() => setToastText(""), 3600); }, []);

  useEffect(() => { document.body.classList.toggle("editing", editing); return () => document.body.classList.remove("editing"); }, [editing]);
  useEffect(() => { const t = setInterval(() => { if (!draftRef.current) setNow(new Date()); }, 60000); return () => clearInterval(t); }, []);

  /* ---------- editing actions ---------- */
  function commit(next) {
    const cur = draftRef.current;
    if (!cur || JSON.stringify(next) === JSON.stringify(cur)) return false;
    setUndo((u) => u.slice(-59).concat(JSON.stringify(cur)));
    draftRef.current = next;
    setDraftState(next);
    setArmed(false);
    return true;
  }
  function enterEdit() { setDraftState(clone(pub)); draftRef.current = clone(pub); setUndo([]); setCarry(null); setArmed(false); }
  function exitEdit() { setDraftState(null); draftRef.current = null; setUndo([]); setCarry(null); setArmed(false); setModal(null); }
  function doUndo() {
    if (!undo.length) return;
    const prev = JSON.parse(undo[undo.length - 1]);
    setUndo(undo.slice(0, -1)); setDraftState(prev); draftRef.current = prev; setCarry(null);
  }
  function discard() {
    if (!changeCount) { exitEdit(); return; }
    if (armed) { exitEdit(); return; }
    setArmed(true); setTimeout(() => setArmed(false), 3200);
  }

  function applyDrop(src, t) {
    const d = draftRef.current;
    if (!d || !src) return;
    const next = clone(d), sl = next.slots;
    if (t.type === "cell") {
      const k = key(t.day, t.slot), occ = sl[k];
      if (src.from) {
        const fk = key(src.from.day, src.from.slot);
        if (fk === k) return;
        if (occ) sl[fk] = occ; else delete sl[fk];
        sl[k] = src.course;
      } else sl[k] = src.course;
    } else if (t.type === "remove") {
      if (!src.from) return;
      delete sl[key(src.from.day, src.from.slot)];
    }
    if (commit(next)) {
      setCarry(null);
      if (t.type === "cell") { setPulse(key(t.day, t.slot)); setTimeout(() => setPulse(null), 700); }
    }
  }
  function tap(el) {
    const src = srcOf(el), c = L.current.carry;
    if (c && el.dataset.drag === "block") {
      const same = c.from && c.from.day === el.dataset.day && c.from.slot === +el.dataset.slot;
      setCarry(null);
      if (!same) applyDrop(c, { type: "cell", day: el.dataset.day, slot: +el.dataset.slot });
      return;
    }
    const same = c && !c.from && !src.from && c.course === src.course;
    setCarry(same ? null : src);
  }
  function mutate(fn) { const d = draftRef.current; if (!d) return; const next = clone(d); fn(next); commit(next); }

  const saveCourse = (course) => {
    mutate((n) => {
      if (!course.id) n.courses.push({ ...course, id: newId() });
      else n.courses = n.courses.map((c) => (c.id === course.id ? course : c));
    });
    setModal(null);
  };
  const deleteCourse = (id) => {
    mutate((n) => { n.courses = n.courses.filter((c) => c.id !== id); Object.keys(n.slots).forEach((k) => { if (n.slots[k] === id) delete n.slots[k]; }); });
    setCarry((c) => (c && c.course === id ? null : c));
    setModal(null);
  };
  const saveTimes = (times) => {
    mutate((n) => {
      const keep = new Set(times.map((t) => t.n));
      n.times = times;
      Object.keys(n.slots).forEach((k) => { if (!keep.has(+k.split("-")[1])) delete n.slots[k]; });
    });
    setModal(null);
  };

  const plan = useMemo(() => (draft ? planPublish(pub, draft) : null), [pub, draft]);
  const changeCount = draft ? diff(pub, draft).length + detailLines(pub, draft).length : 0;

  async function publish(notify) {
    setBusy(true); setPubErr("");
    try {
      const r = await api.saveTimetable({ ...draft, log_entries: plan.entries, messages: plan.messages, notify });
      const msgs = plan.messages;
      setData(r.timetable); exitEdit();
      setModal({ type: "result", wa: r.whatsapp, messages: msgs });
    } catch (e) { setPubErr(e.message); }
    finally { setBusy(false); }
  }

  /* ---------- drag and drop (mouse drag, touch long-press, or tap a course then a slot) ---------- */
  L.current = { editing, carry, applyDrop, tap, setActive };
  useEffect(() => {
    let press = null, drag = null, hoverTab = null, hoverTimer = null;
    const hit = (x, y) => document.elementFromPoint(x, y);

    const down = (e) => {
      if (!L.current.editing || e.target.closest(".x,.cbtn")) return;
      const el = e.target.closest("[data-drag]");
      if (!el || (e.pointerType === "mouse" && e.button !== 0)) return;
      press = { el, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, type: e.pointerType, src: srcOf(el), timer: null };
      if (e.pointerType !== "mouse") press.timer = setTimeout(() => { if (press && !drag) start(press.x, press.y); }, 240);
    };
    const move = (e) => {
      if (press && !drag) {
        press.x = e.clientX; press.y = e.clientY;
        const d = Math.hypot(e.clientX - press.sx, e.clientY - press.sy);
        if (press.type === "mouse") { if (d > 5) start(e.clientX, e.clientY); }
        else if (d > 10) { clearTimeout(press.timer); press = null; }
      }
      if (drag) over(e.clientX, e.clientY);
    };
    const up = () => {
      if (drag) { end(true); return; }
      if (press) { const p = press; clearTimeout(p.timer); press = null; L.current.tap(p.el); }
    };
    const cancel = () => { if (drag) end(false); if (press) { clearTimeout(press.timer); press = null; } };
    const touchmove = (e) => { if (drag && e.cancelable) e.preventDefault(); };
    const ctx = (e) => { if (L.current.editing && e.target.closest && e.target.closest("[data-drag]")) e.preventDefault(); };
    const keydown = (e) => {
      if (e.key === "Escape" && L.current.carry) { setCarry(null); return; }
      if (!L.current.editing || (e.key !== "Enter" && e.key !== " ")) return;
      const el = e.target.closest && e.target.closest("[data-drag]");
      if (el && e.target === el) { e.preventDefault(); L.current.tap(el); return; }
      const cell = e.target.classList && e.target.classList.contains("cell") ? e.target : null;
      if (cell && L.current.carry) { e.preventDefault(); const c = L.current.carry; setCarry(null); L.current.applyDrop(c, { type: "cell", day: cell.dataset.day, slot: +cell.dataset.slot }); }
    };

    function start(x, y) {
      const p = press; if (!p) return;
      press = null; clearTimeout(p.timer);
      const c = (draftRef.current || { courses: [] }).courses.find((q) => q.id === p.src.course);
      if (!c) return;
      const g = document.createElement("div");
      g.className = "ghost f" + c.fam;
      const b = document.createElement("b"), s = document.createElement("span");
      b.textContent = c.code; s.textContent = c.name;
      g.append(b, s); document.body.appendChild(g);
      drag = { src: p.src, ghost: g, target: null, hot: null };
      document.body.classList.add("dragging");
      p.el.classList.add("lifted");
      try { if (navigator.vibrate) navigator.vibrate(10); } catch { /* not supported */ }
      over(x, y);
    }
    function over(x, y) {
      drag.ghost.style.transform = "translate(" + (x - 60) + "px," + (y - 28) + "px) rotate(-2deg)";
      const el = hit(x, y);
      if (drag.hot) { drag.hot.classList.remove("hot"); drag.hot = null; }
      drag.target = null;
      const cell = el && el.closest(".cell"), pn = el && el.closest("#panel"), tab = el && el.closest(".tab");
      if (cell) { cell.classList.add("hot"); drag.hot = cell; drag.target = { type: "cell", day: cell.dataset.day, slot: +cell.dataset.slot }; }
      else if (pn) { pn.classList.add("hot"); drag.hot = pn; drag.target = { type: "remove" }; }
      if (tab) {
        if (hoverTab !== tab.dataset.day) { hoverTab = tab.dataset.day; clearTimeout(hoverTimer); hoverTimer = setTimeout(() => L.current.setActive(hoverTab), 420); }
      } else { hoverTab = null; clearTimeout(hoverTimer); }
      if (y < 70) window.scrollBy(0, -14);
      else if (y > window.innerHeight - 70 && !(el && (el.closest("#panel") || el.closest(".editbar")))) window.scrollBy(0, 14);
    }
    function end(commitIt) {
      const d = drag; drag = null;
      clearTimeout(hoverTimer); hoverTab = null;
      if (d.hot) d.hot.classList.remove("hot");
      d.ghost.remove();
      document.body.classList.remove("dragging");
      document.querySelectorAll(".lifted").forEach((n) => n.classList.remove("lifted"));
      if (commitIt && d.target) L.current.applyDrop(d.src, d.target);
    }

    document.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    document.addEventListener("touchmove", touchmove, { passive: false });
    document.addEventListener("contextmenu", ctx);
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      document.removeEventListener("touchmove", touchmove);
      document.removeEventListener("contextmenu", ctx);
      document.removeEventListener("keydown", keydown);
      if (drag) end(false);
    };
  }, []);

  /* ---------- derived view data ---------- */
  const sls = SL(st), wk = weekDates(now), mins = now.getHours() * 60 + now.getMinutes();
  const count = {};
  Object.values(st.slots).forEach((v) => { count[v] = (count[v] || 0) + 1; });
  const eyebrow = [st.meta.semester, st.meta.venue].filter(Boolean).join(" · ");

  return (
    <>
      <div className="page">
        <header className="top">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h1>{st.meta.program} {st.meta.track && <span>{st.meta.track}</span>}</h1>
          </div>
          <div className="top-r">
            <p className="upd">{data.updated ? "Updated " + fmtStamp(data.updated) : "Original timetable"}</p>
            {user && !editing && <button className="btn primary" onClick={enterEdit}>✎ Edit timetable</button>}
            {user && !editing && <button className="btn" onClick={onSettings}>Settings</button>}
            {user && !editing && <button className="btn" onClick={onLogout}>Sign out</button>}
            {!user && <button className="btn primary" onClick={onLogin}>Teacher sign in</button>}
          </div>
        </header>

        <NowBanner pub={pub} now={now} />

        {editing && (
          <div className="editrow">
            <span>Drag a course onto a slot. Add courses or change the class details too.</span>
            <span className="top-r">
              <button className="btn" onClick={() => setModal({ type: "details" })}>Edit class details</button>
              <button className="btn" onClick={() => setModal({ type: "times" })}>Edit slot times</button>
            </span>
          </div>
        )}

        <nav className="tabs" role="tablist" aria-label="Choose a day">
          {DAYS.map((d, i) => (
            <button key={d.k} type="button" role="tab" className={"tab" + (d.k === todayKey ? " today" : "")} data-day={d.k}
              aria-selected={d.k === active} aria-label={d.n} onClick={() => setActive(d.k)}>
              <b>{d.k}</b><span>{wk[i].getDate()}</span><i className={sls.some((sl) => st.slots[key(d.k, sl.n)]) ? "on" : ""} />
            </button>
          ))}
        </nav>

        <div className="layout">
          <section aria-label="Weekly timetable">
            <div className="grid" role="grid">
              <div className="g-corner" aria-hidden="true" />
              {DAYS.map((d, i) => (
                <div key={d.k} className={"g-head" + (d.k === todayKey ? " is-today" : "")} role="columnheader"><b>{d.k}</b><span>{wk[i].getDate()} {MON[wk[i].getMonth()]}</span></div>
              ))}
              {sls.map((sl, idx) => {
                const prev = sls[idx - 1];
                return (
                  <Row key={sl.n} sl={sl} gap={prev && sl.s - prev.e >= 40 ? { prev, lunch: prev.e >= 660 && sl.s <= 900 } : null}>
                    {DAYS.map((d) => {
                      const k = key(d.k, sl.n), id = st.slots[k], c = id && C[id];
                      const changed = editing && (id || null) !== (pub.slots[k] || null);
                      const live = !editing && d.k === todayKey && id && mins >= sl.s && mins < sl.e;
                      const carried = carry && carry.from && carry.from.day === d.k && carry.from.slot === sl.n;
                      return (
                        <div key={d.k} role="gridcell" data-day={d.k} data-slot={sl.n} tabIndex={editing ? 0 : undefined}
                          className={"cell" + (d.k === active ? "" : " off") + (changed ? " changed" : "") + (live ? " live" : "") + (d.k === todayKey ? " is-today" : "") + (pulse === k ? " pulse" : "")}
                          onClick={(e) => { if (editing && carry && !c && !e.target.closest("[data-drag]")) { const cc = carry; setCarry(null); applyDrop(cc, { type: "cell", day: d.k, slot: sl.n }); } }}>
                          {c ? (
                            <div className={"block f" + c.fam + (c.lab ? " lab" : "") + (carried ? " carried" : "")} data-drag={editing ? "block" : undefined} tabIndex={editing ? 0 : undefined}
                              data-course={c.id} data-day={d.k} data-slot={sl.n}>
                              <span className="code">{c.code}</span><span className="name">{c.name}</span>{c.fac && <span className="meta">{c.fac}</span>}
                              {editing && <button className="x" type="button" aria-label={"Remove " + c.code} onClick={(e) => { e.stopPropagation(); applyDrop({ course: c.id, from: { day: d.k, slot: sl.n } }, { type: "remove" }); }}>×</button>}
                            </div>
                          ) : <div className="free">{editing ? "Drop here" : "Free"}</div>}
                        </div>
                      );
                    })}
                  </Row>
                );
              })}
            </div>
          </section>

          <aside className="panel" id="panel" aria-label="Courses and faculty"
            onClick={(e) => { if (editing && carry && carry.from && !e.target.closest("[data-drag],.cbtn,button")) { const cc = carry; setCarry(null); applyDrop(cc, { type: "remove" }); } }}>
            <div className="panel-head">
              <h2>Courses &amp; faculty</h2>
              {editing && <button className="btn" onClick={() => setModal({ type: "course", course: null })}>+ Add course</button>}
            </div>
            <p className="hint">{editing ? "Drag a course onto a slot. Drag a placed block back here to remove it. On a phone, tap a course, then tap a slot." : "Colours match the timetable. Striped blocks are labs."}</p>
            <div className="cards">
              {st.courses.length === 0 && <div className="empty">No courses yet. {editing ? "Tap + Add course." : ""}</div>}
              {st.courses.map((c) => {
                const n = count[c.id] || 0, carried = carry && !carry.from && carry.course === c.id;
                return (
                  <div key={c.id} className={"ccard f" + c.fam + (c.lab ? " lab" : "") + (carried ? " carried" : "")} data-drag={editing ? "card" : undefined} tabIndex={editing ? 0 : undefined} data-course={c.id}>
                    <div className="c-top"><span className="code">{c.code}</span><span className="cnt">{n ? n + " / week" : "not placed"}</span></div>
                    <div className="c-name">{c.name}</div>
                    {c.fac && <div className="c-fac">{c.fac}</div>}
                    {editing && (
                      <div className="cbtns">
                        <button className="cbtn" type="button" onClick={() => setModal({ type: "course", course: c })}>Edit</button>
                        <button className="cbtn del" type="button" onClick={() => setModal({ type: "delete", course: c, placed: n })}>Delete</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>
        </div>

        <RecentChanges log={data.log || []} />
      </div>

      {editing && (
        <div className="editbar">
          <div className="eb-msg">
            {carry ? <>Placing <b>{(C[carry.course] || {}).code}</b>. Tap a slot, or <button className="bbtn" style={{ minHeight: 30, padding: "0 10px" }} onClick={() => setCarry(null)}>cancel</button></>
              : changeCount ? <><b>{changeCount}</b> change{changeCount > 1 ? "s" : ""} not saved</> : "Drag a course onto a slot"}
          </div>
          <div className="eb-act">
            <button className="bbtn" onClick={doUndo} disabled={!undo.length}>Undo</button>
            <button className="bbtn" onClick={discard}>{changeCount ? (armed ? "Tap again" : "Discard") : "Done"}</button>
            <button className="bbtn primary" disabled={!changeCount} onClick={() => { setPubErr(""); setModal({ type: "review" }); }}>Save</button>
          </div>
        </div>
      )}

      {modal && modal.type === "details" && <DetailsDialog meta={draft.meta} onClose={() => setModal(null)} onSave={(m) => { mutate((n) => { n.meta = m; }); setModal(null); }} />}
      {modal && modal.type === "course" && <CourseDialog course={modal.course} onClose={() => setModal(null)} onSave={saveCourse} />}
      {modal && modal.type === "delete" && <DeleteDialog course={modal.course} placed={modal.placed} onClose={() => setModal(null)} onYes={() => deleteCourse(modal.course.id)} />}
      {modal && modal.type === "times" && <TimesDialog times={draft.times} onClose={() => setModal(null)} onSave={saveTimes} />}
      {modal && modal.type === "review" && draft && <ReviewDialog before={pub} after={draft} plan={plan} busy={busy} error={pubErr} onGo={publish} onClose={() => setModal(null)} />}
      {modal && modal.type === "result" && <ResultDialog wa={modal.wa} messages={modal.messages} toast={toast} onClose={() => setModal(null)} />}
      {toastText && <div className="toast" role="status">{toastText}</div>}
    </>
  );
}

/* A grid row is: time label, then 7 cells. A lunch/break divider is drawn above it when there is a long gap. */
function Row({ sl, gap, children }) {
  return (
    <>
      {gap && <div className="lunch">{gap.lunch ? "Lunch" : "Break"} · {fmt(gap.prev.e)} - {fmt(sl.s)}</div>}
      <TimeLabel sl={sl} />
      {children}
    </>
  );
}
function TimeLabel({ sl }) {
  return <div className="time"><b>{fmt(sl.s)}</b><span>{fmt(sl.e)}</span><em>Slot {sl.i}</em></div>;
}

function NowBanner({ pub, now }) {
  const C = {}; pub.courses.forEach((c) => { C[c.id] = c; });
  const mins = now.getHours() * 60 + now.getMinutes(), ti = dayIndex(now), sls = SL(pub);
  const at = (di, sl) => C[pub.slots[key(DAYS[di].k, sl.n)]];
  const todays = sls.filter((sl) => at(ti, sl));
  const curS = todays.find((sl) => mins >= sl.s && mins < sl.e), nextS = todays.find((sl) => sl.s > mins);
  let tag = "Today", body = "No classes scheduled.";
  if (curS) { const c = at(ti, curS), nx = nextS && at(ti, nextS); tag = "Now"; body = <><b>{c.code}</b> {c.name} until {fmt(curS.e)}{nx ? <> · next {nx.code} at {fmt(nextS.s)}</> : null}</>; }
  else if (nextS) { const c = at(ti, nextS); tag = "Next"; body = <><b>{c.code}</b> {c.name} at {fmt(nextS.s)}{c.fac ? " · " + c.fac : ""}</>; }
  else {
    for (let i = 1; i <= 7; i++) {
      const di = (ti + i) % 7, f = sls.find((sl) => at(di, sl));
      if (f) { const c = at(di, f); tag = todays.length ? "Done for today" : "No class today"; body = <>Next: {i === 1 ? "tomorrow" : DAYS[di].n} at {fmt(f.s)} · <b>{c.code}</b> {c.name}</>; break; }
    }
  }
  return <section className="now" aria-live="polite"><span className="tag">{tag}</span><p>{body}</p></section>;
}

function RecentChanges({ log }) {
  if (!log.length) return null;
  const label = (day) => { const d = DAYS.find((x) => x.k === day); return d ? d.n : day === "all" ? "All days" : day === "setup" ? "Course list & details" : day; };
  return (
    <section className="log">
      <h2>Recent changes</h2>
      <ul>{log.map((e, i) => (
        <li key={i}><span className="d">{label(e.day)}</span><span className="t">{fmtStamp(e.at)}</span><ul className="l">{e.lines.map((x, j) => <li key={j}>{x}</li>)}</ul></li>
      ))}</ul>
    </section>
  );
}
