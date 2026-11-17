// Metronome (no exercise active): its settings live on the main screen (SPEC §22), under the BPM: beats per bar,
// the accent on beat 1 and clicks per beat. They take effect at the next beat, so they can change while it plays.
import { $ } from "../dom.js";
import { settings, play, save, T } from "../state.js";
import { renderKeys, changed } from "../panels.js";
import { steppers } from "../controls.js";

const beatsIn = $("metroBeatsIn"), accentSwitch = $("accentSwitch"), subGrid = $("metroSubGrid");

export const metroLabel = () => T.exMetro;

export function renderMetroSetup() {
  beatsIn.value = settings.metroBeats;
  accentSwitch.setAttribute("aria-checked", String(settings.metroAccent));
  for (const b of subGrid.children) b.setAttribute("aria-pressed", String(Number(b.dataset.sub) === settings.metroSub));
}
// While it plays the view is left alone: the scheduler picks the change up at the next beat (liveMetro in player.js)
const apply = () => play.running ? (renderKeys(), save()) : changed();

// Held down, the beats step and repeat like the BPM (the generic stepper in controls.js calls this)
steppers.mbeat = delta => {
  const n = Math.min(8, Math.max(2, settings.metroBeats + delta));
  if (n === settings.metroBeats) return false;
  settings.metroBeats = n;
  apply();
  return true;
};
subGrid.addEventListener("click", e => {
  const b = e.target.closest("[data-sub]");
  if (b) { settings.metroSub = Number(b.dataset.sub); apply(); }
});
accentSwitch.addEventListener("click", () => { settings.metroAccent = !settings.metroAccent; apply(); });
