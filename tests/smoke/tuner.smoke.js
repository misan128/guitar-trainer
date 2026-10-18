// Smoke test for the tuner (SPEC §16): Chromium's fake microphone plays a WAV of the A string 12 cents sharp,
// and the panel must read it. Run: npm run smoke (see docs/TESTING.md).
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { launch } = require("./browser.js");

// A mono 16-bit WAV of a plucked-like tone (decaying harmonics), repeated so it never runs out
function wav(file, freq, seconds = 4, sr = 48000) {
  const n = seconds * sr, data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const t = (i % sr) / sr, env = Math.exp(-t * 1.5);
    const v = env * (0.5 * Math.sin(2 * Math.PI * freq * i / sr) + 0.3 * Math.sin(4 * Math.PI * freq * i / sr) + 0.15 * Math.sin(6 * Math.PI * freq * i / sr));
    data.writeInt16LE(Math.round(v * 0.8 * 32767), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(sr, 24);
  h.writeUInt32LE(sr * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
}

let app, file;
before(async () => {
  file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "tuner-")), "a-sharp.wav");
  wav(file, 110 * Math.pow(2, 12 / 1200));      // A2, 12 cents sharp
  app = await launch(["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${file}`]);
});
after(async () => { await app.close(); fs.rmSync(path.dirname(file), { recursive: true, force: true }); });

test("the tuner reads a string from the microphone, and closing it stops listening", async () => {
  const page = await app.open();
  await page.click("#tunerBtn");
  assert.equal(await page.isVisible("#tunerPanel"), true);
  // The needle settles within a few readings: wait for it, then check where
  const settled = await page.waitForFunction(() => {
    const c = Number(document.querySelector("#tunerCents").textContent);
    return document.querySelector("#tunerNote").textContent === "A" && c >= 9 && c <= 15 && c;
  }, null, { timeout: 5000 }).then(h => h.jsonValue()).catch(() => null);
  assert.ok(settled, `read ${await page.textContent("#tunerNote")} ${await page.textContent("#tunerCents")} for A +12`);
  assert.equal(await page.textContent("#tunerOct"), "2");
  assert.equal(await page.getAttribute("#tunerLevel", "class"), "heard", "the level bar shows the string is heard");
  assert.equal(await page.getAttribute("#tunerRef [data-midi='45']", "class"), "near", "the A string's reference is marked");
  assert.equal(await page.textContent("#tunerState"), "Listening…");
  await page.click("#tunerDone");
  assert.equal(await page.isVisible("#tunerPanel"), false);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test("reference buttons play without the microphone, and the tuner is off while practising", async () => {
  const page = await app.open();
  await page.click("#tunerBtn");
  await page.click("#tunerRef [data-midi='40']");   // low E
  await page.keyboard.press("Escape");
  assert.equal(await page.isVisible("#tunerPanel"), false, "Esc closes it");
  await page.click("#toggle");
  assert.equal(await page.isDisabled("#tunerBtn"), true);
  await page.click("#toggle");
  assert.equal(await page.isDisabled("#tunerBtn"), false);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});
