import { api } from "./api.js";
import {
  buildCsv,
  countBy,
  downloadTextFile,
  escapeHtml,
  filterByPeriod,
  formatDate,
  formatMoney,
  formatNumber,
  getCategoryTotals,
  getPaymentTotals,
  getPresetRange,
  getProductRanking,
  getStatusTotals,
  groupByDay,
  groupByMonth,
  groupByWeek,
  sortByDateDesc,
  sumBy,
  todayIso,
  toFormValue,
} from "./helpers.js";
import { renderBadge, renderBarChart, renderEmptyState, renderMetricCard, renderStatList } from "./charts.js";

const BRAND_NAME = "MATERIAL DE CONSTRUÇÃO DOIS IRMÃOS ONDE HABITA BENÇÃOS";
const QUOTE_ITEM_UNITS = ["UN", "MT", "M²", "M³", "KG", "SC", "CX", "PCT", "LT", "Outro"];
const NOTIFICATION_SESSION_KEY = "doisirmaos.notifications.v1";
const TOP_ALERT_SESSION_KEY = "doisirmaos.top-alerts.v1";
const NOTIFICATION_GREETING_NAME = "Sergio";
const DEV_HOST_REGEX = /^(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})$/;

const pageTitles = {
  dashboard: "Dashboard",
  products: "Produtos",
  customers: "Clientes",
  sales: "Vendas",
  quotes: "Orçamentos",
  expenses: "Contas Pagas",
  checks: "Cheques",
  reports: "Relatórios",
};

const BRAND_LOGO_PATH = "/assets/brand/logo_dois_irmaos_final.png";

const monthStart = (() => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
})();

const state = {
  user: null,
  page: "dashboard",
  pwa: {
    deferredPrompt: null,
    installReady: false,
  },
  notifications: {
    items: [],
    open: false,
  },
  topAlert: null,
  data: {
    products: [],
    customers: [],
    sales: [],
    quotes: [],
    expenses: [],
    checks: [],
    options: {
      payment_methods: [],
      sales_payment_methods: [],
      product_units: [],
      quote_item_units: [],
      quote_statuses: [],
      check_statuses: [],
    },
  },
  editing: {
    products: null,
    customers: null,
    sales: null,
    quotes: null,
    expenses: null,
    checks: null,
  },
  formFeedback: {
    products: null,
    customers: null,
    sales: null,
    quotes: null,
    expenses: null,
    checks: null,
  },
  filters: {
    dashboard: { preset: "month", day: todayIso(), start: monthStart, end: todayIso() },
    products: { search: "" },
    customers: { search: "" },
    sales: { preset: "month", day: todayIso(), start: monthStart, end: todayIso(), search: "" },
    quotes: { search: "", status: "" },
    expenses: { preset: "month", day: todayIso(), start: monthStart, end: todayIso(), search: "" },
    checks: { preset: "month", day: todayIso(), start: monthStart, end: todayIso(), search: "", status: "" },
    reports: { module: "sales", preset: "month", day: todayIso(), start: monthStart, end: todayIso() },
  },
  focusField: null,
};

const searchTimers = new Map();
const formScopeMap = {
  "products-form": "products",
  "customers-form": "customers",
  "sales-form": "sales",
  "quotes-form": "quotes",
  "expenses-form": "expenses",
  "checks-form": "checks",
};

const elements = {
  loginView: document.getElementById("login-view"),
  appShell: document.getElementById("app-shell"),
  loginForm: document.getElementById("login-form"),
  loginError: document.getElementById("login-error"),
  pageContent: document.getElementById("page-content"),
  topAlertContainer: document.getElementById("top-alert-container"),
  pageTitle: document.getElementById("page-title"),
  currentUserName: document.getElementById("current-user-name"),
  installAppButton: document.getElementById("install-app-button"),
  logoutButton: document.getElementById("logout-button"),
  notificationCenter: document.getElementById("notification-center"),
  notificationsButton: document.getElementById("notifications-button"),
  notificationsBadge: document.getElementById("notifications-badge"),
  notificationsPanel: document.getElementById("notifications-panel"),
  notificationsList: document.getElementById("notifications-list"),
  notificationsClearButton: document.getElementById("notifications-clear"),
  notificationsSubtitle: document.getElementById("notifications-subtitle"),
  toastContainer: document.getElementById("toast-container"),
  sidebar: document.getElementById("sidebar"),
  sidebarBackdrop: document.getElementById("sidebar-backdrop"),
  openSidebarButton: document.getElementById("open-sidebar"),
  closeSidebarButton: document.getElementById("close-sidebar"),
  navLinks: [...document.querySelectorAll(".nav-link")],
};


document.addEventListener("DOMContentLoaded", init);


async function init() {
  bindGlobalEvents();
  registerPwaSupport();

  try {
    const response = await api.me();
    state.user = response.user;
    showApp();
    await loadData();
  } catch {
    showLogin();
  }
}


function bindGlobalEvents() {
  elements.loginForm.addEventListener("submit", handleLoginSubmit);
  elements.installAppButton?.addEventListener("click", handleInstallApp);
  elements.logoutButton.addEventListener("click", handleLogout);
  elements.notificationsButton?.addEventListener("click", handleNotificationsToggle);
  elements.notificationsClearButton?.addEventListener("click", handleClearNotifications);
  elements.notificationsList?.addEventListener("click", handleNotificationListClick);
  elements.topAlertContainer?.addEventListener("click", handleTopAlertClick);
  elements.openSidebarButton.addEventListener("click", () => toggleSidebar(true));
  elements.closeSidebarButton.addEventListener("click", () => toggleSidebar(false));
  elements.sidebarBackdrop.addEventListener("click", () => toggleSidebar(false));

  elements.navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      setPage(link.dataset.page);
    });
  });

  elements.pageContent.addEventListener("click", handlePageClick);
  elements.pageContent.addEventListener("beforeinput", handlePageBeforeInput);
  elements.pageContent.addEventListener("paste", handlePagePaste);
  elements.pageContent.addEventListener("focusin", handlePageFocusIn);
  elements.pageContent.addEventListener("submit", handlePageSubmit, true);
  elements.pageContent.addEventListener("change", handlePageChange);
  elements.pageContent.addEventListener("input", handlePageInput);
  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("keydown", handleGlobalKeyDown);
  window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  window.addEventListener("appinstalled", handleAppInstalled);
}


function showLogin() {
  elements.loginView.classList.remove("hidden");
  elements.appShell.classList.add("hidden");
  state.notifications.items = [];
  state.notifications.open = false;
  state.topAlert = null;
  renderNotifications();
  renderTopAlert();
  updateInstallButtonVisibility();
}


function showApp() {
  elements.loginView.classList.add("hidden");
  elements.appShell.classList.remove("hidden");
  elements.currentUserName.textContent = state.user?.full_name || "Administrador";
  renderNotifications();
  renderTopAlert();
  updateInstallButtonVisibility();
}


function isStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}


function isMobileInstallSurface() {
  return window.matchMedia("(max-width: 960px)").matches || /android|iphone|ipad|ipod/i.test(window.navigator.userAgent);
}


function canRegisterServiceWorker() {
  const localhostHosts = new Set(["localhost", "127.0.0.1"]);
  return window.isSecureContext || localhostHosts.has(window.location.hostname);
}


function shouldDisableServiceWorkerCaching() {
  return (
    window.location.protocol !== "https:"
    || DEV_HOST_REGEX.test(window.location.hostname)
    || window.location.port === "8000"
  );
}


async function clearBrowserCaches() {
  if (!("caches" in window)) return;
  const keys = await window.caches.keys();
  await Promise.all(keys.map((key) => window.caches.delete(key)));
}


async function unregisterServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
}


async function registerPwaSupport() {
  if (!("serviceWorker" in navigator) || !canRegisterServiceWorker()) {
    updateInstallButtonVisibility();
    return;
  }

  if (shouldDisableServiceWorkerCaching()) {
    try {
      await unregisterServiceWorkers();
      await clearBrowserCaches();
    } catch (error) {
      console.warn("Não foi possível limpar o cache de desenvolvimento do PWA.", error);
    } finally {
      updateInstallButtonVisibility();
    }
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register("/service-worker.js", {
      updateViaCache: "none",
    });
    await registration.update();
    if (registration.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
  } catch (error) {
    console.warn("Não foi possível registrar o service worker.", error);
  } finally {
    updateInstallButtonVisibility();
  }
}


function updateInstallButtonVisibility() {
  if (!elements.installAppButton) return;
  const appVisible = !elements.appShell.classList.contains("hidden");
  const shouldShow = appVisible && !isStandaloneMode() && (state.pwa.installReady || isMobileInstallSurface());
  elements.installAppButton.classList.toggle("hidden", !shouldShow);
}


function localTodayIso() {
  const today = new Date();
  const year = String(today.getFullYear());
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}


function readNotificationSessionState() {
  try {
    const rawValue = window.sessionStorage.getItem(NOTIFICATION_SESSION_KEY);
    if (!rawValue) {
      return { dismissedIds: [] };
    }
    const parsedValue = JSON.parse(rawValue);
    return {
      dismissedIds: Array.isArray(parsedValue?.dismissedIds) ? parsedValue.dismissedIds : [],
    };
  } catch {
    return { dismissedIds: [] };
  }
}


function writeNotificationSessionState(nextState) {
  try {
    window.sessionStorage.setItem(
      NOTIFICATION_SESSION_KEY,
      JSON.stringify({
        dismissedIds: [...new Set(nextState?.dismissedIds || [])],
      }),
    );
  } catch {
    // Se o navegador bloquear sessionStorage, o centro de notificações segue funcionando só em memória.
  }
}


function readTopAlertSessionState() {
  try {
    const rawValue = window.sessionStorage.getItem(TOP_ALERT_SESSION_KEY);
    if (!rawValue) {
      return { dismissedIds: [] };
    }
    const parsedValue = JSON.parse(rawValue);
    return {
      dismissedIds: Array.isArray(parsedValue?.dismissedIds) ? parsedValue.dismissedIds : [],
    };
  } catch {
    return { dismissedIds: [] };
  }
}


function writeTopAlertSessionState(nextState) {
  try {
    window.sessionStorage.setItem(
      TOP_ALERT_SESSION_KEY,
      JSON.stringify({
        dismissedIds: [...new Set(nextState?.dismissedIds || [])],
      }),
    );
  } catch {
    // Se o navegador bloquear sessionStorage, o alerta segue funcionando apenas na sessão em memória.
  }
}


function buildTopAlert() {
  const alert = state.topAlert;
  if (!alert?.has_alert || Number(alert.total_amount || 0) <= 0) {
    return null;
  }

  const dismissedIds = new Set(readTopAlertSessionState().dismissedIds);
  if (dismissedIds.has(alert.id)) {
    return null;
  }

  return {
    ...alert,
    message: `⚠️ Olá ${NOTIFICATION_GREETING_NAME}, hoje temos ${formatMoney(alert.total_amount)} de cheque para cair!`,
  };
}


function renderTopAlert() {
  if (!elements.topAlertContainer) return;

  const alert = buildTopAlert();
  elements.topAlertContainer.innerHTML = alert ? `
    <section class="top-check-alert" data-alert-id="${escapeHtml(alert.id)}" role="status" aria-live="polite">
      <div class="top-check-alert-copy">
        <strong>${escapeHtml(alert.message)}</strong>
        <small>${escapeHtml(`${alert.count} cheque(s) previstos para ${formatDate(alert.date)}.`)}</small>
      </div>
      <button
        type="button"
        class="top-check-alert-close"
        data-action="dismiss-top-alert"
        data-alert-id="${escapeHtml(alert.id)}"
        aria-label="Fechar alerta"
      >
        ×
      </button>
    </section>
  ` : "";
}


function dismissTopAlert(alertId) {
  if (!alertId) return;
  const sessionState = readTopAlertSessionState();
  writeTopAlertSessionState({
    dismissedIds: [...sessionState.dismissedIds, alertId],
  });
  renderTopAlert();
}


function handleTopAlertClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const dismissButton = target.closest('[data-action="dismiss-top-alert"]');
  if (!dismissButton) return;

  dismissTopAlert(dismissButton.dataset.alertId);
}


function buildNotifications() {
  const today = localTodayIso();
  const dismissedIds = new Set(readNotificationSessionState().dismissedIds);
  const notifications = [];

  const checksDueToday = state.data.checks.filter((check) => (
    check.due_date === today
    && !["Compensado", "Cancelado"].includes(check.effective_status || check.status || "")
  ));

  const totalDueToday = sumBy(checksDueToday, (check) => check.amount);
  const todayCheckNotificationId = `checks-due-today-${today}`;

  if (checksDueToday.length && totalDueToday > 0 && !dismissedIds.has(todayCheckNotificationId)) {
    notifications.push({
      id: todayCheckNotificationId,
      tone: "warning",
      title: "Cheque previsto para hoje",
      message: `Olá ${NOTIFICATION_GREETING_NAME}, hoje temos ${formatMoney(totalDueToday)} de cheque para cair!`,
      meta: `${checksDueToday.length} cheque(s) com data prevista em ${formatDate(today)}.`,
    });
  }

  return notifications;
}


function renderNotifications() {
  const items = state.notifications.items || [];
  const count = items.length;

  if (elements.notificationsBadge) {
    elements.notificationsBadge.textContent = String(count);
    elements.notificationsBadge.classList.toggle("hidden", count === 0);
  }

  if (elements.notificationsButton) {
    elements.notificationsButton.setAttribute("aria-expanded", state.notifications.open ? "true" : "false");
  }

  if (elements.notificationsPanel) {
    elements.notificationsPanel.classList.toggle("hidden", !state.notifications.open);
  }

  if (elements.notificationsClearButton) {
    elements.notificationsClearButton.classList.toggle("hidden", count === 0);
  }

  if (elements.notificationsSubtitle) {
    elements.notificationsSubtitle.textContent = count
      ? `${count} notificação(ões) ativa(s)`
      : "Sem alertas no momento.";
  }

  if (elements.notificationsList) {
    elements.notificationsList.innerHTML = count
      ? items.map((notification) => `
        <article class="notification-item notification-${escapeHtml(notification.tone || "default")}">
          <div class="notification-copy">
            <strong>${escapeHtml(notification.title)}</strong>
            <p>${escapeHtml(notification.message)}</p>
            ${notification.meta ? `<small>${escapeHtml(notification.meta)}</small>` : ""}
          </div>
          <button
            type="button"
            class="notification-remove"
            data-notification-id="${escapeHtml(notification.id)}"
            aria-label="Dispensar notificação"
          >
            ×
          </button>
        </article>
      `).join("")
      : `
        <div class="notifications-empty">
          <strong>Nenhuma notificação</strong>
          <span>Quando surgir algum alerta importante, ele aparecerá aqui.</span>
        </div>
      `;
  }
}


