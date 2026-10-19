// Chords' setup (SPEC §17.1, §17.5): two chords or a progression; the chord tiles and their picker (root, type,
// positions as small diagrams); the progressions and their key; the ticks per chord or bar
import { $, keyPanel } from "../dom.js";
import { settings, T, voicingOf } from "../state.js";
import { chordPlan, progName, progKeyLabel } from "../rounds.js";
import { miniDiagram } from "../chords.js";
import { tips } from "../guide.js";
import { changed } from "../panels.js";
const { CHORDS, CHORD_ROOTS, voicingFrets, PROGRESSIONS, progressionChords } = Theory;

const modeRow = $("chordMode"), pairSetup = $("pairSetup"), progSetup = $("progSetup"), progGrid = $("progGrid"), progKeyGrid = $("progKeyGrid");
const beatsGrid = $("beatsGrid"), tiles = { A: $("tileA"), B: $("tileB") };
const picker = $("chordPicker"), rootGrid = $("rootGrid"), typeRow = $("typeRow"), posGrid = $("posGrid");
const CHORD_TYPES = [["", "chordMajor"], ["m", "chordMinor"], ["7", "chord7"]];
const POS_TEXT = { open: "posOpen", root6: "posRoot6", root5: "posRoot5", root4: "posRoot4" };
// A position's name and frets: "Open 0–2", "4th string 1–3"
const posText = v => { const [a, b] = voicingFrets(v); return [T[POS_TEXT[v.kind]], `${a}–${b}`]; };

// The top button: the chords ("Am ↔ C", "C · G · Am · F")
export const chordsLabel = () => chordPlan().label;

export function renderChordSetup() {
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
}

// ---- The picker: tapping a tile replaces the panel's content by one screen; every tap applies at once, and
// choosing the other chord's chord swaps them ----
let picking = null;                    // "A" | "B" while the picker is open
let pickedFrom = null;                 // its chord when the picker opened: what the other gets on a swap
export function showPicker(k) {
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
  changed();
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

// The twelve roots (the picker's, and again as the progression's key), the progressions and the chord types
for (const [root, pc] of CHORD_ROOTS) {
  const b = document.createElement("button");
  b.dataset.root = root;
  b.textContent = root;
  rootGrid.appendChild(b);
  const k = b.cloneNode(true);
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
for (const [quality] of CHORD_TYPES) {
  const b = document.createElement("button");
  b.dataset.quality = quality;
  b.append(document.createElement("span"), document.createElement("small"));
  typeRow.appendChild(b);
}

modeRow.addEventListener("click", e => {
  const b = e.target.closest("[data-mode]");
  if (!b || b.dataset.mode === settings.chordMode) return;
  settings.chordMode = b.dataset.mode;
  changed();
  if (b.dataset.mode === "prog") tips(["prog"]);
});
progGrid.addEventListener("click", e => {
  const b = e.target.closest("[data-prog]");
  if (b) { settings.progId = b.dataset.prog; changed(); }
});
progKeyGrid.addEventListener("click", e => {
  const b = e.target.closest("[data-pc]");
  if (b) { settings.progKey = Number(b.dataset.pc); changed(); }
});
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
  if (b) { settings.chordPos[settings["chord" + picking]] = Number(b.dataset.v); changed(); }
});
beatsGrid.addEventListener("click", e => {
  const b = e.target.closest("[data-beats]");
  if (b) { settings.chordBeats = Number(b.dataset.beats); changed(); }
});
