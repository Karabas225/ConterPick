import type { DraftHero, RoleId } from "./dota-data";

export type TacticTag = "catch" | "teamfight" | "waveclear" | "save" | "push" | "scaling" | "anti-heal" | "anti-mobility" | "anti-illusion" | "anti-physical" | "anti-magic" | "anti-melee" | "vision" | "roam";

export type StrategyId = "balanced" | "lane-pressure" | "pickoff" | "teamfight" | "map-pressure" | "late-game";

export const STRATEGIES: Record<StrategyId, { label: string; short: string; wants: TacticTag[]; itemFocus: string[] }> = {
  balanced: { label: "Гибкий план", short: "Не жертвовать линией ради поздней игры", wants: ["catch", "teamfight"], itemFocus: [] },
  "lane-pressure": { label: "Давить линию", short: "Выиграть ранние размены и снести внешние башни", wants: ["roam", "anti-melee", "push"], itemFocus: ["Phase Boots", "Drum of Endurance", "Urn of Shadows"] },
  pickoff: { label: "Пики и смоки", short: "Создавать численное преимущество до большого файта", wants: ["catch", "roam", "vision"], itemFocus: ["Blink Dagger", "Orchid Malevolence", "Smoke of Deceit"] },
  teamfight: { label: "Командные драки", short: "Играть вокруг кулдаунов и одного решающего файта", wants: ["teamfight", "save", "anti-magic"], itemFocus: ["Blink Dagger", "Black King Bar", "Pipe of Insight"] },
  "map-pressure": { label: "Давление по карте", short: "Разводить соперника по линиям и быстро брать объекты", wants: ["push", "waveclear", "anti-mobility"], itemFocus: ["Boots of Travel", "Manta Style", "Gleipnir"] },
  "late-game": { label: "Поздняя игра", short: "Сохранить керри-экономику и надёжно пережить мидгейм", wants: ["scaling", "save", "anti-physical"], itemFocus: ["Black King Bar", "Satanic", "Aghanim's Scepter"] },
};

// Сигналы собраны по типовым разделам D2PT Combos, Dota Coach guides, Dotabuff Hero Guides и STRATZ composition data.
const heroTactics: Record<number, TacticTag[]> = {
  1: ["anti-mobility", "scaling", "waveclear"], 2: ["teamfight", "anti-physical"], 5: ["anti-magic", "save"], 6: ["anti-mobility", "scaling"],
  13: ["catch", "waveclear", "anti-mobility"], 14: ["catch", "roam"], 17: ["catch", "roam", "waveclear"], 19: ["catch", "teamfight"],
  22: ["waveclear", "anti-magic"], 25: ["waveclear", "teamfight"], 26: ["catch", "anti-magic"], 27: ["push", "catch"], 28: ["teamfight", "anti-physical"],
  29: ["teamfight", "anti-physical"], 34: ["waveclear", "anti-magic"], 36: ["anti-heal", "teamfight"], 38: ["push", "teamfight"], 39: ["catch", "waveclear"],
  41: ["teamfight", "catch", "scaling"], 42: ["scaling", "teamfight"], 43: ["push", "teamfight"], 44: ["scaling", "anti-physical"], 47: ["anti-magic", "anti-physical"],
  49: ["teamfight", "push"], 51: ["catch", "roam"], 52: ["waveclear", "teamfight"], 53: ["push", "roam"], 54: ["anti-magic", "scaling"],
  55: ["teamfight", "waveclear"], 59: ["anti-magic", "anti-physical"], 60: ["roam", "catch"], 63: ["anti-mobility", "scaling"], 64: ["waveclear", "teamfight"],
  65: ["catch", "teamfight"], 67: ["scaling", "anti-physical"], 68: ["anti-heal", "anti-magic"], 69: ["anti-magic", "teamfight"], 70: ["anti-physical", "scaling"],
  71: ["catch", "roam"], 74: ["waveclear", "catch", "teamfight"], 75: ["anti-magic", "catch"], 76: ["anti-magic", "scaling"], 77: ["push", "scaling"],
  78: ["teamfight", "anti-magic"], 79: ["save", "anti-magic"], 80: ["scaling", "push"], 81: ["catch", "teamfight"], 83: ["save", "push"],
  84: ["anti-magic", "teamfight"], 86: ["catch", "anti-magic"], 87: ["catch", "teamfight"], 88: ["anti-magic", "catch"], 89: ["anti-illusion", "push"],
  90: ["waveclear", "push", "save"], 91: ["save", "scaling"], 92: ["push", "teamfight"], 93: ["anti-mobility", "scaling"], 94: ["anti-illusion", "scaling"],
  96: ["catch", "teamfight"], 97: ["teamfight", "catch"], 98: ["anti-melee", "teamfight"], 99: ["anti-melee", "teamfight"], 100: ["catch", "roam"],
  101: ["catch", "anti-magic"], 102: ["save", "anti-physical"], 103: ["teamfight", "anti-physical"], 104: ["catch", "anti-physical"], 105: ["push", "anti-mobility"],
  106: ["catch", "waveclear"], 107: ["catch", "roam"], 108: ["teamfight", "push"], 109: ["scaling", "anti-illusion"], 110: ["save", "teamfight"],
  111: ["save", "anti-magic"], 112: ["save", "teamfight"], 113: ["scaling", "push"], 114: ["anti-mobility", "scaling"], 115: ["catch", "teamfight"],
  116: ["catch", "teamfight"], 117: ["catch", "teamfight"], 118: ["catch", "waveclear"], 119: ["catch", "roam"], 120: ["teamfight", "anti-magic", "push"],
  121: ["teamfight", "catch"], 122: ["save", "teamfight"], 123: ["catch", "save"], 124: ["teamfight", "catch"], 125: ["anti-magic", "scaling"],
};

