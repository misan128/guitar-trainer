// The fretboard (SPEC §13.3): built once per round, then each beat only toggles classes.
// Along the neck (SPEC §15.6) it also slides between zones and shows the neck bar.
import { inputs, boardEl, mainEl } from "./dom.js";
import { settings, T } from "./state.js";
const { STRING_NAMES, PENTA_MAX_FRET } = Theory;

const SVG_NS = "http://www.w3.org/2000/svg";
const FW = 54, SS = 16, LM = 18, TM = 8;     // fret width, string spacing, left and top margins
// The board on screen: its round, and the parts of its zone that each beat changes
export const view = { round: null, parts: null };
function el(tag, attrs, parent) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}
const bx = (round, f) => LM + (f - round.board.from + .5) * FW;
const by = st => TM + (5 - st) * SS;        // high e on top
// The board has a fixed part (strings, their names, fret wires) and a zone (fret numbers, the nut or the
// zone's edge, the route and its positions). Along the neck, zones slide in and out (slideBoard).
let zoneSeq = 0;
export function buildBoard(round) {
  view.round = round;
  const { from, to } = round.board, n = to - from + 1;
  const w = LM + n * FW + 4, bottom = TM + 5 * SS;
  boardEl.setAttribute("viewBox", `0 0 ${w} ${bottom + (round.neckBar ? BAR_GAP + 16 : 22)}`);
  boardEl.textContent = "";
  for (let st = 0; st < 6; st++) {
    el("line", { class: "str", x1: LM, x2: w - 4, y1: by(st), y2: by(st), "stroke-width": 1.8 - st * .2 }, boardEl);
    el("text", { x: LM / 2 - 2, y: by(st) + 3.5 }, boardEl).textContent = STRING_NAMES[st];
  }
  for (let i = 1; i <= n; i++) el("line", { class: "fret", x1: LM + i * FW, x2: LM + i * FW, y1: by(5) - 2, y2: bottom + 2 }, boardEl);
  neckBar = null;
  if (round.neckBar) buildBar(n);
  view.parts = buildZone(round);
  view.parts.cols = n;
  drawBar(round, null);
  boardEl.removeAttribute("hidden");   // SVG has no .hidden property
  mainEl.classList.add("with-board");
}
function buildZone(round) {
  const { from, to } = round.board, n = to - from + 1, bottom = TM + 5 * SS;
  const zone = el("g", { class: "zone" }, boardEl);
  // With fret 0 the first column is the open strings, left of the nut; otherwise the zone's first wire is its edge
  if (from === 0) el("line", { class: "nut", x1: LM + FW, x2: LM + FW, y1: by(5) - 2, y2: bottom + 2 }, zone);
  else el("line", { class: "edge", x1: LM, x2: LM, y1: by(5) - 2, y2: bottom + 2 }, zone);
  for (let f = from; f <= to; f++) el("text", { x: bx(round, f), y: bottom + 18 }, zone).textContent = f;
  // Built once per round; each beat only toggles classes and moves the gradient's end points
  const gradId = `nextMove${++zoneSeq}`;
  const grad = el("linearGradient", { id: gradId, gradientUnits: "userSpaceOnUse" }, el("defs", {}, zone));
  el("stop", { class: "grad-near", offset: 0 }, grad);
  el("stop", { class: "grad-far", offset: 1 }, grad);
  const path = el("g", { class: "path" }, zone);
  const up = round.walk.slice(0, round.peak + 1);
  // Moves along a string are solid; string changes are dashed and fainter
  const segs = [];
  for (let i = 1; i < up.length; i++) {
    const a = up[i - 1], b = up[i];
    segs.push(el("line", { class: a.st === b.st ? "same" : "cross", x1: bx(round, a.f), y1: by(a.st), x2: bx(round, b.f), y2: by(b.st) }, path));
  }
  const active = el("line", { class: "active", stroke: `url(#${gradId})` }, path);   // current → next, with the gradient
  // One fixed group per position: a quiet dot, and a gold layer with the note name that lights up when current
  const pos = up.map(p => {
    const g = el("g", { class: "pos", transform: `translate(${bx(round, p.f)} ${by(p.st)})` }, zone);
    el("circle", { class: "dot", r: 6 }, g);
    el("text", { class: "name" }, g).textContent = p.name;     // shown at aid level 1
    if (p.root) el("circle", { class: "ring", r: 8.6 }, g);   // roots: a thin second ring (SPEC §15.4)
    if (p.f === 0) g.classList.add("open");                    // open string: hollow dot
    const lit = el("g", { class: "lit" }, g);
    el("circle", { r: 9 }, lit);
    el("text", {}, lit).textContent = p.name;
    return g;
  });
  zone.classList.toggle("open-pos", up.some(p => p.f === 0));
  return { zone, path, segs, active, grad, pos, from };
}
// Along the neck (SPEC §15.6): on the last note of a shape, its zone slides out in the direction of travel
// while the next shape's zone slides in from the other side, fret numbers and positions together; the
// strings and fret wires stay. It runs in the second half of that beat, so the next shape's first note
// finds its zone in place. No slide when notes come faster than 250 ms, or with reduced motion: then the
// next shape simply replaces this one when it starts.
export function slideBoard(next, beat) {
  const n = next.board.to - next.board.from + 1;
  if (beat < .25 || n !== view.parts.cols || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const old = view.parts, dx = (next.board.from - old.from) * FW;
  const incoming = buildZone(next);
  incoming.cols = n;
  incoming.pendingShape = next.shape;
  const delay = beat * 400, dur = Math.min(500, beat * 550);
  const ease = `${dur}ms cubic-bezier(.45, 0, .25, 1) ${delay}ms`;
  Object.assign(incoming.zone.style, { transform: `translateX(${dx}px)`, opacity: 0 });
  view.parts = incoming;
  drawBoard(next, -1);                // the next shape's start, lit, as it arrives
  slideBar(next, ease);
  incoming.zone.getBoundingClientRect();
  for (const z of [old.zone, incoming.zone]) z.style.transition = `transform ${ease}, opacity ${ease}`;
  Object.assign(old.zone.style, { transform: `translateX(${-dx}px)`, opacity: 0 });
  Object.assign(incoming.zone.style, { transform: "translateX(0)", opacity: 1 });
  setTimeout(() => old.zone.remove(), delay + dur + 50);
}
// Along the neck: under the fret numbers, a thin line is the whole neck (frets 0–16) and a gold bar the
// part of it on screen, with the shape's number. On the way down the gold bar gets a point on the side it
// will move to, and a faint bar with the next shape's number shows where the next zone lies. The bar slides
// with the zone. Like a scroll bar: the fretboard is a window on the neck.
const BAR_FRETS = PENTA_MAX_FRET + 1, BAR_GAP = 30, BAR_H = 1.75, HEAD_H = 3.5, HEAD_L = 6;
let neckBar = null;
function buildBar(n) {
  const y = TM + 5 * SS + BAR_GAP, x0 = LM, span = n * FW;
  const x = f => x0 + f / BAR_FRETS * span, wide = n / BAR_FRETS * span;
  const g = el("g", { class: "neckbar" }, boardEl);
  el("line", { class: "neck", x1: x0, x2: x0 + span, y1: y, y2: y }, g);
  const part = cls => {
    const p = el("g", { class: cls }, g);
    el("rect", { x: 0, y: y - BAR_H, width: wide, height: 2 * BAR_H, rx: BAR_H }, p);
    el("text", { x: wide / 2, y: y + 11 }, p);
    return p;
  };
  const ghost = part("ghost"), thumb = part("thumb");
  const head = el("path", { class: "head" }, thumb);
  neckBar = { x, y, wide, ghost, thumb, head };
}
function placeBar(p, round) {
  p.style.transform = `translateX(${neckBar.x(round.board.from)}px)`;
  p.querySelector("text").textContent = round.shape;
}
export function drawBar(round, next) {
  if (!neckBar) return;
  const { thumb, ghost, head, y, wide } = neckBar;
  placeBar(thumb, round);
  ghost.classList.toggle("on", !!next);
  head.classList.toggle("on", !!next);
  if (!next) return;
  placeBar(ghost, next);
  // The point, on the bar's edge toward the next zone
  const up = next.board.from > round.board.from, edge = up ? wide - BAR_H : BAR_H, tip = up ? wide + HEAD_L : -HEAD_L;
  head.setAttribute("d", `M${edge} ${y - HEAD_H} L${tip} ${y} L${edge} ${y + HEAD_H} Z`);
}
function slideBar(next, ease) {
  if (!neckBar) return;
  neckBar.thumb.style.transition = `transform ${ease}`;
  placeBar(neckBar.thumb, next);
  neckBar.ghost.classList.remove("on");
  neckBar.head.classList.remove("on");
}

// w: walk index; -1 during prep, -2 during wait (both show the start position)
// reveal: show the path even with the eye closed (dev mode inspection)
// Walk index → position on the route (the way down reuses the way up)
const posOf = (round, i) => i <= round.peak ? i : 2 * round.peak - i;
// w = -3: idle preview, the whole route with nothing lit (Pentatonic shapes)
export function drawBoard(round, w, reveal = settings.showAll) {
  const { path, segs, active, grad, pos } = view.parts;
  boardEl.classList.toggle("names-all", settings.aid === 1);
  boardEl.classList.toggle("names-none", settings.aid === 3);
  if (w === -3) {
    path.style.display = "";
    pos.forEach(g => { g.style.display = ""; g.classList.remove("cur", "played", "next"); });
    segs.forEach(sg => sg.classList.remove("played"));
    active.style.display = "none";
    boardEl.setAttribute("aria-label", T.boardAria(round.board.from, round.board.to));
    return;
  }
  // Fade from the tempo: never longer than a third of a beat, none when notes come faster than 250 ms
  const beat = 60 / Number(inputs.bpm.value), fade = beat < .25 ? 0 : Math.min(120, beat * 330);
  if (view.parts.fade !== fade) boardEl.style.setProperty("--fade", `${view.parts.fade = fade}ms`);
  path.style.display = reveal ? "" : "none";
  const curIdx = reveal && w >= 0 ? w : 0;      // eye closed: start position only
  const c = posOf(round, curIdx), down = w > round.peak;
  // Played: behind the current position in the current direction (prep: nothing yet; wait: everything)
  const played = j => w === -2 || (w >= 0 && (down ? j > c : j < c));
  pos.forEach((g, j) => {
    g.style.display = reveal || j === 0 ? "" : "none";
    g.classList.toggle("cur", j === c);
    g.classList.toggle("played", reveal && j !== c && played(j));
  });
  segs.forEach((s, j) => s.classList.toggle("played", w === -2 || (w >= 0 && (down ? j >= c : j + 1 <= c))));
  // The next move: during prep it is the first step of the walk; none after the last note or during the wait
  const n = w === -1 ? 1 : w >= 0 && w < round.walk.length - 1 ? w + 1 : -1;
  active.style.display = reveal && n >= 0 ? "" : "none";
  pos.forEach((g, j) => g.classList.toggle("next", reveal && n >= 0 && j === posOf(round, n) && j !== c));
  if (reveal && n >= 0) {
    const p = round.walk[curIdx], q = round.walk[n];
    const pts = { x1: bx(round, p.f), y1: by(p.st), x2: bx(round, q.f), y2: by(q.st) };
    for (const k in pts) { active.setAttribute(k, pts[k]); grad.setAttribute(k, pts[k]); }
  }
  boardEl.setAttribute("aria-label", T.boardAria(round.board.from, round.board.to));
}
export function hideBoard() {
  boardEl.setAttribute("hidden", "");
  view.round = null;
  mainEl.classList.remove("with-board");
}
