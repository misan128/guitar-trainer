// The setup panel's frame (the exercise row; each exercise's setup lives in setup/walk.js, setup/penta.js and
// setup/chords.js), the main screen's second slot, and the fretboard panel (Scale walk)
import { $, showAllEl, keyBtn, keyPanel, keyGrid, walkSetup, pentaSetup, inputs, boardBtn, boardPanel, boardSwitch,
         fretFromEl, fretToEl } from "./dom.js";
import { settings, T, save, setZone, FRET_FIRST_MAX, FRET_LAST_MAX, ZONE_MIN } from "./state.js";
import { showIdle } from "./player.js";
import { tips } from "./guide.js";
import { walkLabel, renderWalkSetup } from "./setup/walk.js";
import { pentaLabel, renderPentaSetup } from "./setup/penta.js";
import { chordsLabel, renderChordSetup, showPicker } from "./setup/chords.js";

const chordSetup = $("chordSetup");

// Everything the setup shows, after any change: the top button, the exercise's section, and what the other
// controls do in this exercise
export function renderKeys() {
  const ex = settings.exercise, penta = ex === "penta", chords = ex === "chords";
  keyBtn.textContent = chords ? chordsLabel() : penta ? pentaLabel() : walkLabel();
  keyBtn.setAttribute("aria-label", `${chords ? T.exChords : penta ? T.shape : T.key}: ${keyBtn.textContent}`);
  for (const b of keyPanel.querySelectorAll("[data-ex]")) b.setAttribute("aria-pressed", String(b.dataset.ex === ex));
  walkSetup.hidden = ex !== "walk";
  pentaSetup.hidden = !penta;
  chordSetup.hidden = !chords;
  boardBtn.hidden = ex !== "walk";     // in Pentatonic the fretboard is the exercise, in Chords there is none
  showAllEl.hidden = chords;           // Chords: the diagrams are always shown in full (SPEC §17.4)
  // The main screen's second slot (SPEC §20): each exercise's own timing setting next to Ticks before. Scale walk:
  // Ticks after; Chords: ticks per chord or bar; Pentatonic: along the neck. (Pentatonic and Chords have no wait
  // between rounds, so Ticks after only applies to Scale walk.)
  const noWait = ex !== "walk";
  inputs.wait.disabled = noWait;
  for (const b of document.querySelectorAll('.stepper [data-target="wait"]')) b.disabled = noWait;
  inputs.wait.closest(".field").hidden = noWait;
  $("beatsField").hidden = !chords;
  $("neckField").hidden = !penta;
  renderWalkSetup();
  renderPentaSetup();
  renderChordSetup();
}
// After a choice that changes what is played: redraw the setup and the idle view, and save
export function changed() {
  renderKeys();
  showIdle();
  save();
}

// The setup panel's tours: its exercise, and the progression's when it is showing (SPEC §19)
const setupTours = () => settings.exercise === "chords" && settings.chordMode === "prog" ? ["chords", "prog"] : [settings.exercise];
function openPanel() {
  closeBoard(false);
  keyPanel.hidden = false;
  keyBtn.setAttribute("aria-expanded", "true");
  (keyGrid.querySelector("[aria-pressed=true]") || keyGrid.firstChild).focus();
  tips(setupTours());
}
export function closePanel(refocus) {
  if (keyPanel.hidden) return;
  showPicker(null);
  keyPanel.hidden = true;
  keyBtn.setAttribute("aria-expanded", "false");
  if (refocus) keyBtn.focus();
}
keyBtn.addEventListener("click", () => keyPanel.hidden ? openPanel() : closePanel(true));
keyPanel.querySelector(".kp-exercise").addEventListener("click", e => {
  const b = e.target.closest("[data-ex]");
  if (!b || b.dataset.ex === settings.exercise) return;
  settings.exercise = b.dataset.ex;
  changed();
  tips(setupTours());
});
// Tapping outside closes the panel (the guide's bubble does not count: it explains the panel)
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
