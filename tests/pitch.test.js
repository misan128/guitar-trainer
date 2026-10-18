// Tuner pitch detection (SPEC §16): every open string, in tune and detuned, from pure tones, from tones whose
// overtones are louder than the fundamental, and from a plucked string. Run: node --test
const test = require("node:test");
const assert = require("node:assert/strict");
const { detectPitch, noteOf } = require("../js/pitch.js");
const { OPEN_MIDI, STRING_NAMES } = require("../js/theory.js");

const SR = 48000, N = 4096;                          // the tuner's analyser: 4096 samples at 48 kHz
const hz = midi => 440 * Math.pow(2, (midi - 69) / 12);
const cents = (f, ref) => 1200 * Math.log2(f / ref);

// A block of a tone made of harmonics (amplitude per harmonic), with a little noise
function tone(freq, harmonics = [1], noise = 0) {
  const buf = new Float32Array(N);
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let i = 0; i < N; i++) {
    let v = 0;
    harmonics.forEach((a, k) => { v += a * Math.sin(2 * Math.PI * freq * (k + 1) * i / SR + k); });
    buf[i] = 0.3 * v + noise * rnd();
  }
  return buf;
}
// A plucked string, as the app plays it (Karplus-Strong), a moment after the attack
function pluck(freq) {
  const P = SR / freq - 0.5, i0 = Math.floor(P), fr = P - i0, len = N + 4000, y = new Float32Array(len);
  let seed = 7, prev = 0;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let n = 0; n < i0 + 2; n++) { prev = 0.6 * rnd() + 0.4 * prev; y[n] = prev; }
  const at = n => (1 - fr) * y[n - i0] + fr * y[n - i0 - 1];
  for (let n = i0 + 2; n < len; n++) y[n] = 0.996 * 0.5 * (at(n) + at(n - 1));
  return y.slice(4000, 4000 + N);
}

test("every open string reads within 1 cent, from a pure tone", () => {
  for (let st = 0; st < 6; st++) {
    const f = hz(OPEN_MIDI[st]), r = detectPitch(tone(f), SR);
    assert.ok(r, `${STRING_NAMES[st]}: no reading`);
    assert.ok(Math.abs(cents(r.freq, f)) < 1, `${STRING_NAMES[st]}: ${cents(r.freq, f).toFixed(2)} cents off`);
  }
});

test("the fundamental wins even when overtones are louder, with some noise", () => {
  for (let st = 0; st < 6; st++) {
    const f = hz(OPEN_MIDI[st]), r = detectPitch(tone(f, [0.6, 1, 0.8, 0.5, 0.3], 0.02), SR);
    assert.ok(r, `${STRING_NAMES[st]}: no reading`);
    assert.ok(Math.abs(cents(r.freq, f)) < 3, `${STRING_NAMES[st]}: read ${r.freq.toFixed(1)} Hz for ${f.toFixed(1)} Hz`);
  }
});

test("a plucked string reads within 3 cents", () => {
  for (let st = 0; st < 6; st++) {
    const f = hz(OPEN_MIDI[st]), r = detectPitch(pluck(f), SR);
    assert.ok(r, `${STRING_NAMES[st]}: no reading`);
    assert.ok(Math.abs(cents(r.freq, f)) < 3, `${STRING_NAMES[st]}: ${cents(r.freq, f).toFixed(2)} cents off`);
  }
});

test("detuned strings read their offset, flat and sharp", () => {
  for (const off of [-30, -12, -5, 5, 12, 30]) {
    const f = hz(45) * Math.pow(2, off / 1200), r = detectPitch(tone(f, [1, 0.7, 0.4]), SR);   // A string
    const n = noteOf(r.freq);
    assert.equal(n.name, "A");
    assert.ok(Math.abs(n.cents - off) < 1.5, `${off} cents read as ${n.cents.toFixed(2)}`);
  }
});

test("drop D still reads; silence and noise give no reading", () => {
  const d2 = detectPitch(tone(hz(38), [1, 0.8, 0.5]), SR);
  assert.equal(noteOf(d2.freq).name, "D");
  assert.equal(noteOf(d2.freq).octave, 2);
  assert.equal(detectPitch(new Float32Array(N), SR), null, "silence");
  assert.equal(detectPitch(tone(110).map(v => v * 0.005), SR), null, "too quiet");
  assert.ok(detectPitch(tone(110).map(v => v * 0.05), SR), "quiet, but still a string");
  assert.equal(detectPitch(tone(0, [0], 0.5), SR), null, "noise");
});

test("note names, octaves and cents", () => {
  assert.deepEqual(noteOf(440), { midi: 69, name: "A", octave: 4, cents: 0 });
  assert.equal(noteOf(hz(40)).name + noteOf(hz(40)).octave, "E2");    // low E
  assert.equal(noteOf(hz(64)).name + noteOf(hz(64)).octave, "E4");    // high e
  assert.equal(noteOf(hz(61)).name, "C♯");
  const sharp = noteOf(440 * Math.pow(2, 20 / 1200)), flat = noteOf(440 * Math.pow(2, -45 / 1200));
  assert.ok(Math.abs(sharp.cents - 20) < 1e-6 && sharp.name === "A");
  assert.ok(Math.abs(flat.cents + 45) < 1e-6 && flat.name === "A");
});
