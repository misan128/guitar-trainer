(() => {
  // A round's route: `walk` (its notes, up then back down) and `peak` (index of the top note).
  // Scale walk: 8 up + 7 down. Other exercises bring their own length (SPEC §15).
  const WALK = 15, WALK_PEAK = 7;
  const LOOKAHEAD_MS = 25;
  const SCHEDULE_AHEAD = 0.1;
  const BASE_MIDI = 48;            // start note always in octave 3 (C3–B3)

  // Scale theory and fretboard walks live in theory.js (tested in tests/)
  const { MAJOR, KEYS, scaleNames, semis, STRING_NAMES, boardWalk, createStartPicker, PENTA_SHAPES, MINOR_KEYS, PENTA_MAX_FRET, pentaPlacements, pentaShape } = Theory;

  const $ = id => document.getElementById(id);
  const noteEl = $("note"), pickEl = $("pick"), phaseEl = $("phase"), trackEl = $("track");
  const inputs = { bpm: $("bpm"), prep: $("prep"), wait: $("wait") };
  const langEl = $("lang"), showAllEl = $("showAll");
  const keyBtn = $("keyBtn"), keyPanel = $("keyPanel"), keyGrid = $("keyGrid");
  const keyCount = $("keyCount"), keysAllBtn = $("keysAll"), keysClearBtn = $("keysClear");
  const walkSetup = $("walkSetup"), pentaSetup = $("pentaSetup"), shapeGrid = $("shapeGrid"), shapeKey = $("shapeKey");
  const pentaKeyGrid = $("pentaKeyGrid"), placeRow = $("placeRow"), placeGrid = $("placeGrid"), openHint = $("openHint");
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
    else if (!running) showIdle();
  }

  // ---- Settings ----
  let showAll = true;                  // eye open by default, like the fretboard
  const DEFAULT_KEY = 0;               // C major; also what Clear goes back to
  let keys = [DEFAULT_KEY];            // selected key indices, circle-of-fifths order; never empty
  let order = "random";                // "random" | "sequential"
  // Exercise (SPEC §15.1): BPM, ticks, eye, language and guide are shared; keys and fretboard belong to Scale walk
  let exercise = "walk";               // "walk" | "penta"
  let shapeNo = 1;                     // Pentatonic shape, 1–5
  let pentaKey = 0;                    // Pentatonic minor key: index into MINOR_KEYS (A minor)
  let pentaPlace = {};                 // chosen placement per "key:shape" (its first fret), when there are two
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
        board, fretFrom, fretTo, guideSeen, exercise, pentaShape: shapeNo, pentaKey, pentaPlace
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
      if (s.exercise === "penta") exercise = "penta";
      if (PENTA_SHAPES[s.pentaShape]) shapeNo = Number(s.pentaShape);
      if (MINOR_KEYS[s.pentaKey]) pentaKey = Number(s.pentaKey);
      if (s.pentaPlace && typeof s.pentaPlace === "object") for (const k in s.pentaPlace) if (Number.isInteger(s.pentaPlace[k])) pentaPlace[k] = s.pentaPlace[k];
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
    const names = keys.map(i => KEYS[i].name), penta = exercise === "penta";
    keyBtn.textContent = penta ? shapeLabel(shapeNo) : keys.length === 1 ? T.keyName(names[0])
      : keys.length === 2 ? names.join(", ") : T.keysSummary(keys.length);
    keyBtn.setAttribute("aria-label", `${penta ? T.shape : T.key}: ${keyBtn.textContent}`);
    for (const b of keyPanel.querySelectorAll("[data-ex]")) b.setAttribute("aria-pressed", String(b.dataset.ex === exercise));
    walkSetup.hidden = penta;
    pentaSetup.hidden = !penta;
    boardBtn.hidden = penta;             // in Pentatonic the fretboard is the exercise: always on
    shapeKey.textContent = T.minorName(MINOR_KEYS[pentaKey].name);
    for (const b of pentaKeyGrid.children) b.setAttribute("aria-pressed", String(Number(b.dataset.key) === pentaKey));
    for (const b of shapeGrid.children) {
      const n = Number(b.dataset.shape), sh = pentaShape(n, pentaKey, placeAt(pentaKey, n));
      b.setAttribute("aria-pressed", String(n === shapeNo));
      b.setAttribute("aria-label", T.shapeAria(n, sh.from, sh.to));
      b.querySelector("small").textContent = `${sh.from}–${sh.to}`;
    }
    // Variant: shown only when this key and shape fit in two places (SPEC §15.2)
    const places = pentaPlacements(shapeNo, pentaKey), cur = pentaShape(shapeNo, pentaKey, placeAt(pentaKey, shapeNo));
    placeRow.hidden = places.length < 2;
    openHint.hidden = !places.some(p => p.open);
    placeGrid.textContent = "";
    for (const p of places) {
      const b = document.createElement("button");
      b.dataset.from = p.from;
      b.setAttribute("aria-pressed", String(p.from === cur.from));
      b.textContent = `${T[variantOf(p, places)]} (${p.from}–${p.to})`;
      placeGrid.appendChild(b);
    }
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
  // ---- Pentatonic setup: exercise row and shape tiles (SPEC §15.1) ----
  const shapeLabel = n => `${T.minorName(MINOR_KEYS[pentaKey].name)} · ${T.shapeName(n)}`;
  // Minor key tiles, circle-of-fifths order (A E B F♯ C♯ G♯ D♯ B♭ F C G D); one is always selected
  MINOR_KEYS.forEach((k, i) => {
    const b = document.createElement("button");
    b.dataset.key = i;
    b.textContent = k.name;
    pentaKeyGrid.appendChild(b);
  });
  pentaKeyGrid.addEventListener("click", e => {
    const b = e.target.closest("[data-key]");
    if (!b) return;
    pentaKey = Number(b.dataset.key);
    renderKeys();
    showIdle();
    save();
  });
  // Each tile: the number, a small diagram of the shape (roots stronger) and its frets
  for (const n of Object.keys(PENTA_SHAPES).map(Number)) {
    const sh = pentaShape(n), cols = sh.to - sh.from + 1, b = document.createElement("button");
    b.dataset.shape = n;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 36 28");
    svg.setAttribute("aria-hidden", "true");
    for (let st = 0; st < 6; st++) {
      const y = 3 + (5 - st) * 4.4;
      svg.insertAdjacentHTML("beforeend", `<line x1="0" x2="36" y1="${y}" y2="${y}"/>`);
    }
    for (const p of sh.positions) {
      const x = (p.f - sh.from + .5) * 36 / cols, y = 3 + (5 - p.st) * 4.4;
      svg.insertAdjacentHTML("beforeend", `<circle cx="${x}" cy="${y}" r="${p.root ? 2.3 : 1.7}"${p.root ? ' class="root"' : ""}/>`);
    }
    b.append(document.createTextNode(n), svg, document.createElement("small"));
    shapeGrid.appendChild(b);
  }
  keyPanel.querySelector(".kp-exercise").addEventListener("click", e => {
    const b = e.target.closest("[data-ex]");
    if (!b || b.dataset.ex === exercise) return;
    exercise = b.dataset.ex;
    renderKeys();
    showIdle();
    save();
  });
  // Name of a variant among a combination's placements: open/closed, or low/high octave; null if there is no choice
  const variantOf = (p, places) => places.length < 2 ? null
    : places.some(q => q.open) ? (p.open ? "variantOpen" : "variantClosed")
    : p.from === places[0].from ? "variantLow" : "variantHigh";
  // The chosen placement of a key and shape, if it is still valid; otherwise the default (lowest movable)
  const placeAt = (k, n) => {
    const v = pentaPlace[`${k}:${n}`];
    return pentaPlacements(n, k).some(p => p.from === v) ? v : undefined;
  };
  placeGrid.addEventListener("click", e => {
    const b = e.target.closest("[data-from]");
    if (!b) return;
    pentaPlace[`${pentaKey}:${shapeNo}`] = Number(b.dataset.from);
    renderKeys();
    showIdle();
    save();
  });
  shapeGrid.addEventListener("click", e => {
    const b = e.target.closest("[data-shape]");
    if (!b) return;
    shapeNo = Number(b.dataset.shape);
    renderKeys();
    showIdle();
    save();
  });
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
    return { walk, peak: WALK_PEAK, prep, wait, total: prep + walk.length + wait, key, keyIdx, deg, next: KEYS[session.upcoming ?? keyIdx], board };
  }

  // Pentatonic shapes (SPEC §15.3): the complete shape up, then back down without repeating its top note.
  // Always the same route. The fretboard shows the shape's frets, widened to at least 5.
  function shapeRound(n, k = pentaKey, at = placeAt(k, n)) {
    const sh = pentaShape(n, k, at);
    const up = sh.positions.map(p => ({ midi: p.midi, name: p.name, st: p.st, f: p.f, root: p.root }));
    const walk = up.concat(up.slice(0, -1).reverse());
    let from = sh.from, to = sh.to;
    if (to - from < ZONE_MIN - 1) {
      if (from + ZONE_MIN - 1 <= PENTA_MAX_FRET) to = from + ZONE_MIN - 1;
      else from = to - ZONE_MIN + 1;
    }
    const prep = Number(inputs.prep.value), wait = Number(inputs.wait.value);
    return { walk, peak: up.length - 1, prep, wait, total: prep + walk.length + wait, penta: true, shape: n,
             key: { name: sh.key }, frets: [sh.from, sh.to], board: { from, to },
             variant: variantOf(sh, pentaPlacements(n, k)) };
  }
  // The round's name on the phase line: "C major", or "A minor · Shape 1"
  const roundLabel = r => r.penta ? `${T.minorName(r.key.name)} · ${T.shapeName(r.shape)}${r.variant ? ` · ${T[r.variant]}` : ""}` : T.keyName(r.key.name);

  function newRound() {
    if (session.exercise === "penta") return shapeRound(session.shape, session.pentaKey, session.pentaAt);
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
    if (w >= 0 && w < r.walk.length) {
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
      buildTrack(round.prep, round.wait, round.walk.length, round.peak);
      pickEl.setAttribute("hidden", "");
      noteEl.hidden = false;
    }
    const w = step - round.prep;
    const inWalk = w >= 0 && w < round.walk.length;
    noteEl.textContent = (inWalk && showAll ? round.walk[w] : round.walk[0]).name;

    const k = roundLabel(round);
    const left = round.total - step;
    // Several keys: the key sits above the note and the wait announces the next one.
    // With the fretboard there is no note letter, so the key goes back into the phase line.
    const multi = !round.penta && session.keys.length > 1, keyAbove = multi && !round.board;
    roundKeyEl.hidden = !keyAbove;
    if (keyAbove) roundKeyEl.textContent = k;
    const pre = keyAbove ? "" : `${k} · `;
    if (step < round.prep) phaseEl.textContent = pre + T.phasePrep(round.prep - step);
    else if (inWalk) phaseEl.textContent = pre + (w <= round.peak ? T.phaseUp : T.phaseDown);
    else phaseEl.textContent = multi ? T.phaseNextKey(T.keyName(round.next.name), left) : pre + T.phaseNext(left);
    if (round.board) {
      if (round !== boardRound) buildBoard(round);
      drawBoard(round, inWalk ? w : step < round.prep ? -1 : -2);
    } else if (!boardEl.hasAttribute("hidden")) hideBoard();
    drawTrack(step);
  }

  // ---- Fretboard drawing (SPEC §13.3) ----
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
    const up = round.walk.slice(0, round.peak + 1);
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
      if (p.root) el("circle", { class: "ring", r: 8.6 }, g);   // roots: a thin second ring (SPEC §15.4)
      if (p.f === 0) g.classList.add("open");                    // open string: hollow dot
      const lit = el("g", { class: "lit" }, g);
      el("circle", { r: 9 }, lit);
      el("text", {}, lit).textContent = p.name;
      return g;
    });
    boardEl.classList.toggle("open-pos", up.some(p => p.f === 0));
    boardParts = { path, segs, active, grad, pos };
    boardEl.removeAttribute("hidden");   // SVG has no .hidden property
    mainEl.classList.add("with-board");
  }
  // w: walk index; -1 during prep, -2 during wait (both show the start position)
  // reveal: show the path even with the eye closed (dev mode inspection)
  // Walk index → position on the route (the way down reuses the way up)
  const posOf = (round, i) => i <= round.peak ? i : 2 * round.peak - i;
  // w = -3: idle preview, the whole route with nothing lit (Pentatonic shapes)
  function drawBoard(round, w, reveal = showAll) {
    const { path, segs, active, grad, pos } = boardParts;
    if (w === -3) {
      path.style.display = "";
      pos.forEach(g => { g.style.display = ""; g.classList.remove("cur", "played", "next"); });
      segs.forEach(sg => sg.classList.remove("played"));
      active.style.display = "none";
      boardEl.setAttribute("aria-label", T.boardAria(round.board.from, round.board.to));
      return;
    }
    // Fade from the tempo: never longer than a third of a beat, none when notes come faster than 250 ms
    const beat = 60 / Number(inputs.bpm.value), fade = beat < .25 ? 0 : Math.min(120, beat * 330);
    if (boardParts.fade !== fade) boardEl.style.setProperty("--fade", `${boardParts.fade = fade}ms`);
    path.style.display = reveal ? "" : "none";
    const curIdx = reveal && w >= 0 ? w : 0;      // eye closed: start position only
    const c = posOf(round, curIdx), down = w > round.peak;
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
    pos.forEach((g, j) => g.classList.toggle("next", reveal && n >= 0 && j === posOf(round, n) && j !== c));
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

  // Bars: flat for prep and wait; rise and fall during the walk, peaking at its top note
  function buildTrack(prep, wait, len = WALK, peak = WALK_PEAK) {
    trackEl.innerHTML = "";
    const add = (h, walk) => {
      const s = document.createElement("span");
      s.style.height = h + "%";
      if (walk) s.className = "walk";
      trackEl.appendChild(s);
    };
    for (let i = 0; i < prep; i++) add(14, false);
    for (let i = 0; i < len; i++) add(24 + (i <= peak ? i : 2 * peak - i) / peak * 75.6, true);
    for (let i = 0; i < wait; i++) add(14, false);
  }
  function drawTrack(step) {
    if (step < 0) {
      const n = PENTA_SHAPES[shapeNo].length;  // Pentatonic: the shape up and back down
      if (exercise === "penta") buildTrack(Number(inputs.prep.value), Number(inputs.wait.value), 2 * n - 1, n - 1);
      else buildTrack(Number(inputs.prep.value), Number(inputs.wait.value));
    }
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

  // ---- Idle view: the pick for Scale walk; the selected shape on the fretboard for Pentatonic ----
  function showIdle() {
    if (exercise === "penta") {
      const r = shapeRound(shapeNo);
      buildBoard(r);
      drawBoard(r, -3);
      pickEl.setAttribute("hidden", "");
      phaseEl.textContent = `${roundLabel(r)} · ${T.frets(...r.frets)}`;
    } else {
      hideBoard();
      pickEl.removeAttribute("hidden");
      phaseEl.textContent = T.idle;
    }
    drawTrack(-1);
  }

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
                board: board ? { from: fretFrom, to: fretTo } : null, pickStart: createStartPicker(),
                exercise, shape: shapeNo, pentaKey, pentaAt: placeAt(pentaKey, shapeNo) };
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
    roundKeyEl.hidden = true;
    noteEl.hidden = true;
    showIdle();
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
    { target: () => mainEl.classList.contains("with-board") ? boardEl : document.querySelector(".display"), key: "guideRound" },
    { target: () => keyBtn, key: "guideKeys" },
    { target: () => showAllEl, key: "guideEye" },
    { target: () => boardBtn, key: "guideBoard", skip: () => boardBtn.hidden },
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
    steps = GUIDE.filter(s => !(fromHelp && s.langs) && !(s.skip && s.skip()));
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
  applyLang();                         // also draws the idle view
  // ---- Dev mode bridge: only with ?debug in the URL (js/debug.js, docs/TESTING.md) ----
  // Exposes just what the dev tool needs, then loads it. Without ?debug nothing is exposed or loaded.
  let dbgPaused = false;               // set by the dev tool; stop() clears it
  if (new URLSearchParams(location.search).has("debug")) {
    window.ScaleTrainerDev = {
      ZONE_MIN, FIFTHS, inputs,
      get running() { return running; },
      get paused() { return dbgPaused; }, set paused(v) { dbgPaused = v; },
      get ctx() { return ctx; },
      get master() { return master; }, set master(v) { master = v; },
      get round() { return round; }, set round(v) { round = v; },
      get step() { return step; }, set step(v) { step = v; },
      get nextTime() { return nextTime; }, set nextTime(v) { nextTime = v; },
      get lastShown() { return lastShown; },
      get queue() { return queue; },
      get settings() { return { keys, order, board, fretFrom, fretTo, showAll, lang: langEl.value, exercise, shape: shapeNo, pentaKey }; },
      stopScheduler() { clearTimeout(timerId); cancelAnimationFrame(rafId); },
      startScheduler() { scheduler(); rafId = requestAnimationFrame(draw); },
      render, playTick, buildRound, newRound, buildBoard, drawBoard,
    };
    document.body.appendChild(Object.assign(document.createElement("script"), { src: "js/debug.js" }));
  }

  if (!guideSeen) openGuide(false);

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
