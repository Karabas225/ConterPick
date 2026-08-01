/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEMO_ALLIES, DEMO_ENEMIES, ROLE_LABELS, heroImageCandidates, itemImage,
  searchHeroes, setCatalog, type DraftHero, type Hero, type RoleId,
} from "../lib/dota-data";
import { buildGuide, recommend, type BuildGuide, type EncounterMode, type Recommendation, type RecommendationMode } from "../lib/recommendation";
import { STRATEGIES, type StrategyId } from "../lib/tactics";
import AdminPanelDashboard from "./admin-panel";
import BrandMark from "./brand-mark";
import TicketDeskDashboard from "./ticket-desk";

type AppUser = { id: string; email: string | null; phone: string | null; displayName: string; role: string };
type FeedbackState = { used: boolean; note: string; status: string };
type UpdateState = {
  patch: string; status: string; checkedAt?: string | null; sourceUpdatedAt?: string | null;
  dataUpdatedAt?: string | null; buildsStatus?: string; buildsUpdatedAt?: string | null; lastError?: string | null;
};

const ENCOUNTERS: Array<{ id: EncounterMode; label: string; hint: string }> = [
  { id: "auto", label: "Авто", hint: "по ролям" },
  { id: "solo", label: "1×1", hint: "дуэль линии" },
  { id: "duo", label: "2×2", hint: "пара на линии" },
  { id: "trio", label: "3×3", hint: "ранняя стычка" },
  { id: "teamfight", label: "5×5", hint: "командный файт" },
];

function HeroAvatar({ hero, large = false }: { hero: Pick<Hero, "id" | "name" | "image">; large?: boolean }) {
  const sources = useMemo(() => heroImageCandidates(hero), [hero]);
  const [sourceIndex, setSourceIndex] = useState(0);
  useEffect(() => { setSourceIndex(0); }, [hero.id, hero.image]);
  const missing = sourceIndex >= sources.length;
  return <span className={`hero-avatar-wrap ${large ? "hero-avatar-large" : ""}`} aria-label={hero.name} title={hero.name}>
    {!missing && <img className="hero-avatar" src={sources[sourceIndex]} alt="" onError={() => setSourceIndex((value) => value + 1)} />}
    {missing && <span className="hero-avatar-fallback" aria-hidden="true">{hero.name.slice(0, 2).toUpperCase()}</span>}
  </span>;
}

function ItemVisual({ item, timing }: { item: string; timing?: string }) {
  const [missing, setMissing] = useState(false);
  useEffect(() => { setMissing(false); }, [item]);
  return <span className="item-visual" title={item}>
    {!missing ? <img src={itemImage(item)} alt="" onError={() => setMissing(true)} /> : <span className="item-fallback" aria-hidden="true">◇</span>}
    <span className="item-name">{item}</span>{timing && <b>{timing}</b>}
  </span>;
}

function Picker({ team, blocked, onAdd }: { team: "ally" | "enemy"; blocked: Set<number>; onAdd: (hero: Hero) => void }) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => searchHeroes(query).filter((hero) => !blocked.has(hero.id)), [query, blocked]);
  const add = (hero: Hero) => { onAdd(hero); setQuery(""); };
  return <div className="picker-wrap">
    <label className="picker-input-wrap"><span className="search-icon" aria-hidden="true">⌕</span>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Имя героя или русский ник…" aria-label={team === "enemy" ? "Добавить противника" : "Добавить союзника"} onKeyDown={(event) => {
        if (event.key === "Enter" && matches[0]) { event.preventDefault(); add(matches[0]); }
        if (event.key === "Escape") setQuery("");
      }} />
      <span className="key-hint">↵</span>
    </label>
    {query && <div className="picker-results" role="listbox">
      {matches.length ? matches.map((hero) => <button type="button" key={hero.id} onClick={() => add(hero)} role="option"><HeroAvatar hero={hero} /><span>{hero.name}</span><small>{hero.roles.map((role) => `P${role}`).join(" · ")}</small></button>) : <p>Не нашли героя. Попробуйте официальное имя, русский вариант или сокращение.</p>}
    </div>}
  </div>;
}

