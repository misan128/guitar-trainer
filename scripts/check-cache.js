// Release check: when a precached file changed since the last release, sw.js must name a new cache, or
// installed apps keep the old files offline. Also checks that every precached file exists.
// Run: node scripts/check-cache.js [base]   (base: a tag or commit; default: the latest release tag
// before HEAD). Used by .github/workflows/cache-check.yml on every push to main.
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const cacheName = src => (src.match(/const CACHE = "([^"]+)"/) || [])[1];
const precache = src => [...src.match(/const PRECACHE = \[([\s\S]*?)\]/)[1].matchAll(/"([^"]+)"/g)]
  .map(m => (m[1] === "./" ? "index.html" : m[1]));

const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const files = precache(sw);
let failed = false;

const missing = files.filter(f => !fs.existsSync(path.join(root, f)));
if (missing.length) { failed = true; console.error(`Precached but missing: ${missing.join(", ")}`); }

// The highest release tag that is not HEAD itself (on main, the release being pushed may already be tagged).
// By version, not by history: release tags sit on main's merge commits, which develop and release branches
// do not contain.
const head = git("rev-parse", "HEAD");
const base = process.argv[2] || git("tag", "--sort=-v:refname", "--list", "v*")
  .split("\n").find(t => t && git("rev-list", "-n", "1", t) !== head);
if (!base) {
  console.log("No earlier release to compare with.");
} else {
  const changed = git("diff", "--name-only", base, "HEAD").split("\n").filter(f => files.includes(f) || f === "sw.js");
  const before = cacheName(git("show", `${base}:sw.js`)), now = cacheName(sw);
  if (changed.length && before === now) {
    failed = true;
    console.error(`Changed since ${base}: ${changed.join(", ")}\nbut sw.js still names cache "${now}". Bump it.`);
  } else {
    console.log(changed.length ? `Cache ${before} → ${now} since ${base}.` : `No precached file changed since ${base}.`);
  }
}
process.exit(failed ? 1 : 0);
