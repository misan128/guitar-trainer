// Metronome: the beats of the bar as dots and, where the other exercises have their bars, one bar per beat
import { $, trackEl } from "./dom.js";

const view = $("metroView"), dotsEl = $("metroDots");
export function showMetro(on) { view.hidden = !on; }

// Draws the bar's `beats` (rebuilt only when their number changes) with beat `active` lit; -1: none
export function drawMetro(beats, active) {
  if (dotsEl.children.length !== beats || trackEl.dataset.kind !== "metro") {   // or the bars belong to another exercise
    trackEl.dataset.kind = "metro";
    dotsEl.innerHTML = trackEl.innerHTML = "";
    for (let i = 0; i < beats; i++) {
      const d = dotsEl.appendChild(document.createElement("span"));
      d.textContent = i + 1;
      if (i === 0) d.className = "first";
      const s = trackEl.appendChild(document.createElement("span"));
      s.style.height = i === 0 ? "100%" : "60%";
      if (i === 0) s.className = "walk";
    }
  }
  [...dotsEl.children].forEach((d, i) => d.classList.toggle("on", i === active));
  [...trackEl.children].forEach((s, i) => s.classList.toggle("on", i === active));
}