function Roster({ label, tone, heroes, max, blocked, onAdd, onRemove, onSetRole, onToggleLane }: {
  label: string; tone: "ally" | "enemy"; heroes: DraftHero[]; max: number; blocked: Set<number>; onAdd: (hero: Hero) => void;
  onRemove: (id: number) => void; onSetRole: (id: number, role?: RoleId) => void; onToggleLane: (id: number) => void;
}) {
  return <section className={`roster-panel ${tone}`}>
    <div className="panel-heading"><div><span className="eyebrow">{tone === "ally" ? "ВАША СТОРОНА" : "ПРОТИВНИКИ"}</span><h2>{label}</h2></div><span className="slot-count">{heroes.length}/{max}</span></div>
    <p className="roster-note">Укажите роль, а «линия» отметит участников ближайшей стычки.</p>
    <div className="roster-list">
      {heroes.map((hero) => <article className={`roster-chip ${hero.lane ? "on-lane" : ""}`} key={hero.id}>
        <HeroAvatar hero={hero} /><strong>{hero.name}</strong>
        <div className="chip-controls"><select className="role-select" aria-label={`Позиция ${hero.name}`} value={hero.role ?? ""} onChange={(event) => onSetRole(hero.id, event.target.value ? Number(event.target.value) as RoleId : undefined)}><option value="">P?</option>{([1, 2, 3, 4, 5] as RoleId[]).map((role) => <option key={role} value={role}>P{role}</option>)}</select>
          <button type="button" className="lane-toggle" aria-pressed={hero.lane === true} title={hero.lane ? "Убрать из ближайшей стычки" : "Участвует в ближайшей стычке"} onClick={() => onToggleLane(hero.id)}>⌁</button>
          <button type="button" className="remove-hero" aria-label={`Удалить ${hero.name}`} onClick={() => onRemove(hero.id)}>×</button>
        </div>
      </article>)}
      {heroes.length < max && <div className="empty-slot"><span>+</span><small>Свободный слот</small></div>}
    </div>
    {heroes.length < max && <Picker team={tone} blocked={blocked} onAdd={onAdd} />}
  </section>;
}

function StrategyPanel({ mode, strategy, encounter, onMode, onStrategy, onEncounter }: { mode: RecommendationMode; strategy: StrategyId; encounter: EncounterMode; onMode: (value: RecommendationMode) => void; onStrategy: (value: StrategyId) => void; onEncounter: (value: EncounterMode) => void }) {
  return <aside className="battle-controls" aria-label="Контекст рекомендации">
    <div className="mode-control"><span className="eyebrow">РЕЖИМ ПОДБОРА</span><div className="mode-options"><button type="button" className={mode === "tactical" ? "active" : ""} onClick={() => onMode("tactical")}><b>Тактический</b><small>Текущий: линия, стычка и стратегия</small></button><button type="button" className={mode === "classic" ? "active" : ""} onClick={() => onMode("classic")}><b>Классический</b><small>Прежний: matchup, союзники и мета</small></button></div></div>
    {mode === "tactical" ? <><div className="control-section"><span className="eyebrow">СЦЕНАРИЙ СТЫЧКИ</span><div className="encounter-options">{ENCOUNTERS.map((entry) => <button type="button" key={entry.id} className={encounter === entry.id ? "active" : ""} onClick={() => onEncounter(entry.id)}><b>{entry.label}</b><small>{entry.hint}</small></button>)}</div></div><label className="strategy-select"><span className="eyebrow">ПЛАН НА ИГРУ</span><select value={strategy} onChange={(event) => onStrategy(event.target.value as StrategyId)}>{Object.entries(STRATEGIES).map(([id, entry]) => <option key={id} value={id}>{entry.label}</option>)}</select><small>{STRATEGIES[strategy].short}</small></label></> : <p className="classic-mode-note">Классический режим повторяет прежнюю логику: без веса конкретной линии и выбранной стратегии. Рейтинг строится из matchup, синергии союзников и меты роли.</p>}
  </aside>;
}

