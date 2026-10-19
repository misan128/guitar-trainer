// Help (SPEC §21): a page that explains every control, to look things up whenever needed. It reuses the guide's
// and the tips' texts, so everything is worded the same, and shows the top bar's real icons.
import { $, keyBtn, showAllEl, boardBtn, tunerBtn, menuBtn } from "./dom.js";
import { play, T } from "./state.js";
import { openGuide } from "./guide.js";

const page = $("helpPage"), body = $("helpBody");
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const section = title => { const s = body.appendChild(el("section")); s.appendChild(el("h3", null, title)); return s; };
// A row: an icon (a copy of a real button's, or a short label) beside a title and a line
function row(parent, icon, title, text) {
  const r = parent.appendChild(el("div", "hp-row")), i = r.appendChild(el("span", "hp-icon"));
  if (typeof icon === "string") i.textContent = icon; else i.innerHTML = icon.innerHTML;
  const t = r.appendChild(el("div"));
  t.append(el("b", null, title), el("p", null, text));
  return t;
}
// The exercises' and tuner's entries: title and line, without an icon (they are inside panels, not on the bar)
function tip(parent, key) {
  const t = parent.appendChild(el("div", "hp-plain"));
  t.append(el("b", null, T[key + "Title"]), el("p", null, T[key + "Text"]));
}

function render() {
  body.textContent = "";
  let s = section(T.helpStartTitle);
  const ol = s.appendChild(el("ol", "hp-steps"));
  for (const k of ["helpStart1", "helpStart2", "helpStart3"]) ol.appendChild(el("li", null, T[k]));

  s = section(T.helpBarTitle);
  const key = row(s, keyBtn.textContent, T.guideKeysTitle, T.guideKeysText).parentNode;   // the setup button, with its own label
  key.classList.add("hp-keyrow");
  key.querySelector(".hp-icon").classList.add("hp-key");
  const eye = row(s, showAllEl, T.guideEyeTitle, T.guideEyeText);
  Object.assign(eye.parentNode.querySelector(".hp-icon"), { className: "hp-icon eye" }).dataset.level = 1;   // its drawing holds all four levels: show the open eye
  const legend = eye.appendChild(el("ul", "g-legend"));
  for (const n of [1, 2, 3, 4]) {
    const li = legend.appendChild(el("li")), icon = li.appendChild(el("span", "eye"));
    icon.dataset.level = n;
    icon.innerHTML = showAllEl.innerHTML;
    li.append(T["aid" + n]);
  }
  row(s, boardBtn, T.guideBoardTitle, T.guideBoardText);
  row(s, tunerBtn, T.guideTunerTitle, T.guideTunerText);
  row(s, menuBtn, T.menu, T.tipMenuHelpText);

  s = section(T.helpScreenTitle);
  s.appendChild(el("p", null, T.helpScreenText));
  const ul = s.appendChild(el("ul", "hp-list"));
  for (const k of ["helpBeats", "helpWait", "helpNeck"]) ul.appendChild(el("li", null, T[k]));
  s.appendChild(el("p", null, T.helpWhere));

  s = section(T.exChords);
  for (const k of ["tipChordsMode", "tipChordsTiles", "tipPickerRoot", "tipPickerType", "tipPickerPos", "tipProgList", "tipProgKey"]) tip(s, k);
  s = section(T.exWalk);
  for (const k of ["tipWalkKeys", "tipWalkOrder", "tipBoardSwitch", "tipBoardZone"]) tip(s, k);
  s = section(T.exPenta);
  for (const k of ["tipPentaKey", "tipPentaShape", "tipPentaVariant"]) tip(s, k);
  s = section(T.tuner);
  for (const k of ["tipTunerRead", "tipTunerTuning", "tipTunerRef"]) tip(s, k);

  // Shortcuts: only with a keyboard and a mouse; on a phone they mean nothing
  if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
    s = section(T.helpKeysTitle);
    const keys = s.appendChild(el("dl", "hp-keys"));
    for (const [k, t] of [[T.keySpace, "helpKeySpace"], ["↑ ↓", "helpKeyArrows"], ["Shift + ↑ ↓", "helpKeyShift"]]) keys.append(el("dt", null, k), el("dd", null, T[t]));
  }
  $("helpTour").hidden = play.running;    // the tour never runs while practising
}

export function openHelp() {
  render();
  page.hidden = false;
  page.scrollTop = 0;
  $("helpClose").focus();
}
export function closeHelp(refocus) {
  if (page.hidden) return;
  page.hidden = true;
  if (refocus) menuBtn.focus();
}
export const helpOpen = () => !page.hidden;
// After a language change: the open page, in the new language
export function refreshHelp() { if (!page.hidden) render(); }

$("helpClose").addEventListener("click", () => closeHelp(true));
$("helpTour").addEventListener("click", () => { closeHelp(false); openGuide(true); });
