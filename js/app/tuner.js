// Tuner (SPEC §16): listens through the microphone while its panel is open and shows the nearest note and how
// many cents off; a row of reference buttons plays each open string. Pitch detection lives in js/pitch.js.
import { $, tunerBtn } from "./dom.js";
import { settings, play, T, save } from "./state.js";
import { audio, wakeAudio, playReference } from "./audio.js";
import { closePanel, closeBoard } from "./panels.js";
import { tips } from "./guide.js";
const { detectPitch, noteOf, SILENCE, TUNINGS } = Pitch;

const panel = $("tunerPanel"), stateEl = $("tunerState"), readEl = $("tunerRead"), noteEl = $("tunerNote");
const octEl = $("tunerOct"), centsEl = $("tunerCents"), needle = $("tunerNeedle"), refRow = $("tunerRef"), levelEl = $("tunerLevel");
const READ_MS = 50;                    // about 20 readings a second
const KEEP = 5;                        // the needle follows the median of the last readings
const IN_TUNE = 5;                     // cents

const SETTLE = 3;                      // readings before a note shows: the first ones after a silence are off
const HOLD_MS = 1500;                  // when the string fades, its last reading stays this long, dimmed…
const FADE_MS = 500;                   // …then fades out (as long as the CSS transition)

// Tuning row and reference row: the chosen tuning's open strings, low to high; tapping one plays it,
// microphone or not
// Each tuning: its name (data-i18n, filled with the language) and its notes, low to high
const tuningRow = $("tuningRow");
const TUNING_TEXT = { standard: "tuningStandard", halfDown: "tuningHalfDown", dropD: "tuningDropD", highD: "tuningHighD" };
for (const id in TUNINGS) {
  const b = document.createElement("button"), name = document.createElement("span"), notes = document.createElement("small");
  b.dataset.tuning = id;
  name.dataset.i18n = TUNING_TEXT[id];
  notes.textContent = TUNINGS[id].names.map(n => n.replace(/^./, c => c.toUpperCase())).join(" ");
  b.append(name, notes);
  tuningRow.appendChild(b);
}
function renderTuning() {
  const t = TUNINGS[settings.tuning];
  for (const b of tuningRow.children) b.setAttribute("aria-pressed", String(b.dataset.tuning === settings.tuning));
  refRow.textContent = "";
  t.midi.forEach((midi, st) => {
    const b = document.createElement("button");
    b.dataset.midi = midi;
    b.textContent = t.names[st];
    refRow.appendChild(b);
  });
}
renderTuning();
tuningRow.addEventListener("click", e => {
  const b = e.target.closest("[data-tuning]");
  if (!b || b.dataset.tuning === settings.tuning) return;
  settings.tuning = b.dataset.tuning;
  renderTuning();
  save();
});
// A note that is one of the tuning's strings is named as the string (E♭, not D♯)
function nameIn(n) {
  const t = TUNINGS[settings.tuning], st = t.midi.indexOf(n.midi);
  return st < 0 ? n.name : t.names[st].replace(/^./, c => c.toUpperCase());
}
refRow.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  const resumed = wakeAudio();         // inside the tap, as the browser requires
  (resumed || Promise.resolve()).catch(() => {}).then(() => playReference(Number(b.dataset.midi)));
});

let stream = null, source = null, analyser = null, timer = null, buf = null, readings = [], heldSince = 0, listenId = 0;
let fadeTimer = null;

function cancelFade() {
  clearTimeout(fadeTimer);
  fadeTimer = null;
  readEl.classList.remove("gone");
}

// Level: the input's loudness, from −60 dB (empty) to 0 dB (full), brighter above the silence threshold
function showLevel(rms) {
  const db = rms > 0 ? 20 * Math.log10(rms) : -60;
  levelEl.style.width = `${Math.max(0, Math.min(100, (db + 60) / 60 * 100))}%`;
  levelEl.classList.toggle("heard", rms >= SILENCE);
}

function setState(key) { stateEl.textContent = key ? T[key] : ""; }

