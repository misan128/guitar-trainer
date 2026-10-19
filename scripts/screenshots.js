// README screenshots: npm run screenshots. Captures the real app at phone size, mid-practice (paused with the dev
// tool, whose panel is hidden), then composes the images in docs/images/ in the browser itself: rounded corners,
// a soft shadow, on the app's background. Needs Playwright (npm install, npm run smoke:setup). Re-run it when the
// screens change.
const { chromium, devices } = require("playwright");
const { createServer } = require("./serve.js");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const OUT = path.join(__dirname, "..", "docs", "images");
const TIPS = Object.fromEntries(["menu", "setup", "walk", "penta", "chords", "prog", "picker", "tuner", "board"].map(k => [k, true]));
const BG = "#1d1613";

// A WAV of the A string, two cents sharp: the tuner's fake microphone
function wav(file, freq, sr = 48000) {
  const n = 4 * sr, data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const env = Math.exp(-((i % sr) / sr) * 1.2), w = k => Math.sin(2 * Math.PI * freq * k * i / sr);
    data.writeInt16LE(Math.round(env * 0.8 * 32767 * (0.5 * w(1) + 0.3 * w(2) + 0.15 * w(3))), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "screens-"));
  const mic = path.join(tmp, "a.wav");
  wav(mic, 110 * Math.pow(2, 2 / 1200));
  const server = createServer();
  await new Promise(ok => server.listen(0, ok));
  const base = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required", "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${mic}`] });
  const shots = {};

  async function open(settings, debug = true) {
    const ctx = await browser.newContext({ ...devices["iPhone 13"], deviceScaleFactor: 2, serviceWorkers: "block" });
    await ctx.addInitScript(s => localStorage.setItem("scaleWalkLight", JSON.stringify(s)), { guideSeen: true, tipsSeen: TIPS, lang: "en", ...settings });
    const page = await ctx.newPage();
    await page.goto(base + (debug ? "?debug" : ""));
    await page.addStyleTag({ content: "#dbgPanel { display: none !important; }" });
    if (debug) await page.waitForFunction(() => window.dbg);
    return page;
  }
  // Start, wait for the moment, pause on it
  async function playUntil(page, moment) {
    await page.click("#toggle");
    await page.waitForFunction(moment, null, { timeout: 20000 });
    await page.evaluate(() => dbg.pause());
    await page.waitForTimeout(300);
  }
  async function shot(page, name) {
    shots[name] = (await page.screenshot()).toString("base64");
    await page.context().close();
    console.log("captured", name);
  }
  const onTick = (name, i) => `document.querySelector(".ch-now .ch-name").textContent === "${name}" && [...document.querySelectorAll("#chordLine .on i")].findIndex(d => d.classList.contains("now")) === ${i}`;

  let page = await open({ exercise: "chords", chordA: "Am", chordB: "C", chordBeats: 4, bpm: "70" });
  await playUntil(page, onTick("Am", 1));
  await shot(page, "chords");
  page = await open({ exercise: "chords", chordMode: "prog", progId: "pop", progKey: 0, chordBeats: 4, bpm: "90" });
  await playUntil(page, onTick("Am", 2));
  await shot(page, "progression");
  page = await open({ exercise: "penta", pentaShape: 1, pentaKey: 0, pentaNeck: true, bpm: "90", prep: "1", aid: 2 });
  await playUntil(page, `document.querySelector("#board .neckbar .ghost.on") && document.querySelectorAll("#board .pos.played").length > 4`);
  await shot(page, "pentatonic");
  page = await open({ exercise: "walk", keys: [7], board: true, fretFrom: 2, fretTo: 6, bpm: "80", prep: "1", aid: 1 });
  await playUntil(page, `document.querySelectorAll("#board .pos.played").length === 3`);
  await shot(page, "scalewalk");
  page = await open({ exercise: "chords", chordA: "F", chordB: "C" }, false);
  await page.click("#keyBtn");
  await page.click("#tileA");
  await page.waitForTimeout(300);
  await shot(page, "picker");
  page = await open({ exercise: "chords", chordA: "Am", chordB: "C" }, false);
  await page.click("#tunerBtn");
  await page.waitForFunction(() => { const r = document.querySelector("#tunerRead"); return r.classList.contains("tuned") && !r.classList.contains("held"); }, null, { timeout: 8000 });
  await shot(page, "tuner");
  for (const theme of ["sepia", "maple", "steel"]) {
    page = await open({ exercise: "chords", chordA: "G", chordB: "D", theme }, false);
    await shot(page, "theme-" + theme);
  }

  // Compose: phones side by side, each cropped to `crop` of its height
  const compose = await browser.newPage({ deviceScaleFactor: 1 });
  async function image(file, names, width, crop = 1, gap = 44, pad = 48) {
    const phones = names.map(n => `<div class="phone" style="width:${width}px;height:${Math.round(width * 1328 / 780 * crop)}px">
      <img src="data:image/png;base64,${shots[n]}" style="width:${width}px"></div>`).join("");
    await compose.setContent(`<style>
      body { margin: 0; background: ${BG}; }
      .row { display: inline-flex; gap: ${gap}px; padding: ${pad}px; background: ${BG}; }
      .phone { overflow: hidden; border-radius: 34px; box-shadow: 0 0 0 2px #463830, 6px 14px 28px rgba(0, 0, 0, .55); }
      .phone img { display: block; }
    </style><div class="row">${phones}</div>`);
    await compose.locator(".row").screenshot({ path: path.join(OUT, file) });
    console.log("wrote", file);
  }
  await image("hero.png", ["chords", "pentatonic", "tuner"], 380);
  for (const n of ["chords", "progression", "pentatonic", "scalewalk"]) await image(`${n}.png`, [n], 480, .78, 0, 26);
  for (const n of ["picker", "tuner"]) await image(`${n}.png`, [n], 480, .66, 0, 26);
  await image("themes.png", ["theme-sepia", "theme-maple", "theme-steel"], 300, .555, 30, 36);

  await browser.close();
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
})();
