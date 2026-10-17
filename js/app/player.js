// Practising: the lookahead scheduler on the audio clock, the screen drawn in sync with what is heard,
// the bars under it, start and stop, and the idle view in between
import { noteEl, pickEl, phaseEl, trackEl, inputs, roundKeyEl, toggleBtn, keyBtn, boardBtn, helpBtn, boardEl } from "./dom.js";
import { settings, play, T, WALK, WALK_PEAK, clampInput } from "./state.js";
import { audio, wakeAudio, openBus, closeBus, click, playNote } from "./audio.js";
import { newRound, shapeRound, placeAt, roundLabel } from "./rounds.js";
import { view, buildBoard, drawBoard, slideBoard, drawBar, hideBoard } from "./board.js";
import { closePanel, closeBoard } from "./panels.js";
const { PENTA_SHAPES, createStartPicker, pentaNeckOrder, createNeckWalk } = Theory;

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.1;

// ---- Lookahead scheduler ----
let timerId = null;
export const queue = [];

// The sound of tick `st` of round `r` at `time`: reference note on announce, then clicks and walk notes
export function playTick(r, st, time, beat) {
  if (st === 0 && r.announce !== false) playNote(r.walk[0].midi, time);   // reference note
  const w = st - r.prep;
  if (w >= 0 && w < r.walk.length) {
    click(time, w === 0, true);              // soft click
    playNote(r.walk[w].midi, time, beat);
  } else {
    click(time, false, false);
  }
}

function scheduler() {
  while (play.nextTime < audio.ctx.currentTime + SCHEDULE_AHEAD) {
    const beat = 60 / Number(inputs.bpm.value);
    if (play.step === 0) play.round = newRound();
    playTick(play.round, play.step, play.nextTime, beat);
    queue.push({ time: play.nextTime, step: play.step, round: play.round });
    play.nextTime += beat;
    play.step = (play.step + 1) % play.round.total;
  }
  timerId = setTimeout(scheduler, LOOKAHEAD_MS);
}

// ---- Drawing synced to what is audible ----
let shownRound = null, rafId = null;
function draw() {
  if (!play.running) return;
  const now = audio.ctx.currentTime - (audio.ctx.outputLatency || 0);
  let current = null;
  while (queue.length && queue[0].time <= now) current = queue.shift();
  if (current) render(current);
  rafId = requestAnimationFrame(draw);
}
// For the dev tool: pause and resume the scheduler and the drawing
export function stopScheduler() { clearTimeout(timerId); cancelAnimationFrame(rafId); }
export function startScheduler() { scheduler(); rafId = requestAnimationFrame(draw); }

export function render(tick) {
  const { step, round } = tick;
  play.lastShown = tick;
  if (round !== shownRound) {
    shownRound = round;
    buildTrack(round.prep, round.wait, round.walk.length, round.peak);
    pickEl.setAttribute("hidden", "");
    noteEl.hidden = false;
  }
  const w = step - round.prep;
  const inWalk = w >= 0 && w < round.walk.length;
  noteEl.textContent = (inWalk && settings.aid <= 2 ? round.walk[w] : round.walk[0]).name;   // without fretboard: 1–2 follow, 3–4 start

  const k = roundLabel(round);
  const left = round.total - step;
  // Several keys: the key sits above the note and the wait announces the next one.
  // With the fretboard there is no note letter, so the key goes back into the phase line.
  const multi = !round.penta && play.session.keys.length > 1, keyAbove = multi && !round.board;
  roundKeyEl.hidden = !keyAbove;
  if (keyAbove) roundKeyEl.textContent = k;
  const pre = keyAbove ? "" : `${k} · `;
  if (step < round.prep) phaseEl.textContent = pre + T.phasePrep(round.prep - step);
  else if (inWalk) phaseEl.textContent = pre + (w <= round.peak ? T.phaseUp
    : round.nextShape ? `${T.phaseDown} · ${T.nextShape(T.shapeName(round.nextShape))}` : T.phaseDown);
  else phaseEl.textContent = multi ? T.phaseNextKey(T.keyName(round.next.name), left) : pre + T.phaseNext(left);
  if (round.board) {
    if (round !== view.round) {
      // The next shape's zone may already have slid in on the previous shape's last note
      if (view.parts && view.parts.pendingShape === round.shape && round.penta) { view.round = round; view.parts.pendingShape = null; }
      else buildBoard(round);
    }
    if (view.parts.pendingShape) {
      if (round.nextShape && w === round.walk.length - 1) return drawTrack(step);   // sliding to the next shape: leave it be
      buildBoard(round);              // moved back from the last note (dev mode): this shape again
    }
    drawBoard(round, inWalk ? w : step < round.prep ? -1 : -2);
    if (round.nextShape) {
      const { session } = play;
      round.nextRound ??= shapeRound(round.nextShape, session.pentaKey, placeAt(session.pentaKey, round.nextShape), 0, 0);
      drawBar(round, inWalk && w > round.peak ? round.nextRound : null);   // the next zone, on the way down
      if (w === round.walk.length - 1) slideBoard(round.nextRound, 60 / Number(inputs.bpm.value));
    }
  } else if (!boardEl.hasAttribute("hidden")) hideBoard();
  drawTrack(step);
}

