import { CATALOG, findHero, PATCH, ROLE_LABELS, type DraftHero, type RoleId } from "./dota-data";
import { STRATEGIES, tacticalFit, type StrategyId } from "./tactics";

export type LiveHeroMeta = { matches: number; winRate: number; rating?: number; laneAdvantage?: number };
export type LiveBuild = {
  heroId: number; role: number; sample: number; starting?: string[]; early?: string[];
  core?: { item: string; timing: string }[]; situational?: { item: string; reason: string; lift?: string }[];
  skills?: string[]; talents?: { level: number; text: string }[]; source?: string; rating?: number; winRate?: number;
};
export type LivePair = { heroId: number; otherHeroId: number; matches: number; winRate: number; role?: number };
export type LivePairs = { matchups?: LivePair[]; synergies?: LivePair[] };
export type EncounterMode = "auto" | "solo" | "duo" | "trio" | "teamfight";
export type RecommendationMode = "tactical" | "classic";
export type RecommendationContext = { strategy?: StrategyId; encounter?: EncounterMode; mode?: RecommendationMode };

export type Recommendation = {
  rank: number; heroId: number; heroName: string; heroImage: string; score: number;
  confidence: "Высокая" | "Средняя" | "Низкая"; sample: number; coverage: number;
  factors: { counter: number; synergy: number; meta: number }; reasons: string[]; tactics: string[]; battle: string;
};
export type BuildGuide = {
  heroId: number; heroName: string; role: string; patch?: string; sample: number; source: string;
  confidence: "Высокая" | "Средняя" | "Низкая"; starting: string[]; early: string[];
  core: { item: string; timing: string }[]; situational: { item: string; reason: string; lift?: string }[];
  skills: string[]; talents: { level: number; text: string }[]; rating?: number; battlePlan: string;
};

/* Only maintained, known pair heuristics are used when an upstream matchup is
 * absent. Unknown pairs stay neutral; the old implementation manufactured a
 * pseudo-random advantage, which made results look precise without evidence. */
const knownCounters: Record<number, number[]> = {
  13: [17, 39, 106], 14: [1, 2, 4, 5, 6], 17: [1, 13, 39, 46, 60], 41: [14, 17, 44, 120],
  44: [2, 28, 29, 47, 98], 47: [13, 17, 39, 60], 60: [1, 17, 41, 67], 74: [13, 17, 39, 60],
  86: [13, 17, 34, 74, 116], 90: [14, 17, 44, 67], 97: [13, 14, 17, 41], 104: [41, 44, 67, 109],
  106: [14, 41, 44, 60], 116: [13, 17, 41, 97], 120: [41, 44, 67, 89],
};
const stableMeta: Record<number, number> = { 13: 78, 14: 81, 17: 89, 41: 84, 44: 86, 60: 84, 74: 87, 86: 92, 90: 88, 97: 82, 104: 83, 106: 85, 116: 86, 120: 90 };

function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
function normalize(value: number, min: number, max: number) { return Math.round(clamp(((value - min) / (max - min)) * 100, 0, 100)); }
function confidence(coverage: number, sample: number): Recommendation["confidence"] { return coverage >= 80 && sample >= 500 ? "Высокая" : coverage >= 60 && sample >= 150 ? "Средняя" : "Низкая"; }

function directLaneRole(target: RoleId, enemyRole?: RoleId) {
  if (!enemyRole) return false;
  if (target === 2) return enemyRole === 2;
  if (target === 1) return enemyRole === 3 || enemyRole === 4;
  if (target === 3) return enemyRole === 1 || enemyRole === 5;
  return enemyRole === 1 || enemyRole === 3 || enemyRole === 4 || enemyRole === 5;
}

function laneWeight(target: RoleId, enemy: DraftHero, enemies: DraftHero[], encounter: EncounterMode) {
  if (encounter === "teamfight") return 1;
  if (enemy.lane) return 1.5;
  if (enemies.some((hero) => hero.lane)) return 0.35;
  if (encounter === "solo" || encounter === "duo" || encounter === "trio") return directLaneRole(target, enemy.role) ? 1.5 : 0.7;
  return directLaneRole(target, enemy.role) ? 1.5 : 0.78;
}

