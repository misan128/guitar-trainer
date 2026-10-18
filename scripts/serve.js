// Local server for the app: npm start (or node scripts/serve.js [port]). The app is made of ES modules,
// which browsers only load over HTTP(S), so index.html cannot be opened as a file.
// Serves the repo as it is, without caching, and prints the address on this machine and on the network
// (for a phone on the same Wi-Fi). The smoke tests use it too.
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json",
  ".json": "application/json", ".md": "text/plain; charset=utf-8" };

// onRequest(urlPath): optional, called for every request (the smoke tests record them)
function createServer(onRequest = () => {}) {
  return http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split("?")[0]);
    onRequest(urlPath);
    const file = path.join(ROOT, urlPath.endsWith("/") ? urlPath + "index.html" : urlPath);
    if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }   // nothing outside the repo
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404, { "content-type": "text/plain" }); return res.end("Not found"); }
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
      res.end(data);
    });
  });
}

module.exports = { createServer };

if (require.main === module) {
  const port = Number(process.argv[2] || process.env.PORT || 8000);
  const server = createServer();
  server.on("error", e => {
    console.error(e.code === "EADDRINUSE" ? `Port ${port} is in use. Try another: npm start -- 8001` : e.message);
    process.exit(1);
  });
  server.listen(port, () => {
    const lan = Object.values(os.networkInterfaces()).flat().filter(a => a && a.family === "IPv4" && !a.internal).map(a => a.address);
    console.log(`Guitar Trainer at http://localhost:${port}/  (dev mode: http://localhost:${port}/?debug)`);
    for (const ip of lan) console.log(`On the network:  http://${ip}:${port}/  (no offline or screen lock there: they need HTTPS)`);
    console.log("Ctrl+C to stop.");
  });
}