function refreshNotifications() {
  state.notifications.items = buildNotifications();
  if (!state.notifications.items.length) {
    state.notifications.open = false;
  }
  renderNotifications();
}


function dismissNotifications(ids = []) {
  const validIds = ids.filter(Boolean);
  if (!validIds.length) return;

  const sessionState = readNotificationSessionState();
  const dismissedIds = new Set(sessionState.dismissedIds);
  validIds.forEach((id) => dismissedIds.add(id));
  writeNotificationSessionState({ dismissedIds: [...dismissedIds] });

  state.notifications.items = state.notifications.items.filter((item) => !dismissedIds.has(item.id));
  if (!state.notifications.items.length) {
    state.notifications.open = false;
  }
  renderNotifications();
}


function handleNotificationsToggle(event) {
  event.preventDefault();
  event.stopPropagation();
  state.notifications.open = !state.notifications.open;
  renderNotifications();
}


function handleClearNotifications(event) {
  event.preventDefault();
  dismissNotifications(state.notifications.items.map((item) => item.id));
  showToast("Notificações limpas.", "info");
}


function handleNotificationListClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const removeButton = target.closest("[data-notification-id]");
  if (!removeButton) return;

  dismissNotifications([removeButton.dataset.notificationId]);
}


function handleDocumentClick(event) {
  if (!state.notifications.open) return;
  const target = event.target;
  if (!(target instanceof Node)) return;
  if (elements.notificationCenter?.contains(target)) return;

  state.notifications.open = false;
  renderNotifications();
}


function handleGlobalKeyDown(event) {
  if (event.key === "Escape" && state.notifications.open) {
    state.notifications.open = false;
    renderNotifications();
  }
}


function handleBeforeInstallPrompt(event) {
  event.preventDefault();
  state.pwa.deferredPrompt = event;
  state.pwa.installReady = true;
  updateInstallButtonVisibility();
}


async function handleInstallApp() {
  if (!state.pwa.deferredPrompt) {
    showToast("No Android, use o menu do navegador e toque em instalar app. No iPhone, use Compartilhar > Adicionar à Tela de Início. Em rede local, a instalação completa precisa de HTTPS.", "info");
    return;
  }

  state.pwa.deferredPrompt.prompt();
  const choice = await state.pwa.deferredPrompt.userChoice;
  state.pwa.deferredPrompt = null;
  state.pwa.installReady = false;
  updateInstallButtonVisibility();

  if (choice?.outcome === "accepted") {
    showToast("Instalação iniciada pelo navegador.");
  }
}


function handleAppInstalled() {
  state.pwa.deferredPrompt = null;
  state.pwa.installReady = false;
  updateInstallButtonVisibility();
  showToast("Aplicativo instalado com sucesso.");
}


async function handleLoginSubmit(event) {
  event.preventDefault();
  elements.loginError.classList.add("hidden");
  elements.loginError.textContent = "";

  const form = new FormData(event.currentTarget);
  const payload = {
    username: form.get("username"),
    password: form.get("password"),
  };

  try {
    const response = await api.login(payload);
    state.user = response.user;
    showApp();
    await loadData();
    showToast("Login realizado com sucesso.");
  } catch (error) {
    elements.loginError.textContent = error.message;
    elements.loginError.classList.remove("hidden");
  }
}


async function handleLogout() {
  try {
    await api.logout();
  } finally {
    state.user = null;
    state.notifications.items = [];
    state.notifications.open = false;
    state.topAlert = null;
    showLogin();
    showToast("Sessão encerrada.", "info");
  }
}


async function loadData() {
  const payload = await api.bootstrap();
  state.user = payload.user;
  state.topAlert = payload.daily_check_alert || null;
  state.data = {
    products: payload.products || [],
    customers: payload.customers || [],
    sales: payload.sales || [],
    quotes: payload.quotes || [],
    expenses: payload.expenses || [],
    checks: payload.checks || [],
    options: payload.options || state.data.options,
  };
  elements.currentUserName.textContent = state.user.full_name;
  refreshNotifications();
  renderTopAlert();
  renderCurrentPage();
}


function setPage(page) {
  state.page = page;
  renderCurrentPage();
  toggleSidebar(false);
}


function toggleSidebar(open) {
  elements.sidebar.classList.toggle("open", open);
  elements.sidebarBackdrop.classList.toggle("visible", open);
}


function renderCurrentPage() {
  elements.pageTitle.textContent = pageTitles[state.page] || "Sistema";
  document.title = `${BRAND_NAME} | ${pageTitles[state.page] || "Sistema"}`;
  elements.navLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.page === state.page);
  });

  const renderMap = {
    dashboard: renderDashboardPage,
    products: renderProductsPage,
    customers: renderCustomersPage,
    sales: renderSalesPage,
    quotes: renderQuotesPage,
    expenses: renderExpensesPage,
    checks: renderChecksPage,
    reports: renderReportsPage,
  };

  elements.pageContent.innerHTML = renderMap[state.page]();
  syncMoneyInputs(elements.pageContent);
  updateInstallButtonVisibility();
  restoreFocusField();
}


function restoreFocusField() {
  if (!state.focusField) return;
  const target = elements.pageContent.querySelector(
    `[data-filter-scope="${state.focusField.scope}"] [name="${state.focusField.name}"]`,
  );
  if (target) {
    target.focus();
    if (typeof target.setSelectionRange === "function") {
      const length = target.value.length;
      target.setSelectionRange(length, length);
    }
  }
  state.focusField = null;
}


