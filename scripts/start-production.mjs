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

function serviceUnavailablePage() {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CounterPick — сервис временно недоступен</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 78% 20%,#193d3d,transparent 35%),#080d13;color:#f3f8fa;font:16px Arial,sans-serif}.card{width:min(620px,calc(100% - 40px));padding:48px;border:1px solid #28494a;background:#101923;box-shadow:0 30px 100px #0008}.eyebrow{color:#8af1d4;font-size:11px;font-weight:700;letter-spacing:.16em}.code{margin:24px 0 4px;color:#ff756f;font-size:clamp(82px,18vw,150px);font-weight:900;letter-spacing:-.1em;line-height:.8}.code span{color:#f5a466}h1{margin:24px 0 14px;font-size:clamp(32px,7vw,56px);line-height:.95;letter-spacing:-.06em}em{color:#8af1d4;font-style:normal}p{max-width:480px;color:#93a6b2;line-height:1.6}a{display:inline-block;margin-top:22px;padding:13px 17px;background:#8af1d4;color:#07201c;text-decoration:none;font-weight:700}small{display:block;margin-top:38px;color:#93a6b2;font-size:10px;letter-spacing:.08em}</style></head><body><main class="card"><span class="eyebrow">SERVICE STATUS / 5XX</span><div class="code">50<span>×</span></div><h1>Сервис на короткой<br><em>перезагрузке.</em></h1><p>Мы не смогли обработать запрос. Попробуйте ещё раз через несколько секунд — данные драфта не потеряны.</p><a href="/">Вернуться к драфту</a><small>COUNTERPICK / DOTA 2 DRAFT INTELLIGENCE · by Karabas</small></main></body></html>`;
}

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
  const contentType = response.headers.get("content-type") ?? "";

  // Vinext emits its client bootstrap as a dynamic import inside a classic
  // inline script. That import is rejected by some reverse-proxy browser
  // paths even though the same module is available over HTTP. A normal module
  // script is equivalent here and is considerably more reliable.
  if (contentType.includes("text/html")) {
    const html = await response.text();
    const patchedHtml = html.replace(
      /<script id="_R_">import\("([^"]+)"\)<\/script>/,
      '<script id="_R_" type="module" src="$1"></script>',
    );
    responseHeaders["cache-control"] = "no-store, must-revalidate";
    res.writeHead(response.status, responseHeaders);
    res.end(patchedHtml);
    return;
  }

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
    if (!res.headersSent) res.writeHead(502, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "retry-after": "15" });
    res.end(serviceUnavailablePage());
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
