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
const SIDEBAR_PREFERENCE_KEY = "doisirmaos.sidebar.v1";
const NOTIFICATION_GREETING_NAME = "Sérgio";
const DEV_HOST_REGEX = /^(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})$/;
const SIDEBAR_MOBILE_QUERY = window.matchMedia("(max-width: 960px)");

const pageTitles = {
  products: "Produtos",
  stock: "Estoque",
  customers: "Clientes",
  sales: "Vendas",
  quotes: "Orçamentos",
  nfe: "NF-e",
  expenses: "Contas Pagas",
  bills: "Boletos",
  checks: "Cheques",
  reports: "Relatórios",
};

const BRAND_LOGO_PATH = "/assets/brand/logo_dois_irmaos_final.png";
const PRODUCTS_PER_PAGE = 10;

const monthStart = (() => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
})();

const state = {
  user: null,
  page: "sales",
  pwa: {
    deferredPrompt: null,
    installReady: false,
  },
  layout: {
    sidebarCollapsed: false,
    sidebarMobileOpen: false,
  },
  notifications: {
    items: [],
    open: false,
  },
  nfe: {
    selectedSaleId: "",
    validation: null,
  },
  topAlert: null,
  data: {
    products: [],
    customers: [],
    sales: [],
    quotes: [],
    expenses: [],
    bills: [],
    checks: [],
    daily_bill_alert: null,
    stock_overview: {
      total_products: 0,
      low_stock_products: 0,
      out_of_stock_products: 0,
      estimated_sale_value: 0,
    },
    nfe_issued: [],
    fiscal_settings: {},
    options: {
      payment_methods: [],
      sales_payment_methods: [],
      product_units: [],
      quote_item_units: [],
      quote_statuses: [],
      bill_statuses: [],
      check_statuses: [],
      stock_movement_types: [],
      fiscal_environments: [],
      fiscal_provider_options: [],
    },
  },
  editing: {
    products: null,
    customers: null,
    sales: null,
    quotes: null,
    expenses: null,
    bills: null,
    checks: null,
  },
  formFeedback: {
    products: null,
    stock: null,
    customers: null,
    sales: null,
    quotes: null,
    expenses: null,
    bills: null,
    checks: null,
    fiscal: null,
  },
  quoteComposer: {
    initializedFor: "",
    items: [],
    editingIndex: null,
    draft: null,
  },
  filters: {
    products: { search: "", category: "", active_filter: "active", page: 1 },
    stock: { search: "", stock_filter: "" },
    customers: { search: "" },
    sales: { preset: "month", day: todayIso(), start: monthStart, end: todayIso(), search: "" },
    quotes: { search: "", status: "" },
    nfe: { search: "", sale_id: "" },
    expenses: { preset: "month", day: todayIso(), start: monthStart, end: todayIso(), search: "" },
    bills: { preset: "month", day: todayIso(), start: monthStart, end: todayIso(), search: "", status: "" },
    checks: { preset: "month", day: todayIso(), start: monthStart, end: todayIso(), search: "", status: "" },
    reports: { module: "sales", preset: "month", day: todayIso(), start: monthStart, end: todayIso() },
  },
};

const searchTimers = new Map();
const formScopeMap = {
  "products-form": "products",
  "stock-form": "stock",
  "customers-form": "customers",
  "sales-form": "sales",
  "quotes-form": "quotes",
  "expenses-form": "expenses",
  "bills-form": "bills",
  "checks-form": "checks",
  "fiscal-settings-form": "fiscal",
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
  initializeSidebarLayout();
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
  elements.openSidebarButton?.addEventListener("click", handleSidebarToggle);
  elements.closeSidebarButton?.addEventListener("click", () => setMobileSidebarOpen(false));
  elements.sidebarBackdrop?.addEventListener("click", () => setMobileSidebarOpen(false));

  elements.navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      setPage(link.dataset.page);
    });
  });

  elements.pageContent.addEventListener("click", handlePageClick);
  elements.pageContent.addEventListener("beforeinput", handlePageBeforeInput);
  elements.pageContent.addEventListener("paste", handlePagePaste);
  elements.pageContent.addEventListener("focusin", handlePageFocusIn);
  elements.pageContent.addEventListener("keydown", handlePageKeyDown);
  elements.pageContent.addEventListener("submit", handlePageSubmit, true);
  elements.pageContent.addEventListener("change", handlePageChange);
  elements.pageContent.addEventListener("input", handlePageInput);
  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("keydown", handleGlobalKeyDown);
  window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  window.addEventListener("appinstalled", handleAppInstalled);

  if (typeof SIDEBAR_MOBILE_QUERY.addEventListener === "function") {
    SIDEBAR_MOBILE_QUERY.addEventListener("change", handleSidebarViewportChange);
  } else if (typeof SIDEBAR_MOBILE_QUERY.addListener === "function") {
    SIDEBAR_MOBILE_QUERY.addListener(handleSidebarViewportChange);
  }
}


function showLogin() {
  elements.loginView.classList.remove("hidden");
  elements.appShell.classList.add("hidden");
  state.layout.sidebarMobileOpen = false;
  applySidebarLayout();
  state.notifications.items = [];
  state.notifications.open = false;
  state.nfe.validation = null;
  state.nfe.selectedSaleId = "";
  state.topAlert = null;
  renderNotifications();
  renderTopAlert();
  updateInstallButtonVisibility();
}


