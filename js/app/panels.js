// The setup panel (exercise; keys for Scale walk; key, shape, variant and "along the neck" for Pentatonic)
// and the fretboard panel (Scale walk)
import { $, showAllEl, keyBtn, keyPanel, keyGrid, keyCount, keysAllBtn, keysClearBtn, walkSetup, pentaSetup, shapeGrid, shapeKey,
         pentaKeyGrid, placeRow, placeGrid, openHint, neckSwitch, inputs, boardBtn, boardPanel, boardSwitch,
         fretFromEl, fretToEl } from "./dom.js";
import { settings, T, save, setZone, voicingOf, FIFTHS, DEFAULT_KEY, FRET_FIRST_MAX, FRET_LAST_MAX, ZONE_MIN } from "./state.js";
import { variantOf, placeAt, chordPlan, progName, progKeyLabel } from "./rounds.js";
import { showIdle } from "./player.js";
import { miniDiagram } from "./chords.js";
import { tips } from "./guide.js";
const { KEYS, PENTA_SHAPES, MINOR_KEYS, pentaPlacements, pentaShape, CHORDS, CHORD_ROOTS, voicingFrets, PROGRESSIONS, progressionChords } = Theory;
const modeRow = $("chordMode"), pairSetup = $("pairSetup"), progSetup = $("progSetup"), progGrid = $("progGrid"), progKeyGrid = $("progKeyGrid");
const chordSetup = $("chordSetup"), beatsGrid = $("beatsGrid"), tiles = { A: $("tileA"), B: $("tileB") };
const picker = $("chordPicker"), rootGrid = $("rootGrid"), typeRow = $("typeRow"), posGrid = $("posGrid");
const CHORD_TYPES = [["", "chordMajor"], ["m", "chordMinor"], ["7", "chord7"]];
const POS_TEXT = { open: "posOpen", root6: "posRoot6", root5: "posRoot5", root4: "posRoot4" };
// A position's name and frets: "Open 0–2", "4th string 1–3"
const posText = v => { const [a, b] = voicingFrets(v); return [T[POS_TEXT[v.kind]], `${a}–${b}`]; };

