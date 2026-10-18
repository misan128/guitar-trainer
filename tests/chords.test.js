// Chord changes (SPEC §17): every chord in every position is musically right and playable, and the sequence of
// chords lands its changes on the right ticks. Run: node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const { OPEN_MIDI, STRING_NAMES, CHORD_QUALITIES, CHORDS, CHORD_NAMES, voicingFrets, chordNotes, chordAt } = require("../js/theory.js");

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const show = v => v.frets.map(f => (f < 0 ? "x" : f)).join("");

const ROOT_PC = n => (PC[n[0]] + (n.includes("♯") ? 1 : n.includes("♭") ? -1 : 0) + 12) % 12;
const all = () => CHORD_NAMES.flatMap(name => CHORDS[name].voicings.map((v, i) => ({ name, v, i })));

test("the library: every root as major, minor and 7th, each with its positions", () => {
  assert.equal(CHORD_NAMES.length, 36);
  assert.deepEqual(CHORD_NAMES.slice(0, 12), ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"]);
  assert.deepEqual(CHORD_NAMES.filter(n => n.endsWith("m")).length, 12);
  assert.deepEqual(CHORD_NAMES.filter(n => n.endsWith("7")).length, 12);
  for (const name of CHORD_NAMES) {
    const c = CHORDS[name];
    assert.equal(name, c.root + c.quality, `${name}: its name is its root and quality`);
    assert.ok(CHORD_QUALITIES[c.quality], `${name}: known quality`);
    const kinds = c.voicings.map(v => v.kind);
    assert.ok(c.voicings.length >= 2, `${name}: at least two positions`);
    assert.ok(kinds.every(k => ["open", "root6", "root5", "root4"].includes(k)), `${name}: known kinds`);
    assert.equal(new Set(kinds).size, kinds.length, `${name}: one position of each kind`);
    assert.ok(c.voicings.every(v => voicingFrets(v)[0] <= 11), `${name}: no position starts above fret 11`);
    const from = c.voicings.map(v => voicingFrets(v)[0]);
    assert.deepEqual(from, [...from].sort((x, y) => x - y), `${name}: positions from the lowest on the neck`);
  }
});

test("the open fingerings are the standard ones, and only those chords have one", () => {
  const table = { C: "x32010", D: "xx0232", E: "022100", G: "320003", A: "x02220", Am: "x02210", Dm: "xx0231", Em: "022000",
    A7: "x02020", B7: "x21202", C7: "x32310", D7: "xx0212", E7: "020100", G7: "320001" };
  for (const name of CHORD_NAMES) {
    const open = CHORDS[name].voicings.find(v => v.kind === "open");
    if (table[name]) assert.equal(open && show(open), table[name], name);
    else assert.equal(open, undefined, `${name}: no open voicing`);
  }
});

test("barre shapes moved to their root: known fingerings", () => {
  const at = (name, kind) => show(CHORDS[name].voicings.find(v => v.kind === kind));
  assert.equal(at("F", "root6"), "133211");
  assert.equal(at("Bm", "root5"), "x24432");
  assert.equal(at("B♭", "root5"), "x13331");
  assert.equal(at("Gm", "root6"), "355333");
  assert.equal(at("C7", "root5"), "x35353");
  assert.equal(at("A7", "root6"), "575655");
  assert.equal(at("F", "root4"), "xx3211", "the small F");
  assert.equal(at("Fm", "root4"), "xx3111");
  assert.equal(at("E7", "root4"), "xx2434", "7ths on the 4th string: the D7 shape moved up");
});

test("every voicing: every sounding note is in the chord, every chord tone sounds (a 7th may drop its fifth), root in the bass", () => {
  for (const { name, v, i } of all()) {
    const c = CHORDS[name], root = ROOT_PC(c.root), tones = CHORD_QUALITIES[c.quality].map(x => (root + x) % 12);
    const notes = chordNotes(name, i), pcs = notes.map(m => m % 12), where = `${name} ${v.kind} ${show(v)}`;
    for (const p of pcs) assert.ok(tones.includes(p), `${where}: a note outside the chord`);
    tones.forEach((t, k) => {
      const fifth = c.quality === "7" && CHORD_QUALITIES[c.quality][k] === 7;
      if (!fifth) assert.ok(pcs.includes(t), `${where}: chord tone ${t} missing`);
    });
    assert.equal(pcs[0], root, `${where}: the lowest sounding note is the root`);
    assert.deepEqual(notes, [...notes].sort((a, b) => a - b), `${where}: notes low to high`);
  }
});

test("every fingering fits a hand: fingers 1–4, one per string unless it is the barre, in fret order, within four frets", () => {
  for (const { name, v } of all()) {
    const where = `${name} ${v.kind} ${show(v)}`;
    assert.equal(v.frets.length, 6);
    assert.equal(v.fingers.length, 6);
    v.frets.forEach((f, st) => {
      if (f <= 0) assert.equal(v.fingers[st], 0, `${where}, ${STRING_NAMES[st]}: open or muted, no finger`);
      else assert.ok(v.fingers[st] >= 1 && v.fingers[st] <= 4, `${where}, ${STRING_NAMES[st]}: a finger from 1 to 4`);
    });
    const used = v.fingers.map((n, st) => [n, st]).filter(([n]) => n > 0);
    for (const n of [1, 2, 3, 4]) {
      const strings = used.filter(([m]) => m === n).map(([, st]) => st);
      if (strings.length < 2) continue;
      assert.ok(v.barre && n === 1, `${where}: finger ${n} on two strings without a barre`);
      for (const st of strings) assert.equal(v.frets[st], v.barre.fret, `${where}: the barre finger stays on its fret`);
    }
    if (v.barre) {
      for (let st = v.barre.from; st <= v.barre.to; st++) assert.ok(v.frets[st] >= v.barre.fret, `${where}: nothing under the barre`);
      assert.equal(v.base, v.barre.fret, `${where}: the diagram starts at the barre`);
    }
    const fretted = v.frets.filter(f => f > 0);
    assert.ok(Math.max(...fretted) - Math.min(...fretted) <= 3, `${where}: within four frets`);
    assert.ok(Math.max(...fretted) - v.base <= 3, `${where}: fits the diagram's four frets`);
    const byFinger = used.map(([n, st]) => [n, v.frets[st]]).sort((a, b) => a[0] - b[0]);
    for (let k = 1; k < byFinger.length; k++) assert.ok(byFinger[k][1] >= byFinger[k - 1][1], `${where}: fingers in fret order`);
  }
});

test("positions: the frets each voicing spans, and the easiest first when two start on the same fret", () => {
  assert.deepEqual(CHORDS.C.voicings.map(voicingFrets), [[0, 3], [3, 5], [8, 10], [8, 10]]);
  assert.deepEqual(CHORDS.F.voicings.map(v => v.kind), ["root4", "root6", "root5"], "F: the small F before the full barre");
  assert.deepEqual(CHORDS.Am.voicings.map(v => v.kind), ["open", "root4", "root6"]);
  for (const name of CHORD_NAMES) {
    const first = CHORDS[name].voicings[0];
    if (CHORDS[name].voicings.some(v => v.kind === "open")) assert.equal(first.kind, "open", `${name}: open first`);
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
