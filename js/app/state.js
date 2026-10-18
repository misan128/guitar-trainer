// Settings (saved in localStorage), the current language, and the state shared while practising.
// Other modules read and change `settings` and `play`; T follows the language (setLang).
import { inputs } from "./dom.js";
const { KEYS, PENTA_SHAPES, MINOR_KEYS, CHORDS } = Theory;

// A round's route: `walk` (its notes, up then back down) and `peak` (index of the top note).
// Scale walk: 8 up + 7 down. Other exercises bring their own length (SPEC §15).
export const WALK = 15, WALK_PEAK = 7;
export const DEFAULT_KEY = 0;          // C major; also what Clear goes back to
// Fretboard (SPEC §13): on by default (aids start on, players turn them off); a zone spans at least ZONE_MIN frets
export const FRET_FIRST_MAX = 15, FRET_LAST_MAX = 19, ZONE_MIN = 5;
export const ZONE_DEFAULT = 2;         // frets 2–6

// Panel order: circle of fifths (C G D A E B F♯ D♭ A♭ E♭ B♭ F)
export const FIFTHS = [];
for (let i = 0, pc = 0; i < 12; i++, pc = (pc + 7) % 12) FIFTHS.push(KEYS.findIndex(k => k.pc === pc));

function browserLang() {
  const prefs = navigator.languages || [navigator.language || ""];
  for (const l of prefs) {
    const code = String(l).toLowerCase().split("-")[0];
    if (STRINGS[code]) return code;
  }
  return "en";
}

export const settings = {
  // Aids (SPEC §3): 1 all notes named · 2 current note named · 3 shape only · 4 start only.
  // The eye shows the level; showAll is "the route is visible" (levels 1–3).
  aid: 1, showAll: true,
  keys: [DEFAULT_KEY],                 // selected key indices, circle-of-fifths order; never empty
  order: "random",                     // "random" | "sequential"
  // Exercise (SPEC §15.1): BPM, ticks, eye, language and guide are shared; keys and fretboard belong to Scale walk
  exercise: "walk",                    // "walk" | "penta" | "chords"
  shapeNo: 1,                          // Pentatonic shape, 1–5
  pentaKey: 0,                         // Pentatonic minor key: index into MINOR_KEYS (A minor)
  pentaPlace: {},                      // chosen placement per "key:shape" (its first fret), when there are two
  neckWalk: false,                     // Pentatonic: move to the neighbouring shape each round (SPEC §15.6)
  chordA: "Am", chordB: "C",           // Chord changes (SPEC §17): the two chords, never the same…
  chordBeats: 4,                       // …and the ticks each one lasts: 2, 4 or 8
  chordPos: {},                        // the chosen position (voicing index) per chord, when there are several
  guideSeen: false,
  theme: "sepia",                      // SPEC §18: sepia | maple | steel
  tuning: "standard",                  // the tuner's reference strings (SPEC §16): standard | halfDown | dropD | highD
  board: true, fretFrom: ZONE_DEFAULT, fretTo: ZONE_DEFAULT + ZONE_MIN - 1,
  lang: browserLang(),                 // overridden by saved settings
};

export let T = STRINGS.en;
export function setLang(code) {
  settings.lang = code;
  T = STRINGS[code];
}

// While practising. The scheduler's own timers live in player.js.
// A chord's chosen position, if it still exists; otherwise its first (open if it has one, else the lowest)
export const voicingOf = name => {
  const i = settings.chordPos[name];
  return Number.isInteger(i) && CHORDS[name].voicings[i] ? i : 0;
};

export const play = {
  running: false,
  round: null, step: 0, nextTime: 0,
  session: null,                       // keys and order are fixed for the whole session
  lastShown: null,                     // the tick on screen
  dbgPaused: false,                    // set by the dev tool; stop() clears it
};

