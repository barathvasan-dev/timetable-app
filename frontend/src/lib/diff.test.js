// Run with:  npm test   (Node's built-in test runner, nothing to install)
import test from "node:test";
import assert from "node:assert/strict";
import { diff, planPublish, detailLines, heading } from "./diff.js";
import { SL } from "./time.js";

const base = () => ({
  meta: { program: "M.Tech IT", track: "(AI & DS)", semester: "Semester I", venue: "IST T3 Lecture Hall" },
  courses: [
    { id: "A", code: "DS3101", name: "Fundamentals", fac: "Dr. S", fam: 2, lab: false },
    { id: "B", code: "DS3102", name: "AI", fac: "Dr. T", fam: 3, lab: false },
  ],
  times: [{ n: 1, s: 510, e: 560 }, { n: 2, s: 565, e: 615 }],
  slots: { "Mon-1": "A", "Tue-2": "B" },
});
const NOW = new Date(2026, 9, 28, 10, 0); // a Wednesday

test("moving a course shows one removal and one addition", () => {
  const a = base(), b = base();
  delete b.slots["Mon-1"]; b.slots["Wed-2"] = "A";
  const d = diff(a, b);
  assert.equal(d.length, 2);
  const p = planPublish(a, b, NOW);
  assert.deepEqual(p.entries.map((e) => e.day), ["Mon", "Wed"]);
  assert.match(p.messages[1].text, /Slot 2 \(9:25 AM - 10:15 AM\): DS3101 added/);
  assert.match(p.messages[1].text, /M\.Tech IT \(AI & DS\) · Semester I/);
});

test("messages never mention rooms, halls or floors", () => {
  const a = base(), b = base(); b.slots["Mon-1"] = "B";
  const text = planPublish(a, b, NOW).messages.map((m) => m.text).join("\n");
  assert.doesNotMatch(text, /room|hall|floor/i);
});

test("deleting a course is described with its code", () => {
  const a = base(), b = base();
  b.courses = b.courses.filter((c) => c.id !== "B"); delete b.slots["Tue-2"];
  const p = planPublish(a, b, NOW);
  assert.ok(p.entries.some((e) => e.lines.some((l) => /DS3102 removed/.test(l))));
  assert.ok(p.extra.includes("Course deleted: DS3102 AI"));
});

test("header and course edits are reported but send no WhatsApp message", () => {
  const a = base(), b = base();
  b.meta.semester = "Semester II"; b.courses.push({ id: "C", code: "DS3201", name: "ML", fac: "", fam: 0, lab: false });
  const p = planPublish(a, b, NOW);
  assert.equal(p.messages.length, 0);
  assert.deepEqual(detailLines(a, b), ["Course added: DS3201 ML", "Semester: Semester I → Semester II"]);
});

test("slot timing change gets its own message", () => {
  const a = base(), b = base(); b.times[0] = { n: 1, s: 520, e: 570 };
  const p = planPublish(a, b, NOW);
  assert.equal(p.messages.length, 1);
  assert.match(p.messages[0].text, /Slot 1 timing: 8:30 AM - 9:20 AM → 8:40 AM - 9:30 AM/);
});

test("no change, no entries", () => {
  const a = base();
  const p = planPublish(a, base(), NOW);
  assert.equal(p.entries.length + p.messages.length, 0);
});

test("helpers", () => {
  assert.equal(heading({ program: "M.Tech IT", track: "", semester: "", venue: "" }), "M.Tech IT");
  assert.deepEqual(SL(base()).map((s) => s.i), [1, 2]);
});
