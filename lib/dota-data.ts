export type RoleId = 1 | 2 | 3 | 4 | 5;

export type Hero = {
  id: number;
  name: string;
  shortName: string;
  roles: RoleId[];
  image: string;
  aliases: string[];
};

const HERO_IMAGE_SLUGS: Record<number, string> = {
  1: "antimage", 11: "nevermore", 20: "vengefulspirit", 21: "windrunner", 22: "zuus",
  36: "necrolyte", 39: "queenofpain", 42: "skeleton_king", 51: "rattletrap", 53: "furion",
  54: "life_stealer", 60: "night_stalker", 62: "bounty_hunter", 68: "ancient_apparition",
  69: "doom_bringer", 71: "spirit_breaker", 76: "obsidian_destroyer", 80: "lone_druid",
  82: "meepo", 83: "treant", 85: "undying", 91: "wisp", 96: "centaur", 97: "magnataur",
  98: "shredder", 101: "skywrath_mage", 103: "elder_titan", 108: "abyssal_underlord",
  114: "monkey_king", 115: "dark_willow", 124: "primal_beast",
};
// Keep two official Steam CDN origins.  The first one is used in the catalog;
// HeroAvatar tries the second one automatically if a regional CDN edge is
// unavailable.  Hero 97 is named "magnataur" in Dota's internal files, not
// "magnus" — the explicit mapping above is therefore important.
const STEAM_HERO_IMAGE_ROOTS = [
  "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes",
  "https://cdn.akamai.steamstatic.com/apps/dota2/images/dota_react/heroes",
] as const;
const STEAM_HERO_IMAGE_ROOT = STEAM_HERO_IMAGE_ROOTS[0];
const STEAM_ITEM_IMAGE_ROOT = "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items";

/** A picked hero can be marked as taking part in the immediate lane/skirmish.
 * This is intentionally separate from the role: rotations and trilanes do not
 * always follow the default 2-1-2 layout. */
export type DraftHero = Hero & { role?: RoleId; lane?: boolean };

