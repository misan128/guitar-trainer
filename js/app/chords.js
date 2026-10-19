// Chord changes (SPEC §17.4): two vertical chord diagrams, now (large) and next (small, muted), and at the
// bottom, where the other exercises have their bars, a timeline of the chords with the current one's ticks.
// The grid of a diagram is built once; changing chord only redraws its dots.
import { $, inputs } from "./dom.js";
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
const lineEl = $("chordLine");

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
// A small diagram (setup tiles, the picker's positions): the same drawing, dots without numbers
export function miniDiagram(svg, name, vi) {
  svg.textContent = "";
  drawChord(buildDiagram(svg), name, vi, true, false);
}

// Draws voicing vi of chord `name` in diagram `d`. show: the fingering (dots, barre, open and muted marks);
// numbers: finger numbers
function drawChord(d, name, vi, show, numbers) {
  const v = CHORDS[name].voicings[vi], first = v.base;
  d.marks.textContent = "";
  d.nut.style.display = first === 1 ? "" : "none";
  d.base.textContent = first === 1 ? "" : `${first}fr`;
  if (!show) return;
  // The barre: a rounded bar across its strings, with the first finger's number
  const b = v.barre;
  if (b) {
    const g = el("g", { class: "barre", transform: `translate(0 ${fy(b.fret - first + 1)})` }, d.marks);
    el("rect", { x: sx(b.from) - 6.6, y: -6.6, width: sx(b.to) - sx(b.from) + 13.2, height: 13.2, rx: 6.6 }, g);
    if (numbers) el("text", { x: (sx(b.from) + sx(b.to)) / 2 }, g).textContent = 1;
  }
  v.frets.forEach((f, st) => {
    if (b && f === b.fret && v.fingers[st] === 1) return;   // under the barre
    if (f < 0) el("path", { class: "muted", d: `M${sx(st) - 3.5} ${TY - 13.5}l7 7m0 -7l-7 7` }, d.marks);
    else if (f === 0) el("circle", { class: "open", cx: sx(st), cy: TY - 10, r: 3.6 }, d.marks);
    else {
      const g = el("g", { class: "dot", transform: `translate(${sx(st)} ${fy(f - first + 1)})` }, d.marks);
      el("circle", { r: 6.6 }, g);
      if (numbers) el("text", {}, g).textContent = v.fingers[st];
    }
  });
}

// now, next: { name, v } (chord and voicing). Both always drawn in full, with finger numbers: no eye in this
// exercise (SPEC §17.4)
let shown = null;
export function drawChords(now, next) {
  const key = `${now.name}:${now.v}|${next.name}:${next.v}`;
  if (key === shown) return;
  shown = key;
  cards.now.querySelector(".ch-name").textContent = now.name;
  cards.next.querySelector(".ch-name").textContent = next.name;
  drawChord(diagrams.now, now.name, now.v, true, true);
  drawChord(diagrams.next, next.name, next.v, true, true);
}
// The timeline (SPEC §17.4): every chord of the sequence as a chip, repeats grouped ("A7×4 D7×2 …"); the chip
// holding step i current, with one dot per tick of the bar inside it: beat filled (-1 none), the last one ringed
// when the change comes after it (lastBar). One highlight sits behind the current chip; on a change it slides to
// the next one, taking its size, while the ticks fold in one chip and unfold in the other: the change has a
// direction. At most 300 ms (less at fast tempos); none faster than 250 ms per tick, or with reduced motion.
let line = null, groups = [], chips = [], hl = null, current = -1;
const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
function setCurrent(g) { chips.forEach((c, j) => c.classList.toggle("on", j === g)); }
// Where the highlight goes: the chip's box with every chip already in its new state
function moveTo(g, animate) {
  lineEl.classList.add("instant");                      // measure the end state without transitions
  setCurrent(g);
  const c = chips[g], box = c && { left: c.offsetLeft, top: c.offsetTop, width: c.offsetWidth, height: c.offsetHeight };
  if (animate) { setCurrent(current); void lineEl.offsetWidth; }   // back to the start state…
  else if (box) Object.assign(hl.style, Object.fromEntries(Object.entries(box).map(([k, v]) => [k, v + "px"])));
  void lineEl.offsetWidth;
  lineEl.classList.remove("instant");
  if (!animate) return;
  void lineEl.offsetWidth;
  setCurrent(g);                                         // …and from there, everything moves together
  Object.assign(hl.style, Object.fromEntries(Object.entries(box).map(([k, v]) => [k, v + "px"])));
}
export function drawLine(seq, i, beat, dots, lastBar = true) {
  const key = seq.map(c => `${c.name}:${c.v}`).join(" ");
  if (key !== line) {
    line = key;
    groups = [];
    seq.forEach((c, j) => {
      const g = groups[groups.length - 1];
      if (g && g.name === c.name && g.v === c.v) g.to = j;
      else groups.push({ name: c.name, v: c.v, from: j, to: j });
    });
    lineEl.textContent = "";
    hl = lineEl.appendChild(document.createElement("em"));
    chips = groups.map(g => {
      const chip = lineEl.appendChild(document.createElement("span"));
      chip.append(g.to > g.from ? `${g.name}×${g.to - g.from + 1}` : g.name, document.createElement("b"));
      return chip;
    });
    current = -1;
  }
  chips.forEach(chip => {
    const ticks = chip.querySelector("b");
    if (ticks.childElementCount !== dots) ticks.replaceChildren(...Array.from({ length: dots }, () => document.createElement("i")));
  });
  const g = groups.findIndex(x => i >= x.from && i <= x.to);
  if (g !== current) {
    const tick = 60 / Number(inputs.bpm.value), animate = current >= 0 && g >= 0 && tick >= .25 && !still();
    lineEl.style.setProperty("--glide", `${Math.round(Math.min(300, tick * 300))}ms`);
    moveTo(g, animate);
    current = g;
  }
  chips.forEach((chip, j) => [...chip.querySelector("b").children].forEach((d, k) => {
    d.classList.toggle("now", j === g && k === beat);
    d.classList.toggle("last", j === g && lastBar && k === dots - 1);
  }));
}
// The highlight follows its chip when the screen changes size
addEventListener("resize", () => { if (current >= 0 && !lineEl.hidden) moveTo(current, false); });
export function showChordView(on) {
  chordView.hidden = lineEl.hidden = !on;
  if (!on) shown = line = null;
}
