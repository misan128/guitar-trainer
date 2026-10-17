// Shared setup for the smoke tests: a tiny static server on the repo and Chromium with a phone viewport.
// Each page collects its errors, so a test can assert there were none.
const { chromium, devices } = require("playwright");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..", "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
  ".png": "image/png", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };

async function launch() {
  const requests = [];
  const server = http.createServer((req, res) => {
    const file = path.join(root, decodeURIComponent(req.url.split("?")[0]).replace(/\/$/, "/index.html"));
    requests.push(req.url.split("?")[0]);
    fs.readFile(file, (err, data) => {
      res.writeHead(err ? 404 : 200, { "content-type": TYPES[path.extname(file)] || "text/plain" });
      res.end(data);
    });
  });
  await new Promise(ok => server.listen(0, ok));
  const base = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });

  // settings: saved settings to start from (the app's localStorage), merged over "guide already seen"
  async function open(query = "", settings = {}) {
    const context = await browser.newContext({ ...devices["iPhone 13"], locale: "en", serviceWorkers: "block" });
    await context.addInitScript(s => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem("scaleWalkLight", JSON.stringify(s));
        sessionStorage.setItem("seeded", "1");
      }
    }, { guideSeen: true, lang: "en", ...settings });
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