function livePair(candidate: number, other: number, rows?: LivePair[]) {
  const row = rows?.find((pair) => pair.heroId === candidate && pair.otherHeroId === other && pair.matches >= 5 && Number.isFinite(pair.winRate));
  if (!row) return null;
  return { advantage: clamp((row.winRate - 50) / 20, -0.42, 0.42), matches: row.matches, curated: false };
}

function matchup(candidate: number, enemy: number, rows?: LivePair[]) {
  const live = livePair(candidate, enemy, rows);
  if (live) return live;
  // Curated interactions stay deliberately weaker than measured rows. They
  // retain useful lane knowledge during an outage without looking like data.
  return { advantage: knownCounters[candidate]?.includes(enemy) ? 0.22 : 0, matches: 0, curated: knownCounters[candidate]?.includes(enemy) ?? false };
}

function battleLabel(allies: DraftHero[], enemies: DraftHero[], targetRole: RoleId, encounter: EncounterMode) {
  const friendly = allies.filter((hero) => hero.lane).length + 1;
  const hostile = enemies.filter((hero) => hero.lane).length;
  if (encounter === "teamfight") return "Командная драка: все герои в списке имеют одинаковый вес.";
  if (hostile) return `Отмеченная стычка: ${friendly} союзн. против ${hostile} соперн. на линии; её матчапы весят ×1,5.`;
  if (encounter === "solo") return "Сценарий 1×1: приоритет у прямого соперника по позиции.";
  if (encounter === "duo") return "Сценарий 2×2: оценены партнёр линии, контроль и размены.";
  if (encounter === "trio") return "Сценарий ранней 3×3: выше ценятся контроль, сейв и темп.";
  return `Авто-сценарий линии для позиции ${targetRole}: прямые роли получают вес ×1,5.`;
}