function Guide({ guide }: { guide: BuildGuide }) {
  return <section className="guide-panel"><header className="guide-heading"><div><span className="eyebrow">PICK BUILD · {guide.role}</span><h4>Сборка под выбранную роль</h4><p>{guide.battlePlan}</p></div><div className="guide-meta"><b>{guide.rating ? `${guide.rating} rating` : guide.confidence}</b><small>{guide.sample ? `${guide.sample.toLocaleString("ru-RU")} матчей` : "роль-safe baseline"}</small></div></header>
    <div className="build-stages"><div><span className="build-label">СТАРТ</span><div className="item-shelf">{guide.starting.map((item, index) => <ItemVisual item={item} key={`${item}-${index}`} />)}</div></div><div><span className="build-label">РАННЯЯ ИГРА</span><div className="item-shelf">{guide.early.map((item, index) => <ItemVisual item={item} key={`${item}-${index}`} />)}</div></div></div>
    <div className="core-build"><span className="build-label">CORE · В ПОРЯДКЕ ТАЙМИНГОВ</span><div className="item-shelf item-shelf-core">{guide.core.map((entry, index) => <ItemVisual item={entry.item} timing={entry.timing} key={`${entry.item}-${index}`} />)}</div></div>
    <div className="guide-split"><div><span className="build-label">СИТУАТИВНО ПРОТИВ ДРАФТА</span>{guide.situational.map((entry, index) => <div className="situational-item" key={`${entry.item}-${index}`}><ItemVisual item={entry.item} /><p><b>{entry.reason}</b>{entry.lift && <small>Приоритет: {entry.lift}</small>}</p></div>)}</div><div><span className="build-label">СКИЛЛЫ И ТАЛАНТЫ</span><div className="skill-order">{guide.skills.map((skill, index) => <span key={`${skill}-${index}`}><b>{index + 1}</b>{skill}</span>)}</div><div className="talent-list">{guide.talents.map((talent) => <div className="talent-row" key={talent.level}><b>{talent.level}</b><span>{talent.text}</span></div>)}</div></div></div>
    <footer className="guide-source">Источник: {guide.source}</footer>
  </section>;
}

function RecommendationCard({ item, targetRole, guide, expanded, onExpand, feedback, onFeedback }: { item: Recommendation; targetRole: RoleId; guide?: BuildGuide; expanded: boolean; onExpand: () => void; feedback?: FeedbackState; onFeedback: (used: boolean, note: string) => void }) {
  const [note, setNote] = useState("");
  return <article className={`recommendation-card ${item.rank === 1 ? "top-pick" : ""}`}><div className="rank-badge">{item.rank === 1 ? "ЛУЧШИЙ ВЫБОР" : `#${item.rank}`}</div><div className="recommendation-main"><div className="portrait-frame"><HeroAvatar hero={{ id: item.heroId, name: item.heroName, image: item.heroImage }} large /></div><div className="recommendation-copy"><span className="eyebrow">P{targetRole} · {ROLE_LABELS[targetRole].toUpperCase()} · РЕАЛЬНЫЙ СЦЕНАРИЙ</span><h3>{item.heroName}</h3><p>{item.reasons[0]}</p><div className="confidence"><i className={item.confidence.toLowerCase()} />{item.confidence} уверенность · {item.sample ? `${item.sample.toLocaleString("ru-RU")} матчей` : "ограниченная выборка"}</div></div><div className="score-block"><strong>{item.score}</strong><span>/100</span></div></div>
    <div className="factor-row"><div><span>КОНТРПИК</span><b>{item.factors.counter}</b></div><div><span>СОЮЗНИКИ</span><b>{item.factors.synergy}</b></div><div><span>МЕТА РОЛИ</span><b>{item.factors.meta}</b></div></div>
    <div className="battle-read"><span>КАРТИНА БОЯ</span><p>{item.battle}</p></div><div className="reason-list">{item.reasons.slice(1).map((reason) => <span key={reason}>✦ {reason}</span>)}</div>
    <div className="pick-feedback"><span>Использовали этот пик?</span><button type="button" className={feedback?.used === true ? "selected" : ""} onClick={() => onFeedback(true, note)}>Да</button><button type="button" className={feedback?.used === false ? "selected muted" : ""} onClick={() => onFeedback(false, note)}>Нет</button><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Комментарий (необязательно)" />{feedback && <small role="status">{feedback.status}</small>}</div>
    <button type="button" className="guide-toggle" onClick={onExpand}>{expanded ? "Скрыть сборку" : "Открыть сборку для роли"}<span>{expanded ? "−" : "+"}</span></button>{expanded && guide && <Guide guide={guide} />}
  </article>;
}

