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
  assert.equal(await page.getAttribute("#neckSwitch", "aria-checked"), "true", "along the neck: the second slot, on the main screen");
  assert.equal(await page.isVisible("#wait"), false);
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

test("the menu: language changes the texts, and the choice is saved", async () => {
  const page = await app.open();
  await page.click("#menuBtn");
  await page.click('#langRow [data-lang="es"]');
  assert.equal(await page.textContent("#toggle"), "Empezar");
  assert.equal(await page.textContent("#helpBtn"), "Ayuda", "the menu follows the language");
  await page.click('#langRow [data-lang="eu"]');
  assert.equal(await page.textContent("#toggle"), "Hasi");
  assert.equal((await settings(page)).lang, "eu");
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test("the menu: themes, About, and the guide", async () => {
  const page = await app.open();
  const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.equal(await theme(), "sepia");
  const dark = await bg();
  await page.click("#menuBtn");
  await page.click('#themeRow [data-theme="maple"]');
  assert.equal(await theme(), "maple");
  assert.notEqual(await bg(), dark, "the background changes");
  assert.equal((await settings(page)).theme, "maple");
  const light = await bg();
  await page.click('#themeRow [data-theme="steel"]');
  assert.equal(await theme(), "steel");
  assert.ok(![dark, light].includes(await bg()), "steel has its own background");
  const accent = await page.evaluate(() => getComputedStyle(document.querySelector("#pick .pk-body")).fill);
  assert.equal(accent, "rgb(128, 203, 196)", "the pick takes the theme's accent");
  await page.click("#aboutBtn");
  assert.match(await page.textContent("#aboutView"), /Michael/);
  assert.equal(await page.getAttribute(".mp-coffee", "href"), "https://buymeacoffee.com/misan128");
  await page.click("#aboutBack");
  await page.click("#helpBtn");
  assert.equal(await page.isVisible("#helpPage"), true, "Help opens the help page");
  assert.equal(await page.isVisible("#menuPanel"), false);
  await page.keyboard.press("Escape");
  assert.equal(await page.isVisible("#helpPage"), false, "Esc closes it");
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test("the help page: every control explained, with the real icons; the tour linked at the end", async () => {
  const page = await app.open("", { exercise: "chords" });
  await page.click("#menuBtn");
  await page.click("#helpBtn");
  const sections = await page.$$eval("#helpBody h3", hs => hs.map(h => h.textContent));
  assert.deepEqual(sections, ["Quick start", "Top bar", "Main screen", "Chords", "Scale walk", "Pentatonic shapes", "Tuner"], "no keyboard shortcuts on a phone");
  assert.equal(await page.textContent("#helpBody .hp-row:nth-child(3) b"), "Hints", "the eye is called Hints");
  const eyeLayers = await page.$$eval("#helpBody .hp-icon.eye g", gs => gs.filter(g => getComputedStyle(g).display !== "none").length);
  assert.equal(eyeLayers, 1, "the eye's icon shows one level, not its four drawings at once");
  assert.equal(await page.textContent("#helpBody .hp-key"), "Am ↔ C", "the setup button, with its own label");
  assert.equal(await page.locator("#helpBody .hp-icon svg").count(), 4, "the eye, fretboard, tuner and menu icons");
  assert.equal(await page.locator("#helpBody .g-legend li").count(), 4, "the four eye levels");
  await page.click("#helpClose");
  await page.click("#menuBtn");
  await page.click('#langRow [data-lang="es"]');
  await page.click("#helpBtn");
  assert.equal(await page.textContent("#helpTitle"), "Ayuda", "in the chosen language");
  await page.click("#helpTour");
  assert.equal(await page.isVisible("#helpPage"), false);
  assert.equal(await page.isVisible("#guide"), true, "the guided tour, again, from the link");
  await page.keyboard.press("Escape");
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test("in dev mode neither the first-use guide nor the tips show by themselves", async () => {
  const page = await app.open("?debug", { guideSeen: false, tipsSeen: {} });
  await page.waitForFunction(() => window.dbg);
  await page.waitForTimeout(300);
  assert.equal(await page.isVisible("#guide"), false, "no guide");
  await page.click("#menuBtn");
  await page.waitForTimeout(300);
  assert.equal(await page.isVisible("#guide"), false, "no tips");
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test("a saved theme is there from the first paint, also under its earlier name", async () => {
  const page = await app.open("", { theme: "maple" });
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "maple");
  const old = await app.open("", { theme: "material" });
  assert.equal(await old.evaluate(() => document.documentElement.dataset.theme), "steel");
  await old.context().close();
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
