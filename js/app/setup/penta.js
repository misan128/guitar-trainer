// Pentatonic's setup (SPEC §15.1–15.2, §15.6): the minor key, the shape tiles, the variant and "along the neck"
import { shapeGrid, shapeKey, pentaKeyGrid, placeRow, placeGrid, openHint, neckSwitch } from "../dom.js";
import { settings, T } from "../state.js";
import { variantOf, placeAt } from "../rounds.js";
import { changed } from "../panels.js";
const { PENTA_SHAPES, MINOR_KEYS, pentaPlacements, pentaShape } = Theory;

// The top button: "A minor · Shape 1"
export const pentaLabel = () => `${T.minorName(MINOR_KEYS[settings.pentaKey].name)} · ${T.shapeName(settings.shapeNo)}`;

// Minor key tiles, circle-of-fifths order (A E B F♯ C♯ G♯ D♯ B♭ F C G D); one is always selected
MINOR_KEYS.forEach((k, i) => {
  const b = document.createElement("button");
  b.dataset.key = i;
  b.textContent = k.name;
  pentaKeyGrid.appendChild(b);
});
// Each shape tile: the number, a small diagram of the shape (roots stronger) and its frets
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

export function renderPentaSetup() {
  shapeKey.textContent = T.minorName(MINOR_KEYS[settings.pentaKey].name);
  for (const b of pentaKeyGrid.children) b.setAttribute("aria-pressed", String(Number(b.dataset.key) === settings.pentaKey));
  for (const b of shapeGrid.children) {
    const n = Number(b.dataset.shape), sh = pentaShape(n, settings.pentaKey, placeAt(settings.pentaKey, n));
    b.setAttribute("aria-pressed", String(n === settings.shapeNo));
    b.setAttribute("aria-label", T.shapeAria(n, sh.from, sh.to));
    b.querySelector("small").textContent = `${sh.from}–${sh.to}`;
  }
  neckSwitch.setAttribute("aria-checked", String(settings.neckWalk));
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
}

pentaKeyGrid.addEventListener("click", e => {
  const b = e.target.closest("[data-key]");
  if (b) { settings.pentaKey = Number(b.dataset.key); changed(); }
});
shapeGrid.addEventListener("click", e => {
  const b = e.target.closest("[data-shape]");
  if (b) { settings.shapeNo = Number(b.dataset.shape); changed(); }
});
placeGrid.addEventListener("click", e => {
  const b = e.target.closest("[data-from]");
  if (b) { settings.pentaPlace[`${settings.pentaKey}:${settings.shapeNo}`] = Number(b.dataset.from); changed(); }
});
neckSwitch.addEventListener("click", () => { settings.neckWalk = !settings.neckWalk; changed(); });
