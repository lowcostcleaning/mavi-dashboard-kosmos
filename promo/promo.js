/* ═══════════════════════════════════════════════════════════════════
   MAVI GUEST — Promo Carousel Logic
   ═══════════════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    // ── Supabase ────────────────────────────────────────────────────
    const SUPA_URL = 'https://supabase.138.124.87.26.sslip.io';
    const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzQxNjUxMjAwLCJleHAiOjIwNTY5MjQ4MDB9.Ab4P7JqPdB3xzkZv1Cr6lrOiUg-9HjUDEZ-Pdr7iigw';
    const supa = supabase.createClient(SUPA_URL, SUPA_KEY);

    // ── Google Sheets finance CSV ───────────────────────────────────
    const SHEET_ID = '1qmfEGEzq55Miu9ICDhpCdihk_TE402mpIao5KNbaYlA';
    const GID = '1090503967';
    const FINANCE_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

    // ── Constants ───────────────────────────────────────────────────
    const ROLE_LABELS = { cleaner: 'Клинер', expeditor: 'Экспедитор', complector: 'Комплектовщик', mbip: 'Менеджер', ceo: 'CEO', cfo: 'Фин. директор', marketing_director: 'Маркетинг', methodologist: 'Методолог' };
    const ROLE_COLORS = { cleaner: '#6366f1', expeditor: '#10b981', complector: '#a855f7', mbip: '#f59e0b', ceo: '#ef4444', cfo: '#0ea5e9', marketing_director: '#ec4899', methodologist: '#14b8a6' };
    const APT_STATUS_COLORS = { active: '#10b981', launching: '#f59e0b', onboarding: '#6366f1', inactive: '#ef4444' };

    const AUTO_PLAY_MS = 4000;
    const LABEL_HEIGHT = 60;

    // ── Slide definitions ───────────────────────────────────────────
    const SLIDES = [
        { id: 'finance',   label: 'Финансовая аналитика',   icon: 'fa-solid fa-chart-column' },
        { id: 'widgets',   label: 'Дашборд виджеты',        icon: 'fa-solid fa-gauge-high' },
        { id: 'apartments', label: 'Апартаменты',            icon: 'fa-solid fa-building' },
        { id: 'employees', label: 'Сотрудники',             icon: 'fa-solid fa-users' },
        { id: 'tasks',     label: 'Исполнение задач',       icon: 'fa-solid fa-list-check' },
    ];

    // ── State ───────────────────────────────────────────────────────
    let currentIndex = 0;
    let isPaused = false;
    let autoTimer = null;

    // Chart instances (destroyed/recreated on slide change)
    let financeChart = null;
    let taskDonutChart = null;

    // Cached data
    let cachedEmployees = null;
    let cachedApartments = null;
    let cachedTasks = null;
    let cachedFinance = null;

    // ── DOM refs ────────────────────────────────────────────────────
    const labelsTrack = document.getElementById('labels-track');
    const viewport = document.getElementById('carousel-viewport');
    const dotsWrap = document.getElementById('carousel-dots');

    // ── Build label items + dots ────────────────────────────────────
    SLIDES.forEach((s, i) => {
        // Label
        const el = document.createElement('div');
        el.className = 'label-item' + (i === 0 ? ' active' : '');
        el.dataset.index = i;
        el.innerHTML = `<span class="label-icon"><i class="${s.icon}"></i></span><span>${s.label}</span>`;
        el.addEventListener('click', () => goTo(i));
        el.addEventListener('mouseenter', () => { isPaused = true; });
        el.addEventListener('mouseleave', () => { isPaused = false; });
        labelsTrack.appendChild(el);

        // Slide container
        const slide = document.createElement('div');
        slide.className = 'slide' + (i === 0 ? ' active' : '');
        slide.id = 'slide-' + s.id;
        slide.innerHTML = '<div class="slide-inner"><div class="slide-loading"><i class="fa-solid fa-spinner fa-spin"></i>Загрузка...</div></div>';
        viewport.appendChild(slide);

        // Dot
        const dot = document.createElement('button');
        dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
        dot.addEventListener('click', () => goTo(i));
        dotsWrap.appendChild(dot);
    });

    // ── Position labels vertically ──────────────────────────────────
    function positionLabels() {
        const labels = labelsTrack.querySelectorAll('.label-item');
        const isMobile = window.innerWidth <= 900;
        if (isMobile) return; // CSS handles horizontal layout on mobile

        labels.forEach((el, i) => {
            const distance = i - currentIndex;
            const len = SLIDES.length;
            let wrapped = distance;
            if (distance > len / 2) wrapped -= len;
            if (distance < -len / 2) wrapped += len;

            const y = wrapped * LABEL_HEIGHT;
            const absD = Math.abs(wrapped);
            const opacity = Math.max(0, 1 - absD * 0.22);

            el.style.transform = `translateY(${y}px)`;
            el.style.opacity = opacity;
            el.classList.toggle('active', i === currentIndex);
        });
    }

    // ── Switch slide ────────────────────────────────────────────────
    function goTo(index) {
        if (index === currentIndex) return;
        const prevIndex = currentIndex;
        currentIndex = ((index % SLIDES.length) + SLIDES.length) % SLIDES.length;

        // Update slides
        const slides = viewport.querySelectorAll('.slide');
        slides.forEach((s, i) => {
            s.classList.remove('active', 'prev');
            if (i === currentIndex) s.classList.add('active');
            else if (i === prevIndex) s.classList.add('prev');
        });

        // Update dots
        const dots = dotsWrap.querySelectorAll('.carousel-dot');
        dots.forEach((d, i) => d.classList.toggle('active', i === currentIndex));

        // Update labels
        positionLabels();

        // Render slide content
        renderSlide(currentIndex);

        // Reset timer
        resetAutoPlay();
    }

    function next() {
        goTo(currentIndex + 1);
    }

    // ── Auto-play ───────────────────────────────────────────────────
    function resetAutoPlay() {
        clearInterval(autoTimer);
        autoTimer = setInterval(() => {
            if (!isPaused) next();
        }, AUTO_PLAY_MS);
    }

    // ── Render individual slides ────────────────────────────────────
    async function renderSlide(index) {
        const slideId = SLIDES[index].id;

        switch (slideId) {
            case 'finance':   await renderFinanceSlide(); break;
            case 'widgets':   await renderWidgetsSlide(); break;
            case 'apartments': await renderApartmentsSlide(); break;
            case 'employees': await renderEmployeesSlide(); break;
            case 'tasks':     await renderTasksSlide(); break;
        }
    }

    // ── Helpers ─────────────────────────────────────────────────────
    function formatGel(n) {
        const rounded = Math.round(Number(n) || 0);
        try { return new Intl.NumberFormat('ru-RU').format(rounded) + ' ₾'; }
        catch { return rounded + ' ₾'; }
    }

    function parseMoney(s) {
        if (s == null) return 0;
        let t = String(s).trim().replace(/\u00a0/g, '').replace(/\s+/g, '');
        if (/^-?\d+,\d+$/.test(t)) t = t.replace(',', '.');
        const n = Number(t);
        return Number.isFinite(n) ? n : 0;
    }

    function parseDateDotted(s) {
        if (!s) return null;
        const m = String(s).match(/(\d{2})\.(\d{2})\.(\d{2,4})/);
        if (!m) return null;
        let year = Number(m[3]);
        if (year < 100) year += 2000;
        return new Date(year, Number(m[2]) - 1, Number(m[1]));
    }

    function parseCsvLine(line) {
        const out = [];
        let field = '', inQ = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQ) {
                if (ch === '"') { if (line[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
                else field += ch;
            } else {
                if (ch === '"') inQ = true;
                else if (ch === ',') { out.push(field); field = ''; }
                else field += ch;
            }
        }
        out.push(field);
        return out;
    }

    function monthLabelRu(mi) {
        return ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'][mi] || '?';
    }

    // ── SLIDE 1: Finance ────────────────────────────────────────────
    async function fetchFinanceData() {
        if (cachedFinance) return cachedFinance;
        try {
            const resp = await fetch(FINANCE_CSV_URL);
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const csv = await resp.text();
            cachedFinance = parseFinanceCsv(csv);
        } catch (e) {
            console.warn('Finance CSV error:', e.message);
            cachedFinance = null;
        }
        return cachedFinance;
    }

    function parseFinanceCsv(csv) {
        const lines = csv.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim());
        if (lines.length < 2) return null;
        const header = parseCsvLine(lines[0]);
        const idx = {};
        header.forEach((h, i) => { idx[h.toLowerCase().trim()] = i; });

        function find(pred) {
            for (const [k, i] of Object.entries(idx)) if (pred(k)) return i;
            return -1;
        }

        const iMonth = find(k => k === 'месяц' || k.includes('month'));
        const iRevenue = find(k => k.includes('revenue / доход'));
        const iOpRev = find(k => k.includes('operation revenue'));
        const iNet = find(k => k.includes('net profit') || k.includes('результат периода') || (k.includes('чистый') && k.includes('доход')));
        const iOccDays = find(k => k.includes('количество занятых дней'));
        const iListing = find(k => k.includes('listing nickname') || k.includes('название апартамента'));

        const groups = new Map();
        const allApts = new Set();

        for (let li = 1; li < lines.length; li++) {
            const row = parseCsvLine(lines[li]);
            if (row.length < 4) continue;
            const date = parseDateDotted(row[0]);
            const monthNum = iMonth >= 0 ? parseInt(row[iMonth]) || 1 : (date ? date.getMonth() + 1 : 1);
            const year = date ? date.getFullYear() : new Date().getFullYear();
            const mi = Math.max(0, Math.min(11, monthNum - 1));
            const key = `${year}-${String(mi + 1).padStart(2, '0')}`;

            const listing = iListing >= 0 ? (row[iListing] || '').trim() : '';
            if (listing) allApts.add(listing);

            if (!groups.has(key)) groups.set(key, { year, mi, revenue: 0, opRevenue: 0, net: 0, occDays: 0, listings: 0 });
            const g = groups.get(key);
            g.revenue += iRevenue >= 0 ? parseMoney(row[iRevenue]) : 0;
            g.opRevenue += iOpRev >= 0 ? parseMoney(row[iOpRev]) : 0;
            g.net += iNet >= 0 ? parseMoney(row[iNet]) : 0;
            g.occDays += iOccDays >= 0 ? parseInt(row[iOccDays]) || 0 : 0;
            if (listing) g.listings++;
        }

        const points = Array.from(groups.values()).sort((a, b) => (a.year - b.year) || (a.mi - b.mi));
        if (!points.length) return null;

        const latest = points[points.length - 1];
        const daysInMonth = new Date(latest.year, latest.mi + 1, 0).getDate();
        const occPct = (latest.occDays / Math.max(1, latest.listings * daysInMonth)) * 100;

        return {
            labels: points.map(p => `${monthLabelRu(p.mi)} ${p.year}`),
            revenue: points.map(p => p.revenue),
            opRevenue: points.map(p => p.opRevenue),
            net: points.map(p => p.net),
            latest,
            occPercent: occPct,
            aptCount: allApts.size,
        };
    }

    async function renderFinanceSlide() {
        const container = document.querySelector('#slide-finance .slide-inner');
        const data = await fetchFinanceData();
        if (!data) {
            container.innerHTML = '<div class="slide-loading">Нет финансовых данных</div>';
            return;
        }

        container.innerHTML = `
            <div class="slide-title"><i class="fa-solid fa-chart-column"></i> Финансовый отчёт</div>
            <div class="slide-subtitle">Доходы и расходы по месяцам из Google Sheets</div>
            <div class="promo-chart-wrap">
                <div class="promo-chart-legend">
                    <span><span class="promo-legend-dot" style="background:rgba(0,242,255,0.8)"></span> Доход</span>
                    <span><span class="promo-legend-dot" style="background:rgba(112,0,255,0.8)"></span> Опер. доход</span>
                    <span><span class="promo-legend-dot" style="background:rgba(255,204,51,0.8)"></span> Чистая прибыль</span>
                </div>
                <canvas id="promo-finance-chart" class="promo-chart-canvas"></canvas>
            </div>
            <div class="promo-fin-chips">
                <div class="promo-fin-chip"><div class="k">Доход</div><div class="v">${formatGel(data.latest.revenue)}</div></div>
                <div class="promo-fin-chip"><div class="k">Опер. доход</div><div class="v">${formatGel(data.latest.opRevenue)}</div></div>
                <div class="promo-fin-chip"><div class="k">Чистая прибыль</div><div class="v">${formatGel(data.latest.net)}</div></div>
                <div class="promo-fin-chip"><div class="k">Заполняемость</div><div class="v">${data.occPercent.toFixed(0)}%</div></div>
            </div>
        `;

        // Build chart
        if (financeChart) financeChart.destroy();
        const ctx = document.getElementById('promo-finance-chart').getContext('2d');
        financeChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels,
                datasets: [
                    { label: 'Доход', data: data.revenue, backgroundColor: 'rgba(0,242,255,0.7)', borderRadius: 6 },
                    { label: 'Опер. доход', data: data.opRevenue, backgroundColor: 'rgba(112,0,255,0.7)', borderRadius: 6 },
                    { label: 'Чистая прибыль', data: data.net, backgroundColor: 'rgba(255,204,51,0.7)', borderRadius: 6 },
                ],
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#a0a4cc', font: { family: "'Exo 2'" } } },
                    x: { grid: { display: false }, ticks: { color: '#a0a4cc', font: { family: "'Exo 2'" } } },
                },
            },
        });
    }

    // ── SLIDE 2: Widgets ────────────────────────────────────────────
    async function renderWidgetsSlide() {
        const container = document.querySelector('#slide-widgets .slide-inner');
        const data = await fetchFinanceData();

        const totalRev = data ? data.revenue.reduce((s, v) => s + v, 0) : 0;
        const totalNet = data ? data.net.reduce((s, v) => s + v, 0) : 0;
        const occ = data ? data.occPercent : 0;
        const apts = data ? data.aptCount : 0;

        const sparkBars = (arr, color) => {
            const last = (arr || []).slice(-6);
            const max = Math.max(...last, 1);
            return last.map(v => `<div class="bar" style="height:${Math.max(8, (v / max) * 100)}%;background:${color}"></div>`).join('');
        };

        container.innerHTML = `
            <div class="slide-title"><i class="fa-solid fa-gauge-high"></i> Ключевые показатели</div>
            <div class="slide-subtitle">Сводка по всем операциям за последний период</div>
            <div class="promo-stats-grid">
                <div class="promo-stat-card">
                    <div class="promo-stat-top">
                        <div>
                            <div class="promo-stat-value">${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(totalRev)}</div>
                            <div class="promo-stat-label">Общий доход (₾)</div>
                        </div>
                        <div class="promo-stat-icon"><i class="fa-solid fa-coins" style="color:var(--accent-gold)"></i></div>
                    </div>
                    <div class="promo-stat-spark">${data ? sparkBars(data.revenue, 'rgba(99,102,241,0.7)') : ''}</div>
                </div>
                <div class="promo-stat-card">
                    <div class="promo-stat-top">
                        <div>
                            <div class="promo-stat-value" style="color:#10b981">${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(totalNet)}</div>
                            <div class="promo-stat-label">Чистый доход (₾)</div>
                        </div>
                        <div class="promo-stat-icon"><i class="fa-solid fa-chart-line" style="color:#10b981"></i></div>
                    </div>
                    <div class="promo-stat-spark">${data ? sparkBars(data.net, 'rgba(16,185,129,0.7)') : ''}</div>
                </div>
                <div class="promo-stat-card">
                    <div class="promo-stat-top">
                        <div>
                            <div class="promo-stat-value" style="color:#f59e0b">${occ.toFixed(0)}%</div>
                            <div class="promo-stat-label">Заполняемость</div>
                        </div>
                        <div class="promo-stat-icon"><i class="fa-solid fa-bed" style="color:#f59e0b"></i></div>
                    </div>
                    <div class="promo-stat-spark">${data ? sparkBars(data.revenue.map(() => occ), 'rgba(245,158,11,0.7)') : ''}</div>
                </div>
                <div class="promo-stat-card">
                    <div class="promo-stat-top">
                        <div>
                            <div class="promo-stat-value" style="color:var(--accent-cyan)">${apts || '—'}</div>
                            <div class="promo-stat-label">Апартаментов</div>
                        </div>
                        <div class="promo-stat-icon"><i class="fa-solid fa-building" style="color:var(--accent-cyan)"></i></div>
                    </div>
                    <div class="promo-stat-spark">${data ? sparkBars(data.revenue.map(() => apts), 'rgba(0,242,255,0.5)') : ''}</div>
                </div>
            </div>
        `;
    }

    // ── SLIDE 3: Apartments ─────────────────────────────────────────
    async function renderApartmentsSlide() {
        const container = document.querySelector('#slide-apartments .slide-inner');
        if (!cachedApartments) {
            const { data, error } = await supa.from('apartments').select('*').order('name');
            if (error) { console.error(error); }
            cachedApartments = data || [];
        }

        const list = cachedApartments.slice(0, 8);
        container.innerHTML = `
            <div class="slide-title"><i class="fa-solid fa-building"></i> Апартаменты <span style="font-size:12px;color:var(--text-secondary);font-family:var(--font-body);letter-spacing:0;text-transform:none;font-weight:400;margin-left:8px;">(${cachedApartments.length})</span></div>
            <div class="slide-subtitle">Объекты под управлением MAVI GUEST</div>
            <div class="promo-apt-grid">
                ${list.map(a => {
                    const statusClass = a.status ? 'status-' + a.status : '';
                    const statusLabel = { active: 'Активен', launching: 'Запуск', onboarding: 'Онбординг', inactive: 'Неактивен' }[a.status] || a.status || '—';
                    return `<div class="promo-apt-card">
                        <div class="promo-apt-name"><i class="fa-solid fa-building"></i> ${a.name || '—'}</div>
                        <div class="promo-apt-complex">${a.complex_name || ''} ${a.address ? '· ' + a.address : ''}</div>
                        <div class="promo-apt-meta">
                            <span class="promo-apt-tag ${statusClass}">${statusLabel}</span>
                            ${a.floor ? `<span class="promo-apt-tag">${a.floor} эт.</span>` : ''}
                            ${a.room_type ? `<span class="promo-apt-tag">${a.room_type}</span>` : ''}
                        </div>
                    </div>`;
                }).join('')}
            </div>
        `;
    }

    // ── SLIDE 4: Employees ──────────────────────────────────────────
    async function renderEmployeesSlide() {
        const container = document.querySelector('#slide-employees .slide-inner');
        if (!cachedEmployees) {
            const { data, error } = await supa.from('employees').select('*').order('full_name');
            if (error) { console.error(error); }
            cachedEmployees = data || [];
        }

        const list = cachedEmployees.slice(0, 8);
        container.innerHTML = `
            <div class="slide-title"><i class="fa-solid fa-users"></i> Команда <span style="font-size:12px;color:var(--text-secondary);font-family:var(--font-body);letter-spacing:0;text-transform:none;font-weight:400;margin-left:8px;">(${cachedEmployees.length})</span></div>
            <div class="slide-subtitle">Сотрудники компании MAVI GUEST</div>
            <div class="promo-emp-grid">
                ${list.map(e => {
                    const color = ROLE_COLORS[e.role] || '#6366f1';
                    const role = ROLE_LABELS[e.role] || e.role;
                    const initials = (e.full_name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                    const starsHtml = e.rating
                        ? Array.from({ length: 5 }, (_, i) =>
                            i < Math.floor(e.rating)
                                ? '<i class="fa-solid fa-star"></i>'
                                : (i < e.rating ? '<i class="fa-solid fa-star-half-stroke"></i>' : '<i class="fa-regular fa-star" style="opacity:.3"></i>')
                        ).join('')
                        : '';
                    const isActive = e.status === 'active';

                    return `<div class="promo-emp-card">
                        <div class="promo-emp-avatar" style="border-color:${color};background:${color}22;box-shadow:0 0 16px ${color}33;">${initials}</div>
                        <div class="promo-emp-info">
                            <div class="promo-emp-name">${e.full_name}</div>
                            <div class="promo-emp-role" style="color:${color}">${role}</div>
                            ${starsHtml ? `<div class="promo-emp-rating">${starsHtml}</div>` : ''}
                        </div>
                        <div class="promo-emp-status ${isActive ? 'active' : 'inactive'}">
                            <i class="fa-solid fa-${isActive ? 'signal' : 'clock'}" style="margin-right:3px;"></i>${isActive ? 'Актив' : 'Офлайн'}
                        </div>
                    </div>`;
                }).join('')}
            </div>
        `;
    }

    // ── SLIDE 5: Tasks ──────────────────────────────────────────────
    async function renderTasksSlide() {
        const container = document.querySelector('#slide-tasks .slide-inner');
        if (!cachedTasks) {
            const { data, error } = await supa.from('tasks').select('*');
            if (error) { console.error(error); }
            cachedTasks = data || [];
        }
        if (!cachedEmployees) {
            const { data } = await supa.from('employees').select('*').order('full_name');
            cachedEmployees = data || [];
        }

        const total = cachedTasks.length || 1;
        const newT = cachedTasks.filter(t => t.status === 'new').length;
        const inP = cachedTasks.filter(t => ['assigned', 'in_progress'].includes(t.status)).length;
        const done = cachedTasks.filter(t => t.status === 'done').length;
        const pctDone = Math.round((done / total) * 100);

        // Per-employee stats
        const byEmp = new Map();
        cachedTasks.forEach(t => {
            if (!t.assigned_to) return;
            if (!byEmp.has(t.assigned_to)) byEmp.set(t.assigned_to, { total: 0, done: 0 });
            const e = byEmp.get(t.assigned_to);
            e.total++;
            if (t.status === 'done') e.done++;
        });

        const teamItems = Array.from(byEmp.entries()).map(([empId, st]) => {
            const emp = cachedEmployees.find(e => String(e.id) === String(empId));
            const name = emp ? emp.full_name : `#${empId}`;
            const pct = st.total ? Math.round((st.done / st.total) * 100) : 0;
            return { name, total: st.total, done: st.done, pct };
        }).sort((a, b) => b.pct - a.pct || b.total - a.total).slice(0, 5);

        container.innerHTML = `
            <div class="slide-title"><i class="fa-solid fa-list-check"></i> Исполнение задач</div>
            <div class="slide-subtitle">Статистика выполнения задач командой</div>
            <div class="promo-task-layout">
                <div class="promo-chart-wrap" style="padding:20px;">
                    <div class="promo-donut-wrap">
                        <canvas id="promo-task-donut" class="promo-donut-canvas"></canvas>
                        <div class="promo-donut-center">
                            <div class="promo-donut-pct">${pctDone}%</div>
                            <div class="promo-donut-sub">выполнено</div>
                        </div>
                    </div>
                    <div class="promo-chart-legend" style="justify-content:center;margin-top:14px;margin-bottom:0;">
                        <span><span class="promo-legend-dot" style="background:rgba(255,204,51,0.7)"></span> Ожидание (${newT})</span>
                        <span><span class="promo-legend-dot" style="background:rgba(112,0,255,0.7)"></span> В работе (${inP})</span>
                        <span><span class="promo-legend-dot" style="background:rgba(0,242,255,0.7)"></span> Готово (${done})</span>
                    </div>
                </div>
                <div class="promo-task-team">
                    <div class="promo-task-team-title">Сотрудники (топ-5)</div>
                    ${teamItems.map(it => `
                        <div class="promo-team-item">
                            <div class="promo-team-row">
                                <span class="promo-team-name">${it.name}</span>
                                <span class="promo-team-pct">${it.pct}%</span>
                            </div>
                            <div class="promo-team-meta">выполнено ${it.done} из ${it.total}</div>
                            <div class="promo-team-bar"><div class="promo-team-bar-fill" style="width:${it.pct}%"></div></div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // Build donut
        if (taskDonutChart) taskDonutChart.destroy();
        const dctx = document.getElementById('promo-task-donut').getContext('2d');
        taskDonutChart = new Chart(dctx, {
            type: 'doughnut',
            data: {
                labels: ['Ожидание', 'В работе', 'Готово'],
                datasets: [{
                    data: [newT, inP, done],
                    backgroundColor: ['rgba(255,204,51,0.7)', 'rgba(112,0,255,0.7)', 'rgba(0,242,255,0.7)'],
                    borderColor: 'rgba(255,255,255,0.08)',
                    borderWidth: 2,
                    cutout: '65%',
                }],
            },
            options: {
                responsive: true, maintainAspectRatio: true,
                plugins: { legend: { display: false }, tooltip: { enabled: true } },
            },
        });
    }

    // ── Init ─────────────────────────────────────────────────────────
    positionLabels();
    renderSlide(0);
    resetAutoPlay();

    // Pause on hover over viewport
    viewport.addEventListener('mouseenter', () => { isPaused = true; });
    viewport.addEventListener('mouseleave', () => { isPaused = false; });

    // Keyboard navigation
    document.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next();
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') goTo(currentIndex - 1);
    });

    window.addEventListener('resize', positionLabels);
})();
