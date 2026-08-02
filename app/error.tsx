"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { document.title = "CounterPick — сервис временно недоступен"; }, []);
  return <main className="service-error-shell">
    <section className="service-error-card" role="alert" aria-live="assertive">
      <span className="eyebrow accent">SERVICE STATUS / 5XX</span>
      <div className="service-error-code">50<span>×</span></div>
      <h1>Сервис на короткой<br /><em>перезагрузке.</em></h1>
      <p>Мы не смогли обработать запрос. Данные драфта не потеряны — попробуйте ещё раз через несколько секунд.</p>
      <div className="service-error-actions">
        <button type="button" className="calculate-button" onClick={reset}>Повторить запрос <b>↻</b></button>
        <Link className="ghost-button" href="/">Вернуться к драфту</Link>
      </div>
      <small>COUNTERPICK / DOTA 2 DRAFT INTELLIGENCE · by Karabas</small>
    </section>
  </main>;
}