const threatTags: Record<number, TacticTag[]> = {
  1: ["scaling", "anti-magic"], 6: ["scaling", "anti-mobility"], 12: ["anti-illusion", "scaling"], 17: ["catch", "roam"], 22: ["waveclear", "anti-magic"],
  32: ["roam", "anti-mobility"], 41: ["teamfight", "catch"], 44: ["scaling", "anti-physical"], 47: ["anti-magic", "anti-physical"], 53: ["push", "roam"],
  67: ["scaling", "anti-physical"], 74: ["waveclear", "catch"], 80: ["scaling", "push"], 89: ["anti-illusion", "push"], 90: ["waveclear", "push"], 93: ["anti-mobility"],
  94: ["anti-illusion", "scaling"], 97: ["teamfight", "catch"], 106: ["catch", "roam"], 109: ["scaling", "anti-illusion"], 113: ["scaling", "push"], 114: ["anti-mobility", "scaling"],
  116: ["catch", "teamfight"], 120: ["teamfight", "push"], 121: ["teamfight", "catch"], 124: ["teamfight", "catch"],
};

const pairSynergy: Record<number, number[]> = {
  41: [13, 86, 117, 120], 44: [5, 26, 90, 97], 67: [5, 68, 90], 74: [5, 17, 86, 90], 90: [5, 41, 44, 67, 120],
  97: [44, 67, 90, 120], 104: [5, 17, 41, 90], 110: [41, 44, 74], 120: [41, 44, 74, 97], 122: [44, 67, 90],
};

const tacticCopy: Partial<Record<TacticTag, string>> = {
  catch: "Нужен надёжный catch, чтобы не отдавать темп мобильным целям",
  teamfight: "Собирает драку вокруг одного окна контроля",
  waveclear: "Быстро чистит опасные линии и защищает темп карты",
  save: "Даёт команде кнопку спасения перед главным burst",
  push: "Конвертирует выигранную драку в вышки и контроль карты",
  scaling: "Сохраняет план на позднюю игру, если старт не идеален",
  "anti-heal": "Снижает ценность лечения и длительных разменов",
  "anti-mobility": "Наказывает рывки, невидимость и split-перемещения",
  "anti-illusion": "Не даёт иллюзиям пережить массовый spell-пик",
  "anti-physical": "Смягчает физический burst и right-click угрозы",
  "anti-magic": "Есть ответ на магический burst и контроль",
  vision: "Требует активного вижена перед каждым smoke-выходом",
  roam: "Может создавать численное преимущество до появления core-предметов",
};