function AuthCard({ user, onUser, onClose }: { user: AppUser | null; onUser: (user: AppUser | null) => void; onClose: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login"); const [identifier, setIdentifier] = useState(""); const [password, setPassword] = useState(""); const [displayName, setDisplayName] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async () => { setBusy(true); setError(""); try { const phone = /^\+?[\d\s()\-]{8,}$/.test(identifier); const response = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(mode === "login" ? { identifier, password } : { ...(phone ? { phone: identifier } : { email: identifier }), password, displayName }) }); const data = await response.json() as { user?: AppUser; error?: string }; if (!response.ok || !data.user) throw new Error(data.error ?? "Не удалось выполнить запрос"); onUser(data.user); onClose(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Не удалось выполнить запрос"); } finally { setBusy(false); } };
  if (user) return <div className="auth-popover"><div className="account-avatar">{user.displayName.slice(0, 1).toUpperCase()}</div><div><strong>{user.displayName}</strong><small>{user.email ?? user.phone}</small>{user.role === "admin" && <em>ADMIN ACCESS</em>}</div><button type="button" className="ghost-button" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); onUser(null); onClose(); }}>Выйти</button></div>;
  return <div className="auth-popover auth-form"><div className="auth-tabs"><button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Войти</button><button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Регистрация</button></div>{mode === "register" && <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Имя игрока" autoComplete="name" />}<input value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="Почта или телефон" autoComplete="username" /><input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Пароль · минимум 8 символов" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} /><button type="button" className="calculate-button" disabled={busy} onClick={() => void submit()}>{busy ? "Проверяем…" : mode === "login" ? "Войти" : "Создать аккаунт"}</button>{error && <small className="error-text">{error}</small>}</div>;
}

