// Chord changes (SPEC §17): the eight open chords are musically right and playable, and the sequence of
// chords lands its changes on the right ticks. Run: node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const { OPEN_MIDI, STRING_NAMES, CHORD_QUALITIES, CHORDS, CHORD_NAMES, chordNotes, chordAt } = require("../js/theory.js");

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const show = v => v.frets.map(f => (f < 0 ? "x" : f)).join("");

test("the library: the eight open chords, in this order", () => {
  assert.deepEqual(CHORD_NAMES, ["C", "D", "E", "G", "A", "Am", "Dm", "Em"]);
  for (const name of CHORD_NAMES) {
    const c = CHORDS[name];
    assert.equal(name, c.root + c.quality, `${name}: its name is its root and quality`);
    assert.ok(CHORD_QUALITIES[c.quality], `${name}: known quality`);
    assert.ok(c.voicings.length >= 1, `${name}: at least one voicing`);
  }
});

test("the fingerings are the standard open ones", () => {
  const table = { C: "x32010", D: "xx0232", E: "022100", G: "320003", A: "x02220", Am: "x02210", Dm: "xx0231", Em: "022000" };
  for (const name of CHORD_NAMES) assert.equal(show(CHORDS[name].voicings[0]), table[name], name);
});

test("every sounding note belongs to the chord, every chord tone sounds, and the root is in the bass", () => {
  for (const name of CHORD_NAMES) {
    const c = CHORDS[name], root = PC[c.root], tones = CHORD_QUALITIES[c.quality].map(i => (root + i) % 12);
    const notes = chordNotes(name), pcs = notes.map(m => m % 12);
    for (const p of pcs) assert.ok(tones.includes(p), `${name}: a note outside the chord`);
    for (const t of tones) assert.ok(pcs.includes(t), `${name}: chord tone ${t} missing`);
    assert.equal(pcs[0], root, `${name}: the lowest sounding note is the root`);
    assert.deepEqual(notes, [...notes].sort((a, b) => a - b), `${name}: notes low to high`);
  }
});

test("the fingering fits a hand: one finger per fretted string, fingers 1–4, open and muted strings without one", () => {
  for (const name of CHORD_NAMES) for (const v of CHORDS[name].voicings) {
    assert.equal(v.frets.length, 6);
    assert.equal(v.fingers.length, 6);
    assert.ok(v.base >= 1);
    v.frets.forEach((f, st) => {
      const where = `${name}, ${STRING_NAMES[st]} string`;
      if (f <= 0) assert.equal(v.fingers[st], 0, `${where}: open or muted, no finger`);
      else assert.ok(v.fingers[st] >= 1 && v.fingers[st] <= 4, `${where}: a finger from 1 to 4`);
    });
    const used = v.fingers.filter(n => n > 0);
    assert.equal(new Set(used).size, used.length, `${name}: no finger on two strings (no barres yet)`);
    const fretted = v.frets.filter(f => f > 0);
    assert.ok(Math.max(...fretted) - Math.min(...fretted) <= 3, `${name}: within four frets`);
    // A higher finger never sits on a lower fret than a lower finger on the same chord
    const byFinger = v.fingers.map((n, st) => [n, v.frets[st]]).filter(([n]) => n > 0).sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < byFinger.length; i++) assert.ok(byFinger[i][1] >= byFinger[i - 1][1], `${name}: fingers in fret order`);
  }
});

test("notes come from the string and fret", () => {
  assert.deepEqual(chordNotes("Am"), [OPEN_MIDI[1], OPEN_MIDI[2] + 2, OPEN_MIDI[3] + 2, OPEN_MIDI[4] + 1, OPEN_MIDI[5]]);
  assert.equal(chordNotes("D").length, 4, "D: four strings");
  assert.equal(chordNotes("E").length, 6, "E: all six");
});

test("chord changes land on the boundaries: two chords of 4 ticks", () => {
  const seq = [{ name: "Am", beats: 4 }, { name: "C", beats: 4 }];
  const at = w => { const c = chordAt(seq, w); return `${seq[c.i].name}${c.beat + 1}`; };
  assert.deepEqual(Array.from({ length: 10 }, (_, w) => at(w)), ["Am1", "Am2", "Am3", "Am4", "C1", "C2", "C3", "C4", "Am1", "Am2"]);
  assert.deepEqual(chordAt(seq, 3), { i: 0, beat: 3, beats: 4, next: 1 });
  assert.deepEqual(chordAt(seq, 4), { i: 1, beat: 0, beats: 4, next: 0 });
});

test("any length per chord, and a long session never drifts off the boundaries", () => {
  for (const beats of [1, 2, 4, 8]) {
    const seq = [{ name: "G", beats }, { name: "D", beats }];
    for (let w = 0; w < 10000; w++) {
      const c = chordAt(seq, w);
      assert.equal(c.i, Math.floor(w / beats) % 2);
      assert.equal(c.beat, w % beats);
    }
  }
  // Each chord can carry its own length (future progressions): 4 + 2 + 2
  const seq = [{ name: "C", beats: 4 }, { name: "G", beats: 2 }, { name: "Am", beats: 2 }];
  assert.deepEqual([0, 3, 4, 5, 6, 7, 8].map(w => seq[chordAt(seq, w).i].name), ["C", "C", "G", "G", "Am", "Am", "C"]);
  assert.equal(chordAt(seq, 7).next, 0);
});
