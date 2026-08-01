import test from "node:test";
import assert from "node:assert/strict";
import { CATALOG, heroImageCandidates, normalizeRemoteCatalog, searchHeroes, setCatalog } from "../lib/dota-data.ts";

test("normalizes a complete provider catalog and keeps hero aliases", () => {
  const rows = CATALOG.map((hero) => ({ id: hero.id, name: `npc_dota_hero_${hero.name.toLowerCase().replaceAll(" ", "_")}`, localized_name: hero.name, roles: ["Carry"] }));
  const normalized = normalizeRemoteCatalog(rows);
  assert.equal(normalized.length, CATALOG.length);
  assert.equal(normalized.find((hero) => hero.name === "Enigma")?.id, 33);
  assert.equal(normalized.find((hero) => hero.name === "Pugna")?.roles.includes(4), true);
  assert.equal(setCatalog(normalized), true);
});

test("finds heroes by Russian aliases, transliteration and a small typo", () => {
  assert.equal(searchHeroes("шторм")[0]?.name, "Storm Spirit");
  assert.equal(searchHeroes("кунка")[0]?.name, "Kunkka");
  assert.equal(searchHeroes("джагернаут")[0]?.name, "Juggernaut");
});

test("uses the canonical Steam portrait for every hero and the internal Magnus slug", () => {
  assert.equal(CATALOG.every((hero) => heroImageCandidates(hero).length >= 2), true);
  const magnus = CATALOG.find((hero) => hero.id === 97);
  assert.ok(magnus);
  assert.match(magnus.image, /\/magnataur\.png$/);
  assert.equal(heroImageCandidates(magnus).some((url) => /\/magnataur\.png$/.test(url)), true);
});