// OpenDota is the runtime source of truth. This complete fallback keeps the app
// usable when the provider is temporarily unavailable during startup.
const heroNames: Array<[number, string, RoleId[]]> = [
  [1,"Anti-Mage",[1]],[2,"Axe",[3]],[3,"Bane",[4,5]],[4,"Bloodseeker",[1,3]],[5,"Crystal Maiden",[4,5]],[6,"Drow Ranger",[1]],
  [7,"Earthshaker",[3,4]],[8,"Juggernaut",[1]],[9,"Mirana",[4]],[10,"Morphling",[1]],[11,"Shadow Fiend",[1,2]],[12,"Phantom Lancer",[1]],
  [13,"Puck",[2]],[14,"Pudge",[3,4,5]],[15,"Razor",[1,2,3]],[16,"Sand King",[3,4]],[17,"Storm Spirit",[2]],[18,"Sven",[1,3]],
  [19,"Tiny",[2,3,4]],[20,"Vengeful Spirit",[4,5]],[21,"Windranger",[2,3,4]],[22,"Zeus",[2,4]],[23,"Kunkka",[2,3]],[25,"Lina",[1,2,4]],
  [26,"Lion",[4,5]],[27,"Shadow Shaman",[4,5]],[28,"Slardar",[3]],[29,"Tidehunter",[3]],[30,"Witch Doctor",[5]],[31,"Lich",[5]],
  [32,"Riki",[1,4]],[33,"Enigma",[3,4]],[34,"Tinker",[2,4]],[35,"Sniper",[1,2]],[36,"Necrophos",[2,3]],[37,"Warlock",[5]],
  [38,"Beastmaster",[3]],[39,"Queen of Pain",[2]],[40,"Venomancer",[3,4]],[41,"Faceless Void",[1]],[42,"Wraith King",[1,3]],[43,"Death Prophet",[2,3,4]],
  [44,"Phantom Assassin",[1]],[45,"Pugna",[4,5]],[46,"Templar Assassin",[1,2]],[47,"Viper",[2,3]],[48,"Luna",[1]],[49,"Dragon Knight",[2,3]],
  [50,"Dazzle",[4,5]],[51,"Clockwerk",[3,4]],[52,"Leshrac",[2,3,4]],[53,"Nature's Prophet",[1,2,3,4]],[54,"Lifestealer",[1]],[55,"Dark Seer",[3]],
  [56,"Clinkz",[1,2]],[57,"Omniknight",[3,5]],[58,"Enchantress",[4,5]],[59,"Huskar",[2,3]],[60,"Night Stalker",[2,3]],[61,"Broodmother",[2,3]],
  [62,"Bounty Hunter",[4]],[63,"Weaver",[1,4]],[64,"Jakiro",[4,5]],[65,"Batrider",[2,3,4]],[66,"Chen",[5]],[67,"Spectre",[1]],
  [68,"Ancient Apparition",[5]],[69,"Doom",[3]],[70,"Ursa",[1,2]],[71,"Spirit Breaker",[4]],[72,"Gyrocopter",[1,4]],[73,"Alchemist",[1,2,3]],
  [74,"Invoker",[2,4]],[75,"Silencer",[4,5]],[76,"Outworld Destroyer",[2]],[77,"Lycan",[1,3]],[78,"Brewmaster",[3]],[79,"Shadow Demon",[4,5]],
  [80,"Lone Druid",[1,2,3]],[81,"Chaos Knight",[1,3]],[82,"Meepo",[2]],[83,"Treant Protector",[4,5]],[84,"Ogre Magi",[4,5]],[85,"Undying",[3,5]],
  [86,"Rubick",[4,5]],[87,"Disruptor",[4,5]],[88,"Nyx Assassin",[3,4]],[89,"Naga Siren",[1,4]],[90,"Keeper of the Light",[2,4,5]],[91,"Io",[4,5]],
  [92,"Visage",[3,4]],[93,"Slark",[1]],[94,"Medusa",[1]],[95,"Troll Warlord",[1]],[96,"Centaur Warrunner",[3]],[97,"Magnus",[2,3]],
  [98,"Timbersaw",[3]],[99,"Bristleback",[3]],[100,"Tusk",[3,4]],[101,"Skywrath Mage",[4,5]],[102,"Abaddon",[3,5]],[103,"Elder Titan",[4,5]],
  [104,"Legion Commander",[1,3]],[105,"Techies",[4,5]],[106,"Ember Spirit",[2]],[107,"Earth Spirit",[4]],[108,"Underlord",[3]],[109,"Terrorblade",[1]],
  [110,"Phoenix",[3,4,5]],[111,"Oracle",[5]],[112,"Winter Wyvern",[4,5]],[113,"Arc Warden",[1,2]],[114,"Monkey King",[1,2,3]],[115,"Dark Willow",[4,5]],
  [116,"Pangolier",[2,3]],[117,"Grimstroke",[4,5]],[118,"Hoodwink",[4]],[119,"Void Spirit",[2,3]],[120,"Snapfire",[2,4,5]],[121,"Mars",[2,3]],
  [122,"Dawnbreaker",[1,2,3,4]],[123,"Marci",[1,3,4,5]],[124,"Primal Beast",[2,3]],[125,"Muerta",[1,2,4]],[126,"Ringmaster",[4,5]],[127,"Kez",[1,2]],
  [128,"Largo",[3,4]],
];