// Key tiles, circle-of-fifths order
for (const idx of FIFTHS) {
  const b = document.createElement("button");
  b.textContent = KEYS[idx].name;
  b.dataset.key = idx;
  keyGrid.appendChild(b);
}
export function renderKeys() {
  const names = settings.keys.map(i => KEYS[i].name), ex = settings.exercise, penta = ex === "penta", chords = ex === "chords";
  keyBtn.textContent = chords ? chordPlan().label : penta ? shapeLabel(settings.shapeNo)
    : settings.keys.length === 1 ? T.keyName(names[0]) : settings.keys.length === 2 ? names.join(", ") : T.keysSummary(settings.keys.length);
  keyBtn.setAttribute("aria-label", `${chords ? T.exChords : penta ? T.shape : T.key}: ${keyBtn.textContent}`);
  for (const b of keyPanel.querySelectorAll("[data-ex]")) b.setAttribute("aria-pressed", String(b.dataset.ex === ex));
  walkSetup.hidden = ex !== "walk";
  pentaSetup.hidden = !penta;
  chordSetup.hidden = !chords;
  boardBtn.hidden = ex !== "walk";     // in Pentatonic the fretboard is the exercise, in Chords there is none
  showAllEl.hidden = chords;           // Chords: the diagrams are always shown in full (SPEC §17.4)
  // Two chords or a progression (SPEC §17.5)
  const prog = settings.chordMode === "prog";
  for (const b of modeRow.children) b.setAttribute("aria-pressed", String(b.dataset.mode === settings.chordMode));
  pairSetup.hidden = prog;
  progSetup.hidden = !prog;
  $("beatsLabel").textContent = prog ? T.progBeats : T.chordBeats;
  // Each progression: its name and its chords in the chosen key (each chord once: the blues is "A7 D7 E7")
  for (const b of progGrid.children) {
    const p = PROGRESSIONS.find(x => x.id === b.dataset.prog);
    b.setAttribute("aria-pressed", String(p.id === settings.progId));
    b.querySelector("span").textContent = progName(p);
    b.querySelector("small").textContent = [...new Set(progressionChords(p.id, settings.progKey).map(c => c.name))].join(" ");
  }
  const curProg = PROGRESSIONS.find(x => x.id === settings.progId), root = progKeyLabel(curProg).replace(/m$/, "");
  $("progKeyName").textContent = curProg.minor ? T.minorName(root) : T.keyName(root);
  for (const b of progKeyGrid.children) b.setAttribute("aria-pressed", String(Number(b.dataset.pc) === settings.progKey));
  // Each chord as a tile: its name, a small diagram of its position, and the position below
  for (const k of ["A", "B"]) {
    const name = settings["chord" + k], vi = voicingOf(name), [pos, frets] = posText(CHORDS[name].voicings[vi]);
    tiles[k].querySelector(".kt-name").textContent = name;
    tiles[k].querySelector(".kt-pos").textContent = `${pos} ${frets}`;
    tiles[k].setAttribute("aria-label", `${T["chord" + k]}: ${name}, ${pos} ${frets}`);
    miniDiagram(tiles[k].querySelector("svg"), name, vi);
  }
  if (!picker.hidden) renderPicker();
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
  tips(setupTours());
}
// The setup panel's tours: its exercise, and the progression's when it is showing
const setupTours = () => settings.exercise === "chords" && settings.chordMode === "prog" ? ["chords", "prog"] : [settings.exercise];
export function closePanel(refocus) {
  if (keyPanel.hidden) return;
  showPicker(null);
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
  showIdle();
  save();
  tips(setupTours());
});
// Chords (SPEC §17.1): tapping a tile opens the picker in the panel: the root, the type, and the positions as
// small diagrams. Every tap applies at once; choosing the other chord's chord swaps them.
let picking = null;                    // "A" | "B" while the picker is open
let pickedFrom = null;                 // its chord when the picker opened: what the other gets on a swap
function showPicker(k) {
  picking = k;
  pickedFrom = k && settings["chord" + k];
  picker.hidden = !k;
  keyPanel.classList.toggle("picking", !!k);
  if (k) { renderPicker(); (rootGrid.querySelector("[aria-pressed=true]") || rootGrid.firstChild).focus(); tips(["picker"]); }
}
function setChord(name) {
  const other = picking === "A" ? "B" : "A";
  // Reaching the other's chord swaps them; the other gets this one's chord from before (not a step on the way)
  if (name === settings["chord" + other]) settings["chord" + other] = pickedFrom;
  settings["chord" + picking] = name;
  renderKeys();
  showIdle();
  save();
}
function renderPicker() {
  const name = settings["chord" + picking], c = CHORDS[name];
  $("pickerTitle").textContent = T["chord" + picking];
  for (const b of rootGrid.children) b.setAttribute("aria-pressed", String(b.dataset.root === c.root));
  for (const b of typeRow.children) {
    b.setAttribute("aria-pressed", String(b.dataset.quality === c.quality));
    b.querySelector("span").textContent = T[CHORD_TYPES.find(([q]) => q === b.dataset.quality)[1]];
    b.querySelector("small").textContent = c.root + b.dataset.quality;
  }
  const cur = voicingOf(name);
  posGrid.textContent = "";
  c.voicings.forEach((v, i) => {
    const b = document.createElement("button"), [pos, frets] = posText(v);
    b.dataset.v = i;
    b.setAttribute("aria-pressed", String(i === cur));
    b.setAttribute("aria-label", `${name}: ${pos} ${frets}`);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "ch-diagram");
    svg.setAttribute("aria-hidden", "true");
    b.append(svg, Object.assign(document.createElement("span"), { textContent: pos }), Object.assign(document.createElement("small"), { textContent: frets }));
    miniDiagram(svg, name, i);
    posGrid.appendChild(b);
  });
}
for (const [root, pc] of CHORD_ROOTS) {
  const b = document.createElement("button");
  b.dataset.root = root;
  b.textContent = root;
  rootGrid.appendChild(b);
  const k = b.cloneNode(true);          // the progression's key: the same twelve roots
  delete k.dataset.root;
  k.dataset.pc = pc;
  progKeyGrid.appendChild(k);
}
for (const p of PROGRESSIONS) {
  const b = document.createElement("button");
  b.dataset.prog = p.id;
  b.append(document.createElement("span"), document.createElement("small"));
  progGrid.appendChild(b);
}
// Mode, progression and key: each tap applies at once
const chordsChanged = () => { renderKeys(); showIdle(); save(); };
modeRow.addEventListener("click", e => {
  const b = e.target.closest("[data-mode]");
  if (b && b.dataset.mode !== settings.chordMode) { settings.chordMode = b.dataset.mode; chordsChanged(); if (b.dataset.mode === "prog") tips(["prog"]); }
});
progGrid.addEventListener("click", e => {
  const b = e.target.closest("[data-prog]");
  if (b) { settings.progId = b.dataset.prog; chordsChanged(); }
});
progKeyGrid.addEventListener("click", e => {
  const b = e.target.closest("[data-pc]");
  if (b) { settings.progKey = Number(b.dataset.pc); chordsChanged(); }
});
for (const [quality] of CHORD_TYPES) {
  const b = document.createElement("button");
  b.dataset.quality = quality;
  b.append(document.createElement("span"), document.createElement("small"));
  typeRow.appendChild(b);
}
for (const k of ["A", "B"]) tiles[k].addEventListener("click", () => showPicker(k));
$("pickerBack").addEventListener("click", () => { const k = picking; showPicker(null); tiles[k].focus(); });
rootGrid.addEventListener("click", e => {
  const b = e.target.closest("[data-root]");
  if (b) setChord(b.dataset.root + CHORDS[settings["chord" + picking]].quality);
});
typeRow.addEventListener("click", e => {
  const b = e.target.closest("[data-quality]");
  if (b) setChord(CHORDS[settings["chord" + picking]].root + b.dataset.quality);
});
posGrid.addEventListener("click", e => {
  const b = e.target.closest("[data-v]");
  if (!b) return;
  settings.chordPos[settings["chord" + picking]] = Number(b.dataset.v);
  renderKeys();
  showIdle();
  save();
});
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
  if (!keyPanel.hidden && !keyPanel.contains(e.target) && !keyBtn.contains(e.target) && !e.target.closest("#guide")) closePanel(false);
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
  tips(["board"]);
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
  if (!boardPanel.hidden && !boardPanel.contains(e.target) && !boardBtn.contains(e.target) && !e.target.closest("#guide")) closeBoard(false);
});
