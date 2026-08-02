import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/", init = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", process.pid + "-" + Date.now());
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost" + pathname, { headers: { accept: "text/html", ...(init.headers ?? {}) }, ...init }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the CounterPick draft board", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /CounterPick/);
  assert.match(html, /data-counterpick-critical/);
  assert.match(html, /СЦЕНАРИЙ СТЫЧКИ/);
  assert.match(html, /ПЛАН НА ИГРУ/);
  assert.match(html, /Репорты и тикеты/);
  assert.match(html, /Пик для/);
  assert.match(html, /Рассчитать контрпики/);
  assert.match(html, /Противники/);
  assert.doesNotMatch(html, /Your site is taking shape/);
  assert.doesNotMatch(html, /codex-preview/);
});

test("rendered page references a real non-empty production stylesheet", async () => {
  const response = await render();
  const html = await response.text();
  const stylesheet = html.match(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+\.css)"/);
  assert.ok(stylesheet, "The rendered page must reference a stylesheet");

  const cssUrl = new URL(`../dist/client${stylesheet[1]}`, import.meta.url);
  const css = await readFile(cssUrl, "utf8");
  assert.ok(css.length > 10_000, "The production stylesheet must not be empty or truncated");
  assert.match(css, /--counterpick-release/);
});

test("catalog and recommendation endpoints validate requests", async () => {
  const catalog = await render("/api/catalog");
  assert.equal(catalog.status, 200);
  const catalogJson = await catalog.json();
  assert.ok(catalogJson.heroes.length > 100);

  const invalid = await render("/api/recommendations");
  assert.equal(invalid.status, 405);
});

test("classic mode preserves the previous draft ranking without lane tactics", async () => {
  const response = await render("/api/recommendations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      targetRole: 2,
      allies: [{ heroId: 5, role: 5 }],
      enemies: [{ heroId: 14, role: 3, lane: true }, { heroId: 17, role: 2, lane: true }],
      mode: "classic",
      strategy: "lane-pressure",
      encounter: "solo",
    }),
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.recommendations.length, 5);
  assert.match(result.recommendations[0].battle, /Классический режим/);
});

test("build guides respect the requested role", async () => {
  const valid = await render("/api/build-guide", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ heroId: 90, targetRole: 2, enemyHeroIds: [14, 17] }) });
  assert.equal(valid.status, 200);
  const guide = await valid.json();
  assert.deepEqual(guide.guide.core.map((item) => item.item).slice(0, 2), ["Bottle", "Power Treads"]);

  const invalid = await render("/api/build-guide", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ heroId: 5, targetRole: 2, enemyHeroIds: [14] }) });
  assert.equal(invalid.status, 400);
});
