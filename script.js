document.addEventListener('DOMContentLoaded', function () {
    const charts = [];
    const now = new Date();
    const FINANCE_CSV = (window.__FINANCE_CSV__ || '').toString();

    function formatRuShortDate(d) {
        const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = months[d.getMonth()];
        const yyyy = d.getFullYear();
        return `${dd} ${mm} ${yyyy}`;
    }

    function formatRuDotDate(d) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}.${mm}.${yyyy}`;
    }

    // Set current date label in header
    const dateLabel = document.querySelector('.js-current-date');
    if (dateLabel) dateLabel.textContent = formatRuShortDate(now);

    // Update payment dates (today, yesterday, 2 days ago)
    const pay0 = document.querySelector('.js-pay-date-0');
    const pay1 = document.querySelector('.js-pay-date-1');
    const pay2 = document.querySelector('.js-pay-date-2');
    if (pay0) pay0.textContent = formatRuDotDate(now);
    if (pay1) pay1.textContent = formatRuDotDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    if (pay2) pay2.textContent = formatRuDotDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3));

    // ---- Financial report from CSV (embedded in finance-data.js) ----
    const finRevEl = document.querySelector('.js-fin-rev');
    const finOpRevEl = document.querySelector('.js-fin-oprev');
    const finNetEl = document.querySelector('.js-fin-net');
    const finOccEl = document.querySelector('.js-fin-occ');

    function formatGel(num) {
        const n = Number(num) || 0;
        const rounded = Math.round(n);
        try {
            return `${new Intl.NumberFormat('ru-RU').format(rounded)} GEL`;
        } catch {
            return `${rounded} GEL`;
        }
    }

    function parseMoney(s) {
        if (s == null) return 0;
        let t = String(s).trim();
        if (!t) return 0;
        t = t.replace(/\u00a0/g, '').replace(/\s+/g, ''); // remove spaces/NBSP
        if (/^-?\d+,\d+$/.test(t)) t = t.replace(',', '.');
        const n = Number(t);
        return Number.isFinite(n) ? n : 0;
    }

    function parseIntSafe(s) {
        if (s == null) return 0;
        const t = String(s).replace(/[^\d-]/g, '');
        const n = Number(t);
        return Number.isFinite(n) ? n : 0;
    }

    function parseDateDotted(s) {
        if (!s) return null;
        const m = String(s).match(/(\d{2})\.(\d{2})\.(\d{2,4})/);
        if (!m) return null;
        let year = Number(m[3]);
        if (year < 100) year += 2000;
        const month = Number(m[2]) - 1;
        const day = Number(m[1]);
        const d = new Date(year, month, day);
        return Number.isNaN(d.getTime()) ? null : d;
    }

    function parseCsvLine(line) {
        const out = [];
        let field = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) {
                if (ch === '"') {
                    if (line[i + 1] === '"') {
                        field += '"';
                        i++;
                        continue;
                    }
                    inQuotes = false;
                    continue;
                }
                field += ch;
                continue;
            }

            if (ch === '"') {
                inQuotes = true;
                continue;
            }

            if (ch === ',') {
                out.push(field);
                field = '';
                continue;
            }

            field += ch;
        }
        out.push(field);
        return out;
    }

    function normalizeHeader(h) {
        return String(h || '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    }

    function monthLabelRu(monthIndex) {
        const m = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
        return m[monthIndex] || 'Месяц';
    }

    function buildFinanceSeriesFromCsv(csvText) {
        const lines = String(csvText || '').replace(/\r\n/g, '\n').split('\n').filter(l => l.trim().length > 0);
        if (lines.length < 2) return null;

        const header = parseCsvLine(lines[0]);
        const idx = {};
        header.forEach((h, i) => { idx[normalizeHeader(h)] = i; });

        function findIndex(pred) {
            for (const [k, i] of Object.entries(idx)) {
                if (pred(k)) return i;
            }
            return -1;
        }

        const iDate = 0; // first column is date in this export
        const iMonth = findIndex(k => k === 'месяц' || k.includes('month'));
        const iListing = findIndex(k => k.includes('listing nickname') || k.includes('название апартамента'));
        const iRevenue = findIndex(k => k.includes('revenue / доход'));
        const iOccDays = findIndex(k => k.includes('количество занятых дней'));
        const iOpRevenue = findIndex(k => k.includes('operation revenue'));
        const iNet = findIndex(k => k.includes('net profit'));

        const groups = new Map(); // key -> agg

        for (let li = 1; li < lines.length; li++) {
            const row = parseCsvLine(lines[li]);
            if (row.length < 4) continue;
            const date = parseDateDotted(row[iDate]);
            const monthNum = iMonth >= 0 ? parseIntSafe(row[iMonth]) : (date ? (date.getMonth() + 1) : (now.getMonth() + 1));
            const year = date ? date.getFullYear() : now.getFullYear();
            const monthIndex = Math.max(0, Math.min(11, monthNum - 1));
            const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

            const listing = iListing >= 0 ? String(row[iListing] || '').trim() : '';
            const revenue = iRevenue >= 0 ? parseMoney(row[iRevenue]) : 0;
            const opRevenue = iOpRevenue >= 0 ? parseMoney(row[iOpRevenue]) : 0;
            const net = iNet >= 0 ? parseMoney(row[iNet]) : 0;
            const occDays = iOccDays >= 0 ? parseIntSafe(row[iOccDays]) : 0;

            if (!groups.has(key)) {
                groups.set(key, { year, monthIndex, revenue: 0, opRevenue: 0, net: 0, occDays: 0, listingCount: 0 });
            }
            const g = groups.get(key);
            g.revenue += revenue;
            g.opRevenue += opRevenue;
            g.net += net;
            g.occDays += occDays;
            if (listing) g.listingCount += 1;
        }

        const points = Array.from(groups.values()).sort((a, b) => (a.year - b.year) || (a.monthIndex - b.monthIndex));
        if (!points.length) return null;

        const labels = points.map(p => `${monthLabelRu(p.monthIndex)} ${p.year}`);
        const revenue = points.map(p => p.revenue);
        const opRevenue = points.map(p => p.opRevenue);
        const net = points.map(p => p.net);

        const latest = points[points.length - 1];
        const daysInMonth = new Date(latest.year, latest.monthIndex + 1, 0).getDate();
        const denom = Math.max(1, latest.listingCount * daysInMonth);
        const occ = (latest.occDays / denom) * 100;

        return { labels, revenue, opRevenue, net, latest, occPercent: occ };
    }

    // -- Mini Chart 1: Reserved --
    const ctxReserved = document.getElementById('chartReserved').getContext('2d');
    charts.push(new Chart(ctxReserved, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [11, 89],
                backgroundColor: ['#00f2ff', 'rgba(255, 255, 255, 0.05)'],
                borderWidth: 0,
                hoverOffset: 4,
                cutout: '70%'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } }
        }
    }));

    // -- Mini Chart 2: Total Bookings (Bar) --
    const ctxTotal = document.getElementById('chartTotal').getContext('2d');
    charts.push(new Chart(ctxTotal, {
        type: 'bar',
        data: {
            labels: ['1', '2', '3', '4', '5'],
            datasets: [{
                data: [20, 35, 40, 60, 50],
                backgroundColor: 'rgba(0, 242, 255, 0.7)',
                borderRadius: 5,
                hoverBackgroundColor: '#00f2ff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { display: false }, y: { display: false } }
        }
    }));

    // -- Mini Chart 3: Revenue (Bar) --
    const ctxRevenue = document.getElementById('chartRevenue').getContext('2d');
    charts.push(new Chart(ctxRevenue, {
        type: 'bar',
        data: {
            labels: ['1', '2', '3'],
            datasets: [{
                data: [30, 70, 45],
                backgroundColor: 'rgba(112, 0, 255, 0.7)',
                borderRadius: 5,
                hoverBackgroundColor: '#7000ff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { display: false }, y: { display: false } }
        }
    }));

    // -- Mini Chart 4: New Apartments (Bar) --
    const ctxNew = document.getElementById('chartNew').getContext('2d');
    charts.push(new Chart(ctxNew, {
        type: 'bar',
        data: {
            labels: ['1', '2', '3', '4', '5', '6'],
            datasets: [{
                data: [30, 50, 20, 40, 60, 30],
                backgroundColor: 'rgba(255, 204, 51, 0.7)',
                borderRadius: 5,
                hoverBackgroundColor: '#ffcc33'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { display: false }, y: { display: false } }
        }
    }));

    // -- Main Pie Chart: Application Status --
    const taskPercentEl = document.querySelector('.js-task-percent');
    const taskLegendWait = document.querySelector('.js-task-legend-wait');
    const taskLegendDoing = document.querySelector('.js-task-legend-doing');
    const taskLegendDone = document.querySelector('.js-task-legend-done');
    const taskTeamListEl = document.querySelector('.js-task-team-list');

    function getTaskStats() {
        const cards = Array.from(document.querySelectorAll('.kanban-card[data-status]'));
        const total = cards.length || 0;
        const counts = { wait: 0, doing: 0, done: 0 };
        const byAssignee = new Map(); // name -> { total, done }
        for (const c of cards) {
            const s = (c.getAttribute('data-status') || '').toLowerCase();
            if (s === 'wait') counts.wait++;
            else if (s === 'doing') counts.doing++;
            else if (s === 'done') counts.done++;

            const who = (c.getAttribute('data-assignee') || '').trim();
            if (who) {
                if (!byAssignee.has(who)) byAssignee.set(who, { total: 0, done: 0 });
                const a = byAssignee.get(who);
                a.total += 1;
                if (s === 'done') a.done += 1;
            }
        }
        const pct = (n) => total ? Math.round((n / total) * 100) : 0;
        return {
            total,
            counts,
            pctWait: pct(counts.wait),
            pctDoing: pct(counts.doing),
            pctDone: pct(counts.done),
            byAssignee
        };
    }

    function hydrateTaskChart(chart) {
        const s = getTaskStats();
        if (taskPercentEl) taskPercentEl.textContent = `${s.pctDone}%`;
        if (taskLegendWait) taskLegendWait.textContent = `В ожидании (${s.pctWait}%)`;
        if (taskLegendDoing) taskLegendDoing.textContent = `В работе (${s.pctDoing}%)`;
        if (taskLegendDone) taskLegendDone.textContent = `Готово (${s.pctDone}%)`;

        if (taskTeamListEl) {
            const items = Array.from(s.byAssignee.entries()).map(([name, st]) => {
                const pctDone = st.total ? Math.round((st.done / st.total) * 100) : 0;
                return { name, total: st.total, done: st.done, pctDone };
            }).sort((a, b) => (b.pctDone - a.pctDone) || (b.total - a.total) || a.name.localeCompare(b.name, 'ru'));

            taskTeamListEl.innerHTML = items.map(it => `
                <div class="task-team-item">
                    <div>
                        <div class="name">${it.name}</div>
                        <div class="meta">выполнено ${it.done} из ${it.total}</div>
                    </div>
                    <div class="right">${it.pctDone}%</div>
                    <div class="task-progress" aria-hidden="true"><span style="width:${it.pctDone}%"></span></div>
                </div>
            `).join('');
        }

        if (!chart) return;
        chart.data.datasets[0].data = [s.counts.wait, s.counts.doing, s.counts.done];
        chart.update();
    }

    const ctxStatus = document.getElementById('statusChart').getContext('2d');
    const statusChart = new Chart(ctxStatus, {
        type: 'doughnut',
        data: {
            labels: ['В ожидании', 'В работе', 'Готово'],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: [
                    'rgba(255, 204, 51, 0.7)',  // Gold (wait)
                    'rgba(112, 0, 255, 0.7)',  // Purple (doing)
                    'rgba(0, 242, 255, 0.7)'   // Cyan (done)
                ],
                borderColor: 'rgba(255, 255, 255, 0.1)',
                borderWidth: 2,
                cutout: '60%'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false } // We have a custom legend
            }
        }
    });
    charts.push(statusChart);
    hydrateTaskChart(statusChart);

    // -- Main Bar Chart: Financial Report --
    const ctxFin = document.getElementById('financialChart').getContext('2d');
    const financialChart = new Chart(ctxFin, {
        type: 'bar',
        data: {
            labels: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'],
            datasets: [
                {
                    label: 'Аренда',
                    data: [65, 59, 80, 81, 56, 55, 40, 70, 45, 90, 60, 50],
                    backgroundColor: '#4a90e2',
                    borderRadius: 4
                },
                {
                    label: 'Продажа',
                    data: [28, 48, 40, 19, 86, 27, 90, 40, 30, 50, 40, 30],
                    backgroundColor: '#f1c40f',
                    borderRadius: 4
                },
                {
                    label: 'Комиссия',
                    data: [15, 25, 20, 10, 40, 15, 50, 20, 15, 25, 20, 15],
                    backgroundColor: '#f39c12',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false } // Custom legend
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#a0a4cc', font: { family: "'Exo 2'" } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#a0a4cc', font: { family: "'Exo 2'" } }
                }
            }
        }
    });
    charts.push(financialChart);

    // Hydrate financial chart + summary from CSV
    const series = buildFinanceSeriesFromCsv(FINANCE_CSV);
    if (series) {
        if (finRevEl) finRevEl.textContent = formatGel(series.latest.revenue);
        if (finOpRevEl) finOpRevEl.textContent = formatGel(series.latest.opRevenue);
        if (finNetEl) finNetEl.textContent = formatGel(series.latest.net);
        if (finOccEl) finOccEl.textContent = `${series.occPercent.toFixed(0)}%`;

        financialChart.data.labels = series.labels;
        financialChart.data.datasets = [
            { label: 'Доход', data: series.revenue, backgroundColor: 'rgba(0, 242, 255, 0.7)', borderRadius: 6 },
            { label: 'Опер. доход', data: series.opRevenue, backgroundColor: 'rgba(112, 0, 255, 0.7)', borderRadius: 6 },
            { label: 'Чистая прибыль', data: series.net, backgroundColor: 'rgba(255, 204, 51, 0.7)', borderRadius: 6 }
        ];
        financialChart.update();
    } else {
        if (finOccEl) finOccEl.textContent = '--';
    }


    // -- Interaction Logic --

    // Toasts
    const toastContainer = document.querySelector('.toast-container');
    function toast(title, desc, timeoutMs = 2500) {
        if (!toastContainer) return;
        const el = document.createElement('div');
        el.className = 'toast';
        el.innerHTML = `<div class="title">${title}</div><div class="desc">${desc || ''}</div>`;
        toastContainer.appendChild(el);
        window.setTimeout(() => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(-4px)';
            el.style.transition = 'opacity 180ms ease, transform 180ms ease';
            window.setTimeout(() => el.remove(), 200);
        }, timeoutMs);
    }

    // Modal
    const modalBackdrop = document.querySelector('.modal-backdrop');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.querySelector('.modal-body');
    const modalClose = document.querySelector('.modal-close');
    const modalOk = document.querySelector('[data-action="modal-ok"]');
    const modalCancel = document.querySelector('[data-action="modal-cancel"]');
    let modalPrimaryHandler = null;

    function openModal({ title, bodyHtml, okText, cancelText, onOk }) {
        if (!modalBackdrop || !modalTitle || !modalBody) return;
        modalTitle.textContent = title || 'Окно';
        modalBody.innerHTML = bodyHtml || '';
        if (modalOk) modalOk.textContent = okText || 'Ок';
        if (modalCancel) modalCancel.textContent = cancelText || 'Закрыть';
        modalPrimaryHandler = typeof onOk === 'function' ? onOk : null;
        modalBackdrop.hidden = false;
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        if (!modalBackdrop) return;
        modalBackdrop.hidden = true;
        document.body.style.overflow = '';
        modalPrimaryHandler = null;
    }

    if (modalClose) modalClose.addEventListener('click', closeModal);
    if (modalCancel) modalCancel.addEventListener('click', closeModal);
    if (modalOk) {
        modalOk.addEventListener('click', () => {
            if (modalPrimaryHandler) modalPrimaryHandler();
            closeModal();
        });
    }

    if (modalBackdrop) {
        modalBackdrop.addEventListener('click', (e) => {
            // Click outside the modal closes it
            if (e.target === modalBackdrop) closeModal();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalBackdrop && !modalBackdrop.hidden) closeModal();
    });

    // View switching
    const views = document.querySelectorAll('.view');
    function showView(viewKey) {
        views.forEach(v => v.classList.remove('active'));
        const next = document.querySelector(`.view[data-view="${viewKey}"]`);
        if (next) next.classList.add('active');

        // Chart.js can render oddly after being hidden/shown; force a resize when returning.
        if (viewKey === 'dashboard') {
            window.setTimeout(() => charts.forEach(c => c && c.resize && c.resize()), 0);
            window.setTimeout(() => hydrateTaskChart(statusChart), 0);
        }
    }

    // 1. Sidebar Navigation
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function (e) {
            e.preventDefault(); // Prevent default anchor jump

            // Remove active class from all
            navItems.forEach(nav => nav.classList.remove('active'));

            // Add active class to clicked
            this.classList.add('active');

            const key = this.getAttribute('data-view') || 'dashboard';
            showView(key);
            toast('Навигация', this.querySelector('span')?.innerText || key);
        });
    });

    // 2. Generic Click Feedback for Buttons and Icon Buttons
    // Select all buttons, icon buttons, profile, etc.
    const clickableElements = document.querySelectorAll('button, .icon-btn, .user-profile, .logo-section');

    clickableElements.forEach(el => {
        el.addEventListener('click', function (e) {
            // Visual feedback is handled by CSS :active
            // Here we can log or show a notification if needed
            let text = this.innerText || 'Icon/Image';
            console.log('Interaction:', text.trim());

            // For header actions, maybe show a simple alert to prove it works? (Optional, skipping to avoid annoyance)
            // But for specific ones like "Add Property" or "Search", let's fake it.
        });
    });

    // 2.1 Specific buttons -> open something
    const addPropertyBtn = document.querySelector('.action-btn');
    if (addPropertyBtn) {
        addPropertyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openModal({
                title: 'Добавить объект',
                bodyHtml: `
                    <div class="muted" style="margin-bottom: 10px;">Заполните данные для добавления объекта.</div>
                    <div style="display:grid; gap:10px;">
                        <label class="muted">Название<br><input class="mavi-input" type="text" placeholder="Напр. Апартаменты, 23 этаж"></label>
                        <label class="muted">Город<br><input class="mavi-input" type="text" placeholder="Батуми"></label>
                        <label class="muted">Цена/мес<br><input class="mavi-input" type="text" placeholder="1250 GEL"></label>
                    </div>
                `,
                okText: 'Сохранить',
                cancelText: 'Отмена',
                onOk: () => toast('Сохранено', 'Объект добавлен')
            });
        });
    }

    const filterBtn = document.querySelector('.filter-btn');
    if (filterBtn) {
        filterBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openModal({
                title: 'Фильтр',
                bodyHtml: `
                    <div style="display:grid; gap:10px;">
                        <label class="muted"><input type="checkbox" checked> Только активные</label>
                        <label class="muted"><input type="checkbox"> Только с просрочками</label>
                        <label class="muted"><input type="checkbox"> Только новые</label>
                    </div>
                `,
                okText: 'Применить',
                cancelText: 'Закрыть',
                onOk: () => toast('Фильтр', 'Применено')
            });
        });
    }

    const dateBtn = document.querySelector('.date-btn');
    if (dateBtn) {
        dateBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openModal({
                title: 'Выбор даты',
                bodyHtml: `
                    <div class="muted" style="margin-bottom: 10px;">Здесь можно показать переключение периода.</div>
                    <div style="display:grid; gap:10px;">
                        <button class="mini-btn" type="button" data-action="set-period" data-period="today">Сегодня</button>
                        <button class="mini-btn" type="button" data-action="set-period" data-period="7d">Последние 7 дней</button>
                        <button class="mini-btn" type="button" data-action="set-period" data-period="30d">Последние 30 дней</button>
                    </div>
                `,
                okText: 'Ок',
                cancelText: 'Закрыть',
                onOk: () => toast('Период', 'Выбран')
            });
        });
    }

    // Apartment card actions (Details / Photos / Contract)
    const aptActionButtons = document.querySelectorAll('.apartment-card .apt-actions button');
    aptActionButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const card = btn.closest('.apartment-card');
            const title = card?.querySelector('h4')?.innerText?.trim() || 'Апартаменты';
            const action = btn.innerText.trim().toLowerCase();

            if (action.includes('детали')) {
                openModal({
                    title: `Детали: ${title}`,
                    bodyHtml: `
                        <div style="display:grid; gap:10px;">
                            <div><span class="pill ok">Статус</span> <span class="muted">В управлении</span></div>
                            <div><span class="pill wait">Загрузка</span> <span class="muted">72%</span></div>
                            <div class="muted">Полная информация об апартаментах, включая KPI и историю.</div>
                        </div>
                    `,
                    okText: 'Открыть карточку',
                    cancelText: 'Закрыть',
                    onOk: () => toast('Карточка', 'Открыта')
                });
                return;
            }

            if (action.includes('фото')) {
                const img = card?.querySelector('img')?.getAttribute('src');
                openModal({
                    title: `Фото: ${title}`,
                    bodyHtml: `
                        <div class="muted" style="margin-bottom: 10px;">Галерея</div>
                        <img src="${img || ''}" alt="Фото" style="width:100%; border-radius: 14px; border:1px solid #2a2e36;">
                    `,
                    okText: 'Дальше',
                    cancelText: 'Закрыть',
                    onOk: () => toast('Фото', 'Следующее')
                });
                return;
            }

            if (action.includes('договор')) {
                openModal({
                    title: `Договор: ${title}`,
                    bodyHtml: `
                        <div class="muted" style="margin-bottom: 12px;">Можно показывать “скачивание” и статусы.</div>
                        <div style="display:grid; gap:10px;">
                            <div class="pill ok">Подписан: нет</div>
                            <div class="pill wait">Отправлен: да</div>
                            <div class="muted">Файл: contract_${title.replace(/\s+/g, '_').toLowerCase()}.pdf</div>
                        </div>
                    `,
                    okText: 'Отправить на подпись',
                    cancelText: 'Закрыть',
                    onOk: () => toast('Договор', 'Отправлено')
                });
                return;
            }
        });
    });

    // Delegated actions from new views
    document.addEventListener('click', (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        const act = target.getAttribute('data-action');

        if (act === 'set-period') {
            const period = target.getAttribute('data-period') || '';
            toast('Период', `Выбрано: ${period}`);
            // Для работы: if user picks "today" then set header date to today.
            if (period === 'today' && dateLabel) dateLabel.textContent = formatRuShortDate(now);
            return;
        }

        if (act === 'add-employee') {
            openModal({
                title: 'Добавить сотрудника',
                bodyHtml: `
                    <div style="display:grid; gap:10px;">
                        <label class="muted">Имя<br><input class="mavi-input" type="text" placeholder="Имя Фамилия"></label>
                        <label class="muted">Роль<br><input class="mavi-input" type="text" placeholder="Менеджер"></label>
                    </div>
                `,
                okText: 'Сохранить',
                cancelText: 'Отмена',
                onOk: () => toast('Сотрудники', 'Добавлено')
            });
            return;
        }

        if (act === 'employee-card') {
            openModal({
                title: 'Карточка сотрудника',
                bodyHtml: `<div class="muted">Карточка: KPI, задачи, контакты.</div>`,
                okText: 'Назначить задачу',
                cancelText: 'Закрыть',
                onOk: () => {
                    showView('tasks');
                    navItems.forEach(nav => nav.classList.toggle('active', nav.getAttribute('data-view') === 'tasks'));
                    toast('Задачи', 'Перешли к задачам');
                }
            });
            return;
        }

        if (act === 'new-task' || act === 'task-open') {
            openModal({
                title: act === 'new-task' ? 'Новая задача' : 'Задача',
                bodyHtml: `
                    <div style="display:grid; gap:10px;">
                        <label class="muted">Название<br><input class="mavi-input" type="text" placeholder="Что нужно сделать"></label>
                        <label class="muted">Исполнитель<br><input class="mavi-input" type="text" placeholder="Irakli"></label>
                        <label class="muted">Срок<br><input class="mavi-input" type="text" placeholder="Сегодня"></label>
                    </div>
                `,
                okText: 'Сохранить',
                cancelText: 'Закрыть',
                onOk: () => toast('Задачи', 'Сохранено')
            });
            return;
        }

        if (act === 'export-report') {
            openModal({
                title: 'Экспорт PDF',
                bodyHtml: `<div class="muted">Формирование отчета и скачивание файла.</div>`,
                okText: 'Скачать',
                cancelText: 'Закрыть',
                onOk: () => toast('Отчеты', 'PDF скачан')
            });
            return;
        }

        if (act === 'new-payment') {
            openModal({
                title: 'Добавить платеж',
                bodyHtml: `
                    <div style="display:grid; gap:10px;">
                        <label class="muted">Описание<br><input class="mavi-input" type="text" placeholder="Аренда / Комиссия"></label>
                        <label class="muted">Сумма<br><input class="mavi-input" type="text" placeholder="120 GEL"></label>
                    </div>
                `,
                okText: 'Сохранить',
                cancelText: 'Отмена',
                onOk: () => toast('Платежи', 'Добавлено')
            });
            return;
        }

        if (act === 'add-apartment') {
            openModal({
                title: 'Добавить объект',
                bodyHtml: `
                    <div style="display:grid; gap:10px;">
                        <label class="muted">Название<br><input class="mavi-input" type="text" placeholder="Апартаменты / Вилла / Студия"></label>
                        <label class="muted">Адрес<br><input class="mavi-input" type="text" placeholder="Батуми, ..."></label>
                        <label class="muted">Статус<br><input class="mavi-input" type="text" placeholder="В управлении"></label>
                    </div>
                `,
                okText: 'Сохранить',
                cancelText: 'Отмена',
                onOk: () => toast('Апартаменты', 'Добавлено')
            });
            return;
        }

        if (act === 'apartment-search') {
            openModal({
                title: 'Поиск объекта',
                bodyHtml: `<label class="muted">Запрос<br><input class="mavi-input" type="text" placeholder="Напр. 23 этаж"></label>`,
                okText: 'Найти',
                cancelText: 'Закрыть',
                onOk: () => toast('Апартаменты', 'Показаны результаты')
            });
            return;
        }

        if (act === 'apartment-import') {
            openModal({
                title: 'Импорт',
                bodyHtml: `<div class="muted">Импорт из Excel/CRM.</div>`,
                okText: 'Запустить',
                cancelText: 'Закрыть',
                onOk: () => toast('Импорт', 'Запущено')
            });
            return;
        }

        if (act === 'apartment-map') {
            openModal({
                title: 'Карта объектов',
                bodyHtml: `<div class="muted">Здесь можно показать карту/пины.</div>`,
                okText: 'Ок',
                cancelText: 'Закрыть',
                onOk: () => toast('Апартаменты', 'Карта открыта')
            });
            return;
        }

        if (act === 'report-period') {
            openModal({
                title: 'Период отчета',
                bodyHtml: `
                    <div class="muted" style="margin-bottom: 10px;">Выберите период.</div>
                    <div style="display:grid; gap:10px;">
                        <button class="mini-btn" type="button" data-action="set-period" data-period="month">Текущий месяц</button>
                        <button class="mini-btn" type="button" data-action="set-period" data-period="quarter">Квартал</button>
                        <button class="mini-btn" type="button" data-action="set-period" data-period="year">Год</button>
                    </div>
                `,
                okText: 'Ок',
                cancelText: 'Закрыть',
                onOk: () => toast('Отчеты', 'Период выбран')
            });
            return;
        }

        if (act === 'contract-template') {
            openModal({
                title: 'Шаблон договора',
                bodyHtml: `<div class="muted">Предпросмотр + генерация договора.</div>`,
                okText: 'Сгенерировать',
                cancelText: 'Закрыть',
                onOk: () => toast('Договора', 'Сгенерировано')
            });
            return;
        }

        if (act === 'new-contract') {
            openModal({
                title: 'Создать договор',
                bodyHtml: `
                    <div style="display:grid; gap:10px;">
                        <label class="muted">Объект<br><input class="mavi-input" type="text" placeholder="Апартаменты, 23 этаж"></label>
                        <label class="muted">Тип<br><input class="mavi-input" type="text" placeholder="Аренда (полный)"></label>
                        <label class="muted">Сумма<br><input class="mavi-input" type="text" placeholder="1250 GEL"></label>
                    </div>
                `,
                okText: 'Сгенерировать',
                cancelText: 'Закрыть',
                onOk: () => toast('Договора', 'Создан')
            });
            return;
        }

        if (act === 'kb-open' || act === 'new-article') {
            openModal({
                title: act === 'new-article' ? 'Новая статья' : 'Статья',
                bodyHtml: act === 'new-article'
                    ? `<div style="display:grid; gap:10px;">
                           <label class="muted">Заголовок<br><input class="mavi-input" type="text" placeholder="Напр. Заселение"></label>
                           <label class="muted">Текст<br><input class="mavi-input" type="text" placeholder="Короткая инструкция"></label>
                       </div>`
                    : `<div class="muted">Текст, вложения, быстрый поиск.</div>`,
                okText: act === 'new-article' ? 'Сохранить' : 'Ок',
                cancelText: 'Закрыть',
                onOk: () => toast('База знаний', 'Готово')
            });
            return;
        }
    });

    // 3. Search Bar Interaction
    const searchInputs = document.querySelectorAll('.search-bar input[type="text"], .search-sm input[type="text"]');
    searchInputs.forEach(input => {
        input.addEventListener('focus', function () {
            this.parentElement.style.borderColor = '#d4af37'; // Gold border on focus
            this.parentElement.style.boxShadow = '0 0 8px rgba(212, 175, 55, 0.2)';
        });

        input.addEventListener('blur', function () {
            this.parentElement.style.borderColor = '#2a2e36'; // Reset
            this.parentElement.style.boxShadow = 'none';
        });
    });

});