// m: the reading as a fractional MIDI number, or null for none
function show(m) {
  readEl.classList.toggle("off", m == null);
  for (const b of refRow.children) b.classList.remove("near");
  if (m == null) {
    readEl.classList.remove("held");
    noteEl.textContent = "–";
    octEl.textContent = centsEl.textContent = "";
    needle.style.left = "50%";
    readEl.classList.remove("tuned");
    readEl.setAttribute("aria-label", T.tuner);
    return;
  }
  const n = noteOf(440 * Math.pow(2, (m - 69) / 12)), c = Math.round(n.cents), tuned = Math.abs(c) <= IN_TUNE;
  noteEl.textContent = nameIn(n);
  octEl.textContent = n.octave;
  centsEl.textContent = tuned ? T.tunerInTune : `${c > 0 ? "+" : ""}${c}`;
  needle.style.left = `${50 + n.cents}%`;
  readEl.classList.toggle("tuned", tuned);
  readEl.setAttribute("aria-label", `${nameIn(n)}${n.octave}: ${tuned ? T.tunerInTune : c < 0 ? T.tunerFlat(-c) : T.tunerSharp(c)}`);
  for (const b of refRow.querySelectorAll(`[data-midi="${n.midi}"]`)) b.classList.add("near");
}

function read() {
  analyser.getFloatTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  showLevel(Math.sqrt(sum / buf.length));
  const r = detectPitch(buf, audio.ctx.sampleRate);
  if (!r) {
    // The string has faded: its last reading stays a moment, dimmed, then clears. A new note starts afresh.
    if (readings.length >= SETTLE) { heldSince = performance.now(); readEl.classList.add("held"); }
    readings = [];
    if (heldSince && performance.now() - heldSince > HOLD_MS) {
      heldSince = 0;
      readEl.classList.add("gone");
      fadeTimer = setTimeout(() => { show(null); cancelFade(); }, FADE_MS);
    }
    return;
  }
  readings.push(69 + 12 * Math.log2(r.freq / 440));
  if (readings.length > KEEP) readings.shift();
  if (readings.length < SETTLE) return;
  heldSince = 0;
  cancelFade();
  readEl.classList.remove("held");
  const sorted = readings.slice().sort((a, b) => a - b);
  show(sorted[sorted.length >> 1]);
}

async function listen() {
  const id = ++listenId;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return setState("tunerNoMic");
  const resumed = wakeAudio();
  // iOS: recording needs the audio session to allow it; set back to playback when the tuner closes
  if (navigator.audioSession) navigator.audioSession.type = "play-and-record";
  let s;
  try {
    s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  } catch (e) {
    if (id === listenId) setState(e && (e.name === "NotAllowedError" || e.name === "SecurityError") ? "tunerBlocked" : "tunerNoMic");
    return;
  }
  if (id !== listenId) { s.getTracks().forEach(t => t.stop()); return; }   // closed meanwhile
  if (resumed) { try { await resumed; } catch (e) {} }
  stream = s;
  source = audio.ctx.createMediaStreamSource(stream);
  analyser = audio.ctx.createAnalyser();
  analyser.fftSize = 4096;
  buf = new Float32Array(analyser.fftSize);
  source.connect(analyser);           // analysed only: nothing goes to the speakers
  setState("tunerListening");
  timer = setInterval(read, READ_MS);
}

function stopListening() {
  listenId++;
  clearInterval(timer);
  timer = null;
  if (source) source.disconnect();
  if (stream) stream.getTracks().forEach(t => t.stop());   // the browser's recording indicator goes off
  stream = source = analyser = null;
  readings = [];
  heldSince = 0;
  cancelFade();
  readEl.classList.remove("held");
  showLevel(0);
  if (navigator.audioSession) navigator.audioSession.type = "playback";
}

export function openTuner() {
  if (play.running) return;
  closePanel(false);
  closeBoard(false);
  panel.hidden = false;
  tunerBtn.setAttribute("aria-expanded", "true");
  setState("");
  show(null);
  $("tunerDone").focus();
  listen();
  tips(["tuner"]);
}
export function closeTuner(refocus) {
  if (panel.hidden) return;
  stopListening();
  panel.hidden = true;
  tunerBtn.setAttribute("aria-expanded", "false");
  if (refocus) tunerBtn.focus();
}
export const tunerOpen = () => !panel.hidden;

tunerBtn.addEventListener("click", () => panel.hidden ? openTuner() : closeTuner(true));
$("tunerDone").addEventListener("click", () => closeTuner(true));
document.addEventListener("pointerdown", e => {
  if (!panel.hidden && !panel.contains(e.target) && !tunerBtn.contains(e.target) && !e.target.closest("#guide")) closeTuner(false);
});
// Leaving the page closes it, so the microphone never stays on in the background
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") closeTuner(false); });
