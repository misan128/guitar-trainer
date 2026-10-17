// Smoke tests: the app in a real browser (Chromium, phone viewport), the main flows end to end.
// They check that things run and show, not how they look. Run: npm run smoke (see docs/TESTING.md).
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { launch } = require("./browser.js");

let app;
before(async () => { app = await launch(); });
after(async () => { await app.close(); });

const settings = page => page.evaluate(() => JSON.parse(localStorage.getItem("scaleWalkLight")));

test("loads without errors, and without the dev tool", async () => {
  const page = await app.open();
  assert.equal(await page.textContent("#toggle"), "Start");
  assert.equal(await page.isVisible("#pick"), true, "the pick shows at rest in Scale walk");
  assert.ok(!app.requests.includes("/js/debug.js"), "debug.js only loads with ?debug");
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test("Scale walk: start lights the route on the fretboard, stop goes back to rest", async () => {
  const page = await app.open("", { bpm: "240", prep: "1", wait: "0", board: true, aid: 2 });
  await page.click("#toggle");
  assert.equal(await page.textContent("#toggle"), "Stop");
  await page.waitForSelector("#board .pos.cur", { timeout: 3000 });
  assert.equal(await page.isVisible("#board"), true);
  await page.click("#toggle");
  assert.equal(await page.textContent("#toggle"), "Start");
  assert.equal(await page.isVisible("#board"), false, "the fretboard hides at rest");
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test("Pentatonic along the neck: the shape moves on to its neighbour, with the neck bar", async () => {
  // A minor from shape 1 (frets 5–8): the next one up the neck is shape 2. 240 BPM keeps the slide on.
  const page = await app.open("", { exercise: "penta", pentaShape: 1, pentaKey: 0, pentaNeck: true, bpm: "240", prep: "1", aid: 2 });
  const thumb = () => page.textContent("#board .neckbar .thumb text");
  assert.equal(await thumb(), "1", "the neck bar shows the selected shape at rest");
  await page.click("#toggle");
  await page.waitForSelector("#board .neckbar .ghost.on", { timeout: 8000 });   // on the way down
  assert.equal(await page.textContent("#board .neckbar .ghost text"), "2", "the next shape is shape 2");
  await page.waitForFunction(() => document.querySelector("#board .neckbar .thumb text").textContent === "2", null, { timeout: 8000 });
  await page.waitForTimeout(800);                                               // the slide has settled
  assert.equal(await page.locator("#board .zone").count(), 1, "the old zone is gone after the slide");
  await page.click("#toggle");
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test("the eye steps through the four aid levels and remembers it", async () => {
  const page = await app.open("", { aid: 1 });
  const levels = [];
  for (let i = 0; i < 4; i++) {
    await page.click("#showAll");
    levels.push(await page.getAttribute("#showAll", "data-level"));
  }
  assert.deepEqual(levels, ["2", "3", "4", "1"]);
  assert.equal((await settings(page)).aid, 1);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test("changing the language changes the texts", async () => {
  const page = await app.open();
  await page.selectOption("#lang", "es");
  assert.equal(await page.textContent("#toggle"), "Empezar");
  await page.selectOption("#lang", "eu");
  assert.equal(await page.textContent("#toggle"), "Hasi");
  assert.equal((await settings(page)).lang, "eu");
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test("dev mode: ?debug loads the tool, and pause, step and back work", async () => {
  const page = await app.open("?debug", { exercise: "penta", pentaShape: 1, pentaNeck: true, bpm: "120", prep: "1" });
  await page.waitForFunction(() => window.dbg);
  await page.click("#toggle");
  await page.waitForSelector("#board .pos.cur", { timeout: 3000 });
  assert.equal(await page.evaluate(() => dbg.pause()), "Paused.");
  const tick = () => page.evaluate(() => dbg.state().tick);
  const at = await tick();
  await page.evaluate(() => dbg.step());
  await page.evaluate(() => dbg.back());
  assert.equal(await tick(), at, "step then back returns to the same tick");
  assert.equal(await page.evaluate(() => dbg.resume()), "Running.");
  await page.click("#toggle");
  assert.deepEqual(page.errors, []);
  await page.context().close();
});
