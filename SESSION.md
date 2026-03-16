# MAVI 2.0 Dashboard — Сессии

## Vercel URL
Ожидает проверку после деплоя — пользователь откроет в Antigravity Browser.

## Репо
https://github.com/lowcostcleaning/mavi-dashboard-kosmos (git email: avtopilot72@bk.ru)

---

## 2026-03-15 (текущая сессия)

### Сделано
1. **Задачи (Tasks view)** — полный CRUD: создание, редактирование, статусы (new/assigned/in_progress/done/cancelled), фильтр по статусу и сотруднику, stat cards, приоритеты
2. **Онбординг-трекер** — карточки апартаментов на дашборде с прогрессбаром, модальное окно с чеклистом (8 шагов), сохранение в `apartments.notes` JSON, 3 демо-апартамента
3. **Фикс финотчёта** — `net profit` не находился из-за русских заголовков в Google Sheets. Добавлен fuzzy match для `Результат периода` / `чистый доход`
4. **Фикс модалки задач** — использовались несуществующие CSS-классы `lnd-modal-*`, заменены на `clean-card-overlay` + `clean-card-modal`
5. **Убраны лишние элементы** — кнопка Add Property, иконки bell/email/globe, поиск. AU аватар возвращён вправо
6. **Мобильная адаптация** — collapsible sidebar (68px icon-only), hamburger + overlay на мобилке, нижний таббар, bottom sheet модалки, responsive гриды
7. **Серверный iCal прокси** — `/api/ical.js` (Vercel serverless) вместо мёртвых публичных CORS прокси. localStorage кеш 30 мин + фоновый prefetch

### Проблемы обнаружены
- Все публичные CORS прокси мертвы: corsproxy.io→403, allorigins→522, corsproxy.org→redirect
- Airbnb iCal напрямую с сервера работает, из браузера — CORS blocked
- Решение: Vercel serverless `/api/ical.js`

### Ожидает проверки
- Деплой на Vercel — пользователь проверит брони через Antigravity Browser
- Мобильная адаптация — визуальная проверка на разных устройствах
- Онбординг CSS — стили добавлены, нужна визуальная проверка

---

## 2026-03-15 (сессия 2)

### Сделано
1. **Фикс броней (bookings) — спиннер не скрывался**
   - Симптом: вкладка "Брони" показывала спиннер "Загружаем календари..." вечно
   - Причина: фоновый prefetch (`setTimeout 300ms`) загружал iCal данные пока пользователь на другой вкладке → `bkLoaded = true`, но `bk-loading` спиннер не скрывался
   - При клике "Брони" срабатывал early-return в `loadBookings()` → `renderBookings()` рисовал таблицу, но спиннер оставался поверх
   - Фикс: в ветке `if (bkLoaded)` добавлены `bk-loading.style.display = 'none'` и обновление `bk-stat-apts`
   - Файл: `index.html` строка ~1942, коммит `3efeb6f`

### Состояние системы (проверено)
- Supabase `https://supabase.138.124.87.26.sslip.io` — работает, ~98 апартаментов с iCal ссылками
- Vercel `/api/ical` прокси — работает, отдаёт iCal за ~0.3-0.9с
- Все iCal URL — формат `https://www.airbnb.ru/calendar/ical/...ics`

---

## 2026-03-15 (сессия 3)

### Сделано
1. **Усилена загрузка броней из iCal (устойчивый fallback)**
   - В `fetchIcal()` добавлена цепочка источников:
     1) прямой iCal URL (если CORS разрешён),
     2) локальный `/api/ical`,
     3) удалённый `https://mavi-dashboard-kosmos.vercel.app/api/ical`,
     4) публичные прокси (`corsproxy`, `allorigins`, `r.jina.ai`)
   - Добавлена проверка ответа на валидный календарь (`BEGIN:VCALENDAR`).
2. **Fallback на stale cache**
   - Если сеть/прокси недоступны, берётся устаревший кеш iCal из `localStorage`, чтобы таблица броней не оставалась пустой.
3. **Частичные падения не ломают загрузку**
   - В `_doFetchBookings()` заменён `Promise.all` на `Promise.allSettled`, чтобы ошибки части квартир не останавливали остальные.

### Причина фикса
- Брони не грузились в окружениях, где `/api/ical` недоступен (например, запуск не через Vercel), а публичные CORS-прокси периодически недоступны.

### Изменённые файлы
- `index.html` (логика загрузки и fallback iCal)
- `SESSION.md` (документирование изменений)

---

## 2026-03-15 (сессия 4)

