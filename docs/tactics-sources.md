# Тактические источники

CounterPick использует не копирование страниц, а нормализованные tactical signals:

- [Dota2ProTracker Combos & Matchups](https://dota2protracker.com/combos) — lane duos, синергии, team combos и counter picks.
- [Dota Coach](https://dotacoach.gg/en) — power spikes, ability/item combos и советы по линии против конкретных героев.
- [Dotabuff Hero Guides](https://uk.dotabuff.com/blog/2015-07-31-dotabuff-hero-guides) — lane presence, teamfight participation, farm, item progression и ability builds.
- [STRATZ](https://stratz.com/) — hero composition и match-derived performance signals.

В модели эти идеи представлены тегами `catch`, `teamfight`, `waveclear`, `save`, `push`, `scaling`, `anti-mobility`, `anti-illusion`, `anti-physical`, `anti-magic`, `vision` и `roam`. D2PT-адаптер остаётся allowlist-gated и не включает scraping без отдельного разрешения правообладателя.
