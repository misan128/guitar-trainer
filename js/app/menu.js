// Menu (SPEC §18): language, theme, the guide and About, behind one button at the top right
import { $, menuBtn, helpBtn } from "./dom.js";
import { settings, play, save } from "./state.js";
import { applyLang } from "./controls.js";
import { tips } from "./guide.js";
import { openHelp } from "./help.js";
import { closePanel, closeBoard } from "./panels.js";
import { closeTuner } from "./tuner.js";

const panel = $("menuPanel"), mainView = $("menuMain"), aboutView = $("aboutView");
const langRow = $("langRow"), themeRow = $("themeRow");

// Languages by their own name (English, Euskara, Español)
for (const code in STRINGS) {
  const b = document.createElement("button");
  b.dataset.lang = code;
  b.lang = code;
  b.textContent = STRINGS[code].langName;
  langRow.appendChild(b);
}
langRow.addEventListener("click", e => {
  const b = e.target.closest("[data-lang]");
  if (!b || b.dataset.lang === settings.lang) return;
  applyLang(b.dataset.lang);           // also re-renders this panel
  save();
});

// Themes: sepia (the default), maple and steel
export function applyTheme() {
  document.documentElement.dataset.theme = settings.theme;
  document.querySelector('meta[name="theme-color"]').content = getComputedStyle(document.documentElement).getPropertyValue("--wood").trim();
  for (const b of themeRow.children) b.setAttribute("aria-pressed", String(b.dataset.theme === settings.theme));
}
themeRow.addEventListener("click", e => {
  const b = e.target.closest("[data-theme]");
  if (!b || b.dataset.theme === settings.theme) return;
  settings.theme = b.dataset.theme;
  applyTheme();
  save();
});

// After a language change: which language is pressed
export function renderMenu() {
  for (const b of langRow.children) b.setAttribute("aria-pressed", String(b.dataset.lang === settings.lang));
}

function showAbout(on) {
  mainView.hidden = on;
  aboutView.hidden = !on;
  (on ? $("aboutBack") : $("aboutBtn")).focus();
}
export function openMenu() {
  closePanel(false);
  closeBoard(false);
  closeTuner(false);
  renderMenu();
  mainView.hidden = false;
  aboutView.hidden = true;
  panel.hidden = false;
  menuBtn.setAttribute("aria-expanded", "true");
  (langRow.querySelector("[aria-pressed=true]") || langRow.firstChild).focus();
  tips(["menu"]);
}
export function closeMenu(refocus) {
  if (panel.hidden) return;
  panel.hidden = true;
  menuBtn.setAttribute("aria-expanded", "false");
  if (refocus) menuBtn.focus();
}
export const menuOpen = () => !panel.hidden;

menuBtn.addEventListener("click", () => panel.hidden ? openMenu() : closeMenu(true));
helpBtn.addEventListener("click", () => { closeMenu(false); openHelp(); });   // the page; the tour is linked from it
$("aboutBtn").addEventListener("click", () => showAbout(true));
$("aboutBack").addEventListener("click", () => showAbout(false));
document.addEventListener("pointerdown", e => {
  if (!panel.hidden && !panel.contains(e.target) && !menuBtn.contains(e.target) && !e.target.closest("#guide")) closeMenu(false);
});