export function recommend(allies: DraftHero[], enemies: DraftHero[], targetRole: RoleId, liveMeta: Record<string, LiveHeroMeta> = {}, livePairs: LivePairs = {}, context: RecommendationContext = {}): Recommendation[] {
  const mode = context.mode ?? "tactical";
  const strategy = mode === "classic" ? "balanced" : context.strategy ?? "balanced";
  const encounter = mode === "classic" ? "teamfight" : context.encounter ?? "auto";
  const blocked = new Set([...allies, ...enemies].map((hero) => hero.id));
  const rolePool = CATALOG.filter((hero) => hero.roles.includes(targetRole) && !blocked.has(hero.id));
  const roleData = (heroId: number) => liveMeta[`${heroId}:${targetRole}`] ?? liveMeta[String(heroId)];
  const provenPool = rolePool.filter((hero) => (roleData(hero.id)?.matches ?? 0) >= 100);
  const pool = provenPool.length >= 5 ? provenPool : rolePool;

  const rows = pool.map((hero) => {
    const matchupRows = enemies.map((enemy) => {
      const source = matchup(hero.id, enemy.id, livePairs.matchups);
      const reliability = source.matches > 0 ? source.matches / (source.matches + 100) : source.curated ? 0.35 : 0;
      return { enemy, games: source.matches, value: source.advantage * reliability, weight: laneWeight(targetRole, enemy, enemies, encounter), raw: source.advantage };
    });
    const counter = matchupRows.reduce((sum, row) => sum + row.value * row.weight, 0) / Math.max(1, matchupRows.reduce((sum, row) => sum + row.weight, 0));
    const tactical = mode === "tactical" ? tacticalFit(hero.id, allies, enemies, targetRole, strategy) : { score: 0, reasons: [] as string[] };
    const synergyRows = allies.map((ally) => {
      const source = livePair(hero.id, ally.id, livePairs.synergies);
      return { ally, value: source ? clamp(source.advantage, -0.35, 0.35) : 0, weight: ally.lane && encounter !== "teamfight" ? 1.5 : 1 };
    });
    const pairSynergy = synergyRows.reduce((sum, row) => sum + row.value * row.weight, 0) / Math.max(1, synergyRows.reduce((sum, row) => sum + row.weight, 0));
    const synergy = allies.length ? clamp(tactical.score + pairSynergy * 0.25, -0.28, 0.35) : 0;
    const meta = roleData(hero.id);
    const dataReliability = meta ? meta.matches / (meta.matches + 100) : 1;
    const metaScore = meta ? Math.round(clamp(((meta.winRate - 43) / 18) * 100, 0, 100) * dataReliability) : stableMeta[hero.id] ?? 58;
    const counterScore = normalize(counter, -0.3, 0.38);
    const synergyScore = normalize(synergy, -0.25, 0.32);
    const score = Math.round(allies.length ? counterScore * 0.55 + synergyScore * 0.25 + metaScore * 0.2 : counterScore * 0.7 + metaScore * 0.3);
    const reportedSamples = matchupRows.filter((row) => row.games > 0).map((row) => row.games);
    const sample = reportedSamples.length ? Math.round(reportedSamples.reduce((sum, value) => sum + value, 0) / reportedSamples.length) : 0;
    const coverage = Math.round((matchupRows.filter((row) => row.games >= 150).length / Math.max(1, matchupRows.length)) * 100);
    const strongestEnemies = matchupRows.filter((row) => row.raw > 0.05).sort((a, b) => b.raw - a.raw).slice(0, 2).map((row) => row.enemy.shortName);
    const strongestAlly = synergyRows.filter((row) => row.value > 0.04).sort((a, b) => b.value * b.weight - a.value * a.weight)[0]?.ally;
    const reasons = [
      strongestEnemies.length ? `Лучший ответ против ${strongestEnemies.join(" и ")}` : "Нет достаточных matchup-данных: приоритет у роли, состава и стратегии",
      ...(strongestAlly ? [`Проверенная синергия с ${strongestAlly.shortName}`] : []),
      ...tactical.reasons,
      ...(mode === "classic" ? ["Классический рейтинг: matchup, синергия и мета роли без сценария линии"] : []),
      `${ROLE_LABELS[targetRole]}: ${metaScore}/100 в актуальной мете`,
    ];
    const battle = mode === "classic" ? "Классический режим: все выбранные противники имеют равный вес, без тактического сценария линии." : battleLabel(allies, enemies, targetRole, encounter);
    return { hero, score, sample, coverage, factors: { counter: counterScore, synergy: synergyScore, meta: metaScore }, reasons: [...new Set(reasons)].slice(0, 5), tactics: tactical.reasons, battle };
  });

  return rows.sort((left, right) => right.score - left.score || right.factors.counter - left.factors.counter || left.hero.name.localeCompare(right.hero.name)).slice(0, 5).map((row, index) => ({
    rank: index + 1, heroId: row.hero.id, heroName: row.hero.name, heroImage: row.hero.image, score: row.score,
    confidence: confidence(row.coverage, row.sample), sample: row.sample, coverage: row.coverage, factors: row.factors,
    reasons: row.reasons, tactics: row.tactics, battle: row.battle,
  }));
}

