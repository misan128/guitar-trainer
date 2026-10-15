// Fretboard walks (SPEC §13.3, acceptance criterion 11). Run: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const { MAJOR, KEYS, scaleNames, semis, OPEN_MIDI, boardWalk } = require("../theory.js");

const ZONE_MIN = 5, FIRST_MAX = 15, LAST_MAX = 19;   // same limits as the fretboard panel
const zones = [];
for (let a = 0; a <= FIRST_MAX; a++) for (let b = a + ZONE_MIN - 1; b <= LAST_MAX; b++) zones.push([a, b]);

test("every key and start note has a playable walk in every zone of at least 5 frets", () => {
  for (const [a, b] of zones) for (const key of KEYS) for (let deg = 0; deg < 7; deg++) {
    const walk = boardWalk(key.pc, deg, a, b);
    const where = `${key.name} major, degree ${deg}, frets ${a}-${b}`;
    assert.ok(walk, `no walk for ${where}`);
    assert.equal(walk.pitches.length, 8, where);
    assert.equal(walk.pitches[0] % 12, (key.pc + MAJOR[deg]) % 12, `wrong start note: ${where}`);
    walk.pos.forEach(([st, f], i) => {
      assert.equal(OPEN_MIDI[st] + f, walk.pitches[i], `fret does not sound the pitch: ${where}`);
      assert.ok(f >= a && f <= b, `fret out of the zone: ${where}`);
      if (i === 0) return;
      assert.ok(st >= walk.pos[i - 1][0], `moves to a lower string while ascending: ${where}`);
      assert.equal(walk.pitches[i] - walk.pitches[i - 1], semis(deg + i) - semis(deg + i - 1), `wrong scale step: ${where}`);
    });
    const frets = walk.pos.map(p => p[1]);
    assert.ok(Math.max(...frets) - Math.min(...frets) <= 4, `hand spans more than 4 frets: ${where}`);
  }
});

test("the same key, start note and zone always give the same fingering", () => {
  const a = boardWalk(0, 0, 7, 11), b = boardWalk(0, 0, 7, 11);
  assert.deepEqual(a, b);
});

test("octave 3 is used whenever the walk fits there", () => {
  // Central zones always fit octave 3 (SPEC §13.3)
  for (let a = 3; a <= 8; a++) for (const key of KEYS) for (let deg = 0; deg < 7; deg++) {
    const start = boardWalk(key.pc, deg, a, a + 4).pitches[0];
    assert.ok(start >= 48 && start < 60, `${key.name} degree ${deg}, frets ${a}-${a + 4}: start ${start} not in octave 3`);
  }
});

test("4-fret zones cannot hold every walk (why the minimum is 5)", () => {
  let missing = 0;
  for (const key of KEYS) for (let deg = 0; deg < 7; deg++) if (!boardWalk(key.pc, deg, 5, 8)) missing++;
  assert.equal(missing, 84 - 26);
});

test("known fingerings", () => {
  const name = ["E", "A", "D", "G", "B", "e"];
  const show = w => w.pos.map(([st, f]) => name[st] + f).join(" ");
  assert.equal(show(boardWalk(0, 0, 7, 11)), "E8 E10 A7 A8 A10 D7 D9 D10");   // C from the 6th string
  assert.equal(show(boardWalk(0, 0, 0, 4)), "A3 D0 D2 D3 G0 G2 B0 B1");      // open C
});

test("scale spelling follows the key signature", () => {
  const spell = name => scaleNames(KEYS.find(k => k.name === name)).join(" ");
  assert.equal(spell("C"), "C D E F G A B");
  assert.equal(spell("F♯"), "F♯ G♯ A♯ B C♯ D♯ E♯");
  assert.equal(spell("D♭"), "D♭ E♭ F G♭ A♭ B♭ C");
  assert.equal(spell("F"), "F G A B♭ C D E");
});
