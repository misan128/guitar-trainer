// Chord changes (SPEC §17.4): two vertical chord diagrams, now (large) and next (small, muted), and the
// ticks of the current chord. The grid of a diagram is built once; changing chord only redraws its dots.
import { $ } from "./dom.js";
const { CHORDS } = Theory;

const SVG_NS = "http://www.w3.org/2000/svg";
const SX = 16, FY = 22, LX = 14, TY = 24, FRETS = 4;   // string spacing, fret spacing, left and top (nut) margins
const sx = st => LX + st * SX;                         // low E on the left, as chord charts are drawn
const fy = f => TY + (f - .5) * FY;                    // the middle of fret f (relative to the diagram's first fret)
function el(tag, attrs, parent) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

export const chordView = $("chordView");
const cards = { now: chordView.querySelector(".ch-now"), next: chordView.querySelector(".ch-next") };
const beatsEl = $("chordBeatsShown");

// The fixed grid: six strings, four frets and the nut; a layer for the chord's marks on top
function buildDiagram(svg) {
  svg.setAttribute("viewBox", `0 0 ${2 * LX + 5 * SX} ${TY + FRETS * FY + 6}`);
  for (let st = 0; st < 6; st++) el("line", { class: "str", x1: sx(st), x2: sx(st), y1: TY, y2: TY + FRETS * FY }, svg);
  for (let f = 1; f <= FRETS; f++) el("line", { class: "fret", x1: sx(0), x2: sx(5), y1: TY + f * FY, y2: TY + f * FY }, svg);
  const nut = el("line", { class: "nut", x1: sx(0) - 1, x2: sx(5) + 1, y1: TY, y2: TY }, svg);
  const base = el("text", { class: "base", x: sx(5) + 6, y: fy(1) + 3 }, svg);
  return { svg, nut, base, marks: el("g", { class: "marks" }, svg) };
}
const diagrams = { now: buildDiagram(cards.now.querySelector("svg")), next: buildDiagram(cards.next.querySelector("svg")) };

// Draws chord `name` in diagram `d`. show: the fingering (dots, open and muted marks); numbers: finger numbers
function drawChord(d, name, show, numbers) {
  const v = CHORDS[name].voicings[0], first = v.base;
  d.marks.textContent = "";
  d.nut.style.display = first === 1 ? "" : "none";
  d.base.textContent = first === 1 ? "" : `${first}fr`;
  if (!show) return;
  v.frets.forEach((f, st) => {
    if (f < 0) el("path", { class: "muted", d: `M${sx(st) - 3.5} ${TY - 13.5}l7 7m0 -7l-7 7` }, d.marks);
    else if (f === 0) el("circle", { class: "open", cx: sx(st), cy: TY - 10, r: 3.6 }, d.marks);
    else {
      const g = el("g", { class: "dot", transform: `translate(${sx(st)} ${fy(f - first + 1)})` }, d.marks);
      el("circle", { r: 6.6 }, g);
      if (numbers) el("text", {}, g).textContent = v.fingers[st];
    }
  });
}

// Both chords always drawn in full, with finger numbers: no eye in this exercise (SPEC §17.4)
let shown = null;
export function drawChords(now, next, beat, beats) {
  const key = `${now}|${next}`;
  if (key !== shown) {
    shown = key;
    cards.now.querySelector(".ch-name").textContent = now;
    cards.next.querySelector(".ch-name").textContent = next;
    drawChord(diagrams.now, now, true, true);
    drawChord(diagrams.next, next, true, true);
  }
  // One dot per tick of the chord: the current one filled, the last one marked (the change comes after it)
  if (beatsEl.childElementCount !== beats) {
    beatsEl.textContent = "";
    for (let i = 0; i < beats; i++) beatsEl.appendChild(document.createElement("i")).classList.toggle("last", i === beats - 1);
  }
  [...beatsEl.children].forEach((b, i) => b.classList.toggle("on", i === beat));
}
export function showChordView(on) {
  chordView.hidden = !on;
  if (!on) shown = null;
}
