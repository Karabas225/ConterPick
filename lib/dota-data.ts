export type RoleId = 1 | 2 | 3 | 4 | 5;

export type Hero = {
  id: number;
  name: string;
  shortName: string;
  roles: RoleId[];
  image: string;
  aliases: string[];
};

export type DraftHero = Hero & { role?: RoleId };

const heroNames = [
  [1, "Anti-Mage", [1]], [2, "Axe", [3]], [3, "Bane", [4, 5]],
  [4, "Bloodseeker", [1, 3]], [5, "Crystal Maiden", [4, 5]], [6, "Drow Ranger", [1]],
  [7, "Earthshaker", [3, 4]], [8, "Juggernaut", [1]], [9, "Mirana", [4]],
  [10, "Morphling", [1]], [11, "Shadow Fiend", [1, 2]], [12, "Phantom Lancer", [1]],
  [13, "Puck", [2]], [14, "Pudge", [3, 4, 5]], [15, "Razor", [1, 2, 3]],
  [16, "Sand King", [3, 4]], [17, "Storm Spirit", [2]], [18, "Sven", [1, 3]],
  [19, "Tiny", [2, 3, 4]], [20, "Vengeful Spirit", [4, 5]], [21, "Windranger", [2, 3, 4]],
  [22, "Zeus", [2, 4]], [23, "Kunkka", [2, 3]], [25, "Lina", [1, 2, 4]],
  [26, "Lion", [4, 5]], [27, "Shadow Shaman", [4, 5]], [28, "Slardar", [3]],
  [29, "Tidehunter", [3]], [30, "Witch Doctor", [5]], [31, "Lich", [5]],
  [32, "Riki", [1, 4]], [34, "Tinker", [2, 4]], [35, "Sniper", [1, 2]],
  [36, "Necrophos", [2, 3]], [38, "Beastmaster", [3]], [39, "Queen of Pain", [2]],
  [40, "Venomancer", [3, 4]], [41, "Faceless Void", [1]], [42, "Wraith King", [1, 3]],
  [43, "Death Prophet", [2, 3, 4]], [44, "Phantom Assassin", [1]], [46, "Templar Assassin", [1, 2]],
  [47, "Viper", [2, 3]], [48, "Luna", [1]], [49, "Dragon Knight", [2, 3]],
  [50, "Dazzle", [4, 5]], [51, "Clockwerk", [3, 4]], [52, "Leshrac", [2, 3, 4]],
  [53, "Nature's Prophet", [1, 2, 3, 4]], [54, "Lifestealer", [1]], [55, "Dark Seer", [3]],
  [56, "Clinkz", [1, 2]], [58, "Enchantress", [4, 5]], [59, "Huskar", [2, 3]],
  [60, "Night Stalker", [2, 3]], [61, "Broodmother", [2, 3]], [62, "Bounty Hunter", [4]],
  [63, "Weaver", [1, 4]], [64, "Jakiro", [4, 5]], [65, "Batrider", [2, 3, 4]],
  [67, "Spectre", [1]], [68, "Ancient Apparition", [5]], [69, "Doom", [3]],
  [70, "Ursa", [1, 2]], [71, "Spirit Breaker", [4]], [72, "Gyrocopter", [1, 4]],
  [73, "Alchemist", [1, 2, 3]], [74, "Invoker", [2, 4]], [75, "Silencer", [4, 5]],
  [76, "Outworld Destroyer", [2]], [77, "Lycan", [1, 3]], [78, "Brewmaster", [3]],
  [79, "Shadow Demon", [4, 5]], [80, "Lone Druid", [1, 2, 3]], [81, "Chaos Knight", [1, 3]],
  [83, "Treant Protector", [4, 5]], [84, "Ogre Magi", [4, 5]], [85, "Omniknight", [3, 5]],
  [86, "Rubick", [4, 5]], [87, "Disruptor", [4, 5]], [88, "Nyx Assassin", [3, 4]],
  [89, "Naga Siren", [1, 4]], [90, "Keeper of the Light", [2, 4, 5]], [91, "Io", [4, 5]],
  [92, "Visage", [3, 4]], [93, "Slark", [1]], [94, "Medusa", [1]],
  [95, "Troll Warlord", [1]], [96, "Centaur Warrunner", [3]], [97, "Magnus", [2, 3]],
  [98, "Timbersaw", [3]], [99, "Bristleback", [3]], [100, "Tusk", [3, 4]],
  [101, "Skywrath Mage", [4, 5]], [102, "Abaddon", [3, 5]], [103, "Elder Titan", [4, 5]],
  [104, "Legion Commander", [1, 3]], [105, "Techies", [4, 5]], [106, "Ember Spirit", [2]],
  [107, "Earth Spirit", [4]], [108, "Underlord", [3]], [109, "Terrorblade", [1]],
  [110, "Phoenix", [3, 4, 5]], [111, "Oracle", [5]], [112, "Winter Wyvern", [4, 5]],
  [113, "Arc Warden", [1, 2]], [114, "Monkey King", [1, 2, 3]], [115, "Dark Willow", [4, 5]],
  [116, "Pangolier", [2, 3]], [117, "Grimstroke", [4, 5]], [118, "Hoodwink", [4]],
  [119, "Void Spirit", [2, 3]], [120, "Snapfire", [2, 4, 5]], [121, "Mars", [2, 3]],
  [122, "Dawnbreaker", [1, 2, 3, 4]], [123, "Marci", [1, 3, 4, 5]], [124, "Primal Beast", [2, 3]],
  [125, "Muerta", [1, 2, 4]],
] as const;

