# CounterPick

CounterPick — некоммерческий русскоязычный помощник драфта Dota 2. Пользователь выбирает свою позицию, союзников и противников, после чего получает пять контрпиков с объяснением выбора и сборкой именно под выбранную роль.

Проект рассчитан на самостоятельный запуск на Linux или Windows за Nginx/Apache/reverse proxy. Папка `.openai` и связанные с ней настройки удалены: приложение не требует ChatGPT-hosting и запускается как обычный Node.js-сервис.

## Возможности

- до 4 союзников и 5 противников с поиском по английским и русским названиям;
- пять рекомендаций с итоговым баллом, уверенностью, выборкой, matchup, ally fit и тактическими причинами;
- role-safe сборка: рекомендации предметов фильтруются по позиции героя и не подменяют саппорт-сборкой мидера;
- стартовые, ранние и core-предметы, ситуативные предметы, порядок навыков и таланты;
- регистрация и вход по email или телефону;
- отметка «использовал пик», комментарий и обратная связь;
- тикеты поддержки, которые может закрыть автор или администратор;
- админ-панель со статистикой, таблицами, feedback, тикетами и глобальным сообщением;
- автоматическая тёмная тема, ручное переключение на светлую и кнопка возврата наверх;
- ежедневный мониторинг патча, меты и pro-сборок при запуске и далее каждые 24 часа;
- отдельная адаптивная страница 404 в стиле CounterPick.

## Требования

- Node.js `>=22.13.0`;
- npm `>=10`;
- исходящий HTTPS-доступ к Valve, Steam, OpenDota и разрешённому feed сборок.

При недоступности источников приложение показывает последний успешный снимок и статус `stale/error`, не выдумывая новые рекомендации.

## Запуск локально на Linux/macOS

```bash
git clone <repository-url>
cd ConterPick
npm ci
cp .env.example .env
npm run dev
```

Откройте <http://localhost:3000>.

Проверка production-режима:

```bash
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
```

## Запуск локально на Windows PowerShell

```powershell
Set-Location .\ConterPick
& npm.cmd ci
Copy-Item .env.example .env
& npm.cmd run dev
```

Для production:

```powershell
& npm.cmd run build
& npm.cmd run start -- --hostname 127.0.0.1 --port 3000
```

Если PowerShell блокирует `npm.ps1`, используйте `npm.cmd` или готовые файлы:

```powershell
.\dev.cmd
.\build.cmd
.\start.cmd --hostname 127.0.0.1 --port 3000
```

Не открывайте `dist` двойным кликом через `file://`: API, SSR и CSS работают только через dev- или production-сервер.

## Переменные окружения

Шаблон находится в [.env.example](.env.example). Файл `.env` не добавляется в Git.

| Переменная | Назначение |
|---|---|
| `SELF_HOST=1` | Включает SQLite self-host режим. |
| `SELF_HOST_DB_PATH` | Путь к SQLite, обычно `./data/counterpick.sqlite`. |
| `COUNTERPICK_ADMIN_EMAILS` | Email администраторов через запятую. |
| `D2PT_PERMISSION_CONFIRMED=1` | Включает D2PT только при наличии письменного разрешения. |
| `DOTA_BUILD_FEED_URL` | Необязательный разрешённый JSON feed сборок. |
| `NEXT_PUBLIC_SITE_URL` | Публичный URL для metadata и Open Graph. |

Администратор создаёт обычный аккаунт с email из `COUNTERPICK_ADMIN_EMAILS`, затем входит в приложение. Отдельного пароля админки нет.

## Данные и обновления

Production-скрипт `scripts/start-production.mjs` вызывает обновление при старте и повторяет его раз в 24 часа. В Cloudflare Worker сохранён scheduled-хук с тем же интервалом.

Используемые источники:

1. официальные Valve Patch Notes;
2. Steam News как резервный источник патча;
3. OpenDota Hero Stats для меты и matchup;
4. D2PT `/meta` и `/builds` только при подтверждённом разрешении;
5. `DOTA_BUILD_FEED_URL` для разрешённого JSON feed.

Последний успешный снимок хранится в SQLite. Файл базы создаётся в `data/` и исключён из Git.

## API

- `GET /api/catalog` — каталог героев, русские псевдонимы, портреты и роли;
- `POST /api/recommendations` — расчёт пяти контрпиков;
- `POST /api/build-guide` — гайд для `{ heroId, targetRole, enemyHeroIds }`;
- `GET /api/updates` — текущий патч, статусы источников и время обновления;
- `GET /api/site-message` — активное глобальное сообщение;
- `POST /api/feedback` — feedback по рекомендованному герою;
- `POST /api/tickets` и `PATCH /api/tickets/:id` — создание и закрытие тикетов;
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout` — аккаунты.

Неизвестные герои, дубли и превышение лимитов возвращают структурированную ошибку.

## Production: Linux + systemd + Nginx

Шаблоны находятся в `deploy/systemd/counterpick.service` и `deploy/nginx/counterpick.conf`.

```bash
sudo mkdir -p /opt/counterpick
sudo chown -R counterpick:counterpick /opt/counterpick
cd /opt/counterpick
npm ci
npm run build

sudo cp deploy/systemd/counterpick.service /etc/systemd/system/counterpick.service
sudo cp deploy/nginx/counterpick.conf /etc/nginx/sites-available/counterpick
# замените User, WorkingDirectory и server_name в шаблонах
sudo ln -s /etc/nginx/sites-available/counterpick /etc/nginx/sites-enabled/counterpick
sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl enable --now counterpick
sudo systemctl reload nginx
```

Сервис слушает `127.0.0.1:3000`, Nginx публикует сайт наружу. Перед обновлением приложения сделайте резервную копию `data/counterpick.sqlite`.

Для Windows production используйте `start.cmd` через NSSM, WinSW или планировщик задач, а Nginx настройте как reverse proxy на `127.0.0.1:3000`.

## Cloudflare Worker (необязательно)

Self-host запуск не требует Cloudflare-конфигурации. Если нужен Worker, bindings находятся в нейтральном файле [config/cloudflare.json](config/cloudflare.json):

```json
{
  "d1": "DB",
  "r2": null
}
```

Файл используется только `vite.config.ts` для локальной конфигурации Cloudflare Vite plugin. Изменяйте binding `d1`, если имя D1-базы в вашем Worker отличается.

## Проверка перед commit/deploy

```bash
npm ci
npm run lint
npm test
npm run build
```

После запуска проверьте:

```bash
curl -fsS http://127.0.0.1:3000/
curl -fsS http://127.0.0.1:3000/api/updates
curl -fsS http://127.0.0.1:3000/api/catalog
curl -i http://127.0.0.1:3000/unknown-route
```

Последний запрос должен вернуть HTTP `404` и фирменную страницу «Пик ушёл в туман».

## Структура

- `app/` — интерфейс, 404 и API routes;
- `lib/` — авторизация, SQLite/D1-адаптер, рейтинг, мониторинг и telemetry;
- `config/cloudflare.json` — необязательные Cloudflare bindings без платформенной папки;
- `drizzle/` — миграции базы;
- `scripts/start-production.mjs` — self-host production server;
- `deploy/` — systemd и Nginx;
- `public/counterpick-logo.png` — логотип CounterPick.

## Важно

Проект некоммерческий. Использование данных D2PT должно соответствовать письменному разрешению и условиям источника. Не добавляйте `.env`, SQLite-файлы, `node_modules` и production-кеши в commit.

Автор: **Karabas**
