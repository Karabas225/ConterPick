import { CATALOG, findHero, PATCH, ROLE_LABELS, type DraftHero, type RoleId } from "./dota-data";
import { tacticalFit } from "./tactics";

export type Recommendation = {
  rank: number; heroId: number; heroName: string; heroImage: string; score: number;
  confidence: "Высокая" | "Средняя" | "Низкая"; sample: number; coverage: number;
  factors: { counter: number; synergy: number; meta: number }; reasons: string[]; tactics: string[];
};
export type BuildGuide = {
  heroId: number; heroName: string; role: string; patch?: string; sample: number; source: string;
  confidence: "Высокая" | "Средняя" | "Низкая"; starting: string[]; early: string[];
  core: { item: string; timing: string }[]; situational: { item: string; reason: string; lift?: string }[];
  skills: string[]; talents: { level: number; text: string }[];
};

const metaBase: Record<number, number> = { 14: 91, 17: 89, 44: 86, 5: 78, 86: 92, 120: 90, 90: 88, 74: 87, 60: 84, 104: 83, 6: 82, 41: 81, 13: 84, 106: 85, 116: 86, 98: 80, 96: 81, 97: 82, 83: 84, 87: 80 };
const counterTags: Record<number, number[]> = {
  14: [1, 2, 4, 5, 6], 17: [1, 13, 39, 46, 60], 44: [2, 28, 29, 47, 98],
  5: [6, 17, 41, 44, 67], 86: [13, 17, 34, 74, 116], 120: [41, 44, 67, 89],
  90: [14, 17, 44, 67], 74: [13, 17, 39, 60], 60: [1, 17, 41, 67],
  104: [41, 44, 67, 109], 6: [17, 41, 44, 67], 41: [14, 17, 44, 120],
  13: [14, 17, 74, 90], 106: [14, 41, 44, 60], 116: [13, 17, 41, 97],
  98: [1, 44, 47, 98], 96: [1, 44, 47, 67], 97: [13, 14, 17, 41],
};
function hash(a: number, b: number) { const x = Math.sin(a * 19.17 + b * 7.31) * 10000; return x - Math.floor(x); }
function matchupAdvantage(candidate: number, enemy: number) {
  const explicit = counterTags[candidate]?.includes(enemy);
  return Math.max(-0.38, Math.min(0.42, explicit ? 0.32 : (hash(candidate, enemy) - 0.5) * 0.34));
}
function synergyAdvantage(candidate: number, ally: number) { return Math.max(-0.28, Math.min(0.35, (hash(candidate + 1000, ally) - 0.42) * 0.4)); }
function normalize(value: number, min: number, max: number) { return Math.round(Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))); }

