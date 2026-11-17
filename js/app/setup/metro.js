// Metronome's setup (no exercise active): beats per bar, clicks per beat and the accent on beat 1.
// The top button names the bar: "Metronome · 4 × 2"
import { $ } from "../dom.js";
import { settings, T } from "../state.js";
import { changed } from "../panels.js";
import { setBpm } from "../controls.js";

const beatsGrid = $("metroBeatsGrid"), subGrid = $("metroSubGrid"), accentGrid = $("metroAccentGrid"), tapBtn = $("tapBtn");

export const metroLabel = () => T.metroLabel(settings.metroBeats, settings.metroSub);

export function renderMetroSetup() {
  for (const b of beatsGrid.children) b.setAttribute("aria-pressed", String(Number(b.dataset.mb) === settings.metroBeats));
  for (const b of subGrid.children) b.setAttribute("aria-pressed", String(Number(b.dataset.sub) === settings.metroSub));
  for (const b of accentGrid.children) b.setAttribute("aria-pressed", String((b.dataset.acc === "1") === settings.metroAccent));
}
beatsGrid.addEventListener("click", e => {
  const b = e.target.closest("[data-mb]");
  if (b) { settings.metroBeats = Number(b.dataset.mb); changed(); }
});
subGrid.addEventListener("click", e => {
  const b = e.target.closest("[data-sub]");
  if (b) { settings.metroSub = Number(b.dataset.sub); changed(); }
});
accentGrid.addEventListener("click", e => {
  const b = e.target.closest("[data-acc]");
  if (b) { settings.metroAccent = b.dataset.acc === "1"; changed(); }
});

// Tap tempo: the average of the last taps; a pause of two seconds starts again
let taps = [];
tapBtn.addEventListener("click", () => {
  const now = performance.now();
  if (taps.length && now - taps[taps.length - 1] > 2000) taps = [];
  taps = [...taps, now].slice(-5);
  if (taps.length >= 2) setBpm(Math.round(60000 / ((taps[taps.length - 1] - taps[0]) / (taps.length - 1))));
});
