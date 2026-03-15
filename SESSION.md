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