const aliasMap: Record<string, string[]> = {
  "Anti-Mage": ["антимаг", "ам"], "Drow Ranger": ["дроу", "тракса"], "Shadow Fiend": ["сф"],
  "Phantom Lancer": ["пл"], "Queen of Pain": ["квопа"], "Crystal Maiden": ["цм"],
  "Nature's Prophet": ["фурион"], "Keeper of the Light": ["котл"], "Outworld Destroyer": ["од"],
  "Spirit Breaker": ["бара"], "Faceless Void": ["войd", "войоид"], "Ancient Apparition": ["аа"],
  "Winter Wyvern": ["виверна"], "Witch Doctor": ["вд"], "Treant Protector": ["треант"],
  "Vengeful Spirit": ["венга"], "Earthshaker": ["ес"], "Pugna": ["пугна"], "Undying": ["андинг"],
  "Ringmaster": ["рингмастер"], "Kez": ["кез"], "Largo": ["ларго"], "Warlock": ["варлок"],
  "Axe": ["акс", "топор"], "Bane": ["бейн"], "Bloodseeker": ["бладсикер", "бс"], "Bristleback": ["бристл", "бб"],
  "Broodmother": ["бруда", "бродмама"], "Centaur Warrunner": ["кент", "центавр"], "Chaos Knight": ["цк", "хаос кнайт"],
  "Clockwerk": ["клок", "клокверк"], "Dark Seer": ["дарк сир", "дс"], "Dark Willow": ["дарк виллоу", "виллоу"],
  "Dawnbreaker": ["давнбрейкер", "давн"], "Death Prophet": ["дп", "дез профет"], "Disruptor": ["дизраптор", "дисраптор"],
  "Doom": ["дум"], "Earth Spirit": ["земляной дух", "ерс", "еспирит"], "Ember Spirit": ["эмбер", "ембер", "эмбер спирит"],
  "Enigma": ["энигма", "эни"], "Faceless Void": ["фейслес войд", "фв", "войт", "воид"], "Grimstroke": ["грим", "гримстроук"],
  "Hoodwink": ["худвинк", "худвинка"], "Jakiro": ["джакиро", "жакиро"], "Juggernaut": ["джагер", "джагернаут", "джаг"],
  "Legion Commander": ["легионка", "лк", "легион"], "Lich": ["лич"], "Lifestealer": ["лайфстилер", "найкс", "наикс"],
  "Lina": ["лина"], "Lion": ["лион", "лев"], "Lone Druid": ["лон друид", "лд", "медведь"], "Luna": ["луна"],
  "Magnus": ["магнус", "магн"], "Mars": ["марс"], "Medusa": ["медуза"], "Mirana": ["мирана", "мирана"],
  "Monkey King": ["манки кинг", "мк", "обезьяна"], "Morphling": ["морф", "морфлинг"], "Muerta": ["муэрта", "муерта"],
  "Naga Siren": ["нага", "нага сирена"], "Necrophos": ["некр", "некрофос"], "Night Stalker": ["нс", "найт сталкер", "сталкер"],
  "Nyx Assassin": ["никс", "nyx", "никс ассасин"], "Ogre Magi": ["огр", "огр маг"], "Omniknight": ["омник", "омнинайт"],
  "Oracle": ["оракл"], "Pangolier": ["панго", "пангольер"], "Phantom Assassin": ["па", "фантомка"],
  "Phoenix": ["феникс"], "Primal Beast": ["праймал", "пб", "праймал бист"], "Puck": ["пак", "пук"], "Pudge": ["пудж", "падж"],
  "Queen of Pain": ["квоп", "квин оф пейн"], "Razor": ["рейзор", "разор"], "Rubick": ["рубик"],
  "Sand King": ["ск", "санд кинг"], "Shadow Demon": ["шд", "шадоу демон"], "Shadow Shaman": ["шаман", "рш", "шадоу шаман"],
  "Silencer": ["сайленсер", "сало"], "Skywrath Mage": ["скаймаг", "скай", "см"], "Slardar": ["слардар", "селедка"],
  "Slark": ["сларк"], "Snapfire": ["снапфаер", "снап", "бабка"], "Sniper": ["снайпер", "гном"], "Spectre": ["спектра", "спектре"],
  "Storm Spirit": ["шторм", "шторм спирит"], "Sven": ["свен"], "Techies": ["течис", "минер", "техис"],
  "Templar Assassin": ["та", "темпларка", "темплар ассасин"], "Terrorblade": ["террор", "тб", "терорблейд"],
  "Tidehunter": ["тайд", "тайдхантер"], "Timbersaw": ["тимбер", "тимберсо"], "Tinker": ["тинкер", "теч"],
  "Tiny": ["тини", "тайни"], "Troll Warlord": ["тролль", "трол"], "Tusk": ["туск", "бивень"],
  "Underlord": ["андерлорд", "питлорд"], "Ursa": ["урса", "медведь"], "Venomancer": ["веник", "веномансер"],
  "Viper": ["вайпер", "гадюка"], "Visage": ["визаж"], "Void Spirit": ["воид спирит", "войд спирит", "вс"],
  "Weaver": ["вивер", "виверна"], "Windranger": ["виндрейнджер", "вр", "виндра"], "Wraith King": ["вк", "врайт кинг", "скелет"],
  "Zeus": ["зевс", "зус"],
};

