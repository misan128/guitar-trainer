// Smoke test for Chord changes (SPEC §17): the setup, the diagrams at rest, the changes while playing, no eye,
// and dev mode. Run: npm run smoke (see docs/TESTING.md).
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { launch } = require("./browser.js");

let app;
before(async () => { app = await launch(); });
after(async () => { await app.close(); });

const CHORDS = { exercise: "chords", chordA: "Am", chordB: "C", chordBeats: 2, bpm: "240", prep: "1", aid: 1 };
const names = page => page.evaluate(() => [".ch-now", ".ch-next"].map(c => document.querySelector(`${c} .ch-name`).textContent).join(" "));

test("at rest: chord A now and chord B next, with their fingerings and the ticks", async () => {
  const page = await app.open("", CHORDS);
  assert.equal(await page.textContent("#keyBtn"), "Am ↔ C");
  assert.equal(await names(page), "Am C");
  assert.equal(await page.textContent("#phase"), "Am ↔ C");
  assert.equal(await page.locator(".ch-now .dot").count(), 3, "Am: three fingers");
  assert.equal(await page.textContent(".ch-now .dot text >> nth=0"), "2", "finger numbers at level 1");
  assert.equal(await page.locator(".ch-now .open").count(), 2, "Am: A and e open");
  assert.equal(await page.locator(".ch-now .muted").count(), 1, "Am: low E muted");
  assert.equal(await page.locator("#chordBeatsShown i").count(), 2);
  assert.equal(await page.isVisible("#track"), false, "no bars");
  assert.equal(await page.isVisible("#boardBtn"), false, "no fretboard button");
  assert.equal(await page.isDisabled("#wait"), true, "no ticks after");
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test("the setup: choosing the other's chord swaps them; ticks per chord", async () => {
  const page = await app.open("", CHORDS);
  await page.click("#keyBtn");
  await page.selectOption("#chordB", "Am");
  assert.equal(await names(page), "C Am", "swapped");
  await page.selectOption("#chordA", "G");
  await page.click('#beatsGrid [data-beats="8"]');
  assert.equal(await page.textContent("#keyBtn"), "G ↔ Am");
  assert.equal(await page.locator("#chordBeatsShown i").count(), 8);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("scaleWalkLight")));
  assert.deepEqual([saved.chordA, saved.chordB, saved.chordBeats], ["G", "Am", 8]);
  await page.click('[data-ex="walk"]');
  assert.equal(await page.isVisible("#chordView"), false, "back to Scale walk: no chords");
  assert.equal(await page.isVisible("#pick"), true);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test("playing: the chords change on their boundaries, the next one always shown", async () => {
  const page = await app.open("", CHORDS);
  await page.click("#toggle");
  await page.waitForFunction(() => document.querySelector(".ch-now .ch-name").textContent === "C", null, { timeout: 4000 });
  assert.equal(await names(page), "C Am");
  assert.equal(await page.locator(".ch-now .dot").count(), 3, "C: three fingers");
  await page.waitForFunction(() => document.querySelector(".ch-now .ch-name").textContent === "Am", null, { timeout: 4000 });
  assert.equal(await page.locator("#chordBeatsShown i.on").count(), 1, "one tick lit");
  await page.click("#toggle");
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test("no eye in Chords: both chords always in full, whatever the saved level; dev mode runs", async () => {
  const page = await app.open("?debug", { ...CHORDS, aid: 4 });
  await page.waitForFunction(() => window.dbg);
  assert.equal(await page.isVisible("#showAll"), false, "no eye");
  assert.equal(await page.locator(".ch-now .dot text").count(), 3, "current: dots with finger numbers");
  assert.equal(await page.locator(".ch-next .dot text").count(), 3, "next: the same");
  await page.click("#toggle");
  await page.waitForTimeout(800);
  assert.match(await page.evaluate(() => dbg.state().key), /Am ↔ C/);
  await page.click("#toggle");
  await page.click("#keyBtn");
  await page.click('[data-ex="walk"]');
  assert.equal(await page.isVisible("#showAll"), true, "the eye is back in Scale walk");
  assert.deepEqual(page.errors, []);
  await page.context().close();
});