const startingByRole: Record<RoleId, string[]> = {
  1: ["Tango", "Quelling Blade", "Iron Branch ×2", "Magic Stick"], 2: ["Tango", "Bottle", "Magic Wand", "Null Talisman"],
  3: ["Tango", "Bracer", "Magic Wand", "Blood Grenade"], 4: ["Tango", "Observer Ward", "Blood Grenade", "Magic Stick"],
  5: ["Tango", "Sentry Ward", "Blood Grenade", "Faerie Fire"],
};
const defaultCore: Record<RoleId, string[]> = {
  1: ["Power Treads", "Maelstrom", "Black King Bar", "Hurricane Pike"], 2: ["Bottle", "Power Treads", "Aghanim's Scepter", "Black King Bar"],
  3: ["Phase Boots", "Blink Dagger", "Lotus Orb", "Black King Bar"], 4: ["Arcane Boots", "Glimmer Cape", "Force Staff", "Aghanim's Shard"],
  5: ["Arcane Boots", "Mekansm", "Glimmer Cape", "Force Staff"],
};
const safeCore: Record<string, string[]> = {
  "14:3": ["Arcane Boots", "Blink Dagger", "Aghanim's Shard", "Force Staff"], "14:4": ["Tranquil Boots", "Pavise", "Force Staff", "Glimmer Cape"], "14:5": ["Arcane Boots", "Glimmer Cape", "Aghanim's Shard", "Force Staff"],
  "17:2": ["Bottle", "Power Treads", "Kaya and Sange", "Black King Bar"], "41:1": ["Power Treads", "Maelstrom", "Black King Bar", "Butterfly"], "44:1": ["Power Treads", "Battle Fury", "Desolator", "Black King Bar"],
  "60:2": ["Bottle", "Power Treads", "Black King Bar", "Aghanim's Scepter"], "74:2": ["Null Talisman", "Boots of Travel", "Aghanim's Scepter", "Black King Bar"],
  "86:4": ["Arcane Boots", "Aether Lens", "Glimmer Cape", "Aghanim's Shard"], "90:2": ["Bottle", "Power Treads", "Kaya and Sange", "Aghanim's Scepter"],
  "97:2": ["Bottle", "Power Treads", "Blink Dagger", "Black King Bar"], "104:3": ["Phase Boots", "Blink Dagger", "Blade Mail", "Black King Bar"],
  "106:2": ["Bottle", "Phase Boots", "Mage Slayer", "Black King Bar"], "116:2": ["Bottle", "Power Treads", "Diffusal Blade", "Blink Dagger"],
  "120:4": ["Arcane Boots", "Glimmer Cape", "Force Staff", "Aghanim's Shard"],
};

function threatItems(enemyIds: number[], strategy: StrategyId, targetRole: RoleId) {
  const enemyNames = enemyIds.map((id) => findHero(id)?.shortName).filter(Boolean).join(", ");
  const roleEntries: Record<RoleId, Array<{ item: string; reason: string; score: number }>> = {
    1: [
      { item: "Black King Bar", reason: "Защищает окно урона от магического burst и контроля", score: 82 },
      { item: "Manta Style", reason: "Сбрасывает часть дебаффов и помогает в сайдлайнах", score: 68 },
      { item: "Silver Edge", reason: "Break против опасных пассивных способностей", score: 61 },
      { item: "Satanic", reason: "Даёт второй шанс в затяжной драке", score: 57 },
    ],
    2: [
      { item: "Black King Bar", reason: "Сохраняет позицию мидера в главном окне драки", score: 82 },
      { item: "Linken's Sphere", reason: "Защищает от направленного инициационного заклинания", score: 66 },
      { item: "Mage Slayer", reason: "Снижает магический урон ключевой цели", score: 62 },
      { item: "Blink Dagger", reason: "Помогает первым занять дистанцию для инициации или выхода", score: 56 },
    ],
    3: [
      { item: "Blink Dagger", reason: "Даёт надёжный вход в драку с оффлейна", score: 76 },
      { item: "Lotus Orb", reason: "Снимает и отражает направленные дебаффы", score: 70 },
      { item: "Pipe of Insight", reason: "Снижает магический burst по передней линии", score: 67 },
      { item: "Crimson Guard", reason: "Смягчает физический урон в массовом размене", score: 62 },
    ],
    4: [
      { item: "Force Staff", reason: "Разрывает дистанцию и спасает цель под фокусом", score: 76 },
      { item: "Glimmer Cape", reason: "Даёт сейв союзнику под фокусом", score: 73 },
      { item: "Lotus Orb", reason: "Снимает направленные дебаффы с ключевого кора", score: 65 },
      { item: "Spirit Vessel", reason: "Снижает лечение и помогает закрепить пик", score: 58 },
    ],
    5: [
      { item: "Glimmer Cape", reason: "Ранний сейв для кора под фокусом", score: 79 },
      { item: "Force Staff", reason: "Выводит союзника из опасной зоны", score: 76 },
      { item: "Pavise", reason: "Защищает от раннего физического burst", score: 66 },
      { item: "Pipe of Insight", reason: "Закрывает команду от массового магического урона", score: 60 },
    ],
  };
  const entries = [...roleEntries[targetRole]];
  const strategyItems = STRATEGIES[strategy].itemFocus;
  for (const item of strategyItems) entries.push({ item, reason: `Поддерживает план «${STRATEGIES[strategy].label.toLowerCase()}»`, score: 70 });
  return [...new Map(entries.map((entry) => [entry.item, entry])).values()]
    .map((entry, index) => ({ item: entry.item, reason: enemyNames ? `${entry.reason} против ${enemyNames}` : entry.reason, lift: `${(1.45 - index * 0.08).toFixed(2)}×`, score: entry.score }))
    .sort((left, right) => right.score - left.score).slice(0, 5).map(({ score: _score, ...entry }) => entry);
}