export function tagsFor(id: number) { return heroTactics[id] ?? []; }
function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }

export function strategyFit(candidateId: number, strategy: StrategyId) {
  const candidateTags = new Set(tagsFor(candidateId));
  const plan = STRATEGIES[strategy];
  const fulfilled = plan.wants.filter((tag) => candidateTags.has(tag)).length;
  const score = clamp((fulfilled / Math.max(1, plan.wants.length)) * 0.2 - (fulfilled === 0 ? 0.06 : 0), -0.06, 0.2);
  return { score, fulfilled, reason: fulfilled ? `Поддерживает стратегию «${plan.label}»: ${plan.short}` : `Не ломает стратегию «${plan.label}»` };
}

export function tacticalFit(candidateId: number, allies: DraftHero[], enemies: DraftHero[], targetRole: RoleId, strategy: StrategyId = "balanced") {
  const candidateTags = new Set(tagsFor(candidateId));
  const enemyTags = new Set(enemies.flatMap((enemy) => threatTags[enemy.id] ?? []));
  const allyTags = new Set(allies.flatMap((ally) => tagsFor(ally.id)));
  const directlyAnswered = [...enemyTags].filter((tag) => candidateTags.has(tag) || candidateTags.has(`anti-${tag.replace("anti-", "")}` as TacticTag)).length;
  const roleNeed: TacticTag[] = targetRole === 1 ? ["scaling", "anti-physical"] : targetRole === 2 ? ["catch", "waveclear"] : targetRole === 3 ? ["teamfight", "catch"] : ["save", "catch"];
  const fulfilledNeeds = roleNeed.filter((tag) => candidateTags.has(tag)).length;
  const explicitPairs = allies.filter((ally) => pairSynergy[candidateId]?.includes(ally.id)).length;
  const complementary = allies.reduce((sum, ally) => sum + (tagsFor(ally.id).some((tag) => (tag === "catch" && candidateTags.has("teamfight")) || (tag === "teamfight" && candidateTags.has("catch")) || (tag === "save" && candidateTags.has("scaling"))) ? 1 : 0), 0);
  const missingTeamTools = ["catch", "teamfight", "save", "push"].filter((tag) => !allyTags.has(tag as TacticTag) && candidateTags.has(tag as TacticTag)).length;
  const roleConflict = allies.filter((ally) => ally.role === targetRole).length;
  const strategic = strategyFit(candidateId, strategy);
  const score = clamp((explicitPairs * 0.18) + (complementary * 0.06) + (missingTeamTools * 0.045) + (fulfilledNeeds * 0.045) + (directlyAnswered * 0.05) + strategic.score - (roleConflict * 0.08), -0.28, 0.35);
  const actions = [...new Set([...enemyTags].filter((tag) => candidateTags.has(tag) || candidateTags.has(`anti-${tag.replace("anti-", "")}` as TacticTag)).map((tag) => tacticCopy[tag]).filter(Boolean))].slice(0, 2) as string[];
  const reasons = [
    ...allies.filter((ally) => pairSynergy[candidateId]?.includes(ally.id)).slice(0, 2).map((ally) => `Проверенная синергия с ${ally.shortName}`),
    ...actions,
    ...(strategy !== "balanced" ? [strategic.reason] : []),
  ];
  if (missingTeamTools > 0) reasons.push(`Закрывает дефицит команды: ${["catch", "teamfight", "save", "push"].filter((tag) => !allyTags.has(tag as TacticTag) && candidateTags.has(tag as TacticTag)).join(", ")}`);
  if (roleConflict > 0) reasons.push("У союзника уже заявлена эта позиция — проверьте распределение ролей");
  return { score, reasons: reasons.slice(0, 4), enemyTags: [...enemyTags], candidateTags: [...candidateTags] };
}