// Keeps the zone valid: first fret 0–15, last fret up to 19, at least ZONE_MIN frets
export function setZone(from, to) {
  settings.fretFrom = Number.isInteger(from) ? Math.min(FRET_FIRST_MAX, Math.max(0, from)) : ZONE_DEFAULT;
  settings.fretTo = Number.isInteger(to) ? Math.min(FRET_LAST_MAX, Math.max(settings.fretFrom + ZONE_MIN - 1, to)) : settings.fretFrom + ZONE_MIN - 1;
}
export function clampInput(el) {
  const v = Math.round(Number(el.value));
  const min = Number(el.min), max = Number(el.max);
  el.value = Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : min;
  return Number(el.value);
}
export function save() {
  const s = settings;
  try {
    localStorage.setItem("scaleWalkLight", JSON.stringify({
      bpm: inputs.bpm.value, prep: inputs.prep.value, wait: inputs.wait.value,
      keys: s.keys, order: s.order, key: s.keys[0], aid: s.aid, showAll: s.showAll, lang: s.lang,
      board: s.board, fretFrom: s.fretFrom, fretTo: s.fretTo, guideSeen: s.guideSeen, exercise: s.exercise,
      pentaShape: s.shapeNo, pentaKey: s.pentaKey, pentaPlace: s.pentaPlace, pentaNeck: s.neckWalk, tuning: s.tuning, theme: s.theme,
      chordA: s.chordA, chordB: s.chordB, chordBeats: s.chordBeats, chordPos: s.chordPos
    }));
  } catch (e) {}
}
export function load() {
  try {
    const s = JSON.parse(localStorage.getItem("scaleWalkLight") || "null");
    if (s) {
      for (const k of ["bpm", "prep", "wait"]) if (s[k] != null) inputs[k].value = s[k];
      const saved = Array.isArray(s.keys) ? s.keys : s.key != null ? [s.key] : [];
      const valid = FIFTHS.filter(i => saved.map(Number).includes(i));
      if (valid.length) settings.keys = valid;
      if (s.order === "sequential") settings.order = s.order;
      // Older settings had an on/off eye: on was today's level 2, off level 4
      if ([1, 2, 3, 4].includes(s.aid)) settings.aid = s.aid;
      else if (typeof s.showAll === "boolean") settings.aid = s.showAll ? 2 : 4;
      if (STRINGS[s.lang]) settings.lang = s.lang;
      if (typeof s.board === "boolean") settings.board = s.board;   // older settings get the default
      settings.guideSeen = s.guideSeen === true;
      if (s.exercise === "penta" || s.exercise === "chords") settings.exercise = s.exercise;
      if (CHORDS[s.chordA] && CHORDS[s.chordB] && s.chordA !== s.chordB) { settings.chordA = s.chordA; settings.chordB = s.chordB; }
      if ([2, 4, 8].includes(s.chordBeats)) settings.chordBeats = s.chordBeats;
      if (s.chordPos && typeof s.chordPos === "object") for (const k in s.chordPos) if (CHORDS[k] && Number.isInteger(s.chordPos[k])) settings.chordPos[k] = s.chordPos[k];
      if (PENTA_SHAPES[s.pentaShape]) settings.shapeNo = Number(s.pentaShape);
      if (MINOR_KEYS[s.pentaKey]) settings.pentaKey = Number(s.pentaKey);
      settings.neckWalk = s.pentaNeck === true;
      if (Pitch.TUNINGS[s.tuning]) settings.tuning = s.tuning;
      const theme = { dark: "sepia", rosewood: "sepia", light: "maple", material: "steel" }[s.theme] || s.theme;   // earlier names
      if (["sepia", "maple", "steel"].includes(theme)) settings.theme = theme;
      if (s.pentaPlace && typeof s.pentaPlace === "object") for (const k in s.pentaPlace) if (Number.isInteger(s.pentaPlace[k])) settings.pentaPlace[k] = s.pentaPlace[k];
      setZone(Number(s.fretFrom), Number(s.fretTo));
    }
  } catch (e) {}
  for (const k in inputs) clampInput(inputs[k]);
}
