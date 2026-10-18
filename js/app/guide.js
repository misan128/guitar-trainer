// First-use guide (SPEC §14): a cutout around each control with a short text
import { $, langEl, mainEl, boardEl, keyBtn, showAllEl, boardBtn, helpBtn, tunerBtn } from "./dom.js";
import { settings, play, T, save } from "./state.js";
import { closePanel, closeBoard } from "./panels.js";
import { closeTuner } from "./tuner.js";
import { applyLang } from "./controls.js";

const guideEl = $("guide"), guideSpot = $("guideSpot"), guideTip = $("guideTip"), guideNext = $("guideNext");
// The language step comes first so the rest is read in the chosen language; it is skipped when reopened with ?
const GUIDE = [
  { target: () => langEl, key: "guideLangPick", langs: true },
  { target: () => mainEl.classList.contains("with-board") ? boardEl : mainEl.classList.contains("with-chords") ? $("chordView") : document.querySelector(".display"), key: "guideRound" },
  { target: () => keyBtn, key: "guideKeys" },
  { target: () => showAllEl, key: "guideEye", legend: true, skip: () => showAllEl.hidden },
  { target: () => boardBtn, key: "guideBoard", skip: () => boardBtn.hidden },
  { target: () => tunerBtn, key: "guideTuner" },
  { target: () => helpBtn, key: "guideHelp" },
];
let steps = GUIDE, guideStep = 0, guideFromHelp = false;
const guideLangs = $("guideLangs");
for (const code in STRINGS) {
  const b = guideLangs.appendChild(document.createElement("button"));
  b.dataset.lang = code;
  b.lang = code;
  b.textContent = STRINGS[code].langName;
}
guideLangs.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  applyLang(b.dataset.lang);         // re-renders the step in the new language
  save();
});
function showStep() {
  const step = steps[guideStep], last = guideStep === steps.length - 1;
  $("guideTitle").textContent = T[step.key + "Title"];
  $("guideText").textContent = T[step.key + "Text"];
  guideNext.textContent = last ? T.guideDone : T.guideNext;
  guideLangs.hidden = !step.langs;
  // The aid levels, each eye with what it shows
  const legend = $("guideLegend");
  legend.hidden = !step.legend;
  legend.textContent = "";
  if (step.legend) for (const n of [1, 2, 3, 4]) {
    const li = document.createElement("li"), icon = document.createElement("span");
    icon.className = "eye";
    icon.dataset.level = n;
    icon.innerHTML = showAllEl.innerHTML;
    li.append(icon, T["aid" + n]);
    legend.appendChild(li);
  }
  for (const b of guideLangs.children) b.setAttribute("aria-pressed", String(b.dataset.lang === settings.lang));
  const dots = $("guideDots");
  dots.textContent = "";
  dots.setAttribute("aria-label", T.guideStep(guideStep + 1, steps.length));
  steps.forEach((_, i) => dots.appendChild(document.createElement("i")).classList.toggle("on", i === guideStep));
  placeGuide();
}
// Cutout around the target; bubble below it, or above when it does not fit
function placeGuide() {
  if (guideEl.hidden) return;
  const r = steps[guideStep].target().getBoundingClientRect(), pad = 6;
  Object.assign(guideSpot.style, { top: `${r.top - pad}px`, left: `${r.left - pad}px`, width: `${r.width + 2 * pad}px`, height: `${r.height + 2 * pad}px` });
  const tw = guideTip.offsetWidth, th = guideTip.offsetHeight, gap = 14;
  const below = r.bottom + pad + gap, above = r.top - pad - gap - th;
  guideTip.style.top = `${below + th <= innerHeight - 8 || above < 8 ? below : above}px`;
  guideTip.style.left = `${Math.min(innerWidth - tw - 16, Math.max(16, r.left + r.width / 2 - tw / 2))}px`;
}
export function openGuide(fromHelp) {
  if (play.running) return;
  closePanel(false);
  closeBoard(false);
  closeTuner(false);
  guideStep = 0;
  guideFromHelp = fromHelp;
  steps = GUIDE.filter(s => !(fromHelp && s.langs) && !(s.skip && s.skip()));
  guideEl.hidden = false;
  showStep();
  guideNext.focus();
}
export function closeGuide() {
  guideEl.hidden = true;
  settings.guideSeen = true;
  save();
  if (guideFromHelp) helpBtn.focus();
}
guideNext.addEventListener("click", () => {
  if (guideStep === steps.length - 1) return closeGuide();
  guideStep++;
  showStep();
});
$("guideSkip").addEventListener("click", closeGuide);
helpBtn.addEventListener("click", () => openGuide(true));
window.addEventListener("resize", placeGuide);

export const guideOpen = () => !guideEl.hidden;
// After a language change: the open step, in the new language
export function refreshGuide() { if (!guideEl.hidden) showStep(); }
