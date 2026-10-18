// Dev mode (?debug): a dbg console object and a small panel that act as a cursor over the round.
// Pause stops the scheduler on a tick; from there, stepping, seeking along the walk or swapping the
// round's key and degree shows and sounds at once, and resume plays on from the cursor. While running,
// the same changes apply on the fly. English only: it is a dev tool (SPEC §4.2).
// It only touches the app through the bridge js/app/main.js exposes as ScaleTrainerDev, and main.js only
// loads this file with ?debug in the URL. See docs/TESTING.md.
(() => {
  const A = window.ScaleTrainerDev;
  if (!A) return;
  const { KEYS, scaleNames, STRING_NAMES, boardWalk } = Theory;
  const { ZONE_MIN, FIFTHS, inputs } = A;

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
  const phaseOf = (r, st) => st < r.prep ? "prep" : r.chords ? "chords" : st < r.prep + r.walk.length ? (st - r.prep <= r.peak ? "up" : "down") : "wait";
  // The route up to its top note, as string + fret (or note names without the fretboard)
  const fingering = r => r.chords ? r.seq.map(c => `${c.name}×${c.beats}`).join(" ") : r.walk.slice(0, r.peak + 1).map(p => p.st != null ? STRING_NAMES[p.st] + p.f : p.name).join(" ");
  const lastNote = r => r.chords ? r.total - r.prep - 1 : r.walk.length - 1;
  const beatLen = () => 60 / Number(inputs.bpm.value);
  let cursor = null;                   // { round, step } while paused
  // Paused: put the cursor on a tick, draw it and play it now
  function showTick(r, st) {
    cursor = { round: r, step: st };
    A.round = r;
    A.render(cursor);
    A.playTick(r, st, A.ctx.currentTime + .01, beatLen());
  }
  // Silences what was already scheduled ahead and opens a fresh bus for what comes next
  function freshBus() {
    const m = A.master;
    m.gain.setTargetAtTime(0, A.ctx.currentTime, .015);
    setTimeout(() => m.disconnect(), 200);
    A.master = A.ctx.createGain();
    A.master.connect(A.ctx.destination);
  }
  window.dbg = {
    help() {
      console.info([
        "dbg.pause() / dbg.resume()   stop on the current tick / play on from it",
        "dbg.step()                   paused: next tick now (moves on to a new round at the end)",
        "dbg.back()                   paused: previous tick now, within the round",
        "dbg.seek(i)                  go to walk note i (0–14): now if paused, next tick if running",
        'dbg.round("G", 3)            swap the current round for G major from degree 3 (1 = tonic … 7), same position',
        'dbg.walk("C", 1, 5, 9, i)    stopped: draw that walk on frets 5–9, current note at walk index i',
        "dbg.state()                  phase, tick, key, walk and settings",
        "Pentatonic: the round is the shape (key and degree do not apply); along the neck, the key shows → next shape",
      ].join("\n"));
    },
    pause() {
      if (!A.running || A.paused) return "Not running, or already paused.";
      A.paused = true;
      A.stopScheduler();
      freshBus();
      A.queue.length = 0;
      const t = A.lastShown;
      cursor = t ? { round: t.round, step: t.step } : { round: A.round, step: 0 };
      A.render(cursor);
      return "Paused.";
    },
    resume() {
      if (!A.paused) return "Not paused.";
      A.paused = false;
      A.round = cursor.round;
      A.step = (cursor.step + 1) % cursor.round.total;    // the cursor tick was the last one heard
      A.nextTime = A.ctx.currentTime + beatLen();
      A.startScheduler();
      return "Running.";
    },
    step() {
      if (!A.paused) return "Pause first.";
      let r = cursor.round, st = cursor.step + 1;
      if (st >= r.total) { r = A.newRound(); st = 0; }
      showTick(r, st);
      return `tick ${st + 1}/${r.total}`;
    },
    // Back stays within the round: the rounds before are gone (along the neck, the next shape is already drawn)
    back() {
      if (!A.paused) return "Pause first.";
      if (cursor.step === 0) return "Start of the round.";
      showTick(cursor.round, cursor.step - 1);
      return `tick ${cursor.step + 1}/${cursor.round.total}`;
    },
    seek(i) {
      if (!A.running) return "Start first (stopped: dbg.walk draws without playing).";
      const r = A.paused ? cursor.round : A.round;
      const n = Math.min(lastNote(r), Math.max(0, Math.round(Number(i))));
      if (A.paused) showTick(r, r.prep + n);
      else A.step = A.round.prep + n;                // the scheduler plays it on its next tick
      return `walk ${n}`;
    },
    round(name, deg) {
      if (A.round && (A.round.penta || A.round.chords)) return "Only for Scale walk: in Pentatonic and Chords the round is fixed.";
      if (!A.running) return "Start first (stopped: dbg.walk draws without playing).";
      const k = keyIndex(name), d = degree(deg);
      const r = A.buildRound(k, d);
      if (A.paused) showTick(r, Math.min(cursor.step, r.total - 1));
      else A.round = r;                            // the next ticks use it, same position
      return `${KEYS[k].name} major from degree ${deg}`;
    },
    walk(name, deg, from = A.settings.fretFrom, to = A.settings.fretTo, i = 0) {
      if (A.running) return "Stop first: this draws without playing.";
      if (to - from < ZONE_MIN - 1) return `A zone needs at least ${ZONE_MIN} frets.`;
      const key = KEYS[keyIndex(name)], d = degree(deg), names = scaleNames(key);
      const bw = boardWalk(key.pc, d, from, to);
      if (!bw) return "No playable walk in that zone.";
      const up = bw.pos.map(([st, f], k) => ({ midi: bw.pitches[k], name: names[(d + k) % 7], st, f }));
      const r = { walk: up.concat(up.slice(0, 7).reverse()), peak: 7, board: { from, to } };
      A.buildBoard(r);
      A.drawBoard(r, Math.min(14, Math.max(0, i)), true);
      return `${key.name} major from degree ${deg}, frets ${from}–${to}: ${fingering(r)} (start ${bw.pitches[0]} MIDI)`;
    },
    state() {
      const t = A.paused ? cursor : A.lastShown, s = A.settings;
      return {
        running: A.running, paused: A.paused,
        phase: t ? phaseOf(t.round, t.step) : null,
        tick: t ? `${t.step + 1}/${t.round.total}` : null,
        key: t ? (t.round.chords ? t.round.key.name : t.round.penta ? `${t.round.key.name} minor, shape ${t.round.shape}${t.round.nextShape ? ` → shape ${t.round.nextShape}` : ""}`
          : `${t.round.key.name} major, degree ${t.round.deg + 1}`) : null,
        walk: t ? fingering(t.round) : null,
        settings: { bpm: Number(inputs.bpm.value), prep: Number(inputs.prep.value), wait: Number(inputs.wait.value),
          keys: s.keys.map(k => KEYS[k].name), order: s.order, board: s.board, zone: `${s.fretFrom}–${s.fretTo}`, aid: s.aid, lang: s.lang,
          exercise: s.exercise, shape: s.shape, neckWalk: s.neckWalk },
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
        <button data-a="back" title="Previous tick (paused)">⏮</button><button data-a="pause" title="Pause / play on">⏸</button><button data-a="step" title="Next tick (paused)">⏭</button></div>
      <div class="row" title="Key of the current round"><span class="lbl">round</span>
        <select data-f="key">${keyOpts}</select></div>
      <div class="row" title="Note of the walk: its degree and its position (0–14) move together"><span class="lbl">walk</span>
        <select data-f="deg">${degOpts}</select><input data-f="idx" type="range" min="0" max="14" value="0"></div>
      <pre></pre>
    </div>`;
  document.body.appendChild(panel);
  const q = sel => panel.querySelector(sel), out = q("pre");
  const pauseBtn = q("[data-a=pause]"), stepBtn = q("[data-a=step]"), backBtn = q("[data-a=back]"), idx = q("[data-f=idx]");
  const keySel = q("[data-f=key]"), degSel = q("[data-f=deg]");
  // Every action's result goes to the panel and to the console
  const say = v => {
    if (typeof v === "string") { out.dataset.msg = v; console.log(`[dbg] › ${v}`); }
    refresh();
  };
  // The degree select and the slider are one control: the current note of the walk, as a degree and as a position.
  // Degree (0-based) of walk note i in a round that starts on degree `start`
  const degreeAt = (start, i, peak = 7) => (start + (i <= peak ? i : 2 * peak - i)) % 7;
  // Position of degree d nearest to the current one (each degree is on the way up and on the way down)
  const positionOf = (start, d, cur, peak = 7) => {
    const k = (d - start + 7) % 7, options = k === 0 ? [0, peak, 2 * peak] : [k, 2 * peak - k];
    return options.reduce((best, o) => Math.abs(o - cur) < Math.abs(best - cur) ? o : best);
  };
  const current = () => { const t = A.paused ? cursor : A.lastShown; return A.running && t ? t : null; };
  // Pentatonic shapes: key and degree do not apply (the round is the selected shape); the slider steps through it
  const pentaNow = () => { const t = current(); return t ? !!(t.round.penta || t.round.chords) : A.settings.exercise !== "walk"; };
  // Stopped: preview the selected key's walk from the tonic
  function previewWalk() {
    degSel.value = String(degreeAt(0, Number(idx.value)) + 1);
    say(dbg.walk(keySel.value, 1, A.settings.fretFrom, A.settings.fretTo, Number(idx.value)));
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
    const w = t ? Math.min(lastNote(t.round), Math.max(0, t.step - t.round.prep)) : Number(idx.value);
    idx.value = positionOf(start, Number(degSel.value) - 1, w);
    if (!t) return previewWalk();
    say(dbg.seek(idx.value));
  });
  let sliding = false;
  idx.addEventListener("pointerdown", () => { sliding = true; });
  addEventListener("pointerup", () => { sliding = false; });
  idx.addEventListener("input", () => {
    const t = current();
    if (!t) return pentaNow() ? undefined : previewWalk();
    if (!t.round.penta && !t.round.chords) degSel.value = String(degreeAt(t.round.deg, Number(idx.value)) + 1);
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
    backBtn.disabled = !st.paused || cursor.step === 0;
    const penta = pentaNow();
    keySel.disabled = degSel.disabled = penta;
    idx.disabled = penta && !t;           // stopped in Pentatonic: the idle preview is static
    if (!t) idx.max = 14;                // stopped: the Scale walk preview
    if (t && !sliding && Date.now() - touched > 600) {
      const w = Math.min(lastNote(t.round), Math.max(0, t.step - t.round.prep));   // prep shows the first note, wait the last
      idx.max = lastNote(t.round);
      idx.value = w;
      if (!t.round.penta && !t.round.chords) {
        keySel.value = t.round.key.name;
        degSel.value = String(degreeAt(t.round.deg, w) + 1);
      }
    }
    if (!body.hidden) out.textContent = line + (out.dataset.msg ? `\n› ${out.dataset.msg}` : "");
  }
  setInterval(refresh, 250);
  panel.addEventListener("click", e => {
    const a = e.target.closest("button")?.dataset.a;
    if (a === "pause") say(A.paused ? dbg.resume() : dbg.pause());
    if (a === "step") say(dbg.step());
    if (a === "back") say(dbg.back());
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
})();