function showToast(message, tone = "success") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${tone}`;
  toast.textContent = message;
  elements.toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}


function setFormFeedback(scope, message, tone) {
  state.formFeedback[scope] = { message, tone };
}


function clearFormFeedback(scope, form = null) {
  state.formFeedback[scope] = null;
  if (!form) return;
  const feedbackElement = form.querySelector(`[data-form-feedback="${scope}"]`);
  if (!feedbackElement) return;
  feedbackElement.textContent = "";
  feedbackElement.className = "form-feedback hidden field-span-2";
}


function updateFormFeedback(scope, form, message, tone) {
  setFormFeedback(scope, message, tone);
  const feedbackElement = form.querySelector(`[data-form-feedback="${scope}"]`);
  if (!feedbackElement) return;
  feedbackElement.textContent = message;
  feedbackElement.className = `form-feedback form-feedback-${tone} field-span-2`;
}


function renderFormFeedback(scope) {
  const feedback = state.formFeedback[scope];

  return `
    <p
      class="form-feedback ${feedback ? `form-feedback-${feedback.tone}` : "hidden"} field-span-2"
      data-form-feedback="${scope}"
    >
      ${escapeHtml(feedback?.message || "")}
    </p>
  `;
}


function normalizePayload(rawPayload) {
  const payload = {};
  Object.entries(rawPayload).forEach(([key, value]) => {
    payload[key] = typeof value === "string" ? value.trim() : value;
  });
  return payload;
}


function parseMoneyNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const normalized = String(value)
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const numericValue = Number(normalized);
  return Number.isFinite(numericValue) ? numericValue : 0;
}


function normalizeMoneyDigits(value) {
  return String(value || "")
    .replace(/\D/g, "")
    .replace(/^0+(?=\d)/, "");
}


function moneyDigitsFromValue(value) {
  const cents = Math.round(parseMoneyNumber(value) * 100);
  return normalizeMoneyDigits(cents);
}


function moneyDigitsToNumber(digits) {
  return Number(normalizeMoneyDigits(digits) || 0) / 100;
}


function formatMoneyDigits(digits) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(moneyDigitsToNumber(digits));
}


function formatMoneyInputValue(value) {
  return formatMoneyDigits(moneyDigitsFromValue(value));
}


function parseMoneyInputValue(value) {
  return moneyDigitsToNumber(String(value || "").replace(/\D/g, ""));
}


function renderMoneyInput({ name, value = 0, required = false, classes = "", placeholder = "0,00" }) {
  return `
    <div class="money-input-shell ${classes}">
      <span class="money-prefix">R$</span>
      <input
        type="text"
        name="${name}"
        value="${escapeHtml(formatMoneyInputValue(value))}"
        placeholder="${placeholder}"
        inputmode="numeric"
        autocomplete="off"
        data-money-input
        ${required ? "required" : ""}
      >
    </div>
  `;
}


function setMoneyCaretToEnd(input) {
  requestAnimationFrame(() => {
    const length = input.value.length;
    if (typeof input.setSelectionRange === "function") {
      input.setSelectionRange(length, length);
    }
  });
}


function applyMoneyDigits(input, digits) {
  const normalizedDigits = normalizeMoneyDigits(digits);
  input.dataset.moneyDigits = normalizedDigits;
  input.dataset.moneyValue = moneyDigitsToNumber(normalizedDigits).toFixed(2);
  input.value = formatMoneyDigits(normalizedDigits);
}


function syncMoneyInputs(root = elements.pageContent) {
  root.querySelectorAll("[data-money-input]").forEach((input) => {
    const initialDigits = input.dataset.moneyDigits || moneyDigitsFromValue(input.dataset.moneyValue || input.value);
    applyMoneyDigits(input, initialDigits);
  });
}


function isMoneyInput(target) {
  return target instanceof HTMLInputElement && target.matches("[data-money-input]");
}


function normalizeMoneyPayload(form, payload) {
  form.querySelectorAll("[data-money-input]").forEach((input) => {
    if (!input.name) return;
    payload[input.name] = parseMoneyInputValue(input.value).toFixed(2);
  });
  return payload;
}


function isValidNumber(value, { min = 0, allowZero = true } = {}) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return false;
  if (!allowZero && numericValue === 0) return false;
  return numericValue >= min;
}


function validateSimplePayload(scope, payload) {
  if (scope === "products") {
    if (!payload.name || !payload.code || !payload.category || !payload.unit) {
      throw new Error("Preencha nome, código, categoria e unidade do produto.");
    }
    if (!isValidNumber(payload.cost_price, { min: 0 }) || !isValidNumber(payload.sale_price, { min: 0 })) {
      throw new Error("Informe preços válidos para o produto.");
    }
    if (!isValidNumber(payload.stock_quantity, { min: 0 }) || !isValidNumber(payload.min_stock, { min: 0 })) {
      throw new Error("Informe valores válidos para estoque e estoque mínimo.");
    }
  }

  if (scope === "customers" && !payload.name) {
    throw new Error("Informe o nome do cliente.");
  }

  if (scope === "expenses") {
    if (!payload.payment_date || !payload.description || !payload.category || !payload.payment_method) {
      throw new Error("Preencha data, descrição, categoria e forma de pagamento.");
    }
    if (!isValidNumber(payload.amount, { min: 0.01, allowZero: false })) {
      throw new Error("Informe um valor válido para a conta paga.");
    }
  }

  if (scope === "checks") {
    if (!payload.check_number || !payload.beneficiary || !payload.issue_date || !payload.due_date || !payload.status) {
      throw new Error("Preencha número, beneficiário, datas e status do cheque.");
    }
    if (!isValidNumber(payload.amount, { min: 0.01, allowZero: false })) {
      throw new Error("Informe um valor válido para o cheque.");
    }
    if (payload.due_date < payload.issue_date) {
      throw new Error("A data prevista do cheque não pode ser anterior à data de emissão.");
    }
  }
}


function setFormBusy(form, isBusy) {
  form.querySelectorAll("button, input, select, textarea").forEach((field) => {
    if (field.name === "id") return;
    field.disabled = isBusy;
  });
}


function getPeriod(scope) {
  return getPresetRange(state.filters[scope].preset, state.filters[scope]);
}


function formatToolbarDateDisplay(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return "";
  return `${day}/${month}/${year}`;
}


function maskToolbarDateInput(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    return formatToolbarDateDisplay(rawValue);
  }

  const digits = rawValue.replace(/\D/g, "").slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  return [day, month, year].filter(Boolean).join("/");
}


function getToolbarDateCaret(maskedValue, digitCount) {
  if (digitCount <= 0) return 0;

  let seenDigits = 0;
  for (let index = 0; index < maskedValue.length; index += 1) {
    if (/\d/.test(maskedValue[index])) {
      seenDigits += 1;
    }
    if (seenDigits >= digitCount) {
      return index + 1;
    }
  }

  return maskedValue.length;
}


function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
  );
}


function parseToolbarDateInput(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    return isValidIsoDate(rawValue) ? rawValue : null;
  }

  const digits = rawValue.replace(/\D/g, "");
  if (digits.length !== 8) return null;

  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  const isoValue = `${year}-${month}-${day}`;
  return isValidIsoDate(isoValue) ? isoValue : null;
}


function isManualToolbarDateInput(target) {
  return target instanceof HTMLInputElement && target.dataset.manualToolbarDate === "true";
}


function isToolbarDatePickerInput(target) {
  return target instanceof HTMLInputElement && target.dataset.toolbarDatePicker === "true";
}


function commitManualToolbarDate(target) {
  const toolbar = target.closest("[data-filter-scope]");
  const scope = toolbar?.dataset.filterScope;
  const name = target.dataset.filterName;
  if (!scope || !name) return;

  const nativePicker = toolbar.querySelector(
    `[data-toolbar-date-picker="true"][data-filter-name="${name}"]`,
  );
  const parsedValue = parseToolbarDateInput(target.value);

  if (!target.value.trim()) {
    state.filters[scope][name] = "";
    if (nativePicker) {
      nativePicker.value = "";
    }
    renderCurrentPage();
    return;
  }

  if (!parsedValue) {
    target.value = formatToolbarDateDisplay(state.filters[scope][name] || "");
    return;
  }

  state.filters[scope][name] = parsedValue;
  target.value = formatToolbarDateDisplay(parsedValue);
  if (nativePicker) {
    nativePicker.value = parsedValue;
  }
  renderCurrentPage();
}


function commitToolbarPickerDate(target) {
  const toolbar = target.closest("[data-filter-scope]");
  const scope = toolbar?.dataset.filterScope;
  const name = target.dataset.filterName;
  if (!scope || !name) return;

  const manualInput = toolbar.querySelector(
    `[data-manual-toolbar-date="true"][data-filter-name="${name}"]`,
  );
  const nextValue = target.value || "";

  state.filters[scope][name] = nextValue;
  if (manualInput) {
    manualInput.value = formatToolbarDateDisplay(nextValue);
  }
  renderCurrentPage();
}


function renderToolbarDateField({ label, name, value, manual = false }) {
  if (!manual) {
    return `
      <label class="toolbar-field">
        <span>${label}</span>
        <input type="date" name="${name}" value="${value}">
      </label>
    `;
  }

  return `
    <label class="toolbar-field">
      <span>${label}</span>
      <div class="toolbar-date-shell">
        <input
          type="text"
          value="${escapeHtml(formatToolbarDateDisplay(value))}"
          placeholder="dd/mm/aaaa"
          inputmode="numeric"
          autocomplete="off"
          maxlength="10"
          data-manual-toolbar-date="true"
          data-filter-name="${name}"
          aria-label="${label}"
        >
        <button
          type="button"
          class="icon-button toolbar-date-button"
          data-action="open-filter-date-picker"
          data-filter-name="${name}"
          aria-label="Abrir calendário de ${label.toLowerCase()}"
          title="Abrir calendário"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 2v3M17 2v3M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
          </svg>
        </button>
        <input
          type="date"
          value="${escapeHtml(value || "")}"
          class="toolbar-date-picker-native"
          data-toolbar-date-picker="true"
          data-filter-name="${name}"
          tabindex="-1"
          aria-hidden="true"
        >
      </div>
    </label>
  `;
}


function renderPeriodToolbar(scope, options = {}) {
  const filter = state.filters[scope];
  const {
    showSearch = false,
    searchPlaceholder = "Buscar...",
    showStatus = false,
    statusOptions = [],
    showModule = false,
    manualDateFields = [],
  } = options;
  const manualFieldNames = new Set(manualDateFields);

  return `
    <section class="panel toolbar-panel" data-filter-scope="${scope}">
      <div class="toolbar-row">
        ${showModule ? `
          <label class="toolbar-field">
            <span>Módulo</span>
            <select name="module">
              ${[
                { value: "sales", label: "Vendas" },
                { value: "expenses", label: "Contas pagas" },
                { value: "checks", label: "Cheques" },
                { value: "stock", label: "Estoque" },
              ].map((item) => `
                <option value="${item.value}" ${filter.module === item.value ? "selected" : ""}>${item.label}</option>
              `).join("")}
            </select>
          </label>
        ` : ""}

        <label class="toolbar-field">
          <span>Filtro</span>
          <select name="preset">
            ${[
              { value: "today", label: "Hoje" },
              { value: "day", label: "Dia específico" },
              { value: "yesterday", label: "Ontem" },
              { value: "week", label: "Esta semana" },
              { value: "month", label: "Este mês" },
              { value: "year", label: "Este ano" },
              { value: "custom", label: "Período personalizado" },
            ].map((item) => `
              <option value="${item.value}" ${filter.preset === item.value ? "selected" : ""}>${item.label}</option>
            `).join("")}
          </select>
        </label>

        ${filter.preset === "day" ? renderToolbarDateField({
          label: "Data",
          name: "day",
          value: filter.day,
          manual: manualFieldNames.has("day"),
        }) : ""}

        ${filter.preset === "custom" ? `
          ${renderToolbarDateField({
            label: "Início",
            name: "start",
            value: filter.start,
            manual: manualFieldNames.has("start"),
          })}
          ${renderToolbarDateField({
            label: "Fim",
            name: "end",
            value: filter.end,
            manual: manualFieldNames.has("end"),
          })}
        ` : ""}

        ${showStatus ? `
          <label class="toolbar-field">
            <span>Status</span>
            <select name="status">
              <option value="">Todos</option>
              ${statusOptions.map((status) => `
                <option value="${status}" ${filter.status === status ? "selected" : ""}>${status}</option>
              `).join("")}
            </select>
          </label>
        ` : ""}

        ${showSearch ? `
          <label class="toolbar-field toolbar-search">
            <span>Busca</span>
            <input type="search" name="search" value="${escapeHtml(filter.search || "")}" placeholder="${escapeHtml(searchPlaceholder)}">
          </label>
        ` : ""}
      </div>
    </section>
  `;
}


function statusTone(status) {
  const normalized = (status || "").toLowerCase();
  if (normalized.includes("atras")) return "danger";
  if (normalized.includes("pend")) return "warning";
  if (normalized.includes("compens")) return "success";
  if (normalized.includes("aprov")) return "success";
  if (normalized.includes("cancel")) return "neutral";
  if (normalized.includes("baixo")) return "danger";
  return "neutral";
}


function renderHero(title, text, actions = "") {
  return `
    <section class="hero-panel">
      <div>
        <span class="eyebrow">Visão geral</span>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(text)}</p>
      </div>
      <div class="hero-actions">${actions}</div>
    </section>
  `;
}


function renderTableActions(entity, id) {
  return `
    <div class="table-actions">
      <button type="button" class="table-action" data-action="edit-${entity}" data-id="${id}">Editar</button>
      <button type="button" class="table-action danger" data-action="delete-${entity}" data-id="${id}">Excluir</button>
    </div>
  `;
}


function renderQuoteTableActions(id) {
  return `
    <div class="table-actions">
      <button type="button" class="table-action" data-action="print-quote" data-id="${id}">Imprimir</button>
      <button type="button" class="table-action" data-action="pdf-quote" data-id="${id}">PDF</button>
      <button type="button" class="table-action" data-action="edit-quote" data-id="${id}">Editar</button>
      <button type="button" class="table-action danger" data-action="delete-quote" data-id="${id}">Excluir</button>
    </div>
  `;
}


function renderProductOptions(selectedId = "") {
  return `
    <option value="">Selecione</option>
    ${state.data.products.map((product) => `
      <option
        value="${product.id}"
        data-price="${product.sale_price}"
        ${String(selectedId) === String(product.id) ? "selected" : ""}
      >
        ${escapeHtml(`${product.code} - ${product.name}`)}
      </option>
    `).join("")}
  `;
}


function renderCustomerOptions(selectedId = "") {
  return `
    <option value="">Cliente não informado</option>
    ${state.data.customers.map((customer) => `
      <option value="${customer.id}" ${String(selectedId) === String(customer.id) ? "selected" : ""}>
        ${escapeHtml(customer.name)}
      </option>
    `).join("")}
  `;
}


function renderPaymentOptions(selectedValue = "", options = state.data.options.payment_methods) {
  const items = [...(options || [])];
  if (selectedValue && !items.includes(selectedValue)) {
    items.unshift(selectedValue);
  }

  return items.map((item) => `
    <option value="${item}" ${item === selectedValue ? "selected" : ""}>${item}</option>
  `).join("");
}


function renderQuoteStatusOptions(selectedValue = "") {
  return state.data.options.quote_statuses.map((item) => `
    <option value="${item}" ${item === selectedValue ? "selected" : ""}>${item}</option>
  `).join("");
}


function renderCheckStatusOptions(selectedValue = "") {
  return state.data.options.check_statuses.map((item) => `
    <option value="${item}" ${item === selectedValue ? "selected" : ""}>${item}</option>
  `).join("");
}


function renderQuoteUnitOptions(selectedValue = "UN") {
  const options = state.data.options.quote_item_units?.length
    ? state.data.options.quote_item_units
    : QUOTE_ITEM_UNITS;
  const items = [...options];
  if (selectedValue && !items.includes(selectedValue)) {
    items.unshift(selectedValue);
  }

  return items.map((item) => `
    <option value="${item}" ${item === selectedValue ? "selected" : ""}>${item}</option>
  `).join("");
}


function renderQuoteItemRow(item = {}) {
  const itemName = item.item_name ?? item.product_name ?? "";
  const unit = item.unit ?? "UN";
  const quantity = item.quantity ?? 1;
  const unitPrice = item.unit_price ?? 0;
  const lineTotal = Number(item.total_price ?? (Number(quantity || 0) * Number(unitPrice || 0)));

  return `
    <div class="item-row quote-item-row">
      <label class="quote-item-name">
        <span>Nome do item</span>
        <input type="text" name="item_name" value="${escapeHtml(toFormValue(itemName))}" placeholder="Ex.: Cimento CP-II 50kg">
      </label>
      <label class="quote-item-unit">
        <span>Unidade</span>
        <select name="unit">
          ${renderQuoteUnitOptions(unit)}
        </select>
      </label>
      <label class="quote-item-quantity">
        <span>Quantidade</span>
        <input type="number" name="quantity" min="0.01" step="0.01" value="${quantity}">
      </label>
      <label class="quote-item-price">
        <span>Valor unitário</span>
        ${renderMoneyInput({ name: "unit_price", value: unitPrice, classes: "money-input-compact" })}
      </label>
      <div class="line-total-box quote-item-total">
        <span>Total</span>
        <strong class="line-total-value">${formatMoney(lineTotal)}</strong>
      </div>
      <button type="button" class="table-action danger line-remove-button quote-item-remove" data-action="remove-quote-item">Remover</button>
    </div>
  `;
}


function getQuoteItems(form) {
  return [...form.querySelectorAll(".item-row")].map((row) => {
    const itemName = row.querySelector('[name="item_name"]').value;
    const unit = row.querySelector('[name="unit"]').value;
    const quantity = row.querySelector('[name="quantity"]').value;
    const unitPrice = row.querySelector('[name="unit_price"]').value;
    const numericUnitPrice = parseMoneyInputValue(unitPrice);
    const totalPrice = Number(quantity || 0) * numericUnitPrice;
    return {
      item_name: itemName.trim(),
      unit,
      quantity: Number(quantity),
      unit_price: Number(numericUnitPrice.toFixed(2)),
      total_price: Number(totalPrice.toFixed(2)),
    };
  }).filter((item) => item.item_name || item.quantity > 0 || item.unit_price > 0);
}


function getQuoteTotals(items, discountAmount = 0) {
  const subtotal = sumBy(items, (item) => item.total_price);
  const discount = Math.max(Number(discountAmount || 0), 0);
  const total = Math.max(subtotal - discount, 0);
  return { subtotal, discount, total };
}


function updateQuoteTotals(form) {
  const rows = [...form.querySelectorAll(".item-row")];
  const items = [];
  rows.forEach((row) => {
    const quantity = Number(row.querySelector('[name="quantity"]').value || 0);
    const unitPrice = parseMoneyInputValue(row.querySelector('[name="unit_price"]').value || 0);
    const lineTotal = quantity * unitPrice;
    items.push({ total_price: lineTotal });
    row.querySelector(".line-total-value").textContent = formatMoney(lineTotal);
  });
  const discountField = form.querySelector('[name="discount_amount"]');
  const discountValue = parseMoneyInputValue(discountField?.value || 0);
  const totals = getQuoteTotals(items, discountValue);

  const subtotalElement = form.querySelector("[data-quote-subtotal]");
  const discountElement = form.querySelector("[data-quote-discount]");
  const totalElement = form.querySelector("[data-quote-total]");
  if (subtotalElement) subtotalElement.textContent = formatMoney(totals.subtotal);
  if (discountElement) discountElement.textContent = `Desconto: ${formatMoney(totals.discount)}`;
  if (totalElement) totalElement.textContent = formatMoney(totals.total);
}


function mountQuoteItem(form, item = {}) {
  const container = form.querySelector("[data-items-container]");
  if (!container) return;
  container.insertAdjacentHTML("beforeend", renderQuoteItemRow(item));
  syncMoneyInputs(form);
  updateQuoteTotals(form);
}


function getSimpleSearchRecords(records, keys, term) {
  if (!term) return records;
  const normalized = term.toLowerCase();
  return records.filter((record) => keys.some((key) => String(record[key] || "").toLowerCase().includes(normalized)));
}


function getSalesPeriodGroups(rangeSales) {
  return {
    total: sumBy(rangeSales, (sale) => sale.total_amount),
    count: rangeSales.length,
  };
}


function currentTimeValue() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}


function inferSalePeriod(timeValue = currentTimeValue()) {
  return timeValue <= "12:00" ? "Manhã" : "Tarde";
}


function resolveSalePeriod(sale = {}) {
  const label = String(sale.period || inferSalePeriod(sale.sale_time)).toLowerCase();
  return label.includes("tarde") ? "Tarde" : "Manhã";
}


function getSalesShiftSummary(sales) {
  const morningSales = sales.filter((sale) => resolveSalePeriod(sale) === "Manhã");
  const afternoonSales = sales.filter((sale) => resolveSalePeriod(sale) === "Tarde");
  return {
    morningSales,
    afternoonSales,
    totalMorning: sumBy(morningSales, (sale) => sale.total_amount),
    totalAfternoon: sumBy(afternoonSales, (sale) => sale.total_amount),
    countMorning: morningSales.length,
    countAfternoon: afternoonSales.length,
    total: sumBy(sales, (sale) => sale.total_amount),
    count: sales.length,
  };
}


function getMetricsGridClass(count) {
  if (count >= 5) return "metrics-grid-5";
  if (count === 4) return "metrics-grid-4";
  return "metrics-grid-3";
}


function renderDashboardPage() {
  const sales = state.data.sales;
  const expenses = state.data.expenses;
  const checks = state.data.checks;
  const products = state.data.products;

  const todaySales = filterByPeriod(sales, "sale_date", getPresetRange("today"));
  const yesterdaySales = filterByPeriod(sales, "sale_date", getPresetRange("yesterday"));
  const weekSales = filterByPeriod(sales, "sale_date", getPresetRange("week"));
  const monthSales = filterByPeriod(sales, "sale_date", getPresetRange("month"));
  const yearSales = filterByPeriod(sales, "sale_date", getPresetRange("year"));

  const dashboardPeriod = getPeriod("dashboard");
  const salesInPeriod = filterByPeriod(sales, "sale_date", dashboardPeriod);
  const shiftSummary = getSalesShiftSummary(salesInPeriod);
  const recentSales = sortByDateDesc(salesInPeriod, "sale_date").slice(0, 6);
  const productRanking = getProductRanking(salesInPeriod.length ? salesInPeriod : sales, 5);
  const paymentTotals = getPaymentTotals(salesInPeriod.length ? salesInPeriod : sales, "payment_method", "total_amount");
  const dailyChart = groupByDay(sales, "sale_date", (sale) => sale.total_amount, 7);
  const weeklyChart = groupByWeek(sales, "sale_date", (sale) => sale.total_amount, 8);
  const monthlyChart = groupByMonth(sales, "sale_date", (sale) => sale.total_amount, 6);

  const lowStock = products.filter((product) => product.low_stock);
  const pendingChecks = checks.filter((check) => check.effective_status === "Pendente");
  const overdueChecks = checks.filter((check) => check.effective_status === "Atrasado");
  const recentExpenses = sortByDateDesc(expenses, "payment_date").slice(0, 5);

  const expenseMonthValue = sumBy(filterByPeriod(expenses, "payment_date", getPresetRange("month")), (expense) => expense.amount);
  const checksPendingValue = sumBy(pendingChecks, (check) => check.amount);
  const checksOverdueValue = sumBy(overdueChecks, (check) => check.amount);
  const periodSalesSummary = getSalesPeriodGroups(salesInPeriod);

  return `
    ${renderHero(
      BRAND_NAME,
      "Aqui você acompanha vendas, alertas importantes, estoque baixo e movimentações recentes em um único lugar.",
      `
        <div class="hero-summary">
          <div>
            <span>Venda no filtro</span>
            <strong>${formatMoney(periodSalesSummary.total)}</strong>
          </div>
          <div>
            <span>Contas pagas no mês</span>
            <strong>${formatMoney(expenseMonthValue)}</strong>
          </div>
        </div>
      `,
    )}

    ${renderPeriodToolbar("dashboard")}

    <section class="metrics-grid metrics-grid-5">
      ${renderMetricCard({ label: "Vendido hoje", value: formatMoney(sumBy(todaySales, (sale) => sale.total_amount)), helper: `${todaySales.length} venda(s)`, tone: "success" })}
      ${renderMetricCard({ label: "Vendido ontem", value: formatMoney(sumBy(yesterdaySales, (sale) => sale.total_amount)), helper: `${yesterdaySales.length} venda(s)` })}
      ${renderMetricCard({ label: "Na semana", value: formatMoney(sumBy(weekSales, (sale) => sale.total_amount)), helper: `${weekSales.length} venda(s)`, tone: "brand" })}
      ${renderMetricCard({ label: "No mês", value: formatMoney(sumBy(monthSales, (sale) => sale.total_amount)), helper: `${monthSales.length} venda(s)` })}
      ${renderMetricCard({ label: "No ano", value: formatMoney(sumBy(yearSales, (sale) => sale.total_amount)), helper: `${yearSales.length} venda(s)` })}
    </section>

    <section class="metrics-grid metrics-grid-4">
      ${renderMetricCard({ label: "Vendas da manhã", value: formatMoney(shiftSummary.totalMorning), helper: `${shiftSummary.countMorning} venda(s)`, tone: "brand" })}
      ${renderMetricCard({ label: "Vendas da tarde", value: formatMoney(shiftSummary.totalAfternoon), helper: `${shiftSummary.countAfternoon} venda(s)` })}
      ${renderMetricCard({ label: "Total do filtro", value: formatMoney(shiftSummary.total), helper: dashboardPeriod.label, tone: "success" })}
      ${renderMetricCard({ label: "Quantidade no filtro", value: formatNumber(shiftSummary.count), helper: "Vendas registradas" })}
    </section>

    <section class="metrics-grid metrics-grid-4">
      ${renderMetricCard({ label: "Estoque baixo", value: formatNumber(lowStock.length), helper: "Produtos com atenção", tone: lowStock.length ? "danger" : "success" })}
      ${renderMetricCard({ label: "Cheques pendentes", value: formatMoney(checksPendingValue), helper: `${pendingChecks.length} registro(s)`, tone: "warning" })}
      ${renderMetricCard({ label: "Cheques atrasados", value: formatMoney(checksOverdueValue), helper: `${overdueChecks.length} registro(s)`, tone: overdueChecks.length ? "danger" : "success" })}
      ${renderMetricCard({ label: "Contas pagas recentes", value: formatNumber(recentExpenses.length), helper: "Últimos lançamentos" })}
    </section>

    <section class="dashboard-grid">
      ${renderBarChart({ title: "Vendas diárias", subtitle: "Últimos 7 dias", data: dailyChart })}
      ${renderBarChart({ title: "Vendas por semana", subtitle: "Últimas 8 semanas", data: weeklyChart })}
      ${renderBarChart({ title: "Vendas por mês", subtitle: "Últimos 6 meses", data: monthlyChart })}
      ${renderStatList({ title: "Formas de pagamento", subtitle: dashboardPeriod.label, rows: paymentTotals })}
      ${renderStatList({
        title: "Produtos mais vendidos",
        subtitle: "Ranking simples por quantidade",
        rows: productRanking.map((item) => ({ label: item.label, value: item.revenue, helper: `${formatNumber(item.quantity)} item(ns)` })),
      })}
    </section>

    <section class="page-grid page-grid-2">
      <article class="panel">
        <div class="section-header">
          <div>
            <h3>Vendas recentes</h3>
            <p>${dashboardPeriod.label}</p>
          </div>
        </div>
        ${recentSales.length ? `
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Hora</th>
                  <th>Período</th>
                  <th>Pagamento</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${recentSales.map((sale) => `
                  <tr>
                    <td>${formatDate(sale.sale_date)}</td>
                    <td>${escapeHtml(sale.sale_time || "-")}</td>
                    <td>${renderBadge(resolveSalePeriod(sale), statusTone(resolveSalePeriod(sale)))}</td>
                    <td>${escapeHtml(sale.payment_method)}</td>
                    <td>${formatMoney(sale.total_amount)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : renderEmptyState("Sem vendas no filtro", "Ajuste o período para visualizar outras movimentações.")}
      </article>

      <article class="panel">
        <div class="section-header">
          <div>
            <h3>Alertas</h3>
            <p>Pontos que merecem atenção</p>
          </div>
        </div>
        <div class="alert-stack">
          <div class="alert-card">
            <strong>Estoque baixo</strong>
            <p>${lowStock.length ? `${lowStock.length} produto(s) abaixo do mínimo.` : "Nenhum produto com estoque abaixo do mínimo."}</p>
          </div>
          <div class="alert-card warning">
            <strong>Cheques pendentes</strong>
            <p>${pendingChecks.length ? `${pendingChecks.length} cheque(s) ainda aguardando compensação.` : "Nenhum cheque pendente."}</p>
          </div>
          <div class="alert-card danger">
            <strong>Cheques atrasados</strong>
            <p>${overdueChecks.length ? `${overdueChecks.length} cheque(s) em atraso.` : "Nenhum cheque atrasado."}</p>
          </div>
          <div class="alert-card success">
            <strong>Contas pagas recentes</strong>
            <p>${recentExpenses.length ? `${recentExpenses.length} despesa(s) recentes lançadas.` : "Nenhuma conta paga recente."}</p>
          </div>
        </div>
      </article>
    </section>
  `;
}


function renderProductsPage() {
  const search = state.filters.products.search;
  const products = getSimpleSearchRecords(state.data.products, ["name", "code", "category", "description"], search);
  const editing = state.editing.products;
  const totalSaleValue = sumBy(state.data.products, (product) => product.stock_quantity * product.sale_price);

  return `
    ${renderHero(
      "Cadastro de produtos",
      "Cadastre, edite e acompanhe o estoque dos materiais da loja com alerta visual para estoque baixo.",
    )}

    <section class="metrics-grid metrics-grid-3">
      ${renderMetricCard({ label: "Produtos cadastrados", value: formatNumber(state.data.products.length), helper: "Base completa da loja" })}
      ${renderMetricCard({ label: "Estoque baixo", value: formatNumber(state.data.products.filter((product) => product.low_stock).length), helper: "Itens abaixo do mínimo", tone: "danger" })}
      ${renderMetricCard({ label: "Valor de venda em estoque", value: formatMoney(totalSaleValue), helper: "Estimativa pelo preço de venda", tone: "brand" })}
    </section>

    <section class="page-grid page-grid-2">
      <article class="panel">
        <div class="section-header">
          <div>
            <h3>${editing ? "Editar produto" : "Novo produto"}</h3>
            <p>${editing ? "Atualize as informações do item selecionado." : "Preencha os dados para cadastrar um novo produto."}</p>
          </div>
        </div>
        <form id="products-form" class="form-grid">
          <input type="hidden" name="id" value="${editing?.id ?? ""}">
          ${renderFormFeedback("products")}
          <label><span>Nome</span><input type="text" name="name" value="${escapeHtml(toFormValue(editing?.name))}" required></label>
          <label><span>Código</span><input type="text" name="code" value="${escapeHtml(toFormValue(editing?.code))}" required></label>
          <label><span>Categoria</span><input type="text" name="category" value="${escapeHtml(toFormValue(editing?.category))}" required></label>
          <label>
            <span>Unidade</span>
            <select name="unit" required>
              ${state.data.options.product_units.map((unit) => `
                <option value="${unit}" ${editing?.unit === unit ? "selected" : ""}>${unit}</option>
              `).join("")}
            </select>
          </label>
          <label><span>Preço de custo</span>${renderMoneyInput({ name: "cost_price", value: editing?.cost_price ?? 0, required: true })}</label>
          <label><span>Preço de venda</span>${renderMoneyInput({ name: "sale_price", value: editing?.sale_price ?? 0, required: true })}</label>
          <label><span>Quantidade em estoque</span><input type="number" name="stock_quantity" min="0" step="0.01" value="${editing?.stock_quantity ?? 0}" required></label>
          <label><span>Estoque mínimo</span><input type="number" name="min_stock" min="0" step="0.01" value="${editing?.min_stock ?? 0}" required></label>
          <label class="field-span-2"><span>Descrição</span><textarea name="description" rows="4">${escapeHtml(toFormValue(editing?.description))}</textarea></label>
          <div class="form-actions field-span-2">
            <button type="submit" class="btn btn-primary">${editing ? "Salvar alterações" : "Cadastrar produto"}</button>
            <button type="button" class="btn btn-secondary" data-action="clear-products-form">Limpar formulário</button>
          </div>
        </form>
      </article>

      <article class="panel">
        <div class="section-header">
          <div>
            <h3>Lista de produtos</h3>
            <p>Busque pelo nome, código ou categoria.</p>
          </div>
        </div>
        <section class="panel toolbar-panel" data-filter-scope="products">
          <div class="toolbar-row">
            <label class="toolbar-field toolbar-search">
              <span>Busca</span>
              <input type="search" name="search" value="${escapeHtml(search)}" placeholder="Ex.: cimento, MAT-001, ferragem">
            </label>
          </div>
        </section>

        ${products.length ? `
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Produto</th>
                  <th>Categoria</th>
                  <th>Estoque</th>
                  <th>Mínimo</th>
                  <th>Venda</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${products.map((product) => `
                  <tr class="${product.low_stock ? "row-danger" : ""}">
                    <td>${escapeHtml(product.code)}</td>
                    <td>
                      <strong>${escapeHtml(product.name)}</strong>
                      <small>${escapeHtml(product.unit)}</small>
                    </td>
                    <td>${escapeHtml(product.category)}</td>
                    <td>${formatNumber(product.stock_quantity)}</td>
                    <td>${formatNumber(product.min_stock)}</td>
                    <td>${formatMoney(product.sale_price)}</td>
                    <td>${product.low_stock ? renderBadge("Estoque baixo", "danger") : renderBadge("OK", "success")}</td>
                    <td>${renderTableActions("product", product.id)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : renderEmptyState("Nenhum produto encontrado", "Tente outro termo de busca ou cadastre um novo produto.")}
      </article>
    </section>
  `;
}


function renderCustomersPage() {
  const search = state.filters.customers.search;
  const customers = getSimpleSearchRecords(state.data.customers, ["name", "phone", "document", "address", "notes"], search);
  const editing = state.editing.customers;

  return `
    ${renderHero(
      "Cadastro de clientes",
      "Mantenha o histórico da sua base de clientes sempre atualizado para vender com mais controle.",
    )}

    <section class="metrics-grid metrics-grid-3">
      ${renderMetricCard({ label: "Clientes cadastrados", value: formatNumber(state.data.customers.length), helper: "Base da loja" })}
      ${renderMetricCard({ label: "Com telefone", value: formatNumber(state.data.customers.filter((customer) => customer.phone).length), helper: "Facilita o contato" })}
      ${renderMetricCard({ label: "Com CPF/CNPJ", value: formatNumber(state.data.customers.filter((customer) => customer.document).length), helper: "Cadastro mais completo" })}
    </section>

    <section class="page-grid page-grid-2">
      <article class="panel">
        <div class="section-header">
          <div>
            <h3>${editing ? "Editar cliente" : "Novo cliente"}</h3>
            <p>${editing ? "Atualize os dados do cliente selecionado." : "Cadastre clientes para usar em vendas e orçamentos."}</p>
          </div>
        </div>
        <form id="customers-form" class="form-grid">
          <input type="hidden" name="id" value="${editing?.id ?? ""}">
          ${renderFormFeedback("customers")}
          <label><span>Nome</span><input type="text" name="name" value="${escapeHtml(toFormValue(editing?.name))}" required></label>
          <label><span>Telefone</span><input type="text" name="phone" value="${escapeHtml(toFormValue(editing?.phone))}"></label>
          <label><span>CPF/CNPJ</span><input type="text" name="document" value="${escapeHtml(toFormValue(editing?.document))}"></label>
          <label><span>Endereço</span><input type="text" name="address" value="${escapeHtml(toFormValue(editing?.address))}"></label>
          <label class="field-span-2"><span>Observações</span><textarea name="notes" rows="4">${escapeHtml(toFormValue(editing?.notes))}</textarea></label>
          <div class="form-actions field-span-2">
            <button type="submit" class="btn btn-primary">${editing ? "Salvar alterações" : "Cadastrar cliente"}</button>
            <button type="button" class="btn btn-secondary" data-action="clear-customers-form">Limpar formulário</button>
          </div>
        </form>
      </article>

      <article class="panel">
        <div class="section-header">
          <div>
            <h3>Lista de clientes</h3>
            <p>Busque por nome, telefone ou documento.</p>
          </div>
        </div>
        <section class="panel toolbar-panel" data-filter-scope="customers">
          <div class="toolbar-row">
            <label class="toolbar-field toolbar-search">
              <span>Busca</span>
              <input type="search" name="search" value="${escapeHtml(search)}" placeholder="Ex.: Ana, CNPJ, telefone">
            </label>
          </div>
        </section>

        ${customers.length ? `
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Telefone</th>
                  <th>CPF/CNPJ</th>
                  <th>Endereço</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${customers.map((customer) => `
                  <tr>
                    <td>
                      <strong>${escapeHtml(customer.name)}</strong>
                      <small>${escapeHtml(customer.notes || "Sem observações")}</small>
                    </td>
                    <td>${escapeHtml(customer.phone || "-")}</td>
                    <td>${escapeHtml(customer.document || "-")}</td>
                    <td>${escapeHtml(customer.address || "-")}</td>
                    <td>${renderTableActions("customer", customer.id)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : renderEmptyState("Nenhum cliente encontrado", "Tente outro termo ou cadastre um novo cliente.")}
      </article>
    </section>
  `;
}


function renderSalesPage() {
  const filter = state.filters.sales;
  const period = getPeriod("sales");
  const periodSales = filterByPeriod(state.data.sales, "sale_date", period);
  const sales = getSimpleSearchRecords(periodSales, ["customer_name", "payment_method", "notes", "period", "sale_time"], filter.search);
  const editing = state.editing.sales;
  const currentTime = editing?.sale_time || currentTimeValue();
  const currentPeriod = inferSalePeriod(currentTime);
  const shiftSummary = getSalesShiftSummary(sales);
  const salesPaymentMethods = state.data.options.sales_payment_methods?.length
    ? state.data.options.sales_payment_methods
    : state.data.options.payment_methods;
  const selectedPaymentMethod = editing?.payment_method || salesPaymentMethods[0] || state.data.options.payment_methods[0] || "";

  return `
    ${renderHero(
      "Lançamento rápido de vendas",
      "Registre vendas do balcão em poucos segundos, com horário automático e separação entre manhã e tarde.",
    )}

    ${renderPeriodToolbar("sales", {
      showSearch: true,
      searchPlaceholder: "Buscar por pagamento, período, horário ou referência",
    })}

    <section class="metrics-grid metrics-grid-4">
      ${renderMetricCard({ label: "Vendas da manhã", value: formatMoney(shiftSummary.totalMorning), helper: `${shiftSummary.countMorning} venda(s)`, tone: "brand" })}
      ${renderMetricCard({ label: "Vendas da tarde", value: formatMoney(shiftSummary.totalAfternoon), helper: `${shiftSummary.countAfternoon} venda(s)` })}
      ${renderMetricCard({ label: "Total do período", value: formatMoney(shiftSummary.total), helper: period.label, tone: "success" })}
      ${renderMetricCard({ label: "Quantidade total", value: formatNumber(shiftSummary.count), helper: "Histórico filtrado" })}
    </section>

    <section class="page-grid page-grid-2">
      <article class="panel">
        <div class="section-header">
          <div>
            <h3>${editing ? "Editar venda" : "Nova venda"}</h3>
            <p>${editing ? "Atualize o valor, o pagamento e o horário da venda." : "Lançamento rápido para balcão, sem cadastro de itens nesta etapa."}</p>
          </div>
        </div>
        <form id="sales-form" class="form-grid">
          <input type="hidden" name="id" value="${editing?.id ?? ""}">
          ${renderFormFeedback("sales")}
          <label>
            <span>Valor da venda</span>
            ${renderMoneyInput({ name: "amount", value: editing?.amount ?? editing?.total_amount ?? 0, required: true })}
          </label>
          <label>
            <span>Meio de pagamento</span>
            <select name="payment_method" required>
              ${renderPaymentOptions(selectedPaymentMethod, salesPaymentMethods)}
            </select>
          </label>
          <label>
            <span>Data da venda</span>
            <input type="date" name="sale_date" value="${editing?.sale_date || todayIso()}" required>
          </label>
          <label>
            <span>Horário da venda</span>
            <input type="time" name="sale_time" value="${currentTime}" required>
          </label>
          <label>
            <span>Período</span>
            <input type="text" value="${currentPeriod}" data-sale-period-preview readonly>
          </label>
          <div class="field-span-2 item-list-card">
            <div class="section-header compact">
              <div>
                <h3>Resumo automático</h3>
                <p>Data registrada automaticamente no momento do salvamento.</p>
              </div>
            </div>
            <div class="stat-list">
              <div class="stat-row">
                <div>
                  <strong>Data da venda</strong>
                  <small>Preenchida com hoje por padrão, mas pode ser ajustada manualmente.</small>
                </div>
                <div class="stat-row-right">
                  <span data-sale-date-summary>${escapeHtml(formatDate(editing?.sale_date || todayIso()))}</span>
                </div>
              </div>
              <div class="stat-row">
                <div>
                  <strong>Período calculado</strong>
                  <small>Manhã até 12:00, tarde após 12:00.</small>
                </div>
                <div class="stat-row-right">
                  <span data-sale-period-summary>${escapeHtml(currentPeriod)}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="form-actions field-span-2">
            <button type="submit" class="btn btn-primary">${editing ? "Salvar venda" : "Salvar venda"}</button>
            <button type="button" class="btn btn-secondary" data-action="clear-sales-form">Limpar formulário</button>
          </div>
        </form>
      </article>

      <article class="panel">
        <div class="section-header">
          <div>
            <h3>Histórico de vendas</h3>
            <p>${period.label}</p>
          </div>
        </div>
        ${sales.length ? `
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Hora</th>
                  <th>Período</th>
                  <th>Pagamento</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${sales.map((sale) => `
                  <tr>
                    <td>${formatDate(sale.sale_date)}</td>
                    <td>${escapeHtml(sale.sale_time || "-")}</td>
                    <td>${renderBadge(resolveSalePeriod(sale), statusTone(resolveSalePeriod(sale)))}</td>
                    <td>${escapeHtml(sale.payment_method)}</td>
                    <td>${formatMoney(sale.total_amount)}</td>
                    <td>${renderTableActions("sale", sale.id)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : renderEmptyState("Nenhuma venda encontrada", "Cadastre vendas ou altere o período do filtro.")}
      </article>
    </section>
  `;
}


function summarizeQuoteItems(quote) {
  return quote.items
    .map((item) => `${item.item_name || item.product_name} (${formatNumber(item.quantity)} ${item.unit || "UN"})`)
    .join(", ");
}


function buildQuoteDraftSnapshot() {
  const form = document.getElementById("quotes-form");
  if (!form) return null;

  const payload = normalizeMoneyPayload(
    form,
    normalizePayload(Object.fromEntries(new FormData(form).entries())),
  );
  const items = getQuoteItems(form).filter((item) => item.item_name);
  const customerSelect = form.querySelector('[name="customer_id"]');
  const manualCustomerName = String(payload.customer_name_manual || "").trim();
  const selectedCustomerName = customerSelect?.value
    ? customerSelect.selectedOptions?.[0]?.textContent?.trim()
    : "";
  const customerName = manualCustomerName || selectedCustomerName || "Cliente não informado";
  const totals = getQuoteTotals(items, payload.discount_amount || 0);

  return {
    id: payload.id || "Prévia",
    quote_date: payload.quote_date || todayIso(),
    validity_date: payload.validity_date || payload.quote_date || todayIso(),
    customer_name: customerName,
    customer_name_manual: manualCustomerName,
    status: payload.status || "Pendente",
    notes: payload.notes || "",
    subtotal_amount: totals.subtotal,
    discount_amount: Number(payload.discount_amount || 0),
    total_amount: totals.total,
    items,
  };
}


function buildQuotePrintHtml(quote, mode = "print") {
  const helperText = mode === "pdf"
    ? "Na próxima janela, escolha a opção Salvar como PDF do navegador."
    : "Documento preparado para impressão em folha A4.";
  const autoPrint = mode === "print" || mode === "pdf";
  const customerName = quote.customer_name || "Cliente não informado";
  const subtotalAmount = quote.subtotal_amount || quote.total_amount;
  const validityDate = formatDate(quote.validity_date || quote.quote_date);
  const quoteDate = formatDate(quote.quote_date);
  const notesText = quote.notes || "Sem observações.";
  const quoteTitle = quote.id === "Prévia" ? "Orçamento" : `Orçamento #${quote.id}`;

  const brandLogoUrl = new URL(BRAND_LOGO_PATH, window.location.origin).href;

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>${escapeHtml(BRAND_NAME)} | ${escapeHtml(quoteTitle)}</title>
        <style>
          @page { size: A4; margin: 10mm; }
          * { box-sizing: border-box; }
          html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
          }
          body {
            font-family: "Segoe UI", Arial, sans-serif;
            color: #1f2937;
            font-size: 12px;
            line-height: 1.35;
          }
          .sheet {
            width: 190mm;
            margin: 0 auto;
            background: #ffffff;
          }
          .header,
          .summary-row,
          .totals-notes,
          table {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .header {
            display: grid;
            grid-template-columns: 118px minmax(0, 1fr) 248px;
            gap: 12px;
            align-items: start;
            padding-bottom: 8px;
            border-bottom: 1px solid #dbeafe;
          }
          .brand-logo {
            width: 104px;
            max-height: 46px;
            object-fit: contain;
            display: block;
          }
          .title-block {
            display: grid;
            gap: 3px;
            padding-top: 2px;
          }
          .brand-name {
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: #1e3a8a;
          }
          .document-title {
            margin: 0;
            font-size: 18px;
            letter-spacing: 0.08em;
            color: #1f2937;
          }
          .document-subtitle {
            margin: 0;
            font-size: 11px;
            color: #6b7280;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 6px;
          }
          .meta-card {
            min-height: 44px;
            padding: 6px 8px;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            background: #f3f4f6;
          }
          .meta-card strong,
          .summary-card strong,
          .notes strong,
          .totals-box strong {
            display: block;
            margin-bottom: 3px;
            font-size: 9px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #6b7280;
          }
          .meta-card span {
            display: block;
            font-size: 11px;
            font-weight: 600;
            color: #1f2937;
          }
          .summary-row {
            display: grid;
            grid-template-columns: 1.7fr 0.7fr 0.7fr;
            gap: 8px;
            margin: 10px 0 8px;
          }
          .summary-card {
            min-height: 52px;
            padding: 8px 10px;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            background: #f9fafb;
          }
          .summary-card p {
            margin: 0;
            font-size: 11px;
            font-weight: 600;
            color: #1f2937;
          }
          table {
            width: 100%;
            margin-top: 6px;
            border-collapse: collapse;
            table-layout: fixed;
          }
          thead {
            background: #dbeafe;
          }
          th, td {
            padding: 7px 8px;
            border-bottom: 1px solid #e5e7eb;
            text-align: left;
            vertical-align: top;
            font-size: 11px;
          }
          th {
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #1e3a8a;
          }
          th:nth-child(1) { width: 43%; }
          th:nth-child(2) { width: 12%; }
          th:nth-child(3) { width: 14%; }
          th:nth-child(4) { width: 15%; }
          th:nth-child(5) { width: 16%; }
          td:nth-child(2),
          th:nth-child(2) {
            text-align: center;
          }
          td:nth-child(3),
          td:nth-child(4),
          td:nth-child(5),
          th:nth-child(3),
          th:nth-child(4),
          th:nth-child(5) {
            text-align: right;
          }
          .totals-notes {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 240px;
            gap: 12px;
            margin-top: 10px;
            align-items: start;
          }
          .notes,
          .totals-box {
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            background: #f9fafb;
          }
          .notes {
            min-height: 76px;
            padding: 10px 12px;
          }
          .notes p {
            margin: 0;
            font-size: 11px;
            line-height: 1.45;
            color: #4b5563;
          }
          .totals-box {
            padding: 10px 12px;
            background: #f3f4f6;
          }
          .totals-row {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            padding: 4px 0;
            font-size: 11px;
          }
          .totals-row.total {
            margin-top: 6px;
            padding-top: 8px;
            border-top: 1px solid #cbd5e1;
            font-size: 15px;
            font-weight: 700;
            color: #1e3a8a;
          }
          .footer {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            margin-top: 8px;
            padding-top: 6px;
            border-top: 1px dashed #cbd5e1;
            font-size: 10px;
            color: #6b7280;
          }
          .footer strong {
            color: #1f2937;
          }
          .legacy-header,
          .legacy-info-grid,
          .legacy-totals,
          .legacy-notes,
          .legacy-helper {
            display: none;
          }
          @media (max-width: 900px) {
            .header,
            .summary-row,
            .totals-notes {
              grid-template-columns: 1fr;
            }
            .sheet {
              width: auto;
            }
          }
          @media print {
            body { background: #ffffff; }
            .sheet { width: auto; margin: 0; }
          }
        </style>
      </head>
      <body onload="${autoPrint ? "window.focus(); window.print();" : ""}">
        <main class="sheet">
          <header class="header legacy-header">
              <section class="brand">
                <img class="brand-logo" src="${escapeHtml(brandLogoUrl)}" alt="Logo ${escapeHtml(BRAND_NAME)}">
                <div class="brand-copy">
              <h1>${escapeHtml(BRAND_NAME.toUpperCase())}</h1>
              <p>Orçamento comercial para apresentação ao cliente.</p>
              <h2 style="margin: 14px 0 0; font-size: 20px;">ORÇAMENTO</h2>
                </div>
              </section>
              <aside class="meta">
              <strong>${escapeHtml(quoteTitle)}</strong>
              <p>Data: ${escapeHtml(formatDate(quote.quote_date))}</p>
              <p>Validade: ${escapeHtml(formatDate(quote.validity_date || quote.quote_date))}</p>
              <p>Status: ${escapeHtml(quote.status)}</p>
            </aside>
          </header>

          <section class="info-grid legacy-info-grid">
            <article class="info-card">
              <strong>Cliente</strong>
              <p>${escapeHtml(quote.customer_name || "Cliente não informado")}</p>
            </article>
            <article class="info-card">
              <strong>Resumo</strong>
              <p>${escapeHtml(`${quote.items.length} item(ns) no orçamento`)}</p>
            </article>
          </section>

          <header class="header">
            <img class="brand-logo" src="${escapeHtml(brandLogoUrl)}" alt="Logo ${escapeHtml(BRAND_NAME)}">
            <section class="title-block">
              <span class="brand-name">${escapeHtml(BRAND_NAME)}</span>
              <h1 class="document-title">${escapeHtml(quoteTitle)}</h1>
              <p class="document-subtitle">Documento comercial resumido para apresentação ao cliente.</p>
            </section>
            <aside class="meta-grid">
              <div class="meta-card">
                <strong>Data</strong>
                <span>${escapeHtml(quoteDate)}</span>
              </div>
              <div class="meta-card">
                <strong>Validade</strong>
                <span>${escapeHtml(validityDate)}</span>
              </div>
              <div class="meta-card">
                <strong>Status</strong>
                <span>${escapeHtml(quote.status || "Pendente")}</span>
              </div>
              <div class="meta-card">
                <strong>Itens</strong>
                <span>${escapeHtml(formatNumber(quote.items.length))}</span>
              </div>
            </aside>
          </header>

          <section class="summary-row">
            <article class="summary-card">
              <strong>Cliente</strong>
              <p>${escapeHtml(customerName)}</p>
            </article>
            <article class="summary-card">
              <strong>Subtotal</strong>
              <p>${escapeHtml(formatMoney(subtotalAmount))}</p>
            </article>
            <article class="summary-card">
              <strong>Total final</strong>
              <p>${escapeHtml(formatMoney(quote.total_amount))}</p>
            </article>
          </section>

          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Unidade</th>
                <th>Quantidade</th>
                <th>Valor unitário</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${quote.items.map((item) => `
                <tr>
                  <td>${escapeHtml(item.item_name || item.product_name || "-")}</td>
                  <td>${escapeHtml(item.unit || "UN")}</td>
                  <td>${escapeHtml(formatNumber(item.quantity))}</td>
                  <td>${escapeHtml(formatMoney(item.unit_price))}</td>
                  <td>${escapeHtml(formatMoney(item.total_price))}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          <section class="totals-notes">
            <article class="notes">
              <strong>Observações</strong>
              <p>${escapeHtml(notesText)}</p>
            </article>
            <aside class="totals-box">
              <strong>Totais</strong>
              <div class="totals-row">
                <span>Subtotal</span>
                <span>${escapeHtml(formatMoney(subtotalAmount))}</span>
              </div>
              <div class="totals-row">
                <span>Desconto</span>
                <span>${escapeHtml(formatMoney(quote.discount_amount || 0))}</span>
              </div>
              <div class="totals-row total">
                <span>Total final</span>
                <span>${escapeHtml(formatMoney(quote.total_amount))}</span>
              </div>
            </aside>
          </section>

          <footer class="footer">
            <span>${escapeHtml(helperText)}</span>
            <span><strong>${escapeHtml(BRAND_NAME)}</strong></span>
          </footer>

          <section class="totals legacy-totals">
            <strong>Totais</strong>
            <div class="totals-row"><span>Subtotal</span><span>${escapeHtml(formatMoney(quote.subtotal_amount || quote.total_amount))}</span></div>
            <div class="totals-row"><span>Desconto</span><span>${escapeHtml(formatMoney(quote.discount_amount || 0))}</span></div>
            <div class="totals-row total"><span>Total final</span><span>${escapeHtml(formatMoney(quote.total_amount))}</span></div>
          </section>

          <section class="notes legacy-notes">
            <strong>Observações</strong>
            <p>${escapeHtml(quote.notes || "Sem observações.")}</p>
          </section>

          <p class="helper legacy-helper">${escapeHtml(helperText)}</p>
        </main>
      </body>
    </html>
  `;
}


function openQuoteOutput(quoteId, mode = "print") {
  const quote = quoteId
    ? state.data.quotes.find((item) => String(item.id) === String(quoteId))
    : buildQuoteDraftSnapshot();
  if (!quote) {
    showToast("Orçamento não encontrado.", "error");
    return;
  }
  if (!quote.items?.length) {
    showToast("Adicione pelo menos um item antes de imprimir ou gerar o PDF.", "error");
    return;
  }

  const html = buildQuotePrintHtml(quote, mode);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const popup = window.open(url, "_blank");
  if (!popup) {
    URL.revokeObjectURL(url);
    showToast("Permita pop-ups para imprimir ou gerar o PDF.", "error");
    return;
  }
  popup.onload = () => {
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  if (mode === "pdf") {
    showToast("Na impressão, escolha 'Salvar como PDF' no navegador.");
  } else {
    showToast("Orçamento preparado para impressão.");
  }
}


function renderQuotesPage() {
  const search = state.filters.quotes.search;
  const status = state.filters.quotes.status;
  let quotes = [...state.data.quotes];
  if (search) {
    const normalizedSearch = search.toLowerCase();
    quotes = quotes.filter((quote) => [
      quote.customer_name,
      quote.status,
      quote.notes,
      quote.validity_date,
      summarizeQuoteItems(quote),
    ].some((value) => String(value || "").toLowerCase().includes(normalizedSearch)));
  }
  if (status) {
    quotes = quotes.filter((quote) => quote.status === status);
  }
  const editing = state.editing.quotes;
  const approvedCount = countBy(state.data.quotes, (quote) => quote.status === "Aprovado");
  const quoteItems = editing?.items?.length ? editing.items : [{}];
  const initialCustomerManualName = editing?.customer_name_manual || "";
  const initialDiscount = Number(editing?.discount_amount || 0);
  const initialSubtotal = sumBy(quoteItems, (item) => item.total_price || (Number(item.quantity || 0) * Number(item.unit_price || 0)));
  const initialTotal = Math.max(initialSubtotal - initialDiscount, 0);

  return `
    ${renderHero(
      "Orçamentos",
      "Monte orçamentos manuais com itens digitados livremente, cálculo automático e versão pronta para imprimir ou gerar PDF.",
    )}

    <section class="metrics-grid metrics-grid-4">
      ${renderMetricCard({ label: "Total de orçamentos", value: formatNumber(state.data.quotes.length), helper: "Todos os registros" })}
      ${renderMetricCard({ label: "Aprovados", value: formatNumber(approvedCount), helper: "Status aprovado", tone: "success" })}
      ${renderMetricCard({ label: "Pendentes", value: formatNumber(countBy(state.data.quotes, (quote) => quote.status === "Pendente")), helper: "Aguardando resposta", tone: "warning" })}
      ${renderMetricCard({ label: "Valor total", value: formatMoney(sumBy(state.data.quotes, (quote) => quote.total_amount)), helper: "Somando todos os orçamentos" })}
    </section>

    <section class="panel toolbar-panel" data-filter-scope="quotes">
      <div class="toolbar-row">
        <label class="toolbar-field toolbar-search">
          <span>Busca</span>
          <input type="search" name="search" value="${escapeHtml(search)}" placeholder="Buscar por cliente ou observação">
        </label>
        <label class="toolbar-field">
          <span>Status</span>
          <select name="status">
            <option value="">Todos</option>
            ${state.data.options.quote_statuses.map((item) => `
              <option value="${item}" ${status === item ? "selected" : ""}>${item}</option>
            `).join("")}
          </select>
        </label>
      </div>
    </section>

    <section class="page-grid page-grid-2">
      <article class="panel">
        <div class="section-header">
          <div>
            <h3>${editing ? "Editar orçamento" : "Novo orçamento"}</h3>
            <p>${editing ? "Atualize a proposta selecionada." : "Monte a proposta com nome manual ou cliente cadastrado, validade e itens manuais."}</p>
          </div>
        </div>
        <form id="quotes-form" class="form-grid">
          <input type="hidden" name="id" value="${editing?.id ?? ""}">
          ${renderFormFeedback("quotes")}
          <label><span>Data</span><input type="date" name="quote_date" value="${editing?.quote_date || todayIso()}" required></label>
          <label><span>Nome do cliente</span><input type="text" name="customer_name_manual" value="${escapeHtml(toFormValue(initialCustomerManualName))}" placeholder="Digite manualmente, se preferir"></label>
          <label><span>Cliente cadastrado</span><select name="customer_id">${renderCustomerOptions(editing?.customer_id || "")}</select></label>
          <label><span>Validade</span><input type="date" name="validity_date" value="${editing?.validity_date || editing?.quote_date || todayIso()}" required></label>
          <label>
            <span>Status</span>
            <select name="status" required>${renderQuoteStatusOptions(editing?.status || "Pendente")}</select>
          </label>
          <label class="field-span-2"><span>Observações</span><textarea name="notes" rows="3">${escapeHtml(toFormValue(editing?.notes))}</textarea></label>

          <div class="field-span-2 item-list-card">
            <div class="section-header compact">
              <div>
                <h3>Itens do orçamento</h3>
                <p>Digite os itens manualmente, sem depender do cadastro de produtos.</p>
              </div>
              <button type="button" class="btn btn-secondary" data-action="add-quotes-item">Adicionar item</button>
            </div>
            <div data-items-container>
              ${quoteItems.map((item) => renderQuoteItemRow(item)).join("")}
            </div>
            <div class="quote-totals-grid">
              <div class="items-total">
                <span>Subtotal</span>
                <strong data-quote-subtotal>${formatMoney(initialSubtotal)}</strong>
              </div>
              <label class="quote-discount-field">
                <span>Desconto</span>
                ${renderMoneyInput({ name: "discount_amount", value: initialDiscount, classes: "money-input-compact" })}
              </label>
              <div class="items-total total-final-box">
                <span>Total final</span>
                <strong data-quote-total>${formatMoney(initialTotal)}</strong>
                <small data-quote-discount>Desconto: ${formatMoney(initialDiscount)}</small>
              </div>
            </div>
          </div>

          <div class="form-actions field-span-2">
            <button type="submit" class="btn btn-primary">${editing ? "Salvar orçamento" : "Cadastrar orçamento"}</button>
            <button type="button" class="btn btn-secondary" data-action="print-quote" data-id="${editing?.id ?? ""}">Imprimir orçamento</button>
            <button type="button" class="btn btn-secondary" data-action="pdf-quote" data-id="${editing?.id ?? ""}">Gerar PDF</button>
            <button type="button" class="btn btn-secondary" data-action="clear-quotes-form">Limpar formulário</button>
          </div>
        </form>
      </article>

      <article class="panel">
        <div class="section-header">
          <div>
            <h3>Lista de orçamentos</h3>
            <p>Busque, edite ou altere o status das propostas.</p>
          </div>
        </div>

        ${quotes.length ? `
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Validade</th>
                  <th>Cliente</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Itens</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${quotes.map((quote) => `
                  <tr>
                    <td>${formatDate(quote.quote_date)}</td>
                    <td>${formatDate(quote.validity_date || quote.quote_date)}</td>
                    <td>${escapeHtml(quote.customer_name)}</td>
                    <td>${renderBadge(quote.status, statusTone(quote.status))}</td>
                    <td>${formatMoney(quote.total_amount)}</td>
                    <td><small>${escapeHtml(summarizeQuoteItems(quote) || "Sem itens")}</small></td>
                    <td>${renderQuoteTableActions(quote.id)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : renderEmptyState("Nenhum orçamento encontrado", "Cadastre um novo orçamento ou altere a busca.")}
      </article>
    </section>
  `;
}


function renderExpensesPage() {
  const period = getPeriod("expenses");
  const filteredExpenses = getSimpleSearchRecords(
    filterByPeriod(state.data.expenses, "payment_date", period),
    ["description", "category", "payment_method", "supplier", "notes"],
    state.filters.expenses.search,
  );
  const editing = state.editing.expenses;

  const todayExpenses = filterByPeriod(state.data.expenses, "payment_date", getPresetRange("today"));
  const weekExpenses = filterByPeriod(state.data.expenses, "payment_date", getPresetRange("week"));
  const monthExpenses = filterByPeriod(state.data.expenses, "payment_date", getPresetRange("month"));
  const yearExpenses = filterByPeriod(state.data.expenses, "payment_date", getPresetRange("year"));
  const byCategory = getCategoryTotals(filteredExpenses, "category", "amount");
  const byPayment = getPaymentTotals(filteredExpenses, "payment_method", "amount");
  const recentExpenses = sortByDateDesc(filteredExpenses, "payment_date").slice(0, 6);

  return `
    ${renderHero(
      "Contas pagas",
      "Registre despesas da loja, acompanhe totais por período e visualize categorias com mais gasto.",
    )}

    ${renderPeriodToolbar("expenses", {
      showSearch: true,
      searchPlaceholder: "Buscar por descrição, categoria, fornecedor",
    })}

    <section class="metrics-grid metrics-grid-4">
      ${renderMetricCard({ label: "Pago hoje", value: formatMoney(sumBy(todayExpenses, (expense) => expense.amount)), helper: `${todayExpenses.length} conta(s)` })}
      ${renderMetricCard({ label: "Na semana", value: formatMoney(sumBy(weekExpenses, (expense) => expense.amount)), helper: `${weekExpenses.length} conta(s)` })}
      ${renderMetricCard({ label: "No mês", value: formatMoney(sumBy(monthExpenses, (expense) => expense.amount)), helper: `${monthExpenses.length} conta(s)`, tone: "brand" })}
      ${renderMetricCard({ label: "No ano", value: formatMoney(sumBy(yearExpenses, (expense) => expense.amount)), helper: `${yearExpenses.length} conta(s)` })}
    </section>

    <section class="dashboard-grid">
      ${renderBarChart({ title: "Despesas por dia", subtitle: "Últimos 7 dias", data: groupByDay(state.data.expenses, "payment_date", (expense) => expense.amount, 7) })}
      ${renderBarChart({ title: "Despesas por mês", subtitle: "Últimos 6 meses", data: groupByMonth(state.data.expenses, "payment_date", (expense) => expense.amount, 6) })}
      ${renderStatList({ title: "Totais por categoria", subtitle: period.label, rows: byCategory })}
      ${renderStatList({ title: "Totais por pagamento", subtitle: period.label, rows: byPayment })}
    </section>

    <section class="page-grid page-grid-2">
      <article class="panel">
        <div class="section-header">
          <div>
            <h3>${editing ? "Editar conta paga" : "Nova conta paga"}</h3>
            <p>${editing ? "Atualize a despesa selecionada." : "Lance as despesas pagas pela loja."}</p>
          </div>
        </div>
        <form id="expenses-form" class="form-grid">
          <input type="hidden" name="id" value="${editing?.id ?? ""}">
          ${renderFormFeedback("expenses")}
          <label><span>Data do pagamento</span><input type="date" name="payment_date" value="${editing?.payment_date || todayIso()}" required></label>
          <label><span>Descrição</span><input type="text" name="description" value="${escapeHtml(toFormValue(editing?.description))}" required></label>
          <label><span>Categoria</span><input type="text" name="category" value="${escapeHtml(toFormValue(editing?.category))}" required></label>
          <label><span>Valor</span>${renderMoneyInput({ name: "amount", value: editing?.amount ?? 0, required: true })}</label>
          <label><span>Forma de pagamento</span><select name="payment_method" required>${renderPaymentOptions(editing?.payment_method || state.data.options.payment_methods[0])}</select></label>
          <label><span>Fornecedor</span><input type="text" name="supplier" value="${escapeHtml(toFormValue(editing?.supplier))}"></label>
          <label class="field-span-2"><span>Observações</span><textarea name="notes" rows="3">${escapeHtml(toFormValue(editing?.notes))}</textarea></label>
          <div class="form-actions field-span-2">
            <button type="submit" class="btn btn-primary">${editing ? "Salvar conta" : "Cadastrar conta paga"}</button>
            <button type="button" class="btn btn-secondary" data-action="clear-expenses-form">Limpar formulário</button>
          </div>
        </form>
      </article>

      <article class="panel">
        <div class="section-header">
          <div>
            <h3>Últimos lançamentos</h3>
            <p>${period.label}</p>
          </div>
        </div>
        ${recentExpenses.length ? `
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Pagamento</th>
                  <th>Valor</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${recentExpenses.map((expense) => `
                  <tr>
                    <td>${formatDate(expense.payment_date)}</td>
                    <td>
                      <strong>${escapeHtml(expense.description)}</strong>
                      <small>${escapeHtml(expense.supplier || "-")}</small>
                    </td>
                    <td>${escapeHtml(expense.category)}</td>
                    <td>${escapeHtml(expense.payment_method)}</td>
                    <td>${formatMoney(expense.amount)}</td>
                    <td>${renderTableActions("expense", expense.id)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : renderEmptyState("Nenhuma conta paga encontrada", "Cadastre uma nova despesa ou ajuste o filtro.")}
      </article>
    </section>
  `;
}


function renderChecksPage() {
  const period = getPeriod("checks");
  const checksInPeriod = filterByPeriod(state.data.checks, "due_date", period);
  let filteredChecks = [...checksInPeriod];
  filteredChecks = getSimpleSearchRecords(filteredChecks, ["check_number", "beneficiary", "notes"], state.filters.checks.search);
  if (state.filters.checks.status) {
    filteredChecks = filteredChecks.filter((check) => check.effective_status === state.filters.checks.status || check.status === state.filters.checks.status);
  }
  const editing = state.editing.checks;

  const pendingChecks = checksInPeriod.filter((check) => check.effective_status === "Pendente");
  const compensatedChecks = checksInPeriod.filter((check) => check.effective_status === "Compensado");
  const overdueChecks = checksInPeriod.filter((check) => check.effective_status === "Atrasado");

  return `
    ${renderHero(
      "Controle de cheques emitidos",
      "Acompanhe pendências, compensações e atrasos com destaque visual, usando a data prevista para filtros e resumos.",
    )}

    ${renderPeriodToolbar("checks", {
      showSearch: true,
      searchPlaceholder: "Buscar por número, beneficiário ou observação",
      showStatus: true,
      statusOptions: state.data.options.check_statuses,
      manualDateFields: ["start", "end"],
    })}

    <section class="metrics-grid metrics-grid-4">
      ${renderMetricCard({ label: "Cheques pendentes", value: formatMoney(sumBy(pendingChecks, (check) => check.amount)), helper: `${pendingChecks.length} registro(s)`, tone: "warning" })}
      ${renderMetricCard({ label: "Cheques compensados", value: formatMoney(sumBy(compensatedChecks, (check) => check.amount)), helper: `${compensatedChecks.length} registro(s)`, tone: "success" })}
      ${renderMetricCard({ label: "Cheques atrasados", value: formatMoney(sumBy(overdueChecks, (check) => check.amount)), helper: `${overdueChecks.length} registro(s)`, tone: overdueChecks.length ? "danger" : "success" })}
      ${renderMetricCard({ label: "No filtro", value: formatMoney(sumBy(filteredChecks, (check) => check.amount)), helper: `${filteredChecks.length} registro(s)` })}
    </section>

    <section class="dashboard-grid">
      ${renderBarChart({ title: "Cheques por semana", subtitle: "Agrupado pela data prevista", data: groupByWeek(checksInPeriod, "due_date", (check) => check.amount, 8) })}
      ${renderBarChart({ title: "Cheques por mês", subtitle: "Agrupado pela data prevista", data: groupByMonth(checksInPeriod, "due_date", (check) => check.amount, 6) })}
      ${renderStatList({ title: "Quantidade por status", subtitle: period.label, rows: getStatusTotals(checksInPeriod, "effective_status", "amount"), money: true })}
      ${renderStatList({
        title: "Cheques atrasados",
        subtitle: "Lista de atenção imediata",
        rows: overdueChecks.map((check) => ({ label: `${check.check_number} - ${check.beneficiary}`, value: check.amount, helper: `${check.days_overdue} dia(s) de atraso` })),
      })}
    </section>

    <section class="page-grid page-grid-2">
      <article class="panel">
        <div class="section-header">
          <div>
            <h3>${editing ? "Editar cheque" : "Novo cheque"}</h3>
            <p>${editing ? "Atualize o cheque selecionado." : "Cadastre os cheques emitidos pela loja."}</p>
          </div>
        </div>
        <form id="checks-form" class="form-grid">
          <input type="hidden" name="id" value="${editing?.id ?? ""}">
          ${renderFormFeedback("checks")}
          <label><span>Número do cheque</span><input type="text" name="check_number" value="${escapeHtml(toFormValue(editing?.check_number))}" required></label>
          <label><span>Beneficiário</span><input type="text" name="beneficiary" value="${escapeHtml(toFormValue(editing?.beneficiary))}" required></label>
          <label><span>Valor</span>${renderMoneyInput({ name: "amount", value: editing?.amount ?? 0, required: true })}</label>
          <label><span>Data de emissão</span><input type="date" name="issue_date" value="${editing?.issue_date || todayIso()}" required></label>
          <label><span>Data prevista</span><input type="date" name="due_date" value="${editing?.due_date || todayIso()}" required></label>
          <label><span>Status</span><select name="status" required>${renderCheckStatusOptions(editing?.status || "Pendente")}</select></label>
          <label class="field-span-2"><span>Observações</span><textarea name="notes" rows="3">${escapeHtml(toFormValue(editing?.notes))}</textarea></label>
          <div class="form-actions field-span-2">
            <button type="submit" class="btn btn-primary">${editing ? "Salvar cheque" : "Cadastrar cheque"}</button>
            <button type="button" class="btn btn-secondary" data-action="clear-checks-form">Limpar formulário</button>
          </div>
        </form>
      </article>

      <article class="panel">
        <div class="section-header">
          <div>
            <h3>Lista de cheques</h3>
              <p>Filtro aplicado pela data prevista.</p>
          </div>
        </div>
        ${filteredChecks.length ? `
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Beneficiário</th>
                  <th>Valor</th>
                  <th>Emissão</th>
                  <th>Previsto</th>
                  <th>Status</th>
                  <th>Dias</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${filteredChecks.map((check) => `
                  <tr class="${check.is_overdue ? "row-danger" : ""}">
                    <td>${escapeHtml(check.check_number)}</td>
                    <td>${escapeHtml(check.beneficiary)}</td>
                    <td>${formatMoney(check.amount)}</td>
                    <td>${formatDate(check.issue_date)}</td>
                    <td>${formatDate(check.due_date)}</td>
                    <td>${renderBadge(check.effective_status, statusTone(check.effective_status))}</td>
                    <td>
                      <small>Pendente: ${formatNumber(check.days_pending)}</small><br>
                      <small>Atraso: ${formatNumber(check.days_overdue)}</small>
                    </td>
                    <td>${renderTableActions("check", check.id)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : renderEmptyState("Nenhum cheque encontrado", "Cadastre um cheque ou ajuste o período e o status.")}
      </article>
    </section>
  `;
}


function buildReport() {
  const moduleName = state.filters.reports.module;
  const period = getPeriod("reports");

  if (moduleName === "sales") {
    const rows = filterByPeriod(state.data.sales, "sale_date", period);
    const shiftSummary = getSalesShiftSummary(rows);
    return {
      title: "Relatório de vendas",
      subtitle: period.label,
      metrics: [
        { label: "Total da manhã", value: formatMoney(shiftSummary.totalMorning), helper: `${shiftSummary.countMorning} venda(s)` },
        { label: "Total da tarde", value: formatMoney(shiftSummary.totalAfternoon), helper: `${shiftSummary.countAfternoon} venda(s)` },
        { label: "Total geral", value: formatMoney(shiftSummary.total), helper: `${shiftSummary.count} venda(s) no período` },
        { label: "Qtd. manhã", value: formatNumber(shiftSummary.countMorning), helper: "Vendas até 12:00" },
        { label: "Qtd. tarde", value: formatNumber(shiftSummary.countAfternoon), helper: "Vendas após 12:00" },
      ],
      chart: groupByDay(rows, "sale_date", (item) => item.total_amount, 7),
      tableHeaders: ["Data", "Hora", "Período", "Pagamento", "Total"],
      tableRows: rows.map((item) => [
        formatDate(item.sale_date),
        item.sale_time || "-",
        resolveSalePeriod(item),
        item.payment_method,
        formatMoney(item.total_amount),
      ]),
      csvColumns: [
        { label: "Data", value: (item) => item.sale_date },
        { label: "Hora", value: (item) => item.sale_time || "" },
        { label: "Periodo", value: (item) => resolveSalePeriod(item) },
        { label: "Pagamento", value: (item) => item.payment_method },
        { label: "Total", value: (item) => item.total_amount },
      ],
      rawRows: rows,
    };
  }

  if (moduleName === "expenses") {
    const rows = filterByPeriod(state.data.expenses, "payment_date", period);
    return {
      title: "Relatório de contas pagas",
      subtitle: period.label,
      metrics: [
        { label: "Total pago", value: formatMoney(sumBy(rows, (item) => item.amount)), helper: `${rows.length} lançamento(s)` },
        { label: "Maior categoria", value: getCategoryTotals(rows, "category", "amount")[0]?.label || "-", helper: "Categoria líder" },
        { label: "Pagamento mais usado", value: getPaymentTotals(rows, "payment_method", "amount")[0]?.label || "-", helper: "Forma principal" },
      ],
      chart: groupByDay(rows, "payment_date", (item) => item.amount, 7),
      tableHeaders: ["Data", "Descrição", "Categoria", "Valor"],
      tableRows: rows.map((item) => [formatDate(item.payment_date), item.description, item.category, formatMoney(item.amount)]),
      csvColumns: [
        { label: "Data", value: (item) => item.payment_date },
        { label: "Descrição", value: (item) => item.description },
        { label: "Categoria", value: (item) => item.category },
        { label: "Valor", value: (item) => item.amount },
      ],
      rawRows: rows,
    };
  }

  if (moduleName === "checks") {
    const rows = filterByPeriod(state.data.checks, "due_date", period);
    return {
      title: "Relatório de cheques",
      subtitle: `${period.label} (pela data prevista)`,
      metrics: [
        { label: "Valor total", value: formatMoney(sumBy(rows, (item) => item.amount)), helper: `${rows.length} cheque(s)` },
        { label: "Atrasados", value: formatNumber(countBy(rows, (item) => item.effective_status === "Atrasado")), helper: "Cheques em atraso" },
        { label: "Pendentes", value: formatNumber(countBy(rows, (item) => item.effective_status === "Pendente")), helper: "Ainda não compensados" },
      ],
      chart: groupByDay(rows, "due_date", (item) => item.amount, 7),
      tableHeaders: ["Número", "Beneficiário", "Data prevista", "Status", "Valor"],
      tableRows: rows.map((item) => [item.check_number, item.beneficiary, formatDate(item.due_date), item.effective_status, formatMoney(item.amount)]),
      csvColumns: [
        { label: "Numero", value: (item) => item.check_number },
        { label: "Beneficiario", value: (item) => item.beneficiary },
        { label: "DataPrevista", value: (item) => item.due_date },
        { label: "Status", value: (item) => item.effective_status },
        { label: "Valor", value: (item) => item.amount },
      ],
      rawRows: rows,
    };
  }

  const rows = [...state.data.products];
  return {
    title: "Relatório de estoque",
    subtitle: "Posição atual do estoque",
    metrics: [
      { label: "Produtos cadastrados", value: formatNumber(rows.length), helper: "Base atual" },
      { label: "Estoque baixo", value: formatNumber(countBy(rows, (item) => item.low_stock)), helper: "Abaixo do mínimo" },
      { label: "Valor de venda", value: formatMoney(sumBy(rows, (item) => item.stock_quantity * item.sale_price)), helper: "Estimativa" },
    ],
    chart: rows.slice(0, 7).map((item) => ({ label: item.code, value: item.stock_quantity })),
    tableHeaders: ["Código", "Produto", "Categoria", "Estoque"],
    tableRows: rows.map((item) => [item.code, item.name, item.category, formatNumber(item.stock_quantity)]),
    csvColumns: [
      { label: "Codigo", value: (item) => item.code },
      { label: "Produto", value: (item) => item.name },
      { label: "Categoria", value: (item) => item.category },
      { label: "Estoque", value: (item) => item.stock_quantity },
    ],
    rawRows: rows,
  };
}


function renderReportsPage() {
  const report = buildReport();

  return `
    ${renderHero(
      "Relatórios simples e úteis",
      "Escolha o módulo e o período para visualizar um resumo rápido e exportar os dados em CSV.",
      `<button type="button" class="btn btn-primary" data-action="export-report">Exportar CSV</button>`,
    )}

    ${renderPeriodToolbar("reports", { showModule: true })}

    <section class="metrics-grid ${getMetricsGridClass(report.metrics.length)}">
      ${report.metrics.map((metric) => renderMetricCard(metric)).join("")}
    </section>

    <section class="dashboard-grid">
      ${renderBarChart({
        title: report.title,
        subtitle: report.subtitle,
        data: report.chart,
        format: state.filters.reports.module === "stock" ? "count" : "money",
      })}
      ${renderStatList({
        title: "Resumo do relatório",
        subtitle: report.subtitle,
        rows: report.metrics.map((metric) => ({ label: metric.label, value: String(metric.value), helper: metric.helper })),
        money: false,
      })}
    </section>

    <section class="panel">
      <div class="section-header">
        <div>
          <h3>${escapeHtml(report.title)}</h3>
          <p>${escapeHtml(report.subtitle)}</p>
        </div>
      </div>
      ${report.tableRows.length ? `
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>${report.tableHeaders.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
            </thead>
            <tbody>
              ${report.tableRows.map((row) => `
                <tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : renderEmptyState("Sem dados para o relatório", "Ajuste o módulo ou o período para visualizar registros.")}
    </section>
  `;
}


async function handlePageSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;

  event.preventDefault();
  const formId = form.getAttribute("id") || "";
  const scope = formScopeMap[formId];
  if (!scope) return;

  if (typeof form.reportValidity === "function" && !form.reportValidity()) {
    updateFormFeedback(scope, form, "Confira os campos obrigatórios antes de salvar.", "error");
    showToast("Confira os campos obrigatórios antes de salvar.", "error");
    return;
  }
  clearFormFeedback(scope, form);

  const handlers = {
    "products-form": () => submitSimpleForm(form, "products"),
    "customers-form": () => submitSimpleForm(form, "customers"),
    "sales-form": () => submitSalesForm(form),
    "quotes-form": () => submitQuotesForm(form),
    "expenses-form": () => submitSimpleForm(form, "expenses"),
    "checks-form": () => submitSimpleForm(form, "checks"),
  };

  const handler = handlers[formId];
  if (handler) {
    await handler();
  }
}


function handlePageBeforeInput(event) {
  const target = event.target;
  if (!isMoneyInput(target)) return;

  const currentDigits = target.dataset.moneyDigits || moneyDigitsFromValue(target.value);
  const isAllSelected = target.selectionStart === 0 && target.selectionEnd === target.value.length;

  if (event.inputType === "insertText") {
    const nextDigits = String(event.data || "").replace(/\D/g, "");
    event.preventDefault();
    if (!nextDigits) return;
    applyMoneyDigits(target, `${isAllSelected ? "" : currentDigits}${nextDigits}`);
    setMoneyCaretToEnd(target);
    target.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }

  if (event.inputType === "deleteContentBackward" || event.inputType === "deleteContentForward") {
    event.preventDefault();
    applyMoneyDigits(target, isAllSelected ? "" : currentDigits.slice(0, -1));
    setMoneyCaretToEnd(target);
    target.dispatchEvent(new Event("input", { bubbles: true }));
  }
}


function handlePagePaste(event) {
  const target = event.target;
  if (!isMoneyInput(target)) return;

  event.preventDefault();
  const pastedDigits = String(event.clipboardData?.getData("text") || "").replace(/\D/g, "");
  if (!pastedDigits) return;

  const currentDigits = target.dataset.moneyDigits || moneyDigitsFromValue(target.value);
  const isAllSelected = target.selectionStart === 0 && target.selectionEnd === target.value.length;
  applyMoneyDigits(target, `${isAllSelected ? "" : currentDigits}${pastedDigits}`);
  setMoneyCaretToEnd(target);
  target.dispatchEvent(new Event("input", { bubbles: true }));
}


function handlePageFocusIn(event) {
  const target = event.target;
  if (!isMoneyInput(target)) return;
  setMoneyCaretToEnd(target);
}


function handlePageClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;

  const actionMap = {
    "clear-products-form": () => clearEditing("products"),
    "clear-customers-form": () => clearEditing("customers"),
    "clear-sales-form": () => clearEditing("sales"),
    "clear-quotes-form": () => clearEditing("quotes"),
    "clear-expenses-form": () => clearEditing("expenses"),
    "clear-checks-form": () => clearEditing("checks"),
    "add-quotes-item": () => {
      const form = document.getElementById("quotes-form");
      mountQuoteItem(form);
    },
    "remove-quote-item": () => {
      const row = button.closest(".item-row");
      const form = button.closest("form");
      if (row && form) {
        row.remove();
        if (!form.querySelector(".item-row")) {
          mountQuoteItem(form);
        }
        updateQuoteTotals(form);
      }
    },
    "edit-product": () => editEntity("products", id),
    "edit-customer": () => editEntity("customers", id),
    "edit-sale": () => editEntity("sales", id),
    "edit-quote": () => editEntity("quotes", id),
    "edit-expense": () => editEntity("expenses", id),
    "edit-check": () => editEntity("checks", id),
    "delete-product": () => deleteEntity("products", id, "produto"),
    "delete-customer": () => deleteEntity("customers", id, "cliente"),
    "delete-sale": () => deleteEntity("sales", id, "venda"),
    "delete-quote": () => deleteEntity("quotes", id, "orçamento"),
    "delete-expense": () => deleteEntity("expenses", id, "conta paga"),
    "delete-check": () => deleteEntity("checks", id, "cheque"),
    "print-quote": () => openQuoteOutput(id, "print"),
    "pdf-quote": () => openQuoteOutput(id, "pdf"),
    "open-filter-date-picker": () => {
      const toolbar = button.closest("[data-filter-scope]");
      const filterName = button.dataset.filterName;
      const picker = toolbar?.querySelector(
        `[data-toolbar-date-picker="true"][data-filter-name="${filterName}"]`,
      );
      if (!picker) return;

      try {
        if (typeof picker.showPicker === "function") {
          picker.showPicker();
          return;
        }
        picker.focus();
        picker.click();
      } catch {
        picker.focus();
      }
    },
    "export-report": exportReport,
  };

  const handler = actionMap[action];
  if (handler) {
    handler();
  }
}


function handlePageChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (isManualToolbarDateInput(target)) {
    commitManualToolbarDate(target);
    return;
  }

  if (isToolbarDatePickerInput(target)) {
    commitToolbarPickerDate(target);
    return;
  }

  const toolbar = target.closest("[data-filter-scope]");
  if (toolbar) {
    const scope = toolbar.dataset.filterScope;
    if (scope && target.name) {
      state.filters[scope][target.name] = target.value;
      renderCurrentPage();
      return;
    }
  }

}


function handlePageInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (isManualToolbarDateInput(target)) {
    const selectionStart = target.selectionStart ?? target.value.length;
    const digitCount = target.value.slice(0, selectionStart).replace(/\D/g, "").length;
    const maskedValue = maskToolbarDateInput(target.value);
    target.value = maskedValue;
    const caretPosition = getToolbarDateCaret(maskedValue, digitCount);
    target.setSelectionRange(caretPosition, caretPosition);
    return;
  }

  const toolbar = target.closest("[data-filter-scope]");
  if (toolbar && target.name === "search") {
    const scope = toolbar.dataset.filterScope;
    state.filters[scope][target.name] = target.value;
    state.focusField = { scope, name: target.name };
    clearTimeout(searchTimers.get(scope));
    searchTimers.set(scope, setTimeout(() => renderCurrentPage(), 160));
    return;
  }

  const form = target.closest("form");
  if (
    form?.getAttribute("id") === "quotes-form"
    && ["quantity", "unit_price", "discount_amount"].includes(target.getAttribute("name") || "")
  ) {
    updateQuoteTotals(form);
  }

  if (form?.getAttribute("id") === "sales-form" && target.getAttribute("name") === "sale_time") {
    const periodLabel = inferSalePeriod(target.value || currentTimeValue());
    const preview = form.querySelector("[data-sale-period-preview]");
    if (preview) {
      preview.value = periodLabel;
    }
    const summary = form.querySelector("[data-sale-period-summary]");
    if (summary) {
      summary.textContent = periodLabel;
    }
  }

  if (form?.getAttribute("id") === "sales-form" && target.getAttribute("name") === "sale_date") {
    const summary = form.querySelector("[data-sale-date-summary]");
    if (summary) {
      summary.textContent = formatDate(target.value || todayIso());
    }
  }
}


function clearEditing(scope) {
  state.editing[scope] = null;
  clearFormFeedback(scope);
  renderCurrentPage();
}


function editEntity(scope, id) {
  state.editing[scope] = state.data[scope].find((item) => String(item.id) === String(id)) || null;
  clearFormFeedback(scope);
  renderCurrentPage();
}


async function deleteEntity(scope, id, label) {
  if (!window.confirm(`Tem certeza que deseja excluir este ${label}?`)) {
    return;
  }

  try {
    await api.remove(scope, id);
    state.editing[scope] = null;
    clearFormFeedback(scope);
    await loadData();
    showToast(`${label.charAt(0).toUpperCase() + label.slice(1)} excluído com sucesso.`);
  } catch (error) {
    showToast(error.message, "error");
  }
}


async function submitSimpleForm(form, scope) {
  const payload = normalizeMoneyPayload(
    form,
    normalizePayload(Object.fromEntries(new FormData(form).entries())),
  );
  const id = payload.id;
  delete payload.id;

  try {
    validateSimplePayload(scope, payload);
  } catch (error) {
    updateFormFeedback(scope, form, error.message, "error");
    showToast(error.message, "error");
    return;
  }

  setFormBusy(form, true);
  try {
    if (id) {
      await api.update(scope, id, payload);
      setFormFeedback(scope, "Registro atualizado com sucesso.", "success");
      showToast("Registro atualizado com sucesso.");
    } else {
      await api.create(scope, payload);
      setFormFeedback(scope, "Registro cadastrado com sucesso.", "success");
      showToast("Registro cadastrado com sucesso.");
    }
    state.editing[scope] = null;
    await loadData();
  } catch (error) {
    updateFormFeedback(scope, form, error.message, "error");
    showToast(error.message, "error");
  } finally {
    setFormBusy(form, false);
  }
}


async function submitSalesForm(form) {
  const payload = normalizeMoneyPayload(
    form,
    normalizePayload(Object.fromEntries(new FormData(form).entries())),
  );
  const id = payload.id;
  delete payload.id;
  payload.sale_date = payload.sale_date || state.editing.sales?.sale_date || todayIso();
  payload.sale_time = payload.sale_time || currentTimeValue();
  payload.amount = payload.amount || payload.total_amount;
  const allowedPaymentMethods = new Set([
    ...(state.data.options.sales_payment_methods || []),
    ...(state.data.options.payment_methods || []),
  ]);

  try {
    if (!payload.amount || !isValidNumber(payload.amount, { min: 0.01, allowZero: false })) {
      throw new Error("Informe um valor válido para a venda.");
    }
    if (!payload.payment_method) {
      throw new Error("Escolha o meio de pagamento da venda.");
    }
    if (allowedPaymentMethods.size && !allowedPaymentMethods.has(payload.payment_method)) {
      throw new Error("Escolha um meio de pagamento válido para a venda.");
    }
    if (!payload.sale_date) {
      throw new Error("Informe a data da venda.");
    }
    if (!payload.sale_time) {
      throw new Error("Informe um horário válido para a venda.");
    }
    if (!/^\d{2}:\d{2}$/.test(payload.sale_time)) {
      throw new Error("O horário da venda deve estar no formato HH:MM.");
    }
  } catch (error) {
    updateFormFeedback("sales", form, error.message, "error");
    showToast(error.message, "error");
    return;
  }

  setFormBusy(form, true);
  try {
    if (id) {
      await api.update("sales", id, payload);
      setFormFeedback("sales", "Venda atualizada com sucesso.", "success");
      showToast("Venda atualizada com sucesso.");
    } else {
      await api.create("sales", payload);
      setFormFeedback("sales", "Venda registrada com sucesso.", "success");
      showToast("Venda registrada com sucesso.");
    }
    state.editing.sales = null;
    await loadData();
  } catch (error) {
    updateFormFeedback("sales", form, error.message, "error");
    showToast(error.message, "error");
  } finally {
    setFormBusy(form, false);
  }
}


async function submitQuotesForm(form) {
  const payload = normalizeMoneyPayload(
    form,
    normalizePayload(Object.fromEntries(new FormData(form).entries())),
  );
  const id = payload.id;
  delete payload.id;
  payload.items = getQuoteItems(form);

  try {
    if (!payload.quote_date || !payload.validity_date || !payload.status) {
      throw new Error("Preencha a data, a validade e o status do orçamento.");
    }
    if (payload.validity_date < payload.quote_date) {
      throw new Error("A validade do orçamento não pode ser anterior à data do orçamento.");
    }
    if (!payload.items.length) {
      throw new Error("Adicione pelo menos um item manual ao orçamento.");
    }
    payload.items.forEach((item, index) => {
      if (!item.item_name) {
        throw new Error(`Informe o nome do item ${index + 1}.`);
      }
      if (!isValidNumber(item.quantity, { min: 0.01, allowZero: false })) {
        throw new Error(`Informe uma quantidade válida no item ${index + 1}.`);
      }
      if (!isValidNumber(item.unit_price, { min: 0, allowZero: true })) {
        throw new Error(`Informe um valor unitário válido no item ${index + 1}.`);
      }
    });
    if (!isValidNumber(payload.discount_amount || 0, { min: 0, allowZero: true })) {
      throw new Error("Informe um desconto válido para o orçamento.");
    }
    const subtotal = sumBy(payload.items, (item) => item.total_price);
    if (Number(payload.discount_amount || 0) > subtotal) {
      throw new Error("O desconto não pode ser maior que o subtotal do orçamento.");
    }
  } catch (error) {
    updateFormFeedback("quotes", form, error.message, "error");
    showToast(error.message, "error");
    return;
  }

  setFormBusy(form, true);
  try {
    if (id) {
      await api.update("quotes", id, payload);
      setFormFeedback("quotes", "Orçamento atualizado com sucesso.", "success");
      showToast("Orçamento atualizado com sucesso.");
    } else {
      await api.create("quotes", payload);
      setFormFeedback("quotes", "Orçamento cadastrado com sucesso.", "success");
      showToast("Orçamento cadastrado com sucesso.");
    }
    state.editing.quotes = null;
    await loadData();
  } catch (error) {
    updateFormFeedback("quotes", form, error.message, "error");
    showToast(error.message, "error");
  } finally {
    setFormBusy(form, false);
  }
}


function exportReport() {
  const report = buildReport();
  const csv = buildCsv(report.rawRows, report.csvColumns);
  const fileName = `${state.filters.reports.module}-relatorio.csv`;
  downloadTextFile(fileName, csv);
  showToast("Relatório exportado em CSV.");
}


