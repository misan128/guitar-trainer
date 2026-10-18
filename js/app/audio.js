// Sound: metronome clicks and plucked-string notes, through a bus that is opened per session
export const audio = {
  ctx: null,
  master: null,                        // per-session bus, faded out on stop
};

// Created on the first Start (inside the gesture); resume() must also be called inside it
export function wakeAudio() {
  if (!audio.ctx) {
    // iOS: play through the silent switch like a media app (Safari 17+)
    if (navigator.audioSession) navigator.audioSession.type = "playback";
    audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audio.ctx.state === "running" ? null : audio.ctx.resume();
}
export function openBus() {
  audio.master = audio.ctx.createGain();
  audio.master.connect(audio.ctx.destination);
}
export function closeBus() {
  if (!audio.master) return;           // silence notes already scheduled ahead
  const m = audio.master;
  audio.master = null;
  m.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.015);
  setTimeout(() => m.disconnect(), 200);
}

export function click(time, accent, soft) {
  const { ctx } = audio;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = accent ? 1600 : 1000;
  const peak = soft ? (accent ? 0.3 : 0.18) : (accent ? 0.9 : 0.6);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(peak, time + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
  osc.connect(gain).connect(audio.master);
  osc.start(time);
  osc.stop(time + 0.05);
}

// Plucked string (Karplus-Strong) with fractional delay for exact tuning.
const pluckCache = new Map();
function pluckBuffer(midi) {
  if (pluckCache.has(midi)) return pluckCache.get(midi);
  const { ctx } = audio;
  const sr = ctx.sampleRate;
  const freq = 440 * Math.pow(2, (midi - 69) / 12);
  const len = Math.floor(sr * 1.6);
  const y = new Float32Array(len);
  const P = sr / freq - 0.5;          // averaging adds half a sample of delay
  const i0 = Math.floor(P), fr = P - i0;
  const seed = i0 + 2;
  let prev = 0;
  for (let n = 0; n < seed; n++) {    // smoothed noise burst
    prev = 0.6 * (Math.random() * 2 - 1) + 0.4 * prev;
    y[n] = prev;
  }
  const decay = 0.996;
  const at = n => (1 - fr) * y[n - i0] + fr * y[n - i0 - 1];
  for (let n = seed; n < len; n++) y[n] = decay * 0.5 * (at(n) + at(n - 1));
  const fade = Math.floor(sr * 0.05);
  for (let n = 0; n < fade; n++) y[len - 1 - n] *= n / fade;
  const buf = ctx.createBuffer(1, len, sr);
  buf.copyToChannel(y, 0);
  pluckCache.set(midi, buf);
  return buf;
}
// out: where it sounds; the session's bus by default
export function playNote(midi, time, duration, out = audio.master) {
  const { ctx } = audio;
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  src.buffer = pluckBuffer(midi);
  gain.gain.setValueAtTime(0.7, time);
  if (duration) {                      // mute when the next note arrives
    gain.gain.setValueAtTime(0.7, time + duration * 0.92);
    gain.gain.linearRampToValueAtTime(0.0001, time + duration);
  }
  src.connect(gain).connect(out);
  src.start(time);
  src.stop(time + (duration || src.buffer.duration));
}
// Tuner: an open string to tune by ear, outside any practice session (its own bus, always open)
let refBus = null;
export function playReference(midi) {
  if (!refBus) {
    refBus = audio.ctx.createGain();
    refBus.connect(audio.ctx.destination);
  }
  playNote(midi, audio.ctx.currentTime + 0.02, 0, refBus);
}
