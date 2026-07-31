# CounterPick

CounterPick — русскоязычный помощник драфта Dota 2. Он принимает союзников и
противников, выбирает пять контрпиков, учитывает синергию команды и показывает
сборку именно под выбранную позицию.

## Что есть

- позиции 1–5 и роли остальных героев;
- ally-aware рейтинг: pair-синергии, конфликт ролей и командные дефициты;
- пять контрпиков с уверенностью, sample, tactical read и причинами;
- role-safe builds: мид не получает саппортский core-шаблон;
- регистрация по email или телефону + пароль;
- feedback «использовали пик / не использовали» с контекстом драфта;
- тикеты с темой и описанием: закрыть может автор или администратор;
- админ-панель с драфтами, feedback и открытыми тикетами;
- D1-сохранение пользователей, сессий, драфтов и обращений;
- серверный монитор патча через Steam News API, endpoint `/api/updates` и
  scheduled-проверка каждые 6 часов;
- D2PT-адаптер остаётся выключенным без письменного разрешения источника.

## Локальный запуск — Linux

Требуется Node.js `>=22.13.0`.

```bash
git clone <repository-url>
cd ConterPick
npm ci
npm run dev
```

Откройте `http://localhost:3000`.

Локальный draft-анализ работает без D1. Для локальной проверки регистрации,
feedback и тикетов нужен Cloudflare D1 binding; в production Sites этот binding
уже подключён. Без D1 приложение корректно показывает ошибку сохранения, а не
теряет данные молча.

Проверка перед commit:

```bash
npm run lint
npm test
```

## Локальный запуск — Windows PowerShell

```powershell
git clone <repository-url>
Set-Location .\ConterPick
& 'C:\Program Files\nodejs\npm.cmd' ci
& 'C:\Program Files\nodejs\npm.cmd' run dev
```

Откройте `http://localhost:3000`.

Проверка:

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run lint
& 'C:\Program Files\nodejs\npm.cmd' test
```

Если Node установлен в PATH, можно использовать обычные `npm ci`, `npm run
dev`, `npm run lint` и `npm test`.

## Production

Сборка выполняется командой `npm run build`. D1-миграции находятся в
`drizzle/` и входят в Sites-архив. Для мониторинга обновлений сервер вызывает
официальный Steam News API и хранит последний успешный снимок в D1.

Публичный стенд: <https://counterpick.karabas225.chatgpt.site>