const aliasMap: Record<string, string[]> = {
  "Anti-Mage": ["антимаг", "ам"], "Drow Ranger": ["дроу", "тракса"], "Shadow Fiend": ["сф"],
  "Phantom Lancer": ["пл"], "Queen of Pain": ["квопа"], "Crystal Maiden": ["цм"],
  "Nature's Prophet": ["фурион"], "Keeper of the Light": ["котл"], "Outworld Destroyer": ["од"],
  "Spirit Breaker": ["бара"], "Faceless Void": ["войd", "войoid"], "Ancient Apparition": ["аа"],
  "Winter Wyvern": ["виверна"], "Witch Doctor": ["вд"], "Treant Protector": ["треант"],
  "Vengeful Spirit": ["венга"], "Earthshaker": ["ес"],
};

function imageSlug(name: string) {
  return name.toLowerCase().replace(/['.]/g, "").replace(/\s+/g, "_");
}

export const CATALOG: Hero[] = heroNames.map(([id, name, roles]) => ({
  id, name, shortName: name, roles: [...roles] as RoleId[],
  image: "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/" + imageSlug(name) + ".png",
  aliases: [name.toLowerCase(), ...(aliasMap[name] ?? [])],
}));

export const ROLE_LABELS: Record<RoleId, string> = { 1: "Керри", 2: "Мид", 3: "Оффлейн", 4: "Саппорт", 5: "Хард саппорт" };
export const PATCH = "7.41e";
export function findHero(id: number) { return CATALOG.find((hero) => hero.id === id); }
export function searchHeroes(query: string, role?: RoleId) {
  const normalized = query.trim().toLowerCase();
  return CATALOG.filter((hero) => !role || hero.roles.includes(role)).filter((hero) => !normalized || hero.aliases.some((alias) => alias.includes(normalized))).slice(0, 8);
}
export const DEMO_ALLIES: DraftHero[] = [findHero(5)!];
export const DEMO_ENEMIES: DraftHero[] = [findHero(14)!, findHero(17)!, findHero(44)!];
export function serializeCatalog() { return { patch: PATCH, updatedAt: new Date().toISOString(), heroes: CATALOG }; }
