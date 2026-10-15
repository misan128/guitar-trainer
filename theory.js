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

  // ---- Fretboard walks (SPEC §13.3) ----
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

  const api = { MAJOR, KEYS, scaleNames, semis, OPEN_MIDI, STRING_NAMES, boardWalk };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Theory = api;
})(this);
