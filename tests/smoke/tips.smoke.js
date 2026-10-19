// Smoke tests for the tips (SPEC §19): each panel's short tour, once, over the open panel; "Show the tips again"
// in the menu; never while practising. Run: npm run smoke (see docs/TESTING.md).
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { launch } = require("./browser.js");

let app;
before(async () => { app = await launch(); });
after(async () => { await app.close(); });

const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem("scaleWalkLight")));
// Steps through the open tour with Next, returning the titles shown
async function tour(page) {
  const titles = [];
  while (await page.isVisible("#guide")) {
    titles.push(await page.textContent("#guideTitle"));
    await page.click("#guideNext");
  }
  return titles;
}

test("the menu explains itself the first time, over the open menu, and only once", async () => {
  const page = await app.open("", { tipsSeen: {} });
  await page.click("#menuBtn");
  await page.waitForSelector("#guide:not([hidden])");
  assert.deepEqual(await tour(page), ["Language", "Theme", "Help and more"]);
  assert.equal(await page.isVisible("#menuPanel"), true, "the menu stays open under the tips");
  assert.deepEqual((await saved(page)).tipsSeen, { menu: true });
  await page.keyboard.press("Escape");
  await page.click("#menuBtn");
  await page.waitForTimeout(200);
  assert.equal(await page.isVisible("#guide"), false, "not twice");
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test("the setup panel: the exercise row once, then each exercise's tips, and the progression's on switching", async () => {
  const page = await app.open("", { tipsSeen: {}, exercise: "chords" });
  await page.click("#keyBtn");
  await page.waitForSelector("#guide:not([hidden])");
  assert.deepEqual(await tour(page), ["What to practise", "Two chords or a progression", "Your chords"]);
  assert.equal(await page.isVisible("#keyPanel"), true);
  await page.click('#chordMode [data-mode="prog"]');
  await page.waitForSelector("#guide:not([hidden])");
  assert.deepEqual(await tour(page), ["Progression", "Key"]);
  await page.click('[data-ex="penta"]');
  await page.waitForSelector("#guide:not([hidden])");
  assert.deepEqual(await tour(page), ["Key", "Shape"], "Pentatonic, without the exercise row again (A minor shape 1 has no variant)");
  await page.click('[data-ex="chords"]');
  await page.click('[data-ex="walk"]');
  await page.waitForSelector("#guide:not([hidden])");
  assert.deepEqual(await tour(page), ["Keys", "Order"]);
  assert.deepEqual(Object.keys((await saved(page)).tipsSeen).sort(), ["chords", "penta", "prog", "setup", "walk"]);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test("the picker and the tuner have their own; Skip counts as seen; Show the tips again brings them back", async () => {
  const page = await app.open("", { tipsSeen: { setup: true, chords: true, menu: true }, exercise: "chords" });
  await page.click("#keyBtn");
  await page.click("#tileA");
  await page.waitForSelector("#guide:not([hidden])");
  assert.deepEqual(await tour(page), ["Root", "Type", "Position"]);
  await page.keyboard.press("Escape");
  await page.click("#tunerBtn");
  await page.waitForSelector("#guide:not([hidden])");
  assert.equal(await page.textContent("#guideTitle"), "Tuning");
  await page.click("#guideSkip");
  assert.equal((await saved(page)).tipsSeen.tuner, true, "skipped is seen");
  await page.click("#tunerDone");
  await page.click("#menuBtn");
  assert.equal(await page.textContent("#tipsBtn"), "Show the tips again");
  await page.click("#tipsBtn");
  assert.equal(await page.textContent("#tipsBtn"), "Tips will show again");
  assert.equal(await page.isDisabled("#tipsBtn"), true);
  assert.deepEqual((await saved(page)).tipsSeen, {});
  await page.keyboard.press("Escape");
  await page.click("#tunerBtn");
  await page.waitForSelector("#guide:not([hidden])");
  assert.equal(await page.textContent("#guideTitle"), "Tuning", "the tuner's tips again");
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test("never while practising", async () => {
  const page = await app.open("", { tipsSeen: {}, bpm: "120" });
  await page.click("#toggle");
  await page.click("#menuBtn");
  await page.waitForTimeout(250);
  assert.equal(await page.isVisible("#menuPanel"), true);
  assert.equal(await page.isVisible("#guide"), false, "the menu opens, its tips wait");
  await page.keyboard.press("Escape");
  await page.click("#toggle");
  assert.deepEqual(page.errors, []);
  await page.context().close();
});
