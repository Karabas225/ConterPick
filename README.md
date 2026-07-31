# CounterPick

CounterPick — русскоязычный помощник драфта Dota 2. Пользователь выбирает свою позицию, союзников и противников, после чего получает пять контрпиков с объяснением выбора и role-safe сборкой.

## Возможности

- до 4 союзников и 5 противников с поиском по английским и русским названиям;
- рейтинг из пяти контрпиков с уверенностью, sample size, matchup, ally fit и тактическими причинами;
- сборка только для выбранной позиции героя: стартовые, core и ситуационные предметы, навыки и таланты;
- регистрация и вход по email или телефону;
- отметка «использовал пик», комментарий и обратная связь;
- тикеты поддержки, которые может закрыть автор или администратор;
- админ-панель со статистикой, таблицами, feedback, тикетами и глобальным сообщением для пользователей;
- автоматическая тёмная тема, ручное переключение на светлую и кнопка возврата наверх;
- ежедневный мониторинг патча, меты и pro-сборок с кэшированием последнего успешного снимка.

## Стек и требования

- Node.js `>=22.13.0`;
- Next/vinext, React, TypeScript;
- SQLite через встроенный `node:sqlite` в self-host режиме;
- Nginx и systemd — только для Linux production.

Для запуска нужен исходящий HTTPS-доступ к Valve, Steam, OpenDota и разрешённому feed сборок. Без сети приложение использует последний сохранённый снимок или безопасный baseline и показывает статус `stale/error`.

## Быстрый запуск на Linux/macOS

```bash
git clone <repository-url>
cd ConterPick
npm ci
cp .env.example .env

# при необходимости отредактируйте .env
npm run dev
```

Откройте <http://localhost:3000>.

Production-проверка:

```bash
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
```

## Быстрый запуск на Windows PowerShell

```powershell
Set-Location .\ConterPick
& npm.cmd ci
Copy-Item .env.example .env
& npm.cmd run build
& npm.cmd run start -- --hostname 127.0.0.1 --port 3000
```

Если `npm` не найден, используйте путь к установленному Node.js, например `C:\Program Files\nodejs\npm.cmd`.

Не открывайте `dist` двойным кликом через `file://`: API, SSR и CSS работают через `npm run dev` или `npm run start`.

## Переменные окружения

Основной шаблон находится в [.env.example](.env.example). Файл `.env` не добавляется в Git.

| Переменная | Назначение |
|---|---|
| `SELF_HOST=1` | Включает SQLite self-host режим. |
| `SELF_HOST_DB_PATH` | Путь к SQLite, обычно `./data/counterpick.sqlite`. |
| `COUNTERPICK_ADMIN_EMAILS` | Email-адреса администраторов через запятую. |
| `D2PT_PERMISSION_CONFIRMED=1` | Включает разрешённый адаптер D2PT. Используйте `1` только при наличии письменного разрешения. |
| `DOTA_BUILD_FEED_URL` | Необязательный разрешённый JSON feed сборок. |
| `NEXT_PUBLIC_SITE_URL` | Публичный URL для metadata и Open Graph. |

Администратор создаёт обычный аккаунт с email из `COUNTERPICK_ADMIN_EMAILS`, затем входит в приложение. Отдельного пароля админки нет.

## API

- `GET /api/catalog` — каталог героев, русские псевдонимы, портреты и роли;
- `POST /api/recommendations` — расчёт пяти контрпиков:

```json
{
  "targetRole": 2,
  "allies": [{ "heroId": 1, "role": 1 }],
  "enemies": [{ "heroId": 23, "role": 2 }]
}
```

- `POST /api/build-guide` — сборка для `{ "heroId": 25, "targetRole": 2, "enemyHeroIds": [23] }`;
- `GET /api/updates` — патч, статус источников, время обновления меты и сборок;
- `GET /api/site-message` — активное глобальное сообщение;
- `POST /api/feedback` — feedback по рекомендованному герою;
- `POST /api/tickets` и `PATCH /api/tickets/:id` — создание и закрытие тикетов.

Неизвестные герои, дубли и превышение лимитов возвращают структурированную ошибку.

## Обновление данных Dota 2

Production-скрипт `scripts/start-production.mjs` запускает обновление при старте и затем раз в 24 часа. В Cloudflare Worker предусмотрен scheduled refresh.

Источники:

1. официальный Valve Patch Notes;
2. Steam News как резервный источник патча;
3. OpenDota Hero Stats для меты и matchup;
4. D2PT `/meta` и `/builds` только при подтверждённом разрешении;
5. `DOTA_BUILD_FEED_URL` для разрешённого JSON feed.

Последний успешный снимок сохраняется в SQLite. При недоступности источника рекомендации не подменяются выдуманными данными.

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
```

## Структура

- `app/` — интерфейс и API routes;
- `lib/` — авторизация, SQLite/D1-адаптер, рейтинг, мониторинг и telemetry;
- `drizzle/` — миграции базы;
- `scripts/start-production.mjs` — self-host production server;
- `deploy/` — systemd и Nginx;
- `public/counterpick-logo.png` — логотип CounterPick.

## Важно

Проект некоммерческий. Использование данных D2PT должно соответствовать письменному разрешению и условиям источника. Не добавляйте `.env`, SQLite-файлы, `node_modules` и production-кеши в commit.

Автор: **Karabas**