### Сделано
1. **Полная переработка загрузки iCal по образцу финкабинета**
   - Убран весь лишний код: localStorage кеш, Promise.any, батчинг по 6, stale cache fallback
   - `fetchIcal()` — последовательная цепочка прокси: `/api/ical` → `corsproxy.io` → `allorigins.win`
   - `_doFetchBookings()` — `Promise.all` без батчинга (как в финкабинете)
   - Shared `bkFetchPromise` — предотвращает дублирование запросов при фоновом prefetch + клике пользователя

2. **Разделение blocked/booked в iCal**
   - Airbnb отправляет "Not available" / "Unavailable" для заблокированных дат собственником
   - Добавлен `bkIsBlocked(summary)` — проверка по ключевым словам
   - Реальные брони — зелёные, blocked — серые пунктирные (`.bk-bar-blocked`)
   - Статистика считает только реальные брони

3. **Фикс вложенного скролла в таблице броней**
   - Убран `max-height: calc(100vh - 340px)` и `overflow-y: auto` с `.bk-table-wrap`
   - Добавлен sticky thead (`position: sticky; top: 0; z-index: 8`)
   - Corner cell z-index: 12

4. **Все изменения запушены на GitHub** (коммиты af09177, ca52276)

### Текущее состояние
- Брони загружаются через Vercel `/api/ical.js` прокси — работает стабильно
- 90+ апартаментов, параллельная загрузка через `Promise.all`
- Фоновый prefetch при загрузке страницы (`setTimeout 300ms`)
- Blocked даты визуально отличаются от реальных броней
- Таблица без вложенного скролла, заголовок sticky

### Ключевые файлы (что менялось)
- `index.html` — логика iCal (fetchIcal, parseIcalText, bkIsBlocked, loadBookings, renderBookings)
- `styles.css` — `.bk-bar-blocked`, `.bk-cell.bk-inside-blocked`, `.bk-table-wrap`, sticky thead
- `api/ical.js` — Vercel serverless прокси (скопирован из финкабинета `/api/proxy.js`)
- `vercel.json` — конфиг serverless функции (256MB, 15s timeout)

### Эталон для iCal
- Финкабинет (`~/Проекты/финкабинет/`) — рабочий проект с идентичным подходом к iCal
- `/api/proxy.js` — серверный прокси
- `/src/App.jsx` — `useManagerIcalEvents()` хук с `Promise.all`

### Что проверить
- Визуально на мобилке: sidebar collapse, нижний таббар, bottom sheet модалки
- Онбординг-трекер CSS: карточки прогресса на дашборде

---

## 2026-03-16 (сессия 5)

### Сделано
1. **Шрифты в карточках сотрудников** — заменены с Orbitron на Exo 2 (font-body) для читаемости:
   - `.emp-card-name`, `.emp-card-role` — карточки в гриде
   - `.emp-profile-name`, `.emp-profile-role`, `.emp-stat-value` — профиль/модалка
   - Аватар (инициалы) оставлен на Orbitron — там 1-2 буквы, нормально

2. **Уборки: исправлена проблема "не все отражаются"**
   - **Причина**: n8n воркфлоу "sync Лист1 → Supabase tasks" пропускал строки из Google Sheet если название апартамента не совпадало с базой Supabase (42 уникальных несовпадения: кириллица/латиница WS В→WS B, ORBI D-3902→Orbi D1 3902, BV A 0714 (147)→BV A 147 и т.д.)
   - **Решение**: n8n теперь вставляет ВСЕ строки, даже без совпадения — `apartment_id: null`, сырое название в `sheet_apt_name`
   - Добавлена колонка `sheet_apt_name` в таблицу `tasks` (Supabase)
   - В дашборде: уборки без апартамента показываются с жёлтой меткой и кнопкой "Сопоставить"
   - Модалка "Сопоставить апартамент" — поиск + клик → PATCH apartment_id в Supabase
   - Статистика: карточка "Без апартамента" показывается если есть несопоставленные
   - Скипаются нерелевантные строки: "выходной", "Офис", даты типа "26 мая"

### Ключевые изменения
- `index.html` — loadCleanings (select sheet_apt_name), renderDayDetail/renderRangeList/renderCleaningCard (кнопка сопоставления), match modal, updateCalStats (счётчик unmatched)
- `styles.css` — .cal-task-unmatched, .cal-match-btn, .match-apt-item
- n8n "sync Лист1 → Supabase tasks" — Фильтр строк (не пропускает aptNotFound), Upsert URL (добавлен sheet_apt_name)
- Supabase: ALTER TABLE tasks ADD COLUMN sheet_apt_name text

### Ожидает проверки
- n8n воркфлоу перезапустится через ~15 мин и подтянет ранее пропущенные строки
- Проверить что уборки без апартамента появились и кнопка "Сопоставить" работает
- Деплой на Vercel