export function buildGuide(heroId: number, targetRole: RoleId, enemyIds: number[], liveBuilds: Record<string, LiveBuild> = {}, context: RecommendationContext = {}): BuildGuide {
  const hero = findHero(heroId) ?? CATALOG[0];
  const mode = context.mode ?? "tactical";
  const strategy = mode === "classic" ? "balanced" : context.strategy ?? "balanced";
  const live = liveBuilds[`${hero.id}:${targetRole}`];
  const sourceCore = live?.core?.filter((entry) => entry.item)?.slice().sort((left, right) => Number.parseInt(left.timing, 10) - Number.parseInt(right.timing, 10));
  const core = sourceCore?.length ? sourceCore : (safeCore[`${hero.id}:${targetRole}`] ?? defaultCore[targetRole]).map((item, index) => ({ item, timing: `${index < 2 ? 9 + index * 6 : 22 + (index - 2) * 9}′` }));
  const sample = live?.sample ?? 0;
  const confidence: BuildGuide["confidence"] = live ? sample >= 100 ? "Высокая" : sample >= 25 ? "Средняя" : "Низкая" : "Низкая";
  const externalSituational = live?.situational?.slice().sort((left, right) => Number.parseFloat(right.lift ?? "0") - Number.parseFloat(left.lift ?? "0"));
  return {
    heroId: hero.id, heroName: hero.name, role: ROLE_LABELS[targetRole], patch: PATCH, sample,
    source: live?.source ?? "Локальная role-safe база — pro build ещё не получен", confidence,
    starting: live?.starting?.length ? live.starting : startingByRole[targetRole],
    early: live?.early?.length ? live.early : ["Magic Wand", "Boots of Speed", targetRole >= 4 ? "Smoke of Deceit" : "Power Treads"],
    core, situational: externalSituational?.length ? externalSituational : threatItems(enemyIds, strategy, targetRole),
    skills: live?.skills?.length ? live.skills : ["Основной spell", "Spell 2", "Основной spell", "Spell 3", "Основной spell", "Ultimate", "Основной spell", "Spell 2", "Spell 2", "Талант 10"],
    talents: live?.talents?.length ? live.talents : [{ level: 10, text: "Усиление ключевого заклинания" }, { level: 15, text: "Выживаемость" }, { level: 20, text: "Mid-game бонус" }, { level: 25, text: "Late-game выбор" }],
    rating: live?.rating ?? (live?.winRate ? Math.round(live.winRate * 10) : undefined),
    battlePlan: `${mode === "classic" ? "Классический режим: сборка привязана к роли и общему драфту." : battleLabel([], enemyIds.map((id) => findHero(id)).filter((hero): hero is DraftHero => Boolean(hero)), targetRole, context.encounter ?? "auto")} План: ${STRATEGIES[strategy].short}`,
  };
}