function imageSlug(name: string) {
  return name.toLowerCase().replace(/[.'-]/g, "").replace(/\s+/g, "_");
}

function imageFor(name: string, internalName?: string) {
  const slug = internalName?.replace(/^npc_dota_hero_/, "") || imageSlug(name);
  return `${STEAM_HERO_IMAGE_ROOT}/${slug}.png`;
}

export const CATALOG: Hero[] = heroNames.map(([id, name, roles]) => ({
  id, name, shortName: name, roles: [...roles], image: imageFor(name, HERO_IMAGE_SLUGS[id]), aliases: [name.toLowerCase(), ...(aliasMap[name] ?? [])],
}));

export type RemoteHeroRow = { id?: number | string; name?: string; localized_name?: string; roles?: string[]; img?: string; icon?: string };

function roleGuess(name: string, roles?: string[]): RoleId[] {
  const base = CATALOG.find((hero) => hero.name.toLowerCase() === name.toLowerCase());
  if (base) return base.roles;
  const tags = (roles ?? []).map((role) => role.toLowerCase());
  const result = new Set<RoleId>();
  if (tags.some((tag) => /carry|attack|jungler/.test(tag))) result.add(1);
  if (tags.some((tag) => /nuker|escape/.test(tag))) result.add(2);
  if (tags.some((tag) => /durable|initiator|pusher/.test(tag))) result.add(3);
  if (tags.some((tag) => /support|disabler/.test(tag))) { result.add(4); result.add(5); }
  return result.size ? [...result] : [1, 2, 3, 4, 5];
}

export function normalizeRemoteCatalog(input: unknown): Hero[] {
  const rows: RemoteHeroRow[] = Array.isArray(input) ? input as RemoteHeroRow[] : Object.entries((input ?? {}) as Record<string, RemoteHeroRow>).map(([id, row]) => ({ ...row, id: row?.id ?? id }));
  const normalized = rows.map((row) => {
    const id = Number(row.id); const name = String(row.localized_name ?? row.name ?? "").trim();
    if (!Number.isFinite(id) || !name) return null;
    const internal = String(row.name ?? "").replace(/^npc_dota_hero_/, "");
    const base = CATALOG.find((hero) => hero.id === id || hero.name.toLowerCase() === name.toLowerCase());
    // Provider image URLs are not stable across mirrors.  Prefer the official
    // Steam asset derived from the canonical Dota internal name so every
    // catalog refresh keeps the same valid portrait URL.
    const canonicalName = base?.name ?? name;
    const canonicalSlug = HERO_IMAGE_SLUGS[id] ?? internal;
    return { id, name, shortName: name, roles: roleGuess(name, row.roles), image: imageFor(canonicalName, canonicalSlug), aliases: [name.toLowerCase(), ...(aliasMap[name] ?? []), ...(base?.aliases ?? [])] } as Hero;
  }).filter((hero): hero is Hero => Boolean(hero));
  return [...new Map(normalized.map((hero) => [hero.id, hero])).values()].sort((a, b) => a.id - b.id);
}

export function setCatalog(next: Hero[]) {
  if (next.length < 100) return false;
  CATALOG.splice(0, CATALOG.length, ...next);
  return true;
}

export const ROLE_LABELS: Record<RoleId, string> = { 1: "Керри", 2: "Мид", 3: "Оффлейн", 4: "Саппорт", 5: "Хард саппорт" };
export const PATCH = "7.41e";
export function findHero(id: number) { return CATALOG.find((hero) => hero.id === id); }
export function heroImageCandidates(hero: Pick<Hero, "id" | "name" | "image">) {
  const officialSlug = HERO_IMAGE_SLUGS[hero.id] ?? imageSlug(hero.name);
  return [...new Set([hero.image, ...STEAM_HERO_IMAGE_ROOTS.map((root) => `${root}/${officialSlug}.png`)].filter(Boolean))];
}

const ITEM_IMAGE_SLUGS: Record<string, string> = {
  "Aghanim's Scepter": "ultimate_scepter", "Aghanim's Shard": "aghanims_shard", "Black King Bar": "black_king_bar",
  "Boots of Travel": "travel_boots", "Boots of Travel 2": "travel_boots_2", "Kaya and Sange": "kaya_and_sange",
  "Mage Slayer": "mage_slayer", "Blood Grenade": "blood_grenade", "Magic Stick": "magic_stick",
  "Magic Wand": "magic_wand", "Observer Ward": "ward_observer", "Sentry Ward": "ward_sentry",
  "Smoke of Deceit": "smoke_of_deceit", "Power Treads": "power_treads", "Phase Boots": "phase_boots",
  "Boots of Speed": "boots", "Linken's Sphere": "sphere",
  "Arcane Boots": "arcane_boots", "Tranquil Boots": "tranquil_boots", "Hurricane Pike": "hurricane_pike",
  "Lotus Orb": "lotus_orb", "Force Staff": "force_staff", "Glimmer Cape": "glimmer_cape",
  "Blink Dagger": "blink", "Blade Mail": "blade_mail", "Battle Fury": "bfury",
  "Quelling Blade": "quelling_blade", "Null Talisman": "null_talisman", "Iron Branch": "branches",
  "Heaven's Halberd": "heavens_halberd", "Pipe of Insight": "pipe", "Crimson Guard": "crimson_guard",
  "Spirit Vessel": "spirit_vessel", "Pavise": "pavise", "Solar Crest": "solar_crest",
};

/** Item CDN names are stable for common items. Unknown external feed names
 * still get a deterministic candidate and remain readable when an image fails. */
export function itemImage(item: string) {
  const clean = item.replace(/×\s*\d+|x\s*\d+/gi, "").trim();
  const slug = ITEM_IMAGE_SLUGS[clean] ?? clean.toLowerCase()
    .replace(/['.]/g, "").replace(/\s*&\s*/g, "_").replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  return `${STEAM_ITEM_IMAGE_ROOT}/${slug}.png`;
}
function searchKey(value: string) {
  return value.toLocaleLowerCase("ru-RU").normalize("NFKD")
    .replace(/[ё]/g, "е")
    .replace(/[^a-zа-я0-9]+/gi, "");
}

function editDistance(left: string, right: string) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) current[j] = Math.min(
      current[j - 1] + 1,
      previous[j] + 1,
      previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
    );
    for (let j = 0; j < current.length; j += 1) previous[j] = current[j];
  }
  return previous[right.length];
}

const KEYBOARD_MISTAKES: Record<string, string> = {
  q: "й", w: "ц", e: "у", r: "к", t: "е", y: "н", u: "г", i: "ш", o: "щ", p: "з",
  a: "ф", s: "ы", d: "в", f: "а", g: "п", h: "р", j: "о", k: "л", l: "д",
  z: "я", x: "ч", c: "с", v: "м", b: "и", n: "т", m: "ь",
};

function keyboardVariant(value: string) {
  return [...value].map((letter) => KEYBOARD_MISTAKES[letter] ?? letter).join("");
}

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};
function latinizedSearchKey(value: string) {
  return [...value].map((letter) => CYRILLIC_TO_LATIN[letter] ?? letter).join("");
}