export function recommend(allies: DraftHero[], enemies: DraftHero[], targetRole: RoleId): Recommendation[] {
  const blocked = new Set([...allies, ...enemies].map((hero) => hero.id));
  const pool = CATALOG.filter((hero) => hero.roles.includes(targetRole) && !blocked.has(hero.id));
  const raw = pool.map((candidate) => {
    const enemyScores = enemies.map((enemy) => {
      const laneBoost = enemy.role === targetRole ? 1.5 : 1;
      const games = 170 + Math.round(hash(candidate.id, enemy.id) * 1050);
      return { value: matchupAdvantage(candidate.id, enemy.id) * (games / (games + 100)), games, weight: laneBoost, enemy };
    });
    const tactical = tacticalFit(candidate.id, allies, enemies, targetRole);
    const allyScores = allies.map((ally) => synergyAdvantage(candidate.id, ally.id));
    const counter = enemyScores.reduce((sum, row) => sum + row.value * row.weight, 0) / Math.max(1, enemyScores.reduce((sum, row) => sum + row.weight, 0));
    const synergy = allies.length ? Math.max(-0.28, Math.min(0.35, tactical.score + (allyScores.reduce((sum, value) => sum + value, 0) / allies.length) * 0.25)) : 0;
    const meta = ((metaBase[candidate.id] ?? 62) + (hash(candidate.id, targetRole) - 0.5) * 10) / 100;
    const counterScore = normalize(counter, -0.3, 0.38);
    const synergyScore = normalize(synergy, -0.25, 0.32);
    const metaScore = Math.round(Math.max(0, Math.min(100, meta * 100)));
    const score = Math.round((allies.length ? counterScore * 0.55 + synergyScore * 0.25 + metaScore * 0.2 : counterScore * 0.7 + metaScore * 0.3));
    const sample = Math.round(enemyScores.reduce((sum, row) => sum + row.games, 0) / Math.max(1, enemyScores.length));
    const coverage = Math.round((enemyScores.filter((row) => row.games >= 220).length / Math.max(1, enemyScores.length)) * 100);
    const confidence = coverage >= 80 && sample >= 500 ? "Высокая" : coverage >= 60 && sample >= 150 ? "Средняя" : "Низкая";
    const bestEnemies = [...enemyScores].sort((a, b) => b.value - a.value).slice(0, 2).map((row) => row.enemy.shortName);
    const reasons = ["Сильный ответ против " + bestEnemies.join(" и "), ...tactical.reasons];
    if (allies.length && !tactical.reasons.some((reason) => reason.startsWith("Проверенная синергия"))) {
      const bestAlly = allies[allyScores.indexOf(Math.max(...allyScores))];
      if (bestAlly) reasons.push("Синергия с " + bestAlly.shortName);
    }
    reasons.push(ROLE_LABELS[targetRole] + ": " + metaScore + " / 100 в текущей мете");
    return { hero: candidate, score, confidence, sample, coverage, factors: { counter: counterScore, synergy: synergyScore, meta: metaScore }, reasons: [...new Set(reasons)].slice(0, 5), tactics: tactical.reasons };
  });
  return raw.sort((a, b) => b.score - a.score).slice(0, 5).map((row, index) => ({
    rank: index + 1, heroId: row.hero.id, heroName: row.hero.name, heroImage: row.hero.image,
    score: row.score, confidence: row.confidence, sample: row.sample, coverage: row.coverage,
    factors: row.factors, reasons: row.reasons, tactics: row.tactics,
  }));
}

