// Shared controls: BPM and ticks (steppers and slider), the eye (aid level) and the language
import { inputs, bpmRange, showAllEl, langEl, toggleBtn } from "./dom.js";
import { settings, play, T, setLang, save, clampInput } from "./state.js";
import { renderKeys } from "./panels.js";
import { render, showIdle, drawTrack } from "./player.js";
import { refreshGuide } from "./guide.js";

for (const code in STRINGS) langEl.add(new Option(code.toUpperCase(), code));

// Everything that shows text, in the chosen language
export function applyLang(code = settings.lang) {
  setLang(code);
  langEl.value = code;
  document.documentElement.lang = code;
  document.title = T.title;
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = T[el.dataset.i18n]; });
  document.querySelectorAll("[data-i18n-aria]").forEach(el => el.setAttribute("aria-label", T[el.dataset.i18nAria]));
  toggleBtn.textContent = play.running ? T.stop : T.start;
  renderKeys();
  setAid(settings.aid);
  refreshGuide();
  if (play.running && play.lastShown) render(play.lastShown);
  else if (!play.running) showIdle();
}
langEl.addEventListener("change", () => { applyLang(langEl.value); save(); });

export function setAid(v) {
  settings.aid = v;
  settings.showAll = v <= 3;
  showAllEl.dataset.level = v;
  const label = `${T.aids}: ${T["aid" + v]}`;
  showAllEl.setAttribute("aria-label", label);
  showAllEl.title = label;
}
// Each tap closes the eye one step (less help); from closed it opens fully again
showAllEl.addEventListener("click", () => {
  setAid(settings.aid % 4 + 1);
  save();
  if (play.running && play.lastShown) render(play.lastShown);
  else if (!play.running) showIdle();
});

// Slider follows the BPM field; the gold fill is drawn in CSS from --fill
export function syncRange() {
  bpmRange.value = inputs.bpm.value;
  const min = Number(bpmRange.min), max = Number(bpmRange.max);
  bpmRange.style.setProperty("--fill", `${(bpmRange.value - min) / (max - min) * 100}%`);
}
export function setBpm(v) {
  inputs.bpm.value = v;
  clampInput(inputs.bpm);
  syncRange();
  save();
}

// − / +: a press steps once; holding repeats until release (mouse and touch).
// The click that follows a pointer press is ignored, so a tap never counts twice.
function stepInput(b) {
  const el = inputs[b.dataset.target], before = el.value;
  if (el.disabled) return false;
  el.value = Number(el.value) + Number(b.dataset.delta);
  clampInput(el);
  if (el.value === before) return false;   // at the limit
  if (el === inputs.bpm) syncRange();
  save();
  if (!play.running) drawTrack(-1);
  return true;
}
let repeatTimer = null, heldBtn = null;
function stopRepeat() {
  clearTimeout(repeatTimer);
  const b = heldBtn;
  if (b) {                               // skip the one click this press leaves behind
    b.classList.remove("held");
    b.skipClick = true;
    setTimeout(() => { b.skipClick = false; }, 500);
  }
  repeatTimer = heldBtn = null;
}
document.querySelectorAll(".stepper button").forEach(b => {
  b.addEventListener("pointerdown", e => {
    if (e.button !== 0) return;
    e.preventDefault();                  // no text selection or long-press menu
    stopRepeat();
    b.setPointerCapture(e.pointerId);
    heldBtn = b;
    b.classList.add("held");
    if (!stepInput(b)) return;
    const repeat = delay => { repeatTimer = setTimeout(() => stepInput(b) ? repeat(70) : stopRepeat(), delay); };
    repeat(400);
  });
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) b.addEventListener(ev, stopRepeat);
  // Keyboard activation (Enter/Space) only: browsers differ in how they mark the click after a tap
  b.addEventListener("click", () => { if (b.skipClick) b.skipClick = false; else stepInput(b); });
});
window.addEventListener("blur", stopRepeat);
for (const k in inputs) inputs[k].addEventListener("change", () => {
  clampInput(inputs[k]);
  if (k === "bpm") syncRange();
  save();
  if (!play.running) drawTrack(-1);
});

// Slider: tap anywhere to jump there, then drag. Handled here because iOS only moves the thumb natively.
const THUMB = 27;
function rangeFromPointer(e) {
  const r = bpmRange.getBoundingClientRect();
  const t = Math.min(1, Math.max(0, (e.clientX - r.left - THUMB / 2) / (r.width - THUMB)));
  const min = Number(bpmRange.min), max = Number(bpmRange.max), v = Math.round(min + t * (max - min));
  if (v !== Number(inputs.bpm.value)) setBpm(v);
}
bpmRange.addEventListener("pointerdown", e => {
  if (e.button !== 0) return;
  e.preventDefault();
  bpmRange.setPointerCapture(e.pointerId);
  bpmRange.classList.add("dragging");
  bpmRange.focus({ preventScroll: true });
  rangeFromPointer(e);
});
bpmRange.addEventListener("pointermove", e => { if (bpmRange.hasPointerCapture(e.pointerId)) rangeFromPointer(e); });
bpmRange.addEventListener("lostpointercapture", () => bpmRange.classList.remove("dragging"));
bpmRange.addEventListener("input", () => setBpm(bpmRange.value));   // keyboard on the slider
