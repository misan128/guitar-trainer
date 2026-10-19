// Scale walk's setup (SPEC §12): the keys, in circle-of-fifths order, and their order
import { keyPanel, keyGrid, keyCount, keysAllBtn, keysClearBtn } from "../dom.js";
import { settings, T, save, FIFTHS, DEFAULT_KEY } from "../state.js";
import { renderKeys } from "../panels.js";
const { KEYS } = Theory;

// Key tiles, circle-of-fifths order
for (const idx of FIFTHS) {
  const b = document.createElement("button");
  b.textContent = KEYS[idx].name;
  b.dataset.key = idx;
  keyGrid.appendChild(b);
}
// The top button: "C major", "C, G", "5 keys"
export function walkLabel() {
  const names = settings.keys.map(i => KEYS[i].name);
  return settings.keys.length === 1 ? T.keyName(names[0]) : settings.keys.length === 2 ? names.join(", ") : T.keysSummary(settings.keys.length);
}
export function renderWalkSetup() {
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
keyGrid.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  const k = Number(b.dataset.key);
  if (settings.keys.includes(k) && settings.keys.length === 1) return;   // at least one key stays selected
  setKeys(settings.keys.includes(k) ? settings.keys.filter(i => i !== k) : settings.keys.concat(k));
});
keysAllBtn.addEventListener("click", () => setKeys(FIFTHS));
keysClearBtn.addEventListener("click", () => setKeys([DEFAULT_KEY]));   // back to C major
keyPanel.addEventListener("change", e => {
  if (e.target.name !== "order") return;
  settings.order = e.target.value;
  save();
});
