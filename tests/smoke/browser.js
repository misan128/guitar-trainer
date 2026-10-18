// Shared setup for the smoke tests: the local server (scripts/serve.js) and Chromium with a phone viewport.
// Each page collects its errors, so a test can assert there were none.
const { chromium, devices } = require("playwright");
const { createServer } = require("../../scripts/serve.js");

// The panels' tips (SPEC §19), all seen: tests open panels as someone who knows them; tests of the tips pass {}
const ALL_TIPS = Object.fromEntries(["menu", "setup", "walk", "penta", "chords", "prog", "picker", "tuner", "board"].map(id => [id, true]));

// args: extra Chromium flags (the tuner test feeds it a fake microphone)
async function launch(args = []) {
  const requests = [];
  const server = createServer(p => requests.push(p));
  await new Promise(ok => server.listen(0, ok));
  const base = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required", ...args] });

  // settings: saved settings to start from (the app's localStorage), merged over "guide and tips already seen"
  async function open(query = "", settings = {}) {
    const context = await browser.newContext({ ...devices["iPhone 13"], locale: "en", serviceWorkers: "block" });
    await context.addInitScript(s => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem("scaleWalkLight", JSON.stringify(s));
        sessionStorage.setItem("seeded", "1");
      }
    }, { guideSeen: true, tipsSeen: ALL_TIPS, lang: "en", ...settings });
    const page = await context.newPage();
    page.errors = [];
    page.on("pageerror", e => page.errors.push(e.message));
    page.on("console", m => { if (m.type() === "error") page.errors.push(m.text()); });
    await page.goto(base + query);
    await page.waitForLoadState("load");
    return page;
  }
  async function close() {
    await browser.close();
    await new Promise(ok => server.close(ok));
  }
  return { open, close, requests };
}

module.exports = { launch };