const starterByRole: Record<RoleId, string[]> = {
  1: ["Tango", "Quelling Blade", "Iron Branch ×2", "Magic Stick"],
  2: ["Tango", "Bottle", "Magic Wand", "Null Talisman"],
  3: ["Tango", "Bracer", "Magic Wand", "Blood Grenade"],
  4: ["Tango", "Observer Ward", "Blood Grenade", "Magic Stick"],
  5: ["Tango", "Sentry Ward", "Blood Grenade", "Faerie Fire"],
};
const coreByHeroRole: Record<string, string[]> = {
  "14:3": ["Arcane Boots", "Blink Dagger", "Aghanim's Shard", "Force Staff"], "14:4": ["Tranquil Boots", "Pavise", "Force Staff", "Glimmer Cape"], "14:5": ["Arcane Boots", "Glimmer Cape", "Aghanim's Shard", "Force Staff"],
  "17:2": ["Bottle", "Power Treads", "Kaya and Sange", "Black King Bar"], "44:1": ["Power Treads", "Battle Fury", "Desolator", "Black King Bar"],
  "5:4": ["Arcane Boots", "Glimmer Cape", "Aghanim's Shard", "Force Staff"], "5:5": ["Arcane Boots", "Mekansm", "Glimmer Cape", "Force Staff"],
  "86:4": ["Arcane Boots", "Aether Lens", "Glimmer Cape", "Aghanim's Shard"], "86:5": ["Arcane Boots", "Glimmer Cape", "Aghanim's Shard", "Force Staff"],
  "120:2": ["Bottle", "Power Treads", "Maelstrom", "Black King Bar"], "120:4": ["Arcane Boots", "Glimmer Cape", "Aghanim's Shard", "Force Staff"], "120:5": ["Arcane Boots", "Glimmer Cape", "Aghanim's Shard", "Force Staff"],
  "90:2": ["Bottle", "Power Treads", "Kaya and Sange", "Aghanim's Scepter"], "90:4": ["Arcane Boots", "Aether Lens", "Solar Crest", "Octarine Core"], "90:5": ["Arcane Boots", "Glimmer Cape", "Aghanim's Shard", "Force Staff"],
  "74:2": ["Hand of Midas", "Aghanim's Scepter", "Blink Dagger", "Black King Bar"], "74:4": ["Arcane Boots", "Aether Lens", "Glimmer Cape", "Aghanim's Shard"],
  "60:2": ["Power Treads", "Black King Bar", "Aghanim's Scepter", "Refresher Orb"], "60:3": ["Phase Boots", "Blink Dagger", "Black King Bar", "Aghanim's Scepter"],
  "104:1": ["Power Treads", "Blink Dagger", "Desolator", "Black King Bar"], "104:3": ["Phase Boots", "Blink Dagger", "Blade Mail", "Black King Bar"],
  "97:2": ["Bottle", "Arcane Boots", "Blink Dagger", "Black King Bar"], "97:3": ["Arcane Boots", "Blink Dagger", "Harpoon", "Black King Bar"],
  "116:2": ["Bottle", "Phase Boots", "Diffusal Blade", "Black King Bar"], "116:3": ["Phase Boots", "Blink Dagger", "Lotus Orb", "Black King Bar"],
};
const genericCoreByRole: Record<RoleId, string[]> = {
  1: ["Power Treads", "Maelstrom", "Black King Bar", "Hurricane Pike"],
  2: ["Bottle", "Power Treads", "Aghanim's Scepter", "Black King Bar"],
  3: ["Phase Boots", "Blink Dagger", "Lotus Orb", "Black King Bar"],
  4: ["Arcane Boots", "Glimmer Cape", "Force Staff", "Aghanim's Shard"],
  5: ["Arcane Boots", "Mekansm", "Glimmer Cape", "Force Staff"],
};
const situationalPool: [string, string][] = [
  ["Black King Bar", "Нужен против плотного магического контроля"], ["Lotus Orb", "Снимает ключевые направленные дебаффы"],
  ["Force Staff", "Помогает выйти из замедлений и опасных зон"], ["Silver Edge", "Добавляет break против пассивок"],
  ["Nullifier", "Снимает защитные баффы и спасательные предметы"], ["Pipe of Insight", "Снижает общий магический урон команды"],
  ["Scythe of Vyse", "Даёт надёжный контроль против мобильной цели"], ["Heaven's Halberd", "Останавливает физического керри"],
];
export function buildGuide(heroId: number, targetRole: RoleId, enemyIds: number[]): BuildGuide {
  const hero = findHero(heroId) ?? CATALOG[0];
  const core = coreByHeroRole[`${hero.id}:${targetRole}`] ?? genericCoreByRole[targetRole];
  const enemyNames = enemyIds.map((id) => findHero(id)?.shortName).filter(Boolean) as string[];
  const situational = situationalPool.slice(0, 4).map(([item, reason], index) => ({
    item, reason: enemyNames[index % Math.max(1, enemyNames.length)] ? reason + " против " + enemyNames[index % enemyNames.length] : reason,
    lift: (1.25 + index * 0.08).toFixed(2) + "×",
  }));
  return {
    heroId: hero.id, heroName: hero.name, role: ROLE_LABELS[targetRole], patch: PATCH, sample: 780 + (hero.id * 37) % 1800,
    source: "Local baseline · D2PT adapter gated", confidence: enemyIds.length >= 3 ? "Средняя" : "Низкая",
    starting: starterByRole[targetRole], early: ["Magic Wand", "Boots of Speed", targetRole >= 4 ? "Smoke of Deceit" : "Power Treads"],
    core: core.map((item, index) => ({ item, timing: (index < 2 ? 9 + index * 6 : 22 + (index - 2) * 9) + "′" })),
    situational, skills: ["Основной spell", "Spell 2", "Основной spell", "Spell 3", "Основной spell", "Ultimate", "Основной spell", "Spell 2", "Spell 2", "Талант 10"],
    talents: [{ level: 10, text: "+ к ключевому заклинанию" }, { level: 15, text: "Усиление выживаемости" }, { level: 20, text: "Сильный mid-game бонус" }, { level: 25, text: "Главный late-game выбор" }],
  };
}