function showApp() {
  elements.loginView.classList.add("hidden");
  elements.appShell.classList.remove("hidden");
  elements.currentUserName.textContent = state.user?.full_name || "Administrador";
  applySidebarLayout();
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


function initializeSidebarLayout() {
  state.layout.sidebarCollapsed = readSidebarPreference();
  state.layout.sidebarMobileOpen = false;
  hydrateSidebarMetadata();
  applySidebarLayout();
}


function hydrateSidebarMetadata() {
  elements.navLinks.forEach((link) => {
    const label = link.querySelector(".nav-link-label")?.textContent?.trim() || pageTitles[link.dataset.page] || "Abrir página";
    link.dataset.tooltip = label;
    link.setAttribute("title", label);
    link.setAttribute("aria-label", label);
  });
}


function isMobileSidebarViewport() {
  return SIDEBAR_MOBILE_QUERY.matches;
}


function readSidebarPreference() {
  try {
    return window.localStorage.getItem(SIDEBAR_PREFERENCE_KEY) === "collapsed";
  } catch {
    return false;
  }
}


function writeSidebarPreference(collapsed) {
  try {
    window.localStorage.setItem(SIDEBAR_PREFERENCE_KEY, collapsed ? "collapsed" : "expanded");
  } catch {
    // Se o navegador bloquear localStorage, o menu continua funcionando só nesta sessão.
  }
}


function setSidebarCollapsed(collapsed, { persist = true } = {}) {
  state.layout.sidebarCollapsed = Boolean(collapsed);
  if (persist) {
    writeSidebarPreference(state.layout.sidebarCollapsed);
  }
  if (!isMobileSidebarViewport()) {
    applySidebarLayout();
  }
}


function setMobileSidebarOpen(open) {
  state.layout.sidebarMobileOpen = Boolean(open);
  applySidebarLayout();
}


function handleSidebarToggle() {
  if (isMobileSidebarViewport()) {
    setMobileSidebarOpen(!state.layout.sidebarMobileOpen);
    return;
  }
  setSidebarCollapsed(!state.layout.sidebarCollapsed);
}


function handleSidebarViewportChange() {
  state.layout.sidebarMobileOpen = false;
  applySidebarLayout();
}


function applySidebarLayout() {
  const isMobile = isMobileSidebarViewport();
  const isAppVisible = !elements.appShell.classList.contains("hidden");
  const isCollapsed = !isMobile && state.layout.sidebarCollapsed;
  const isMobileOpen = isMobile && state.layout.sidebarMobileOpen && isAppVisible;
  const sidebarExpanded = isMobile ? isMobileOpen : !isCollapsed;

  elements.appShell.classList.toggle("sidebar-collapsed", isCollapsed);
  elements.appShell.classList.toggle("sidebar-mobile-open", isMobileOpen);
  elements.sidebar?.classList.toggle("open", isMobileOpen);
  elements.sidebarBackdrop?.classList.toggle("visible", isMobileOpen);
  document.body.classList.toggle("sidebar-mobile-open", isMobileOpen);

  if (elements.openSidebarButton) {
    const label = isMobile
      ? (isMobileOpen ? "Fechar menu" : "Abrir menu")
      : (isCollapsed ? "Expandir menu lateral" : "Recolher menu lateral");
    elements.openSidebarButton.setAttribute("aria-label", label);
    elements.openSidebarButton.setAttribute("title", label);
    elements.openSidebarButton.setAttribute("aria-expanded", String(sidebarExpanded));
  }

  if (elements.closeSidebarButton) {
    elements.closeSidebarButton.setAttribute("aria-hidden", String(!isMobileOpen));
  }
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

  const billAlert = state.data.daily_bill_alert;
  const todayBillNotificationId = billAlert?.id || `bills-due-today-${today}`;
  const dueTodayBillsCount = Number(billAlert?.count || 0);
  const dueTodayBillsTotal = Number(billAlert?.total_amount || 0);

  if (billAlert?.has_alert && dueTodayBillsCount > 0 && dueTodayBillsTotal > 0 && !dismissedIds.has(todayBillNotificationId)) {
    const isSingleBill = dueTodayBillsCount === 1;
    notifications.push({
      id: todayBillNotificationId,
      tone: "warning",
      title: isSingleBill ? "Boleto vencendo hoje" : "Boletos vencendo hoje",
      message: isSingleBill
        ? `Olá ${NOTIFICATION_GREETING_NAME}, hoje você tem 1 boleto para pagar, no valor de ${formatMoney(dueTodayBillsTotal)}.`
        : `Olá ${NOTIFICATION_GREETING_NAME}, hoje você tem ${dueTodayBillsCount} boletos para pagar, no total de ${formatMoney(dueTodayBillsTotal)}.`,
      meta: `${dueTodayBillsCount} boleto(s) com vencimento em ${formatDate(billAlert.date || today)}.`,
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
  if (event.key !== "Escape") return;

  if (state.notifications.open) {
    state.notifications.open = false;
    renderNotifications();
  }

  if (state.layout.sidebarMobileOpen) {
    setMobileSidebarOpen(false);
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


function clearSearchTimers() {
  searchTimers.forEach((timerId) => clearTimeout(timerId));
  searchTimers.clear();
}


async function handleLogout() {
  try {
    await api.logout();
  } finally {
    clearSearchTimers();
    state.user = null;
    state.notifications.items = [];
    state.notifications.open = false;
    state.nfe.validation = null;
    state.nfe.selectedSaleId = "";
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
    bills: payload.bills || [],
    checks: payload.checks || [],
    daily_bill_alert: payload.daily_bill_alert || null,
    stock_overview: payload.stock_overview || state.data.stock_overview,
    nfe_issued: payload.nfe_issued || [],
    fiscal_settings: payload.fiscal_settings || {},
    options: payload.options || state.data.options,
  };
  elements.currentUserName.textContent = state.user.full_name;
  refreshNotifications();
  renderTopAlert();
  renderCurrentPage();
}


function setPage(page) {
  clearSearchTimers();
  state.page = page;
  renderCurrentPage();
  if (isMobileSidebarViewport()) {
    setMobileSidebarOpen(false);
  }
}


function renderCurrentPage() {
  const renderMap = {
    products: renderProductsPage,
    stock: renderStockPage,
    customers: renderCustomersPage,
    sales: renderSalesPage,
    quotes: renderQuotesPage,
    nfe: renderNfePage,
    expenses: renderExpensesPage,
    bills: renderBillsPage,
    checks: renderChecksPage,
    reports: renderReportsPage,
  };

  const activePage = renderMap[state.page] ? state.page : "sales";
  if (activePage !== state.page) {
    state.page = activePage;
  }

  elements.pageTitle.textContent = pageTitles[activePage] || "Sistema";
  document.title = `${BRAND_NAME} | ${pageTitles[activePage] || "Sistema"}`;
  elements.navLinks.forEach((link) => {
    const isActive = link.dataset.page === activePage;
    link.classList.toggle("active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  const template = document.createElement("template");
  template.innerHTML = renderMap[activePage]();

  elements.pageContent.replaceChildren(template.content);

  syncMoneyInputs(elements.pageContent);
  const quotesForm = document.getElementById("quotes-form");
  if (quotesForm) updateQuoteTotals(quotesForm);
  const salesForm = document.getElementById("sales-form");
  if (salesForm) updateSaleTotals(salesForm);
  updateInstallButtonVisibility();
}

function renderFilterResultsScope(scope) {
  const containers = elements.pageContent.querySelectorAll(`[data-search-results-scope="${scope}"]`);
  if (!containers.length) {
    renderCurrentPage();
    return;
  }

  containers.forEach((container) => {
    const part = container.dataset.searchResultsPart || "default";
    container.innerHTML = getSearchResultsMarkup(scope, part);
  });
}


function getSearchResultsMarkup(scope, part = "default") {
  const searchRenderMap = {
    products: {
      default: renderProductsListResults,
    },
    stock: {
      default: renderStockResultsTable,
    },
    customers: {
      default: renderCustomersListResults,
    },
    sales: {
      metrics: renderSalesMetricsSection,
      history: renderSalesHistoryPanel,
    },
    quotes: {
      default: renderQuotesListResults,
    },
    nfe: {
      default: renderNfeIssuedResults,
    },
    expenses: {
      insights: renderExpensesInsightsSection,
      recent: renderExpensesRecentPanel,
    },
    bills: {
      metrics: renderBillsMetricsSection,
      dashboard: renderBillsDashboardSection,
      list: renderBillsListPanel,
    },
    checks: {
      metrics: renderChecksMetricsSection,
      dashboard: renderChecksDashboardSection,
      list: renderChecksListPanel,
    },
  };

  const renderer = searchRenderMap[scope]?.[part];
  return renderer ? renderer() : "";
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
    if (!payload.name || !(payload.sku || payload.code) || !payload.category || !payload.unit) {
      throw new Error("Preencha SKU, nome, categoria e unidade do produto.");
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

  if (scope === "bills") {
    if (!payload.beneficiary || !payload.due_date) {
      throw new Error("Preencha beneficiário e data de vencimento do boleto.");
    }
    if (!isValidNumber(payload.amount, { min: 0.01, allowZero: false })) {
      throw new Error("Informe um valor válido para o boleto.");
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
    presetOptions = null,
  } = options;
  const manualFieldNames = new Set(manualDateFields);
  const presets = presetOptions || [
    { value: "today", label: "Hoje" },
    { value: "day", label: "Dia específico" },
    { value: "yesterday", label: "Ontem" },
    { value: "week", label: "Esta semana" },
    { value: "month", label: "Este mês" },
    { value: "year", label: "Este ano" },
    { value: "custom", label: "Período personalizado" },
  ];

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
            ${presets.map((item) => `
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
  if (normalized.includes("venc")) return "warning";
  if (normalized.includes("pend")) return "warning";
  if (normalized.includes("pago")) return "success";
  if (normalized.includes("entrada")) return "success";
  if (normalized.includes("saida")) return "warning";
  if (normalized.includes("ajuste")) return "brand";
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
  const products = [...getActiveProducts()];
  const selectedProduct = getProductById(selectedId);
  if (selectedProduct && !products.some((product) => String(product.id) === String(selectedId))) {
    products.unshift(selectedProduct);
  }

  return `
    <option value="">Selecione</option>
    ${products.map((product) => `
      <option
        value="${product.id}"
        data-price="${product.sale_price}"
        data-unit="${escapeHtml(product.unit || "UN")}"
        data-name="${escapeHtml(product.name || "")}"
        data-sku="${escapeHtml(product.sku || product.code || "")}"
        data-ncm="${escapeHtml(product.ncm || "")}"
        data-cfop="${escapeHtml(product.cfop_default || "")}"
        data-origin="${escapeHtml(product.origin || "")}"
        data-csosn="${escapeHtml(product.csosn || "")}"
        ${String(selectedId) === String(product.id) ? "selected" : ""}
      >
        ${escapeHtml(`${product.sku || product.code} - ${product.name}`)}
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


function createQuoteDraftItem(item = {}, options = {}) {
  const { allowZeroQuantity = false } = options;
  const itemName = String(item.item_name ?? item.product_name ?? "").trim();
  const unit = String(item.unit || "UN").trim() || "UN";
  const quantityValue = Number(item.quantity ?? 1);
  const unitPriceValue = Number(item.unit_price ?? 0);
  const quantity = Number.isFinite(quantityValue) && (allowZeroQuantity ? quantityValue >= 0 : quantityValue > 0)
    ? quantityValue
    : (allowZeroQuantity ? 0 : 1);
  const unitPrice = Number.isFinite(unitPriceValue) ? Number(unitPriceValue.toFixed(2)) : 0;
  const totalPriceValue = Number(item.total_price ?? (quantity * unitPrice));
  const totalPrice = Number.isFinite(totalPriceValue)
    ? Number(totalPriceValue.toFixed(2))
    : Number((quantity * unitPrice).toFixed(2));

  return {
    item_name: itemName,
    unit,
    quantity,
    unit_price: unitPrice,
    total_price: totalPrice,
  };
}


function createQuoteComposer(items = [], initializedFor = "new") {
  return {
    initializedFor,
    items: items.map((item) => createQuoteDraftItem(item)),
    editingIndex: null,
    draft: createQuoteDraftItem({ unit: "UN", quantity: 1, unit_price: 0 }),
  };
}


function getQuoteComposer() {
  if (!state.quoteComposer?.draft) {
    state.quoteComposer = createQuoteComposer();
  }
  return state.quoteComposer;
}


function syncQuoteComposerState() {
  const editing = state.editing.quotes;
  const initializedFor = editing ? `quote:${editing.id}` : "new";
  if (getQuoteComposer().initializedFor !== initializedFor) {
    state.quoteComposer = createQuoteComposer(editing?.items || [], initializedFor);
  }
  return state.quoteComposer;
}


function resetQuoteComposer() {
  state.quoteComposer = createQuoteComposer([], "__pending-reset__");
}


function clearQuoteDraft(form = null) {
  const composer = getQuoteComposer();
  composer.draft = createQuoteDraftItem({ unit: composer.draft?.unit || "UN", quantity: 1, unit_price: 0 });
  composer.editingIndex = null;

  if (!form) return;

  const itemNameField = form.querySelector('[name="draft_item_name"]');
  const unitField = form.querySelector('[name="draft_unit"]');
  const quantityField = form.querySelector('[name="draft_quantity"]');
  const unitPriceField = form.querySelector('[name="draft_unit_price"]');

  if (itemNameField) itemNameField.value = "";
  if (unitField) unitField.value = composer.draft.unit;
  if (quantityField) quantityField.value = String(composer.draft.quantity);
  if (unitPriceField) {
    applyMoneyDigits(unitPriceField, moneyDigitsFromValue(composer.draft.unit_price));
  }
}


function readQuoteDraftFromForm(form) {
  const composer = getQuoteComposer();
  const itemName = form.querySelector('[name="draft_item_name"]')?.value || "";
  const unit = form.querySelector('[name="draft_unit"]')?.value || "UN";
  const quantityValue = Number(form.querySelector('[name="draft_quantity"]')?.value || 0);
  const unitPriceValue = parseMoneyInputValue(form.querySelector('[name="draft_unit_price"]')?.value || 0);

  composer.draft = createQuoteDraftItem({
    item_name: itemName,
    unit,
    quantity: quantityValue,
    unit_price: unitPriceValue,
  }, { allowZeroQuantity: true });

  return composer.draft;
}


function renderQuoteDraftEditor() {
  const composer = getQuoteComposer();
  const draft = composer.draft || createQuoteDraftItem();
  const isEditingItem = Number.isInteger(composer.editingIndex);
  const draftTotal = Number((Number(draft.quantity || 0) * Number(draft.unit_price || 0)).toFixed(2));

  return `
    <div class="quote-entry-form-card">
      <div class="quote-entry-form-grid">
        <label class="quote-entry-name">
          <span>Nome do item</span>
          <input type="text" name="draft_item_name" value="${escapeHtml(toFormValue(draft.item_name))}" placeholder="Ex.: Cimento CP-II 50kg">
        </label>
        <label class="quote-entry-unit">
          <span>Unidade</span>
          <select name="draft_unit">
            ${renderQuoteUnitOptions(draft.unit || "UN")}
          </select>
        </label>
        <label class="quote-entry-quantity">
          <span>Quantidade</span>
          <input type="number" name="draft_quantity" min="0.01" step="0.01" value="${escapeHtml(String(draft.quantity || 1))}">
        </label>
        <label class="quote-entry-price">
          <span>Valor unitário</span>
          ${renderMoneyInput({ name: "draft_unit_price", value: draft.unit_price ?? 0, classes: "money-input-compact" })}
        </label>
        <div class="line-total-box quote-entry-total-box">
          <span>Total do item</span>
          <strong data-quote-draft-total>${formatMoney(draftTotal)}</strong>
        </div>
      </div>
      <div class="quote-entry-actions">
        <button type="button" class="btn btn-primary" data-action="save-quote-item">${isEditingItem ? "Salvar alteração" : "Adicionar item"}</button>
        ${isEditingItem ? '<button type="button" class="btn btn-secondary" data-action="cancel-quote-item-edit">Cancelar edição</button>' : ""}
      </div>
    </div>
  `;
}


function renderQuoteItemsList() {
  const composer = getQuoteComposer();

  return composer.items.length ? `
    <div class="table-wrapper quote-items-table-wrapper">
      <table class="data-table quote-items-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Unidade</th>
            <th>Quantidade</th>
            <th>Valor unitário</th>
            <th>Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${composer.items.map((item, index) => `
            <tr>
              <td>
                <strong>${escapeHtml(item.item_name)}</strong>
                <small>Item ${index + 1}</small>
              </td>
              <td>${escapeHtml(item.unit || "UN")}</td>
              <td>${formatNumber(item.quantity)}</td>
              <td>${formatMoney(item.unit_price)}</td>
              <td>${formatMoney(item.total_price)}</td>
              <td>
                <div class="table-actions">
                  <button type="button" class="table-action" data-action="edit-quote-item" data-index="${index}">Editar</button>
                  <button type="button" class="table-action danger" data-action="remove-quote-item" data-index="${index}">Remover</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  ` : `
    <div class="quote-items-empty">
      <strong>Nenhum item adicionado ainda</strong>
      <p>Use o formulário acima para lançar os itens do orçamento e montar a lista rapidamente.</p>
    </div>
  `;
}


function getQuoteItems() {
  return getQuoteComposer().items.map((item) => createQuoteDraftItem(item));
}


function getQuoteTotals(items, discountAmount = 0) {
  const subtotal = sumBy(items, (item) => item.total_price);
  const discount = Math.max(Number(discountAmount || 0), 0);
  const total = Math.max(subtotal - discount, 0);
  return { subtotal, discount, total };
}


function updateQuoteTotals(form) {
  const items = getQuoteItems();
  const discountField = form.querySelector('[name="discount_amount"]');
  const discountValue = parseMoneyInputValue(discountField?.value || 0);
  const totals = getQuoteTotals(items, discountValue);
  const draft = readQuoteDraftFromForm(form);
  const draftTotalElement = form.querySelector("[data-quote-draft-total]");
  if (draftTotalElement) {
    draftTotalElement.textContent = formatMoney(Number(draft.quantity || 0) * Number(draft.unit_price || 0));
  }

  const subtotalElement = form.querySelector("[data-quote-subtotal]");
  const discountElement = form.querySelector("[data-quote-discount]");
  const totalElement = form.querySelector("[data-quote-total]");
  if (subtotalElement) subtotalElement.textContent = formatMoney(totals.subtotal);
  if (discountElement) discountElement.textContent = `Desconto: ${formatMoney(totals.discount)}`;
  if (totalElement) totalElement.textContent = formatMoney(totals.total);
}


function updateQuoteItemEditorState(form) {
  const composer = getQuoteComposer();
  const primaryButton = form.querySelector('[data-action="save-quote-item"]');
  const secondaryButton = form.querySelector('[data-action="cancel-quote-item-edit"]');

  if (primaryButton) {
    primaryButton.textContent = Number.isInteger(composer.editingIndex) ? "Salvar alteração" : "Adicionar item";
  }

  if (Number.isInteger(composer.editingIndex)) {
    if (!secondaryButton) {
      const actions = form.querySelector(".quote-entry-actions");
      if (actions) {
        actions.insertAdjacentHTML(
          "beforeend",
          '<button type="button" class="btn btn-secondary" data-action="cancel-quote-item-edit">Cancelar edição</button>',
        );
      }
    }
  } else if (secondaryButton) {
    secondaryButton.remove();
  }
}


function renderQuoteItemsSection(form) {
  const listContainer = form.querySelector("[data-quote-items-list]");
  if (listContainer) {
    listContainer.innerHTML = renderQuoteItemsList();
  }

  updateQuoteItemEditorState(form);
  updateQuoteTotals(form);
}


function focusQuoteItemName(form) {
  const itemNameField = form.querySelector('[name="draft_item_name"]');
  if (itemNameField instanceof HTMLInputElement) {
    itemNameField.focus({ preventScroll: true });
    itemNameField.select();
  }
}


function handleSaveQuoteItem(form) {
  const composer = getQuoteComposer();
  const draft = readQuoteDraftFromForm(form);

  try {
    if (!draft.item_name) {
      throw new Error("Informe o nome do item antes de adicionar ao orçamento.");
    }
    if (!isValidNumber(draft.quantity, { min: 0.01, allowZero: false })) {
      throw new Error("Informe uma quantidade válida para o item do orçamento.");
    }
    if (!isValidNumber(draft.unit_price, { min: 0, allowZero: true })) {
      throw new Error("Informe um valor unitário válido para o item do orçamento.");
    }
  } catch (error) {
    updateFormFeedback("quotes", form, error.message, "error");
    showToast(error.message, "error");
    return;
  }

  const nextItem = createQuoteDraftItem(draft);
  if (Number.isInteger(composer.editingIndex)) {
    composer.items[composer.editingIndex] = nextItem;
  } else {
    composer.items.push(nextItem);
  }

  clearFormFeedback("quotes", form);
  clearQuoteDraft(form);
  renderQuoteItemsSection(form);
  focusQuoteItemName(form);
}


function handleEditQuoteItem(form, index) {
  const composer = getQuoteComposer();
  const item = composer.items[index];
  if (!item) return;

  composer.editingIndex = index;
  composer.draft = createQuoteDraftItem(item);

  const itemNameField = form.querySelector('[name="draft_item_name"]');
  const unitField = form.querySelector('[name="draft_unit"]');
  const quantityField = form.querySelector('[name="draft_quantity"]');
  const unitPriceField = form.querySelector('[name="draft_unit_price"]');

  if (itemNameField) itemNameField.value = composer.draft.item_name;
  if (unitField) unitField.value = composer.draft.unit;
  if (quantityField) quantityField.value = String(composer.draft.quantity);
  if (unitPriceField) {
    applyMoneyDigits(unitPriceField, moneyDigitsFromValue(composer.draft.unit_price));
  }

  clearFormFeedback("quotes", form);
  renderQuoteItemsSection(form);
  focusQuoteItemName(form);
}


function handleRemoveQuoteItem(form, index) {
  const composer = getQuoteComposer();
  if (!composer.items[index]) return;

  composer.items.splice(index, 1);

  if (composer.editingIndex === index) {
    clearQuoteDraft(form);
  } else if (Number.isInteger(composer.editingIndex) && composer.editingIndex > index) {
    composer.editingIndex -= 1;
  }

  clearFormFeedback("quotes", form);
  renderQuoteItemsSection(form);
}


function handleCancelQuoteItemEdit(form) {
  clearQuoteDraft(form);
  clearFormFeedback("quotes", form);
  renderQuoteItemsSection(form);
  focusQuoteItemName(form);
}


function renderSaleItemRow(item = {}) {
  const productId = item.product_id ?? "";
  const product = getProductById(productId) || {};
  const quantity = Number(item.quantity ?? 1);
  const unitPrice = Number(item.unit_price ?? product.sale_price ?? 0);
  const totalPrice = Number(item.total_price ?? quantity * unitPrice);
  const description = item.description ?? product.name ?? "";
  const sku = item.sku ?? product.sku ?? product.code ?? "";
  const unit = item.unit ?? product.unit ?? "UN";
  const ncm = item.ncm ?? product.ncm ?? "";
  const cfop = item.cfop ?? product.cfop_default ?? "";
  const origin = item.origin ?? product.origin ?? "";
  const csosn = item.csosn ?? product.csosn ?? "";

  return `
    <div class="item-row sale-item-row">
      <label class="sale-item-product">
        <span>Produto</span>
        <select name="product_id">
          ${renderProductOptions(productId)}
        </select>
      </label>
      <label class="sale-item-quantity">
        <span>Quantidade</span>
        <input type="number" name="quantity" min="0.01" step="0.01" value="${quantity}">
      </label>
      <label class="sale-item-price">
        <span>Valor unitário</span>
        ${renderMoneyInput({ name: "unit_price", value: unitPrice, classes: "money-input-compact" })}
      </label>
      <div class="line-total-box sale-item-total">
        <span>Subtotal</span>
        <strong class="line-total-value">${formatMoney(totalPrice)}</strong>
      </div>
      <button type="button" class="table-action danger line-remove-button sale-item-remove" data-action="remove-sale-item">Remover</button>
      <div class="sale-item-meta">
        <span><strong>SKU:</strong> <span data-sale-item-sku>${escapeHtml(sku || "-")}</span></span>
        <span><strong>Descrição:</strong> <span data-sale-item-description>${escapeHtml(description || "-")}</span></span>
        <span><strong>Unidade:</strong> <span data-sale-item-unit>${escapeHtml(unit || "UN")}</span></span>
        <span><strong>NCM:</strong> <span data-sale-item-ncm>${escapeHtml(ncm || "-")}</span></span>
        <span><strong>CFOP:</strong> <span data-sale-item-cfop>${escapeHtml(cfop || "-")}</span></span>
        <span><strong>Origem:</strong> <span data-sale-item-origin>${escapeHtml(origin || "-")}</span></span>
        <span><strong>CSOSN:</strong> <span data-sale-item-csosn>${escapeHtml(csosn || "-")}</span></span>
      </div>
    </div>
  `;
}


function mountSaleItem(form, item = {}) {
  const container = form.querySelector("[data-sale-items-container]");
  if (!container) return;
  container.insertAdjacentHTML("beforeend", renderSaleItemRow(item));
  syncMoneyInputs(form);
  updateSaleTotals(form);
}


function syncSaleItemProductData(row) {
  if (!row) return;
  const select = row.querySelector('[name="product_id"]');
  const option = select?.selectedOptions?.[0];
  if (!option) return;
  const rowUnitPrice = row.querySelector('[name="unit_price"]');

  const productData = {
    sku: option.dataset.sku || "-",
    description: option.dataset.name || "-",
    unit: option.dataset.unit || "UN",
    ncm: option.dataset.ncm || "-",
    cfop: option.dataset.cfop || "-",
    origin: option.dataset.origin || "-",
    csosn: option.dataset.csosn || "-",
  };

  row.querySelector("[data-sale-item-sku]").textContent = productData.sku;
  row.querySelector("[data-sale-item-description]").textContent = productData.description;
  row.querySelector("[data-sale-item-unit]").textContent = productData.unit;
  row.querySelector("[data-sale-item-ncm]").textContent = productData.ncm;
  row.querySelector("[data-sale-item-cfop]").textContent = productData.cfop;
  row.querySelector("[data-sale-item-origin]").textContent = productData.origin;
  row.querySelector("[data-sale-item-csosn]").textContent = productData.csosn;

  if (rowUnitPrice && (!rowUnitPrice.dataset.moneyDigits || Number(rowUnitPrice.dataset.moneyValue || 0) === 0)) {
    applyMoneyDigits(rowUnitPrice, moneyDigitsFromValue(option.dataset.price || 0));
  }
}


function getSaleItems(form) {
  return [...form.querySelectorAll(".sale-item-row")].map((row) => {
    const option = row.querySelector('[name="product_id"]')?.selectedOptions?.[0];
    const quantity = Number(row.querySelector('[name="quantity"]').value || 0);
    const unitPrice = parseMoneyInputValue(row.querySelector('[name="unit_price"]').value || 0);
    return {
      product_id: Number(row.querySelector('[name="product_id"]').value || 0),
      sku: option?.dataset.sku || "",
      description: option?.dataset.name || "",
      unit: option?.dataset.unit || "UN",
      quantity,
      unit_price: Number(unitPrice.toFixed(2)),
      total_price: Number((quantity * unitPrice).toFixed(2)),
      ncm: option?.dataset.ncm || "",
      cfop: option?.dataset.cfop || "",
      origin: option?.dataset.origin || "",
      csosn: option?.dataset.csosn || "",
    };
  }).filter((item) => item.product_id || item.quantity > 0 || item.unit_price > 0);
}


function updateSaleTotals(form) {
  const rows = [...form.querySelectorAll(".sale-item-row")];
  let itemsCount = 0;
  let total = 0;
  rows.forEach((row) => {
    syncSaleItemProductData(row);
    const quantity = Number(row.querySelector('[name="quantity"]').value || 0);
    const unitPrice = parseMoneyInputValue(row.querySelector('[name="unit_price"]').value || 0);
    const lineTotal = quantity * unitPrice;
    total += lineTotal;
    if (row.querySelector('[name="product_id"]').value) {
      itemsCount += 1;
    }
    row.querySelector(".line-total-value").textContent = formatMoney(lineTotal);
  });

  const totalElement = form.querySelector("[data-sale-total]");
  const countElement = form.querySelector("[data-sale-item-count]");
  if (totalElement) totalElement.textContent = formatMoney(total);
  if (countElement) countElement.textContent = `${itemsCount} item(ns)`;
}


function getSimpleSearchRecords(records, keys, term) {
  if (!term) return records;
  const normalized = term.toLowerCase();
  return records.filter((record) => keys.some((key) => String(record[key] || "").toLowerCase().includes(normalized)));
}


function paginateRecords(records, page = 1, perPage = PRODUCTS_PER_PAGE) {
  const totalPages = Math.max(Math.ceil(records.length / perPage), 1);
  const safePage = Math.min(Math.max(Number(page || 1), 1), totalPages);
  const start = (safePage - 1) * perPage;
  return {
    page: safePage,
    totalPages,
    items: records.slice(start, start + perPage),
    totalItems: records.length,
  };
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


function getActiveProducts() {
  return state.data.products.filter((product) => product.active !== false);
}


function getProductById(productId) {
  return state.data.products.find((product) => String(product.id) === String(productId)) || null;
}


function getMetricsGridClass(count) {
  if (count >= 5) return "metrics-grid-5";
  if (count === 4) return "metrics-grid-4";
  return "metrics-grid-3";
}


function getFilteredProductsBase() {
  const search = state.filters.products.search;
  const categoryFilter = state.filters.products.category;
  const activeFilter = state.filters.products.active_filter || "active";

  return getSimpleSearchRecords(
    state.data.products,
    ["name", "sku", "code", "category", "description", "ncm"],
    search,
  ).filter((product) => {
    if (categoryFilter && product.category !== categoryFilter) return false;
    if (activeFilter === "active") return product.active !== false;
    if (activeFilter === "inactive") return product.active === false;
    return true;
  });
}


function renderProductsListResults() {
  const pagination = paginateRecords(getFilteredProductsBase(), state.filters.products.page, PRODUCTS_PER_PAGE);
  const products = pagination.items;

  return products.length ? `
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>SKU</th>
            <th>Produto</th>
            <th>Categoria</th>
            <th>NCM</th>
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
              <td>${escapeHtml(product.sku || product.code)}</td>
              <td>
                <strong>${escapeHtml(product.name)}</strong>
                <small>${escapeHtml(`${product.unit} | CFOP ${product.cfop_default || "-"}`)}</small>
              </td>
              <td>${escapeHtml(product.category)}</td>
              <td>${escapeHtml(product.ncm || "-")}</td>
              <td>${formatNumber(product.stock_quantity)}</td>
              <td>${formatNumber(product.min_stock)}</td>
              <td>${formatMoney(product.sale_price)}</td>
              <td>
                ${product.active === false
                  ? renderBadge("Inativo", "neutral")
                  : (product.low_stock ? renderBadge("Estoque baixo", "danger") : renderBadge("Ativo", "success"))}
              </td>
              <td>${renderTableActions("product", product.id)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    <div class="table-pagination">
      <button type="button" class="btn btn-secondary" data-action="products-prev-page" ${pagination.page <= 1 ? "disabled" : ""}>Anterior</button>
      <span>Página ${pagination.page} de ${pagination.totalPages} • ${pagination.totalItems} produto(s)</span>
      <button type="button" class="btn btn-secondary" data-action="products-next-page" ${pagination.page >= pagination.totalPages ? "disabled" : ""}>Próxima</button>
    </div>
  ` : renderEmptyState("Nenhum produto encontrado", "Tente outro termo de busca ou cadastre um novo produto.");
}


function getFilteredStockProducts() {
  const filter = state.filters.stock;
  return getSimpleSearchRecords(getActiveProducts(), ["name", "sku", "category", "ncm"], filter.search)
    .filter((product) => {
      if (filter.stock_filter === "low") return product.low_stock;
      if (filter.stock_filter === "empty") return product.out_of_stock;
      return true;
    });
}


function renderStockResultsTable() {
  const products = getFilteredStockProducts();

  return products.length ? `
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>SKU</th>
            <th>Produto</th>
            <th>Categoria</th>
            <th>Atual</th>
            <th>Mínimo</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${products.map((product) => `
            <tr class="${product.low_stock ? "row-danger" : ""}">
              <td>${escapeHtml(product.sku || product.code)}</td>
              <td>
                <strong>${escapeHtml(product.name)}</strong>
                <small>${escapeHtml(`${product.unit} • NCM ${product.ncm || "-"}`)}</small>
              </td>
              <td>${escapeHtml(product.category)}</td>
              <td>${formatNumber(product.stock_quantity)}</td>
              <td>${formatNumber(product.min_stock)}</td>
              <td>${product.out_of_stock ? renderBadge("Sem estoque", "warning") : (product.low_stock ? renderBadge("Baixo", "danger") : renderBadge("OK", "success"))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  ` : renderEmptyState("Nenhum produto encontrado", "Ajuste a busca ou o filtro do saldo atual.");
}


function getFilteredIssuedRecords() {
  return getSimpleSearchRecords(
    state.data.nfe_issued || [],
    ["customer_name", "access_key", "number_nfe", "status_nfe", "payment_method", "source_type"],
    state.filters.nfe.search,
  );
}


function renderNfeIssuedResults() {
  const filteredIssued = getFilteredIssuedRecords();

  return filteredIssued.length ? `
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>Número</th>
            <th>Série</th>
            <th>Origem</th>
            <th>Cliente</th>
            <th>Status</th>
            <th>Data</th>
            <th>Total</th>
            <th>Arquivos</th>
          </tr>
        </thead>
        <tbody>
          ${filteredIssued.map((record) => `
            <tr>
              <td>${escapeHtml(String(record.number_nfe))}</td>
              <td>${escapeHtml(String(record.series_nfe))}</td>
              <td>${renderBadge(record.source_type === "manual" ? "Manual" : "Venda", record.source_type === "manual" ? "brand" : "neutral")}</td>
              <td>${escapeHtml(record.customer_name || "-")}</td>
              <td>${renderBadge(record.status_nfe, statusTone(record.status_nfe))}</td>
              <td>${escapeHtml(record.authorization_date ? record.authorization_date.slice(0, 10) : "-")}</td>
              <td>${formatMoney(record.total_amount)}</td>
              <td>
                <div class="table-actions">
                  <button type="button" class="table-action" data-action="download-nfe-xml" data-id="${record.id}">XML</button>
                  <button type="button" class="table-action" data-action="download-nfe-pdf" data-id="${record.id}">PDF</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  ` : renderEmptyState("Nenhuma NF-e encontrada", "Ajuste a busca ou emita uma nova NF-e pela página dedicada.");
}


function getFilteredCustomers() {
  return getSimpleSearchRecords(state.data.customers, ["name", "phone", "document", "address", "notes"], state.filters.customers.search);
}


function renderCustomersListResults() {
  const customers = getFilteredCustomers();

  return customers.length ? `
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
  ` : renderEmptyState("Nenhum cliente encontrado", "Tente outro termo ou cadastre um novo cliente.");
}


function getFilteredSalesData() {
  const period = getPeriod("sales");
  const periodSales = filterByPeriod(state.data.sales, "sale_date", period);
  const sales = getSimpleSearchRecords(periodSales, ["payment_method", "notes", "period", "sale_time"], state.filters.sales.search);

  return {
    period,
    sales,
    shiftSummary: getSalesShiftSummary(sales),
  };
}


function renderSalesMetricsSection() {
  const { period, shiftSummary } = getFilteredSalesData();

  return `
    <section class="metrics-grid metrics-grid-4">
      ${renderMetricCard({ label: "Vendas da manhã", value: formatMoney(shiftSummary.totalMorning), helper: `${shiftSummary.countMorning} venda(s)`, tone: "brand" })}
      ${renderMetricCard({ label: "Vendas da tarde", value: formatMoney(shiftSummary.totalAfternoon), helper: `${shiftSummary.countAfternoon} venda(s)` })}
      ${renderMetricCard({ label: "Total do período", value: formatMoney(shiftSummary.total), helper: period.label, tone: "success" })}
      ${renderMetricCard({ label: "Quantidade total", value: formatNumber(shiftSummary.count), helper: "Histórico filtrado" })}
    </section>
  `;
}


function renderSalesHistoryPanel() {
  const { period, sales } = getFilteredSalesData();

  return `
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
  `;
}


function getFilteredQuotes() {
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
  return quotes;
}


function renderQuotesListResults() {
  const quotes = getFilteredQuotes();

  return quotes.length ? `
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
  ` : renderEmptyState("Nenhum orçamento encontrado", "Cadastre um novo orçamento ou altere a busca.");
}


function getFilteredExpensesData() {
  const period = getPeriod("expenses");
  const filteredExpenses = getSimpleSearchRecords(
    filterByPeriod(state.data.expenses, "payment_date", period),
    ["description", "category", "payment_method", "supplier", "notes"],
    state.filters.expenses.search,
  );

  return {
    period,
    filteredExpenses,
    byCategory: getCategoryTotals(filteredExpenses, "category", "amount"),
    byPayment: getPaymentTotals(filteredExpenses, "payment_method", "amount"),
    recentExpenses: sortByDateDesc(filteredExpenses, "payment_date").slice(0, 6),
  };
}


function renderExpensesInsightsSection() {
  const { period, byCategory, byPayment } = getFilteredExpensesData();

  return `
    <section class="dashboard-grid">
      ${renderBarChart({ title: "Despesas por dia", subtitle: "Últimos 7 dias", data: groupByDay(state.data.expenses, "payment_date", (expense) => expense.amount, 7) })}
      ${renderBarChart({ title: "Despesas por mês", subtitle: "Últimos 6 meses", data: groupByMonth(state.data.expenses, "payment_date", (expense) => expense.amount, 6) })}
      ${renderStatList({ title: "Totais por categoria", subtitle: period.label, rows: byCategory })}
      ${renderStatList({ title: "Totais por pagamento", subtitle: period.label, rows: byPayment })}
    </section>
  `;
}


function renderExpensesRecentPanel() {
  const { period, recentExpenses } = getFilteredExpensesData();

  return `
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
  `;
}


function getBillsPeriod() {
  const preset = state.filters.bills.preset;

  if (preset === "all") {
    return {
      label: "Todos os boletos",
      start: "",
      end: "",
    };
  }

  if (preset === "overdue") {
    return {
      label: "Boletos atrasados",
      start: "",
      end: "",
    };
  }

  return getPeriod("bills");
}


function getFilteredBillsData() {
  const period = getBillsPeriod();
  let billsInPeriod = [...state.data.bills];

  if (state.filters.bills.preset === "overdue") {
    billsInPeriod = billsInPeriod.filter((bill) => bill.is_overdue);
  } else if (state.filters.bills.preset !== "all") {
    billsInPeriod = filterByPeriod(billsInPeriod, "due_date", period);
  }

  let filteredBills = getSimpleSearchRecords(
    billsInPeriod,
    ["beneficiary", "notes", "effective_status", "status"],
    state.filters.bills.search,
  );

  if (state.filters.bills.status) {
    filteredBills = filteredBills.filter((bill) => (
      bill.effective_status === state.filters.bills.status || bill.status === state.filters.bills.status
    ));
  }

  return {
    period,
    billsInPeriod,
    filteredBills,
    pendingBills: billsInPeriod.filter((bill) => !bill.is_paid),
    paidBills: billsInPeriod.filter((bill) => bill.is_paid),
    dueTodayBills: billsInPeriod.filter((bill) => bill.is_due_today),
    overdueBills: billsInPeriod.filter((bill) => bill.is_overdue),
  };
}


function renderBillPaidToggle(bill) {
  return `
    <label class="table-paid-toggle">
      <input
        type="checkbox"
        data-action="toggle-bill-paid"
        data-id="${bill.id}"
        ${bill.is_paid ? "checked" : ""}
      >
      <span>Pago</span>
    </label>
  `;
}


function renderBillsMetricsSection() {
  const { filteredBills, pendingBills, paidBills, dueTodayBills, overdueBills } = getFilteredBillsData();
  const metrics = [
    {
      label: "Boletos pendentes",
      value: formatNumber(pendingBills.length),
      helper: formatMoney(sumBy(pendingBills, (bill) => bill.amount)),
      tone: pendingBills.length ? "warning" : "neutral",
    },
    {
      label: "Boletos pagos",
      value: formatNumber(paidBills.length),
      helper: formatMoney(sumBy(paidBills, (bill) => bill.amount)),
      tone: "success",
    },
    {
      label: "Vencendo hoje",
      value: formatNumber(dueTodayBills.length),
      helper: formatMoney(sumBy(dueTodayBills, (bill) => bill.amount)),
      tone: dueTodayBills.length ? "warning" : "neutral",
    },
    {
      label: "Atrasados",
      value: formatNumber(overdueBills.length),
      helper: formatMoney(sumBy(overdueBills, (bill) => bill.amount)),
      tone: overdueBills.length ? "danger" : "success",
    },
    {
      label: "Valor total pendente",
      value: formatMoney(sumBy(pendingBills, (bill) => bill.amount)),
      helper: `${pendingBills.length} boleto(s) em aberto`,
      tone: "brand",
    },
    {
      label: "Valor total do filtro",
      value: formatMoney(sumBy(filteredBills, (bill) => bill.amount)),
      helper: `${filteredBills.length} registro(s)`,
      tone: "neutral",
    },
  ];

  return `
    <section class="metrics-grid ${getMetricsGridClass(metrics.length)}">
      ${metrics.map((metric) => renderMetricCard(metric)).join("")}
    </section>
  `;
}


function renderBillsDashboardSection() {
  const { period, billsInPeriod, dueTodayBills, overdueBills } = getFilteredBillsData();

  return `
    <section class="dashboard-grid">
      ${renderBarChart({
        title: "Boletos por semana",
        subtitle: "Agrupado pela data de vencimento",
        data: groupByWeek(billsInPeriod, "due_date", (bill) => bill.amount, 8),
      })}
      ${renderBarChart({
        title: "Boletos por mês",
        subtitle: "Agrupado pela data de vencimento",
        data: groupByMonth(billsInPeriod, "due_date", (bill) => bill.amount, 6),
      })}
      ${renderStatList({
        title: "Quantidade por status",
        subtitle: period.label,
        rows: getStatusTotals(billsInPeriod, "effective_status", "amount"),
        money: true,
      })}
      ${renderStatList({
        title: dueTodayBills.length ? "Boletos vencendo hoje" : "Boletos atrasados",
        subtitle: dueTodayBills.length ? "Atenção imediata" : "Pendências vencidas",
        rows: (dueTodayBills.length ? dueTodayBills : overdueBills).map((bill) => ({
          label: bill.beneficiary,
          value: bill.amount,
          helper: dueTodayBills.length
            ? `Vence em ${formatDate(bill.due_date)}`
            : `${bill.days_overdue} dia(s) de atraso`,
        })),
      })}
    </section>
  `;
}


function renderBillsListPanel() {
  const { filteredBills } = getFilteredBillsData();

  return `
    <article class="panel">
      <div class="section-header">
        <div>
          <h3>Lista de boletos</h3>
          <p>Controle prático com vencimento, status e marcação rápida de pagamento.</p>
        </div>
      </div>
      ${filteredBills.length ? `
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Beneficiário</th>
                <th>Vencimento</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Pago</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${filteredBills.map((bill) => `
                <tr class="${bill.is_overdue ? "row-danger" : bill.is_due_today ? "row-warning" : ""}">
                  <td>
                    <strong>${escapeHtml(bill.beneficiary)}</strong>
                    <small>${escapeHtml(bill.notes || "Sem observações")}</small>
                  </td>
                  <td>${formatDate(bill.due_date)}</td>
                  <td>${formatMoney(bill.amount)}</td>
                  <td>${renderBadge(bill.effective_status, statusTone(bill.effective_status))}</td>
                  <td>${renderBillPaidToggle(bill)}</td>
                  <td>${renderTableActions("bill", bill.id)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : renderEmptyState("Nenhum boleto encontrado", "Cadastre um boleto ou ajuste os filtros da tela.")}
    </article>
  `;
}


function getFilteredChecksData() {
  const period = getPeriod("checks");
  const checksInPeriod = filterByPeriod(state.data.checks, "due_date", period);
  let filteredChecks = [...checksInPeriod];
  filteredChecks = getSimpleSearchRecords(filteredChecks, ["check_number", "beneficiary", "notes"], state.filters.checks.search);
  if (state.filters.checks.status) {
    filteredChecks = filteredChecks.filter((check) => check.effective_status === state.filters.checks.status || check.status === state.filters.checks.status);
  }

  return {
    period,
    checksInPeriod,
    filteredChecks,
    pendingChecks: checksInPeriod.filter((check) => check.effective_status === "Pendente"),
    compensatedChecks: checksInPeriod.filter((check) => check.effective_status === "Compensado"),
    overdueChecks: checksInPeriod.filter((check) => check.effective_status === "Atrasado"),
  };
}


function renderChecksMetricsSection() {
  const { filteredChecks, pendingChecks, compensatedChecks, overdueChecks } = getFilteredChecksData();

  return `
    <section class="metrics-grid metrics-grid-4">
      ${renderMetricCard({ label: "Cheques pendentes", value: formatMoney(sumBy(pendingChecks, (check) => check.amount)), helper: `${pendingChecks.length} registro(s)`, tone: "warning" })}
      ${renderMetricCard({ label: "Cheques compensados", value: formatMoney(sumBy(compensatedChecks, (check) => check.amount)), helper: `${compensatedChecks.length} registro(s)`, tone: "success" })}
      ${renderMetricCard({ label: "Cheques atrasados", value: formatMoney(sumBy(overdueChecks, (check) => check.amount)), helper: `${overdueChecks.length} registro(s)`, tone: overdueChecks.length ? "danger" : "success" })}
      ${renderMetricCard({ label: "No filtro", value: formatMoney(sumBy(filteredChecks, (check) => check.amount)), helper: `${filteredChecks.length} registro(s)` })}
    </section>
  `;
}


function renderChecksDashboardSection() {
  const { period, checksInPeriod, overdueChecks } = getFilteredChecksData();

  return `
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
  `;
}


function renderChecksListPanel() {
  const { filteredChecks } = getFilteredChecksData();

  return `
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
  `;
}


function renderProductsPage() {
  const search = state.filters.products.search;
  const categoryFilter = state.filters.products.category;
  const activeFilter = state.filters.products.active_filter || "active";
  const editing = state.editing.products;
  const categories = [...new Set(state.data.products.map((product) => product.category).filter(Boolean))].sort();
  const activeProducts = getActiveProducts();
  const totalSaleValue = sumBy(activeProducts, (product) => product.stock_quantity * product.sale_price);

  return `
    ${renderHero(
      "Cadastro de produtos",
      "Catálogo técnico da loja com SKU, dados fiscais, filtros, importação de planilha e controle de ativo/inativo.",
      `
        <div class="hero-actions hero-actions-wrap">
          <a class="btn btn-secondary" href="/api/products/export?format=csv" target="_blank" rel="noreferrer">Exportar CSV</a>
          <a class="btn btn-secondary" href="/api/products/export?format=xlsx" target="_blank" rel="noreferrer">Exportar Excel</a>
        </div>
      `,
    )}

    <section class="metrics-grid metrics-grid-4">
      ${renderMetricCard({ label: "Produtos ativos", value: formatNumber(activeProducts.length), helper: "Base operacional" })}
      ${renderMetricCard({ label: "Inativos", value: formatNumber(state.data.products.filter((product) => product.active === false).length), helper: "Ocultos para venda" })}
      ${renderMetricCard({ label: "Estoque baixo", value: formatNumber(activeProducts.filter((product) => product.low_stock).length), helper: "Itens abaixo do mínimo", tone: "danger" })}
      ${renderMetricCard({ label: "Valor de venda em estoque", value: formatMoney(totalSaleValue), helper: "Estimativa pelo preço de venda", tone: "brand" })}
    </section>

    <section class="page-grid page-grid-2">
      <article class="panel">
        <div class="section-header">
          <div>
            <h3>${editing ? "Editar produto" : "Novo produto"}</h3>
            <p>${editing ? "Atualize os dados comerciais, fiscais e de estoque do produto." : "Cadastre SKU, preços, estoque e dados fiscais do item."}</p>
          </div>
        </div>
        <form id="products-form" class="form-grid">
          <input type="hidden" name="id" value="${editing?.id ?? ""}">
          ${renderFormFeedback("products")}
          <label><span>SKU</span><input type="text" name="sku" value="${escapeHtml(toFormValue(editing?.sku || editing?.code))}" required></label>
          <label><span>Categoria</span><input type="text" name="category" value="${escapeHtml(toFormValue(editing?.category))}" required></label>
          <label class="field-span-2"><span>Nome do produto</span><input type="text" name="name" value="${escapeHtml(toFormValue(editing?.name))}" required></label>
          <label>
            <span>Unidade</span>
            <select name="unit" required>
              ${state.data.options.product_units.map((unit) => `
                <option value="${unit}" ${editing?.unit === unit ? "selected" : ""}>${unit}</option>
              `).join("")}
            </select>
          </label>
          <label><span>NCM</span><input type="text" name="ncm" value="${escapeHtml(toFormValue(editing?.ncm))}" placeholder="Ex.: 25232910"></label>
          <label><span>CFOP padrão</span><input type="text" name="cfop_default" value="${escapeHtml(toFormValue(editing?.cfop_default))}" placeholder="Ex.: 5102"></label>
          <label><span>Origem</span><input type="text" name="origin" value="${escapeHtml(toFormValue(editing?.origin))}" placeholder="0"></label>
          <label><span>CSOSN</span><input type="text" name="csosn" value="${escapeHtml(toFormValue(editing?.csosn))}" placeholder="102"></label>
          <label><span>Preço de custo</span>${renderMoneyInput({ name: "cost_price", value: editing?.cost_price ?? 0, required: true })}</label>
          <label><span>Preço de venda</span>${renderMoneyInput({ name: "sale_price", value: editing?.sale_price ?? 0, required: true })}</label>
          <label><span>Quantidade em estoque</span><input type="number" name="stock_quantity" min="0" step="0.01" value="${editing?.stock_quantity ?? 0}" required></label>
          <label><span>Estoque mínimo</span><input type="number" name="min_stock" min="0" step="0.01" value="${editing?.min_stock ?? 0}" required></label>
          <label>
            <span>Status</span>
            <select name="active">
              <option value="true" ${(editing?.active ?? true) ? "selected" : ""}>Ativo</option>
              <option value="false" ${editing?.active === false ? "selected" : ""}>Inativo</option>
            </select>
          </label>
          <label class="field-span-2"><span>Descrição curta</span><textarea name="description" rows="3">${escapeHtml(toFormValue(editing?.description))}</textarea></label>
          <label class="field-span-2"><span>Observações</span><textarea name="notes" rows="3">${escapeHtml(toFormValue(editing?.notes))}</textarea></label>
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
            <p>Busque por nome, SKU, categoria ou NCM e importe planilhas do catálogo.</p>
          </div>
        </div>
        <section class="panel toolbar-panel" data-filter-scope="products">
          <div class="toolbar-row">
            <label class="toolbar-field toolbar-search">
              <span>Busca</span>
              <input type="search" name="search" value="${escapeHtml(search)}" placeholder="Ex.: cimento, MAT-001, ferragem, NCM">
            </label>
            <label class="toolbar-field">
              <span>Categoria</span>
              <select name="category">
                <option value="">Todas</option>
                ${categories.map((category) => `<option value="${escapeHtml(category)}" ${categoryFilter === category ? "selected" : ""}>${escapeHtml(category)}</option>`).join("")}
              </select>
            </label>
            <label class="toolbar-field">
              <span>Status</span>
              <select name="active_filter">
                <option value="active" ${activeFilter === "active" ? "selected" : ""}>Ativos</option>
                <option value="inactive" ${activeFilter === "inactive" ? "selected" : ""}>Inativos</option>
                <option value="all" ${activeFilter === "all" ? "selected" : ""}>Todos</option>
              </select>
            </label>
            <div class="toolbar-field products-import-field">
              <span>Importar planilha</span>
              <div class="inline-actions">
                <input type="file" id="products-import-file" accept=".xlsx,.xlsm,.csv">
                <button type="button" class="btn btn-secondary" data-action="import-products-sheet">Importar</button>
              </div>
            </div>
          </div>
        </section>
        <div data-search-results-scope="products">${renderProductsListResults()}</div>
      </article>
    </section>
  `;
}


function renderStockPage() {
  const overview = state.data.stock_overview || {};
  const filter = state.filters.stock;

  return `
    ${renderHero(
      "Estoque",
      "Registre entradas, saídas e ajustes de inventário com histórico completo e alerta visual para saldo baixo.",
    )}

    <section class="metrics-grid metrics-grid-4">
      ${renderMetricCard({ label: "Produtos ativos", value: formatNumber(overview.total_products || 0), helper: "Base operacional" })}
      ${renderMetricCard({ label: "Estoque baixo", value: formatNumber(overview.low_stock_products || 0), helper: "Abaixo do mínimo", tone: "danger" })}
      ${renderMetricCard({ label: "Sem estoque", value: formatNumber(overview.out_of_stock_products || 0), helper: "Itens zerados", tone: (overview.out_of_stock_products || 0) ? "warning" : "success" })}
      ${renderMetricCard({ label: "Valor estimado", value: formatMoney(overview.estimated_sale_value || 0), helper: "Preço de venda do saldo", tone: "brand" })}
    </section>

    <section class="page-grid page-grid-2">
      <article class="panel">
        <div class="section-header">
          <div>
            <h3>Movimentar estoque</h3>
            <p>Use ENTRADA para compra/reposição, SAÍDA para baixa manual e AJUSTE para saldo final contado.</p>
          </div>
        </div>
        <form id="stock-form" class="form-grid">
          ${renderFormFeedback("stock")}
          <label><span>Produto</span><select name="product_id" required>${renderProductOptions("")}</select></label>
          <label>
            <span>Tipo</span>
            <select name="movement_type" required>
              ${(state.data.options.stock_movement_types || []).map((item) => `<option value="${item}">${item}</option>`).join("")}
            </select>
          </label>
          <label><span>Quantidade / saldo final</span><input type="number" name="quantity" min="0.01" step="0.01" value="1" required></label>
          <label><span>Documento referência</span><input type="text" name="document_reference" placeholder="Ex.: NF compra 123 ou inventário"></label>
          <label class="field-span-2"><span>Motivo</span><textarea name="reason" rows="3" required></textarea></label>
          <div class="form-actions field-span-2">
            <button type="submit" class="btn btn-primary">Registrar movimentação</button>
          </div>
        </form>
      </article>

      <article class="panel">
        <div class="section-header">
          <div>
            <h3>Saldo atual por produto</h3>
            <p>Use a busca para localizar por SKU, nome, categoria ou NCM.</p>
          </div>
        </div>
        <section class="panel toolbar-panel" data-filter-scope="stock">
          <div class="toolbar-row">
            <label class="toolbar-field toolbar-search">
              <span>Busca</span>
              <input type="search" name="search" value="${escapeHtml(filter.search || "")}" placeholder="Ex.: MAT-001, cimento, 25232910">
            </label>
            <label class="toolbar-field">
              <span>Visão</span>
              <select name="stock_filter">
                <option value="" ${!filter.stock_filter ? "selected" : ""}>Todos</option>
                <option value="low" ${filter.stock_filter === "low" ? "selected" : ""}>Somente estoque baixo</option>
                <option value="empty" ${filter.stock_filter === "empty" ? "selected" : ""}>Somente sem estoque</option>
              </select>
            </label>
          </div>
        </section>
        <div data-search-results-scope="stock">${renderStockResultsTable()}</div>
      </article>
    </section>
  `;
}


function renderNfeValidationResult() {
  const validation = state.nfe.validation;
  if (!validation) {
    return renderEmptyState("Nenhuma validação executada", "Selecione uma venda e clique em validar para revisar dados fiscais e estoque.");
  }

  return `
    <div class="nfe-validation-stack">
      ${validation.issues?.length ? `
        <div class="form-feedback form-feedback-error">
          ${validation.issues.map((issue) => `<div>${escapeHtml(issue)}</div>`).join("")}
        </div>
      ` : `
        <div class="form-feedback form-feedback-success">Validação fiscal concluída com sucesso. A venda está pronta para emissão.</div>
      `}
      <div class="validation-list">
        ${validation.checks.map((check) => `
          <div class="validation-row ${check.ok ? "ok" : "error"}">
            <strong>${escapeHtml(check.label)}</strong>
            <span>${check.ok ? "OK" : "Pendente"}</span>
            <small>${escapeHtml(check.message || "")}</small>
          </div>
        `).join("")}
      </div>
      <div class="validation-list">
        ${validation.items.map((item) => `
          <div class="validation-row ${item.ok ? "ok" : "error"}">
            <strong>${escapeHtml(item.sku || "-")} • ${escapeHtml(item.description || "-")}</strong>
            <span>${item.ok ? "Item pronto" : "Ajustar cadastro"}</span>
            <small>${item.ok ? "NCM, CFOP, origem, CSOSN e estoque OK." : `Pendências: ${escapeHtml(item.missing_fields.join(", "))}`}</small>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}


function renderNfePage() {
  const settings = state.data.fiscal_settings || {};
  const issued = state.data.nfe_issued || [];
  const authorizedCount = issued.filter((item) => item.status_nfe === "AUTORIZADA").length;
  const manualCount = issued.filter((item) => item.source_type === "manual").length;
  const recentIssued = issued.slice(0, 3);

  return `
    ${renderHero(
      "NF-e",
      "Mantenha os dados fiscais da empresa em dia e abra a nova página exclusiva para montar e emitir a NF-e com mais conforto.",
      `
        <div class="hero-actions-wrap">
          <button type="button" class="btn btn-primary" data-action="open-new-nfe-page">Cadastrar NF-e</button>
        </div>
      `,
    )}

    <section class="metrics-grid metrics-grid-4">
      ${renderMetricCard({ label: "NF-e emitidas", value: formatNumber(issued.length), helper: "Histórico geral" })}
      ${renderMetricCard({ label: "Autorizadas", value: formatNumber(authorizedCount), helper: "Status autorizado", tone: "success" })}
      ${renderMetricCard({ label: "NF-e manuais", value: formatNumber(manualCount), helper: "Fluxo independente de vendas", tone: "brand" })}
      ${renderMetricCard({ label: "Próximo número", value: formatNumber(settings.next_nfe_number || 1), helper: settings.environment === "production" ? "Produção" : "Homologação", tone: "brand" })}
    </section>

    <section class="page-grid page-grid-2">
      <article class="panel">
        <div class="section-header">
          <div>
            <h3>Configurações fiscais da empresa</h3>
            <p>Esses dados são usados no emitente da NF-e e no DANFE.</p>
          </div>
        </div>
        <form id="fiscal-settings-form" class="form-grid">
          ${renderFormFeedback("fiscal")}
          <label class="field-span-2"><span>Razão social</span><input type="text" name="company_name" value="${escapeHtml(toFormValue(settings.company_name))}"></label>
          <label><span>Nome fantasia</span><input type="text" name="trade_name" value="${escapeHtml(toFormValue(settings.trade_name))}"></label>
          <label><span>CNPJ</span><input type="text" name="cnpj" value="${escapeHtml(toFormValue(settings.cnpj))}" placeholder="00.000.000/0000-00"></label>
          <label><span>Inscrição estadual</span><input type="text" name="state_registration" value="${escapeHtml(toFormValue(settings.state_registration))}"></label>
          <label><span>Regime tributário</span><input type="text" name="tax_regime" value="${escapeHtml(toFormValue(settings.tax_regime))}" placeholder="Simples Nacional"></label>
          <label class="field-span-2"><span>Endereço</span><input type="text" name="street" value="${escapeHtml(toFormValue(settings.street))}"></label>
          <label><span>Número</span><input type="text" name="number" value="${escapeHtml(toFormValue(settings.number))}"></label>
          <label><span>Complemento</span><input type="text" name="complement" value="${escapeHtml(toFormValue(settings.complement))}"></label>
          <label><span>Bairro</span><input type="text" name="district" value="${escapeHtml(toFormValue(settings.district))}"></label>
          <label><span>Cidade</span><input type="text" name="city" value="${escapeHtml(toFormValue(settings.city))}"></label>
          <label><span>UF</span><input type="text" name="state" value="${escapeHtml(toFormValue(settings.state))}"></label>
          <label><span>CEP</span><input type="text" name="zip_code" value="${escapeHtml(toFormValue(settings.zip_code))}"></label>
          <label><span>Telefone</span><input type="text" name="phone" value="${escapeHtml(toFormValue(settings.phone))}"></label>
          <label><span>E-mail</span><input type="email" name="email" value="${escapeHtml(toFormValue(settings.email))}"></label>
          <label><span>Série padrão</span><input type="number" min="1" name="default_series" value="${escapeHtml(toFormValue(settings.default_series || 1))}"></label>
          <label><span>Próximo número</span><input type="number" min="1" name="next_nfe_number" value="${escapeHtml(toFormValue(settings.next_nfe_number || 1))}"></label>
          <label>
            <span>Ambiente</span>
            <select name="environment">
              ${(state.data.options.fiscal_environments || []).map((item) => `<option value="${item}" ${settings.environment === item ? "selected" : ""}>${item === "production" ? "Produção" : "Homologação"}</option>`).join("")}
            </select>
          </label>
          <label>
            <span>Provider</span>
            <select name="provider_name">
              ${(state.data.options.fiscal_provider_options || []).map((item) => `<option value="${item}" ${settings.provider_name === item ? "selected" : ""}>${item}</option>`).join("")}
            </select>
          </label>
          <label><span>Token/API</span><input type="text" name="api_token" value="${escapeHtml(toFormValue(settings.api_token))}"></label>
          <label><span>URL API</span><input type="text" name="api_url" value="${escapeHtml(toFormValue(settings.api_url))}"></label>
          <label><span>Certificado A1</span><input type="text" name="certificate_path" value="${escapeHtml(toFormValue(settings.certificate_path))}"></label>
          <label><span>Senha certificado</span><input type="password" name="certificate_password" value="${escapeHtml(toFormValue(settings.certificate_password))}"></label>
          <label><span>CSC</span><input type="text" name="csc" value="${escapeHtml(toFormValue(settings.csc))}"></label>
          <label>
            <span>Estoque negativo</span>
            <select name="allow_negative_stock">
              <option value="false" ${settings.allow_negative_stock ? "" : "selected"}>Bloqueado</option>
              <option value="true" ${settings.allow_negative_stock ? "selected" : ""}>Liberado</option>
            </select>
          </label>
          <div class="form-actions field-span-2">
            <button type="submit" class="btn btn-primary">Salvar configurações</button>
          </div>
        </form>
      </article>

      <article class="panel">
        <div class="section-header">
          <div>
            <h3>Novo fluxo de emissão</h3>
            <p>A emissão agora acontece em uma página própria, separada da aba de vendas, para deixar o trabalho mais rápido e organizado.</p>
          </div>
        </div>
        <div class="nfe-flow-card">
          <div class="nfe-flow-step">
            <strong>1. Cadastre a NF-e em página separada</strong>
            <p>Use a nova rota dedicada para informar cliente, escolher produtos, ajustar valores e emitir sem depender da aba Vendas.</p>
          </div>
          <div class="nfe-flow-step">
            <strong>2. Gere os documentos fiscais</strong>
            <p>Ao emitir, o sistema salva o XML mock autorizado e o DANFE em PDF para download imediato.</p>
          </div>
          <div class="nfe-flow-step">
            <strong>3. Consulte o histórico aqui</strong>
            <p>Depois da emissão, a NF-e volta para esta aba com número, status, cliente e links de XML/PDF.</p>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-primary btn-block" data-action="open-new-nfe-page">Abrir página de NF-e</button>
          </div>
        </div>

        ${recentIssued.length ? `
          <div class="stat-list">
            ${recentIssued.map((record) => `
              <div class="stat-row">
                <div>
                  <strong>NF-e #${escapeHtml(String(record.number_nfe))}</strong>
                  <small>${escapeHtml(record.customer_name || "Cliente não informado")} • ${escapeHtml(record.payment_method || "-")}</small>
                </div>
                <div class="stat-row-right">
                  <span>${formatMoney(record.total_amount)}</span>
                </div>
              </div>
            `).join("")}
          </div>
        ` : renderEmptyState("Nenhuma NF-e emitida", "Assim que você emitir a primeira NF-e, ela aparecerá aqui.")}
      </article>
    </section>

    <section class="panel">
      <div class="section-header">
        <div>
          <h3>NF-e emitidas</h3>
          <p>XML autorizado e DANFE em PDF disponíveis para download.</p>
        </div>
      </div>
      <section class="panel toolbar-panel" data-filter-scope="nfe">
        <div class="toolbar-row">
          <label class="toolbar-field toolbar-search">
            <span>Busca</span>
            <input type="search" name="search" value="${escapeHtml(state.filters.nfe.search || "")}" placeholder="Número, cliente, chave, pagamento ou origem">
          </label>
        </div>
      </section>
      <div data-search-results-scope="nfe">${renderNfeIssuedResults()}</div>
    </section>
  `;
}


function renderCustomersPage() {
  const search = state.filters.customers.search;
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
        <div data-search-results-scope="customers">${renderCustomersListResults()}</div>
      </article>
    </section>
  `;
}


function renderSalesPage() {
  const editing = state.editing.sales;
  const currentDate = editing?.sale_date || localTodayIso();
  const currentTime = editing?.sale_time || currentTimeValue();
  const currentPeriod = inferSalePeriod(currentTime);
  const salesPaymentMethods = state.data.options.sales_payment_methods?.length
    ? state.data.options.sales_payment_methods
    : state.data.options.payment_methods;
  const selectedPaymentMethod = editing?.payment_method || salesPaymentMethods[0] || state.data.options.payment_methods[0] || "";
  const draftAmount = editing?.total_amount || editing?.amount || 0;

  return `
    ${renderHero(
      "Vendas rápidas",
      "Tela de caixa rápido para registrar vendas em poucos toques, sem itens e sem burocracia.",
    )}

    ${renderPeriodToolbar("sales", {
      showSearch: true,
      searchPlaceholder: "Buscar por pagamento, horário, período ou observação",
    })}

    <div data-search-results-scope="sales" data-search-results-part="metrics">${renderSalesMetricsSection()}</div>

    <section class="page-grid page-grid-2">
      <article class="panel">
        <div class="section-header">
          <div>
            <h3>${editing ? "Editar venda" : "Nova venda"}</h3>
            <p>${editing ? "Ajuste o valor, a forma de pagamento, a data e o horário da venda selecionada." : "Informe valor, pagamento, data e hora para registrar a venda rapidamente."}</p>
          </div>
        </div>
        <form id="sales-form" class="form-grid quick-sale-form">
          <input type="hidden" name="id" value="${editing?.id ?? ""}">
          ${renderFormFeedback("sales")}
          <label class="field-span-2 quick-sale-amount">
            <span>Valor da venda</span>
            ${renderMoneyInput({ name: "amount", value: draftAmount, required: true, classes: "money-input-large" })}
          </label>
          <label>
            <span>Meio de pagamento</span>
            <select name="payment_method" required>
              ${renderPaymentOptions(selectedPaymentMethod, salesPaymentMethods)}
            </select>
          </label>
          <div class="field-span-2 quick-sale-meta">
            <label>
              <span>Data da venda</span>
              <input type="date" name="sale_date" value="${currentDate}" required>
            </label>
            <label>
              <span>Hora da venda</span>
              <input type="time" name="sale_time" value="${currentTime}" step="60" required>
            </label>
            <div class="quick-sale-period-lockup">
              <span>Período calculado</span>
              <strong data-sale-period-summary>${escapeHtml(currentPeriod)}</strong>
              <small>Calculado automaticamente pela hora informada.</small>
            </div>
          </div>
          <div class="field-span-2 quick-sale-summary">
            <div class="quick-summary-card">
              <span>Data e horário da venda</span>
              <strong><span data-sale-date-summary>${escapeHtml(formatDate(currentDate))}</span> às <span data-sale-time-summary>${escapeHtml(currentTime)}</span></strong>
              <small data-sale-date-caption>Os campos já vêm preenchidos, mas você pode editar manualmente antes de salvar.</small>
            </div>
          </div>

          <div class="form-actions field-span-2">
            <button type="submit" class="btn btn-primary">${editing ? "Salvar venda" : "Registrar venda"}</button>
            <button type="button" class="btn btn-secondary" data-action="clear-sales-form">Limpar formulário</button>
          </div>
        </form>
      </article>
      <div data-search-results-scope="sales" data-search-results-part="history">${renderSalesHistoryPanel()}</div>
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
  const items = getQuoteItems().filter((item) => item.item_name);
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
  const editing = state.editing.quotes;
  const composer = syncQuoteComposerState();
  const approvedCount = countBy(state.data.quotes, (quote) => quote.status === "Aprovado");
  const initialCustomerManualName = editing?.customer_name_manual || "";
  const initialDiscount = Number(editing?.discount_amount || 0);
  const initialSubtotal = sumBy(composer.items, (item) => item.total_price || (Number(item.quantity || 0) * Number(item.unit_price || 0)));
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
                <h3>Lançamento de itens</h3>
                <p>Adicione um item por vez e acompanhe a lista do orçamento logo abaixo.</p>
              </div>
            </div>
            <div class="quote-entry-layout">
              ${renderQuoteDraftEditor()}
              <div data-quote-items-list>
                ${renderQuoteItemsList()}
              </div>
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
        <div data-search-results-scope="quotes">${renderQuotesListResults()}</div>
      </article>
    </section>
  `;
}


function renderExpensesPage() {
  const editing = state.editing.expenses;

  const todayExpenses = filterByPeriod(state.data.expenses, "payment_date", getPresetRange("today"));
  const weekExpenses = filterByPeriod(state.data.expenses, "payment_date", getPresetRange("week"));
  const monthExpenses = filterByPeriod(state.data.expenses, "payment_date", getPresetRange("month"));
  const yearExpenses = filterByPeriod(state.data.expenses, "payment_date", getPresetRange("year"));

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

    <div data-search-results-scope="expenses" data-search-results-part="insights">${renderExpensesInsightsSection()}</div>

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
      <div data-search-results-scope="expenses" data-search-results-part="recent">${renderExpensesRecentPanel()}</div>
    </section>
  `;
}


function renderBillsPage() {
  const editing = state.editing.bills;

  return `
    ${renderHero(
      "Boletos",
      "Controle os boletos a pagar com alertas de vencimento, filtros rápidos e atualização imediata do status.",
    )}

    ${renderPeriodToolbar("bills", {
      showSearch: true,
      searchPlaceholder: "Buscar por beneficiário",
      showStatus: true,
      statusOptions: state.data.options.bill_statuses || [],
      presetOptions: [
        { value: "today", label: "Hoje" },
        { value: "week", label: "Esta semana" },
        { value: "month", label: "Este mês" },
        { value: "overdue", label: "Atrasados" },
        { value: "all", label: "Todos" },
        { value: "custom", label: "Período personalizado" },
      ],
      manualDateFields: ["start", "end"],
    })}

    <div data-search-results-scope="bills" data-search-results-part="metrics">${renderBillsMetricsSection()}</div>
    <div data-search-results-scope="bills" data-search-results-part="dashboard">${renderBillsDashboardSection()}</div>

    <section class="page-grid page-grid-2">
      <article class="panel">
        <div class="section-header">
          <div>
            <h3>${editing ? "Editar boleto" : "Novo boleto"}</h3>
            <p>${editing ? "Atualize beneficiário, vencimento, valor e status do boleto selecionado." : "Cadastre boletos manualmente e marque como pago quando necessário."}</p>
          </div>
        </div>
        <form id="bills-form" class="form-grid">
          <input type="hidden" name="id" value="${editing?.id ?? ""}">
          ${renderFormFeedback("bills")}
          <label class="field-span-2">
            <span>Beneficiário</span>
            <input type="text" name="beneficiary" value="${escapeHtml(toFormValue(editing?.beneficiary))}" required>
          </label>
          <label>
            <span>Data do vencimento</span>
            <input type="date" name="due_date" value="${editing?.due_date || todayIso()}" required>
          </label>
          <label>
            <span>Valor</span>
            ${renderMoneyInput({ name: "amount", value: editing?.amount ?? 0, required: true })}
          </label>
          <div class="field-span-2 inline-check-field">
            <span>Status</span>
            <input type="hidden" name="is_paid" value="false">
            <label class="inline-check-card">
              <input type="checkbox" name="is_paid" value="true" ${editing?.is_paid ? "checked" : ""}>
              <div>
                <strong>Pago</strong>
                <small>Marque quando o boleto já tiver sido quitado.</small>
              </div>
            </label>
          </div>
          <label class="field-span-2">
            <span>Observações</span>
            <textarea name="notes" rows="3">${escapeHtml(toFormValue(editing?.notes))}</textarea>
          </label>
          <div class="form-actions field-span-2">
            <button type="submit" class="btn btn-primary">${editing ? "Salvar boleto" : "Cadastrar boleto"}</button>
            <button type="button" class="btn btn-secondary" data-action="clear-bills-form">Limpar formulário</button>
          </div>
        </form>
      </article>
      <div data-search-results-scope="bills" data-search-results-part="list">${renderBillsListPanel()}</div>
    </section>
  `;
}


function renderChecksPage() {
  const editing = state.editing.checks;

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

    <div data-search-results-scope="checks" data-search-results-part="metrics">${renderChecksMetricsSection()}</div>
    <div data-search-results-scope="checks" data-search-results-part="dashboard">${renderChecksDashboardSection()}</div>

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
      <div data-search-results-scope="checks" data-search-results-part="list">${renderChecksListPanel()}</div>
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
      tableHeaders: ["Data", "Cliente", "Hora", "Período", "Pagamento", "Total"],
      tableRows: rows.map((item) => [
        formatDate(item.sale_date),
        item.customer_name || "Consumidor final",
        item.sale_time || "-",
        resolveSalePeriod(item),
        item.payment_method,
        formatMoney(item.total_amount),
      ]),
      csvColumns: [
        { label: "Data", value: (item) => item.sale_date },
        { label: "Cliente", value: (item) => item.customer_name || "Consumidor final" },
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

  const rows = [...getActiveProducts()];
  return {
    title: "Relatório de estoque",
    subtitle: "Posição atual do estoque",
    metrics: [
      { label: "Produtos cadastrados", value: formatNumber(rows.length), helper: "Base atual" },
      { label: "Estoque baixo", value: formatNumber(countBy(rows, (item) => item.low_stock)), helper: "Abaixo do mínimo" },
      { label: "Valor de venda", value: formatMoney(sumBy(rows, (item) => item.stock_quantity * item.sale_price)), helper: "Estimativa" },
    ],
    chart: rows.slice(0, 7).map((item) => ({ label: item.sku || item.code, value: item.stock_quantity })),
    tableHeaders: ["SKU", "Produto", "Categoria", "Estoque"],
    tableRows: rows.map((item) => [item.sku || item.code, item.name, item.category, formatNumber(item.stock_quantity)]),
    csvColumns: [
      { label: "SKU", value: (item) => item.sku || item.code },
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
    "stock-form": () => submitStockForm(form),
    "customers-form": () => submitSimpleForm(form, "customers"),
    "sales-form": () => submitSalesForm(form),
    "quotes-form": () => submitQuotesForm(form),
    "expenses-form": () => submitSimpleForm(form, "expenses"),
    "bills-form": () => submitSimpleForm(form, "bills"),
    "checks-form": () => submitSimpleForm(form, "checks"),
    "fiscal-settings-form": () => submitFiscalSettingsForm(form),
  };

  const handler = handlers[formId];
  if (handler) {
    await handler();
  }
}


function handlePageKeyDown(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const form = target.closest("form");
  if (form?.getAttribute("id") !== "quotes-form") return;
  if (event.key !== "Enter" || event.shiftKey) return;

  const fieldName = target.getAttribute("name") || "";
  if (!["draft_item_name", "draft_quantity", "draft_unit_price"].includes(fieldName)) {
    return;
  }

  event.preventDefault();
  handleSaveQuoteItem(form);
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
    "clear-bills-form": () => clearEditing("bills"),
    "clear-checks-form": () => clearEditing("checks"),
    "products-prev-page": () => {
      state.filters.products.page = Math.max((state.filters.products.page || 1) - 1, 1);
      renderCurrentPage();
    },
    "products-next-page": () => {
      state.filters.products.page = (state.filters.products.page || 1) + 1;
      renderCurrentPage();
    },
    "import-products-sheet": () => {
      void importProductsSheet();
    },
    "save-quote-item": () => {
      const form = document.getElementById("quotes-form");
      if (form) {
        handleSaveQuoteItem(form);
      }
    },
    "edit-quote-item": () => {
      const form = document.getElementById("quotes-form");
      const index = Number(button.dataset.index);
      if (form && Number.isInteger(index)) {
        handleEditQuoteItem(form, index);
      }
    },
    "cancel-quote-item-edit": () => {
      const form = document.getElementById("quotes-form");
      if (form) {
        handleCancelQuoteItemEdit(form);
      }
    },
    "add-sale-item": () => {
      const form = document.getElementById("sales-form");
      mountSaleItem(form);
    },
    "remove-quote-item": () => {
      const form = button.closest("form");
      const index = Number(button.dataset.index);
      if (form && Number.isInteger(index)) {
        handleRemoveQuoteItem(form, index);
      }
    },
    "remove-sale-item": () => {
      const row = button.closest(".sale-item-row");
      const form = button.closest("form");
      if (row && form) {
        row.remove();
        if (!form.querySelector(".sale-item-row")) {
          mountSaleItem(form);
        }
        updateSaleTotals(form);
      }
    },
    "edit-product": () => editEntity("products", id),
    "edit-customer": () => editEntity("customers", id),
    "edit-sale": () => editEntity("sales", id),
    "edit-quote": () => editEntity("quotes", id),
    "edit-expense": () => editEntity("expenses", id),
    "edit-bill": () => editEntity("bills", id),
    "edit-check": () => editEntity("checks", id),
    "delete-product": () => deleteEntity("products", id, "produto"),
    "delete-customer": () => deleteEntity("customers", id, "cliente"),
    "delete-sale": () => deleteEntity("sales", id, "venda"),
    "delete-quote": () => deleteEntity("quotes", id, "orçamento"),
    "delete-expense": () => deleteEntity("expenses", id, "conta paga"),
    "delete-bill": () => deleteEntity("bills", id, "boleto"),
    "delete-check": () => deleteEntity("checks", id, "cheque"),
    "print-quote": () => openQuoteOutput(id, "print"),
    "pdf-quote": () => openQuoteOutput(id, "pdf"),
    "open-new-nfe-page": () => {
      window.location.assign("/nfe/nova");
    },
    "validate-nfe-sale": () => {
      void validateSelectedSaleForNfe();
    },
    "emit-nfe": () => {
      void emitSelectedSaleNfe();
    },
    "download-nfe-xml": () => {
      window.open(`/api/nfe/${id}/xml`, "_blank", "noopener");
    },
    "download-nfe-pdf": () => {
      window.open(`/api/nfe/${id}/pdf`, "_blank", "noopener");
    },
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

  if (target instanceof HTMLInputElement && target.dataset.action === "toggle-bill-paid") {
    void toggleBillPaid(target.dataset.id, target.checked);
    return;
  }

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
      if (scope === "products" && ["category", "active_filter"].includes(target.name)) {
        state.filters.products.page = 1;
      }
      if (scope === "nfe" && target.name === "sale_id") {
        state.nfe.selectedSaleId = target.value;
        state.nfe.validation = null;
      }
      renderCurrentPage();
      return;
    }
  }

  const saleRow = target.closest(".sale-item-row");
  if (saleRow && target.getAttribute("name") === "product_id") {
    syncSaleItemProductData(saleRow);
    updateSaleTotals(target.closest("form"));
  }

  const form = target.closest("form");
  if (form?.getAttribute("id") === "sales-form" && target.getAttribute("name") === "sale_time") {
    const periodLabel = inferSalePeriod(target.value || currentTimeValue());
    const summary = form.querySelector("[data-sale-period-summary]");
    if (summary) {
      summary.textContent = periodLabel;
    }
    const timeSummary = form.querySelector("[data-sale-time-summary]");
    if (timeSummary) {
      timeSummary.textContent = target.value || currentTimeValue();
    }
  }

  if (form?.getAttribute("id") === "sales-form" && target.getAttribute("name") === "sale_date") {
    const summary = form.querySelector("[data-sale-date-summary]");
    if (summary) {
      summary.textContent = formatDate(target.value || localTodayIso());
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
    if (scope === "products") {
      state.filters.products.page = 1;
    }
    clearTimeout(searchTimers.get(scope));
    searchTimers.set(scope, setTimeout(() => {
      searchTimers.delete(scope);
      renderFilterResultsScope(scope);
    }, 160));
    return;
  }

  const form = target.closest("form");
  if (
    form?.getAttribute("id") === "quotes-form"
    && ["draft_quantity", "draft_unit_price", "discount_amount", "draft_item_name"].includes(target.getAttribute("name") || "")
  ) {
    updateQuoteTotals(form);
  }

  if (
    form?.getAttribute("id") === "sales-form"
    && ["quantity", "unit_price"].includes(target.getAttribute("name") || "")
  ) {
    updateSaleTotals(form);
  }

  if (form?.getAttribute("id") === "sales-form" && target.getAttribute("name") === "sale_time") {
    const periodLabel = inferSalePeriod(target.value || currentTimeValue());
    const summary = form.querySelector("[data-sale-period-summary]");
    if (summary) {
      summary.textContent = periodLabel;
    }
    const timeSummary = form.querySelector("[data-sale-time-summary]");
    if (timeSummary) {
      timeSummary.textContent = target.value || currentTimeValue();
    }
  }

  if (form?.getAttribute("id") === "sales-form" && target.getAttribute("name") === "sale_date") {
    const summary = form.querySelector("[data-sale-date-summary]");
    if (summary) {
      summary.textContent = formatDate(target.value || localTodayIso());
    }
    const caption = form.querySelector("[data-sale-date-caption]");
    if (caption) {
      caption.textContent = "Os campos já vêm preenchidos, mas você pode editar manualmente antes de salvar.";
    }
  }
}


function clearEditing(scope) {
  state.editing[scope] = null;
  if (scope === "quotes") {
    resetQuoteComposer();
  }
  clearFormFeedback(scope);
  renderCurrentPage();
}


function editEntity(scope, id) {
  state.editing[scope] = state.data[scope].find((item) => String(item.id) === String(id)) || null;
  if (scope === "quotes") {
    resetQuoteComposer();
  }
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
    if (scope === "quotes") {
      resetQuoteComposer();
    }
    clearFormFeedback(scope);
    await loadData();
    showToast(`${label.charAt(0).toUpperCase() + label.slice(1)} excluído com sucesso.`);
  } catch (error) {
    showToast(error.message, "error");
  }
}


async function toggleBillPaid(id, isPaid) {
  if (!id) return;

  try {
    await api.update("bills", id, { is_paid: isPaid });
    if (state.editing.bills && String(state.editing.bills.id) === String(id)) {
      state.editing.bills = null;
    }
    clearFormFeedback("bills");
    await loadData();
    showToast(isPaid ? "Boleto marcado como pago." : "Boleto voltou para pendente.");
  } catch (error) {
    showToast(error.message, "error");
    await loadData();
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


async function submitStockForm(form) {
  const payload = normalizePayload(Object.fromEntries(new FormData(form).entries()));

  try {
    if (!payload.product_id) {
      throw new Error("Selecione o produto da movimentação.");
    }
    if (!payload.movement_type) {
      throw new Error("Selecione o tipo da movimentação.");
    }
    if (!payload.quantity || !isValidNumber(payload.quantity, { min: 0.01, allowZero: false })) {
      throw new Error("Informe uma quantidade válida para a movimentação.");
    }
    if (!payload.reason) {
      throw new Error("Descreva o motivo da movimentação.");
    }
  } catch (error) {
    updateFormFeedback("stock", form, error.message, "error");
    showToast(error.message, "error");
    return;
  }

  setFormBusy(form, true);
  try {
    await api.post("/api/stock/entries", payload);
    setFormFeedback("stock", "Movimentação registrada com sucesso.", "success");
    showToast("Movimentação registrada com sucesso.");
    form.reset();
    await loadData();
  } catch (error) {
    updateFormFeedback("stock", form, error.message, "error");
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
  payload.sale_date = payload.sale_date || localTodayIso();
  payload.sale_time = payload.sale_time || currentTimeValue();
  const id = payload.id;
  delete payload.id;
  const allowedPaymentMethods = new Set([
    ...(state.data.options.sales_payment_methods || []),
  ]);

  try {
    if (!isValidNumber(payload.amount, { min: 0.01, allowZero: false })) {
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
      throw new Error("Informe o horário da venda.");
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


async function submitFiscalSettingsForm(form) {
  const payload = normalizePayload(Object.fromEntries(new FormData(form).entries()));

  setFormBusy(form, true);
  try {
    const response = await api.put("/api/fiscal-settings", payload);
    state.data.fiscal_settings = response.item;
    setFormFeedback("fiscal", "Configurações fiscais salvas com sucesso.", "success");
    showToast("Configurações fiscais salvas com sucesso.");
    await loadData();
  } catch (error) {
    updateFormFeedback("fiscal", form, error.message, "error");
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
  delete payload.draft_item_name;
  delete payload.draft_unit;
  delete payload.draft_quantity;
  delete payload.draft_unit_price;
  payload.items = getQuoteItems();

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
    resetQuoteComposer();
    await loadData();
  } catch (error) {
    updateFormFeedback("quotes", form, error.message, "error");
    showToast(error.message, "error");
  } finally {
    setFormBusy(form, false);
  }
}


async function importProductsSheet() {
  const fileInput = document.getElementById("products-import-file");
  const file = fileInput?.files?.[0];
  if (!file) {
    showToast("Selecione uma planilha Excel/CSV antes de importar.", "error");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await api.upload("/api/products/import", formData);
    const report = response.report || {};
    showToast(`Importação concluída: ${report.imported || 0} importado(s), ${report.updated || 0} atualizado(s), ${report.ignored || 0} ignorado(s).`);
    if (report.errors?.length) {
      showToast(`A importação terminou com ${report.errors.length} aviso(s).`, "info");
    }
    await loadData();
    if (fileInput) {
      fileInput.value = "";
    }
  } catch (error) {
    showToast(error.message, "error");
  }
}


async function validateSelectedSaleForNfe() {
  const saleId = state.filters.nfe.sale_id || state.nfe.selectedSaleId;
  if (!saleId) {
    showToast("Selecione uma venda para validar a NF-e.", "error");
    return;
  }

  try {
    const response = await api.get(`/api/nfe/validate/${saleId}`);
    state.nfe.selectedSaleId = String(saleId);
    state.nfe.validation = response.result;
    renderCurrentPage();
    showToast(response.result.can_emit ? "Validação fiscal concluída com sucesso." : "Validação fiscal encontrou pendências.", response.result.can_emit ? "success" : "error");
  } catch (error) {
    showToast(error.message, "error");
  }
}


async function emitSelectedSaleNfe() {
  const saleId = state.filters.nfe.sale_id || state.nfe.selectedSaleId;
  if (!saleId) {
    showToast("Selecione uma venda para emitir a NF-e.", "error");
    return;
  }

  try {
    await api.post("/api/nfe/emit", { sale_id: saleId });
    showToast("NF-e emitida com sucesso.");
    state.nfe.validation = null;
    await loadData();
  } catch (error) {
    showToast(error.message, "error");
  }
}


function exportReport() {
  const report = buildReport();
  const csv = buildCsv(report.rawRows, report.csvColumns);
  const fileName = `${state.filters.reports.module}-relatorio.csv`;
  downloadTextFile(fileName, csv);
  showToast("Relatório exportado em CSV.");
}


