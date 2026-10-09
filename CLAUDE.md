# japan-guide — «Япония», личный путеводитель к поездке

## Назначение

Личное приложение владельца к поездке в Японию (2027): свой справочник мест вместо разрозненных Plotline, сохранёнок Instagram/TikTok, списков Google Maps, Notion и Telegram. Разделы — Еда, Места (развлечения, достопримечательности), Шопинг (вкладки «Магазины» и «Что купить» — товары), Отели, Гайды (проездные, деньги, связь…), плюс «Входящие» для сырых ссылок. В разделе — лента категорий-фильтров (Рамен, Якинику, Тонкацу…): ни одна не выбрана — видно всё. Карточка места: фото, название, ближайшая станция.

Работает на **iPhone** (из Safari на экран «Домой») и **Windows** (установка из Edge/Chrome), данные — в Supabase, без сети всё открывается (включая скачанные фото). Можно пригласить людей: **администратор** правит, **зритель** только смотрит. ТЗ, архитектура, этапы и лог — `PROJECT.md`, читать перед крупной задачей.

## Стек

- Vite 8 + Preact 10 + TypeScript 7, PWA через `vite-plugin-pwa` (иконки из `public/icon.svg`, см. `pwa-assets.config.ts`). Каркас перенесён из `../life-planner`.
- Supabase — **тот же проект, что у «Планера»** (бесплатный проект засыпает через 7 дней простоя, «Планер» его будит). Таблицы `jp_members` (роли) и `jp_records` (все записи, `kind` + `data jsonb`), хранилище фото `jp-photos`, функция `jp-invite`. Схема и права — `supabase/schema.sql`.
- Dexie (IndexedDB) — локальная база, offline-first. Vitest — тесты. `sharp` — сжатие фото в CLI.
- Хостинг — GitHub Pages, деплой `.github/workflows/deploy.yml` при пуше в `main`.

## Команды

```
npm install
npm run dev        # дев-сервер (--host — открыть с телефона по IP в локальной сети)
npm run typecheck
npm test
npm run build      # dist/ + service worker + иконки
VITE_DEMO=1 npx vite build --outDir dist-demo   # демо без входа, с синтетическими местами (для скриншотов)
```

## Данные по просьбе владельца (scripts/japan.ts)

Владелец просит «добавь ресторан…», «разбери входящие», «перенеси из Notion» — делать через CLI, а не руками в SQL:

```
npm run japan -- places [--section food|fun|shop|hotel] [--category <ref>] [--city …]  |  show <ref>
npm run japan -- add-place --section food --name "…" [--category Рамен,Изакая] [--city Токио] [--name-ja …]
     [--station …] [--station-ja …] [--address …] [--hours …] [--price 1-4] [--maps <url>] [--source <url>,<url>]
     [--note …] [--photo <файл|url>] [--status want|been] [--fav]
npm run japan -- edit-place <ref> [те же поля] [--photo none] [--no-fav]  |  delete-place <ref>
npm run japan -- import <файл.json> [--yes] [--create-categories]     # без --yes — только предпросмотр
npm run japan -- items [--status want|note|bought] [--category <ref>]  |  show-item <ref>
npm run japan -- add-item --name "…" [--name-ja …] [--category Уход,Аптека] [--where "дрогери"] [--shop <ref>,<ref>]
     [--price "¥1,100"] [--note …] [--source <url>] [--photo <файл|url>] [--status want|note|bought]
npm run japan -- edit-item <ref> [те же поля] [--photo none]  |  delete-item <ref>
npm run japan -- categories [--section …|items] | add-category --section …|items --name … --emoji … | edit-category <ref> | delete-category <ref>
npm run japan -- guides | show-guide <ref> | add-guide --topic transport --title … --file <md> | edit-guide <ref> | delete-guide <ref>
npm run japan -- inbox [--all] | inbox-add "…" | inbox-done <ref> [--undo]
npm run japan -- members | invite --email … --role admin|viewer [--name …] | set-role <email> --role … | remove-member <email>
npm run japan -- setup                                                # владелец + стартовые категории (повторно безопасно)
```

