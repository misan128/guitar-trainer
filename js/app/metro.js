// Metronome: the beats of the bar as dots and, where the other exercises have their bars, one bar per beat
import { $, trackEl } from "./dom.js";

const view = $("metroView"), dotsEl = $("metroDots"), arm = $("mtArm");
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

// The pendulum: each beat it is at one side and crosses to the other in `sec`, so it reaches it on the next beat. The
// side is its own state, not the beat's number, so changing the bar's beats mid-play never makes it stall.
// Reset to the middle by restPendulum.
const REACH = 40;   // degrees each side
let swinging = false, side = -1;
export function swingTo(sec) {
  if (!swinging) {            // the first beat: start from its side, not from the middle
    swinging = true;
    side = -1;
    arm.style.transition = "none";
    arm.style.transform = `rotate(${side * REACH}deg)`;
    arm.getBoundingClientRect();
  }
  side = -side;
  arm.style.transition = `transform ${sec}s ease-in-out`;
  arm.style.transform = `rotate(${side * REACH}deg)`;
}
export function restPendulum() {
  swinging = false;
  arm.style.transition = "transform .3s ease-out";
  arm.style.transform = "rotate(0deg)";
}
