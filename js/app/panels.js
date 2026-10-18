// The setup panel (exercise; keys for Scale walk; key, shape, variant and "along the neck" for Pentatonic)
// and the fretboard panel (Scale walk)
import { $, keyBtn, keyPanel, keyGrid, keyCount, keysAllBtn, keysClearBtn, walkSetup, pentaSetup, shapeGrid, shapeKey,
         pentaKeyGrid, placeRow, placeGrid, openHint, neckSwitch, inputs, boardBtn, boardPanel, boardSwitch,
         fretFromEl, fretToEl } from "./dom.js";
import { settings, T, save, setZone, FIFTHS, DEFAULT_KEY, FRET_FIRST_MAX, FRET_LAST_MAX, ZONE_MIN } from "./state.js";
import { variantOf, placeAt } from "./rounds.js";
import { showIdle } from "./player.js";
import { setAid } from "./controls.js";
const { KEYS, PENTA_SHAPES, MINOR_KEYS, pentaPlacements, pentaShape, CHORD_NAMES } = Theory;
const chordSetup = $("chordSetup"), chordSel = { A: $("chordA"), B: $("chordB") }, beatsGrid = $("beatsGrid");

// Key tiles, circle-of-fifths order
for (const idx of FIFTHS) {
  const b = document.createElement("button");
  b.textContent = KEYS[idx].name;
  b.dataset.key = idx;
  keyGrid.appendChild(b);
}
export function renderKeys() {
  const names = settings.keys.map(i => KEYS[i].name), ex = settings.exercise, penta = ex === "penta", chords = ex === "chords";
  keyBtn.textContent = chords ? `${settings.chordA} ↔ ${settings.chordB}` : penta ? shapeLabel(settings.shapeNo)
    : settings.keys.length === 1 ? T.keyName(names[0]) : settings.keys.length === 2 ? names.join(", ") : T.keysSummary(settings.keys.length);
  keyBtn.setAttribute("aria-label", `${chords ? T.exChords : penta ? T.shape : T.key}: ${keyBtn.textContent}`);
  for (const b of keyPanel.querySelectorAll("[data-ex]")) b.setAttribute("aria-pressed", String(b.dataset.ex === ex));
  walkSetup.hidden = ex !== "walk";
  pentaSetup.hidden = !penta;
  chordSetup.hidden = !chords;
  boardBtn.hidden = ex !== "walk";     // in Pentatonic the fretboard is the exercise, in Chords there is none
  chordSel.A.value = settings.chordA;
  chordSel.B.value = settings.chordB;
  for (const b of beatsGrid.children) b.setAttribute("aria-pressed", String(Number(b.dataset.beats) === settings.chordBeats));
  shapeKey.textContent = T.minorName(MINOR_KEYS[settings.pentaKey].name);
  for (const b of pentaKeyGrid.children) b.setAttribute("aria-pressed", String(Number(b.dataset.key) === settings.pentaKey));
  for (const b of shapeGrid.children) {
    const n = Number(b.dataset.shape), sh = pentaShape(n, settings.pentaKey, placeAt(settings.pentaKey, n));
    b.setAttribute("aria-pressed", String(n === settings.shapeNo));
    b.setAttribute("aria-label", T.shapeAria(n, sh.from, sh.to));
    b.querySelector("small").textContent = `${sh.from}–${sh.to}`;
  }
  neckSwitch.setAttribute("aria-checked", String(settings.neckWalk));
  // Pentatonic and Chords have no wait between rounds (SPEC §15.3, §17.3), so Ticks after has no effect there
  const noWait = ex !== "walk";
  inputs.wait.disabled = noWait;
  for (const b of document.querySelectorAll('.stepper [data-target="wait"]')) b.disabled = noWait;
  inputs.wait.closest(".field").classList.toggle("off", noWait);
  // Variant: shown only when this key and shape fit in two places (SPEC §15.2)
  const places = pentaPlacements(settings.shapeNo, settings.pentaKey), cur = pentaShape(settings.shapeNo, settings.pentaKey, placeAt(settings.pentaKey, settings.shapeNo));
  placeRow.hidden = places.length < 2;
  openHint.hidden = !places.some(p => p.open);
  placeGrid.textContent = "";
  for (const p of places) {
    const b = document.createElement("button");
    b.dataset.from = p.from;
    b.setAttribute("aria-pressed", String(p.from === cur.from));
    b.textContent = `${T[variantOf(p, places)]} (${p.from}–${p.to})`;
    placeGrid.appendChild(b);
  }
  for (const b of keyGrid.children) b.setAttribute("aria-pressed", String(settings.keys.includes(Number(b.dataset.key))));
  keyCount.textContent = T.keysCount(settings.keys.length, KEYS.length);
  keysAllBtn.disabled = settings.keys.length === KEYS.length;
  keysClearBtn.disabled = settings.keys.length === 1 && settings.keys[0] === DEFAULT_KEY;
  for (const r of keyPanel.querySelectorAll("input[name=order]")) r.checked = r.value === settings.order;
}
function setKeys(next) {
  settings.keys = FIFTHS.filter(i => next.includes(i));
  renderKeys();
  save();
}
function openPanel() {
  closeBoard(false);
  keyPanel.hidden = false;
  keyBtn.setAttribute("aria-expanded", "true");
  (keyGrid.querySelector("[aria-pressed=true]") || keyGrid.firstChild).focus();
}
export function closePanel(refocus) {
  if (keyPanel.hidden) return;
  keyPanel.hidden = true;
  keyBtn.setAttribute("aria-expanded", "false");
  if (refocus) keyBtn.focus();
}
keyBtn.addEventListener("click", () => keyPanel.hidden ? openPanel() : closePanel(true));
keyGrid.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  const k = Number(b.dataset.key);
  if (settings.keys.includes(k) && settings.keys.length === 1) return;   // at least one key stays selected
  setKeys(settings.keys.includes(k) ? settings.keys.filter(i => i !== k) : settings.keys.concat(k));
});
keysAllBtn.addEventListener("click", () => setKeys(FIFTHS));
// ---- Pentatonic setup: exercise row and shape tiles (SPEC §15.1) ----
const shapeLabel = n => `${T.minorName(MINOR_KEYS[settings.pentaKey].name)} · ${T.shapeName(n)}`;
// Minor key tiles, circle-of-fifths order (A E B F♯ C♯ G♯ D♯ B♭ F C G D); one is always selected
MINOR_KEYS.forEach((k, i) => {
  const b = document.createElement("button");
  b.dataset.key = i;
  b.textContent = k.name;
  pentaKeyGrid.appendChild(b);
});
pentaKeyGrid.addEventListener("click", e => {
  const b = e.target.closest("[data-key]");
  if (!b) return;
  settings.pentaKey = Number(b.dataset.key);
  renderKeys();
  showIdle();
  save();
});
// Each tile: the number, a small diagram of the shape (roots stronger) and its frets
for (const n of Object.keys(PENTA_SHAPES).map(Number)) {
  const sh = pentaShape(n), cols = sh.to - sh.from + 1, b = document.createElement("button");
  b.dataset.shape = n;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 36 28");
  svg.setAttribute("aria-hidden", "true");
  for (let st = 0; st < 6; st++) {
    const y = 3 + (5 - st) * 4.4;
    svg.insertAdjacentHTML("beforeend", `<line x1="0" x2="36" y1="${y}" y2="${y}"/>`);
  }
  for (const p of sh.positions) {
    const x = (p.f - sh.from + .5) * 36 / cols, y = 3 + (5 - p.st) * 4.4;
    svg.insertAdjacentHTML("beforeend", `<circle cx="${x}" cy="${y}" r="${p.root ? 2.3 : 1.7}"${p.root ? ' class="root"' : ""}/>`);
  }
  b.append(document.createTextNode(n), svg, document.createElement("small"));
  shapeGrid.appendChild(b);
}
keyPanel.querySelector(".kp-exercise").addEventListener("click", e => {
  const b = e.target.closest("[data-ex]");
  if (!b || b.dataset.ex === settings.exercise) return;
  settings.exercise = b.dataset.ex;
  renderKeys();
  setAid(settings.aid);                // the eye's label says what it shows in this exercise
  showIdle();
  save();
});
// Chords (SPEC §17.1): the library in both dropdowns; choosing in one the other's chord swaps them
for (const k of ["A", "B"]) {
  for (const name of CHORD_NAMES) chordSel[k].add(new Option(name, name));
  chordSel[k].addEventListener("change", () => {
    const other = k === "A" ? "B" : "A", v = chordSel[k].value;
    if (v === settings["chord" + other]) settings["chord" + other] = settings["chord" + k];
    settings["chord" + k] = v;
    renderKeys();
    showIdle();
    save();
  });
}
beatsGrid.addEventListener("click", e => {
  const b = e.target.closest("[data-beats]");
  if (!b) return;
  settings.chordBeats = Number(b.dataset.beats);
  renderKeys();
  showIdle();
  save();
});
neckSwitch.addEventListener("click", () => {
  settings.neckWalk = !settings.neckWalk;
  renderKeys();
  showIdle();
  save();
});
placeGrid.addEventListener("click", e => {
  const b = e.target.closest("[data-from]");
  if (!b) return;
  settings.pentaPlace[`${settings.pentaKey}:${settings.shapeNo}`] = Number(b.dataset.from);
  renderKeys();
  showIdle();
  save();
});
shapeGrid.addEventListener("click", e => {
  const b = e.target.closest("[data-shape]");
  if (!b) return;
  settings.shapeNo = Number(b.dataset.shape);
  renderKeys();
  showIdle();
  save();
});
keysClearBtn.addEventListener("click", () => setKeys([DEFAULT_KEY]));   // back to C major
keyPanel.addEventListener("change", e => {
  if (e.target.name !== "order") return;
  settings.order = e.target.value;
  save();
});
// Tapping outside closes the panel
document.addEventListener("pointerdown", e => {
  if (!keyPanel.hidden && !keyPanel.contains(e.target) && !keyBtn.contains(e.target)) closePanel(false);
});
// ---- Fretboard panel ----
for (let f = 0; f <= FRET_FIRST_MAX; f++) fretFromEl.add(new Option(f, f));
export function renderBoardPanel() {
  boardBtn.classList.toggle("on", settings.board);
  boardSwitch.setAttribute("aria-checked", String(settings.board));
  fretFromEl.value = settings.fretFrom;
  fretToEl.length = 0;
  for (let f = settings.fretFrom + ZONE_MIN - 1; f <= FRET_LAST_MAX; f++) fretToEl.add(new Option(f, f));
  fretToEl.value = settings.fretTo;
}
function openBoard() {
  closePanel(false);
  boardPanel.hidden = false;
  boardBtn.setAttribute("aria-expanded", "true");
  boardSwitch.focus();
}
export function closeBoard(refocus) {
  if (boardPanel.hidden) return;
  boardPanel.hidden = true;
  boardBtn.setAttribute("aria-expanded", "false");
  if (refocus) boardBtn.focus();
}
boardBtn.addEventListener("click", () => boardPanel.hidden ? openBoard() : closeBoard(true));
boardSwitch.addEventListener("click", () => { settings.board = !settings.board; renderBoardPanel(); save(); });
fretFromEl.addEventListener("change", () => { setZone(Number(fretFromEl.value), settings.fretTo); renderBoardPanel(); save(); });
fretToEl.addEventListener("change", () => { setZone(settings.fretFrom, Number(fretToEl.value)); renderBoardPanel(); save(); });
$("boardDone").addEventListener("click", () => closeBoard(true));
document.addEventListener("pointerdown", e => {
  if (!boardPanel.hidden && !boardPanel.contains(e.target) && !boardBtn.contains(e.target)) closeBoard(false);
});