export default function Home() {
  const [targetRole, setTargetRole] = useState<RoleId>(2); const [allies, setAllies] = useState<DraftHero[]>(DEMO_ALLIES); const [enemies, setEnemies] = useState<DraftHero[]>(DEMO_ENEMIES); const [mode, setMode] = useState<RecommendationMode>("tactical"); const [strategy, setStrategy] = useState<StrategyId>("balanced"); const [encounter, setEncounter] = useState<EncounterMode>("auto");
  const initial = useMemo(() => recommend(DEMO_ALLIES, DEMO_ENEMIES, 2, {}, {}, { mode: "tactical", strategy: "balanced", encounter: "auto" }), []); const [recommendations, setRecommendations] = useState<Recommendation[]>(initial); const [expandedId, setExpandedId] = useState<number | null>(null); const [guides, setGuides] = useState<Record<number, BuildGuide>>({}); const [busy, setBusy] = useState(false); const [calcError, setCalcError] = useState("");
  const [eventId, setEventId] = useState<string | null>(null); const [feedback, setFeedback] = useState<Record<number, FeedbackState>>({}); const [user, setUser] = useState<AppUser | null>(null); const [authOpen, setAuthOpen] = useState(false); const [adminOpen, setAdminOpen] = useState(false); const [liveUpdate, setLiveUpdate] = useState<UpdateState | null>(null); const [catalogVersion, setCatalogVersion] = useState(0);
  const blocked = useMemo(() => new Set([...allies, ...enemies].map((hero) => hero.id)), [allies, enemies]);
  const orderedRecommendations = useMemo(() => [...recommendations].sort((left, right) => right.score - left.score || left.rank - right.rank), [recommendations]);
  const openAuth = () => { window.scrollTo({ top: 0, behavior: "smooth" }); window.setTimeout(() => setAuthOpen(true), 180); };
  useEffect(() => { const handleOpen = () => openAuth(); window.addEventListener("counterpick:open-auth", handleOpen); return () => window.removeEventListener("counterpick:open-auth", handleOpen); });
  useEffect(() => { void fetch("/api/auth/me").then((response) => response.json() as Promise<{ user?: AppUser | null }>).then((data) => setUser(data.user ?? null)).catch(() => undefined); void fetch("/api/updates").then((response) => response.json() as Promise<UpdateState>).then(setLiveUpdate).catch(() => undefined); void fetch("/api/catalog").then((response) => response.json() as Promise<{ heroes?: Hero[] }>).then((data) => { if (Array.isArray(data.heroes) && setCatalog(data.heroes)) setCatalogVersion((value) => value + 1); }).catch(() => undefined); }, []);
  const addHero = (team: "ally" | "enemy", hero: Hero) => { if (blocked.has(hero.id)) return; (team === "ally" ? setAllies : setEnemies)((current) => [...current, hero]); };
  const removeHero = (team: "ally" | "enemy", id: number) => (team === "ally" ? setAllies : setEnemies)((current) => current.filter((hero) => hero.id !== id));
  const setHeroRole = (team: "ally" | "enemy", id: number, role?: RoleId) => (team === "ally" ? setAllies : setEnemies)((current) => current.map((hero) => hero.id === id ? { ...hero, role } : hero));
  const toggleHeroLane = (team: "ally" | "enemy", id: number) => (team === "ally" ? setAllies : setEnemies)((current) => current.map((hero) => hero.id === id ? { ...hero, lane: !hero.lane } : hero));
  const draftPayload = () => ({ targetRole, allies: allies.map((hero) => ({ heroId: hero.id, role: hero.role, lane: hero.lane })), enemies: enemies.map((hero) => ({ heroId: hero.id, role: hero.role, lane: hero.lane })), mode, strategy, encounter });
  const updateStatus = (data: { patch?: string; updateStatus?: string; buildsStatus?: string; dataUpdatedAt?: string | null; buildsUpdatedAt?: string | null }) => { if (data.patch) setLiveUpdate((current) => ({ patch: data.patch!, status: data.updateStatus ?? current?.status ?? "ok", buildsStatus: data.buildsStatus, dataUpdatedAt: data.dataUpdatedAt, buildsUpdatedAt: data.buildsUpdatedAt })); };
  const calculate = async () => { if (!enemies.length || busy) return; setBusy(true); setCalcError(""); setExpandedId(null); setGuides({}); setRecommendations(recommend(allies, enemies, targetRole, {}, {}, { mode, strategy, encounter })); try { const response = await fetch("/api/recommendations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draftPayload()) }); const data = await response.json() as { recommendations?: Recommendation[]; eventId?: string | null; error?: string; patch?: string; updateStatus?: string; buildsStatus?: string; dataUpdatedAt?: string | null; buildsUpdatedAt?: string | null }; if (!response.ok) throw new Error(data.error ?? "Не удалось рассчитать драфт"); if (data.recommendations?.length) setRecommendations(data.recommendations); setEventId(data.eventId ?? null); updateStatus(data); document.querySelector("#results")?.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (error) { setCalcError(error instanceof Error ? error.message : "Не удалось рассчитать драфт"); } finally { setBusy(false); } };
  const toggleGuide = async (item: Recommendation) => { if (expandedId === item.heroId) { setExpandedId(null); return; } setExpandedId(item.heroId); const local = buildGuide(item.heroId, targetRole, enemies.map((hero) => hero.id), {}, { mode, strategy, encounter }); setGuides((current) => ({ ...current, [item.heroId]: current[item.heroId] ?? local })); try { const response = await fetch("/api/build-guide", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ heroId: item.heroId, targetRole, enemyHeroIds: enemies.map((hero) => hero.id), mode, strategy, encounter }) }); const data = await response.json() as { guide?: BuildGuide; patch?: string; updateStatus?: string; buildsStatus?: string; dataUpdatedAt?: string | null; buildsUpdatedAt?: string | null }; if (response.ok && data.guide) setGuides((current) => ({ ...current, [item.heroId]: data.guide! })); updateStatus(data); } catch { /* A role-safe local guide stays visible. */ } };
  const submitFeedback = async (item: Recommendation, used: boolean, note: string) => { try { const response = await fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId, heroId: item.heroId, used, note, context: { ...draftPayload(), rank: item.rank, score: item.score } }) }); setFeedback((current) => ({ ...current, [item.heroId]: { used, note, status: response.ok ? "Сохранено — спасибо за обратную связь" : "Войдите, чтобы сохранить выбор" } })); } catch { setFeedback((current) => ({ ...current, [item.heroId]: { used, note, status: "Не удалось сохранить ответ" } })); } };
  return <main className="site-shell" data-catalog-version={catalogVersion}><nav className="topbar"><a className="brand" href="#top" aria-label="CounterPick — наверх"><BrandMark /><span>COUNTER<span>PICK</span></span></a><div className="nav-links"><a href="#draft">Драфт</a><a href="#results">Рекомендации</a><a href="#support">Поддержка</a>{user?.role === "admin" && <button type="button" className="nav-button" onClick={() => setAdminOpen((value) => !value)}>Админ</button>}</div><div className="topbar-actions"><div className={`status-chip ${liveUpdate?.status === "error" ? "error" : ""}`}><span />PATCH {liveUpdate?.patch ?? "…"}</div><button type="button" className="account-button" onClick={() => setAuthOpen((value) => !value)}>{user ? user.displayName : "Войти"}</button>{authOpen && <AuthCard user={user} onUser={setUser} onClose={() => setAuthOpen(false)} />}</div></nav>
    <section className="hero-section" id="top"><div className="hero-copy"><span className="eyebrow accent">DRAFT INTELLIGENCE / 01</span><h1>Пик для<br /><em>реального боя.</em></h1><p>Укажите не только героев, но и ближайшую линию или стычку. CounterPick оценивает роль, союзные связки, контрпики и план на карту — вместо абстрактного боя 5 на 5.</p><div className="hero-meta"><span><b>1×1 — 5×5</b>контекст боя</span><span><b>5</b>вариантов ответа</span><span><b>24 ч</b>проверка меты</span></div></div><div className="hero-orbit"><div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" /><div className="orbit-core"><span className="core-kicker">PICK SIGNAL</span><strong>{orderedRecommendations[0]?.score ?? "—"}</strong><span>draft edge</span></div><span className="floating-token token-one">ROLE FIT</span><span className="floating-token token-two">LIVE META</span><span className="floating-token token-three">LANE READ</span></div></section>
    <section className="draft-section" id="draft"><div className="section-intro"><div><span className="eyebrow accent">DRAFT BOARD / 02</span><h2>Соберите ситуацию на карте</h2></div><p>{mode === "tactical" ? "Отметьте участников конкретной линии кнопкой «⌁». Если их не отмечать, модель использует роли и общий драфт." : "Классический режим повторяет прежнюю модель и оценивает весь драфт без сценария отдельной линии."}</p></div><StrategyPanel mode={mode} strategy={strategy} encounter={encounter} onMode={setMode} onStrategy={setStrategy} onEncounter={setEncounter} /><div className="draft-board"><Roster label="Союзники" tone="ally" heroes={allies} max={4} blocked={blocked} onAdd={(hero) => addHero("ally", hero)} onRemove={(id) => removeHero("ally", id)} onSetRole={(id, role) => setHeroRole("ally", id, role)} onToggleLane={(id) => toggleHeroLane("ally", id)} /><div className="draft-center"><div className="versus-mark">VS</div><div className="role-selector"><span className="eyebrow">ВАША ПОЗИЦИЯ</span><div className="role-options">{([1, 2, 3, 4, 5] as RoleId[]).map((role) => <button type="button" className={targetRole === role ? "active" : ""} key={role} onClick={() => setTargetRole(role)}><b>{role}</b><span>{ROLE_LABELS[role]}</span></button>)}</div></div><button type="button" className="calculate-button" disabled={!enemies.length || busy} onClick={() => void calculate()}><span>{busy ? "Считываем ситуацию…" : "Рассчитать контрпики"}</span><b>→</b></button><small className="calc-note">{enemies.length ? mode === "tactical" ? `${enemies.length} противн. · ${allies.filter((hero) => hero.lane).length + 1} союзн. в линии` : `${enemies.length} противн. · классический рейтинг` : "Добавьте хотя бы одного противника"}</small>{calcError && <small className="error-text">{calcError}</small>}</div><Roster label="Противники" tone="enemy" heroes={enemies} max={5} blocked={blocked} onAdd={(hero) => addHero("enemy", hero)} onRemove={(id) => removeHero("enemy", id)} onSetRole={(id, role) => setHeroRole("enemy", id, role)} onToggleLane={(id) => toggleHeroLane("enemy", id)} /></div></section>
    <section className="results-section" id="results"><header className="results-header"><div><span className="eyebrow accent">RECOMMENDATIONS / 03</span><h2>Ответы по силе пика</h2><p>Список отсортирован по итоговому рейтингу: контрпик, союзники, мета роли и выбранная стратегия.</p></div><div className="results-status"><span className={`live-dot ${liveUpdate?.status === "error" ? "error" : ""}`} /> {liveUpdate?.status === "error" ? "Источник временно недоступен — показан последний снимок" : liveUpdate ? `Патч ${liveUpdate.patch} · ${liveUpdate.buildsStatus === "fresh" ? "pro-сборки обновлены" : "сборки проверяются"}` : "Загружаем статус данных…"}<small>{liveUpdate?.dataUpdatedAt ? `Мета обновлена ${new Date(liveUpdate.dataUpdatedAt).toLocaleString("ru-RU")}` : "Valve · OpenDota · разрешённые pro-источники"}</small></div></header><div className="results-grid">{orderedRecommendations.map((item) => <RecommendationCard key={item.heroId} item={item} targetRole={targetRole} expanded={expandedId === item.heroId} onExpand={() => void toggleGuide(item)} guide={guides[item.heroId]} feedback={feedback[item.heroId]} onFeedback={(used, note) => void submitFeedback(item, used, note)} />)}</div><div className="data-strip"><div><b>Роль и линия</b><span>Вес ×1,5 получают явно отмеченные прямые соперники и участники стычки.</span></div><div><b>Союзные пики</b><span>Модель ищет реальные связки, недостающий контроль, сейв и конфликт ролей.</span></div><div><b>Pro-данные</b><span>Мета, матчи и ролевые сборки обновляются в снимке без выдуманной статистики.</span></div></div></section>
    {adminOpen && user?.role === "admin" && <AdminPanelDashboard onClose={() => setAdminOpen(false)} />}
    <section className="how-section" id="how"><div><span className="eyebrow accent">КАК ЧИТАТЬ РЕЗУЛЬТАТ / 04</span><h2>Не только победить линию.<br /><em>Закрыть план команды.</em></h2></div><div className="how-grid"><div><b>01</b><h3>Сначала стычка</h3><p>Выберите формат боя и отметьте участвующих героев. Так мид не смешивается с чужим лайном.</p></div><div><b>02</b><h3>Потом команда</h3><p>Контрпик получает балл за синергию с союзниками и за инструменты, которых не хватает составу.</p></div><div><b>03</b><h3>Затем сборка</h3><p>Гайд жёстко привязан к позиции. Предметы саппорта не попадут в core мидера или керри.</p></div></div></section>
    <section className="support-section" id="support"><div className="support-grid"><TicketDeskDashboard user={user} onOpenAuth={openAuth} /><div className="account-callout"><span className="eyebrow accent">PLAYER PROFILE</span><h3>{user ? `С возвращением, ${user.displayName}` : "Сохраняйте свои решения"}</h3><p>{user ? "Отзывы и обращения привязаны к вашему профилю." : "Войдите по почте или телефону, чтобы отправлять фидбек, смотреть тикеты и помогать улучшать рекомендации."}</p><button type="button" className="calculate-button" onClick={openAuth}>{user ? "Открыть профиль" : "Войти / зарегистрироваться"}</button></div></div></section>
    <footer><div className="brand"><BrandMark /><span>COUNTER<span>PICK</span></span></div><span>Драфт на шаг впереди.</span><span className="footer-note">Dota 2 data intelligence · by Karabas</span></footer>
  </main>;
}
