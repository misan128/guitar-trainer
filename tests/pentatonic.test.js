// Minor pentatonic shapes in A minor (SPEC §15.2). Run: node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const { OPEN_MIDI, STRING_NAMES, MINOR_PENTA, PENTA_SHAPES, pentaShape } = require("../js/theory.js");

const SHAPES = [1, 2, 3, 4, 5];
const A = 9;                                          // pitch class of A
const show = s => s.positions.map(p => STRING_NAMES[p.st] + p.f).join(" ");

test("every note of every shape is in A minor pentatonic", () => {
  for (const n of SHAPES) for (const p of pentaShape(n).positions) {
    assert.equal(p.midi, OPEN_MIDI[p.st] + p.f, `shape ${n}: pitch must come from string and fret`);
    assert.ok(MINOR_PENTA.includes((p.midi - A + 120) % 12), `shape ${n}: ${STRING_NAMES[p.st]}${p.f} is not in A minor pentatonic`);
  }
});

test("two notes per string, on all six strings, low E to high e", () => {
  for (const n of SHAPES) {
    const strings = pentaShape(n).positions.map(p => p.st);
    assert.deepEqual(strings, [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5], `shape ${n}`);
  }
});

test("the route climbs through the scale without skipping a note", () => {
  for (const n of SHAPES) {
    const ps = pentaShape(n).positions;
    for (let i = 1; i < ps.length; i++) {
      const gap = ps[i].midi - ps[i - 1].midi;
      assert.ok(gap === 2 || gap === 3, `shape ${n}: ${STRING_NAMES[ps[i - 1].st]}${ps[i - 1].f} → ${STRING_NAMES[ps[i].st]}${ps[i].f} jumps ${gap} semitones`);
    }
  }
});

test("each shape fits the hand and phase 1's frets", () => {
  for (const n of SHAPES) {
    const s = pentaShape(n);
    assert.ok(s.to - s.from <= 4, `shape ${n} spans ${s.from}–${s.to}`);
    assert.ok(s.from >= 1 && s.to <= 15, `shape ${n} sits at ${s.from}–${s.to}`);
  }
});

test("shapes match the table in SPEC §15.2", () => {
  const table = {
    1: ["5–8", "E5 E8 A5 A7 D5 D7 G5 G7 B5 B8 e5 e8", "A"],
    2: ["7–10", "E8 E10 A7 A10 D7 D10 G7 G9 B8 B10 e8 e10", "C"],
    3: ["9–13", "E10 E12 A10 A12 D10 D12 G9 G12 B10 B13 e10 e12", "D"],
    4: ["12–15", "E12 E15 A12 A15 D12 D14 G12 G14 B13 B15 e12 e15", "E"],
    5: ["2–5", "E3 E5 A3 A5 D2 D5 G2 G5 B3 B5 e3 e5", "G"],
  };
  for (const n of SHAPES) {
    const s = pentaShape(n), [frets, route, start] = table[n];
    assert.equal(`${s.from}–${s.to}`, frets, `shape ${n} frets`);
    assert.equal(show(s), route, `shape ${n} route`);
    assert.equal(s.positions[0].name, start, `shape ${n} starts on`);
  }
});

test("note names, degrees and roots", () => {
  const s = pentaShape(1);
  assert.deepEqual(s.positions.map(p => p.name).join(" "), "A C D E G A C D E G A C");
  assert.deepEqual(s.positions.map(p => p.degree).join(" "), "1 ♭3 4 5 ♭7 1 ♭3 4 5 ♭7 1 ♭3");
  for (const n of SHAPES) for (const p of pentaShape(n).positions) assert.equal(p.root, p.name === "A", `shape ${n}: root flag`);
  assert.deepEqual(pentaShape(1).positions.filter(p => p.root).map(p => STRING_NAMES[p.st] + p.f), ["E5", "D7", "e5"]);
});

test("shapes are fixed data, the same on every call", () => {
  assert.deepEqual(pentaShape(3), pentaShape(3));
  assert.equal(pentaShape(6), null);
  assert.equal(Object.keys(PENTA_SHAPES).length, 5);
});