// Bars: flat for prep and wait; rise and fall during the walk, peaking at its top note
function buildTrack(prep, wait, len = WALK, peak = WALK_PEAK) {
  trackEl.innerHTML = "";
  const add = (h, walk) => {
    const s = document.createElement("span");
    s.style.height = h + "%";
    if (walk) s.className = "walk";
    trackEl.appendChild(s);
  };
  for (let i = 0; i < prep; i++) add(14, false);
  for (let i = 0; i < len; i++) add(24 + (i <= peak ? i : 2 * peak - i) / peak * 75.6, true);
  for (let i = 0; i < wait; i++) add(14, false);
}
export function drawTrack(step) {
  if (step < 0) {
    const n = PENTA_SHAPES[settings.shapeNo].length;  // Pentatonic: the shape up and back down
    if (settings.exercise === "penta") buildTrack(Number(inputs.prep.value), settings.neckWalk ? 0 : Number(inputs.wait.value), 2 * n - 1, n - 1);
    else buildTrack(Number(inputs.prep.value), Number(inputs.wait.value));
  }
  [...trackEl.children].forEach((s, i) => s.classList.toggle("on", i === step));
}

// ---- Wake Lock: keep the screen on while running ----
let wakeLock = null;
async function lockScreen() {
  if (!("wakeLock" in navigator) || wakeLock) return;
  try {
    const lock = await navigator.wakeLock.request("screen");
    if (!play.running) { lock.release(); return; }
    wakeLock = lock;
    lock.addEventListener("release", () => { if (wakeLock === lock) wakeLock = null; });
  } catch (e) {}
}
function unlockScreen() {
  if (wakeLock) wakeLock.release().catch(() => {});
  wakeLock = null;
}
// The system drops the lock when the page is hidden; ask again on return.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && play.running) lockScreen();
});

// ---- Idle view: the pick for Scale walk; the selected shape on the fretboard for Pentatonic ----
export function showIdle() {
  if (settings.exercise === "penta") {
    const r = shapeRound(settings.shapeNo);
    r.neckBar = settings.neckWalk;
    buildBoard(r);
    drawBoard(r, -3);
    pickEl.setAttribute("hidden", "");
    phaseEl.textContent = `${roundLabel(r)} · ${T.frets(...r.frets)}`;
  } else {
    hideBoard();
    pickEl.removeAttribute("hidden");
    phaseEl.textContent = T.idle;
  }
  drawTrack(-1);
}

// ---- Start / stop ----
let runId = 0;
export async function start() {
  const resumed = wakeAudio();
  for (const k in inputs) clampInput(inputs[k]);
  closePanel(false);
  closeBoard(false);
  const s = settings, { pentaKey, shapeNo } = s;
  play.session = { keys: s.keys.slice(), order: s.order, names: {}, bag: [], pos: 0, last: null, upcoming: null,
                   board: s.board ? { from: s.fretFrom, to: s.fretTo } : null, pickStart: createStartPicker(),
                   exercise: s.exercise, shape: shapeNo, pentaKey, pentaAt: placeAt(pentaKey, shapeNo),
                   neck: s.exercise === "penta" && s.neckWalk ? createNeckWalk(pentaNeckOrder(pentaKey, n => placeAt(pentaKey, n)), shapeNo) : null,
                   neckNext: null };
  keyBtn.disabled = true;
  boardBtn.disabled = true;
  document.body.classList.add("practicing");
  helpBtn.disabled = true;
  play.running = true;
  const id = ++runId;
  toggleBtn.textContent = T.stop;
  toggleBtn.classList.add("running");
  lockScreen();
  if (resumed) {
    try { await resumed; } catch (e) {}
    if (!play.running || id !== runId) return;   // stopped or restarted meanwhile
  }
  openBus();
  play.step = 0;
  queue.length = 0;
  shownRound = null;
  play.lastShown = null;
  play.nextTime = audio.ctx.currentTime + 0.1;
  scheduler();
  rafId = requestAnimationFrame(draw);
}
export function stop() {
  play.running = false;
  play.dbgPaused = false;
  clearTimeout(timerId);
  cancelAnimationFrame(rafId);
  closeBus();
  unlockScreen();
  queue.length = 0;
  keyBtn.disabled = false;
  boardBtn.disabled = false;
  document.body.classList.remove("practicing");
  helpBtn.disabled = false;
  roundKeyEl.hidden = true;
  noteEl.hidden = true;
  showIdle();
  toggleBtn.textContent = T.start;
  toggleBtn.classList.remove("running");
}
toggleBtn.addEventListener("click", () => play.running ? stop() : start());
