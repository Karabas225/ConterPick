import { createReadStream } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { Readable } from "node:stream";
import { startProdServer } from "vinext/server/prod-server";

const root = process.cwd();
const clientDir = path.join(root, "dist", "client");
const args = process.argv.slice(2);

async function loadEnvFile(filename) {
  try {
    const contents = await readFile(path.join(root, filename), "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]] !== undefined) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // Environment variables supplied by the service manager still work.
  }
}

await loadEnvFile(".env");
await loadEnvFile(".env.local");

function option(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

const port = Number(option("--port", process.env.PORT ?? "3000"));
const host = option("--hostname", process.env.COUNTERPICK_HOST ?? "0.0.0.0");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function safeClientPath(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split("?")[0]);
  } catch {
    return null;
  }
  if (!decoded.startsWith("/") || decoded.includes("\\") || decoded.includes("..")) return null;
  const resolved = path.resolve(clientDir, `.${decoded}`);
  if (!resolved.startsWith(`${path.resolve(clientDir)}${path.sep}`)) return null;
  return resolved;
}

async function serveStatic(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  const filename = safeClientPath(req.url ?? "/");
  if (!filename) return false;
  try {
    const file = await stat(filename);
    if (!file.isFile()) return false;
    const ext = path.extname(filename).toLowerCase();
    const isAsset = (req.url ?? "").split("?")[0].startsWith("/assets/");
    res.writeHead(200, {
      "Content-Type": contentTypes[ext] ?? "application/octet-stream",
      "Content-Length": String(file.size),
      "Cache-Control": isAsset ? "public, max-age=31536000, immutable" : "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    });
    if (req.method === "HEAD") res.end();
    else createReadStream(filename).pipe(res);
    return true;
  } catch {
    return false;
  }
}

async function proxy(req, res, targetPort) {
  const headers = new Headers();
  const hopByHop = new Set(["host", "connection", "expect", "content-length", "transfer-encoding", "upgrade", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer"]);
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined && !hopByHop.has(key.toLowerCase())) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const response = await fetch(`http://127.0.0.1:${targetPort}${req.url ?? "/"}`, {
    method: req.method,
    headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    duplex: hasBody ? "half" : undefined,
  });
  const responseHeaders = {};
  response.headers.forEach((value, key) => {
    // Node's fetch transparently decodes gzip/br responses. Do not forward
    // the stale encoding/length headers with the decoded body.
    if (key !== "content-encoding" && key !== "content-length" && key !== "transfer-encoding") responseHeaders[key] = value;
  });
  const cookies = response.headers.getSetCookie?.() ?? [];
  if (cookies.length) responseHeaders["set-cookie"] = cookies;
  res.writeHead(response.status, responseHeaders);
  if (response.body) Readable.fromWeb(response.body).pipe(res);
  else res.end();
}

await access(path.join(root, "dist", "server"));
const internal = await startProdServer({ port: 0, host: "127.0.0.1", outDir: path.join(root, "dist") });
const server = createServer(async (req, res) => {
  try {
    if (await serveStatic(req, res)) return;
    await proxy(req, res, internal.port);
  } catch (error) {
    console.error("[counterpick] request failed", error);
    if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end("CounterPick upstream is unavailable");
  }
});

async function runUpdate(reason, force = false) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/updates${force ? "?force=1" : ""}`);
    const payload = await response.json().catch(() => ({}));
    console.log(`[counterpick] ${reason} Dota update: ${response.status} ${payload.status ?? "unknown"} patch ${payload.patch ?? "—"}`);
    if (payload.lastError) console.warn(`[counterpick] ${reason} Dota update warning: ${payload.lastError}`);
  } catch (error) {
    console.warn(`[counterpick] ${reason} Dota update failed`, error?.message ?? error);
  }
}

server.listen(port, host, () => {
  console.log(`[counterpick] Production server running at http://${host}:${port}`);
  console.log(`[counterpick] Static assets served from ${clientDir}`);
  void runUpdate("startup", true);
});

const updateTimer = setInterval(() => {
  void runUpdate("daily");
}, 24 * 60 * 60 * 1000);
updateTimer.unref?.();

async function shutdown(signal) {
  console.log(`[counterpick] ${signal}, shutting down`);
  clearInterval(updateTimer);
  server.close();
  internal.server.close();
}
process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