- Формат `import`: массив мест или `{ "places": [...], "items": [...] }`. Место — объект `{section, name, category: "Рамен" | [...], city, nameJa, station, stationJa, address, hours, price (1–4 или "¥¥"), maps, source: [...], note, photo (url или файл), status, fav}`. Товар — `{name, nameJa, category, where, shops: ["название магазина из Шопинга"], price: "¥1,100", note, source: [...], photo, status: want|note|bought}`. Дубли (та же ссылка Maps или то же название в разделе и городе; у товаров — то же название или японское название) пропускаются. **Перед записью показать владельцу предпросмотр** (вывод без `--yes`).
- **Товары («Что купить»)** — запись `kind: 'item'` (`src/domain/items.ts`): статус «купить / на заметку / куплено», категории группы `items` (`Category.section = 'items'`), «где купить» текстом + ссылки на магазины из «Шопинга», фото упаковки (в `jp-photos/items/…`). Японское название — с упаковки (экран «Показать продавцу»: фото + 「この商品はありますか？」).
- Фото: CLI сжимает (1600 px + миниатюра 600 px) и грузит в `jp-photos`. Брать фото фасада/зала с сайта места или из карточки Google — для личного пользования; не нашлось — без фото (в приложении заглушка).
- Для каждого места дописывать: японское название, ближайшую станцию (рус. + яп.), город, категорию, ссылку Google Maps. Не выдумывать часы и цены — только из источника.
- `<ref>` — начало id или часть названия. Удаление — переспросить. Ключи (`SUPABASE_SECRET_KEY`, `SUPABASE_ACCESS_TOKEN`) — в `.env` (в .gitignore), скопированы из `../life-planner/.env`. Никогда не выводить, не коммитить.
- Облако: `npm run supabase -- schema | secrets | deploy | sql "…"` (`scripts/supabase-admin.ts`, Management API).

## Заметки

- **Репозиторий публичный.** Никаких личных данных (места владельца, почты участников, планы поездки) в коммитах. Данные — только в облаке; личное — `private/` (в .gitignore). Стартовые категории и демо-места в коде — общие, не личные.
- **Пользователь в России:** Cloudflare (и хостинги за ним) и Firebase не использовать. Supabase и GitHub Pages работают.
- **Общий origin с «Планером»** (`dange2345-dotcom.github.io`): у клиента Supabase свой `storageKey: 'jp-auth'`, выход — `signOut({ scope: 'local' })` (иначе вылетит и «Планер»), локальная база — `japan`, свои ключи localStorage с префиксом `jp:`.
- **Роли:** `owner` (владелец, один), `admin` (правит записи, приглашает), `viewer` (только смотрит). Сервер — RLS по `jp_role()`; клиент — `src/data/access.ts` (запись через `src/data/entities.ts` проверяет роль). Новых людей добавляет функция `jp-invite` (создаёт вход с временным паролем — регистрация в проекте закрыта) или `npm run japan -- invite`.
- **Фото:** на устройстве сжимаются (`src/lib/photos.ts`), грузятся в публичный `jp-photos` со случайными именами; service worker кэширует их (CacheFirst, кэш `jp-photos`), «Настройки → Скачать всё для офлайна» докачивает все заранее. `<img crossorigin="anonymous">` — иначе ответы «непрозрачные» и съедают квоту.
- Синхронизация — как в «Планере»: правка локально (`dirty`) → `jp_records` с `updated_at` (LWW, триггер); скачивание по курсору `server_updated_at`. Удаление = `deleted = true`.
- Структура: `src/db` → `src/data` (все записи только здесь) → `src/sync` → `src/domain` (чистая логика: каталог разделов и категорий, фильтр/поиск/дубли, markdown гайдов; покрыта тестами, общая с CLI) → `src/screens`, `src/ui`.
- Гайды — простой markdown (`src/domain/markdown.ts`) разбирается в дерево и рисуется компонентами, без innerHTML. Ссылки — только http(s)/mailto/tel.
- Адрес экрана в hash: `#/food?cat=<id>&city=…&st=want|been|fav`, `#/place/<id>`, `#/items?cat=…&st=want|note|bought`, `#/item/<id>`, `#/guides`, `#/guide/<id>`, `#/search`, `#/inbox`, `#/settings`. Смена фильтра — `location.replace` (не засоряет «Назад»).
- iOS: только вход по паролю; флаги-эмодзи не использовать (Windows их не рисует). Правила «как родное приложение» — скилл `mobile-native`.
