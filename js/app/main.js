// Guitar Trainer: loads the settings, wires the keyboard, draws the first view. The rest lives in the
// other modules of js/app/; music theory in js/theory.js and the texts in js/strings.js (classic scripts).
import { inputs, keyPanel, boardPanel } from "./dom.js";
import { settings, play, load, DEV, FIFTHS, ZONE_MIN } from "./state.js";
import { audio } from "./audio.js";
import { buildRound, newRound } from "./rounds.js";
import { buildBoard, drawBoard } from "./board.js";
import { queue, render, playTick, start, stop, stopScheduler, startScheduler } from "./player.js";
import { closePanel, closeBoard, renderBoardPanel } from "./panels.js";
import { applyLang, setBpm, syncRange } from "./controls.js";
import { guideOpen, openGuide, closeGuide } from "./guide.js";
import { tunerOpen, closeTuner } from "./tuner.js";
import { menuOpen, closeMenu, applyTheme } from "./menu.js";
import { helpOpen, closeHelp } from "./help.js";

load();
applyTheme();
syncRange();

document.addEventListener("keydown", e => {
  if (e.target.tagName === "INPUT" && e.target.type === "number") return;
  if (e.target.tagName === "SELECT") return;
  if (e.target.closest("#dbgPanel")) return;   // dev mode panel
  if (helpOpen()) {                    // shortcuts are off while reading help
    if (e.key === "Escape") closeHelp(true);
    return;
  }
  if (guideOpen()) {                   // shortcuts are off during the guide
    if (e.key === "Escape") closeGuide();
    return;
  }
  if (!keyPanel.hidden || !boardPanel.hidden || tunerOpen() || menuOpen()) {   // shortcuts are off while a panel is open
    if (e.key === "Escape") { closePanel(true); closeBoard(true); closeTuner(true); closeMenu(true); }
    return;
  }
  if (e.code === "Space") { e.preventDefault(); if (!e.repeat) play.running ? stop() : start(); }
  if (e.key === "ArrowUp") { e.preventDefault(); setBpm(Number(inputs.bpm.value) + (e.shiftKey ? 5 : 1)); }
  if (e.key === "ArrowDown") { e.preventDefault(); setBpm(Number(inputs.bpm.value) - (e.shiftKey ? 5 : 1)); }
});

renderBoardPanel();
applyLang();                           // also draws the idle view

// ---- Dev mode bridge: only with ?debug in the URL (js/debug.js, docs/TESTING.md) ----
// Exposes just what the dev tool needs, then loads it. Without ?debug nothing is exposed or loaded.
if (DEV) {
  const s = settings;
  window.GuitarTrainerDev = {
    ZONE_MIN, FIFTHS, inputs,
    get running() { return play.running; },
    get paused() { return play.dbgPaused; }, set paused(v) { play.dbgPaused = v; },
    get ctx() { return audio.ctx; },
    get master() { return audio.master; }, set master(v) { audio.master = v; },
    get round() { return play.round; }, set round(v) { play.round = v; },
    get step() { return play.step; }, set step(v) { play.step = v; },
    get nextTime() { return play.nextTime; }, set nextTime(v) { play.nextTime = v; },
    get lastShown() { return play.lastShown; },
    get queue() { return queue; },
    get settings() { return { keys: s.keys, order: s.order, board: s.board, fretFrom: s.fretFrom, fretTo: s.fretTo, showAll: s.showAll,
                              aid: s.aid, lang: s.lang, exercise: s.exercise, shape: s.shapeNo, pentaKey: s.pentaKey, neckWalk: s.neckWalk }; },
    stopScheduler, startScheduler,
    render, playTick, buildRound, newRound, buildBoard, drawBoard,
  };
  document.body.appendChild(Object.assign(document.createElement("script"), { src: "js/debug.js" }));
}

if (!settings.guideSeen && !DEV) openGuide(false);   // in dev mode it would greet every new address

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
