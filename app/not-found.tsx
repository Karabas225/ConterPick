import Link from "next/link";
import BrandMark from "./brand-mark";

export default function NotFound() {
  return (
    <main className="not-found-shell">
      <nav className="not-found-nav" aria-label="Навигация страницы ошибки">
        <Link className="brand" href="/" aria-label="CounterPick — на главную">
          <BrandMark />
          <span>COUNTER<span>PICK</span></span>
        </Link>
        <span className="not-found-status"><i /> CONNECTION LOST / 404</span>
      </nav>

      <section className="not-found-content" aria-labelledby="not-found-title">
        <div className="not-found-copy">
          <span className="eyebrow accent">DRAFT ERROR / 404</span>
          <h1 id="not-found-title">Пик ушёл<br /><em>в туман.</em></h1>
          <p>
            Эта страница не входит в текущий драфт. Возможно, ссылка устарела,
            герой уже забанен или маршрут просто потерялся на карте.
          </p>
          <div className="not-found-actions">
            <Link className="calculate-button" href="/">
              <span>Вернуться к драфту</span><b>↗</b>
            </Link>
            <Link className="ghost-button not-found-secondary" href="/#results">
              Открыть сборки
            </Link>
          </div>
          <div className="not-found-links" aria-label="Быстрые ссылки">
            <Link href="/#draft">Анализ драфта</Link>
            <Link href="/#support">Поддержка</Link>
            <Link href="/#how">Как это работает</Link>
          </div>
        </div>

        <div className="not-found-visual" aria-hidden="true">
          <div className="not-found-grid" />
          <div className="not-found-orbit orbit-a" />
          <div className="not-found-orbit orbit-b" />
          <div className="not-found-glow" />
          <div className="not-found-core">
            <span className="not-found-core-label">SIGNAL</span>
            <strong>404</strong>
            <span className="not-found-core-caption">NO ROUTE FOUND</span>
          </div>
          <span className="not-found-token token-alpha">RECALCULATE</span>
          <span className="not-found-token token-beta">MAP FOG</span>
          <span className="not-found-token token-gamma">GG?</span>
        </div>
      </section>

      <footer className="not-found-footer">
        <span>COUNTERPICK / DOTA 2 DRAFT INTELLIGENCE</span>
        <span>by Karabas</span>
      </footer>
    </main>
  );
}
