/* Личный трекер привычек — MVP по кейсу №1.
   Данные хранятся в localStorage браузера. Без библиотек и сборки. */

(() => {
  "use strict";

  const STORAGE_KEY = "habit-tracker-v1";
  const ACCOUNT_KEY = "habit-tracker-account";
  const SESSION_KEY = "habit-tracker-session";

  // Категории по умолчанию — в порядке из технического задания.
  // Дальше они живут в состоянии: их можно создавать и редактировать.
  const DEFAULT_CATEGORIES = [
    { id: "health", name: "Здоровье", icon: "❤️" },
    { id: "work", name: "Работа", icon: "💼" },
    { id: "study", name: "Образование", icon: "📚" },
    { id: "sport", name: "Спорт", icon: "🏃" },
    { id: "food", name: "Питание", icon: "🥗" },
    { id: "home", name: "Дом", icon: "🏠" },
    { id: "bad", name: "Вредные привычки (отказ / контроль)", icon: "🚭" },
    { id: "creative", name: "Творчество", icon: "🎨" },
    { id: "sleep", name: "Сон", icon: "😴" },
  ];

  const EMOJIS = ["✅", "❤️", "💧", "💼", "📚", "🏃", "🧘", "🥗", "🏠", "😴", "🎨", "🚭", "💊", "🦷", "🧹", "📝", "🎸", "🚶", "🏋️", "💰"];

  // Базовые формы единиц и их склонения: [1, 2–4, 5+]
  const UNIT_FORMS = {
    "стакан": ["стакан", "стакана", "стаканов"],
    "страница": ["страница", "страницы", "страниц"],
    "раз": ["раз", "раза", "раз"],
    "минута": ["минута", "минуты", "минут"],
    "шаг": ["шаг", "шага", "шагов"],
    "книга": ["книга", "книги", "книг"],
  };

  const UNIT_MIGRATION = { "стаканов": "стакан", "страниц": "страница", "минут": "минута" };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[ch]));

  /* ---------- даты ---------- */

  function dateKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function parseKey(key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(key, amount) {
    const date = parseKey(key);
    date.setDate(date.getDate() + amount);
    return dateKey(date);
  }

  function daysBetween(from, to) {
    return Math.round((parseKey(to) - parseKey(from)) / 86400000);
  }

  function formatLong(date) {
    const text = date.toLocaleDateString("ru-RU", {
      day: "numeric", month: "long", weekday: "long",
    });
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function plural(n, forms) {
    const abs = Math.abs(n) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return forms[2];
    if (last > 1 && last < 5) return forms[1];
    if (last === 1) return forms[0];
    return forms[2];
  }

  // «92 стакана», «187 страниц», «5 раз». Неизвестную единицу оставляем как есть.
  function unitText(unit, count) {
    const forms = UNIT_FORMS[unit];
    return forms ? plural(count, forms) : unit;
  }

  // Для записи «6/8 стаканов» и «цель 20 страниц» — форма родительного падежа.
  function unitPlural(unit) {
    const forms = UNIT_FORMS[unit];
    return forms ? forms[2] : unit;
  }

  /* ---------- состояние ---------- */

  function seedState() {
    const today = dateKey();
    const make = (id, name, icon, color, category, unit, target, values) => {
      const log = {};
      for (const [offset, value] of Object.entries(values)) {
        if (value > 0) log[addDays(today, -Number(offset))] = value;
      }
      return {
        id, name, icon, color, category, unit, target,
        allowedMisses: 2,
        createdAt: addDays(today, -14),
        archived: false,
        log,
      };
    };
    return {
      version: 1,
      profile: { name: "" },
      theme: "light",
      categories: DEFAULT_CATEGORIES.map((category) => ({ ...category })),
      habits: [
        make("h1", "Вода", "💧", "#38bdf8", "health", "стакан", 8,
          { 0: 6, 1: 8, 2: 8, 3: 5, 4: 8, 5: 8, 6: 7, 7: 8, 8: 4, 9: 8, 10: 8, 11: 6, 12: 8 }),
        make("h2", "Чтение", "📚", "#8b5cf6", "study", "страница", 20,
          { 0: 20, 1: 0, 2: 15, 3: 20, 4: 20, 5: 0, 6: 20, 7: 12, 8: 20, 9: 20, 10: 0, 11: 20, 12: 20 }),
        make("h3", "Зарядка", "🏃", "#22c55e", "sport", "раз", 1,
          { 0: 1, 1: 1, 2: 0, 3: 1, 4: 1, 5: 1, 6: 0, 7: 1, 8: 1, 9: 0, 10: 1, 11: 1, 12: 1 }),
      ],
    };
  }

  function normalize(saved) {
    const sourceCategories = Array.isArray(saved.categories) && saved.categories.length
      ? saved.categories
      : DEFAULT_CATEGORIES;

    const categories = [];
    const usedIds = new Set();
    for (const category of sourceCategories) {
      const id = String((category && category.id) || "").trim();
      const name = String((category && category.name) || "").trim();
      if (!id || !name || usedIds.has(id)) continue;
      usedIds.add(id);
      categories.push({ id, name, icon: (category && category.icon) || "✅" });
    }

    const safeCategories = categories.length
      ? categories
      : DEFAULT_CATEGORIES.map((category) => ({ ...category }));
    const knownCategories = new Set(safeCategories.map((category) => category.id));
    const fallbackCategory = safeCategories[0].id;

    const state = {
      version: 1,
      profile: { name: saved.profile && typeof saved.profile.name === "string" ? saved.profile.name : "" },
      theme: saved.theme === "dark" ? "dark" : "light",
      categories: safeCategories,
      habits: [],
    };

    state.habits = (Array.isArray(saved.habits) ? saved.habits : []).map((habit) => ({
      id: habit.id || "h" + Math.random().toString(36).slice(2, 9),
      name: habit.name || "Без названия",
      icon: habit.icon || "✅",
      color: habit.color || "#16a34a",
      category: knownCategories.has(habit.category) ? habit.category : fallbackCategory,
      unit: UNIT_MIGRATION[habit.unit] || habit.unit || "раз",
      target: Number(habit.target) > 0 ? Number(habit.target) : 1,
      allowedMisses: Number.isFinite(Number(habit.allowedMisses)) ? Number(habit.allowedMisses) : 2,
      createdAt: habit.createdAt || dateKey(),
      archived: Boolean(habit.archived),
      log: habit.log && typeof habit.log === "object" ? habit.log : {},
    }));

    return state;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch (error) {
      console.warn("Не удалось прочитать сохранённые данные:", error);
    }
    return seedState();
  }

  let state = loadState();
  let view = "today";
  let habitFilter = "active";
  let calendarHabitId = null;
  let calendarMonth = new Date();
  calendarMonth.setDate(1);
  let recoverEmail = "";

  /* ---------- аккаунт и сессия ----------
     Внимание: это демонстрационный вход. Пароль хешируется и хранится
     в браузере пользователя, сервера нет. Для реального клиента нужен
     сервер с базой и настоящей авторизацией. */

  function loadAccount() {
    try {
      const raw = localStorage.getItem(ACCOUNT_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !data.login || !data.hash || !data.salt) return null;
      return data;
    } catch (error) {
      return null;
    }
  }

  function saveAccount(nextAccount) {
    account = nextAccount;
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(nextAccount));
  }

  function setSession(on) {
    session = Boolean(on);
    localStorage.setItem(SESSION_KEY, session ? "1" : "0");
  }

  function randomSalt() {
    const bytes = new Uint8Array(16);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    return Array.from(bytes).map((value) => value.toString(16).padStart(2, "0")).join("");
  }

  async function hashPassword(password, salt) {
    const text = `${salt}:${password}`;
    if (window.crypto && crypto.subtle) {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
    }
    // Запасной вариант для браузеров без crypto.subtle. Для учебного MVP достаточно.
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) | 0;
    return "fallback-" + (hash >>> 0).toString(16);
  }

  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
  }

  let account = loadAccount();
  let session = localStorage.getItem(SESSION_KEY) === "1" && Boolean(account);

  const AUTH_ROUTES = ["login", "register", "recover"];
  const KNOWN_ROUTES = ["today", "habits", "calendar", "stats", "settings"].concat(AUTH_ROUTES);

  function routeFromHash() {
    return (location.hash || "").replace(/^#\/?/, "").trim();
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("Не удалось сохранить данные:", error);
    }
  }

  /* ---------- вычисления ---------- */

  const activeHabits = () => state.habits.filter((habit) => !habit.archived);
  const habitById = (id) => state.habits.find((habit) => habit.id === id) || null;
  const valueOn = (habit, key) => Number(habit.log[key]) || 0;
  const isDone = (habit, key) => valueOn(habit, key) >= habit.target;

  function currentStreak(habit) {
    let cursor = dateKey();
    if (!isDone(habit, cursor)) cursor = addDays(cursor, -1);
    let count = 0;
    while (isDone(habit, cursor)) {
      count += 1;
      cursor = addDays(cursor, -1);
    }
    return count;
  }

  function bestStreak(habit) {
    const keys = Object.keys(habit.log)
      .filter((key) => isDone(habit, key))
      .sort();
    let best = 0;
    let run = 0;
    let previous = null;
    for (const key of keys) {
      run = previous && daysBetween(previous, key) === 1 ? run + 1 : 1;
      best = Math.max(best, run);
      previous = key;
    }
    return best;
  }

  function percentDone(habit, days) {
    const today = dateKey();
    let total = 0;
    let done = 0;
    for (let i = 0; i < days; i += 1) {
      const key = addDays(today, -i);
      if (key < habit.createdAt) continue;
      total += 1;
      if (isDone(habit, key)) done += 1;
    }
    return total ? Math.round((done / total) * 100) : 0;
  }

  function missesThisMonth(habit) {
    const now = new Date();
    let misses = 0;
    // Текущий день ещё не закончился — пропуском его не считаем.
    for (let day = 1; day < now.getDate(); day += 1) {
      const key = dateKey(new Date(now.getFullYear(), now.getMonth(), day));
      if (key < habit.createdAt) continue;
      if (!isDone(habit, key)) misses += 1;
    }
    return misses;
  }

  function categoryOf(id) {
    return state.categories.find((category) => category.id === id) || state.categories[0];
  }

  /* ---------- отрисовка ---------- */

  const app = $("#app");
  const modalRoot = $("#modalRoot");

  function render() {
    let route = routeFromHash();
    if (!route) route = session ? "today" : account ? "login" : "register";

    if (!KNOWN_ROUTES.includes(route)) {
      route = "404";
    } else {
      const isAuthRoute = AUTH_ROUTES.includes(route);
      if (!session) {
        if (!isAuthRoute) route = account ? "login" : "register";
      } else if (isAuthRoute) {
        route = "today";
      }
    }

    view = route;
    if (route !== "recover") recoverEmail = "";

    const tabs = $(".tabs");
    if (tabs) tabs.style.display = session ? "" : "none";

    $$(".tab").forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.view === view);
    });

    if (route === "today") app.innerHTML = renderToday();
    else if (route === "habits") app.innerHTML = renderHabits();
    else if (route === "calendar") app.innerHTML = renderCalendar();
    else if (route === "stats") app.innerHTML = renderStats();
    else if (route === "settings") app.innerHTML = renderSettings();
    else if (route === "login") app.innerHTML = renderLogin();
    else if (route === "register") app.innerHTML = renderRegister();
    else if (route === "recover") app.innerHTML = renderRecover();
    else app.innerHTML = renderNotFound();

    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  /* ---------- экраны входа ---------- */

  function renderLogin() {
    return `
      <div class="auth">
        <div class="auth-card">
          <div class="auth-logo">✓</div>
          <h1>Вход</h1>
          <p class="auth-sub">Войдите, чтобы открыть свои привычки</p>
          <form id="loginForm" novalidate>
            <div class="field">
              <label for="loginName">Логин</label>
              <input id="loginName" name="login" autocomplete="username" maxlength="20" required>
            </div>
            <div class="field">
              <label for="loginPassword">Пароль</label>
              <input id="loginPassword" name="password" type="password" autocomplete="current-password" required>
            </div>
            <div class="auth-error" id="authError" role="alert"></div>
            <button class="btn btn-primary auth-submit" type="submit">Войти</button>
          </form>
          <div class="auth-links">
            <a class="link" href="#/recover">Забыли пароль?</a>
            <a class="link" href="#/register">Регистрация</a>
          </div>
        </div>
      </div>`;
  }

  function renderRegister() {
    if (account) {
      return `
        <div class="auth">
          <div class="auth-card">
            <div class="auth-logo">✓</div>
            <h1>Аккаунт уже создан</h1>
            <p class="auth-sub">На этом устройстве уже есть аккаунт «${escapeHtml(account.login)}». Войдите в него, чтобы открыть привычки.</p>
            <a class="btn btn-primary auth-submit" href="#/login">Перейти ко входу</a>
          </div>
        </div>`;
    }
    return `
      <div class="auth">
        <div class="auth-card">
          <div class="auth-logo">✓</div>
          <h1>Регистрация</h1>
          <p class="auth-sub">Создайте аккаунт, чтобы вести свои привычки</p>
          <form id="registerForm" novalidate>
            <div class="field">
              <label for="regLogin">Логин</label>
              <input id="regLogin" name="login" autocomplete="username" maxlength="20" required>
              <span class="hint">3–20 символов: буквы, цифры, подчёркивание</span>
            </div>
            <div class="field">
              <label for="regEmail">Email</label>
              <input id="regEmail" name="email" type="email" autocomplete="email" required>
            </div>
            <div class="field">
              <label for="regPassword">Пароль</label>
              <input id="regPassword" name="password" type="password" autocomplete="new-password" required>
              <span class="hint">Не меньше 6 символов</span>
            </div>
            <div class="field">
              <label for="regConfirm">Подтверждение пароля</label>
              <input id="regConfirm" name="confirm" type="password" autocomplete="new-password" required>
            </div>
            <div class="auth-error" id="authError" role="alert"></div>
            <button class="btn btn-primary auth-submit" type="submit">Зарегистрироваться</button>
          </form>
          <div class="auth-links">
            <a class="link" href="#/login">Уже есть аккаунт? Войти</a>
          </div>
        </div>
      </div>`;
  }

  function renderRecover() {
    if (recoverEmail) {
      return `
        <div class="auth">
          <div class="auth-card">
            <div class="auth-logo">✓</div>
            <h1>Инструкция отправлена</h1>
            <p class="auth-sub">Мы отправили письмо со ссылкой для сброса пароля на адрес <b>${escapeHtml(recoverEmail)}</b>.</p>
            <ol class="auth-steps">
              <li>Откройте письмо и нажмите ссылку для сброса.</li>
              <li>Придумайте новый пароль.</li>
              <li>Вернитесь на страницу входа и войдите с новым паролем.</li>
            </ol>
            <p class="auth-note">Письмо не пришло? Проверьте папку «Спам» или попробуйте ещё раз.</p>
            <a class="btn btn-primary auth-submit" href="#/login">Вернуться ко входу</a>
            <p class="auth-note">Демо-режим: письма не отправляются, экран показывает, как это будет работать.</p>
          </div>
        </div>`;
    }

    return `
      <div class="auth">
        <div class="auth-card">
          <div class="auth-logo">✓</div>
          <h1>Восстановление пароля</h1>
          <p class="auth-sub">Укажите email, на который зарегистрирован аккаунт</p>
          <form id="recoverForm" novalidate>
            <div class="field">
              <label for="recoverEmail">Email</label>
              <input id="recoverEmail" name="email" type="email" autocomplete="email" required>
            </div>
            <div class="auth-error" id="authError" role="alert"></div>
            <button class="btn btn-primary auth-submit" type="submit">Отправить инструкцию</button>
          </form>
          <div class="auth-links">
            <a class="link" href="#/login">Вернуться ко входу</a>
          </div>
        </div>
      </div>`;
  }

  function renderNotFound() {
    return `
      <div class="auth">
        <div class="auth-card">
          <div class="auth-code">404</div>
          <h1>Страница не найдена</h1>
          <p class="auth-sub">Такой страницы нет или адрес введён с ошибкой.</p>
          <a class="btn btn-primary auth-submit" href="#/today">На главную</a>
        </div>
      </div>`;
  }

  function renderToday() {
    const today = dateKey();
    const list = activeHabits();
    const done = list.filter((habit) => isDone(habit, today)).length;
    const percent = list.length ? Math.round((done / list.length) * 100) : 0;
    const yesterday = addDays(today, -1);
    const doneYesterday = list.filter((habit) => isDone(habit, yesterday)).length;
    const delta = done - doneYesterday;

    const hour = new Date().getHours();
    const greeting = hour < 5 ? "Доброй ночи" : hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер";
    const namePart = state.profile.name ? ", " + escapeHtml(state.profile.name) : "";

    const rows = list.length
      ? list.map((habit) => {
        const value = valueOn(habit, today);
        const finished = isDone(habit, today);
        const streak = currentStreak(habit);
        const streakText = streak > 0
          ? `серия ${streak} ${plural(streak, ["день", "дня", "дней"])} · `
          : "";
        const stepper = habit.target > 1
          ? `<div class="stepper">
               <button data-action="dec" data-id="${habit.id}" aria-label="Уменьшить">−</button>
               <button data-action="inc" data-id="${habit.id}" aria-label="Увеличить">+</button>
             </div>`
          : "";
        return `
          <div class="habit-row ${finished ? "is-done" : ""}">
            <button class="check" data-action="toggle" data-id="${habit.id}" aria-pressed="${finished}"
              aria-label="${finished ? "Снять отметку" : "Отметить"}: ${escapeHtml(habit.name)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"
                stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            </button>
            <div class="habit-main">
              <div class="habit-title"><span class="habit-icon">${habit.icon}</span>${escapeHtml(habit.name)}</div>
              <div class="habit-meta">${streakText}${value}/${habit.target} ${escapeHtml(unitPlural(habit.unit))}</div>
            </div>
            ${stepper}
          </div>`;
      }).join("")
      : `<div class="empty">Пока нет привычек. Добавь первую в поле ниже.</div>`;

    const useful = list
      .filter((habit) => habit.target > 1 && habit.unit)
      .map((habit) => {
        let sum = 0;
        for (let i = 0; i < 30; i += 1) {
          const key = addDays(today, -i);
          if (key >= habit.createdAt) sum += valueOn(habit, key);
        }
        return { icon: habit.icon, name: habit.name, total: sum, unit: habit.unit };
      })
      .slice(0, 4);

    const usefulList = useful.length
      ? `<ul class="useful-list">${useful.map((item) => `
          <li><span>${item.icon} ${escapeHtml(item.name)}</span><b>${item.total} ${escapeHtml(unitText(item.unit, item.total))}</b></li>`).join("")}
        </ul>`
      : `<p>Добавь привычку с целью больше 1 — здесь появятся итоги за 30 дней.</p>`;

    const deltaText = delta > 0
      ? `На ${delta} больше, чем вчера`
      : delta < 0
        ? `На ${Math.abs(delta)} меньше, чем вчера`
        : "Столько же, сколько вчера";

    return `
      <div class="page-head">
        <h1>${greeting}${namePart}</h1>
        <p>${formatLong(new Date())}</p>
      </div>

      <div class="day-progress">
        <div class="day-progress-top">
          <strong>Выполнено ${done} из ${list.length}</strong>
          <span>${percent}%</span>
        </div>
        <div class="bar"><i style="width:${percent}%"></i></div>
      </div>

      <div class="section-title">Сегодня</div>
      <div class="habit-list">${rows}</div>

      <form class="quick-add" id="quickForm">
        <input name="name" maxlength="40" placeholder="Новая привычка, например «Медитация»" autocomplete="off" required>
        <button class="btn btn-primary" type="submit">Добавить</button>
      </form>

      <div class="section-title">Сводка</div>
      <div class="card-grid">
        <div class="card">
          <h3>Лучше, чем вчера</h3>
          <div class="big">${doneYesterday} → ${done}</div>
          <p>${deltaText}. Вчера выполнено ${doneYesterday} из ${list.length}.</p>
        </div>
        <div class="card">
          <h3>Статистика в виде пользы</h3>
          ${usefulList}
        </div>
      </div>`;
  }

  function renderHabits() {
    const list = state.habits.filter((habit) => (habitFilter === "active" ? !habit.archived : habit.archived));

    const categoryRows = state.categories.map((category) => {
      const count = state.habits.filter((habit) => habit.category === category.id).length;
      return `
        <div class="manage-row">
          <div class="habit-icon">${category.icon}</div>
          <div>
            <div class="manage-title">${escapeHtml(category.name)}</div>
            <div class="manage-sub">${count} ${plural(count, ["привычка", "привычки", "привычек"])}</div>
          </div>
          <div class="actions">
            <button class="btn btn-sm" data-action="edit-category" data-id="${category.id}">Изменить</button>
          </div>
        </div>`;
    }).join("");

    const rows = list.length
      ? list.map((habit) => {
        const category = categoryOf(habit.category);
        const streak = currentStreak(habit);
        const misses = missesThisMonth(habit);
        return `
          <div class="manage-row">
            <div class="habit-icon">${habit.icon}</div>
            <div>
              <div class="manage-title">${escapeHtml(habit.name)}</div>
              <div class="manage-sub">${category.name} · цель ${habit.target} ${escapeHtml(unitPlural(habit.unit))} · серия ${streak} · пропусков ${misses}/${habit.allowedMisses}</div>
            </div>
            <div class="actions">
              <button class="btn btn-sm" data-action="edit" data-id="${habit.id}">Изменить</button>
              <button class="btn btn-sm" data-action="archive" data-id="${habit.id}" data-flag="${habit.archived ? "0" : "1"}">
                ${habit.archived ? "Вернуть" : "В архив"}
              </button>
            </div>
          </div>`;
      }).join("")
      : `<div class="empty">${habitFilter === "active" ? "Активных привычек нет." : "В архиве пусто."}</div>`;

    return `
      <div class="page-head">
        <h1>Привычки</h1>
        <p>Все привычки, их цели и пропуски</p>
      </div>

      <div class="chips">
        <button class="chip ${habitFilter === "active" ? "is-active" : ""}" data-action="filter" data-flag="active">Активные</button>
        <button class="chip ${habitFilter === "archive" ? "is-active" : ""}" data-action="filter" data-flag="archive">Архив</button>
      </div>

      <div class="habit-list">${rows}</div>

      <div class="row-buttons" style="margin-top:14px">
        <button class="btn btn-primary" data-action="new-habit">Новая привычка</button>
      </div>

      <div class="section-title">Категории</div>
      <div class="habit-list">${categoryRows}</div>

      <div class="row-buttons" style="margin-top:10px">
        <button class="btn" data-action="new-category">Новая категория</button>
      </div>`;
  }

  function renderCalendar() {
    const habits = activeHabits();
    if (!calendarHabitId || !habitById(calendarHabitId)) {
      calendarHabitId = habits.length ? habits[0].id : null;
    }
    const habit = habitById(calendarHabitId);
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const monthTitle = calendarMonth.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
    const today = dateKey();

    const options = habits.map((item) => `
      <option value="${item.id}" ${item.id === calendarHabitId ? "selected" : ""}>${item.icon} ${escapeHtml(item.name)}</option>`).join("");

    const firstDay = new Date(year, month, 1);
    const offset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let cells = "";
    for (let i = 0; i < offset; i += 1) cells += `<div></div>`;
    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = dateKey(new Date(year, month, day));
      let classes = "day";
      let title = "";
      if (habit) {
        const value = valueOn(habit, key);
        if (isDone(habit, key)) classes += " is-done";
        else if (value > 0) classes += " is-partial";
        title = `${value}/${habit.target} ${unitPlural(habit.unit)}`;
      }
      if (key === today) classes += " is-today";
      if (key > today) classes += " is-future";
      cells += `<button class="${classes}" data-action="toggle-day" data-date="${key}" title="${escapeHtml(title)}">${day}</button>`;
    }

    return `
      <div class="page-head">
        <h1>Календарь</h1>
        <p>Отметки по дням. Можно исправить прошлые дни.</p>
      </div>

      ${habits.length ? `
        <div class="field" style="max-width:320px">
          <label for="calendarSelect">Привычка</label>
          <select id="calendarSelect" class="calendar-select">${options}</select>
        </div>

        <div class="card" style="max-width:640px">
          <div class="calendar-head">
            <div class="calendar-title">${monthTitle}</div>
            <div class="calendar-nav">
              <button class="icon-btn" data-action="cal-prev" aria-label="Предыдущий месяц">‹</button>
              <button class="icon-btn" data-action="cal-next" aria-label="Следующий месяц">›</button>
            </div>
          </div>
          <div class="weekdays">
            <div>Пн</div><div>Вт</div><div>Ср</div><div>Чт</div><div>Пт</div><div>Сб</div><div>Вс</div>
          </div>
          <div class="days">${cells}</div>
          <div class="legend">
            <span><i class="dot done"></i> выполнено</span>
            <span><i class="dot partial"></i> частично</span>
            <span><i class="dot"></i> пусто</span>
          </div>
        </div>` : `<div class="empty">Сначала добавь привычку.</div>`}`;
  }

  function renderStats() {
    const today = dateKey();
    const list = activeHabits();
    const doneToday = list.filter((habit) => isDone(habit, today)).length;
    const topStreak = list.reduce((max, habit) => Math.max(max, currentStreak(habit)), 0);

    let bestDay = { key: null, count: 0 };
    for (let i = 0; i < 60; i += 1) {
      const key = addDays(today, -i);
      const count = list.filter((habit) => isDone(habit, key)).length;
      if (count > bestDay.count) bestDay = { key, count };
    }
    const bestDayText = bestDay.key
      ? `${parseKey(bestDay.key).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} — ${bestDay.count}`
      : "—";

    const cards = list.length
      ? list.map((habit) => {
        const bars = [];
        for (let i = 13; i >= 0; i -= 1) {
          const key = addDays(today, -i);
          bars.push(`<i class="${isDone(habit, key) ? "done" : ""}" title="${key}"></i>`);
        }
        return `
          <div class="habit-stat">
            <div class="habit-stat-head">
              <span class="habit-icon">${habit.icon}</span>
              <span class="name">${escapeHtml(habit.name)}</span>
              <span class="cat">${categoryOf(habit.category).name}</span>
            </div>
            <div class="percent-row">
              <div class="percent-cell"><b>${percentDone(habit, 7)}%</b><span>за 7 дней</span></div>
              <div class="percent-cell"><b>${percentDone(habit, 15)}%</b><span>за 15 дней</span></div>
              <div class="percent-cell"><b>${percentDone(habit, 30)}%</b><span>за 30 дней</span></div>
            </div>
            <div class="mini-bars">${bars.join("")}</div>
            <div class="stat-meta">
              <span>Текущая серия: <b>${currentStreak(habit)}</b></span>
              <span>Лучшая серия: <b>${bestStreak(habit)}</b></span>
              <span>Пропусков в месяце: <b>${missesThisMonth(habit)}</b></span>
            </div>
          </div>`;
      }).join("")
      : `<div class="empty">Нет данных для статистики.</div>`;

    return `
      <div class="page-head">
        <h1>Статистика</h1>
        <p>Прогресс по каждой привычке и общая картина</p>
      </div>

      <div class="stat-grid">
        <div class="stat"><div class="label">Привычек</div><div class="value">${list.length}</div></div>
        <div class="stat"><div class="label">Выполнено сегодня</div><div class="value">${doneToday}</div></div>
        <div class="stat"><div class="label">Лучшая серия</div><div class="value">${topStreak}</div></div>
        <div class="stat"><div class="label">Лучший день</div><div class="value" style="font-size:18px">${bestDayText}</div></div>
      </div>

      <div class="section-title">По привычкам</div>
      <div class="habit-list">${cards}</div>`;
  }

  function renderSettings() {
    return `
      <div class="page-head">
        <h1>Настройки</h1>
        <p>Аккаунт, профиль, тема и данные</p>
      </div>

      <div class="settings-block">
        <h2>Аккаунт</h2>
        <p>Вы вошли как <b>${escapeHtml(account ? account.login : "")}</b>${account && account.email ? ` · ${escapeHtml(account.email)}` : ""}.</p>
        <div class="row-buttons">
          <button class="btn" data-action="logout">Выйти</button>
        </div>
      </div>

      <div class="settings-block">
        <h2>Профиль</h2>
        <p>Имя показывается в приветствии на главной.</p>
        <div class="field">
          <label for="settingsName">Имя</label>
          <input id="settingsName" maxlength="30" value="${escapeHtml(state.profile.name)}" placeholder="Как тебя зовут">
        </div>
      </div>

      <div class="settings-block">
        <h2>Тема</h2>
        <p>Светлая и тёмная — переключаются кнопкой в шапке или здесь.</p>
        <div class="row-buttons">
          <button class="btn ${state.theme === "light" ? "btn-primary" : ""}" data-action="theme-light">Светлая</button>
          <button class="btn ${state.theme === "dark" ? "btn-primary" : ""}" data-action="theme-dark">Тёмная</button>
        </div>
      </div>

      <div class="settings-block">
        <h2>Данные</h2>
        <p>Всё хранится в этом браузере. Экспорт — резервная копия в файле JSON.</p>
        <div class="row-buttons">
          <button class="btn" data-action="export">Скачать данные</button>
          <button class="btn btn-danger" data-action="reset">Удалить все данные</button>
        </div>
      </div>

      <div class="settings-block">
        <h2>О приложении</h2>
        <p>Учебный MVP кейса №1: личный трекер привычек. Версия 1.0. Без сервера и регистрации — данные остаются в браузере.</p>
      </div>`;
  }

  /* ---------- действия ---------- */

  let toastTimer = null;

  function toast(message) {
    const node = $("#toast");
    node.textContent = message;
    node.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove("is-visible"), 2200);
  }

  function applyTheme() {
    document.documentElement.dataset.theme = state.theme;
  }

  function toggleTheme() {
    state.theme = state.theme === "light" ? "dark" : "light";
    applyTheme();
    save();
    render();
  }

  function toggleHabit(id, date = dateKey()) {
    const habit = habitById(id);
    if (!habit) return;
    if (isDone(habit, date)) delete habit.log[date];
    else habit.log[date] = habit.target;
    save();
    render();
  }

  function changeValue(id, delta) {
    const habit = habitById(id);
    if (!habit) return;
    const today = dateKey();
    const next = Math.min(habit.target, Math.max(0, valueOn(habit, today) + delta));
    if (next === 0) delete habit.log[today];
    else habit.log[today] = next;
    save();
    render();
  }

  function addQuickHabit(name) {
    state.habits.push({
      id: "h" + Date.now().toString(36),
      name,
      icon: "✅",
      color: "#16a34a",
      category: state.categories[0].id,
      unit: "раз",
      target: 1,
      allowedMisses: 2,
      createdAt: dateKey(),
      archived: false,
      log: {},
    });
    save();
    render();
    toast("Привычка добавлена");
  }

  function deleteHabit(id) {
    const habit = habitById(id);
    if (!habit) return;
    const ok = window.confirm(`Удалить привычку «${habit.name}» и всю историю отметок?`);
    if (!ok) return;
    state.habits = state.habits.filter((item) => item.id !== id);
    save();
    closeModal();
    render();
    toast("Привычка удалена");
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `habits-${dateKey()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    toast("Файл с данными сохранён");
  }

  function resetData() {
    const ok = window.confirm("Удалить все привычки и историю? Это действие нельзя отменить.");
    if (!ok) return;
    state.habits = [];
    save();
    render();
    toast("Данные удалены");
  }

  /* ---------- модальное окно ---------- */

  function openHabitModal(id) {
    const editing = id ? habitById(id) : null;
    const draft = editing || {
      name: "", icon: "✅", color: "#16a34a", category: state.categories[0].id, unit: "раз", target: 1, allowedMisses: 2,
    };

    const categoryOptions = state.categories.map((category) => `
      <option value="${category.id}" ${category.id === draft.category ? "selected" : ""}>${category.icon} ${category.name}</option>`).join("");

    const emojiButtons = EMOJIS.map((emoji) => `
      <button type="button" class="emoji-btn ${emoji === draft.icon ? "is-active" : ""}" data-emoji="${emoji}">${emoji}</button>`).join("");

    modalRoot.innerHTML = `
      <div class="modal-overlay">
        <div class="modal" role="dialog" aria-modal="true" aria-label="${editing ? "Редактирование привычки" : "Новая привычка"}">
          <div class="modal-head">
            <h2>${editing ? "Редактирование" : "Новая привычка"}</h2>
            <button class="icon-btn" data-action="close-modal" aria-label="Закрыть">×</button>
          </div>
          <form id="habitForm">
            <input type="hidden" name="habitId" value="${editing ? editing.id : ""}">
            <div class="field">
              <label for="hName">Название</label>
              <input id="hName" name="name" required maxlength="40" value="${escapeHtml(draft.name)}" placeholder="Например, Вода">
            </div>
            <div class="field">
              <label>Иконка</label>
              <div class="emoji-grid" id="emojiGrid">${emojiButtons}</div>
              <input type="hidden" name="icon" id="hIcon" value="${draft.icon}">
            </div>
            <div class="field">
              <label for="hCategory">Категория</label>
              <select id="hCategory" name="category">${categoryOptions}</select>
            </div>
            <div class="field">
              <label for="hColor">Цвет</label>
              <div class="color-row">
                <input type="color" id="hColor" name="color" value="${draft.color}">
                <span class="hint">Цвет отметки и графика</span>
              </div>
            </div>
            <div class="field">
              <label for="hTarget">Цель в день и единица</label>
              <div class="row-buttons">
                <input id="hTarget" name="target" type="number" min="1" max="999" value="${draft.target}" style="max-width:110px">
                <input id="hUnit" name="unit" maxlength="20" value="${escapeHtml(draft.unit)}" placeholder="стаканов" style="flex:1">
              </div>
            </div>
            <div class="field">
              <label for="hMisses">Допустимо пропусков в месяц</label>
              <input id="hMisses" name="allowedMisses" type="number" min="0" max="31" value="${draft.allowedMisses}" style="max-width:110px">
            </div>
            <div class="modal-actions">
              ${editing ? `<button type="button" class="btn btn-danger" data-action="delete-habit" data-id="${editing.id}">Удалить</button>` : ""}
              <button type="button" class="btn" data-action="close-modal">Отмена</button>
              <button type="submit" class="btn btn-primary">Сохранить</button>
            </div>
          </form>
        </div>
      </div>`;

    setTimeout(() => { const input = $("#hName"); if (input) input.focus(); }, 30);
  }

  function closeModal() {
    modalRoot.innerHTML = "";
  }

  function submitHabitForm(form) {
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    if (!name) return;
    const id = String(data.get("habitId") || "");
    const payload = {
      name,
      icon: String(data.get("icon") || "✅"),
      color: String(data.get("color") || "#16a34a"),
      category: String(data.get("category") || "health"),
      unit: String(data.get("unit") || "раз").trim() || "раз",
      target: Math.max(1, Number(data.get("target")) || 1),
      allowedMisses: Math.max(0, Number(data.get("allowedMisses")) || 0),
    };

    if (id) {
      const habit = habitById(id);
      if (habit) Object.assign(habit, payload);
      toast("Привычка обновлена");
    } else {
      state.habits.push({
        id: "h" + Date.now().toString(36),
        ...payload,
        createdAt: dateKey(),
        archived: false,
        log: {},
      });
      toast("Привычка добавлена");
    }
    save();
    closeModal();
    render();
  }

  function openCategoryModal(id) {
    const editing = id ? state.categories.find((category) => category.id === id) : null;
    const draft = editing || { name: "", icon: "✅" };

    const emojiButtons = EMOJIS.map((emoji) => `
      <button type="button" class="emoji-btn ${emoji === draft.icon ? "is-active" : ""}" data-emoji="${emoji}">${emoji}</button>`).join("");

    modalRoot.innerHTML = `
      <div class="modal-overlay">
        <div class="modal" role="dialog" aria-modal="true" aria-label="${editing ? "Редактирование категории" : "Новая категория"}">
          <div class="modal-head">
            <h2>${editing ? "Редактирование категории" : "Новая категория"}</h2>
            <button class="icon-btn" data-action="close-modal" aria-label="Закрыть">×</button>
          </div>
          <form id="categoryForm">
            <input type="hidden" name="categoryId" value="${editing ? editing.id : ""}">
            <div class="field">
              <label for="cName">Название</label>
              <input id="cName" name="name" required maxlength="40" value="${escapeHtml(draft.name)}" placeholder="Например, Финансы">
            </div>
            <div class="field">
              <label>Иконка</label>
              <div class="emoji-grid" id="emojiGrid">${emojiButtons}</div>
              <input type="hidden" name="icon" id="cIcon" value="${draft.icon}">
            </div>
            <div class="modal-actions">
              <button type="button" class="btn" data-action="close-modal">Отмена</button>
              <button type="submit" class="btn btn-primary">Сохранить</button>
            </div>
          </form>
        </div>
      </div>`;

    setTimeout(() => { const input = $("#cName"); if (input) input.focus(); }, 30);
  }

  function submitCategoryForm(form) {
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    if (!name) return;
    const id = String(data.get("categoryId") || "");
    const icon = String(data.get("icon") || "✅");

    const duplicate = state.categories.some(
      (category) => category.id !== id && category.name.toLowerCase() === name.toLowerCase(),
    );
    if (duplicate) {
      toast("Такая категория уже есть");
      return;
    }

    if (id) {
      const category = state.categories.find((item) => item.id === id);
      if (category) {
        category.name = name;
        category.icon = icon;
      }
      toast("Категория обновлена");
    } else {
      state.categories.push({ id: "c" + Date.now().toString(36), name, icon });
      toast("Категория добавлена");
    }
    save();
    closeModal();
    render();
  }

  /* ---------- вход, регистрация, восстановление ---------- */

  function setAuthError(message) {
    const box = $("#authError");
    if (box) box.textContent = message;
  }

  async function handleLogin(form) {
    const data = new FormData(form);
    const login = String(data.get("login") || "").trim();
    const password = String(data.get("password") || "");

    if (!account) {
      setAuthError("Аккаунт не найден. Сначала зарегистрируйтесь.");
      return;
    }
    if (!login || !password) {
      setAuthError("Введите логин и пароль");
      return;
    }
    if (login.toLowerCase() !== account.login.toLowerCase()) {
      setAuthError("Неверный логин или пароль");
      return;
    }
    const hash = await hashPassword(password, account.salt);
    if (hash !== account.hash) {
      setAuthError("Неверный логин или пароль");
      return;
    }
    setSession(true);
    if (location.hash === "#/today") render();
    else location.hash = "#/today";
  }

  async function handleRegister(form) {
    const data = new FormData(form);
    const login = String(data.get("login") || "").trim();
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    const confirm = String(data.get("confirm") || "");

    if (account) {
      setAuthError("Аккаунт уже создан. Войдите.");
      return;
    }
    if (!/^[A-Za-z0-9_]{3,20}$/.test(login)) {
      setAuthError("Логин: 3–20 символов, буквы, цифры или подчёркивание");
      return;
    }
    if (!isEmail(email)) {
      setAuthError("Введите корректный email");
      return;
    }
    if (password.length < 6) {
      setAuthError("Пароль должен быть не короче 6 символов");
      return;
    }
    if (password !== confirm) {
      setAuthError("Пароли не совпадают");
      return;
    }

    const salt = randomSalt();
    const hash = await hashPassword(password, salt);
    saveAccount({ login, email, salt, hash, createdAt: new Date().toISOString() });
    setSession(true);
    if (location.hash === "#/today") render();
    else location.hash = "#/today";
  }

  function handleRecover(form) {
    const data = new FormData(form);
    const email = String(data.get("email") || "").trim();
    if (!isEmail(email)) {
      setAuthError("Введите корректный email");
      return;
    }
    recoverEmail = email;
    render();
  }

  function logout() {
    setSession(false);
    recoverEmail = "";
    if (location.hash === "#/login") render();
    else location.hash = "#/login";
  }

  /* ---------- события ---------- */

  document.addEventListener("click", (event) => {
    const tab = event.target.closest(".tab");
    if (tab) {
      const next = "#/" + tab.dataset.view;
      if (location.hash === next) render();
      else location.hash = next;
      return;
    }

    if (event.target.closest("#themeToggle")) {
      toggleTheme();
      return;
    }

    const overlay = event.target.closest(".modal-overlay");
    if (overlay && event.target === overlay) {
      closeModal();
      return;
    }

    const emojiButton = event.target.closest("[data-emoji]");
    if (emojiButton) {
      $$(".emoji-btn", modalRoot).forEach((button) => button.classList.remove("is-active"));
      emojiButton.classList.add("is-active");
      const hidden = $("#hIcon") || $("#cIcon");
      if (hidden) hidden.value = emojiButton.dataset.emoji;
      return;
    }

    const button = event.target.closest("[data-action]");
    if (!button) return;
    const { action, id, date, flag } = button.dataset;

    if (action === "toggle") toggleHabit(id);
    else if (action === "inc") changeValue(id, 1);
    else if (action === "dec") changeValue(id, -1);
    else if (action === "toggle-day") toggleHabit(calendarHabitId, date);
    else if (action === "edit") openHabitModal(id);
    else if (action === "archive") {
      const habit = habitById(id);
      if (habit) {
        habit.archived = flag === "1";
        save();
        render();
        toast(habit.archived ? "Привычка в архиве" : "Привычка возвращена");
      }
    } else if (action === "delete-habit") deleteHabit(id);
    else if (action === "new-habit") openHabitModal(null);
    else if (action === "new-category") openCategoryModal(null);
    else if (action === "edit-category") openCategoryModal(id);
    else if (action === "close-modal") closeModal();
    else if (action === "filter") {
      habitFilter = flag;
      render();
    } else if (action === "cal-prev") {
      calendarMonth.setMonth(calendarMonth.getMonth() - 1);
      render();
    } else if (action === "cal-next") {
      calendarMonth.setMonth(calendarMonth.getMonth() + 1);
      render();
    } else if (action === "theme-light") {
      state.theme = "light";
      applyTheme();
      save();
      render();
    } else if (action === "theme-dark") {
      state.theme = "dark";
      applyTheme();
      save();
      render();
    } else if (action === "export") exportData();
    else if (action === "reset") resetData();
    else if (action === "logout") logout();
  });

  document.addEventListener("submit", (event) => {
    if (event.target.getAttribute("id") === "quickForm") {
      event.preventDefault();
      const input = event.target.querySelector("input[name=name]");
      const name = (input.value || "").trim();
      if (name) addQuickHabit(name);
      return;
    }
    if (event.target.getAttribute("id") === "habitForm") {
      event.preventDefault();
      submitHabitForm(event.target);
    }
    if (event.target.getAttribute("id") === "categoryForm") {
      event.preventDefault();
      submitCategoryForm(event.target);
    }
    if (event.target.getAttribute("id") === "loginForm") {
      event.preventDefault();
      handleLogin(event.target);
    }
    if (event.target.getAttribute("id") === "registerForm") {
      event.preventDefault();
      handleRegister(event.target);
    }
    if (event.target.getAttribute("id") === "recoverForm") {
      event.preventDefault();
      handleRecover(event.target);
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.id === "calendarSelect") {
      calendarHabitId = event.target.value;
      render();
    }
    if (event.target.id === "settingsName") {
      state.profile.name = event.target.value.trim();
      save();
      toast("Имя сохранено");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });

  /* ---------- старт ---------- */

  window.addEventListener("hashchange", render);

  applyTheme();

  if (!location.hash) {
    location.hash = "#/" + (session ? "today" : account ? "login" : "register");
  }

  render();
})();
