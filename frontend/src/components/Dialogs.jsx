import { useState } from "react";
import Modal from "./Modal.jsx";
import { DAYS, fmtLong, dayDate, fromHM, toHM } from "../lib/time.js";
import { changeLine } from "../lib/diff.js";

export const FAMILIES = 8; // colour families f0..f7

/* ---------- header details: programme, track, semester, venue ---------- */
export function DetailsDialog({ meta, onSave, onClose }) {
  const [m, setM] = useState(meta);
  const f = (k) => ({ value: m[k] || "", onChange: (e) => setM({ ...m, [k]: e.target.value }) });
  const preview = [m.semester, m.venue].filter(Boolean).join(" · ");
  return (
    <Modal title="Edit class details" onClose={onClose}>
      <p className="sub">Shown at the top of the timetable and in WhatsApp messages. Use this next year for Semester II or a new batch.</p>
      <label className="lbl" htmlFor="d1">Programme</label>
      <input id="d1" className="txt" placeholder="M.Tech IT" {...f("program")} />
      <label className="lbl" htmlFor="d2">Track (optional)</label>
      <input id="d2" className="txt" placeholder="(AI & DS)" {...f("track")} />
      <label className="lbl" htmlFor="d3">Semester</label>
      <input id="d3" className="txt" placeholder="Semester I" {...f("semester")} />
      <label className="lbl" htmlFor="d4">Venue (optional)</label>
      <input id="d4" className="txt" placeholder="IST T3 Lecture Hall" {...f("venue")} />
      <p className="help">Header preview: <b>{preview || "(empty)"}</b> · <b>{[m.program, m.track].filter(Boolean).join(" ") || "(empty)"}</b></p>
      <div className="mrow">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!m.program.trim()} onClick={() => onSave({ program: m.program.trim(), track: (m.track || "").trim(), semester: (m.semester || "").trim(), venue: (m.venue || "").trim() })}>Apply</button>
      </div>
    </Modal>
  );
}

/* ---------- add or edit a course ---------- */
export function CourseDialog({ course, onSave, onClose }) {
  const isNew = !course;
  const [c, setC] = useState(course || { id: "", code: "", name: "", fac: "", fam: 0, lab: false });
  const [err, setErr] = useState("");
  const f = (k) => ({ value: c[k] || "", onChange: (e) => setC({ ...c, [k]: e.target.value }) });
  function save() {
    if (!c.code.trim() || !c.name.trim()) { setErr("A course needs a code and a name."); return; }
    onSave({ ...c, code: c.code.trim(), name: c.name.trim(), fac: (c.fac || "").trim() });
  }
  return (
    <Modal title={isNew ? "Add a course" : "Edit course"} onClose={onClose}>
      <label className="lbl" htmlFor="c1">Course code</label>
      <input id="c1" className="txt" placeholder="DS3201" {...f("code")} />
      <label className="lbl" htmlFor="c2">Course name</label>
      <input id="c2" className="txt" placeholder="Machine Learning" {...f("name")} />
      <label className="lbl" htmlFor="c3">Faculty</label>
      <input id="c3" className="txt" placeholder="Dr. Name" {...f("fac")} />
      <label className="lbl">Colour</label>
      <div className="swatches">
        {Array.from({ length: FAMILIES }, (_, i) => (
          <button key={i} type="button" className={"swatch f" + i} aria-label={"Colour " + (i + 1)} aria-pressed={c.fam === i} onClick={() => setC({ ...c, fam: i })} />
        ))}
      </div>
      <label className="switch"><input type="checkbox" checked={!!c.lab} onChange={(e) => setC({ ...c, lab: e.target.checked })} /><span>This is a lab (shown with stripes)</span></label>
      {err && <p className="err">{err}</p>}
      <div className="mrow">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save}>{isNew ? "Add course" : "Save course"}</button>
      </div>
    </Modal>
  );
}

export function DeleteDialog({ course, placed, onYes, onClose }) {
  return (
    <Modal title={"Delete " + course.code + "?"} onClose={onClose}>
      <p className="sub">{course.name}{placed ? " is on the timetable " + placed + (placed === 1 ? " time" : " times") + ". Those blocks will be removed too." : " is not placed on the timetable."}</p>
      <div className="mrow">
        <button className="btn" onClick={onClose}>Keep it</button>
        <button className="btn primary" onClick={onYes}>Delete course</button>
      </div>
    </Modal>
  );
}

