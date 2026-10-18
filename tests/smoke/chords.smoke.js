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

// In the setup panel, open chord k's picker and tap a root and a type
async function pick(page, k, root, quality) {
  await page.click(`#tile${k}`);
  await page.click(`#rootGrid [data-root="${root}"]`);
  await page.click(`#typeRow [data-quality="${quality}"]`);
  await page.click("#pickerBack");
}

test("the setup: chords as tiles, chosen in the picker; choosing the other's chord swaps them; ticks per chord", async () => {
  const page = await app.open("", CHORDS);
  await page.click("#keyBtn");
  const tile = k => page.evaluate(k => [...document.querySelectorAll(`#tile${k} .kt-name, #tile${k} .kt-pos`)].map(e => e.textContent).join(" "), k);
  assert.equal(await tile("A"), "Am Open 0–2");
  assert.equal(await page.locator("#tileA .dot").count(), 3, "the tile shows the fingering");
  await page.click("#tileB");
  assert.equal(await page.isVisible("#exLabel"), false, "the picker replaces the panel's content");
  assert.equal(await page.textContent("#pickerTitle"), "Chord B");
  assert.equal(await page.textContent("#typeRow"), "MajorCMinorCm7thC7", "each type with the chord it gives");
  await page.click('#rootGrid [data-root="A"]');
  await page.click('#typeRow [data-quality="m"]');
  assert.equal(await names(page), "C Am", "picking A's chord for B swaps them");
  await page.click("#pickerBack");
  assert.equal(await page.isVisible("#exLabel"), true, "back to the setup");
  await pick(page, "A", "G", "");
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

test("positions: drawn as small diagrams, the easiest first, barres drawn, the choice saved per chord", async () => {
  const page = await app.open("", CHORDS);
  await page.click("#keyBtn");
  const pos = () => page.$$eval("#posGrid button", bs => bs.map(b => b.querySelector("span").textContent + " " + b.querySelector("small").textContent + (b.getAttribute("aria-pressed") === "true" ? "*" : "")).join(" | "));
  await page.click("#tileA");
  assert.equal(await pos(), "Open 0–2* | 4th string 5–7 | 6th string 5–7", "Am: open by default");
  assert.equal(await page.locator("#posGrid svg").count(), 3, "each position as a small diagram");
  await page.click('#posGrid [data-v="2"]');
  assert.equal(await page.textContent(".ch-now .base"), "5fr", "Am at the 5th fret, behind the panel");
  assert.equal(await page.locator(".ch-now .barre").count(), 1);
  assert.equal(await page.locator(".ch-now .muted, .ch-now .open").count(), 0, "a full barre: no open or muted strings");
  assert.equal(await page.textContent("#tileA .kt-pos"), "6th string 5–7");
  await page.click('#rootGrid [data-root="F"]');
  await page.click('#typeRow [data-quality=""]');
  assert.equal(await pos(), "4th string 1–3* | 6th string 1–3 | 5th string 8–10", "F: the small F first, then the full barre");
  assert.equal(await page.locator(".ch-now .barre").count(), 1, "the small F's barre is drawn");
  assert.equal(await page.textContent(".ch-now .base"), "", "fret 1: with the nut, no label");
  assert.deepEqual((await page.evaluate(() => JSON.parse(localStorage.getItem("scaleWalkLight")))).chordPos, { Am: 2 });
  await page.keyboard.press("Escape");
  assert.equal(await page.isVisible("#keyPanel"), false, "Esc closes it");
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
