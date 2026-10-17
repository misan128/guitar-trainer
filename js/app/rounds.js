// Rounds: which key or shape comes next, and the notes of each round
import { inputs } from "./dom.js";
import { settings, play, T, WALK_PEAK, ZONE_MIN } from "./state.js";
const { MAJOR, KEYS, scaleNames, semis, boardWalk, PENTA_MAX_FRET, pentaPlacements, pentaShape } = Theory;

const BASE_MIDI = 48;                  // start note always in octave 3 (C3–B3)

// Name of a variant among a combination's placements: open/closed, or low/high octave; null if there is no choice
export const variantOf = (p, places) => places.length < 2 ? null
  : places.some(q => q.open) ? (p.open ? "variantOpen" : "variantClosed")
  : p.from === places[0].from ? "variantLow" : "variantHigh";
// The chosen placement of a key and shape, if it is still valid; otherwise the default (lowest movable)
export const placeAt = (k, n) => {
  const v = settings.pentaPlace[`${k}:${n}`];
  return pentaPlacements(n, k).some(p => p.from === v) ? v : undefined;
};

// Key sequence. Random: shuffle-bag, never the same key twice in a row.
function pickKey() {
  const { session } = play, { keys } = session;
  if (keys.length === 1) return keys[0];
  if (session.order === "sequential") return keys[session.pos++ % keys.length];
  if (!session.bag.length) {
    const bag = keys.slice();
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    // pop() takes from the end: keep the block's first key off the last one played
    if (bag[bag.length - 1] === session.last) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
    session.bag = bag;
  }
  return session.last = session.bag.pop();
}

// A round for a given key and start degree. With the fretboard on and a walk that fits the zone,
// the walk follows its fingering; otherwise it is the plain octave-3 walk.
export function buildRound(keyIdx, deg) {
  const { session } = play, key = KEYS[keyIdx];
  const names = session.names[keyIdx] ??= scaleNames(key);
  const zone = session.board, bw = zone && boardWalk(key.pc, deg, zone.from, zone.to);
  let up;
  if (bw) {
    up = bw.pos.map(([st, f], k) => ({ midi: bw.pitches[k], name: names[(deg + k) % 7], st, f }));
  } else {
    const start = BASE_MIDI + (key.pc + MAJOR[deg]) % 12;
    up = Array.from({ length: 8 }, (_, k) => ({
      midi: start + semis(deg + k) - semis(deg),
      name: names[(deg + k) % 7],
    }));
  }
  const walk = up.concat(up.slice(0, 7).reverse());
  const prep = Number(inputs.prep.value), wait = Number(inputs.wait.value);
  const board = bw ? { from: zone.from, to: zone.to } : null;
  return { walk, peak: WALK_PEAK, prep, wait, total: prep + walk.length + wait, key, keyIdx, deg, next: KEYS[session.upcoming ?? keyIdx], board };
}

// Pentatonic shapes (SPEC §15.3): the complete shape up, then back down without repeating its top note.
// Always the same route. The fretboard shows the shape's frets, widened to at least 5.
// prep, wait: override the settings (along the neck, only the first shape has prep, and none has a wait)
export function shapeRound(n, k = settings.pentaKey, at = placeAt(k, n), prep = Number(inputs.prep.value), wait = Number(inputs.wait.value)) {
  const sh = pentaShape(n, k, at);
  const up = sh.positions.map(p => ({ midi: p.midi, name: p.name, st: p.st, f: p.f, root: p.root }));
  const walk = up.concat(up.slice(0, -1).reverse());
  let from = sh.from, to = sh.to;
  if (to - from < ZONE_MIN - 1) {
    if (from + ZONE_MIN - 1 <= PENTA_MAX_FRET) to = from + ZONE_MIN - 1;
    else from = to - ZONE_MIN + 1;
  }
  return { walk, peak: up.length - 1, prep, wait, total: prep + walk.length + wait, penta: true, shape: n,
           key: { name: sh.key }, frets: [sh.from, sh.to], board: { from, to },
           variant: variantOf(sh, pentaPlacements(n, k)) };
}
// The round's name on the phase line: "C major", or "A minor · Shape 1"
export const roundLabel = r => r.penta ? `${T.minorName(r.key.name)} · ${T.shapeName(r.shape)}${r.variant ? ` · ${T[r.variant]}` : ""}` : T.keyName(r.key.name);

export function newRound() {
  const { session } = play;
  // Pentatonic (SPEC §15.3): the path is fixed, so rounds follow each other without a wait; the reference
  // note and the prep ticks only come before the first one
  if (session.exercise === "penta") {
    const first = !session.started;
    session.started = true;
    if (!session.neck) {
      const r = shapeRound(session.shape, session.pentaKey, session.pentaAt, first ? Number(inputs.prep.value) : 0, 0);
      r.announce = first;
      return r;
    }
    // Along the neck: this shape, with the next one drawn now so its descent can announce it
    const n = session.neckNext ?? session.neck();
    session.neckNext = session.neck();
    const r = shapeRound(n, session.pentaKey, placeAt(session.pentaKey, n), first ? Number(inputs.prep.value) : 0, 0);
    r.announce = first;
    r.neckBar = true;
    r.nextShape = session.neckNext;
    return r;
  }
  // The next key is drawn one round early so the wait ticks can announce it
  const keyIdx = session.upcoming ?? pickKey();
  session.upcoming = pickKey();
  const key = KEYS[keyIdx];
  // Start note: each key goes through all its start notes before repeating, and two rounds in a row
  // never start on the same note (theory.js). With the fretboard, only degrees with a walk inside the
  // zone (all of them with ≥5 frets); if none fits, the round is played without the fretboard.
  const all = [0, 1, 2, 3, 4, 5, 6], zone = session.board;
  const fits = zone ? all.filter(d => boardWalk(key.pc, d, zone.from, zone.to)) : all;
  return buildRound(keyIdx, session.pickStart(key.pc, fits.length ? fits : all));
}
