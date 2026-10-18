// Pitch detection for the tuner (SPEC §16): the YIN method on a block of samples, and the nearest note with
// how many cents off it is. No DOM, so the tests can load it. In the browser it defines `Pitch`; in Node it is
// a CommonJS module.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Pitch = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  const MIN_HZ = 70;          // below low E (82 Hz), so drop D still reads
  const MAX_HZ = 1000;        // above the high e string's 12th fret (659 Hz)
  const THRESHOLD = 0.2;      // YIN: how aperiodic a period may be and still count (a fading string is noisier)
  const SILENCE = 0.003;      // RMS below this is silence: no reading (a phone microphone hears a fading string quietly)

  // The fundamental frequency of `buf` (samples at `sampleRate`), or null when it is silent or not periodic.
  // clarity: 0–1, how periodic the block is.
  function detectPitch(buf, sampleRate) {
    const n = buf.length;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += buf[i] * buf[i];
    if (Math.sqrt(sum / n) < SILENCE) return null;
    const maxTau = Math.min(Math.floor(sampleRate / MIN_HZ), Math.floor(n / 2));
    const minTau = Math.max(2, Math.floor(sampleRate / MAX_HZ));
    const w = n - maxTau;
    // Difference function, then normalised by its running mean (YIN steps 2 and 3)
    const d = new Float32Array(maxTau + 1);
    for (let tau = 1; tau <= maxTau; tau++) {
      let s = 0;
      for (let i = 0; i < w; i++) {
        const diff = buf[i] - buf[i + tau];
        s += diff * diff;
      }
      d[tau] = s;
    }
    const cm = new Float32Array(maxTau + 1);
    cm[0] = 1;
    let running = 0;
    for (let tau = 1; tau <= maxTau; tau++) {
      running += d[tau];
      cm[tau] = running > 0 ? d[tau] * tau / running : 1;
    }
    // The first dip under the threshold, followed down to its lowest point (step 4)
    let tau = -1;
    for (let t = minTau; t < maxTau; t++) {
      if (cm[t] < THRESHOLD) {
        while (t + 1 < maxTau && cm[t + 1] < cm[t]) t++;
        tau = t;
        break;
      }
    }
    if (tau < 0) return null;
    // Between samples: a parabola through the dip and its neighbours (step 5)
    const a = cm[tau - 1], b = cm[tau], c = cm[tau + 1], den = a - 2 * b + c;
    const exact = den !== 0 ? tau + (a - c) / (2 * den) : tau;
    return { freq: sampleRate / exact, clarity: 1 - b };
  }

  // The nearest note to `freq` (A4 = 440 Hz): its MIDI number, name, octave, and cents off (−50 to +50)
  function noteOf(freq) {
    const exact = 69 + 12 * Math.log2(freq / 440), midi = Math.round(exact);
    return { midi, name: NAMES[((midi % 12) + 12) % 12], octave: Math.floor(midi / 12) - 1, cents: (exact - midi) * 100 };
  }

  return { NAMES, MIN_HZ, MAX_HZ, SILENCE, detectPitch, noteOf };
});