/* ---------- slot times ---------- */
export function TimesDialog({ times, onSave, onClose }) {
  const [tmp, setTmp] = useState(times.map((t) => ({ ...t })));
  const [err, setErr] = useState("");
  const sorted = tmp.slice().sort((a, b) => a.s - b.s);
  const edit = (n, k, v) => { const m = fromHM(v); if (!isNaN(m)) setTmp(tmp.map((t) => (t.n === n ? { ...t, [k]: m } : t))); };
  function add() {
    if (tmp.length >= 12) { setErr("A day can have up to 12 slots."); return; }
    const last = tmp.reduce((m, t) => Math.max(m, t.e), 480), n = tmp.reduce((m, t) => Math.max(m, t.n), 0) + 1;
    const s = Math.min(last + 5, 1380);
    setTmp([...tmp, { n, s, e: Math.min(s + 50, 1439) }]); setErr("");
  }
  function remove(n) {
    if (tmp.length <= 1) { setErr("Keep at least one slot."); return; }
    setTmp(tmp.filter((t) => t.n !== n)); setErr("");
  }
  function save() {
    const o = tmp.slice().sort((a, b) => a.s - b.s);
    for (let i = 0; i < o.length; i++) {
      if (!(o[i].e > o[i].s)) { setErr("Slot " + (i + 1) + " must end after it starts."); return; }
      if (i > 0 && o[i].s < o[i - 1].e) { setErr("Slot " + (i + 1) + " starts before slot " + i + " ends."); return; }
    }
    onSave(tmp.map((t) => ({ n: t.n, s: t.s, e: t.e })));
  }
  return (
    <Modal title="Edit slot times" onClose={onClose}>
      <p className="sub">Change when each slot starts and ends, add a slot, or remove one. Removing a slot also clears its classes.</p>
      <div className="trows">
        {sorted.map((t, i) => (
          <div className="trow" key={t.n}>
            <span className="tl">Slot {i + 1}</span>
            <input type="time" value={toHM(t.s)} onChange={(e) => edit(t.n, "s", e.target.value)} aria-label={"Slot " + (i + 1) + " start"} />
            <span className="tdash">to</span>
            <input type="time" value={toHM(t.e)} onChange={(e) => edit(t.n, "e", e.target.value)} aria-label={"Slot " + (i + 1) + " end"} />
            <button className="btn" type="button" onClick={() => remove(t.n)} aria-label={"Remove slot " + (i + 1)}>Remove</button>
          </div>
        ))}
      </div>
      <div><button className="btn" type="button" onClick={add}>Add a slot</button></div>
      {err && <p className="err">{err}</p>}
      <div className="mrow">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={save}>Apply times</button>
      </div>
    </Modal>
  );
}

/* ---------- review before saving ---------- */
export function ReviewDialog({ before, after, plan, busy, error, onGo, onClose }) {
  const [notify, setNotify] = useState(true);
  return (
    <Modal title="Save these changes?" onClose={onClose}>
      <p className="sub">Students see the new timetable as soon as you save.</p>
      {DAYS.map((d) => plan.by[d.k] && (
        <section className="chg" key={d.k}>
          <h3>{d.n}<span>{fmtLong(dayDate(d.k))}</span></h3>
          <ul>{plan.by[d.k].map((c, i) => <li key={i}>{changeLine(c, before, after)}</li>)}</ul>
        </section>
      ))}
      {plan.by.times && (
        <section className="chg"><h3>Slot timings</h3><ul>{plan.by.times.map((c, i) => <li key={i}>{changeLine(c, before, after)}</li>)}</ul></section>
      )}
      {plan.extra.length > 0 && (
        <section className="chg"><h3>Course list &amp; details</h3><ul>{plan.extra.map((l, i) => <li key={i}>{l}</li>)}</ul></section>
      )}
      {plan.messages.length > 0 && (
        <label className="chk"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /><span>Send the update to students on WhatsApp</span></label>
      )}
      {error && <p className="err">{error}</p>}
      <div className="mrow">
        <button className="btn" onClick={onClose} disabled={busy}>Keep editing</button>
        <button className="btn primary" onClick={() => onGo(notify && plan.messages.length > 0)} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </Modal>
  );
}

/* ---------- after saving ---------- */
export function ResultDialog({ wa, messages, onClose, toast }) {
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); toast("Message copied"); } catch { toast("Select the text and copy it"); }
  };
  const line = {
    sent: "WhatsApp: sent to " + (wa.sent || 0) + " message(s).",
    partial: "WhatsApp: some messages failed — " + ((wa.failed || []).map((f) => f.to + " (" + f.error + ")").join("; ")),
    not_configured: "WhatsApp is not set up yet, so nothing was sent. Add your API details in Settings. You can copy the messages below meanwhile.",
    skipped: "",
  }[wa.status] || "";
  const showMsgs = messages.length > 0 && wa.status !== "sent";
  return (
    <Modal title="Timetable saved" onClose={onClose}>
      <p className="sub">Students now see the new timetable.</p>
      {line && <p className={wa.status === "sent" ? "ok" : "warn"}>{line}</p>}
      {showMsgs && messages.map((m, i) => (
        <section className="msg" key={i}>
          <h3>{m.label}</h3>
          <pre>{m.text}</pre>
          <div className="mrow">
            <button className="btn" onClick={() => copy(m.text)}>Copy message</button>
            <a className="btn primary" href={"https://wa.me/?text=" + encodeURIComponent(m.text)} target="_blank" rel="noopener noreferrer">Open WhatsApp</a>
          </div>
        </section>
      ))}
      <div className="mrow"><button className="btn primary" onClick={onClose}>Done</button></div>
    </Modal>
  );
}
