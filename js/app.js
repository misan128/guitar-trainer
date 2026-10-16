(() => {
  const WALK = 15;                 // 8 up + 7 down
  const LOOKAHEAD_MS = 25;
  const SCHEDULE_AHEAD = 0.1;
  const BASE_MIDI = 48;            // start note always in octave 3 (C3–B3)

  // Scale theory and fretboard walks live in theory.js (tested in tests/)
  const { MAJOR, KEYS, scaleNames, semis, STRING_NAMES, boardWalk, createStartPicker } = Theory;

  const $ = id => document.getElementById(id);
  const noteEl = $("note"), pickEl = $("pick"), phaseEl = $("phase"), trackEl = $("track");
  const inputs = { bpm: $("bpm"), prep: $("prep"), wait: $("wait") };
  const langEl = $("lang"), showAllEl = $("showAll");
  const keyBtn = $("keyBtn"), keyPanel = $("keyPanel"), keyGrid = $("keyGrid");
  const keyCount = $("keyCount"), keysAllBtn = $("keysAll"), keysClearBtn = $("keysClear");
  const roundKeyEl = $("roundKey");
  const bpmRange = $("bpmRange"), toggleBtn = $("toggle");
  const boardBtn = $("boardBtn"), boardPanel = $("boardPanel"), boardSwitch = $("boardSwitch");
  const fretFromEl = $("fretFrom"), fretToEl = $("fretTo"), boardEl = $("board"), mainEl = document.querySelector("main");

  // Panel order: circle of fifths (C G D A E B F♯ D♭ A♭ E♭ B♭ F)
  const FIFTHS = [];
  for (let i = 0, pc = 0; i < 12; i++, pc = (pc + 7) % 12) {
    const idx = KEYS.findIndex(k => k.pc === pc);
    FIFTHS.push(idx);
    const b = document.createElement("button");
    b.textContent = KEYS[idx].name;
    b.dataset.key = idx;
    keyGrid.appendChild(b);
  }
  for (const code in STRINGS) langEl.add(new Option(code.toUpperCase(), code));

  // ---- Language ----
  let T = STRINGS.en;
  function browserLang() {
    const prefs = navigator.languages || [navigator.language || ""];
    for (const l of prefs) {
      const code = String(l).toLowerCase().split("-")[0];
      if (STRINGS[code]) return code;
    }
    return "en";
  }
  function applyLang() {
    T = STRINGS[langEl.value];
    document.documentElement.lang = langEl.value;
    document.title = T.title;
    document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = T[el.dataset.i18n]; });
    document.querySelectorAll("[data-i18n-aria]").forEach(el => el.setAttribute("aria-label", T[el.dataset.i18nAria]));
    toggleBtn.textContent = running ? T.stop : T.start;
    renderKeys();
    if (!guideEl.hidden) showStep();
    if (running && lastShown) render(lastShown);
    else if (!running) phaseEl.textContent = T.idle;
  }

  // ---- Settings ----
  let showAll = true;                  // eye open by default, like the fretboard
  const DEFAULT_KEY = 0;               // C major; also what Clear goes back to
  let keys = [DEFAULT_KEY];            // selected key indices, circle-of-fifths order; never empty
  let order = "random";                // "random" | "sequential"
  // Fretboard (SPEC §13): on by default (aids start on, players turn them off); a zone spans at least ZONE_MIN frets
  const FRET_FIRST_MAX = 15, FRET_LAST_MAX = 19, ZONE_MIN = 5;
  const ZONE_DEFAULT = 2;              // frets 2–6
  let guideSeen = false;
  let board = true, fretFrom = ZONE_DEFAULT, fretTo = ZONE_DEFAULT + ZONE_MIN - 1;
  function setShowAll(v) {
    showAll = v;
    showAllEl.setAttribute("aria-pressed", String(v));
  }
  langEl.value = browserLang();       // overridden by saved settings
  // Keeps the zone valid: first fret 0–15, last fret up to 19, at least ZONE_MIN frets
  function setZone(from, to) {
    fretFrom = Number.isInteger(from) ? Math.min(FRET_FIRST_MAX, Math.max(0, from)) : ZONE_DEFAULT;
    fretTo = Number.isInteger(to) ? Math.min(FRET_LAST_MAX, Math.max(fretFrom + ZONE_MIN - 1, to)) : fretFrom + ZONE_MIN - 1;
  }
  function clampInput(el) {
    const v = Math.round(Number(el.value));
    const min = Number(el.min), max = Number(el.max);
    el.value = Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : min;
    return Number(el.value);
  }
  function save() {
    try {
      localStorage.setItem("scaleWalkLight", JSON.stringify({
        bpm: inputs.bpm.value, prep: inputs.prep.value, wait: inputs.wait.value,
        keys, order, key: keys[0], showAll: showAll, lang: langEl.value,
        board, fretFrom, fretTo, guideSeen
      }));
    } catch (e) {}
  }
  try {
    const s = JSON.parse(localStorage.getItem("scaleWalkLight") || "null");
    if (s) {
      for (const k of ["bpm", "prep", "wait"]) if (s[k] != null) inputs[k].value = s[k];
      const saved = Array.isArray(s.keys) ? s.keys : s.key != null ? [s.key] : [];
      const valid = FIFTHS.filter(i => saved.map(Number).includes(i));
      if (valid.length) keys = valid;
      if (s.order === "sequential") order = s.order;
      if (typeof s.showAll === "boolean") showAll = s.showAll;
      if (STRINGS[s.lang]) langEl.value = s.lang;
      if (typeof s.board === "boolean") board = s.board;   // older settings get the default
      guideSeen = s.guideSeen === true;
      setZone(Number(s.fretFrom), Number(s.fretTo));
    }
  } catch (e) {}
  setShowAll(showAll);
  for (const k in inputs) clampInput(inputs[k]);

  // Slider follows the BPM field; the gold fill is drawn in CSS from --fill
  function syncRange() {
    bpmRange.value = inputs.bpm.value;
    const min = Number(bpmRange.min), max = Number(bpmRange.max);
    bpmRange.style.setProperty("--fill", `${(bpmRange.value - min) / (max - min) * 100}%`);
  }
  syncRange();
  function setBpm(v) {
    inputs.bpm.value = v;
    clampInput(inputs.bpm);
    syncRange();
    save();
  }

  // − / +: a press steps once; holding repeats until release (mouse and touch).
  // The click that follows a pointer press is ignored, so a tap never counts twice.
  function stepInput(b) {
    const el = inputs[b.dataset.target], before = el.value;
    el.value = Number(el.value) + Number(b.dataset.delta);
    clampInput(el);
    if (el.value === before) return false;   // at the limit
    if (el === inputs.bpm) syncRange();
    save();
    if (!running) drawTrack(-1);
    return true;
  }
  let repeatTimer = null, heldBtn = null;
  function stopRepeat() {
    clearTimeout(repeatTimer);
    const b = heldBtn;
    if (b) {                               // skip the one click this press leaves behind
      b.classList.remove("held");
      b.skipClick = true;
      setTimeout(() => { b.skipClick = false; }, 500);
    }
    repeatTimer = heldBtn = null;
  }
  document.querySelectorAll(".stepper button").forEach(b => {
    b.addEventListener("pointerdown", e => {
      if (e.button !== 0) return;
      e.preventDefault();                  // no text selection or long-press menu
      stopRepeat();
      b.setPointerCapture(e.pointerId);
      heldBtn = b;
      b.classList.add("held");
      if (!stepInput(b)) return;
      const repeat = delay => { repeatTimer = setTimeout(() => stepInput(b) ? repeat(70) : stopRepeat(), delay); };
      repeat(400);
    });
    for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) b.addEventListener(ev, stopRepeat);
    // Keyboard activation (Enter/Space) only: browsers differ in how they mark the click after a tap
    b.addEventListener("click", () => { if (b.skipClick) b.skipClick = false; else stepInput(b); });
  });
  window.addEventListener("blur", stopRepeat);
  for (const k in inputs) inputs[k].addEventListener("change", () => {
    clampInput(inputs[k]);
    if (k === "bpm") syncRange();
    save();
    if (!running) drawTrack(-1);
  });

  // Slider: tap anywhere to jump there, then drag. Handled here because iOS only moves the thumb natively.
  const THUMB = 27;
  function rangeFromPointer(e) {
    const r = bpmRange.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (e.clientX - r.left - THUMB / 2) / (r.width - THUMB)));
    const min = Number(bpmRange.min), max = Number(bpmRange.max), v = Math.round(min + t * (max - min));
    if (v !== Number(inputs.bpm.value)) setBpm(v);
  }
  bpmRange.addEventListener("pointerdown", e => {
    if (e.button !== 0) return;
    e.preventDefault();
    bpmRange.setPointerCapture(e.pointerId);
    bpmRange.classList.add("dragging");
    bpmRange.focus({ preventScroll: true });
    rangeFromPointer(e);
  });
  bpmRange.addEventListener("pointermove", e => { if (bpmRange.hasPointerCapture(e.pointerId)) rangeFromPointer(e); });
  bpmRange.addEventListener("lostpointercapture", () => bpmRange.classList.remove("dragging"));
  bpmRange.addEventListener("input", () => setBpm(bpmRange.value));   // keyboard on the slider

  // ---- Key panel ----
  function renderKeys() {
    const names = keys.map(i => KEYS[i].name);
    keyBtn.textContent = keys.length === 1 ? T.keyName(names[0])
      : keys.length === 2 ? names.join(", ") : T.keysSummary(keys.length);
    keyBtn.setAttribute("aria-label", `${T.key}: ${keyBtn.textContent}`);
    for (const b of keyGrid.children) b.setAttribute("aria-pressed", String(keys.includes(Number(b.dataset.key))));
    keyCount.textContent = T.keysCount(keys.length, KEYS.length);
    keysAllBtn.disabled = keys.length === KEYS.length;
    keysClearBtn.disabled = keys.length === 1 && keys[0] === DEFAULT_KEY;
    for (const r of keyPanel.querySelectorAll("input[name=order]")) r.checked = r.value === order;
  }
  function setKeys(next) {
    keys = FIFTHS.filter(i => next.includes(i));
    renderKeys();
    save();
  }
  function openPanel() {
    closeBoard(false);
    keyPanel.hidden = false;
    keyBtn.setAttribute("aria-expanded", "true");
    (keyGrid.querySelector("[aria-pressed=true]") || keyGrid.firstChild).focus();
  }
  function closePanel(refocus) {
    if (keyPanel.hidden) return;
    keyPanel.hidden = true;
    keyBtn.setAttribute("aria-expanded", "false");
    if (refocus) keyBtn.focus();
  }
  keyBtn.addEventListener("click", () => keyPanel.hidden ? openPanel() : closePanel(true));
  keyGrid.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    const k = Number(b.dataset.key);
    if (keys.includes(k) && keys.length === 1) return;   // at least one key stays selected
    setKeys(keys.includes(k) ? keys.filter(i => i !== k) : keys.concat(k));
  });
  keysAllBtn.addEventListener("click", () => setKeys(FIFTHS));
  keysClearBtn.addEventListener("click", () => setKeys([DEFAULT_KEY]));   // back to C major
  keyPanel.addEventListener("change", e => {
    if (e.target.name !== "order") return;
    order = e.target.value;
    save();
  });
  // Tapping outside closes the panel
  document.addEventListener("pointerdown", e => {
    if (!keyPanel.hidden && !keyPanel.contains(e.target) && !keyBtn.contains(e.target)) closePanel(false);
  });
  // ---- Fretboard panel ----
  for (let f = 0; f <= FRET_FIRST_MAX; f++) fretFromEl.add(new Option(f, f));
  function renderBoardPanel() {
    boardBtn.classList.toggle("on", board);
    boardSwitch.setAttribute("aria-checked", String(board));
    fretFromEl.value = fretFrom;
    fretToEl.length = 0;
    for (let f = fretFrom + ZONE_MIN - 1; f <= FRET_LAST_MAX; f++) fretToEl.add(new Option(f, f));
    fretToEl.value = fretTo;
  }
  function openBoard() {
    closePanel(false);
    boardPanel.hidden = false;
    boardBtn.setAttribute("aria-expanded", "true");
    boardSwitch.focus();
  }
  function closeBoard(refocus) {
    if (boardPanel.hidden) return;
    boardPanel.hidden = true;
    boardBtn.setAttribute("aria-expanded", "false");
    if (refocus) boardBtn.focus();
  }
  boardBtn.addEventListener("click", () => boardPanel.hidden ? openBoard() : closeBoard(true));
  boardSwitch.addEventListener("click", () => { board = !board; renderBoardPanel(); save(); });
  fretFromEl.addEventListener("change", () => { setZone(Number(fretFromEl.value), fretTo); renderBoardPanel(); save(); });
  fretToEl.addEventListener("change", () => { setZone(fretFrom, Number(fretToEl.value)); renderBoardPanel(); save(); });
  $("boardDone").addEventListener("click", () => closeBoard(true));
  document.addEventListener("pointerdown", e => {
    if (!boardPanel.hidden && !boardPanel.contains(e.target) && !boardBtn.contains(e.target)) closeBoard(false);
  });

  showAllEl.addEventListener("click", () => {
    setShowAll(!showAll);
    save();
    if (running && lastShown) render(lastShown);
  });
  langEl.addEventListener("change", () => { applyLang(); save(); });

  // ---- Audio ----
  let ctx = null;
  let master = null;                   // per-session bus, faded out on stop
  function click(time, accent, soft) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = accent ? 1600 : 1000;
    const peak = soft ? (accent ? 0.3 : 0.18) : (accent ? 0.9 : 0.6);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
    osc.connect(gain).connect(master);
    osc.start(time);
    osc.stop(time + 0.05);
  }

  // Plucked string (Karplus-Strong) with fractional delay for exact tuning.
  const pluckCache = new Map();
  function pluckBuffer(midi) {
    if (pluckCache.has(midi)) return pluckCache.get(midi);
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
  function playNote(midi, time, duration) {
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = pluckBuffer(midi);
    gain.gain.setValueAtTime(0.7, time);
    if (duration) {                      // mute when the next note arrives
      gain.gain.setValueAtTime(0.7, time + duration * 0.92);
      gain.gain.linearRampToValueAtTime(0.0001, time + duration);
    }
    src.connect(gain).connect(master);
    src.start(time);
    src.stop(time + (duration || src.buffer.duration));
  }

  // ---- Lookahead scheduler ----
  let running = false, timerId = null;
  let nextTime = 0, step = 0;
  let round = null;
  let session = null;                  // keys and order are fixed for the whole session
  const queue = [];

  // Key sequence. Random: shuffle-bag, never the same key twice in a row.
  function pickKey() {
    const { keys } = session;
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
  function buildRound(keyIdx, deg) {
    const key = KEYS[keyIdx];
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
    return { walk, prep, wait, total: prep + WALK + wait, key, keyIdx, deg, next: KEYS[session.upcoming ?? keyIdx], board };
  }

  function newRound() {
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

  // The sound of tick `st` of round `r` at `time`: reference note on announce, then clicks and walk notes
  function playTick(r, st, time, beat) {
    if (st === 0) playNote(r.walk[0].midi, time);
    const w = st - r.prep;
    if (w >= 0 && w < WALK) {
      click(time, w === 0, true);              // soft click
      playNote(r.walk[w].midi, time, beat);
    } else {
      click(time, false, false);
    }
  }

  function scheduler() {
    while (nextTime < ctx.currentTime + SCHEDULE_AHEAD) {
      const beat = 60 / Number(inputs.bpm.value);
      if (step === 0) round = newRound();
      playTick(round, step, nextTime, beat);
      queue.push({ time: nextTime, step, round });
      nextTime += beat;
      step = (step + 1) % round.total;
    }
    timerId = setTimeout(scheduler, LOOKAHEAD_MS);
  }

  // ---- Drawing synced to what is audible ----
  let shownRound = null, lastShown = null, rafId = null;
  function draw() {
    if (!running) return;
    const now = ctx.currentTime - (ctx.outputLatency || 0);
    let current = null;
    while (queue.length && queue[0].time <= now) current = queue.shift();
    if (current) render(current);
    rafId = requestAnimationFrame(draw);
  }

  function render(tick) {
    const { step, round } = tick;
    lastShown = tick;
    if (round !== shownRound) {
      shownRound = round;
      buildTrack(round.prep, round.wait);
      pickEl.setAttribute("hidden", "");
      noteEl.hidden = false;
    }
    const w = step - round.prep;
    const inWalk = w >= 0 && w < WALK;
    noteEl.textContent = (inWalk && showAll ? round.walk[w] : round.walk[0]).name;

    const k = T.keyName(round.key.name);
    const left = round.total - step;
    // Several keys: the key sits above the note and the wait announces the next one.
    // With the fretboard there is no note letter, so the key goes back into the phase line.
    const multi = session.keys.length > 1, keyAbove = multi && !round.board;
    roundKeyEl.hidden = !keyAbove;
    if (keyAbove) roundKeyEl.textContent = k;
    const pre = keyAbove ? "" : `${k} · `;
    if (step < round.prep) phaseEl.textContent = pre + T.phasePrep(round.prep - step);
    else if (inWalk) phaseEl.textContent = pre + (w < 8 ? T.phaseUp : T.phaseDown);
    else phaseEl.textContent = multi ? T.phaseNextKey(T.keyName(round.next.name), left) : pre + T.phaseNext(left);
    if (round.board) {
      if (round !== boardRound) buildBoard(round);
      drawBoard(round, inWalk ? w : step < round.prep ? -1 : -2);
    } else if (!boardEl.hasAttribute("hidden")) hideBoard();
    drawTrack(step);
  }

  // ---- Fretboard drawing (SPEC §13.4) ----
  const SVG_NS = "http://www.w3.org/2000/svg";
  const FW = 54, SS = 16, LM = 18, TM = 8;     // fret width, string spacing, left and top margins
  let boardRound = null, boardParts = null;
  function el(tag, attrs, parent) {
    const n = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  const bx = (round, f) => LM + (f - round.board.from + .5) * FW;
  const by = st => TM + (5 - st) * SS;        // high e on top
  function buildBoard(round) {
    boardRound = round;
    const { from, to } = round.board, n = to - from + 1;
    const w = LM + n * FW + 4, bottom = TM + 5 * SS;
    boardEl.setAttribute("viewBox", `0 0 ${w} ${bottom + 22}`);
    boardEl.textContent = "";
    for (let st = 0; st < 6; st++) {
      el("line", { class: "str", x1: LM, x2: w - 4, y1: by(st), y2: by(st), "stroke-width": 1.8 - st * .2 }, boardEl);
      el("text", { x: LM / 2 - 2, y: by(st) + 3.5 }, boardEl).textContent = STRING_NAMES[st];
    }
    // Fret wires sit on column edges; with fret 0 the first column is the open strings, left of the nut
    for (let i = 0; i <= n; i++) {
      const cls = from === 0 ? (i === 1 ? "nut" : i === 0 ? null : "fret") : (i === 0 ? "edge" : "fret");
      if (cls) el("line", { class: cls, x1: LM + i * FW, x2: LM + i * FW, y1: by(5) - 2, y2: bottom + 2 }, boardEl);
    }
    for (let f = from; f <= to; f++) el("text", { x: bx(round, f), y: bottom + 18 }, boardEl).textContent = f;
    // Built once per round; each beat only toggles classes and moves the gradient's end points
    const grad = el("linearGradient", { id: "nextMove", gradientUnits: "userSpaceOnUse" }, el("defs", {}, boardEl));
    el("stop", { class: "grad-near", offset: 0 }, grad);
    el("stop", { class: "grad-far", offset: 1 }, grad);
    const path = el("g", { class: "path" }, boardEl);
    const up = round.walk.slice(0, 8);
    // Moves along a string are solid; string changes are dashed and fainter
    const segs = [];
    for (let i = 1; i < up.length; i++) {
      const a = up[i - 1], b = up[i];
      segs.push(el("line", { class: a.st === b.st ? "same" : "cross", x1: bx(round, a.f), y1: by(a.st), x2: bx(round, b.f), y2: by(b.st) }, path));
    }
    const active = el("line", { class: "active" }, path);   // current → next, with the gradient
    // One fixed group per position: a quiet dot, and a gold layer with the note name that lights up when current
    const pos = up.map(p => {
      const g = el("g", { class: "pos", transform: `translate(${bx(round, p.f)} ${by(p.st)})` }, boardEl);
      el("circle", { class: "dot", r: 6 }, g);
      const lit = el("g", { class: "lit" }, g);
      el("circle", { r: 9 }, lit);
      el("text", {}, lit).textContent = p.name;
      return g;
    });
    boardParts = { path, segs, active, grad, pos };
    boardEl.removeAttribute("hidden");   // SVG has no .hidden property
    mainEl.classList.add("with-board");
  }
  // w: walk index; -1 during prep, -2 during wait (both show the start position)
  // reveal: show the path even with the eye closed (dev mode inspection)
  const posOf = i => i < 8 ? i : 14 - i;        // walk index → position on the route (the way down reuses it)
  function drawBoard(round, w, reveal = showAll) {
    const { path, segs, active, grad, pos } = boardParts;
    // Fade from the tempo: never longer than a third of a beat, none when notes come faster than 250 ms
    const beat = 60 / Number(inputs.bpm.value), fade = beat < .25 ? 0 : Math.min(120, beat * 330);
    if (boardParts.fade !== fade) boardEl.style.setProperty("--fade", `${boardParts.fade = fade}ms`);
    path.style.display = reveal ? "" : "none";
    const curIdx = reveal && w >= 0 ? w : 0;      // eye closed: start position only
    const c = posOf(curIdx), down = w >= 8;
    // Played: behind the current position in the current direction (prep: nothing yet; wait: everything)
    const played = j => w === -2 || (w >= 0 && (down ? j > c : j < c));
    pos.forEach((g, j) => {
      g.style.display = reveal || j === 0 ? "" : "none";
      g.classList.toggle("cur", j === c);
      g.classList.toggle("played", reveal && j !== c && played(j));
    });
    segs.forEach((s, j) => s.classList.toggle("played", w === -2 || (w >= 0 && (down ? j >= c : j + 1 <= c))));
    // The next move: during prep it is the first step of the walk; none after the last note or during the wait
    const n = w === -1 ? 1 : w >= 0 && w < round.walk.length - 1 ? w + 1 : -1;
    active.style.display = reveal && n >= 0 ? "" : "none";
    pos.forEach((g, j) => g.classList.toggle("next", reveal && n >= 0 && j === posOf(n) && j !== c));
    if (reveal && n >= 0) {
      const p = round.walk[curIdx], q = round.walk[n];
      const pts = { x1: bx(round, p.f), y1: by(p.st), x2: bx(round, q.f), y2: by(q.st) };
      for (const k in pts) { active.setAttribute(k, pts[k]); grad.setAttribute(k, pts[k]); }
    }
    boardEl.setAttribute("aria-label", T.boardAria(round.board.from, round.board.to));
  }
  function hideBoard() {
    boardEl.setAttribute("hidden", "");
    boardRound = null;
    mainEl.classList.remove("with-board");
  }

  // Bars: flat for prep and wait; rise and fall during the walk
  function buildTrack(prep, wait) {
    trackEl.innerHTML = "";
    const add = (h, walk) => {
      const s = document.createElement("span");
      s.style.height = h + "%";
      if (walk) s.className = "walk";
      trackEl.appendChild(s);
    };
    for (let i = 0; i < prep; i++) add(14, false);
    for (let i = 0; i < WALK; i++) add(24 + (i < 8 ? i : 14 - i) * 10.8, true);
    for (let i = 0; i < wait; i++) add(14, false);
  }
  function drawTrack(step) {
    if (step < 0) buildTrack(Number(inputs.prep.value), Number(inputs.wait.value));
    [...trackEl.children].forEach((s, i) => s.classList.toggle("on", i === step));
  }

  // ---- Wake Lock: keep the screen on while running ----
  let wakeLock = null;
  async function lockScreen() {
    if (!("wakeLock" in navigator) || wakeLock) return;
    try {
      const lock = await navigator.wakeLock.request("screen");
      if (!running) { lock.release(); return; }
      wakeLock = lock;
      lock.addEventListener("release", () => { if (wakeLock === lock) wakeLock = null; });
    } catch (e) {}
  }
  function unlockScreen() {
    if (wakeLock) wakeLock.release().catch(() => {});
    wakeLock = null;
  }
  // The system drops the lock when the page is hidden; ask again on return.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && running) lockScreen();
  });

  // ---- Start / stop ----
  let runId = 0;
  async function start() {
    if (!ctx) {
      // iOS: play through the silent switch like a media app (Safari 17+)
      if (navigator.audioSession) navigator.audioSession.type = "playback";
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // resume() must be called inside the gesture; awaiting it is fine
    const resumed = ctx.state === "running" ? null : ctx.resume();
    for (const k in inputs) clampInput(inputs[k]);
    closePanel(false);
    closeBoard(false);
    session = { keys: keys.slice(), order, names: {}, bag: [], pos: 0, last: null, upcoming: null,
                board: board ? { from: fretFrom, to: fretTo } : null, pickStart: createStartPicker() };
    keyBtn.disabled = true;
    boardBtn.disabled = true;
    document.body.classList.add("practicing");
    helpBtn.disabled = true;
    running = true;
    const id = ++runId;
    toggleBtn.textContent = T.stop;
    toggleBtn.classList.add("running");
    lockScreen();
    if (resumed) {
      try { await resumed; } catch (e) {}
      if (!running || id !== runId) return;   // stopped or restarted meanwhile
    }
    master = ctx.createGain();
    master.connect(ctx.destination);
    step = 0;
    queue.length = 0;
    shownRound = null;
    lastShown = null;
    nextTime = ctx.currentTime + 0.1;
    scheduler();
    rafId = requestAnimationFrame(draw);
  }
  function stop() {
    running = false;
    dbgPaused = false;
    clearTimeout(timerId);
    cancelAnimationFrame(rafId);
    if (master) {                      // silence notes already scheduled ahead
      const m = master;
      master = null;
      m.gain.setTargetAtTime(0, ctx.currentTime, 0.015);
      setTimeout(() => m.disconnect(), 200);
    }
    unlockScreen();
    queue.length = 0;
    keyBtn.disabled = false;
    boardBtn.disabled = false;
    document.body.classList.remove("practicing");
    helpBtn.disabled = false;
    hideBoard();
    roundKeyEl.hidden = true;
    noteEl.hidden = true;
    pickEl.removeAttribute("hidden");
    phaseEl.textContent = T.idle;
    drawTrack(-1);
    toggleBtn.textContent = T.start;
    toggleBtn.classList.remove("running");
  }
  toggleBtn.addEventListener("click", () => running ? stop() : start());

  document.addEventListener("keydown", e => {
    if (e.target.tagName === "INPUT" && e.target.type === "number") return;
    if (e.target.tagName === "SELECT") return;
    if (e.target.closest("#dbgPanel")) return;   // dev mode panel
    if (!guideEl.hidden) {               // shortcuts are off during the guide
      if (e.key === "Escape") closeGuide();
      return;
    }
    if (!keyPanel.hidden || !boardPanel.hidden) {   // shortcuts are off while a panel is open
      if (e.key === "Escape") { closePanel(true); closeBoard(true); }
      return;
    }
    if (e.code === "Space") { e.preventDefault(); if (!e.repeat) running ? stop() : start(); }
    if (e.key === "ArrowUp") { e.preventDefault(); setBpm(Number(inputs.bpm.value) + (e.shiftKey ? 5 : 1)); }
    if (e.key === "ArrowDown") { e.preventDefault(); setBpm(Number(inputs.bpm.value) - (e.shiftKey ? 5 : 1)); }
  });

  // ---- First-use guide (SPEC §14) ----
  const guideEl = $("guide"), guideSpot = $("guideSpot"), guideTip = $("guideTip");
  const guideNext = $("guideNext"), helpBtn = $("helpBtn");
  // The language step comes first so the rest is read in the chosen language; it is skipped when reopened with ?
  const GUIDE = [
    { target: () => langEl, key: "guideLangPick", langs: true },
    { target: () => document.querySelector(".display"), key: "guideRound" },
    { target: () => keyBtn, key: "guideKeys" },
    { target: () => showAllEl, key: "guideEye" },
    { target: () => boardBtn, key: "guideBoard" },
    { target: () => helpBtn, key: "guideHelp" },
  ];
  let steps = GUIDE, guideStep = 0, guideFromHelp = false;
  const guideLangs = $("guideLangs");
  for (const code in STRINGS) {
    const b = guideLangs.appendChild(document.createElement("button"));
    b.dataset.lang = code;
    b.lang = code;
    b.textContent = STRINGS[code].langName;
  }
  guideLangs.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    langEl.value = b.dataset.lang;
    applyLang();                       // re-renders the step in the new language
    save();
  });
  function showStep() {
    const step = steps[guideStep], last = guideStep === steps.length - 1;
    $("guideTitle").textContent = T[step.key + "Title"];
    $("guideText").textContent = T[step.key + "Text"];
    guideNext.textContent = last ? T.guideDone : T.guideNext;
    guideLangs.hidden = !step.langs;
    for (const b of guideLangs.children) b.setAttribute("aria-pressed", String(b.dataset.lang === langEl.value));
    const dots = $("guideDots");
    dots.textContent = "";
    dots.setAttribute("aria-label", T.guideStep(guideStep + 1, steps.length));
    steps.forEach((_, i) => dots.appendChild(document.createElement("i")).classList.toggle("on", i === guideStep));
    placeGuide();
  }
  // Cutout around the target; bubble below it, or above when it does not fit
  function placeGuide() {
    if (guideEl.hidden) return;
    const r = steps[guideStep].target().getBoundingClientRect(), pad = 6;
    Object.assign(guideSpot.style, { top: `${r.top - pad}px`, left: `${r.left - pad}px`, width: `${r.width + 2 * pad}px`, height: `${r.height + 2 * pad}px` });
    const tw = guideTip.offsetWidth, th = guideTip.offsetHeight, gap = 14;
    const below = r.bottom + pad + gap, above = r.top - pad - gap - th;
    guideTip.style.top = `${below + th <= innerHeight - 8 || above < 8 ? below : above}px`;
    guideTip.style.left = `${Math.min(innerWidth - tw - 16, Math.max(16, r.left + r.width / 2 - tw / 2))}px`;
  }
  function openGuide(fromHelp) {
    if (running) return;
    closePanel(false);
    closeBoard(false);
    guideStep = 0;
    guideFromHelp = fromHelp;
    steps = fromHelp ? GUIDE.filter(s => !s.langs) : GUIDE;
    guideEl.hidden = false;
    showStep();
    guideNext.focus();
  }
  function closeGuide() {
    guideEl.hidden = true;
    guideSeen = true;
    save();
    if (guideFromHelp) helpBtn.focus();
  }
  guideNext.addEventListener("click", () => {
    if (guideStep === steps.length - 1) return closeGuide();
    guideStep++;
    showStep();
  });
  $("guideSkip").addEventListener("click", closeGuide);
  helpBtn.addEventListener("click", () => openGuide(true));
  window.addEventListener("resize", placeGuide);

  renderBoardPanel();
  applyLang();
  drawTrack(-1);
  // ---- Dev mode: only with ?debug in the URL (docs/TESTING.md) ----
  // Pause stops the scheduler on a cursor (round + tick). From there, stepping, seeking along the walk
  // or swapping the round's key and degree shows and sounds at once; resume plays on from the cursor.
  // While running, the same changes apply on the fly.
  let dbgPaused = false;
  if (new URLSearchParams(location.search).has("debug")) {
    const keyIndex = name => {
      const n = String(name).trim().replace(/^./, c => c.toUpperCase()).replace("#", "♯").replace(/^(.)b$/, "$1♭");
      const i = KEYS.findIndex(k => k.name === n);
      if (i < 0) throw new Error(`Unknown key "${name}". Use one of: ${KEYS.map(k => k.name).join(" ")} (# and b work too).`);
      return i;
    };
    const degree = d => {
      if (!Number.isInteger(d) || d < 1 || d > 7) throw new Error("Degree goes from 1 (tonic) to 7.");
      return d - 1;
    };
    const phaseOf = (r, st) => st < r.prep ? "prep" : st < r.prep + WALK ? (st - r.prep < 8 ? "up" : "down") : "wait";
    const fingering = w => w.slice(0, 8).map(p => p.st != null ? STRING_NAMES[p.st] + p.f : p.name).join(" ");
    const beatLen = () => 60 / Number(inputs.bpm.value);
    let cursor = null;                   // { round, step } while paused
    // Paused: put the cursor on a tick, draw it and play it now
    function showTick(r, st) {
      cursor = { round: r, step: st };
      round = r;
      render(cursor);
      playTick(r, st, ctx.currentTime + .01, beatLen());
    }
    // Silences what was already scheduled ahead and opens a fresh bus for what comes next
    function freshBus() {
      const m = master;
      m.gain.setTargetAtTime(0, ctx.currentTime, .015);
      setTimeout(() => m.disconnect(), 200);
      master = ctx.createGain();
      master.connect(ctx.destination);
    }
    window.dbg = {
      help() {
        console.info([
          "dbg.pause() / dbg.resume()   stop on the current tick / play on from it",
          "dbg.step()                   paused: next tick now (moves on to a new round at the end)",
          "dbg.seek(i)                  go to walk note i (0–14): now if paused, next tick if running",
          'dbg.round("G", 3)            swap the current round for G major from degree 3 (1 = tonic … 7), same position',
          'dbg.walk("C", 1, 5, 9, i)    stopped: draw that walk on frets 5–9, current note at walk index i',
          "dbg.state()                  phase, tick, key, walk and settings",
        ].join("\n"));
      },
      pause() {
        if (!running || dbgPaused) return "Not running, or already paused.";
        dbgPaused = true;
        clearTimeout(timerId);
        cancelAnimationFrame(rafId);
        freshBus();
        queue.length = 0;
        cursor = lastShown ? { round: lastShown.round, step: lastShown.step } : { round, step: 0 };
        render(cursor);
        return "Paused.";
      },
      resume() {
        if (!dbgPaused) return "Not paused.";
        dbgPaused = false;
        round = cursor.round;
        step = (cursor.step + 1) % round.total;    // the cursor tick was the last one heard
        nextTime = ctx.currentTime + beatLen();
        scheduler();
        rafId = requestAnimationFrame(draw);
        return "Running.";
      },
      step() {
        if (!dbgPaused) return "Pause first.";
        let r = cursor.round, st = cursor.step + 1;
        if (st >= r.total) { r = newRound(); st = 0; }
        showTick(r, st);
        return `tick ${st + 1}/${r.total}`;
      },
      seek(i) {
        if (!running) return "Start first (stopped: dbg.walk draws without playing).";
        const n = Math.min(WALK - 1, Math.max(0, Math.round(Number(i))));
        if (dbgPaused) showTick(cursor.round, cursor.round.prep + n);
        else step = round.prep + n;                // the scheduler plays it on its next tick
        return `walk ${n}`;
      },
      round(name, deg) {
        if (!running) return "Start first (stopped: dbg.walk draws without playing).";
        const k = keyIndex(name), d = degree(deg);
        const r = buildRound(k, d);
        if (dbgPaused) showTick(r, Math.min(cursor.step, r.total - 1));
        else round = r;                            // the next ticks use it, same position
        return `${KEYS[k].name} major from degree ${deg}`;
      },
      walk(name, deg, from = fretFrom, to = fretTo, i = 0) {
        if (running) return "Stop first: this draws without playing.";
        if (to - from < ZONE_MIN - 1) return `A zone needs at least ${ZONE_MIN} frets.`;
        const key = KEYS[keyIndex(name)], d = degree(deg), names = scaleNames(key);
        const bw = boardWalk(key.pc, d, from, to);
        if (!bw) return "No playable walk in that zone.";
        const up = bw.pos.map(([st, f], k) => ({ midi: bw.pitches[k], name: names[(d + k) % 7], st, f }));
        const r = { walk: up.concat(up.slice(0, 7).reverse()), board: { from, to } };
        buildBoard(r);
        drawBoard(r, Math.min(14, Math.max(0, i)), true);
        return `${key.name} major from degree ${deg}, frets ${from}–${to}: ${fingering(r.walk)} (start ${bw.pitches[0]} MIDI)`;
      },
      state() {
        const t = dbgPaused ? cursor : lastShown;
        return {
          running, paused: dbgPaused,
          phase: t ? phaseOf(t.round, t.step) : null,
          tick: t ? `${t.step + 1}/${t.round.total}` : null,
          key: t ? `${t.round.key.name} major, degree ${t.round.deg + 1}` : null,
          walk: t ? fingering(t.round.walk) : null,
          settings: { bpm: Number(inputs.bpm.value), prep: Number(inputs.prep.value), wait: Number(inputs.wait.value),
            keys: keys.map(k => KEYS[k].name), order, board, zone: `${fretFrom}–${fretTo}`, eye: showAll, lang: langEl.value },
        };
      },
    };
    console.info("Scale Trainer dev mode. dbg.help() lists the commands.");

    // Overlay: a small "dbg" pill that opens a panel with the same controls. English only: dev tool.
    const css = document.createElement("style");
    css.textContent = `
      #dbgPanel { position: fixed; right: .75rem; top: calc(env(safe-area-inset-top, 0px) + 3.4rem); z-index: 5;
        font: 500 12px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--bone); }
      /* One piece: the pill grows into the panel from its top-right corner and shrinks back there */
      #dbgPanel .pill { height: auto; padding: .3rem .6rem; border-radius: 999px; background: rgba(42, 32, 27, .85);
        color: var(--muted); opacity: .7; touch-action: none; user-select: none; -webkit-user-select: none; }
      #dbgPanel .pill:hover { opacity: 1; color: var(--brass); }
      #dbgPanel .dbg-body { transform-origin: top right; animation: dbg-in .14s ease-out; }
      #dbgPanel .dbg-body.out { animation: dbg-out .12s ease-in forwards; }
      @keyframes dbg-in { from { opacity: 0; transform: scale(.4); } }
      @keyframes dbg-out { to { opacity: 0; transform: scale(.4); } }
      @media (prefers-reduced-motion: reduce) { #dbgPanel .dbg-body, #dbgPanel .dbg-body.out { animation: none; } }
      #dbgPanel .dbg-body { width: min(17rem, calc(100vw - 1.5rem)); padding: .6rem; border-radius: 10px;
        background: rgba(29, 22, 19, .94); border: 1px solid var(--wire); box-shadow: 0 8px 24px rgba(0, 0, 0, .4); display: grid; gap: .45rem; }
      #dbgPanel .grip { display: flex; justify-content: flex-end; align-items: center; gap: .5rem;
        margin: -.6rem -.6rem 0; padding: .3rem .4rem .3rem .6rem; border-bottom: 1px solid var(--wire);
        color: var(--muted); cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; }
      #dbgPanel .grip .fold { height: 1.4rem; width: 1.6rem; padding: 0; line-height: 1; font-size: 15px; }
      #dbgPanel .grip:active { cursor: grabbing; }
      #dbgPanel .row { display: flex; gap: .35rem; align-items: center; }
      #dbgPanel .lbl { width: 2.6rem; color: var(--muted); }
      #dbgPanel button, #dbgPanel select { height: 1.9rem; padding: 0 .5rem; border: 1px solid var(--wire); border-radius: 6px;
        background: var(--wood-2); color: var(--bone); font: inherit; background-image: none; width: auto; cursor: pointer; }
      #dbgPanel button:disabled { opacity: .35; cursor: default; }
      #dbgPanel [hidden] { display: none !important; }
      #dbgPanel input[type=range] { flex: 1; accent-color: var(--brass); }
      #dbgPanel pre { margin: 0; padding-top: .4rem; border-top: 1px solid var(--wire); color: var(--muted); white-space: pre-wrap; }`;
    document.head.appendChild(css);
    const panel = document.createElement("div");
    panel.id = "dbgPanel";
    const keyOpts = FIFTHS.map(i => `<option value="${KEYS[i].name}">${KEYS[i].name}</option>`).join("");
    const degOpts = [1, 2, 3, 4, 5, 6, 7].map(d => `<option>${d}</option>`).join("");
    panel.innerHTML = `<button class="pill" title="Dev panel">dbg</button>
      <div class="dbg-body" hidden>
        <div class="grip" title="Drag to move"><span>dbg</span><button class="fold" title="Collapse" aria-label="Collapse">−</button></div>
        <div class="row"><span class="lbl">play</span>
          <button data-a="pause" title="Pause / play on">⏸</button><button data-a="step" title="Next tick (paused)">⏭</button></div>
        <div class="row" title="Key of the current round"><span class="lbl">round</span>
          <select data-f="key">${keyOpts}</select></div>
        <div class="row" title="Note of the walk: its degree and its position (0–14) move together"><span class="lbl">walk</span>
          <select data-f="deg">${degOpts}</select><input data-f="idx" type="range" min="0" max="14" value="0"></div>
        <pre></pre>
      </div>`;
    document.body.appendChild(panel);
    const q = sel => panel.querySelector(sel), out = q("pre");
    const pauseBtn = q("[data-a=pause]"), stepBtn = q("[data-a=step]"), idx = q("[data-f=idx]");
    const keySel = q("[data-f=key]"), degSel = q("[data-f=deg]");
    // Every action's result goes to the panel and to the console
    const say = v => {
      if (typeof v === "string") { out.dataset.msg = v; console.log(`[dbg] › ${v}`); }
      refresh();
    };
    // The degree select and the slider are one control: the current note of the walk, as a degree and as a position.
    // Degree (0-based) of walk note i in a round that starts on degree `start`
    const degreeAt = (start, i) => (start + (i < 8 ? i : 14 - i)) % 7;
    // Position of degree d nearest to the current one (each degree is on the way up and on the way down)
    const positionOf = (start, d, cur) => {
      const k = (d - start + 7) % 7, options = k === 0 ? [0, 7, 14] : [k, 14 - k];
      return options.reduce((best, o) => Math.abs(o - cur) < Math.abs(best - cur) ? o : best);
    };
    const current = () => { const t = dbgPaused ? cursor : lastShown; return running && t ? t : null; };
    // Stopped: preview the selected key's walk from the tonic
    function previewWalk() {
      degSel.value = String(degreeAt(0, Number(idx.value)) + 1);
      say(dbg.walk(keySel.value, 1, fretFrom, fretTo, Number(idx.value)));
    }
    let touched = 0;                   // the selects keep the user's choice for a moment before following again
    keySel.addEventListener("change", () => {
      touched = Date.now();
      const t = current();
      if (!t) return previewWalk();
      say(dbg.round(keySel.value, t.round.deg + 1));   // same start degree and position, new key
    });
    degSel.addEventListener("change", () => {
      touched = Date.now();
      const t = current(), start = t ? t.round.deg : 0;
      const w = t ? Math.min(WALK - 1, Math.max(0, t.step - t.round.prep)) : Number(idx.value);
      idx.value = positionOf(start, Number(degSel.value) - 1, w);
      if (!t) return previewWalk();
      say(dbg.seek(idx.value));
    });
    let sliding = false;
    idx.addEventListener("pointerdown", () => { sliding = true; });
    addEventListener("pointerup", () => { sliding = false; });
    idx.addEventListener("input", () => {
      const t = current();
      if (!t) return previewWalk();
      degSel.value = String(degreeAt(t.round.deg, Number(idx.value)) + 1);
      say(dbg.seek(idx.value));
    });
    // The state line is printed to the console whenever it changes, panel open or not.
    // While running, the key, the degree and the slider follow the current round and note.
    let lastLine = "";
    function refresh() {
      const st = dbg.state(), t = current();
      const line = (st.running && !st.phase ? "starting" : st.running ? `${st.phase} ${st.tick} · ${st.key}${st.paused ? " · paused" : ""}\n${st.walk}` : "stopped");
      if (line !== lastLine) { lastLine = line; console.log(`[dbg] ${line.replace(/\n/g, " · ")}`); }
      pauseBtn.textContent = st.paused ? "▶" : "⏸";
      pauseBtn.disabled = !st.running;
      stepBtn.disabled = !st.paused;
      if (t && !sliding && Date.now() - touched > 600) {
        const w = Math.min(WALK - 1, Math.max(0, t.step - t.round.prep));   // prep shows the first note, wait the last
        keySel.value = t.round.key.name;
        idx.value = w;
        degSel.value = String(degreeAt(t.round.deg, w) + 1);
      }
      if (!body.hidden) out.textContent = line + (out.dataset.msg ? `\n› ${out.dataset.msg}` : "");
    }
    setInterval(refresh, 250);
    panel.addEventListener("click", e => {
      const a = e.target.closest("button")?.dataset.a;
      if (a === "pause") say(dbgPaused ? dbg.resume() : dbg.pause());
      if (a === "step") say(dbg.step());
    });

    // Pill and panel share their top-right corner: open grows from it, close shrinks back to it,
    // so an unmoved panel folds back exactly where it started
    const body = q(".dbg-body"), grip = q(".grip"), pill = q(".pill");
    function placeAt(x, y) {
      const r = panel.getBoundingClientRect();
      x = Math.min(innerWidth - r.width, Math.max(0, x));
      y = Math.min(innerHeight - r.height, Math.max(0, y));
      Object.assign(panel.style, { left: `${x}px`, top: `${y}px`, right: "auto" });
    }
    function openPanelDbg() {
      const r = panel.getBoundingClientRect();
      pill.hidden = true;
      body.hidden = false;
      placeAt(r.right - panel.getBoundingClientRect().width, r.top);
      refresh();
    }
    let closing = false;
    function closePanelDbg() {
      if (body.hidden || closing) return;
      closing = true;
      body.classList.add("out");
      setTimeout(() => {
        const r = panel.getBoundingClientRect();
        body.classList.remove("out");
        body.hidden = true;
        pill.hidden = false;
        placeAt(r.right - panel.getBoundingClientRect().width, r.top);
        closing = false;
      }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 120);
    }
    // The pill opens on a tap; a drag (moved more than a few pixels) just moves it
    let dragged = false;
    pill.addEventListener("click", () => { if (dragged) dragged = false; else openPanelDbg(); });
    q(".fold").addEventListener("click", () => { closePanelDbg(); pill.focus(); });
    // Tapping anywhere else, or Esc, folds it back into the pill
    document.addEventListener("pointerdown", e => { if (!panel.contains(e.target)) closePanelDbg(); }, true);
    document.addEventListener("keydown", e => { if (e.key === "Escape" && !body.hidden) { closePanelDbg(); pill.focus(); } });
    addEventListener("resize", () => { const r = panel.getBoundingClientRect(); placeAt(r.left, r.top); });

    // Drag by the header, or by the pill itself; it stays inside the screen
    function draggable(handle, threshold) {
      handle.addEventListener("pointerdown", e => {
        if (e.button !== 0 || e.target.closest(".fold")) return;
        if (handle === grip) e.preventDefault();
        handle.setPointerCapture(e.pointerId);
        const r = panel.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
        const x0 = e.clientX, y0 = e.clientY;
        let moving = threshold === 0;
        if (handle === pill) dragged = false;
        const move = ev => {
          if (!moving && Math.hypot(ev.clientX - x0, ev.clientY - y0) < threshold) return;
          moving = true;
          if (handle === pill) dragged = true;   // the click that follows must not open it
          placeAt(ev.clientX - dx, ev.clientY - dy);
        };
        handle.addEventListener("pointermove", move);
        handle.addEventListener("lostpointercapture", () => handle.removeEventListener("pointermove", move), { once: true });
      });
    }
    draggable(grip, 0);
    draggable(pill, 5);
  }

  if (!guideSeen) openGuide(false);

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