/** Searches official names, common Russian names, abbreviations, likely
 * transliteration/keyboard mismatches and small typos. The fuzzy branch is
 * intentionally bounded so short queries do not produce unrelated heroes. */
export function searchHeroes(query: string, role?: RoleId) {
  const normalized = searchKey(query);
  const keyboard = keyboardVariant(normalized);
  const latinized = latinizedSearchKey(normalized);
  return CATALOG.filter((hero) => !role || hero.roles.includes(role)).map((hero) => {
    if (!normalized) return { hero, score: 2 };
    const aliases = [...hero.aliases, hero.name, hero.shortName].map(searchKey).filter(Boolean);
    const exact = aliases.some((alias) => alias === normalized);
    const prefix = aliases.some((alias) => alias.startsWith(normalized));
    const partial = aliases.some((alias) => alias.includes(normalized));
    const typo = normalized.length >= 4 && aliases.some((alias) => editDistance(alias, normalized) <= Math.max(1, Math.floor(normalized.length / 5)));
    const keyboardMatch = keyboard !== normalized && aliases.some((alias) => alias.startsWith(keyboard) || alias.includes(keyboard));
    const transliterated = latinized !== normalized && aliases.some((alias) => alias === latinized || alias.startsWith(latinized) || (latinized.length >= 4 && editDistance(alias, latinized) <= Math.max(1, Math.floor(latinized.length / 5))));
    return { hero, score: exact ? 0 : prefix ? 1 : partial ? 2 : typo ? 3 : keyboardMatch || transliterated ? 4 : 99 };
  }).filter((entry) => entry.score < 99).sort((a, b) => a.score - b.score || a.hero.name.localeCompare(b.hero.name)).slice(0, 8).map((entry) => entry.hero);
}
export const DEMO_ALLIES: DraftHero[] = [findHero(5)!];
export const DEMO_ENEMIES: DraftHero[] = [findHero(14)!, findHero(17)!, findHero(44)!];
export function serializeCatalog() { return { patch: PATCH, updatedAt: new Date().toISOString(), count: CATALOG.length, heroes: CATALOG }; }
