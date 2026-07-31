import assert from "node:assert/strict";
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
  assert.match(html, /TACTICAL READ/);
  assert.match(html, /Репорты и тикеты/);
  assert.match(html, /Пик, который/);
  assert.match(html, /Рассчитать контрпик/);
  assert.match(html, /Противники/);
  assert.doesNotMatch(html, /Your site is taking shape/);
  assert.doesNotMatch(html, /codex-preview/);
});

test("catalog and recommendation endpoints validate requests", async () => {
  const catalog = await render("/api/catalog");
  assert.equal(catalog.status, 200);
  const catalogJson = await catalog.json();
  assert.ok(catalogJson.heroes.length > 100);

  const invalid = await render("/api/recommendations");
  assert.equal(invalid.status, 405);
});

test("build guides respect the requested role", async () => {
  const valid = await render("/api/build-guide", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ heroId: 90, targetRole: 2, enemyHeroIds: [14, 17] }) });
  assert.equal(valid.status, 200);
  const guide = await valid.json();
  assert.deepEqual(guide.guide.core.map((item) => item.item).slice(0, 2), ["Bottle", "Power Treads"]);

  const invalid = await render("/api/build-guide", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ heroId: 5, targetRole: 2, enemyHeroIds: [14] }) });
  assert.equal(invalid.status, 400);
});
