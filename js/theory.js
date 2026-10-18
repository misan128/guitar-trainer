// Music theory and fretboard walks, with no DOM: loaded by index.html and by the tests (tests/).
// In the browser it defines `Theory`; in Node it is a CommonJS module.
(function (root) {
  // ---- Major scale spelled after its key signature ----
  const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
  const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
  const MAJOR = [0, 2, 4, 5, 7, 9, 11];
  const KEYS = [
    { name: "C", pc: 0, letter: 0 },  { name: "D♭", pc: 1, letter: 1 },
    { name: "D", pc: 2, letter: 1 },  { name: "E♭", pc: 3, letter: 2 },
    { name: "E", pc: 4, letter: 2 },  { name: "F", pc: 5, letter: 3 },
    { name: "F♯", pc: 6, letter: 3 }, { name: "G", pc: 7, letter: 4 },
    { name: "A♭", pc: 8, letter: 5 }, { name: "A", pc: 9, letter: 5 },
    { name: "B♭", pc: 10, letter: 6 },{ name: "B", pc: 11, letter: 6 },
  ];
  function scaleNames(key) {
    return MAJOR.map((iv, d) => {
      const l = (key.letter + d) % 7;
      const pc = (key.pc + iv) % 12;
      const diff = ((pc - LETTER_PC[l] + 18) % 12) - 6;   // −1, 0, +1
      return LETTERS[l] + (diff > 0 ? "♯" : diff < 0 ? "♭" : "");
    });
  }
  // Semitones from the tonic to scale degree d (d may pass the octave)
  const semis = d => MAJOR[d % 7] + 12 * Math.floor(d / 7);

  // ---- Fretboard walks (SPEC §13.2) ----
  const OPEN_MIDI = [40, 45, 50, 55, 59, 64];   // standard tuning, low E to high e
  const STRING_NAMES = ["E", "A", "D", "G", "B", "e"];
  // Every fingering of the pitches inside [a, b] that never moves to a lower string
  function fingerings(pitches, a, b) {
    const out = [], acc = [];
    (function rec(i, minS) {
      if (i === pitches.length) return out.push(acc.slice());
      for (let st = minS; st < 6; st++) {
        const f = pitches[i] - OPEN_MIDI[st];
        if (f >= a && f <= b) { acc.push([st, f]); rec(i + 1, st); acc.pop(); }
      }
    })(0, 0);
    return out;
  }
  // Ranked in order: hand span, total fret movement, string changes, start on the lowest string
  function fingeringCost(p) {
    const frets = p.map(x => x[1]);
    let move = 0, changes = 0;
    for (let i = 1; i < p.length; i++) {
      move += Math.abs(p[i][1] - p[i - 1][1]);
      if (p[i][0] !== p[i - 1][0]) changes++;
    }
    return [Math.max(...frets) - Math.min(...frets), move, changes, p[0][0]];
  }
  const cheaper = (x, y) => { for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i]; return false; };
  const walkCache = new Map();
  // One octave up from degree `deg` of the key, or null if it cannot be played inside frets [a, b].
  // Octave 3 first; otherwise the octave whose start is closest to it.
  // Returns { pitches: [8 MIDI notes], pos: [8 × [string, fret]] }.
  function boardWalk(keyPc, deg, a, b) {
    const id = `${keyPc}/${deg}/${a}/${b}`;
    if (walkCache.has(id)) return walkCache.get(id);
    const pc = (keyPc + MAJOR[deg]) % 12, starts = [];
    for (let m = OPEN_MIDI[0]; m <= OPEN_MIDI[5] + b; m++) if (m % 12 === pc) starts.push(m);
    starts.sort((x, y) => Math.abs(x - 53.5) - Math.abs(y - 53.5));
    let found = null;
    for (const start of starts) {
      const pitches = Array.from({ length: 8 }, (_, k) => start + semis(deg + k) - semis(deg));
      let best = null, bestCost = null;
      for (const f of fingerings(pitches, a, b)) {
        const c = fingeringCost(f);
        if (!best || cheaper(c, bestCost)) { best = f; bestCost = c; }
      }
      if (best) { found = { pitches, pos: best }; break; }
    }
    walkCache.set(id, found);
    return found;
  }

  // ---- Start notes (SPEC §3) ----
  // Each key goes through its start degrees in random order, all of them before any repeats, and the
  // first of a new pass is never the last one of the previous pass. Two rounds in a row never start on
  // the same note, even in different keys, whenever another choice exists.
  // next(keyPc, allowed) returns a degree (0–6) from `allowed` (e.g. those that fit a fretboard zone).
  function createStartPicker(rand = Math.random) {
    const bags = new Map(), lastOf = new Map();
    let lastPc = null;
    const shuffle = a => {
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    };
    return function next(keyPc, allowed = [0, 1, 2, 3, 4, 5, 6]) {
      const pcOf = d => (keyPc + MAJOR[d]) % 12;
      const ok = d => d !== lastOf.get(keyPc) && pcOf(d) !== lastPc;
      let bag = (bags.get(keyPc) || []).filter(d => allowed.includes(d));
      if (!bag.length) bag = shuffle(allowed.slice());
      // pop() takes from the end; if what is left of this pass cannot go now, the next pass starts
      // underneath it, so the leftovers still come first
      if (!ok(bag[bag.length - 1]) && !bag.some(ok)) bag = shuffle(allowed.filter(d => !bag.includes(d))).concat(bag);
      const j = bag.findLastIndex(ok);   // the valid one closest to the top keeps the order
      if (j >= 0) [bag[j], bag[bag.length - 1]] = [bag[bag.length - 1], bag[j]];
      const d = bag.pop();
      bags.set(keyPc, bag);
      lastOf.set(keyPc, d);
      lastPc = pcOf(d);
      return d;
    };
  }

  // ---- Minor pentatonic shapes (SPEC §15.2) ----
  // The five-box numbering: shape 1 has the root on the 6th string under the first finger, and the
  // others follow up the neck. Defined explicitly in A minor (canonical positions; shape 5 at its
  // lowest), never generated. Each shape is its ascending route, two notes per string, low E → high e,
  // as [string, fret]. Notes, names and degrees are derived below and checked by the tests.
  const MINOR_PENTA = [0, 3, 5, 7, 10];                 // semitones from the root
  const PENTA_DEGREES = ["1", "♭3", "4", "5", "♭7"];
  const PENTA_SHAPES = {
    1: [[0, 5], [0, 8], [1, 5], [1, 7], [2, 5], [2, 7], [3, 5], [3, 7], [4, 5], [4, 8], [5, 5], [5, 8]],
    2: [[0, 8], [0, 10], [1, 7], [1, 10], [2, 7], [2, 10], [3, 7], [3, 9], [4, 8], [4, 10], [5, 8], [5, 10]],
    3: [[0, 10], [0, 12], [1, 10], [1, 12], [2, 10], [2, 12], [3, 9], [3, 12], [4, 10], [4, 13], [5, 10], [5, 12]],
    4: [[0, 12], [0, 15], [1, 12], [1, 15], [2, 12], [2, 14], [3, 12], [3, 14], [4, 13], [4, 15], [5, 12], [5, 15]],
    5: [[0, 3], [0, 5], [1, 3], [1, 5], [2, 2], [2, 5], [3, 2], [3, 5], [4, 3], [4, 5], [5, 3], [5, 5]],
  };
  // Minor keys, circle-of-fifths order, each spelled like its relative major in KEYS (so D♯ minor, after F♯ major)
  const MINOR_KEYS = [
    { name: "A", pc: 9, relative: 0 },   { name: "E", pc: 4, relative: 7 },   { name: "B", pc: 11, relative: 2 },
    { name: "F♯", pc: 6, relative: 9 },  { name: "C♯", pc: 1, relative: 4 },  { name: "G♯", pc: 8, relative: 11 },
    { name: "D♯", pc: 3, relative: 6 },  { name: "B♭", pc: 10, relative: 1 }, { name: "F", pc: 5, relative: 8 },
    { name: "C", pc: 0, relative: 3 },   { name: "G", pc: 7, relative: 10 },  { name: "D", pc: 2, relative: 5 },
  ];
  // Transposed shapes keep their geometry: every fret moves by the same amount. A shape can fit at more than
  // one octave: its placements are those between fret 0 and PENTA_MAX_FRET. By default, the lowest movable
  // one (no open string); an open-position one (lowest fret 0) or a higher octave can be asked for.
  const PENTA_MAX_FRET = 16;
  // Placements of shape n in minor key k, lowest first: { from, to, open }
  function pentaPlacements(n, k = 0) {
    const route = PENTA_SHAPES[n], key = MINOR_KEYS[k];
    if (!route || !key) return [];
    const base = route.map(p => p[1]), lo = Math.min(...base), hi = Math.max(...base), out = [];
    for (let s = (key.pc - 9 + 12) % 12 - 24; s <= 24; s += 12) {
      if (lo + s >= 0 && hi + s <= PENTA_MAX_FRET) out.push({ from: lo + s, to: hi + s, open: lo + s === 0 });
    }
    return out;
  }
  // Shape n in minor key k (index into MINOR_KEYS, A minor by default), at the placement starting on fret
  // `at` (default: the lowest movable one): its positions in ascending order, each with string, fret, MIDI
  // pitch, note name, degree (1 ♭3 4 5 ♭7), whether it is the root, and its index in the route; plus its
  // fret range and whether it is in open position. null if there is no such placement.
  function pentaShape(n, k = 0, at) {
    const route = PENTA_SHAPES[n], key = MINOR_KEYS[k];
    const places = pentaPlacements(n, k);
    const place = at == null ? places.find(p => !p.open) : places.find(p => p.from === at);
    if (!place) return null;
    const shift = place.from - Math.min(...route.map(p => p[1]));
    const major = KEYS[key.relative];
    const names = new Map(scaleNames(major).map((name, d) => [(major.pc + MAJOR[d]) % 12, name]));
    const positions = route.map(([st, f0], index) => {
      const f = f0 + shift, midi = OPEN_MIDI[st] + f, step = (midi - key.pc + 120) % 12, d = MINOR_PENTA.indexOf(step);
      return { st, f, midi, name: names.get(midi % 12), degree: PENTA_DEGREES[d], root: step === 0, index };
    });
    return { shape: n, key: key.name, positions, from: place.from, to: place.to, open: place.open };
  }

  // ---- Along the neck (SPEC §15.6) ----
  // The five shapes of a key in neck order (lowest placement first), each at its chosen placement:
  // at(n) gives that shape's first fret, or undefined for the default.
  function pentaNeckOrder(k = 0, at = () => undefined) {
    return Object.keys(PENTA_SHAPES).map(Number)
      .map(n => ({ n, from: (pentaShape(n, k, at(n)) || pentaShape(n, k)).from }))
      .sort((a, b) => a.from - b.from)
      .map(x => x.n);
  }
  // From `start`, the next shape on each call: up the neck, turning at either end, back and forth.
  function createNeckWalk(order, start) {
    let i = Math.max(0, order.indexOf(start)), dir = i === order.length - 1 ? -1 : 1, first = true;
    return function next() {
      if (first) { first = false; return order[i]; }
      if (order.length > 1) {
        if (i + dir < 0 || i + dir >= order.length) dir = -dir;
        i += dir;
      }
      return order[i];
    };
  }

  // ---- Chord changes (SPEC §17) ----
  // A chord is what it is (root and quality); a voicing is one way to finger it. Each chord has its voicings,
  // sorted from the lowest on the neck: the open one where there is a standard one, and barre chords moved to
  // its root, named by the string the root sits on (6th, 5th or 4th). Strings low E to high e: frets (-1 muted,
  // 0 open), fingers (1 index … 4 little; 0 none), base (the diagram's first fret), barre ({ fret, from, to }
  // strings, first finger) and kind ("open", "root6", "root5", "root4").
  const CHORD_QUALITIES = { "": [0, 4, 7], m: [0, 3, 7], "7": [0, 4, 7, 10] };
  const CHORD_ROOTS = [["C", 0], ["C♯", 1], ["D", 2], ["E♭", 3], ["E", 4], ["F", 5], ["F♯", 6], ["G", 7], ["A♭", 8], ["A", 9], ["B♭", 10], ["B", 11]];
  const OPEN_CHORDS = {
    C: ["x32010", "032010"], D: ["xx0232", "000132"], E: ["022100", "023100"], G: ["320003", "210003"], A: ["x02220", "001230"],
    Am: ["x02210", "002310"], Dm: ["xx0231", "000231"], Em: ["022000", "023000"],
    A7: ["x02020", "002030"], B7: ["x21202", "021304"], C7: ["x32310", "032410"], D7: ["xx0212", "000213"], E7: ["020100", "020100"], G7: ["320001", "320001"],
  };
  // Movable shapes, relative to their lowest fret r: the root on the 6th string (E shape), the 5th (A shape), or
  // the 4th (the top four strings of the E shape, like the small F xx3211; for 7ths the D7 shape). open: the
  // pitch class at r = 0. barre: the strings the first finger lays across, if any.
  const MOVABLE = {
    root6: { open: 4, "": [[0, 2, 2, 1, 0, 0], [1, 3, 4, 2, 1, 1], [0, 5]], m: [[0, 2, 2, 0, 0, 0], [1, 3, 4, 1, 1, 1], [0, 5]], "7": [[0, 2, 0, 1, 0, 0], [1, 3, 1, 2, 1, 1], [0, 5]] },
    root5: { open: 9, "": [[-1, 0, 2, 2, 2, 0], [0, 1, 2, 3, 4, 1], [1, 5]], m: [[-1, 0, 2, 2, 1, 0], [0, 1, 3, 4, 2, 1], [1, 5]], "7": [[-1, 0, 2, 0, 2, 0], [0, 1, 3, 1, 4, 1], [1, 5]] },
    root4: { open: 4, "": [[-1, -1, 2, 1, 0, 0], [0, 0, 3, 2, 1, 1], [4, 5]], m: [[-1, -1, 2, 0, 0, 0], [0, 0, 3, 1, 1, 1], [3, 5]],
             "7": [[-1, -1, 0, 2, 1, 2], [0, 0, 1, 3, 2, 4], null], open7: 2 },
  };
  const MAX_POSITION = 11;                   // positions start no higher than this fret: higher ones only clutter
  const EASE = { open: 0, root4: 1, root5: 2, root6: 3 };   // the same first fret: the easiest first
  const firstFret = frets => { const f = frets.filter(x => x > 0); return f.length ? Math.min(...f) : 1; };
  const CHORDS = {};
  for (const quality of ["", "m", "7"]) for (const [root, pc] of CHORD_ROOTS) {   // major, minor, 7th (not key order: "7" would come first)
    const name = root + quality, voicings = [];
    if (OPEN_CHORDS[name]) {
      const [f, fi] = OPEN_CHORDS[name];
      voicings.push({ frets: [...f].map(c => (c === "x" ? -1 : Number(c))), fingers: [...fi].map(Number), base: 1, kind: "open" });
    }
    for (const kind in MOVABLE) {
      const shape = MOVABLE[kind], [rel, fingers, across] = shape[quality];
      const at0 = quality === "7" && shape.open7 != null ? shape.open7 : shape.open;
      const fret = (pc - at0 + 12) % 12;                      // fret 0 would be an open chord: those come from the table
      if (fret === 0 || fret > MAX_POSITION) continue;
      const frets = rel.map(x => (x < 0 ? -1 : x + fret));
      const v = { frets, fingers, base: fret, kind };
      if (across) v.barre = { fret, from: across[0], to: across[1] };
      voicings.push(v);
    }
    voicings.sort((a, b) => firstFret(a.frets) - firstFret(b.frets) || EASE[a.kind] - EASE[b.kind]);
    CHORDS[name] = { root, quality, voicings };
  }
  const CHORD_NAMES = Object.keys(CHORDS);
  // The frets a voicing spans, for its label ("Open (0–3)", "5th string (3–5)")
  function voicingFrets(v) {
    const fretted = v.frets.filter(f => f > 0);
    return [v.kind === "open" ? 0 : Math.min(...fretted), Math.max(...fretted)];
  }
  // The sounding notes of a chord's voicing, low to high (muted strings left out)
  function chordNotes(name, v = 0) {
    const { frets } = CHORDS[name].voicings[v];
    return frets.map((f, st) => f < 0 ? null : OPEN_MIDI[st] + f).filter(m => m != null);
  }
  // Where tick w (0 = first tick after prep) falls in a sequence of chords [{ name, beats }], which repeats:
  // the chord's index, the beat within it, its length, and the index of the next chord
  function chordAt(seq, w) {
    const cycle = seq.reduce((n, c) => n + c.beats, 0);
    let t = ((w % cycle) + cycle) % cycle;
    for (let i = 0; i < seq.length; i++) {
      if (t < seq[i].beats) return { i, beat: t, beats: seq[i].beats, next: (i + 1) % seq.length };
      t -= seq[i].beats;
    }
  }

  const api = { MAJOR, KEYS, scaleNames, semis, OPEN_MIDI, STRING_NAMES, boardWalk, createStartPicker,
    MINOR_PENTA, PENTA_DEGREES, PENTA_SHAPES, MINOR_KEYS, PENTA_MAX_FRET, pentaPlacements, pentaShape, pentaNeckOrder, createNeckWalk,
    CHORD_QUALITIES, CHORD_ROOTS, CHORDS, CHORD_NAMES, voicingFrets, chordNotes, chordAt };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Theory = api;
})(this);
