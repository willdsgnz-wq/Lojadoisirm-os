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
const QUOTE_ITEM_UNITS = [
  "Unidade",
  "Metro",
  "Metro Quadrado",
  "Metro Cúbico",
  "Litro",
  "Lata",
  "Saco",
  "Fardo",
  "Cento",
  "Tonelada",
  "Quilograma",
];
const DEFAULT_QUOTE_UNIT = QUOTE_ITEM_UNITS[0];
const QUOTE_UNIT_VALUE_MAP = {
  UN: "Unidade",
  UNIDADE: "Unidade",
  MT: "Metro",
  M: "Metro",
  METRO: "Metro",
  M2: "Metro Quadrado",
  "M²": "Metro Quadrado",
  METROQUADRADO: "Metro Quadrado",
  M3: "Metro Cúbico",
  "M³": "Metro Cúbico",
  METROCUBICO: "Metro Cúbico",
  LT: "Litro",
  L: "Litro",
  LITRO: "Litro",
  LATA: "Lata",
  SC: "Saco",
  SACO: "Saco",
  FD: "Fardo",
  FARDO: "Fardo",
  CT: "Cento",
  CENTO: "Cento",
  TON: "Tonelada",
  TONELADA: "Tonelada",
  KG: "Quilograma",
  QUILOGRAMA: "Quilograma",
};
const NOTIFICATION_SESSION_KEY = "doisirmaos.notifications.v1";
const TOP_ALERT_SESSION_KEY = "doisirmaos.top-alerts.v1";
const SIDEBAR_PREFERENCE_KEY = "doisirmaos.sidebar.v1";
const NOTIFICATION_GREETING_NAME = "Sérgio";
const DEV_HOST_REGEX = /^(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})$/;
const SIDEBAR_MOBILE_QUERY = window.matchMedia("(max-width: 960px)");

const pageTitles = {
  sales: "Vendas",
  quotes: "Orçamentos",
  missing_items: "Itens Faltantes",
  date_calculator: "Calcular Dias",
  expenses: "Contas Pagas",
  bills: "Boletos",
  checks: "Cheques",
};

const pageSubtitles = {
  sales: "MATERIAL DE CONSTRUÇÃO DOIS IRMÃOS ONDE HABITA BENÇÃOS",
  quotes: "Crie, gerencie e gere orçamentos para seus clientes.",
  missing_items: "Cadastre e acompanhe itens que precisam ser repostos.",
  date_calculator: "Calcule prazos e intervalos de forma rápida.",
  expenses: "Gerencie contas pagas e saídas financeiras.",
  bills: "Acompanhe boletos, vencimentos e pagamentos.",
  checks: "Gerencie e acompanhe todos os cheques cadastrados.",
};

const PROFILE_MENU_PAGE_KEY_MAP = {
  sales: "dashboard",
  quotes: "quotes",
  date_calculator: "date-calculator",
  expenses: "shortcut-expenses",
  bills: "shortcut-bills",
  checks: "shortcut-checks",
};

const PROFILE_MENU_SECTIONS = [
  {
    title: "Navegação",
    items: [
      { key: "dashboard", label: "Dashboard", icon: "layout-dashboard", action: { type: "page", page: "sales" } },
      { key: "quotes", label: "Orçamentos", icon: "file-text", action: { type: "page", page: "quotes" } },
      { key: "date-calculator", label: "Calcular Dias", icon: "calendar-days", action: { type: "page", page: "date_calculator" } },
      { key: "favorites", label: "Favoritos", icon: "star", action: { type: "toast", message: "Seus favoritos aparecerão aqui em breve." } },
      { key: "recent", label: "Recentes", icon: "clock-3", action: { type: "toast", message: "Seu histórico recente aparecerá aqui em breve." } },
      {
        key: "shortcuts",
        label: "Atalhos",
        icon: "sparkles",
        children: [
          { key: "shortcut-expenses", label: "Contas Pagas", icon: "credit-card", action: { type: "page", page: "expenses" } },
          { key: "shortcut-bills", label: "Boletos", icon: "barcode", action: { type: "page", page: "bills" } },
          { key: "shortcut-checks", label: "Cheques", icon: "credit-card", action: { type: "page", page: "checks" } },
        ],
      },
    ],
  },
  {
    title: "Configurações",
    items: [
      { key: "users", label: "Usuários", icon: "users", action: { type: "toast", message: "A área de usuários será conectada a este menu em breve." } },
      { key: "companies", label: "Empresas", icon: "building-2", action: { type: "toast", message: "A área de empresas será conectada a este menu em breve." } },
      { key: "settings", label: "Configurações", icon: "settings-2", action: { type: "toast", message: "As configurações gerais do sistema ficarão centralizadas aqui em breve." } },
      { key: "integrations", label: "Integrações", icon: "plug-zap", action: { type: "toast", message: "As integrações do sistema aparecerão neste menu em breve." } },
    ],
  },
  {
    title: "Suporte",
    items: [
      { key: "help-center", label: "Central de ajuda", icon: "life-buoy", action: { type: "toast", message: "A central de ajuda será integrada aqui em breve. Enquanto isso, use o card de suporte na lateral." } },
      { key: "contact-us", label: "Fale conosco", icon: "messages-square", action: { type: "toast", message: "O canal de contato direto será habilitado neste menu em breve." } },
    ],
  },
];

const PROFILE_ICON_MAP = {
  "layout-dashboard": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5"></rect>
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5"></rect>
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5"></rect>
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5"></rect>
    </svg>
  `,
  star: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 3.8 2.5 5.06 5.58.81-4.04 3.94.95 5.56L12 16.5 7.01 19.17l.95-5.56-4.04-3.94 5.58-.81z"></path>
    </svg>
  `,
  "clock-3": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5"></circle>
      <path d="M12 7.5v5l3.5 2"></path>
    </svg>
  `,
  "calendar-days": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3.8v3"></path>
      <path d="M17 3.8v3"></path>
      <rect x="4.5" y="5.8" width="15" height="13.7" rx="2"></rect>
      <path d="M4.5 9.5h15"></path>
      <path d="M8 13h2"></path>
      <path d="M12 13h2"></path>
      <path d="M16 13h.01"></path>
      <path d="M8 16.5h2"></path>
      <path d="M12 16.5h2"></path>
    </svg>
  `,
  sparkles: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2z"></path>
      <path d="m18 13 .7 2.3L21 16l-2.3.7L18 19l-.7-2.3L15 16l2.3-.7z"></path>
      <path d="m6 14 .7 2.1L9 16.8 6.7 17.5 6 19.6l-.7-2.1L3 16.8l2.3-.7z"></path>
    </svg>
  `,
  box: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.8 19.2 7.5v9L12 20.2 4.8 16.5v-9z"></path>
      <path d="M4.8 7.5 12 11.2l7.2-3.7"></path>
      <path d="M12 11.2v9"></path>
    </svg>
  `,
  "file-text": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3.5h7l4.5 4.5V19A1.5 1.5 0 0 1 17 20.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z"></path>
      <path d="M14 3.5V8h4.5"></path>
      <path d="M9 12h6"></path>
      <path d="M9 16h6"></path>
    </svg>
  `,
  "bar-chart-3": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 20v-8"></path>
      <path d="M10 20V8"></path>
      <path d="M15 20V4"></path>
      <path d="M20 20v-6"></path>
    </svg>
  `,
  users: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3z"></path>
      <path d="M15.5 12.5a2.5 2.5 0 1 0-2.5-2.5 2.5 2.5 0 0 0 2.5 2.5z"></path>
      <path d="M3.8 19a5.2 5.2 0 0 1 10.4 0"></path>
      <path d="M13 18.8a4.2 4.2 0 0 1 7.2-2.8"></path>
    </svg>
  `,
  "building-2": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 20.5h15"></path>
      <path d="M6.5 20.5V6.5l5.5-2v16"></path>
      <path d="M12 8.5h5.5v12"></path>
      <path d="M8.5 9.5h1"></path>
      <path d="M8.5 12.5h1"></path>
      <path d="M14.5 11.5h1"></path>
      <path d="M14.5 14.5h1"></path>
    </svg>
  `,
  "settings-2": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 8.5A3.5 3.5 0 1 0 15.5 12 3.5 3.5 0 0 0 12 8.5z"></path>
      <path d="m19.4 12 .94-1.63-1.72-2.98-1.87.37a6.96 6.96 0 0 0-1.4-.8L14.7 5h-3.4l-.69 1.96a6.96 6.96 0 0 0-1.4.8l-1.87-.37-1.72 2.98L4.6 12l.94 1.63-1.72 2.98 1.87.37c.41.32.88.59 1.4.8L11.3 20h3.4l.69-1.96c.52-.21.99-.48 1.4-.8l1.87.37 1.72-2.98z"></path>
    </svg>
  `,
  "plug-zap": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 7V4.5"></path>
      <path d="M15 7V4.5"></path>
      <path d="M7 9h10v2a5 5 0 0 1-5 5 5 5 0 0 1-5-5z"></path>
      <path d="M12 16v3.5"></path>
      <path d="m16 13 2-2.2h-1.8L18 8"></path>
    </svg>
  `,
  "life-buoy": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5"></circle>
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M7.8 7.8 9.9 9.9"></path>
      <path d="M14.1 14.1 16.2 16.2"></path>
      <path d="M16.2 7.8 14.1 9.9"></path>
      <path d="M9.9 14.1 7.8 16.2"></path>
    </svg>
  `,
  "messages-square": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5.5 6.5A2 2 0 0 1 7.5 4.5h9a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H12l-3.5 3v-3H7.5a2 2 0 0 1-2-2z"></path>
      <path d="M8.5 9.5h7"></path>
      <path d="M8.5 12.5h4.5"></path>
    </svg>
  `,
  "log-out": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 6.5H7.5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2H10"></path>
      <path d="M13 16.5 18 12l-5-4.5"></path>
      <path d="M18 12H9"></path>
    </svg>
  `,
  "chevron-right": `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m10 8 4 4-4 4"></path>
    </svg>
  `,
};

const BRAND_LOGO_PATH = "/assets/brand/logo_dois_irmaos_final.png";
const PRODUCTS_PER_PAGE = 10;
const SALES_HISTORY_PER_PAGE = 5;
const BILLS_CARDS_PER_PAGE = 9;
const MISSING_ITEMS_PER_PAGE = 5;
const SEARCH_INPUT_DEBOUNCE_MS = 250;
const PRODUCT_ORIGIN_OPTIONS = [
  { value: "0", label: "0 - Nacional" },
  { value: "1", label: "1 - Estrangeira (importação direta)" },
  { value: "2", label: "2 - Estrangeira (mercado interno)" },
  { value: "3", label: "3 - Nacional com conteúdo importado > 40%" },
  { value: "4", label: "4 - Nacional em conformidade com PPB" },
  { value: "5", label: "5 - Nacional com conteúdo importado <= 40%" },
  { value: "6", label: "6 - Estrangeira sem similar nacional (importação direta)" },
  { value: "7", label: "7 - Estrangeira sem similar nacional (mercado interno)" },
  { value: "8", label: "8 - Nacional com conteúdo importado > 70%" },
];
const PRODUCT_CSOSN_OPTIONS = ["101", "102", "103", "201", "202", "203", "300", "400", "500", "900"];
const CUSTOMER_PERSON_TYPE_OPTIONS = [
  { value: "PF", label: "Pessoa F\u00edsica" },
  { value: "PJ", label: "Pessoa Jur\u00eddica" },
];
const CUSTOMER_IE_INDICATOR_OPTIONS = [
  { value: "Nao contribuinte", label: "N\u00e3o contribuinte" },
  { value: "Isento", label: "Isento" },
  { value: "Contribuinte", label: "Contribuinte" },
];

const monthStart = (() => {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const year = String(firstDay.getFullYear());
  const month = String(firstDay.getMonth() + 1).padStart(2, "0");
  const day = String(firstDay.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
})();

const SALES_MONTH_OPTIONS = [
  { value: "1", label: "Janeiro" },
  { value: "2", label: "Fevereiro" },
  { value: "3", label: "Março" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Maio" },
  { value: "6", label: "Junho" },
  { value: "7", label: "Julho" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

function createInitialDateCalculatorState() {
  const today = todayIso();
  return {
    differenceStartDate: today,
    differenceEndDate: today,
    differenceDays: null,
    differenceMessage: "",
    differenceTone: "success",
    futureBaseDate: today,
    futureDaysAhead: "",
    futureResultDate: "",
    futureWeekday: "",
    futureMessage: "",
    futureTone: "success",
  };
}

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
  profileMenu: {
    open: false,
    activeKey: "dashboard",
    shortcutsOpen: false,
  },
  dateCalculator: createInitialDateCalculatorState(),
  nfe: {
    selectedSaleId: "",
    validation: null,
    fiscalEditorOpen: false,
  },
  topAlert: null,
  data: {
    products: [],
    customers: [],
    sales: [],
    missing_items: [],
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
    missing_items: null,
    quotes: null,
    expenses: null,
    bills: null,
    checks: null,
  },
  customersUi: {
    activeTab: "main",
    previewId: null,
  },
  formFeedback: {
    products: null,
    stock: null,
    customers: null,
    sales: null,
    missing_items: null,
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
    products: {
      search: "",
      category: "",
      active_filter: "active",
      stock_filter: "",
      price_min: "",
      price_max: "",
      quick_filter: "",
      show_advanced: false,
      page: 1,
      per_page: PRODUCTS_PER_PAGE,
    },
    stock: { search: "", stock_filter: "" },
    customers: { search: "" },
    sales: {
      preset: "today",
      day: todayIso(),
      start: monthStart,
      end: todayIso(),
      specific_month: "",
      search: "",
      payment_method: "",
      page: 1,
      show_advanced: false,
    },
    missing_items: { search: "", page: 1 },
    quotes: { search: "", status: "" },
    nfe: { search: "", sale_id: "" },
    expenses: { preset: "month", day: todayIso(), start: monthStart, end: todayIso(), search: "" },
    bills: { preset: "month", day: todayIso(), start: monthStart, end: todayIso(), search: "", status: "", page: 1 },
    checks: {
      preset: "all",
      day: todayIso(),
      start: monthStart,
      end: todayIso(),
      specific_month: String(new Date().getMonth() + 1),
      specific_year: String(new Date().getFullYear()),
      search: "",
      status: "",
      quick_filter: "all",
      page: 1,
    },
    reports: { module: "sales", preset: "month", day: todayIso(), start: monthStart, end: todayIso() },
  },
};

const searchTimers = new Map();
const filteredSalesCache = {
  source: null,
  key: "",
  result: null,
};
const formScopeMap = {
  "products-form": "products",
  "stock-form": "stock",
  "customers-form": "customers",
  "sales-form": "sales",
  "missing-items-form": "missing_items",
  "quotes-form": "quotes",
  "expenses-form": "expenses",
  "bills-form": "bills",
  "checks-form": "checks",
  "fiscal-settings-form": "fiscal",
};

const elements = {
  appShell: document.getElementById("app-shell"),
  pageContent: document.getElementById("page-content"),
  topAlertContainer: document.getElementById("top-alert-container"),
  pageTitle: document.getElementById("page-title"),
  currentUserName: document.getElementById("current-user-name"),
  currentUserEnvironment: document.getElementById("current-user-environment"),
  currentUserAvatar: document.getElementById("current-user-avatar"),
  installAppButton: document.getElementById("install-app-button"),
  notificationCenter: document.getElementById("notification-center"),
  notificationsButton: document.getElementById("notifications-button"),
  notificationsBadge: document.getElementById("notifications-badge"),
  notificationsPanel: document.getElementById("notifications-panel"),
  notificationsList: document.getElementById("notifications-list"),
  notificationsClearButton: document.getElementById("notifications-clear"),
  notificationsSubtitle: document.getElementById("notifications-subtitle"),
  profileMenu: document.getElementById("profile-menu"),
  profileMenuButton: document.getElementById("profile-menu-button"),
  profileMenuPanel: document.getElementById("profile-menu-panel"),
  profileMenuAvatar: document.getElementById("profile-menu-avatar"),
  profileMenuUserName: document.getElementById("profile-menu-user-name"),
  profileMenuUserEnvironment: document.getElementById("profile-menu-user-environment"),
  profileMenuSections: document.getElementById("profile-menu-sections"),
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
  showApp();

  try {
    await loadData();
  } catch (error) {
    showToast(error.message || "Não foi possível carregar o sistema.", "error");
  }
}


function bindGlobalEvents() {
  elements.installAppButton?.addEventListener("click", handleInstallApp);
  elements.notificationsButton?.addEventListener("click", handleNotificationsToggle);
  elements.notificationsClearButton?.addEventListener("click", handleClearNotifications);
  elements.notificationsList?.addEventListener("click", handleNotificationListClick);
  elements.profileMenuButton?.addEventListener("click", handleProfileMenuToggle);
  elements.profileMenuPanel?.addEventListener("click", handleProfileMenuPanelClick);
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
  elements.pageContent.addEventListener("dragover", handlePageDragOver);
  elements.pageContent.addEventListener("dragleave", handlePageDragLeave);
  elements.pageContent.addEventListener("drop", handlePageDrop);
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


function showApp() {
  elements.appShell?.classList.remove("hidden");
  renderProfileMenu();
  applySidebarLayout();
  renderNotifications();
  renderTopAlert();
  updateInstallButtonVisibility();
}


function getEnvironmentLabel() {
  return DEV_HOST_REGEX.test(window.location.hostname) ? "Ambiente local" : "Ambiente online";
}


function getUserInitials(name) {
  const parts = String(name || "Administrador")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("");
  return initials || "AD";
}


function syncProfileMenuActive(page = state.page) {
  const mappedKey = PROFILE_MENU_PAGE_KEY_MAP[page];
  if (!mappedKey) return;

  state.profileMenu.activeKey = mappedKey;
  state.profileMenu.shortcutsOpen = mappedKey.startsWith("shortcut-");
}


function renderProfileMenu() {
  const userName = state.user?.full_name || "Administrador";
  const environmentLabel = getEnvironmentLabel();
  const initials = getUserInitials(userName);

  if (elements.currentUserName) {
    elements.currentUserName.textContent = userName;
  }
  if (elements.currentUserEnvironment) {
    elements.currentUserEnvironment.textContent = environmentLabel;
  }
  if (elements.currentUserAvatar) {
    elements.currentUserAvatar.textContent = initials;
  }
  if (elements.profileMenuUserName) {
    elements.profileMenuUserName.textContent = userName;
  }
  if (elements.profileMenuUserEnvironment) {
    elements.profileMenuUserEnvironment.textContent = environmentLabel;
  }
  if (elements.profileMenuAvatar) {
    elements.profileMenuAvatar.textContent = initials;
  }
  if (elements.profileMenu) {
    elements.profileMenu.classList.toggle("open", state.profileMenu.open);
  }
  if (elements.profileMenuButton) {
    elements.profileMenuButton.setAttribute("aria-expanded", state.profileMenu.open ? "true" : "false");
  }
  if (elements.profileMenuSections) {
    elements.profileMenuSections.innerHTML = renderProfileMenuSections();
  }
}


function renderProfileMenuSections() {
  return PROFILE_MENU_SECTIONS.map((section) => `
    <section class="profile-menu-section">
      <span class="profile-menu-section-title">${escapeHtml(section.title)}</span>
      <div class="profile-menu-list">
        ${section.items.map((item) => renderProfileMenuItem(item)).join("")}
      </div>
    </section>
  `).join("");
}


function renderProfileMenuItem(item) {
  const hasChildren = Array.isArray(item.children) && item.children.length > 0;
  const childIsActive = hasChildren && item.children.some((child) => child.key === state.profileMenu.activeKey);
  const isActive = state.profileMenu.activeKey === item.key || childIsActive;

  if (!hasChildren) {
    return renderProfileMenuActionButton(item, { active: isActive });
  }

  const isOpen = state.profileMenu.shortcutsOpen || childIsActive;
  return `
    <div class="profile-submenu ${isOpen ? "open" : ""}">
      <button
        type="button"
        class="profile-menu-item ${isActive ? "is-active" : ""}"
        data-profile-submenu-toggle="${escapeHtml(item.key)}"
      >
        <span class="profile-menu-item-copy">
          <span class="profile-menu-item-icon">${renderProfileMenuIcon(item.icon)}</span>
          <span class="profile-menu-item-label">${escapeHtml(item.label)}</span>
        </span>
        <span class="profile-menu-item-arrow">${renderProfileMenuIcon("chevron-right")}</span>
      </button>
      <div class="profile-submenu-panel">
        ${item.children.map((child) => renderProfileMenuActionButton(child, {
          active: child.key === state.profileMenu.activeKey,
          parentKey: item.key,
          submenu: true,
        })).join("")}
      </div>
    </div>
  `;
}


function renderProfileMenuActionButton(item, { active = false, danger = false, parentKey = "", submenu = false } = {}) {
  const classNames = [
    submenu ? "profile-submenu-item" : "profile-menu-item",
    active ? "is-active" : "",
    danger ? "profile-menu-item-danger" : "",
  ].filter(Boolean).join(" ");

  return `
    <button
      type="button"
      class="${classNames}"
      ${buildProfileMenuActionAttributes(item, parentKey)}
    >
      <span class="profile-menu-item-copy">
        <span class="profile-menu-item-icon">${renderProfileMenuIcon(item.icon)}</span>
        <span class="profile-menu-item-label">${escapeHtml(item.label)}</span>
      </span>
      ${submenu ? `<span class="profile-menu-item-arrow">${renderProfileMenuIcon("chevron-right")}</span>` : ""}
    </button>
  `;
}


function buildProfileMenuActionAttributes(item, parentKey = "") {
  const attributes = [
    `data-profile-menu-key="${escapeHtml(item.key)}"`,
    `data-profile-menu-action="${escapeHtml(item.action?.type || "toast")}"`,
  ];

  if (item.action?.page) {
    attributes.push(`data-profile-menu-page="${escapeHtml(item.action.page)}"`);
  }
  if (item.action?.message) {
    attributes.push(`data-profile-menu-message="${escapeHtml(item.action.message)}"`);
  }
  if (parentKey) {
    attributes.push(`data-profile-menu-parent="${escapeHtml(parentKey)}"`);
  }

  return attributes.join(" ");
}


function renderProfileMenuIcon(icon) {
  return PROFILE_ICON_MAP[icon] || PROFILE_ICON_MAP["layout-dashboard"];
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


function getDefaultQuoteValidityDate(baseDate = localTodayIso()) {
  return addDaysToIsoDate(normalizeDateOnly(baseDate) || localTodayIso(), 7) || localTodayIso();
}


function shouldKeepQuoteValidityAutomatic(quoteDate, validityDate) {
  const normalizedQuoteDate = normalizeDateOnly(quoteDate) || localTodayIso();
  const normalizedValidityDate = normalizeDateOnly(validityDate);
  if (!normalizedValidityDate) {
    return true;
  }
  return normalizedValidityDate === getDefaultQuoteValidityDate(normalizedQuoteDate);
}


function syncQuoteValidityField(form, { force = false } = {}) {
  if (!form) return;

  const quoteDateField = form.querySelector('[name="quote_date"]');
  const validityField = form.querySelector('[name="validity_date"]');
  if (!(quoteDateField instanceof HTMLInputElement) || !(validityField instanceof HTMLInputElement)) {
    return;
  }

  const quoteDate = normalizeDateOnly(quoteDateField.value) || localTodayIso();
  const nextValidityDate = getDefaultQuoteValidityDate(quoteDate);
  const automatic = validityField.dataset.autoManaged !== "false";

  if (force || automatic || !normalizeDateOnly(validityField.value)) {
    validityField.value = nextValidityDate;
  }

  validityField.dataset.autoManaged = String(
    shouldKeepQuoteValidityAutomatic(quoteDateField.value, validityField.value),
  );
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


function isFinalizedCheckStatus(status) {
  return ["Compensado", "Cancelado", "Pago", "Baixado", "Finalizado"].includes(status || "");
}


function getCheckAlertTotals(alert = state.topAlert) {
  const today = alert?.date || localTodayIso();
  const checks = Array.isArray(state.data.checks) ? state.data.checks : [];
  const dueTodayChecks = checks.filter((check) => {
    const status = check.effective_status || check.status || "";
    return check.due_date === today && !isFinalizedCheckStatus(status);
  });
  const overdueChecks = checks.filter((check) => {
    const status = check.effective_status || check.status || "";
    if (isFinalizedCheckStatus(status) || check.due_date === today) {
      return false;
    }
    return status === "Atrasado" || Boolean(check.due_date && check.due_date < today);
  });

  const fallbackDueTodayTotal = sumBy(dueTodayChecks, (check) => check.amount);
  const fallbackOverdueTotal = sumBy(overdueChecks, (check) => check.amount);
  const dueTodayTotal = Math.max(Number(alert?.total_amount || 0), fallbackDueTodayTotal);
  const overdueTotal = Math.max(Number(alert?.overdue_total_amount || 0), fallbackOverdueTotal);
  const dueTodayCount = Math.max(Number(alert?.count || 0), dueTodayChecks.length);
  const overdueCount = Math.max(Number(alert?.overdue_count || 0), overdueChecks.length);

  return {
    id: alert?.id || `daily-check-alert-${today}-${dueTodayCount}-${overdueCount}-${dueTodayTotal}-${overdueTotal}`,
    date: today,
    count: dueTodayCount,
    total_amount: dueTodayTotal,
    overdue_count: overdueCount,
    overdue_total_amount: overdueTotal,
    has_alert: Boolean(alert?.has_alert) || dueTodayTotal > 0 || overdueTotal > 0,
  };
}


function buildTopAlert() {
  const alert = state.topAlert;
  const totals = getCheckAlertTotals(alert);
  if (!totals.has_alert || (totals.total_amount <= 0 && totals.overdue_total_amount <= 0)) {
    return null;
  }

  const dismissedIds = new Set(readTopAlertSessionState().dismissedIds);
  if (dismissedIds.has(totals.id)) {
    return null;
  }

  return {
    ...alert,
    ...totals,
    message: `⚠️ Olá irmão ${NOTIFICATION_GREETING_NAME}, hoje temos ${formatMoney(totals.total_amount)} de cheques para cair hoje, e ${formatMoney(totals.overdue_total_amount)} que já deveriam ter caído!`,
  };
}


function renderTopAlert() {
  if (!elements.topAlertContainer) return;

  const alert = buildTopAlert();
  elements.topAlertContainer.innerHTML = alert ? `
    <section class="top-check-alert" data-alert-id="${escapeHtml(alert.id)}" role="status" aria-live="polite">
      <div class="top-check-alert-copy">
        <strong>${escapeHtml(alert.message)}</strong>
        <small>${escapeHtml(`${alert.count || 0} cheque(s) previstos para ${formatDate(alert.date)}. ${alert.overdue_count || 0} cheque(s) atrasado(s).`)}</small>
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

  const checkAlert = state.topAlert;
  const checkTotals = getCheckAlertTotals(checkAlert);
  const todayCheckNotificationId = checkTotals.id || `checks-due-today-${today}`;

  if (checkTotals.has_alert && (checkTotals.total_amount > 0 || checkTotals.overdue_total_amount > 0) && !dismissedIds.has(todayCheckNotificationId)) {
    notifications.push({
      id: todayCheckNotificationId,
      tone: "warning",
      title: "Cheques para acompanhar",
      message: `Olá irmão ${NOTIFICATION_GREETING_NAME}, hoje temos ${formatMoney(checkTotals.total_amount)} de cheques para cair hoje, e ${formatMoney(checkTotals.overdue_total_amount)} que já deveriam ter caído!`,
      meta: `${checkTotals.count} cheque(s) para ${formatDate(checkTotals.date || today)}. ${checkTotals.overdue_count} cheque(s) atrasado(s).`,
    });
  }

  const billAlert = state.data.daily_bill_alert;
  const todayBillNotificationId = billAlert?.id || `bills-due-today-${today}`;
  const dueTodayBillsCount = Number(billAlert?.count || 0);
  const overdueBillsCount = Number(billAlert?.overdue_count || 0);
  const dueTodayBillsTotal = Number(billAlert?.total_amount || 0);
  const overdueBillsTotal = Number(billAlert?.overdue_total_amount || 0);

  if (billAlert?.has_alert && (dueTodayBillsTotal > 0 || overdueBillsTotal > 0) && !dismissedIds.has(todayBillNotificationId)) {
    notifications.push({
      id: todayBillNotificationId,
      tone: "warning",
      title: "Boletos para acompanhar",
      message: `Olá irmão ${NOTIFICATION_GREETING_NAME}, hoje temos ${formatMoney(dueTodayBillsTotal)} de boletos para pagar, e ${formatMoney(overdueBillsTotal)} de boletos que já venceram!`,
      meta: `${dueTodayBillsCount} boleto(s) para ${formatDate(billAlert.date || today)}. ${overdueBillsCount} boleto(s) vencido(s).`,
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
  const shouldOpen = !state.notifications.open;
  state.notifications.open = shouldOpen;
  if (shouldOpen) {
    state.profileMenu.open = false;
  }
  renderNotifications();
  renderProfileMenu();
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


function handleProfileMenuToggle(event) {
  event.preventDefault();
  const shouldOpen = !state.profileMenu.open;
  state.profileMenu.open = shouldOpen;
  if (shouldOpen) {
    state.notifications.open = false;
  }
  renderNotifications();
  renderProfileMenu();
}


async function handleProfileMenuPanelClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const submenuToggle = target.closest("[data-profile-submenu-toggle]");
  if (submenuToggle) {
    const submenuKey = submenuToggle.getAttribute("data-profile-submenu-toggle");
    if (submenuKey === "shortcuts") {
      state.profileMenu.shortcutsOpen = !state.profileMenu.shortcutsOpen;
      if (state.profileMenu.shortcutsOpen) {
        state.profileMenu.activeKey = submenuKey;
      }
      renderProfileMenu();
    }
    return;
  }

  const actionButton = target.closest("[data-profile-menu-action]");
  if (!(actionButton instanceof HTMLElement)) return;

  const actionType = actionButton.dataset.profileMenuAction || "toast";
  const actionKey = actionButton.dataset.profileMenuKey || state.profileMenu.activeKey;
  const actionPage = actionButton.dataset.profileMenuPage || "";
  const actionMessage = actionButton.dataset.profileMenuMessage || "";
  const actionParent = actionButton.dataset.profileMenuParent || "";

  state.profileMenu.open = false;
  state.profileMenu.activeKey = actionKey;
  if (actionParent === "shortcuts") {
    state.profileMenu.shortcutsOpen = true;
  } else {
    state.profileMenu.shortcutsOpen = false;
  }
  renderProfileMenu();

  if (actionType === "page" && actionPage) {
    setPage(actionPage);
    return;
  }

  if (actionMessage) {
    showToast(actionMessage, "info");
  }
}


function handleDocumentClick(event) {
  const target = event.target;
  if (!(target instanceof Node)) return;

  let shouldRenderNotifications = false;
  let shouldRenderProfileMenu = false;

  if (state.notifications.open && !elements.notificationCenter?.contains(target)) {
    state.notifications.open = false;
    shouldRenderNotifications = true;
  }

  if (state.profileMenu.open && !elements.profileMenu?.contains(target)) {
    state.profileMenu.open = false;
    shouldRenderProfileMenu = true;
  }

  if (shouldRenderNotifications) {
    renderNotifications();
  }
  if (shouldRenderProfileMenu) {
    renderProfileMenu();
  }
}


function handleGlobalKeyDown(event) {
  if (event.key !== "Escape") return;

  if (state.notifications.open) {
    state.notifications.open = false;
    renderNotifications();
  }

  if (state.profileMenu.open) {
    state.profileMenu.open = false;
    renderProfileMenu();
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


function clearSearchTimers() {
  searchTimers.forEach((timerId) => clearTimeout(timerId));
  searchTimers.clear();
}


async function loadData() {
  const payload = await api.bootstrap();
  state.user = payload.user;
  state.topAlert = payload.daily_check_alert || null;
  state.data = {
    products: payload.products || [],
    customers: payload.customers || [],
    sales: payload.sales || [],
    missing_items: payload.missing_items || [],
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
  renderProfileMenu();
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
    sales: renderSalesPage,
    quotes: renderQuotesPage,
    missing_items: renderMissingItemsPage,
    date_calculator: renderDateCalculatorPage,
    expenses: renderExpensesPage,
    bills: renderBillsPage,
    checks: renderChecksPage,
  };

  const activePage = renderMap[state.page] ? state.page : "sales";
  if (activePage !== state.page) {
    state.page = activePage;
  }

  syncProfileMenuActive(activePage);
  renderProfileMenu();
  elements.pageTitle.textContent = pageTitles[activePage] || "Sistema";
  const pageSubtitleElement = document.querySelector(".topbar-left .eyebrow");
  if (pageSubtitleElement) {
    pageSubtitleElement.textContent = pageSubtitles[activePage] || BRAND_NAME;
  }
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
  const customersForm = document.getElementById("customers-form");
  if (customersForm) syncCustomerFormVisibility(customersForm);
  const quotesForm = document.getElementById("quotes-form");
  if (quotesForm) {
    syncQuoteValidityField(quotesForm);
    updateQuoteTotals(quotesForm);
  }
  const salesForm = document.getElementById("sales-form");
  if (salesForm) updateSaleTotals(salesForm);
  const productsForm = document.getElementById("products-form");
  if (productsForm) initializeProductsForm(productsForm);
  updateProductsImportSelection();
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
    missing_items: {
      default: renderMissingItemsListResults,
    },
    sales: {
      metrics: renderSalesMetricsSection,
      history: renderSalesHistoryPanel,
      insights: renderSalesInsightsSection,
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
      metrics: renderChecksStudioMetrics,
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


function showConfirmDialog({
  title = "Confirmar ação",
  message = "",
  detail = "",
  confirmLabel = "Sim",
  cancelLabel = "Cancelar",
  tone = "primary",
} = {}) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "confirm-dialog-backdrop";
    backdrop.innerHTML = `
      <div class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <h3 id="confirm-dialog-title">${escapeHtml(title)}</h3>
        <p>${escapeHtml(message)}</p>
        ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
        <div class="confirm-dialog-actions">
          <button type="button" class="btn btn-secondary" data-confirm-action="cancel">${escapeHtml(cancelLabel)}</button>
          <button type="button" class="btn ${tone === "danger" ? "btn-danger" : "btn-primary"}" data-confirm-action="confirm">${escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    `;

    const close = (confirmed) => {
      backdrop.remove();
      document.removeEventListener("keydown", handleKeyDown);
      resolve(confirmed);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        close(false);
      }
    };

    backdrop.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const actionButton = target.closest("[data-confirm-action]");
      if (actionButton) {
        close(actionButton.dataset.confirmAction === "confirm");
        return;
      }
      if (target === backdrop) {
        close(false);
      }
    });

    document.addEventListener("keydown", handleKeyDown);
    document.body.appendChild(backdrop);
    backdrop.querySelector('[data-confirm-action="confirm"]')?.focus();
  });
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


function normalizeCheckNumberValue(value) {
  const cleaned = String(value || "").trim();
  const normalized = cleaned
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

  if (["sn", "semnumero"].includes(normalized)) {
    return "S/N";
  }

  return cleaned;
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


function customerPersonTypeOptions() {
  const configured = state.data.options.customer_person_types || [];
  if (!configured.length) return CUSTOMER_PERSON_TYPE_OPTIONS;
  return configured.map((value) => ({
    value,
    label: value === "PJ" ? "Pessoa Jur\u00eddica" : "Pessoa F\u00edsica",
  }));
}


function customerIeIndicatorOptions() {
  const configured = state.data.options.customer_ie_indicators || [];
  if (!configured.length) return CUSTOMER_IE_INDICATOR_OPTIONS;
  return configured.map((value) => ({
    value,
    label: value === "Nao contribuinte" ? "N\u00e3o contribuinte" : value,
  }));
}


function normalizeCustomerPersonType(value) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

  if (["pj", "pessoajuridica", "juridica"].includes(normalized)) return "PJ";
  return "PF";
}


function normalizeCustomerIeIndicator(value) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

  if (normalized === "contribuinte") return "Contribuinte";
  if (normalized === "isento") return "Isento";
  return "Nao contribuinte";
}


function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}


function formatCustomerDocument(value) {
  const digits = digitsOnly(value);
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 14) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }
  return String(value || "");
}


function formatZipCode(value) {
  const digits = digitsOnly(value);
  if (digits.length === 8) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return String(value || "");
}


function buildCustomerDisplayAddress(customer) {
  const parts = [];
  const addressLine = [customer.street, customer.number].filter(Boolean).join(", ");
  const withComplement = [addressLine, customer.complement].filter(Boolean).join(", ");
  const cityState = [customer.city, customer.state].filter(Boolean).join("/");

  if (withComplement) parts.push(withComplement);
  if (customer.district) parts.push(customer.district);
  if (cityState) parts.push(cityState);
  if (customer.zip_code) parts.push(`CEP ${formatZipCode(customer.zip_code)}`);
  return parts.join(", ") || customer.address || "-";
}


function defaultCustomerDraft(editing = null) {
  const fallbackType = editing?.person_type || (editing?.cnpj ? "PJ" : "PF");
  const personType = normalizeCustomerPersonType(fallbackType);
  const ieIndicator = normalizeCustomerIeIndicator(editing?.ie_indicator || "Nao contribuinte");
  return {
    id: editing?.id || "",
    person_type: personType,
    name: editing?.name || "",
    trade_name: editing?.trade_name || "",
    cpf: editing?.cpf || "",
    cnpj: editing?.cnpj || "",
    phone: editing?.phone || "",
    whatsapp: editing?.whatsapp || "",
    email: editing?.email || "",
    zip_code: editing?.zip_code || "",
    street: editing?.street || "",
    number: editing?.number || "",
    complement: editing?.complement || "",
    district: editing?.district || "",
    city: editing?.city || "",
    state: editing?.state || "",
    city_ibge_code: editing?.city_ibge_code || "",
    ie_indicator: ieIndicator,
    state_registration: editing?.state_registration || "",
    rg: editing?.rg || "",
    birth_date: editing?.birth_date || "",
    notes: editing?.notes || "",
  };
}


function validateCpf(value) {
  const digits = digitsOnly(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  for (let index = 9; index < 11; index += 1) {
    let total = 0;
    for (let position = 0; position < index; position += 1) {
      total += Number(digits[position]) * ((index + 1) - position);
    }
    let checkDigit = (total * 10) % 11;
    if (checkDigit === 10) checkDigit = 0;
    if (checkDigit !== Number(digits[index])) return false;
  }
  return true;
}


function validateCnpj(value) {
  const digits = digitsOnly(value);
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;

  const weights = [
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  ];

  return weights.every((sequence, index) => {
    const size = 12 + index;
    const total = sequence.reduce((sum, weight, position) => sum + (Number(digits[position]) * weight), 0);
    const remainder = total % 11;
    const expected = remainder < 2 ? 0 : 11 - remainder;
    return expected === Number(digits[size]);
  });
}


function normalizeCustomerPayload(payload) {
  const personType = normalizeCustomerPersonType(payload.person_type);
  const ieIndicator = normalizeCustomerIeIndicator(payload.ie_indicator);
  const normalized = {
    ...payload,
    person_type: personType,
    ie_indicator: ieIndicator,
    cpf: digitsOnly(payload.cpf),
    cnpj: digitsOnly(payload.cnpj),
    zip_code: digitsOnly(payload.zip_code),
    state: String(payload.state || "").trim().toUpperCase(),
    city_ibge_code: digitsOnly(payload.city_ibge_code),
    rg: String(payload.rg || "").trim(),
    birth_date: String(payload.birth_date || "").trim(),
  };

  if (personType === "PF") {
    normalized.cnpj = "";
    normalized.trade_name = "";
  } else {
    normalized.cpf = "";
    normalized.rg = "";
    normalized.birth_date = "";
  }

  if (ieIndicator !== "Contribuinte") {
    normalized.state_registration = "";
  }

  return normalized;
}


function syncCustomerFormVisibility(form) {
  if (!(form instanceof HTMLFormElement)) return;

  const typeField = form.querySelector('[name="person_type"]');
  const ieField = form.querySelector('[name="ie_indicator"]');
  const nameLabel = form.querySelector('[data-customer-name-label]');
  const documentLabel = form.querySelector('[data-customer-document-label]');
  const tradeNameField = form.querySelector('[data-customer-trade-name]');
  const cpfField = form.querySelector('[data-customer-cpf-field]');
  const cnpjField = form.querySelector('[data-customer-cnpj-field]');
  const stateRegistrationField = form.querySelector('[data-customer-ie-field]');
  const rgField = form.querySelector('[data-customer-rg-field]');
  const birthDateField = form.querySelector('[data-customer-birth-date-field]');

  const personType = normalizeCustomerPersonType(typeField?.value);
  const ieIndicator = normalizeCustomerIeIndicator(ieField?.value);
  const requiresIe = ieIndicator === "Contribuinte";

  if (nameLabel) {
    nameLabel.textContent = personType === "PJ" ? "Raz\u00e3o social" : "Nome completo";
  }
  if (documentLabel) {
    documentLabel.textContent = personType === "PJ" ? "CNPJ" : "CPF";
  }
  if (tradeNameField) {
    tradeNameField.classList.toggle("hidden", personType !== "PJ");
  }
  if (cpfField) {
    cpfField.classList.toggle("hidden", personType !== "PF");
    const input = cpfField.querySelector("input");
    if (input) input.required = personType === "PF";
  }
  if (cnpjField) {
    cnpjField.classList.toggle("hidden", personType !== "PJ");
    const input = cnpjField.querySelector("input");
    if (input) input.required = personType === "PJ";
  }
  if (stateRegistrationField) {
    stateRegistrationField.classList.toggle("hidden", !requiresIe);
    const input = stateRegistrationField.querySelector("input");
    if (input) {
      input.required = requiresIe;
    }
  }
  if (rgField) {
    rgField.classList.toggle("hidden", personType !== "PF");
  }
  if (birthDateField) {
    birthDateField.classList.toggle("hidden", personType !== "PF");
  }
}


async function hydrateCustomerAddressFromCep(form, cepValue) {
  if (!(form instanceof HTMLFormElement)) return;
  const cep = digitsOnly(cepValue);
  if (cep.length !== 8) return;

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!response.ok) return;
    const data = await response.json();
    if (data.erro) return;

    const streetField = form.querySelector('[name="street"]');
    const districtField = form.querySelector('[name="district"]');
    const cityField = form.querySelector('[name="city"]');
    const stateField = form.querySelector('[name="state"]');
    const complementField = form.querySelector('[name="complement"]');
    const cityIbgeField = form.querySelector('[name="city_ibge_code"]');
    const zipField = form.querySelector('[name="zip_code"]');

    if (streetField && !streetField.value.trim()) streetField.value = data.logradouro || "";
    if (districtField && !districtField.value.trim()) districtField.value = data.bairro || "";
    if (cityField && !cityField.value.trim()) cityField.value = data.localidade || "";
    if (stateField && !stateField.value.trim()) stateField.value = (data.uf || "").toUpperCase();
    if (complementField && !complementField.value.trim()) complementField.value = data.complemento || "";
    if (cityIbgeField && !cityIbgeField.value.trim()) cityIbgeField.value = data.ibge || "";
    if (zipField) zipField.value = formatZipCode(data.cep || cep);
  } catch {
    // Mantém o preenchimento manual se a consulta falhar.
  }
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

  if (scope === "customers") {
    const personType = normalizeCustomerPersonType(payload.person_type);
    const ieIndicator = normalizeCustomerIeIndicator(payload.ie_indicator);
    const documentDigits = personType === "PJ" ? digitsOnly(payload.cnpj) : digitsOnly(payload.cpf);

    if (!payload.name) {
      throw new Error(personType === "PJ" ? "Informe a razão social do cliente." : "Informe o nome completo do cliente.");
    }
    if (personType === "PF" && !validateCpf(documentDigits)) {
      throw new Error("Informe um CPF válido para o cliente.");
    }
    if (personType === "PJ" && !validateCnpj(documentDigits)) {
      throw new Error("Informe um CNPJ válido para o cliente.");
    }
    if (digitsOnly(payload.zip_code).length !== 8) {
      throw new Error("Informe um CEP válido com 8 dígitos.");
    }
    if (!payload.street || !payload.number || !payload.district || !payload.city) {
      throw new Error("Preencha logradouro, número, bairro e cidade do cliente.");
    }
    if (!/^[A-Za-z]{2}$/.test(String(payload.state || "").trim())) {
      throw new Error("Informe uma UF válida com 2 letras.");
    }
    if (digitsOnly(payload.city_ibge_code).length !== 7) {
      throw new Error("Informe o código IBGE do município com 7 dígitos.");
    }
    if (ieIndicator === "Contribuinte" && !String(payload.state_registration || "").trim()) {
      throw new Error("Informe a inscrição estadual do cliente contribuinte.");
    }
  }

  if (scope === "expenses") {
    if (!payload.payment_date || !payload.description || !payload.payment_method) {
      throw new Error("Preencha data, descrição e forma de pagamento.");
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

  if (scope === "missing_items") {
    if (!payload.name) {
      throw new Error("Informe o nome do item faltante.");
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
  if (scope === "checks") {
    const filter = state.filters.checks;
    const today = new Date();
    const currentYear = today.getFullYear();
    const toIso = (date) => {
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${date.getFullYear()}-${month}-${day}`;
    };

    if (filter.preset === "all") {
      return { start: "0000-01-01", end: "9999-12-31", label: "Todos" };
    }

    if (filter.preset === "specific_month") {
      const selectedMonth = Math.min(Math.max(Number(filter.specific_month || today.getMonth() + 1), 1), 12);
      const monthIndex = selectedMonth - 1;
      const start = new Date(currentYear, monthIndex, 1);
      const end = new Date(currentYear, monthIndex + 1, 0);
      const monthLabel = SALES_MONTH_OPTIONS.find((item) => item.value === String(selectedMonth))?.label || "Mês específico";
      return {
        start: toIso(start),
        end: toIso(end),
        label: `${monthLabel} de ${currentYear}`,
      };
    }

    if (filter.preset === "specific_year") {
      const selectedYear = Number(filter.specific_year || currentYear);
      const safeYear = Number.isInteger(selectedYear) && selectedYear > 1900 ? selectedYear : currentYear;
      return {
        start: `${safeYear}-01-01`,
        end: `${safeYear}-12-31`,
        label: `Ano ${safeYear}`,
      };
    }
  }

  if (scope === "sales" && state.filters.sales.preset === "specific_month" && state.filters.sales.specific_month) {
    const today = new Date();
    const selectedMonth = Number(state.filters.sales.specific_month);
    const year = today.getFullYear();
    const monthIndex = Math.min(Math.max(selectedMonth, 1), 12) - 1;
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0);
    const toIso = (date) => {
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${date.getFullYear()}-${month}-${day}`;
    };
    const monthLabel = SALES_MONTH_OPTIONS.find((item) => item.value === String(selectedMonth))?.label || "Mês específico";

    return {
      start: toIso(start),
      end: toIso(end),
      label: `${monthLabel} de ${year}`,
    };
  }

  if (scope === "sales" && state.filters.sales.preset === "specific_month") {
    return getPresetRange("month", state.filters.sales);
  }

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
  if (normalized.includes("pend")) return "neutral";
  if (normalized.includes("pago")) return "success";
  if (normalized.includes("entrada")) return "success";
  if (normalized.includes("saida")) return "warning";
  if (normalized.includes("ajuste")) return "brand";
  if (normalized.includes("compens")) return "success";
  if (normalized.includes("aprov")) return "success";
  if (normalized.includes("cancel")) return "danger";
  if (normalized.includes("nao aprov") || normalized.includes("não aprov")) return "danger";
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


function renderDateCalculatorIcon(name) {
  const icons = {
    difference: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4.5" y="5" width="15" height="14.5" rx="2"></rect>
        <path d="M8 3.8v2.8"></path>
        <path d="M16 3.8v2.8"></path>
        <path d="M4.5 9.2h15"></path>
        <path d="M8 13.2h8"></path>
        <path d="M8 16.5h5"></path>
      </svg>
    `,
    future: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 7v5l3 2"></path>
        <circle cx="12" cy="13" r="7.5"></circle>
        <path d="M16.5 4.5H19"></path>
        <path d="M5 4.5h2.5"></path>
      </svg>
    `,
    result: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.5 12h15"></path>
        <path d="m13 7 5 5-5 5"></path>
        <path d="m11 17-5-5 5-5"></path>
      </svg>
    `,
  };
  return icons[name] || icons.result;
}


function renderDateCalculatorFeedback(message, tone = "success") {
  return `
    <p class="form-feedback ${message ? `form-feedback-${tone}` : "hidden"}">
      ${escapeHtml(message || "")}
    </p>
  `;
}


function renderDateCalculatorResultCard({ eyebrow, title, value, helper, tone = "default", emptyText = "" }) {
  const hasValue = Boolean(value);

  return `
    <article class="date-calculator-result-card ${hasValue ? `date-calculator-result-${tone}` : "is-empty"}">
      <div class="date-calculator-result-top">
        <span class="date-calculator-result-icon" aria-hidden="true">${renderDateCalculatorIcon("result")}</span>
        <div>
          <small>${escapeHtml(eyebrow)}</small>
          <strong>${escapeHtml(title)}</strong>
        </div>
      </div>
      ${hasValue
        ? `
          <div class="date-calculator-result-value">${escapeHtml(value)}</div>
          <p>${escapeHtml(helper || "")}</p>
        `
        : `
          <div class="date-calculator-result-placeholder">${escapeHtml(emptyText)}</div>
        `}
    </article>
  `;
}


function parseIsoDateParts(value) {
  const normalized = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;

  const [year, month, day] = normalized.split("-").map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day };
}


function isoDateToUtcTimestamp(value) {
  const parts = parseIsoDateParts(value);
  if (!parts) return null;
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}


function diffDaysBetweenIsoDates(startDate, endDate) {
  const startTimestamp = isoDateToUtcTimestamp(startDate);
  const endTimestamp = isoDateToUtcTimestamp(endDate);
  if (startTimestamp === null || endTimestamp === null) return null;
  return Math.round((endTimestamp - startTimestamp) / 86400000);
}


function addDaysToIsoDate(baseDate, days) {
  const baseTimestamp = isoDateToUtcTimestamp(baseDate);
  if (baseTimestamp === null) return "";

  const shiftedDate = new Date(baseTimestamp);
  shiftedDate.setUTCDate(shiftedDate.getUTCDate() + Number(days || 0));

  const year = String(shiftedDate.getUTCFullYear());
  const month = String(shiftedDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shiftedDate.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}


function getFullWeekdayLabel(dateValue) {
  const timestamp = isoDateToUtcTimestamp(dateValue);
  if (timestamp === null) return "";

  const weekday = new Date(timestamp).getUTCDay();
  const labels = [
    "Domingo",
    "Segunda-feira",
    "Terça-feira",
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
  ];
  return labels[weekday] || "";
}


function updateDateCalculatorField(field, value) {
  if (!field) return;

  const calculation = state.dateCalculator;
  if (field === "differenceStartDate") {
    calculation.differenceStartDate = value;
    calculation.differenceDays = null;
    calculation.differenceMessage = "";
    calculation.differenceTone = "success";
    return;
  }
  if (field === "differenceEndDate") {
    calculation.differenceEndDate = value;
    calculation.differenceDays = null;
    calculation.differenceMessage = "";
    calculation.differenceTone = "success";
    return;
  }
  if (field === "futureBaseDate") {
    calculation.futureBaseDate = value;
    calculation.futureResultDate = "";
    calculation.futureWeekday = "";
    calculation.futureMessage = "";
    calculation.futureTone = "success";
    return;
  }
  if (field === "futureDaysAhead") {
    calculation.futureDaysAhead = String(value || "").replace(/\D/g, "");
    calculation.futureResultDate = "";
    calculation.futureWeekday = "";
    calculation.futureMessage = "";
    calculation.futureTone = "success";
  }
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
      <button type="button" class="table-action" data-action="pdf-quote" data-id="${id}">PDF</button>
      <button type="button" class="table-action" data-action="duplicate-quote" data-id="${id}">Duplicar</button>
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


function renderQuoteUnitOptions(selectedValue = DEFAULT_QUOTE_UNIT) {
  const normalizedSelectedValue = normalizeQuoteUnitValue(selectedValue);
  const options = state.data.options.quote_item_units?.length
    ? state.data.options.quote_item_units
    : QUOTE_ITEM_UNITS;
  const items = [...options];
  if (normalizedSelectedValue && !items.includes(normalizedSelectedValue)) {
    items.unshift(normalizedSelectedValue);
  }

  return items.map((item) => `
    <option value="${item}" ${item === normalizedSelectedValue ? "selected" : ""}>${item}</option>
  `).join("");
}


function normalizeQuoteLookupValue(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}


function normalizeQuoteUnitValue(value = DEFAULT_QUOTE_UNIT) {
  const cleanedValue = String(value || "").trim();
  if (!cleanedValue) return DEFAULT_QUOTE_UNIT;
  if (QUOTE_ITEM_UNITS.includes(cleanedValue)) return cleanedValue;

  const normalizedKey = cleanedValue
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .toUpperCase();

  return QUOTE_UNIT_VALUE_MAP[normalizedKey] || DEFAULT_QUOTE_UNIT;
}


function getQuoteProductLookupLabel(product) {
  const sku = product?.sku || product?.code || "";
  const name = product?.name || "";
  return sku ? `${sku} - ${name}` : name;
}


function renderQuoteProductSuggestions() {
  return [...getActiveProducts()]
    .sort((first, second) => String(first.name || "").localeCompare(String(second.name || "")))
    .map((product) => `<option value="${escapeHtml(getQuoteProductLookupLabel(product))}"></option>`)
    .join("");
}


function resolveQuoteDraftProduct(value) {
  const normalizedValue = normalizeQuoteLookupValue(value);
  if (!normalizedValue) return null;

  return getActiveProducts().find((product) => {
    const sku = normalizeQuoteLookupValue(product.sku || product.code);
    const name = normalizeQuoteLookupValue(product.name);
    const label = normalizeQuoteLookupValue(getQuoteProductLookupLabel(product));
    return normalizedValue === sku || normalizedValue === name || normalizedValue === label;
  }) || null;
}


function renderQuoteMatchedProduct(product) {
  if (!product) {
    return `
      <div class="quote-product-match quote-product-match-empty" data-quote-product-match="true">
        <strong>Autocomplete por produto</strong>
        <small>Digite o nome ou SKU para usar os dados do cadastro automaticamente.</small>
      </div>
    `;
  }

  return `
    <div class="quote-product-match" data-quote-product-match="true">
      <strong>${escapeHtml(product.name || "-")}</strong>
      <small>${escapeHtml(product.sku || product.code || "-")} • ${escapeHtml(product.unit || "UN")} • ${formatMoney(product.sale_price || 0)}</small>
    </div>
  `;
}


function syncQuoteDraftProductMatch(form, options = {}) {
  if (!(form instanceof HTMLFormElement)) return null;

  const {
    forceName = false,
    preferCatalogValues = false,
  } = options;

  const itemNameField = form.querySelector('[name="draft_item_name"]');
  const unitField = form.querySelector('[name="draft_unit"]');
  const quantityField = form.querySelector('[name="draft_quantity"]');
  const unitPriceField = form.querySelector('[name="draft_unit_price"]');
  const matchContainer = form.querySelector("[data-quote-product-match]");

  if (!(itemNameField instanceof HTMLInputElement)) return null;

  const matchedProduct = resolveQuoteDraftProduct(itemNameField.value);

  if (matchContainer) {
    matchContainer.outerHTML = renderQuoteMatchedProduct(matchedProduct);
  }

  if (!matchedProduct) {
    return null;
  }

  const normalizedInput = normalizeQuoteLookupValue(itemNameField.value);
  const matchesLookupLabel = normalizedInput === normalizeQuoteLookupValue(getQuoteProductLookupLabel(matchedProduct));
  const matchesSku = normalizedInput === normalizeQuoteLookupValue(matchedProduct.sku || matchedProduct.code);

  if (forceName || matchesLookupLabel || matchesSku) {
    itemNameField.value = matchedProduct.name || itemNameField.value;
  }

  if (unitField instanceof HTMLSelectElement && (preferCatalogValues || !unitField.value || unitField.value === DEFAULT_QUOTE_UNIT)) {
    unitField.value = normalizeQuoteUnitValue(matchedProduct.unit);
  }

  if (isMoneyInput(unitPriceField)) {
    const currentValue = parseMoneyInputValue(unitPriceField.value || 0);
    if (preferCatalogValues || currentValue === 0) {
      applyMoneyDigits(unitPriceField, moneyDigitsFromValue(matchedProduct.sale_price || 0));
    }
  }

  if (quantityField instanceof HTMLInputElement && !quantityField.value) {
    quantityField.value = "1";
  }

  return matchedProduct;
}


function createQuoteDraftItem(item = {}, options = {}) {
  const { allowZeroQuantity = false } = options;
  const itemName = String(item.item_name ?? item.product_name ?? "").trim();
  const unit = normalizeQuoteUnitValue(item.unit || DEFAULT_QUOTE_UNIT);
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
    product_id: item.product_id ? Number(item.product_id) : null,
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
    draft: createQuoteDraftItem({ unit: DEFAULT_QUOTE_UNIT, quantity: 1, unit_price: 0 }),
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
  const initializedFor = editing
    ? (editing.__composer_key || `quote:${editing.id}`)
    : "new";
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
  composer.draft = createQuoteDraftItem({ unit: DEFAULT_QUOTE_UNIT, quantity: 1, unit_price: 0 });
  composer.editingIndex = null;

  if (!form) return;

  const itemNameField = form.querySelector('[name="draft_item_name"]');
  const quantityField = form.querySelector('[name="draft_quantity"]');
  const unitField = form.querySelector('[name="draft_unit"]');
  const unitPriceField = form.querySelector('[name="draft_unit_price"]');

  if (itemNameField) itemNameField.value = "";
  if (quantityField) quantityField.value = String(composer.draft.quantity);
  if (unitField) unitField.value = composer.draft.unit;
  if (unitPriceField) {
    applyMoneyDigits(unitPriceField, moneyDigitsFromValue(composer.draft.unit_price));
  }
}


function readQuoteDraftFromForm(form) {
  const composer = getQuoteComposer();
  const itemNameRaw = form.querySelector('[name="draft_item_name"]')?.value || "";
  const quantityValue = Number(form.querySelector('[name="draft_quantity"]')?.value || 0);
  const unitValue = form.querySelector('[name="draft_unit"]')?.value || DEFAULT_QUOTE_UNIT;
  const unitPriceValue = parseMoneyInputValue(form.querySelector('[name="draft_unit_price"]')?.value || 0);

  composer.draft = createQuoteDraftItem({
    product_id: null,
    item_name: itemNameRaw,
    unit: unitValue,
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
    <section class="quote-studio-card quote-studio-item-card">
      <div class="quote-studio-section-title">
        <span class="quote-studio-section-icon quote-studio-section-icon-orange" aria-hidden="true">${renderChecksPageIcon("plus")}</span>
        <h3>Adicionar item ao orçamento</h3>
      </div>
      <div class="quote-entry-form-grid quotes-item-entry-grid quote-studio-item-grid">
        <label class="quote-entry-name quote-studio-field">
          <span>Descrição</span>
          <div class="quote-studio-input-shell">
            <span aria-hidden="true">${renderChecksPageIcon("file")}</span>
            <input
              type="text"
              name="draft_item_name"
              value="${escapeHtml(toFormValue(draft.item_name))}"
              placeholder="Ex.: Cimento CP II 50kg"
              autocomplete="off"
            >
          </div>
        </label>
        <label class="quote-entry-quantity quote-studio-field">
          <span>QNTD</span>
          <input type="number" name="draft_quantity" min="0.01" step="0.01" value="${escapeHtml(String(draft.quantity || 1))}">
        </label>
        <label class="quote-entry-unit quote-studio-field">
          <span>UN</span>
          <select name="draft_unit">
            ${renderQuoteUnitOptions(draft.unit || DEFAULT_QUOTE_UNIT)}
          </select>
        </label>
        <label class="quote-entry-price quote-studio-field">
          <span>Valor unitário</span>
          ${renderMoneyInput({ name: "draft_unit_price", value: draft.unit_price ?? 0, classes: "money-input-compact" })}
        </label>
        <div class="line-total-box quote-entry-total-box quote-studio-total-field">
          <span>Valor total</span>
          <strong data-quote-draft-total>${formatMoney(draftTotal)}</strong>
        </div>
        <div class="quote-entry-actions quotes-item-entry-actions quote-studio-item-actions">
          <button type="button" class="btn btn-primary quote-studio-add-button" data-action="save-quote-item">
            <span aria-hidden="true">${renderChecksPageIcon("plus")}</span>
            ${isEditingItem ? "Salvar alteração" : "Adicionar item"}
          </button>
          ${isEditingItem ? '<button type="button" class="btn btn-secondary quote-studio-cancel-edit" data-action="cancel-quote-item-edit">Cancelar edição</button>' : ""}
        </div>
      </div>
    </section>
  `;
}


function renderQuoteItemsList() {
  const composer = getQuoteComposer();
  const totals = getQuoteTotals(composer.items);

  return `
    <div class="table-wrapper quote-items-table-wrapper quotes-items-table-wrapper quote-studio-table-wrapper">
      <table class="data-table quote-items-table quotes-items-table quote-studio-table">
        <thead>
          <tr>
            <th>Nº</th>
            <th>Descrição</th>
            <th>Qtd</th>
            <th>UN</th>
            <th>Valor unit.</th>
            <th>Total</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${composer.items.length ? composer.items.map((item, index) => `
            <tr>
              <td><span class="quote-row-number">${String(index + 1).padStart(2, "0")}</span></td>
              <td>
                <strong>${escapeHtml(item.item_name)}</strong>
              </td>
              <td class="quote-studio-cell-center">${formatNumber(item.quantity)}</td>
              <td class="quote-studio-cell-center quote-studio-unit-cell">${escapeHtml(item.unit || DEFAULT_QUOTE_UNIT)}</td>
              <td class="quote-studio-cell-money">${formatMoney(item.unit_price)}</td>
              <td class="quote-studio-cell-money">${formatMoney(item.total_price)}</td>
              <td>
                <div class="table-actions quote-studio-row-actions">
                  <button type="button" class="quote-studio-icon-action" data-action="edit-quote-item" data-index="${index}" title="Editar item" aria-label="Editar item ${index + 1}">
                    ${renderChecksPageIcon("edit")}
                  </button>
                  <button type="button" class="quote-studio-icon-action danger" data-action="remove-quote-item" data-index="${index}" title="Excluir item" aria-label="Excluir item ${index + 1}">
                    ${renderChecksPageIcon("trash")}
                  </button>
                </div>
              </td>
            </tr>
            `).join("") : `
              <tr class="quote-studio-empty-row">
                <td colspan="7">
                  <div class="quote-items-empty quotes-items-empty quote-studio-empty">
                    <strong>Nenhum item adicionado ainda</strong>
                    <p>Use o formulário acima para lançar os itens do orçamento.</p>
                  </div>
                </td>
              </tr>
            `}
        </tbody>
      </table>
    </div>
    <div class="quote-studio-table-footer">
      <span data-quote-table-count>Exibindo ${formatNumber(composer.items.length)} de ${formatNumber(composer.items.length)} itens</span>
      <strong data-quote-table-total>Total geral: ${formatMoney(totals.total)}</strong>
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
  const totals = getQuoteTotals(items);
  const draft = readQuoteDraftFromForm(form);
  const scopeRoot = form.closest(".quotes-builder-panel") || document;
  const draftTotalElement = form.querySelector("[data-quote-draft-total]");
  if (draftTotalElement) {
    draftTotalElement.textContent = formatMoney(Number(draft.quantity || 0) * Number(draft.unit_price || 0));
  }

  const totalElement = form.querySelector("[data-quote-total]");
  if (totalElement) totalElement.textContent = formatMoney(totals.total);

  const itemsCountBadge = scopeRoot.querySelector("[data-quote-items-count]");
  if (itemsCountBadge) {
    itemsCountBadge.textContent = `${formatNumber(items.length)} item(ns)`;
  }

  const itemsTotalBadge = scopeRoot.querySelector("[data-quote-items-total-badge]");
  if (itemsTotalBadge) {
    itemsTotalBadge.textContent = `${formatMoney(totals.total)} no total`;
  }

  const summaryItemsElement = scopeRoot.querySelector("[data-quote-summary-items]");
  if (summaryItemsElement) summaryItemsElement.textContent = formatNumber(items.length);

  const summarySubtotalElement = scopeRoot.querySelector("[data-quote-summary-subtotal]");
  if (summarySubtotalElement) summarySubtotalElement.textContent = formatMoney(totals.subtotal);

  const summaryDiscountElement = scopeRoot.querySelector("[data-quote-summary-discount]");
  if (summaryDiscountElement) summaryDiscountElement.textContent = formatMoney(totals.discount);

  const summaryTotalElement = scopeRoot.querySelector("[data-quote-summary-total]");
  if (summaryTotalElement) summaryTotalElement.textContent = formatMoney(totals.total);

  const tableCountElement = scopeRoot.querySelector("[data-quote-table-count]");
  if (tableCountElement) {
    tableCountElement.textContent = `Exibindo ${formatNumber(items.length)} de ${formatNumber(items.length)} itens`;
  }

  const tableTotalElement = scopeRoot.querySelector("[data-quote-table-total]");
  if (tableTotalElement) {
    tableTotalElement.textContent = `Total geral: ${formatMoney(totals.total)}`;
  }
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
      throw new Error("Informe a descrição do item antes de adicionar ao orçamento.");
    }
    if (!isValidNumber(draft.quantity, { min: 0.01, allowZero: false })) {
      throw new Error("Informe uma quantidade válida para o item do orçamento.");
    }
    if (!isValidNumber(draft.unit_price, { min: 0, allowZero: true })) {
      throw new Error("Informe um valor unitário válido para o item do orçamento.");
    }
  } catch (error) {
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
  const quantityField = form.querySelector('[name="draft_quantity"]');
  const unitField = form.querySelector('[name="draft_unit"]');
  const unitPriceField = form.querySelector('[name="draft_unit_price"]');

  if (itemNameField) itemNameField.value = composer.draft.item_name;
  if (quantityField) quantityField.value = String(composer.draft.quantity);
  if (unitField) unitField.value = composer.draft.unit;
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


function buildPaginationTokens(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "...", totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
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


function formatDecimalInput(value, digits = 2) {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue)) return "0";
  return numericValue.toFixed(digits).replace(/\.?0+$/, "");
}


function calculateProductMarginPercent(costPrice, salePrice) {
  const cost = Number(costPrice || 0);
  const sale = Number(salePrice || 0);
  if (!Number.isFinite(cost) || cost <= 0 || !Number.isFinite(sale)) return 0;
  return ((sale - cost) / cost) * 100;
}


function calculateProductSalePrice(costPrice, marginPercent) {
  const cost = Number(costPrice || 0);
  const margin = Number(marginPercent || 0);
  if (!Number.isFinite(cost) || !Number.isFinite(margin)) return 0;
  return cost * (1 + margin / 100);
}


function buildProductSalesStats() {
  const stats = new Map();
  (state.data.sales || []).forEach((sale) => {
    (sale.items || []).forEach((item) => {
      const productId = Number(item.product_id || 0);
      if (!productId) return;
      const current = stats.get(productId) || { quantity: 0, revenue: 0, count: 0 };
      current.quantity += Number(item.quantity || 0);
      current.revenue += Number(item.total_price || 0);
      current.count += 1;
      stats.set(productId, current);
    });
  });
  return stats;
}


function renderProductsIcon(name) {
  const icons = {
    csv: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3.5h7l4.5 4.5V19A1.5 1.5 0 0 1 17 20.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z"></path>
        <path d="M14 3.5V8h4.5"></path>
        <path d="M8.5 14h7"></path>
        <path d="M8.5 17h5"></path>
      </svg>
    `,
    excel: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3.5h7l4.5 4.5V19A1.5 1.5 0 0 1 17 20.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z"></path>
        <path d="M14 3.5V8h4.5"></path>
        <path d="m8.5 13.5 5 5"></path>
        <path d="m13.5 13.5-5 5"></path>
      </svg>
    `,
    active: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.5 19 7.5v9L12 20.5 5 16.5v-9z"></path>
        <path d="M5 7.5 12 11.5l7-4"></path>
        <path d="M12 11.5v9"></path>
      </svg>
    `,
    inactive: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.5 19 7.5v9L12 20.5 5 16.5v-9z"></path>
        <path d="m8 8 8 8"></path>
      </svg>
    `,
    warning: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4 20 19.5H4L12 4Z"></path>
        <path d="M12 9v4.5"></path>
        <circle cx="12" cy="16.8" r=".8"></circle>
      </svg>
    `,
    money: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5"></circle>
        <path d="M12 7.2v9.6"></path>
        <path d="M14.9 9.5c-.36-.82-1.1-1.5-2.46-1.5-1.46 0-2.44.78-2.44 1.92 0 .99.63 1.54 2.18 1.88l1.07.24c1.88.41 2.8 1.24 2.8 2.66 0 1.66-1.45 2.91-3.66 2.91-1.79 0-3.06-.7-3.7-2"></path>
      </svg>
    `,
    filters: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h16"></path>
        <path d="M7 12h10"></path>
        <path d="M10 17h4"></path>
      </svg>
    `,
    basic: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4.5" y="5.5" width="15" height="13" rx="2"></rect>
        <path d="M8 10h8"></path>
        <path d="M8 14h5"></path>
      </svg>
    `,
    pricing: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.5v17"></path>
        <path d="M16.2 7.5c-.46-1.1-1.46-1.9-3.08-1.9-1.78 0-3 .95-3 2.32 0 1.18.76 1.85 2.67 2.28l1.31.29c2.22.49 3.32 1.46 3.32 3.11 0 1.94-1.67 3.4-4.2 3.4-2.06 0-3.51-.81-4.23-2.42"></path>
      </svg>
    `,
    fiscal: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3.5h7l4.5 4.5V19A1.5 1.5 0 0 1 17 20.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z"></path>
        <path d="M14 3.5V8h4.5"></path>
        <path d="M8.5 12h7"></path>
        <path d="M8.5 15.5h7"></path>
      </svg>
    `,
    upload: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 15V6.5"></path>
        <path d="m8.5 10 3.5-3.5L15.5 10"></path>
        <path d="M5 16.5v2A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-2"></path>
      </svg>
    `,
    edit: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m4 20 4.3-1 9-9a2.1 2.1 0 0 0-3-3l-9 9L4 20Z"></path>
        <path d="m13 6 4 4"></path>
      </svg>
    `,
    duplicate: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="8" y="8" width="11" height="11" rx="2"></rect>
        <path d="M5.5 15.5h-1A2 2 0 0 1 2.5 13.5v-9a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    `,
    delete: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.5 7.5h15"></path>
        <path d="M9.5 3.5h5"></path>
        <path d="M7.5 7.5v11a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5v-11"></path>
      </svg>
    `,
  };
  return icons[name] || icons.basic;
}


function renderProductsOverviewCard({ icon, eyebrow, value, helper, tone = "default" }) {
  return `
    <article class="products-overview-card products-overview-${tone}">
      <div class="products-overview-icon" aria-hidden="true">${renderProductsIcon(icon)}</div>
      <div class="products-overview-copy">
        <span>${escapeHtml(eyebrow)}</span>
        <strong>${escapeHtml(String(value))}</strong>
        <small>${escapeHtml(helper)}</small>
      </div>
    </article>
  `;
}


function renderProductsTableActions(product) {
  return `
    <div class="table-actions product-table-actions">
      <button type="button" class="table-action icon-only" data-action="edit-product" data-id="${product.id}" title="Editar produto" aria-label="Editar produto">
        ${renderProductsIcon("edit")}
      </button>
      <button type="button" class="table-action icon-only" data-action="duplicate-product" data-id="${product.id}" title="Duplicar produto" aria-label="Duplicar produto">
        ${renderProductsIcon("duplicate")}
      </button>
      <button type="button" class="table-action icon-only danger" data-action="delete-product" data-id="${product.id}" title="Excluir produto" aria-label="Excluir produto">
        ${renderProductsIcon("delete")}
      </button>
    </div>
  `;
}


function renderProductStatusBadge(product) {
  if (product.active === false) {
    return renderBadge("Inativo", "neutral");
  }
  if (product.out_of_stock) {
    return renderBadge("Crítico", "danger");
  }
  if (product.low_stock) {
    return renderBadge("Estoque baixo", "warning");
  }
  return renderBadge("Normal", "success");
}


function renderProductOriginOptions(selectedValue = "") {
  const currentValue = String(selectedValue || "");
  const options = [...PRODUCT_ORIGIN_OPTIONS];
  if (currentValue && !options.some((item) => item.value === currentValue)) {
    options.unshift({ value: currentValue, label: currentValue });
  }
  return `
    <option value="">Selecione</option>
    ${options.map((item) => `<option value="${item.value}" ${item.value === currentValue ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}
  `;
}


function renderProductCsosnOptions(selectedValue = "") {
  const currentValue = String(selectedValue || "");
  const options = [...PRODUCT_CSOSN_OPTIONS];
  if (currentValue && !options.includes(currentValue)) {
    options.unshift(currentValue);
  }
  return `
    <option value="">Selecione</option>
    ${options.map((item) => `<option value="${item}" ${item === currentValue ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}
  `;
}


function renderProductQuickChip(value, label, active) {
  return `
    <button
      type="button"
      class="products-chip ${active ? "active" : ""}"
      data-action="products-quick-filter"
      data-filter-value="${value}"
      aria-pressed="${active ? "true" : "false"}"
    >
      ${escapeHtml(label)}
    </button>
  `;
}


function getFilteredProductsBase() {
  const filter = state.filters.products;
  const salesStats = buildProductSalesStats();
  const search = filter.search;
  const categoryFilter = filter.category;
  const activeFilter = filter.active_filter || "active";
  const stockFilter = filter.stock_filter || "";
  const quickFilter = filter.quick_filter || "";
  const priceMin = filter.price_min === "" ? null : Number(filter.price_min || 0);
  const priceMax = filter.price_max === "" ? null : Number(filter.price_max || 0);

  let products = getSimpleSearchRecords(
    state.data.products,
    ["name", "sku", "code", "category", "description", "ncm"],
    search,
  ).map((product) => {
    const stats = salesStats.get(Number(product.id)) || { quantity: 0, revenue: 0, count: 0 };
    return {
      ...product,
      sold_quantity: stats.quantity,
      sold_revenue: stats.revenue,
      sale_count: stats.count,
      has_sales: stats.quantity > 0,
    };
  }).filter((product) => {
    if (categoryFilter && product.category !== categoryFilter) return false;
    if (activeFilter === "active" && product.active === false) return false;
    if (activeFilter === "inactive" && product.active !== false) return false;
    if (stockFilter === "low" && !product.low_stock) return false;
    if (stockFilter === "empty" && !product.out_of_stock) return false;
    if (stockFilter === "normal" && (product.low_stock || product.out_of_stock)) return false;
    if (priceMin !== null && Number(product.sale_price || 0) < priceMin) return false;
    if (priceMax !== null && Number(product.sale_price || 0) > priceMax) return false;
    if (quickFilter === "low_stock" && !product.low_stock) return false;
    if (quickFilter === "out_of_stock" && !product.out_of_stock) return false;
    if (quickFilter === "most_sold" && !product.has_sales) return false;
    if (quickFilter === "no_sales" && product.has_sales) return false;
    return true;
  });

  if (quickFilter === "most_sold") {
    products = [...products].sort((first, second) => (
      Number(second.sold_quantity || 0) - Number(first.sold_quantity || 0)
    ) || String(first.name || "").localeCompare(String(second.name || "")));
  }

  return products;
}


function renderProductsListResults() {
  const perPage = Number(state.filters.products.per_page || PRODUCTS_PER_PAGE);
  const pagination = paginateRecords(getFilteredProductsBase(), state.filters.products.page, perPage);
  const products = pagination.items;
  const pages = Array.from({ length: pagination.totalPages }, (_, index) => index + 1);

  return products.length ? `
    <div class="products-table-shell">
      <div class="table-wrapper products-table-wrapper">
        <table class="data-table products-data-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Produto</th>
              <th>Categoria</th>
              <th>Estoque</th>
              <th>Mínimo</th>
              <th>Venda (R$)</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${products.map((product) => `
              <tr class="${product.out_of_stock ? "row-danger" : product.low_stock ? "row-warning" : ""}">
                <td>
                  <strong>${escapeHtml(product.sku || product.code)}</strong>
                  <small>${escapeHtml(product.ncm || "NCM não informado")}</small>
                </td>
                <td>
                  <strong>${escapeHtml(product.name)}</strong>
                  <small>${escapeHtml(`${product.unit} • CFOP ${product.cfop_default || "-"}`)}</small>
                </td>
                <td>
                  <strong>${escapeHtml(product.category)}</strong>
                  <small>${escapeHtml(product.has_sales ? `${formatNumber(product.sold_quantity)} un. vendida(s)` : "Sem vendas registradas")}</small>
                </td>
                <td>${formatNumber(product.stock_quantity)}</td>
                <td>${formatNumber(product.min_stock)}</td>
                <td>${formatMoney(product.sale_price)}</td>
                <td>${renderProductStatusBadge(product)}</td>
                <td>${renderProductsTableActions(product)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      <div class="table-pagination products-table-pagination">
        <div class="products-pagination-left">
          <span>Mostrando ${formatNumber(products.length)} de ${formatNumber(pagination.totalItems)} produto(s)</span>
        </div>
        <div class="products-pagination-right">
          <label class="products-per-page" data-filter-scope="products">
            <span>Itens por página</span>
            <select name="per_page">
              ${[5, 10, 20, 30].map((value) => `<option value="${value}" ${perPage === value ? "selected" : ""}>${value}</option>`).join("")}
            </select>
          </label>
          <div class="products-pagination-controls">
            <button type="button" class="btn btn-secondary btn-compact" data-action="products-prev-page" ${pagination.page <= 1 ? "disabled" : ""}>Anterior</button>
            <div class="products-pagination-pages">
              ${pages.map((page) => `
                <button
                  type="button"
                  class="btn btn-secondary btn-compact products-pagination-page ${page === pagination.page ? "active" : ""}"
                  data-action="products-go-page"
                  data-page="${page}"
                  ${page === pagination.page ? 'aria-current="page"' : ""}
                >
                  ${page}
                </button>
              `).join("")}
            </div>
            <button type="button" class="btn btn-secondary btn-compact" data-action="products-next-page" ${pagination.page >= pagination.totalPages ? "disabled" : ""}>Próxima</button>
          </div>
        </div>
      </div>
    </div>
  ` : renderEmptyState("Nenhum produto encontrado", "Ajuste os filtros ou cadastre um novo item para o catálogo.");
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


function formatNfeEnvironmentLabel(value) {
  return value === "production" ? "Produção" : "Homologação";
}


function formatNfeStatusLabel(status) {
  const normalized = String(status || "").trim();
  if (!normalized) return "Pendente";
  if (normalized.toUpperCase() === "AUTORIZADA") return "Autorizada";
  return normalized
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}


function nfeStatusTone(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("autoriz")) return "success";
  if (normalized.includes("rejeit") || normalized.includes("cancel")) return "danger";
  if (normalized.includes("pend") || normalized.includes("process")) return "warning";
  return statusTone(status);
}


function formatNfePhone(value) {
  const digits = digitsOnly(value);
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return String(value || "");
}


function buildNfeFiscalAddress(settings) {
  return [settings.street, settings.number].filter(Boolean).join(", ") || "-";
}


function buildNfeFiscalCityState(settings) {
  return [settings.city, settings.state].filter(Boolean).join(" / ") || "-";
}


function isNfeFiscalProfileReady(settings) {
  return Boolean(
    settings.company_name
    && settings.trade_name
    && digitsOnly(settings.cnpj).length === 14
    && settings.state_registration
    && settings.city
    && settings.state,
  );
}


function renderNfeDashboardIcon(name) {
  const icons = {
    home: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.5 10.5 12 4l7.5 6.5"></path>
        <path d="M6.5 9.5v9h11v-9"></path>
        <path d="M10 18.5v-5h4v5"></path>
      </svg>
    `,
    chevron: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m10 8 4 4-4 4"></path>
      </svg>
    `,
    "file-check": `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3.5h7l4.5 4.5V19A1.5 1.5 0 0 1 17 20.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z"></path>
        <path d="M14 3.5V8h4.5"></path>
        <path d="m9.5 14.2 1.8 1.8 3.6-4.1"></path>
      </svg>
    `,
    receipt: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3.5h10v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4V3.5z"></path>
        <path d="M9.5 8h5"></path>
        <path d="M9.5 11.5h5"></path>
        <path d="M9.5 15h3.5"></path>
      </svg>
    `,
    "shield-check": `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.5 18.5 6v5.5c0 4.1-2.5 6.9-6.5 9-4-2.1-6.5-4.9-6.5-9V6z"></path>
        <path d="m9.5 12.5 1.8 1.8 3.8-4.1"></path>
      </svg>
    `,
    sparkle: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2z"></path>
        <path d="m18 13 .7 2.2L21 16l-2.3.8L18 19l-.7-2.2L15 16l2.3-.8z"></path>
      </svg>
    `,
    hash: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 4.5 7 19.5"></path>
        <path d="M17 4.5 15 19.5"></path>
        <path d="M4.5 9h15"></path>
        <path d="M3.5 15h15"></path>
      </svg>
    `,
    building: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.5 20.5h15"></path>
        <path d="M6.5 20.5V6.5l5.5-2v16"></path>
        <path d="M12 8.5h5.5v12"></path>
        <path d="M8.5 9.5h1"></path>
        <path d="M8.5 12.5h1"></path>
        <path d="M14.5 11.5h1"></path>
        <path d="M14.5 14.5h1"></path>
      </svg>
    `,
    store: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.5 8.5 6 4.5h12l1.5 4v2a2 2 0 0 1-2 2 2.1 2.1 0 0 1-1.9-1.2 2.1 2.1 0 0 1-1.9 1.2 2.1 2.1 0 0 1-1.8-1 2.1 2.1 0 0 1-1.8 1 2.1 2.1 0 0 1-1.9-1.2 2 2 0 0 1-2 1.2 2 2 0 0 1-2-2z"></path>
        <path d="M6.5 12.5v7h11v-7"></path>
      </svg>
    `,
    badge: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4.5" y="4.5" width="15" height="15" rx="3"></rect>
        <path d="M8 9h8"></path>
        <path d="M8 13h8"></path>
        <path d="M8 17h4"></path>
      </svg>
    `,
    landmark: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3.5 20.5h17"></path>
        <path d="M5.5 17.5V10"></path>
        <path d="M9.5 17.5V10"></path>
        <path d="M14.5 17.5V10"></path>
        <path d="M18.5 17.5V10"></path>
        <path d="M3.5 9.5 12 4l8.5 5.5z"></path>
      </svg>
    `,
    pin: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20s5.5-5.7 5.5-10A5.5 5.5 0 1 0 6.5 10C6.5 14.3 12 20 12 20Z"></path>
        <circle cx="12" cy="10" r="2.3"></circle>
      </svg>
    `,
    homepin: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.5 10.5 12 4l7.5 6.5"></path>
        <path d="M6.5 9.5v9h11v-9"></path>
        <path d="M12 18.5v-4"></path>
      </svg>
    `,
    map: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 4.5 15 3l5 1.5v15L15 18l-6 1.5-5-1.5v-15z"></path>
        <path d="M9 4.5v15"></path>
        <path d="M15 3v15"></path>
      </svg>
    `,
    phone: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.5 4.5h3l1.2 3.7-1.8 1.6a14.5 14.5 0 0 0 5.3 5.3l1.6-1.8 3.7 1.2v3a1.5 1.5 0 0 1-1.6 1.5A15.4 15.4 0 0 1 5 6.1a1.5 1.5 0 0 1 1.5-1.6z"></path>
      </svg>
    `,
    pencil: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20h4l10-10-4-4L4 16v4Z"></path>
        <path d="M13 7l4 4"></path>
      </svg>
    `,
    arrow: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12h14"></path>
        <path d="m13 7 5 5-5 5"></path>
      </svg>
    `,
    download: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4.5v10"></path>
        <path d="m8 11.5 4 4 4-4"></path>
        <path d="M5 19.5h14"></path>
      </svg>
    `,
    rocket: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M13.5 4.5c3.1 0 5.5 2.4 5.5 5.5 0 4.5-4.5 8.5-10.5 9.5.9-6 5-10.5 9.5-10.5z"></path>
        <path d="M8.5 15.5 6 18l-1.5-4.5L7 11"></path>
        <path d="M13.5 10.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"></path>
      </svg>
    `,
    history: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3.5 12a8.5 8.5 0 1 0 2.2-5.7"></path>
        <path d="M3.5 5.5v4h4"></path>
        <path d="M12 7.5v5l3 1.8"></path>
      </svg>
    `,
  };

  return icons[name] || icons.badge;
}


function renderNfeHeroStat({ icon, label, value, helper, tone = "neutral" }) {
  return `
    <article class="nfe-hero-stat nfe-hero-stat-${tone}">
      <span class="nfe-hero-stat-icon" aria-hidden="true">${renderNfeDashboardIcon(icon)}</span>
      <div class="nfe-hero-stat-copy">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(String(value))}</strong>
        <small>${escapeHtml(helper)}</small>
      </div>
    </article>
  `;
}


function renderNfeSettingsSummaryItem({ icon, label, value, wide = false }) {
  return `
    <article class="nfe-settings-summary-item ${wide ? "is-wide" : ""}">
      <span class="nfe-settings-summary-icon" aria-hidden="true">${renderNfeDashboardIcon(icon)}</span>
      <div class="nfe-settings-summary-copy">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value || "-")}</strong>
      </div>
    </article>
  `;
}


function renderNfeFlowStep({ step, icon, title, description, action = "" }) {
  const tagName = action ? "button" : "article";
  const actionAttrs = action ? ` type="button" data-action="${action}"` : "";
  return `
    <${tagName} class="nfe-flow-dashboard-step ${action ? "is-interactive" : ""}"${actionAttrs}>
      <div class="nfe-flow-dashboard-step-start">
        <span class="nfe-flow-dashboard-step-icon" aria-hidden="true">${renderNfeDashboardIcon(icon)}</span>
        <span class="nfe-flow-dashboard-step-number">${escapeHtml(String(step))}</span>
      </div>
      <div class="nfe-flow-dashboard-step-copy">
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(description)}</p>
      </div>
      <span class="nfe-flow-dashboard-step-arrow" aria-hidden="true">${renderNfeDashboardIcon("arrow")}</span>
    </${tagName}>
  `;
}


function renderNfeQuickAccessRow(record) {
  return `
    <article class="nfe-quick-access-row">
      <div class="nfe-quick-access-main">
        <strong>NF-e #${escapeHtml(String(record.number_nfe || "-"))}</strong>
        <small>${escapeHtml([record.customer_name || "Cliente não informado", record.payment_method || "-"].filter(Boolean).join(" • "))}</small>
      </div>
      <div class="nfe-quick-access-status">${renderBadge(formatNfeStatusLabel(record.status_nfe), nfeStatusTone(record.status_nfe))}</div>
      <div class="nfe-quick-access-total">${formatMoney(record.total_amount)}</div>
      <button
        type="button"
        class="nfe-quick-access-download"
        data-action="download-nfe-pdf"
        data-id="${record.id}"
        aria-label="Baixar DANFE da NF-e ${escapeHtml(String(record.number_nfe || "-"))}"
        title="Baixar DANFE"
      >
        ${renderNfeDashboardIcon("download")}
      </button>
    </article>
  `;
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
              <td>${renderBadge(formatNfeStatusLabel(record.status_nfe), nfeStatusTone(record.status_nfe))}</td>
              <td>${escapeHtml(record.authorization_date ? formatDate(record.authorization_date.slice(0, 10)) : "-")}</td>
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
  return getSimpleSearchRecords(
    state.data.customers,
    [
      "name",
      "trade_name",
      "phone",
      "whatsapp",
      "email",
      "document",
      "document_formatted",
      "cpf",
      "cnpj",
      "zip_code",
      "street",
      "district",
      "city",
      "state",
      "city_ibge_code",
      "state_registration",
      "rg",
      "notes",
    ],
    state.filters.customers.search,
  );
}


function getCustomerPreviewRecord() {
  const previewId = String(state.customersUi.previewId || "").trim();
  if (!previewId) return null;
  return state.data.customers.find((customer) => String(customer.id) === previewId) || null;
}


function renderCustomerActionIcon(name) {
  const icons = {
    view: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"></path>
        <circle cx="12" cy="12" r="3.25"></circle>
      </svg>
    `,
    edit: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20h4l10-10-4-4L4 16v4Z"></path>
        <path d="M13 7l4 4"></path>
      </svg>
    `,
    delete: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h16"></path>
        <path d="M9 3h6l1 2H8l1-2Z"></path>
        <path d="M7 7l1 13h8l1-13"></path>
        <path d="M10 11v5"></path>
        <path d="M14 11v5"></path>
      </svg>
    `,
  };
  return icons[name] || "";
}


function renderCustomerListActions(customer) {
  return `
    <div class="table-actions customer-table-actions">
      <button type="button" class="table-action" data-action="view-customer" data-id="${customer.id}" title="Ver cliente" aria-label="Ver cliente">
        ${renderCustomerActionIcon("view")}<span>Ver</span>
      </button>
      <button type="button" class="table-action" data-action="edit-customer" data-id="${customer.id}" title="Editar cliente" aria-label="Editar cliente">
        ${renderCustomerActionIcon("edit")}<span>Editar</span>
      </button>
      <button type="button" class="table-action danger" data-action="delete-customer" data-id="${customer.id}" title="Excluir cliente" aria-label="Excluir cliente">
        ${renderCustomerActionIcon("delete")}<span>Excluir</span>
      </button>
    </div>
  `;
}


function renderCustomerPreviewCard(customer) {
  if (!customer) return "";

  const identityLabel = customer.person_type === "PJ" ? "Pessoa Jurídica" : "Pessoa Física";
  const contacts = [customer.phone, customer.whatsapp, customer.email].filter(Boolean).join(" • ");
  const summaryItems = [
    { label: "Documento", value: customer.document_formatted || "-" },
    { label: "Tipo", value: identityLabel },
    { label: "Cidade", value: customer.city_label || "-" },
    { label: "IE", value: customer.state_registration || (customer.ie_indicator === "Contribuinte" ? "-" : customer.ie_indicator) || "-" },
  ];

  return `
    <section class="customer-preview-card">
      <div class="customer-preview-header">
        <div>
          <span class="eyebrow">Visualização rápida</span>
          <h4>${escapeHtml(customer.name || "Cliente")}</h4>
          <p>${escapeHtml(customer.trade_name || identityLabel)}</p>
        </div>
        <button type="button" class="table-action icon-only" data-action="close-customer-preview" aria-label="Fechar visualização" title="Fechar visualização">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12"></path><path d="m18 6-12 12"></path></svg>
        </button>
      </div>
      <div class="customer-preview-grid">
        ${summaryItems.map((item) => `
          <article class="customer-preview-stat">
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.value)}</strong>
          </article>
        `).join("")}
      </div>
      <div class="customer-preview-details">
        <p><strong>Endereço:</strong> ${escapeHtml(buildCustomerDisplayAddress(customer))}</p>
        <p><strong>Contato:</strong> ${escapeHtml(contacts || "Não informado")}</p>
        ${customer.person_type === "PF" && (customer.rg || customer.birth_date) ? `
          <p><strong>Dados adicionais:</strong> ${escapeHtml([customer.rg ? `RG ${customer.rg}` : "", customer.birth_date ? `Nascimento ${formatDate(customer.birth_date)}` : ""].filter(Boolean).join(" • "))}</p>
        ` : ""}
        ${customer.notes ? `<p><strong>Observações:</strong> ${escapeHtml(customer.notes)}</p>` : ""}
      </div>
    </section>
  `;
}


function renderCustomersListResults() {
  const customers = getFilteredCustomers();

  return customers.length ? `
    <div class="table-wrapper customers-list-table-wrapper">
      <table class="data-table customers-data-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Tipo</th>
            <th>CPF / CNPJ</th>
            <th>Cidade</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${customers.map((customer) => `
            <tr>
              <td>
                <strong>${escapeHtml(customer.name)}</strong>
                <small>${escapeHtml(customer.phone || customer.whatsapp || customer.email || (customer.trade_name || "Sem contato adicional"))}</small>
              </td>
              <td>
                ${renderBadge(customer.person_type === "PJ" ? "Pessoa Jurídica" : "Pessoa Física", customer.person_type === "PJ" ? "success" : "brand")}
              </td>
              <td>
                <strong>${escapeHtml(customer.document_formatted || "-")}</strong>
                <small>${escapeHtml(customer.ie_indicator === "Nao contribuinte" ? "Não contribuinte" : customer.ie_indicator || "Sem indicador")}</small>
              </td>
              <td>
                <strong>${escapeHtml(customer.city_label || "-")}</strong>
                <small>${escapeHtml(customer.state_registration || customer.city_ibge_code || "Sem complemento fiscal")}</small>
              </td>
              <td>${renderCustomerListActions(customer)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  ` : renderEmptyState("Nenhum cliente encontrado", "Tente outro termo ou cadastre um novo cliente.");
}


function getFilteredSalesCacheKey() {
  const filter = state.filters.sales;
  return [
    filter.preset,
    filter.day,
    filter.start,
    filter.end,
    filter.specific_month,
    filter.payment_method,
    String(filter.search || "").trim().toLowerCase(),
    state.data.sales.length,
  ].join("|");
}


function getFilteredSalesData() {
  const cacheKey = getFilteredSalesCacheKey();
  if (filteredSalesCache.source === state.data.sales && filteredSalesCache.key === cacheKey && filteredSalesCache.result) {
    return filteredSalesCache.result;
  }

  const period = getPeriod("sales");
  let periodSales = filterByPeriod(state.data.sales, "sale_date", period);
  if (state.filters.sales.payment_method) {
    periodSales = periodSales.filter((sale) => sale.payment_method === state.filters.sales.payment_method);
  }
  const sales = getSimpleSearchRecords(
    periodSales,
    ["payment_method", "notes", "period", "sale_time"],
    state.filters.sales.search,
  );

  const result = {
    period,
    sales,
    shiftSummary: getSalesShiftSummary(sales),
  };

  filteredSalesCache.source = state.data.sales;
  filteredSalesCache.key = cacheKey;
  filteredSalesCache.result = result;
  return result;
}


function getSalesHeaderMetrics() {
  const todaySales = filterByPeriod(state.data.sales, "sale_date", getPresetRange("today"));
  const yesterdaySales = filterByPeriod(state.data.sales, "sale_date", getPresetRange("yesterday"));
  const totalToday = sumBy(todaySales, (sale) => sale.total_amount);
  const totalYesterday = sumBy(yesterdaySales, (sale) => sale.total_amount);
  const todayCount = todaySales.length;
  const ticketAverage = todayCount ? totalToday / todayCount : 0;

  let trendHelper = "Sem base comparativa com ontem";
  if (totalYesterday > 0) {
    const delta = ((totalToday - totalYesterday) / totalYesterday) * 100;
    const signal = delta >= 0 ? "+" : "";
    trendHelper = `${signal}${delta.toFixed(0)}% vs ontem`;
  }

  return {
    totalToday,
    todayCount,
    ticketAverage,
    trendHelper,
  };
}


function getSalesEvolutionData(sales, limit = 7) {
  const grouped = new Map();
  sales.forEach((sale) => {
    if (!sale.sale_date) return;
    grouped.set(sale.sale_date, (grouped.get(sale.sale_date) || 0) + Number(sale.total_amount || 0));
  });

  return [...grouped.entries()]
    .sort((first, second) => first[0].localeCompare(second[0]))
    .slice(-limit)
    .map(([date, value]) => ({
      label: formatDate(date).slice(0, 5),
      value,
      date,
    }));
}


function renderSalesIcon(name) {
  const icons = {
    revenue: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 17.5V6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z" />
        <path d="M8 12h8M12 8v8" />
      </svg>
    `,
    ticket: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 7.5h10A2.5 2.5 0 0 1 19.5 10v4A2.5 2.5 0 0 1 17 16.5H7A2.5 2.5 0 0 1 4.5 14v-4A2.5 2.5 0 0 1 7 7.5Z" />
        <path d="M9 10.5h6M9 13.5h3.5" />
      </svg>
    `,
    customers: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 12a3.5 3.5 0 1 0-3.5-3.5A3.5 3.5 0 0 0 12 12Z" />
        <path d="M5.5 18.5a6.5 6.5 0 0 1 13 0" />
      </svg>
    `,
    conversion: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 15l4-4 3 3 5-6" />
        <path d="M18 10V6h-4" />
      </svg>
    `,
    morning: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v2.5M12 18.5V21M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M3 12h2.5M18.5 12H21M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
      </svg>
    `,
    afternoon: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M17 15.5A5.5 5.5 0 1 1 12.5 7 4.5 4.5 0 0 0 17 15.5Z" />
      </svg>
    `,
    total: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12h14M12 5v14" />
        <circle cx="12" cy="12" r="8.5" />
      </svg>
    `,
    quantity: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 6.5h10A1.5 1.5 0 0 1 18.5 8v10A1.5 1.5 0 0 1 17 19.5H7A1.5 1.5 0 0 1 5.5 18V8A1.5 1.5 0 0 1 7 6.5Z" />
        <path d="M9 10.5h6M9 14h6" />
      </svg>
    `,
    filters: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h16M7 12h10M10 17h4" />
      </svg>
    `,
    quick_sale: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M13 3 6 14h5l-1 7 8-12h-5l1-6Z" />
      </svg>
    `,
    history: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="5" y="4.5" width="14" height="15" rx="2" />
        <path d="M8.5 2.5v4M15.5 2.5v4M8.5 10h7M8.5 13.5h7M8.5 17h4" />
      </svg>
    `,
    calendar: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4.5" y="5.5" width="15" height="14" rx="2" />
        <path d="M8 3.5v4M16 3.5v4M4.5 9.5h15" />
      </svg>
    `,
    clock: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5v5l3.5 2" />
      </svg>
    `,
    refresh: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 11a8 8 0 1 0-2.34 5.66" />
        <path d="M20 4v7h-7" />
      </svg>
    `,
    payment: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.5" y="6" width="17" height="12" rx="2" />
        <path d="M3.5 10h17M7 14.5h3M14.5 14.5h2.5" />
      </svg>
    `,
    search: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4.5 4.5" />
      </svg>
    `,
  };
  return icons[name] || icons.revenue;
}


function renderSalesExecutiveMetric({ label, value, helper, icon, tone = "default", helperTone = "default" }) {
  return `
    <article class="sales-kpi-card sales-kpi-${tone}">
      <div class="sales-kpi-card-top">
        <span class="sales-kpi-icon" aria-hidden="true">${renderSalesIcon(icon)}</span>
        <div class="sales-kpi-card-copy">
          <span class="sales-kpi-label">${escapeHtml(label)}</span>
          <strong class="sales-kpi-value">${escapeHtml(String(value))}</strong>
        </div>
      </div>
      <small class="sales-kpi-helper sales-kpi-helper-${helperTone}">${escapeHtml(helper)}</small>
    </article>
  `;
}


function renderSalesSummaryCard({ label, value, helper, icon, tone = "default" }) {
  return `
    <article class="sales-summary-card sales-summary-${tone}">
      <div class="sales-summary-icon" aria-hidden="true">${renderSalesIcon(icon)}</div>
      <div class="sales-summary-copy">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(String(value))}</strong>
        <small>${escapeHtml(helper)}</small>
      </div>
    </article>
  `;
}


function renderSalesExecutiveHeader() {
  const { period } = getFilteredSalesData();
  const metrics = getSalesHeaderMetrics();

  return `
    <section class="sales-executive-hero">
      <div class="sales-executive-copy">
        <span class="eyebrow">Resumo comercial</span>
        <h2>Bem-vindo de volta!</h2>
        <p>Acompanhe o caixa rápido, o ritmo do dia e os principais indicadores da operação sem sair da aba de vendas.</p>
        <div class="sales-hero-pills">
          <span class="sales-hero-pill"><span aria-hidden="true">${renderSalesIcon("calendar")}</span>Período ativo: ${escapeHtml(period.label)}</span>
          <span class="sales-hero-pill"><span aria-hidden="true">${renderSalesIcon("refresh")}</span>Atualizado agora</span>
        </div>
      </div>
      <div class="sales-kpi-strip">
        ${renderSalesExecutiveMetric({
          label: "Vendas hoje",
          value: formatMoney(metrics.totalToday),
          helper: metrics.trendHelper,
          icon: "revenue",
          tone: "revenue",
          helperTone: "alert",
        })}
        ${renderSalesExecutiveMetric({
          label: "Ticket médio",
          value: formatMoney(metrics.ticketAverage),
          helper: `${formatNumber(metrics.todayCount)} venda(s) no dia`,
          icon: "ticket",
          tone: "ticket",
          helperTone: "soft",
        })}
      </div>
    </section>
  `;
}


function renderSalesFiltersBar() {
  const filter = state.filters.sales;
  const activePeriod = getPeriod("sales");
  const salesPaymentMethods = state.data.options.sales_payment_methods?.length
    ? state.data.options.sales_payment_methods
    : state.data.options.payment_methods;
  const showAdvanced = filter.show_advanced || ["day", "custom", "specific_month"].includes(filter.preset);

  return `
    <section class="panel toolbar-panel sales-filter-panel" data-filter-scope="sales">
      <div class="sales-filter-row">
        <label class="toolbar-field sales-filter-period">
          <span>Período</span>
          <div class="sales-filter-control">
            <span class="sales-filter-field-icon" aria-hidden="true">${renderSalesIcon("calendar")}</span>
            <select name="preset">
              ${[
                { value: "today", label: "Hoje" },
                { value: "day", label: "Dia específico" },
                { value: "yesterday", label: "Ontem" },
                { value: "week", label: "Esta semana" },
                { value: "month", label: "Este mês" },
                { value: "specific_month", label: "Mês específico" },
                { value: "year", label: "Este ano" },
                { value: "custom", label: "Período personalizado" },
              ].map((item) => `
                <option value="${item.value}" ${filter.preset === item.value ? "selected" : ""}>${item.label}</option>
              `).join("")}
            </select>
          </div>
        </label>

        <label class="toolbar-field toolbar-search sales-filter-search">
          <span>Buscar</span>
          <div class="sales-filter-control">
            <span class="sales-filter-field-icon" aria-hidden="true">${renderSalesIcon("search")}</span>
            <input type="search" name="search" value="${escapeHtml(filter.search || "")}" placeholder="Buscar por pagamento, horário, período ou observação">
          </div>
        </label>

        <label class="toolbar-field sales-filter-payment">
          <span>Forma de pagamento</span>
          <div class="sales-filter-control">
            <span class="sales-filter-field-icon" aria-hidden="true">${renderSalesIcon("payment")}</span>
            <select name="payment_method">
              <option value="">Todas</option>
              ${renderPaymentOptions(filter.payment_method || "", salesPaymentMethods)}
            </select>
          </div>
        </label>

        <button
          type="button"
          class="btn btn-secondary sales-filter-toggle"
          data-action="toggle-sales-filters"
          aria-expanded="${showAdvanced ? "true" : "false"}"
        >
          <span class="sales-filter-toggle-icon" aria-hidden="true">${renderSalesIcon("filters")}</span>
          Mais filtros
        </button>
      </div>

      ${showAdvanced ? `
        <div class="sales-filter-advanced">
          ${filter.preset === "day" ? `
            <label class="toolbar-field">
              <span>Dia específico</span>
              <input type="date" name="day" value="${escapeHtml(filter.day || localTodayIso())}">
            </label>
          ` : ""}
          ${filter.preset === "specific_month" ? `
            <label class="toolbar-field sales-filter-specific-month">
              <span>Mês específico</span>
              <select name="specific_month">
                <option value="">Selecione o mês</option>
                ${SALES_MONTH_OPTIONS.map((month) => `
                  <option value="${month.value}" ${String(filter.specific_month || "") === month.value ? "selected" : ""}>${month.label}</option>
                `).join("")}
              </select>
            </label>
          ` : ""}
          ${filter.preset === "custom" ? `
            <label class="toolbar-field">
              <span>Início</span>
              <input type="date" name="start" value="${escapeHtml(filter.start || monthStart)}">
            </label>
            <label class="toolbar-field">
              <span>Fim</span>
              <input type="date" name="end" value="${escapeHtml(filter.end || localTodayIso())}">
            </label>
          ` : ""}
          <div class="sales-filter-chip-row">
            <span class="sales-filter-chip">Período ativo: ${escapeHtml(activePeriod.label)}</span>
            <span class="sales-filter-chip">Pagamento: ${escapeHtml(filter.payment_method || "todas")}</span>
          </div>
        </div>
      ` : ""}
    </section>
  `;
}


function renderSalesMetricsSection() {
  const { period, shiftSummary } = getFilteredSalesData();

  return `
    <section class="sales-summary-grid">
      ${renderSalesSummaryCard({
        label: "Vendas da manhã",
        value: formatMoney(shiftSummary.totalMorning),
        helper: `${shiftSummary.countMorning} venda(s) até 12:00`,
        icon: "morning",
        tone: "morning",
      })}
      ${renderSalesSummaryCard({
        label: "Vendas da tarde",
        value: formatMoney(shiftSummary.totalAfternoon),
        helper: `${shiftSummary.countAfternoon} venda(s) após 12:00`,
        icon: "afternoon",
        tone: "afternoon",
      })}
      ${renderSalesSummaryCard({
        label: "Total do período",
        value: formatMoney(shiftSummary.total),
        helper: period.label,
        icon: "total",
        tone: "total",
      })}
      ${renderSalesSummaryCard({
        label: "Quantidade total",
        value: formatNumber(shiftSummary.count),
        helper: "Histórico filtrado",
        icon: "quantity",
        tone: "count",
      })}
    </section>
  `;
}


function renderSalesHistoryPanel() {
  const { period, sales } = getFilteredSalesData();
  const pagination = paginateRecords(sales, state.filters.sales.page, SALES_HISTORY_PER_PAGE);
  const pagedSales = pagination.items;
  const pageButtons = Array.from({ length: pagination.totalPages }, (_, index) => index + 1)
    .map((page) => `
      <button
        type="button"
        class="btn btn-secondary btn-compact sales-pagination-button ${page === pagination.page ? "active" : ""}"
        data-action="sales-go-page"
        data-page="${page}"
        ${page === pagination.page ? 'aria-current="page"' : ""}
      >
        ${page}
      </button>
    `)
    .join("");

  return `
    <article class="panel sales-history-card">
      <div class="section-header sales-history-header">
        <div class="sales-section-heading-wrap">
          <span class="sales-section-heading-icon sales-section-heading-icon-history" aria-hidden="true">${renderSalesIcon("history")}</span>
          <div>
          <h3>Histórico de vendas</h3>
          <p>${sales.length} registro(s) encontrados em ${period.label.toLowerCase()}.</p>
          </div>
        </div>
        <button type="button" class="btn btn-secondary btn-compact sales-history-link" data-action="show-all-sales-history">Ver todas</button>
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
              ${pagedSales.map((sale) => `
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
        <div class="table-pagination sales-history-pagination">
          <span class="sales-pagination-summary">Página ${pagination.page} de ${pagination.totalPages} • ${pagination.totalItems} venda(s)</span>
          <div class="sales-pagination-controls">
            <button type="button" class="btn btn-secondary btn-compact" data-action="sales-prev-page" ${pagination.page <= 1 ? "disabled" : ""}>Anterior</button>
            <div class="sales-pagination-buttons">
              ${pageButtons}
            </div>
            <button type="button" class="btn btn-secondary btn-compact" data-action="sales-next-page" ${pagination.page >= pagination.totalPages ? "disabled" : ""}>Próxima</button>
          </div>
        </div>
      ` : renderEmptyState("Nenhuma venda encontrada", "Cadastre vendas ou altere o período do filtro.")}
    </article>
  `;
}


function renderSalesInsightsSection() {
  const { period, sales, shiftSummary } = getFilteredSalesData();
  const paymentTotals = getPaymentTotals(sales, "payment_method", "total_amount").map((row) => ({
    ...row,
    helper: `${sales.filter((sale) => sale.payment_method === row.label).length} venda(s)`,
  }));
  const periodDistribution = [
    { label: "Manhã", value: shiftSummary.totalMorning },
    { label: "Tarde", value: shiftSummary.totalAfternoon },
  ];
  const evolutionData = getSalesEvolutionData(sales);

  return `
    <section class="sales-insights-grid">
      ${renderStatList({
        title: "Vendas por forma de pagamento",
        subtitle: `Distribuição do período ${period.label.toLowerCase()}`,
        rows: paymentTotals,
      })}
      ${renderBarChart({
        title: "Vendas por período do dia",
        subtitle: `${shiftSummary.countMorning} venda(s) de manhã e ${shiftSummary.countAfternoon} à tarde`,
        data: periodDistribution,
      })}
      ${renderBarChart({
        title: "Evolução das vendas",
        subtitle: "Últimos dias dentro do filtro atual",
        data: evolutionData,
      })}
    </section>
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
    <div class="table-wrapper quotes-list-table-wrapper">
      <table class="data-table quotes-list-table">
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
              <td>
                <strong>${escapeHtml(quote.customer_name)}</strong>
                <small>${escapeHtml(summarizeQuoteItems(quote) || "Sem itens")}</small>
              </td>
              <td>${renderBadge(quote.status, statusTone(quote.status))}</td>
              <td>${formatMoney(quote.total_amount)}</td>
              <td>${formatNumber(quote.items?.length || 0)} item(ns)</td>
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
    ["description", "payment_method"],
    state.filters.expenses.search,
  );
  const topExpenses = [...filteredExpenses]
    .sort((left, right) => Number(right.amount || 0) - Number(left.amount || 0))
    .slice(0, 6)
    .map((expense) => ({
      label: expense.description,
      value: expense.amount,
      helper: `${formatDate(expense.payment_date)} • ${expense.payment_method}`,
    }));

  return {
    period,
    filteredExpenses,
    byPayment: getPaymentTotals(filteredExpenses, "payment_method", "amount"),
    recentExpenses: sortByDateDesc(filteredExpenses, "payment_date").slice(0, 6),
    topExpenses,
  };
}


function renderExpensesInsightsSection() {
  const { period, byPayment, topExpenses } = getFilteredExpensesData();

  return `
    <section class="dashboard-grid">
      ${renderBarChart({ title: "Despesas por dia", subtitle: "Últimos 7 dias", data: groupByDay(state.data.expenses, "payment_date", (expense) => expense.amount, 7) })}
      ${renderBarChart({ title: "Despesas por mês", subtitle: "Últimos 6 meses", data: groupByMonth(state.data.expenses, "payment_date", (expense) => expense.amount, 6) })}
      ${renderStatList({ title: "Totais por pagamento", subtitle: period.label, rows: byPayment })}
      ${renderStatList({ title: "Maiores despesas", subtitle: period.label, rows: topExpenses })}
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
                <th>Pagamento</th>
                <th>Valor</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${recentExpenses.map((expense) => `
                <tr>
                  <td>${formatDate(expense.payment_date)}</td>
                  <td><strong>${escapeHtml(expense.description)}</strong></td>
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
  if (bill.is_paid) {
    return `
      <span class="bill-payment-state is-complete">
        <span class="bill-payment-state-icon" aria-hidden="true">✓</span>
        <span>Pago</span>
      </span>
    `;
  }

  return `
    <button
      type="button"
      class="bill-payment-toggle"
      data-action="request-bill-paid-confirmation"
      data-id="${bill.id}"
      role="checkbox"
      aria-checked="false"
      aria-label="Marcar como pago"
    >
      <span class="bill-payment-toggle-box" aria-hidden="true"></span>
      <span>Marcar como pago</span>
    </button>
  `;
}


function renderBillCardActions(id) {
  return `
    <div class="checks-row-actions">
      <button type="button" class="checks-icon-action" data-action="edit-bill" data-id="${id}" title="Editar boleto" aria-label="Editar boleto">
        ${renderChecksPageIcon("edit")}
      </button>
      <button type="button" class="checks-icon-action is-danger" data-action="delete-bill" data-id="${id}" title="Excluir boleto" aria-label="Excluir boleto">
        ${renderChecksPageIcon("trash")}
      </button>
    </div>
  `;
}


function getBillCardState(bill) {
  if (bill.is_paid) {
    return {
      cardClass: "is-paid",
      label: "Pagamento confirmado",
      helper: "Quitado no sistema",
    };
  }

  if (bill.is_overdue) {
    return {
      cardClass: "is-overdue",
      label: "Boleto vencido",
      helper: `${formatNumber(bill.days_overdue)} dia(s) de atraso`,
    };
  }

  if (bill.is_due_today) {
    return {
      cardClass: "is-due-today",
      label: "Vence hoje",
      helper: "Requer atenção imediata",
    };
  }

  return {
    cardClass: "is-pending",
    label: "Em acompanhamento",
    helper: "Pagamento pendente",
  };
}


function renderCheckCompensatedToggle(check) {
  const isCompensated = check.effective_status === "Compensado" || check.status === "Compensado";
  const isCancelled = check.effective_status === "Cancelado" || check.status === "Cancelado";

  if (isCompensated) {
    return `
      <span class="check-compensation-state is-complete">
        <span class="check-compensation-state-icon" aria-hidden="true">✓</span>
        <span>Compensado</span>
      </span>
    `;
  }

  if (isCancelled) {
    return `
      <span class="check-compensation-state is-neutral">
        <span>Cancelado</span>
      </span>
    `;
  }

  return `
    <button type="button" class="check-compensation-button" data-action="mark-check-compensated" data-id="${check.id}">
      <span class="check-compensation-button-icon" aria-hidden="true">✓</span>
      <span>Marcar compensado</span>
    </button>
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
  const pagination = paginateRecords(filteredBills, state.filters.bills.page, BILLS_CARDS_PER_PAGE);
  state.filters.bills.page = pagination.page;
  const pagedBills = pagination.items;
  const tokens = buildPaginationTokens(pagination.page, pagination.totalPages);
  const startRecord = filteredBills.length ? ((pagination.page - 1) * BILLS_CARDS_PER_PAGE) + 1 : 0;
  const endRecord = filteredBills.length ? startRecord + pagedBills.length - 1 : 0;

  return `
    <article class="checks-studio-card checks-list-card bills-board-panel">
      <div class="checks-card-title-row">
        <div>
          <h3>Boletos cadastrados</h3>
          <p>${formatNumber(filteredBills.length)} boleto(s) no período selecionado</p>
        </div>
        <span>${BILLS_CARDS_PER_PAGE} por página</span>
      </div>
      ${filteredBills.length ? `
        <div class="bills-board-grid">
          ${pagedBills.map((bill) => {
            const cardState = getBillCardState(bill);
            return `
              <article class="bill-card ${cardState.cardClass}">
                <div class="bill-card-top">
                  <div class="bill-card-title">
                    <span class="bill-card-kicker">${escapeHtml(cardState.label)}</span>
                    <strong>${escapeHtml(bill.beneficiary)}</strong>
                  </div>
                  <div class="bill-card-status">
                    ${renderBadge(bill.effective_status, statusTone(bill.effective_status))}
                  </div>
                </div>
                <div class="bill-card-meta">
                  <div class="bill-card-meta-item">
                    <span>Vencimento</span>
                    <strong>${formatDate(bill.due_date)}</strong>
                  </div>
                  <div class="bill-card-meta-item">
                    <span>Valor</span>
                    <strong>${formatMoney(bill.amount)}</strong>
                  </div>
                  <div class="bill-card-meta-item bill-card-meta-item-wide">
                    <span>Status do acompanhamento</span>
                    <strong>${escapeHtml(cardState.helper)}</strong>
                  </div>
                </div>
                ${bill.notes ? `
                  <div class="bill-card-notes">
                    <span>Observações</span>
                    <p>${escapeHtml(bill.notes)}</p>
                  </div>
                ` : ""}
                <div class="bill-card-footer">
                  <div class="bill-card-payment">
                    ${renderBillPaidToggle(bill)}
                  </div>
                  ${renderBillCardActions(bill.id)}
                </div>
              </article>
            `;
          }).join("")}
        </div>
        <div class="table-pagination checks-table-pagination bills-board-pagination">
          <div class="checks-pagination-summary">
            Mostrando ${formatNumber(startRecord)} a ${formatNumber(endRecord)} de ${formatNumber(filteredBills.length)} registros
          </div>
          <div class="checks-pagination-controls">
            <button
              type="button"
              class="table-action checks-pagination-nav"
              data-action="bills-prev-page"
              ${pagination.page <= 1 ? "disabled" : ""}
            >
              Anterior
            </button>
            <div class="checks-pagination-pages" aria-label="Paginação de boletos">
              ${tokens.map((token) => (token === "..."
                ? `<span class="checks-pagination-ellipsis">...</span>`
                : `
                  <button
                    type="button"
                    class="checks-pagination-page ${Number(token) === pagination.page ? "is-active" : ""}"
                    data-action="bills-go-page"
                    data-page="${token}"
                  >
                    ${token}
                  </button>
                `
              )).join("")}
            </div>
            <button
              type="button"
              class="table-action checks-pagination-nav"
              data-action="bills-next-page"
              ${pagination.page >= pagination.totalPages ? "disabled" : ""}
            >
              Próxima
            </button>
          </div>
        </div>
      ` : renderEmptyState("Nenhum boleto encontrado", "Cadastre um boleto ou ajuste os filtros da tela.")}
    </article>
  `;
}


const CHECK_QUICK_FILTERS = [
  { value: "all", label: "Todos" },
  { value: "due_today", label: "Vencendo hoje" },
  { value: "future_pending", label: "Pendentes futuros" },
  { value: "overdue", label: "Atrasados" },
  { value: "compensated", label: "Compensados" },
  { value: "payable", label: "A pagar" },
];


function normalizeDateOnly(value = "") {
  return String(value || "").slice(0, 10);
}


function getCheckSituation(check, today = localTodayIso()) {
  const dueDate = normalizeDateOnly(check?.due_date);
  const rawStatus = String(check?.status || "").trim().toLowerCase();
  const effectiveStatus = String(check?.effective_status || "").trim().toLowerCase();
  const isCompensated = rawStatus === "compensado" || effectiveStatus === "compensado";
  const isCancelled = rawStatus === "cancelado" || effectiveStatus === "cancelado";

  if (isCompensated) {
    return {
      key: "compensated",
      label: "COMPENSADO",
      summaryLabel: "Compensados",
      isPayable: false,
      tone: "success",
      rowClass: "",
    };
  }

  if (isCancelled) {
    return {
      key: "cancelled",
      label: "CANCELADO",
      summaryLabel: "Cancelados",
      isPayable: false,
      tone: "neutral",
      rowClass: "",
    };
  }

  if (dueDate && dueDate < today) {
    return {
      key: "overdue",
      label: "ATRASADO",
      summaryLabel: "Atrasados",
      isPayable: true,
      tone: "danger",
      rowClass: "row-danger",
    };
  }

  if (dueDate && dueDate === today) {
    return {
      key: "due_today",
      label: "EM ABERTO",
      summaryLabel: "Vencendo hoje",
      isPayable: true,
      tone: "warning",
      rowClass: "row-warning",
    };
  }

  return {
    key: "future_pending",
    label: "EM ABERTO",
    summaryLabel: "Pendentes futuros",
    isPayable: true,
    tone: "warning",
    rowClass: "",
  };
}


function matchesCheckStatus(check, statusFilter, today = localTodayIso()) {
  if (!statusFilter) return true;

  const situation = getCheckSituation(check, today);
  const normalizedFilter = String(statusFilter || "").trim().toLowerCase();
  const normalizedStatus = String(check?.status || "").trim().toLowerCase();
  const normalizedEffectiveStatus = String(check?.effective_status || "").trim().toLowerCase();

  if (normalizedFilter === "pendente") {
    return situation.isPayable;
  }

  if (normalizedFilter === "atrasado") {
    return situation.key === "overdue" || normalizedStatus === "atrasado" || normalizedEffectiveStatus === "atrasado";
  }

  if (normalizedFilter === "compensado") {
    return situation.key === "compensated";
  }

  if (normalizedFilter === "cancelado") {
    return situation.key === "cancelled";
  }

  if (normalizedFilter === "vencendo hoje") {
    return situation.key === "due_today";
  }

  return normalizedStatus === normalizedFilter
    || normalizedEffectiveStatus === normalizedFilter
    || situation.summaryLabel.toLowerCase() === normalizedFilter
    || situation.label.toLowerCase() === normalizedFilter;
}


function matchesCheckQuickFilter(check, quickFilter, today = localTodayIso()) {
  const activeFilter = quickFilter || "all";
  if (activeFilter === "all") return true;

  const situation = getCheckSituation(check, today);

  if (activeFilter === "payable") {
    return situation.isPayable;
  }

  return situation.key === activeFilter;
}


function buildCheckSituationSummary(checks, today = localTodayIso()) {
  const summary = {
    dueTodayChecks: [],
    futurePendingChecks: [],
    overdueChecks: [],
    compensatedChecks: [],
    payableChecks: [],
    cancelledChecks: [],
  };

  checks.forEach((check) => {
    const situation = getCheckSituation(check, today);
    if (situation.key === "due_today") summary.dueTodayChecks.push(check);
    if (situation.key === "future_pending") summary.futurePendingChecks.push(check);
    if (situation.key === "overdue") summary.overdueChecks.push(check);
    if (situation.key === "compensated") summary.compensatedChecks.push(check);
    if (situation.key === "cancelled") summary.cancelledChecks.push(check);
    if (situation.isPayable) summary.payableChecks.push(check);
  });

  return summary;
}


function getFilteredChecksData() {
  const period = getPeriod("checks");
  const checksInPeriod = filterByPeriod(state.data.checks, "due_date", period);
  const today = localTodayIso();
  const searchedChecks = getSimpleSearchRecords(
    [...checksInPeriod],
    ["check_number", "beneficiary", "notes"],
    state.filters.checks.search,
  );
  const statusFilteredChecks = searchedChecks.filter((check) => matchesCheckStatus(check, state.filters.checks.status, today));
  const filteredChecks = statusFilteredChecks.filter((check) => matchesCheckQuickFilter(check, state.filters.checks.quick_filter, today));
  const summary = buildCheckSituationSummary(filteredChecks, today);

  return {
    period,
    today,
    checksInPeriod,
    searchedChecks,
    statusFilteredChecks,
    filteredChecks,
    dueTodayChecks: summary.dueTodayChecks,
    futurePendingChecks: summary.futurePendingChecks,
    overdueChecks: summary.overdueChecks,
    compensatedChecks: summary.compensatedChecks,
    payableChecks: summary.payableChecks,
    cancelledChecks: summary.cancelledChecks,
  };
}


function renderChecksMetricsSection() {
  const {
    dueTodayChecks,
    futurePendingChecks,
    overdueChecks,
    compensatedChecks,
    payableChecks,
  } = getFilteredChecksData();
  const metrics = [
    {
      label: "Vencendo hoje",
      value: formatMoney(sumBy(dueTodayChecks, (check) => check.amount)),
      helper: `${dueTodayChecks.length} registro(s)`,
      tone: "check-due-today",
    },
    {
      label: "Pendentes futuros",
      value: formatMoney(sumBy(futurePendingChecks, (check) => check.amount)),
      helper: `${futurePendingChecks.length} registro(s)`,
      tone: "check-future-pending",
    },
    {
      label: "Atrasados",
      value: formatMoney(sumBy(overdueChecks, (check) => check.amount)),
      helper: `${overdueChecks.length} registro(s)`,
      tone: "check-overdue",
    },
    {
      label: "Compensados",
      value: formatMoney(sumBy(compensatedChecks, (check) => check.amount)),
      helper: `${compensatedChecks.length} registro(s)`,
      tone: "check-compensated",
    },
    {
      label: "Total a pagar",
      value: formatMoney(sumBy(payableChecks, (check) => check.amount)),
      helper: `${payableChecks.length} registro(s) em aberto`,
      tone: "check-total-payable",
    },
  ];

  return `
    <section class="metrics-grid ${getMetricsGridClass(metrics.length)}">
      ${metrics.map((metric) => renderMetricCard(metric)).join("")}
    </section>
  `;
}


function renderChecksPageIcon(name) {
  const icons = {
    menu: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 7h14"></path>
        <path d="M5 12h14"></path>
        <path d="M5 17h14"></path>
      </svg>
    `,
    file: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3.5h7l3 3v14H7z"></path>
        <path d="M14 3.5v4h4"></path>
        <path d="M9.5 12h5"></path>
        <path d="M9.5 15.5h5"></path>
      </svg>
    `,
    money: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4v16"></path>
        <path d="M16 7.5c-.8-1-2.1-1.5-3.8-1.5-2 0-3.4.9-3.4 2.4 0 3.5 7.2 1.6 7.2 5.7 0 1.7-1.5 3-4 3-1.7 0-3.2-.5-4.2-1.7"></path>
      </svg>
    `,
    warning: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 3.5 9 16H3z"></path>
        <path d="M12 8.5v5"></path>
        <path d="M12 17h.01"></path>
      </svg>
    `,
    check: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 6 9 17l-5-5"></path>
      </svg>
    `,
    user: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="3.5"></circle>
        <path d="M5 20c1.2-3.5 3.6-5.2 7-5.2s5.8 1.7 7 5.2"></path>
      </svg>
    `,
    plus: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5v14"></path>
        <path d="M5 12h14"></path>
      </svg>
    `,
    clean: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m4 16 8-8 4 4-8 8H4z"></path>
        <path d="m14 6 4 4"></path>
      </svg>
    `,
    save: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 4h12l2 2v14H5z"></path>
        <path d="M8 4v6h8V4"></path>
        <path d="M8 17h8"></path>
      </svg>
    `,
    print: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 8V4h10v4"></path>
        <path d="M7 17H5a2 2 0 0 1-2-2v-4h18v4a2 2 0 0 1-2 2h-2"></path>
        <path d="M7 14h10v6H7z"></path>
      </svg>
    `,
    edit: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20h4l11-11-4-4L4 16z"></path>
        <path d="m13.5 6.5 4 4"></path>
      </svg>
    `,
    trash: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h16"></path>
        <path d="M10 11v6"></path>
        <path d="M14 11v6"></path>
        <path d="M6 7l1 14h10l1-14"></path>
        <path d="M9 7V4h6v3"></path>
      </svg>
    `,
  };

  return icons[name] || icons.file;
}


function renderChecksStudioMetric({ icon, label, value, helper, tone = "brand" }) {
  return `
    <article class="checks-studio-metric checks-studio-metric-${tone}">
      <span class="checks-studio-metric-icon" aria-hidden="true">${renderChecksPageIcon(icon)}</span>
      <div>
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
        <small>${escapeHtml(helper)}</small>
      </div>
    </article>
  `;
}


function renderChecksStudioMetrics() {
  const { filteredChecks, payableChecks, overdueChecks, compensatedChecks } = getFilteredChecksData();
  const payableTotal = sumBy(payableChecks, (check) => check.amount);
  const overdueTotal = sumBy(overdueChecks, (check) => check.amount);
  const compensatedTotal = sumBy(compensatedChecks, (check) => check.amount);

  const metrics = [
    {
      icon: "file",
      label: "Cheques",
      value: formatNumber(filteredChecks.length),
      helper: "Quantidade total",
      tone: "items",
    },
    {
      icon: "money",
      label: "Em aberto",
      value: formatMoney(payableTotal),
      helper: "Ainda não compensados",
      tone: "open",
    },
    {
      icon: "warning",
      label: "Atrasados",
      value: formatMoney(overdueTotal),
      helper: "Vencidos no período",
      tone: "overdue",
    },
    {
      icon: "check",
      label: "Compensados",
      value: formatMoney(compensatedTotal),
      helper: "Baixados no sistema",
      tone: "done",
    },
  ];

  return `
    <section class="checks-studio-metrics">
      ${metrics.map((metric) => renderChecksStudioMetric(metric)).join("")}
    </section>
  `;
}


function renderCheckRowActions(id) {
  return `
    <div class="checks-row-actions">
      <button type="button" class="checks-icon-action" data-action="edit-check" data-id="${id}" title="Editar cheque" aria-label="Editar cheque">
        ${renderChecksPageIcon("edit")}
      </button>
      <button type="button" class="checks-icon-action is-danger" data-action="delete-check" data-id="${id}" title="Excluir cheque" aria-label="Excluir cheque">
        ${renderChecksPageIcon("trash")}
      </button>
    </div>
  `;
}


function renderChecksSummaryCard() {
  const { filteredChecks, payableChecks, overdueChecks, compensatedChecks } = getFilteredChecksData();
  const totalAmount = sumBy(filteredChecks, (check) => check.amount);
  const payableTotal = sumBy(payableChecks, (check) => check.amount);
  const overdueTotal = sumBy(overdueChecks, (check) => check.amount);
  const compensatedTotal = sumBy(compensatedChecks, (check) => check.amount);

  return `
    <aside class="checks-studio-card checks-summary-card">
      <h3>Resumo de cheques</h3>
      <div class="checks-summary-lines">
        <div>
          <span>Total cadastrado</span>
          <strong>${formatMoney(totalAmount)}</strong>
        </div>
        <div>
          <span>Em aberto</span>
          <strong>${formatMoney(payableTotal)}</strong>
        </div>
        <div class="is-warning">
          <span>Atrasados</span>
          <strong>${formatMoney(overdueTotal)}</strong>
        </div>
        <div>
          <span>Compensados</span>
          <strong>${formatMoney(compensatedTotal)}</strong>
        </div>
      </div>
      <div class="checks-summary-total">
        <span>TOTAL GERAL</span>
        <strong>${formatMoney(totalAmount)}</strong>
      </div>
    </aside>
  `;
}


function renderChecksDashboardSection() {
  const {
    filteredChecks,
  } = getFilteredChecksData();

  return `
    <section class="dashboard-grid">
      ${renderBarChart({ title: "Cheques por semana", subtitle: "Agrupado pela data prevista", data: groupByWeek(filteredChecks, "due_date", (check) => check.amount, 8) })}
      ${renderBarChart({ title: "Cheques por mês", subtitle: "Agrupado pela data prevista", data: groupByMonth(filteredChecks, "due_date", (check) => check.amount, 6) })}
    </section>
  `;
}


function renderChecksQuickFilters() {
  const activeFilter = state.filters.checks.quick_filter || "all";
  return `
    <section class="checks-quick-filters" aria-label="Filtros rápidos de cheques">
      ${CHECK_QUICK_FILTERS.map((filter) => `
        <button
          type="button"
          class="checks-filter-chip ${activeFilter === filter.value ? "active" : ""}"
          data-action="checks-quick-filter"
          data-filter-value="${filter.value}"
        >
          ${escapeHtml(filter.label)}
        </button>
      `).join("")}
    </section>
  `;
}


function getChecksYearOptions() {
  const currentYear = new Date().getFullYear();
  const years = new Set([currentYear, currentYear - 1, currentYear + 1]);

  state.data.checks.forEach((check) => {
    const year = Number(String(check.due_date || "").slice(0, 4));
    if (Number.isInteger(year) && year > 1900) {
      years.add(year);
    }
  });

  return [...years].sort((left, right) => right - left);
}


function renderChecksListFilters() {
  const filter = state.filters.checks;
  const checkStatusFilters = Array.from(new Set([
    ...(state.data.options.check_statuses || []),
    "Vencendo hoje",
  ]));
  const presets = [
    { value: "today", label: "Hoje" },
    { value: "yesterday", label: "Ontem" },
    { value: "specific_month", label: "Mês específico" },
    { value: "specific_year", label: "Ano específico" },
    { value: "custom", label: "Período personalizado" },
    { value: "all", label: "Todos" },
  ];
  const activePreset = presets.some((item) => item.value === filter.preset) ? filter.preset : "all";

  return `
    <section class="checks-list-filters" data-filter-scope="checks">
      <label class="toolbar-field">
        <span>Filtro</span>
        <select name="preset">
          ${presets.map((item) => `
            <option value="${item.value}" ${activePreset === item.value ? "selected" : ""}>${item.label}</option>
          `).join("")}
        </select>
      </label>

      ${activePreset === "specific_month" ? `
        <label class="toolbar-field">
          <span>Mês</span>
          <select name="specific_month">
            ${SALES_MONTH_OPTIONS.map((item) => `
              <option value="${item.value}" ${String(filter.specific_month || "") === item.value ? "selected" : ""}>${item.label}</option>
            `).join("")}
          </select>
        </label>
      ` : ""}

      ${activePreset === "specific_year" ? `
        <label class="toolbar-field">
          <span>Ano</span>
          <select name="specific_year">
            ${getChecksYearOptions().map((year) => `
              <option value="${year}" ${String(filter.specific_year || "") === String(year) ? "selected" : ""}>${year}</option>
            `).join("")}
          </select>
        </label>
      ` : ""}

      ${activePreset === "custom" ? `
        ${renderToolbarDateField({
          label: "Início",
          name: "start",
          value: filter.start,
          manual: true,
        })}
        ${renderToolbarDateField({
          label: "Fim",
          name: "end",
          value: filter.end,
          manual: true,
        })}
      ` : ""}

      <label class="toolbar-field toolbar-search">
        <span>Busca</span>
        <input type="search" name="search" value="${escapeHtml(filter.search || "")}" placeholder="Buscar por nº, emitente ou observação">
      </label>

      <label class="toolbar-field">
        <span>Status</span>
        <select name="status">
          <option value="">Todos</option>
          ${checkStatusFilters.map((status) => `
            <option value="${status}" ${filter.status === status ? "selected" : ""}>${status}</option>
          `).join("")}
        </select>
      </label>
    </section>
  `;
}


function renderChecksListPanel() {
  const { filteredChecks } = getFilteredChecksData();
  const pagination = paginateRecords(filteredChecks, state.filters.checks.page, 10);
  state.filters.checks.page = pagination.page;
  const pagedChecks = pagination.items;
  const tokens = buildPaginationTokens(pagination.page, pagination.totalPages);
  const startRecord = filteredChecks.length ? ((pagination.page - 1) * 10) + 1 : 0;
  const endRecord = filteredChecks.length ? startRecord + pagedChecks.length - 1 : 0;

  return `
    <article class="checks-studio-card checks-list-card">
      <div class="checks-card-title-row">
        <div>
          <h3>Cheques cadastrados</h3>
          <p>${formatNumber(filteredChecks.length)} cheque(s) no período selecionado</p>
        </div>
        <span>10 por página</span>
      </div>
      ${renderChecksListFilters()}
      ${filteredChecks.length ? `
        <div class="table-wrapper checks-table-wrapper">
          <table class="data-table checks-data-table">
            <thead>
              <tr>
                <th>Nº Cheque</th>
                <th>Emitente / Cliente</th>
                <th>Valor</th>
                <th>Vencimento</th>
                <th>Status</th>
                <th>Compensação</th>
                <th>Resumo</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              ${pagedChecks.map((check) => {
                const situation = getCheckSituation(check);
                return `
                <tr class="${situation.rowClass}">
                  <td>${escapeHtml(check.check_number)}</td>
                  <td>
                    <strong>${escapeHtml(check.beneficiary)}</strong>
                  </td>
                  <td class="checks-cell-money">${formatMoney(check.amount)}</td>
                  <td class="checks-cell-date">${formatDate(check.due_date)}</td>
                  <td class="checks-cell-status"><span class="badge check-status-badge check-status-${situation.key}">${escapeHtml(situation.label)}</span></td>
                  <td class="checks-cell-compensation">${renderCheckCompensatedToggle(check)}</td>
                  <td class="checks-cell-summary">
                    <small><strong>Em aberto:</strong> ${formatNumber(check.days_pending)} dias</small>
                    <small><strong>Atraso:</strong> ${formatNumber(check.days_overdue)} dias</small>
                  </td>
                  <td class="checks-cell-actions">${renderCheckRowActions(check.id)}</td>
                </tr>
              `;
              }).join("")}
            </tbody>
          </table>
        </div>
        <div class="table-pagination checks-table-pagination">
          <div class="checks-pagination-summary">
            Mostrando ${formatNumber(startRecord)} a ${formatNumber(endRecord)} de ${formatNumber(filteredChecks.length)} registros
          </div>
          <div class="checks-pagination-controls">
            <button
              type="button"
              class="table-action checks-pagination-nav"
              data-action="checks-prev-page"
              ${pagination.page <= 1 ? "disabled" : ""}
            >
              Anterior
            </button>
            <div class="checks-pagination-pages" aria-label="Paginação de cheques">
              ${tokens.map((token) => (token === "..."
                ? `<span class="checks-pagination-ellipsis">...</span>`
                : `
                  <button
                    type="button"
                    class="checks-pagination-page ${Number(token) === pagination.page ? "is-active" : ""}"
                    data-action="checks-go-page"
                    data-page="${token}"
                  >
                    ${token}
                  </button>
                `
              )).join("")}
            </div>
            <button
              type="button"
              class="table-action checks-pagination-nav"
              data-action="checks-next-page"
              ${pagination.page >= pagination.totalPages ? "disabled" : ""}
            >
              Próxima
            </button>
          </div>
        </div>
      ` : renderEmptyState("Nenhum cheque encontrado", "Cadastre um cheque ou ajuste o período e o status.")}
    </article>
  `;
}


function renderProductsPage() {
  const filter = state.filters.products;
  const editing = state.editing.products;
  const categories = [...new Set(state.data.products.map((product) => product.category).filter(Boolean))].sort();
  const activeProducts = getActiveProducts();
  const totalSaleValue = sumBy(activeProducts, (product) => product.stock_quantity * product.sale_price);
  const lowStockCount = activeProducts.filter((product) => product.low_stock).length;
  const inactiveCount = state.data.products.filter((product) => product.active === false).length;
  const currentMargin = calculateProductMarginPercent(editing?.cost_price ?? 0, editing?.sale_price ?? 0);
  const showAdvancedFilters = Boolean(
    filter.show_advanced
    || filter.stock_filter
    || filter.price_min !== ""
    || filter.price_max !== ""
  );
  const duplicateSku = String(editing?.sku || editing?.code || "").trim().toLowerCase();
  const hasDuplicateSku = Boolean(
    duplicateSku
    && state.data.products.some((product) => (
      String(product.id) !== String(editing?.id ?? "")
      && String(product.sku || product.code || "").trim().toLowerCase() === duplicateSku
    )),
  );
  const defaultPerPage = Number(filter.per_page || PRODUCTS_PER_PAGE);
  const resetButtonLabel = editing ? "Salvar alterações" : "Salvar produto";

  return `
    <section class="products-hero">
      <div class="products-hero-copy">
        <span class="eyebrow">Catálogo comercial e fiscal</span>
        <h2>Cadastro de produtos</h2>
          <p>Catálogo técnico com SKU, estoque, dados fiscais, importação em planilha e filtros inteligentes para a rotina da loja.</p>
          <div class="products-hero-highlights">
            <span class="products-hero-pill">${formatNumber(state.data.products.length)} produto(s) cadastrados</span>
            <span class="products-hero-pill">${formatNumber(categories.length)} categoria(s) cadastrada(s)</span>
            <span class="products-hero-pill">${formatNumber(defaultPerPage)} itens por página</span>
          </div>
      </div>
      <div class="products-hero-actions">
        <a class="btn btn-secondary products-hero-action" href="/api/products/export?format=csv" target="_blank" rel="noreferrer">
          <span aria-hidden="true">${renderProductsIcon("csv")}</span>
          <span>Exportar CSV</span>
        </a>
        <a class="btn btn-secondary products-hero-action" href="/api/products/export?format=xlsx" target="_blank" rel="noreferrer">
          <span aria-hidden="true">${renderProductsIcon("excel")}</span>
          <span>Exportar Excel</span>
        </a>
      </div>
    </section>

    <section class="products-overview-grid">
      ${renderProductsOverviewCard({
        icon: "active",
        eyebrow: "Produtos ativos",
        value: formatNumber(activeProducts.length),
        helper: "Base operacional pronta para venda",
        tone: "default",
      })}
      ${renderProductsOverviewCard({
        icon: "inactive",
        eyebrow: "Inativos",
        value: formatNumber(inactiveCount),
        helper: "Itens pausados ou fora do mix",
        tone: "soft",
      })}
      ${renderProductsOverviewCard({
        icon: "warning",
        eyebrow: "Estoque baixo",
        value: formatNumber(lowStockCount),
        helper: "Produtos abaixo do mínimo definido",
        tone: "warning",
      })}
      ${renderProductsOverviewCard({
        icon: "money",
        eyebrow: "Valor de venda em estoque",
        value: formatMoney(totalSaleValue),
        helper: "Estimativa pelo preço de venda atual",
        tone: "brand",
      })}
    </section>

    <section class="products-main-grid">
      <article class="panel products-form-card">
        <div class="products-panel-header">
          <div>
            <h3>${editing ? "Editar produto" : "Novo produto"}</h3>
            <p>${editing ? "Ajuste dados comerciais, estoque e fiscal do item selecionado." : "Cadastre SKU, preços, estoque mínimo e informações fiscais do produto."}</p>
          </div>
        </div>

        <form id="products-form" class="products-form-grid" data-product-price-mode="${editing ? "sale" : "margin"}">
          <input type="hidden" name="id" value="${editing?.id ?? ""}">
          ${renderFormFeedback("products")}

          <section class="products-form-section">
            <div class="products-form-section-head">
              <div class="products-form-section-icon" aria-hidden="true">${renderProductsIcon("basic")}</div>
              <div>
                <h4>Dados básicos</h4>
                <p>Identificação comercial e descrição do produto.</p>
              </div>
            </div>
            <div class="products-form-section-grid products-form-section-grid-basic">
              <label>
                <span>SKU <b class="required-mark">*</b></span>
                <input type="text" name="sku" value="${escapeHtml(toFormValue(editing?.sku || editing?.code))}" placeholder="Ex.: MAT-001" required>
                ${hasDuplicateSku ? '<small class="field-hint danger">Já existe um produto com este SKU.</small>' : '<small class="field-hint">Código interno usado para busca rápida e importação.</small>'}
              </label>
              <label>
                <span>Categoria <b class="required-mark">*</b></span>
                <input type="text" name="category" list="products-category-suggestions" value="${escapeHtml(toFormValue(editing?.category))}" placeholder="Ex.: Cimentos" required>
              </label>
              <label>
                <span>Unidade <b class="required-mark">*</b></span>
                <select name="unit" required>
                  ${(state.data.options.product_units || ["UN"]).map((unit) => `
                    <option value="${unit}" ${String(editing?.unit || "UN") === unit ? "selected" : ""}>${unit}</option>
                  `).join("")}
                </select>
              </label>
              <label class="field-span-3">
                <span>Nome do produto <b class="required-mark">*</b></span>
                <input type="text" name="name" value="${escapeHtml(toFormValue(editing?.name))}" placeholder="Ex.: Argamassa AC-III 20kg" required>
              </label>
              <label class="field-span-3">
                <span>Descrição curta</span>
                <textarea name="description" rows="3" placeholder="Descrição rápida para facilitar consultas e NF-e.">${escapeHtml(toFormValue(editing?.description))}</textarea>
              </label>
            </div>
            <datalist id="products-category-suggestions">
              ${categories.map((category) => `<option value="${escapeHtml(category)}"></option>`).join("")}
            </datalist>
          </section>

          <section class="products-form-section">
            <div class="products-form-section-head">
              <div class="products-form-section-icon products-form-section-icon-accent" aria-hidden="true">${renderProductsIcon("pricing")}</div>
              <div>
                <h4>Valores</h4>
                <p>Defina custo, margem e venda com cálculo automático.</p>
              </div>
            </div>
            <div class="products-form-section-grid products-form-section-grid-values">
              <label>
                <span>Preço de custo <b class="required-mark">*</b></span>
                ${renderMoneyInput({ name: "cost_price", value: editing?.cost_price ?? 0, required: true })}
              </label>
              <label>
                <span>Margem (%)</span>
                <input type="text" name="margin_percent" inputmode="decimal" value="${escapeHtml(formatDecimalInput(currentMargin, 2))}" placeholder="Ex.: 35">
                <small class="field-hint">Ao alterar a margem, o preço de venda é recalculado automaticamente.</small>
              </label>
              <label>
                <span>Preço de venda <b class="required-mark">*</b></span>
                ${renderMoneyInput({ name: "sale_price", value: editing?.sale_price ?? 0, required: true })}
                <small class="field-hint">Se você editar manualmente a venda, a margem será ajustada para refletir o novo valor.</small>
              </label>
            </div>
          </section>

          <section class="products-form-section">
            <div class="products-form-section-head">
              <div class="products-form-section-icon products-form-section-icon-soft" aria-hidden="true">${renderProductsIcon("fiscal")}</div>
              <div>
                <h4>Informações fiscais</h4>
                <p>Base para emissão de NF-e e organização tributária.</p>
              </div>
            </div>
            <div class="products-form-section-grid products-form-section-grid-fiscal">
              <label>
                <span>NCM</span>
                <input type="text" name="ncm" value="${escapeHtml(toFormValue(editing?.ncm))}" placeholder="Ex.: 25232910">
              </label>
              <label>
                <span>CFOP padrão</span>
                <input type="text" name="cfop_default" value="${escapeHtml(toFormValue(editing?.cfop_default))}" placeholder="Ex.: 5102">
              </label>
              <label>
                <span>CSOSN</span>
                <select name="csosn">
                  ${renderProductCsosnOptions(editing?.csosn || "")}
                </select>
              </label>
              <label class="field-span-3">
                <span>Origem</span>
                <select name="origin">
                  ${renderProductOriginOptions(editing?.origin || "")}
                </select>
              </label>
            </div>
          </section>

          <section class="products-form-section">
            <div class="products-form-section-head">
              <div class="products-form-section-icon" aria-hidden="true">${renderProductsIcon("warning")}</div>
              <div>
                <h4>Estoque e operação</h4>
                <p>Controle operacional e observações internas do cadastro.</p>
              </div>
            </div>
            <div class="products-form-section-grid products-form-section-grid-stock">
              <label>
                <span>Quantidade em estoque <b class="required-mark">*</b></span>
                <input type="number" name="stock_quantity" min="0" step="0.01" value="${editing?.stock_quantity ?? 0}" required>
              </label>
              <label>
                <span>Estoque mínimo <b class="required-mark">*</b></span>
                <input type="number" name="min_stock" min="0" step="0.01" value="${editing?.min_stock ?? 0}" required>
              </label>
              <label>
                <span>Status</span>
                <select name="active">
                  <option value="true" ${(editing?.active ?? true) ? "selected" : ""}>Ativo</option>
                  <option value="false" ${editing?.active === false ? "selected" : ""}>Inativo</option>
                </select>
              </label>
              <label class="field-span-3">
                <span>Observações</span>
                <textarea name="notes" rows="3" placeholder="Detalhes internos do produto, fornecedor ou observações fiscais.">${escapeHtml(toFormValue(editing?.notes))}</textarea>
              </label>
            </div>
          </section>

          <div class="products-form-actions">
            <button type="button" class="btn btn-secondary" data-action="cancel-products-form">Cancelar</button>
            <button type="button" class="btn btn-secondary" data-action="reset-products-form">Limpar</button>
            <button type="submit" class="btn btn-primary">${resetButtonLabel}</button>
          </div>
        </form>
      </article>

      <article class="panel products-list-card">
        <div class="products-panel-header">
          <div>
            <h3>Lista de produtos</h3>
            <p>Faça buscas rápidas, combine filtros inteligentes e importe planilhas sem perder o contexto da tela.</p>
          </div>
        </div>

        <section class="products-toolbar-panel panel" data-filter-scope="products">
          <div class="products-toolbar-primary">
            <label class="toolbar-field toolbar-search products-toolbar-search">
              <span>Busca principal</span>
              <input type="search" name="search" value="${escapeHtml(filter.search || "")}" placeholder="Buscar por nome, SKU, código ou NCM">
            </label>
            <label class="toolbar-field">
              <span>Categoria</span>
              <select name="category">
                <option value="">Todas</option>
                ${categories.map((category) => `<option value="${escapeHtml(category)}" ${filter.category === category ? "selected" : ""}>${escapeHtml(category)}</option>`).join("")}
              </select>
            </label>
            <label class="toolbar-field">
              <span>Status</span>
              <select name="active_filter">
                <option value="active" ${(filter.active_filter || "active") === "active" ? "selected" : ""}>Ativos</option>
                <option value="inactive" ${filter.active_filter === "inactive" ? "selected" : ""}>Inativos</option>
                <option value="all" ${filter.active_filter === "all" ? "selected" : ""}>Todos</option>
              </select>
            </label>
            <div class="products-toolbar-buttons">
              <button type="button" class="btn btn-secondary" data-action="toggle-products-filters">
                <span aria-hidden="true">${renderProductsIcon("filters")}</span>
                <span>${showAdvancedFilters ? "Ocultar filtros" : "Mais filtros"}</span>
              </button>
              <button type="button" class="btn btn-secondary" data-action="clear-products-filters">Limpar filtros</button>
            </div>
          </div>

          ${showAdvancedFilters ? `
            <div class="products-toolbar-advanced">
              <label class="toolbar-field">
                <span>Estoque</span>
                <select name="stock_filter">
                  <option value="" ${!filter.stock_filter ? "selected" : ""}>Todos</option>
                  <option value="low" ${filter.stock_filter === "low" ? "selected" : ""}>Estoque baixo</option>
                  <option value="empty" ${filter.stock_filter === "empty" ? "selected" : ""}>Sem estoque</option>
                  <option value="normal" ${filter.stock_filter === "normal" ? "selected" : ""}>Estoque normal</option>
                </select>
              </label>
              <label class="toolbar-field">
                <span>Preço mínimo (R$)</span>
                <input type="number" name="price_min" min="0" step="0.01" value="${escapeHtml(toFormValue(filter.price_min))}" placeholder="Mínimo">
              </label>
              <label class="toolbar-field">
                <span>Preço máximo (R$)</span>
                <input type="number" name="price_max" min="0" step="0.01" value="${escapeHtml(toFormValue(filter.price_max))}" placeholder="Máximo">
              </label>
            </div>
          ` : ""}

          <div class="products-filter-chips">
            ${renderProductQuickChip("low_stock", "Estoque baixo", filter.quick_filter === "low_stock")}
            ${renderProductQuickChip("out_of_stock", "Sem estoque", filter.quick_filter === "out_of_stock")}
            ${renderProductQuickChip("most_sold", "Mais vendidos", filter.quick_filter === "most_sold")}
            ${renderProductQuickChip("no_sales", "Sem venda", filter.quick_filter === "no_sales")}
          </div>
        </section>

        <section class="products-upload-shell">
          <div class="products-upload-head">
            <div>
              <h4>Importação de planilha</h4>
              <p>Atualize seu catálogo em massa por Excel ou CSV, mantendo os SKUs existentes sincronizados.</p>
            </div>
            <div class="products-upload-actions">
              <button type="button" class="btn btn-secondary" data-action="import-products-sheet">Importar planilha</button>
            </div>
          </div>
          <div class="products-upload-grid">
            <label class="products-upload-dropzone" for="products-import-file" data-products-upload-dropzone="true">
              <span class="products-upload-dropzone-icon" aria-hidden="true">${renderProductsIcon("upload")}</span>
              <span class="products-upload-dropzone-copy">
                <strong>Arraste o arquivo aqui ou clique para selecionar</strong>
                <small>Aceita .xlsx, .xlsm e .csv com atualização por SKU.</small>
              </span>
            </label>
            <input class="products-upload-input" type="file" id="products-import-file" accept=".xlsx,.xlsm,.csv">
            <div class="products-upload-meta" data-products-upload-meta="true">
              <div class="products-upload-meta-copy">
                <strong data-products-upload-name>Nenhum arquivo selecionado</strong>
                <small data-products-upload-caption>Escolha uma planilha para importar ou atualizar os produtos cadastrados.</small>
              </div>
              <button type="button" class="btn btn-secondary btn-compact" data-action="clear-products-import">Remover arquivo</button>
            </div>
          </div>
        </section>

        <div data-search-results-scope="products">${renderProductsListResults()}</div>
      </article>
    </section>
  `;
}


function resetProductsFilters() {
  const currentPerPage = Number(state.filters.products.per_page || PRODUCTS_PER_PAGE);
  state.filters.products = {
    ...state.filters.products,
    search: "",
    category: "",
    active_filter: "active",
    stock_filter: "",
    price_min: "",
    price_max: "",
    quick_filter: "",
    show_advanced: false,
    page: 1,
    per_page: currentPerPage,
  };
}


function buildDuplicateProductDraft(product) {
  return {
    ...product,
    id: "",
    sku: product?.sku ? `${product.sku}-COPIA` : "",
    code: "",
    name: product?.name ? `${product.name} (Cópia)` : "",
  };
}


function readPercentInputValue(input) {
  return Number(String(input?.value || "").replace(",", ".")) || 0;
}


function updateProductPricing(form, source = "init") {
  if (!(form instanceof HTMLFormElement)) return;

  const costInput = form.querySelector('[name="cost_price"]');
  const saleInput = form.querySelector('[name="sale_price"]');
  const marginInput = form.querySelector('[name="margin_percent"]');

  if (!isMoneyInput(costInput) || !isMoneyInput(saleInput) || !(marginInput instanceof HTMLInputElement)) {
    return;
  }

  const costValue = parseMoneyInputValue(costInput.value);
  const saleValue = parseMoneyInputValue(saleInput.value);
  const marginValue = readPercentInputValue(marginInput);
  const mode = form.dataset.productPriceMode || "margin";

  if (source === "margin") {
    form.dataset.productPriceMode = "margin";
    applyMoneyDigits(saleInput, moneyDigitsFromValue(calculateProductSalePrice(costValue, marginValue)));
    return;
  }

  if (source === "sale") {
    form.dataset.productPriceMode = "sale";
    marginInput.value = formatDecimalInput(calculateProductMarginPercent(costValue, saleValue), 2);
    return;
  }

  if (source === "cost") {
    if (mode === "sale") {
      marginInput.value = formatDecimalInput(calculateProductMarginPercent(costValue, saleValue), 2);
    } else {
      applyMoneyDigits(saleInput, moneyDigitsFromValue(calculateProductSalePrice(costValue, marginValue)));
    }
    return;
  }

  form.dataset.productPriceMode = saleValue > 0 ? "sale" : "margin";
  marginInput.value = formatDecimalInput(calculateProductMarginPercent(costValue, saleValue), 2);
}


function initializeProductsForm(form) {
  if (!(form instanceof HTMLFormElement)) return;
  updateProductPricing(form, "init");
}


function resetProductsForm(form) {
  if (!(form instanceof HTMLFormElement)) return;
  form.reset();

  form.querySelectorAll("[data-money-input]").forEach((input) => {
    delete input.dataset.moneyDigits;
    delete input.dataset.moneyValue;
  });

  const hiddenIdField = form.querySelector('[name="id"]');
  if (hiddenIdField) {
    hiddenIdField.value = state.editing.products?.id ?? "";
  }

  syncMoneyInputs(form);
  initializeProductsForm(form);
  clearFormFeedback("products", form);
}


function updateProductsImportSelection(fileInput = document.getElementById("products-import-file")) {
  const fileNameElement = document.querySelector("[data-products-upload-name]");
  const fileCaptionElement = document.querySelector("[data-products-upload-caption]");
  const metaElement = document.querySelector("[data-products-upload-meta]");
  const dropzoneElement = document.querySelector("[data-products-upload-dropzone]");
  const file = fileInput?.files?.[0] || null;

  if (fileNameElement) {
    fileNameElement.textContent = file?.name || "Nenhum arquivo selecionado";
  }
  if (fileCaptionElement) {
    fileCaptionElement.textContent = file
      ? `${(file.size / 1024).toFixed(1)} KB • pronto para importar`
      : "Escolha uma planilha para importar ou atualizar os produtos cadastrados.";
  }
  if (metaElement) {
    metaElement.classList.toggle("has-file", Boolean(file));
  }
  if (dropzoneElement) {
    dropzoneElement.classList.toggle("has-file", Boolean(file));
  }
}


function clearProductsImportSelection() {
  const fileInput = document.getElementById("products-import-file");
  if (fileInput) {
    fileInput.value = "";
  }
  updateProductsImportSelection(fileInput);
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
  const recentIssued = issued.slice(0, 5);
  const fiscalReady = isNfeFiscalProfileReady(settings);
  const settingsSummary = [
    { icon: "building", label: "Razão social", value: settings.company_name || "Não informado", wide: true },
    { icon: "store", label: "Nome fantasia", value: settings.trade_name || "Não informado" },
    { icon: "badge", label: "CNPJ", value: formatCustomerDocument(settings.cnpj) || "Não informado" },
    { icon: "landmark", label: "Inscrição estadual", value: settings.state_registration || "Não informado" },
    { icon: "receipt", label: "Regime tributário", value: settings.tax_regime || "Não informado" },
    { icon: "pin", label: "Endereço", value: buildNfeFiscalAddress(settings), wide: true },
    { icon: "homepin", label: "Complemento", value: settings.complement || "Não informado" },
    { icon: "map", label: "Bairro", value: settings.district || "Não informado" },
    { icon: "pin", label: "Cidade / UF", value: buildNfeFiscalCityState(settings) },
    { icon: "badge", label: "CEP", value: formatZipCode(settings.zip_code) || "Não informado" },
    { icon: "phone", label: "Telefone", value: formatNfePhone(settings.phone) || "Não informado" },
  ];

  return `
    <section class="nfe-dashboard-page">
      <header class="nfe-page-header">
        <div class="nfe-breadcrumb" aria-label="Breadcrumb">
          <span class="nfe-breadcrumb-home">${renderNfeDashboardIcon("home")}</span>
          <span>Início</span>
          <span class="nfe-breadcrumb-separator" aria-hidden="true">${renderNfeDashboardIcon("chevron")}</span>
          <strong>NF-e</strong>
        </div>
        <div class="nfe-page-title-block">
          <h2>NF-e</h2>
          <p>Painel fiscal com visão rápida da operação, configurações da empresa e acesso às últimas notas emitidas.</p>
        </div>
      </header>

      <section class="nfe-hero-card">
        <div class="nfe-hero-top">
          <div class="nfe-hero-main">
            <div class="nfe-hero-document">
              <span class="nfe-hero-document-icon" aria-hidden="true">${renderNfeDashboardIcon("file-check")}</span>
              <span class="nfe-hero-document-badge" aria-hidden="true">${renderNfeDashboardIcon("shield-check")}</span>
            </div>
            <div class="nfe-hero-copy">
              <span class="nfe-hero-kicker">Visão geral</span>
              <h3>NF-e</h3>
              <p>Mantenha os dados fiscais da empresa em dia e abra a nova página exclusiva para montar e emitir a NF-e com mais conforto.</p>
            </div>
          </div>
          <div class="nfe-hero-action">
            <button type="button" class="btn btn-primary nfe-hero-button" data-action="open-new-nfe-page">
              <span aria-hidden="true">${renderNfeDashboardIcon("file-check")}</span>
              Cadastrar NF-e
            </button>
          </div>
        </div>

        <div class="nfe-hero-stats-grid">
          ${renderNfeHeroStat({
            icon: "receipt",
            label: "NF-e emitidas",
            value: formatNumber(issued.length),
            helper: "Histórico geral",
          })}
          ${renderNfeHeroStat({
            icon: "shield-check",
            label: "Autorizadas",
            value: formatNumber(authorizedCount),
            helper: "Status autorizado",
            tone: "success",
          })}
          ${renderNfeHeroStat({
            icon: "sparkle",
            label: "NF-e manuais",
            value: formatNumber(manualCount),
            helper: "Fluxo independente de vendas",
            tone: "brand",
          })}
          ${renderNfeHeroStat({
            icon: "hash",
            label: "Próximo número",
            value: formatNumber(settings.next_nfe_number || 1),
            helper: formatNfeEnvironmentLabel(settings.environment),
            tone: "warning",
          })}
        </div>
      </section>

      <section class="nfe-dashboard-columns">
        <article class="panel nfe-dashboard-card nfe-settings-card">
          <div class="section-header nfe-dashboard-section-header">
            <div>
              <h3>Configurações fiscais da empresa</h3>
              <p>Esses dados são usados no emitente da NF-e e no DANFE.</p>
            </div>
            <div class="nfe-card-header-actions">
              <span class="nfe-status-pill ${fiscalReady ? "is-ready" : "is-pending"}">${fiscalReady ? "Cadastro pronto" : "Revisar cadastro"}</span>
              <button type="button" class="btn btn-secondary btn-compact nfe-inline-button" data-action="toggle-fiscal-settings-editor">
                <span aria-hidden="true">${renderNfeDashboardIcon("pencil")}</span>
                ${state.nfe.fiscalEditorOpen ? "Fechar edição" : "Editar"}
              </button>
            </div>
          </div>

          <div class="nfe-settings-summary-grid">
            ${settingsSummary.map((item) => renderNfeSettingsSummaryItem(item)).join("")}
          </div>

          ${state.nfe.fiscalEditorOpen ? `
            <div class="nfe-settings-editor-shell">
              <div class="nfe-settings-editor-header">
                <strong>Editar dados fiscais</strong>
                <small>Ao salvar, o cadastro continua disponível aqui como resumo visual.</small>
              </div>
              <form id="fiscal-settings-form" class="form-grid nfe-settings-form-grid">
                ${renderFormFeedback("fiscal")}
                <div class="nfe-settings-editor-title field-span-2">Dados do emitente</div>
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
                <label class="field-span-2"><span>E-mail</span><input type="email" name="email" value="${escapeHtml(toFormValue(settings.email))}"></label>

                <div class="nfe-settings-editor-title field-span-2">Parâmetros de emissão</div>
                <label><span>Série padrão</span><input type="number" min="1" name="default_series" value="${escapeHtml(toFormValue(settings.default_series || 1))}"></label>
                <label><span>Próximo número</span><input type="number" min="1" name="next_nfe_number" value="${escapeHtml(toFormValue(settings.next_nfe_number || 1))}"></label>
                <label>
                  <span>Ambiente</span>
                  <select name="environment">
                    ${(state.data.options.fiscal_environments || []).map((item) => `<option value="${item}" ${settings.environment === item ? "selected" : ""}>${formatNfeEnvironmentLabel(item)}</option>`).join("")}
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
                <div class="form-actions field-span-2 nfe-settings-form-actions">
                  <button type="submit" class="btn btn-primary">Salvar configurações</button>
                  <button type="button" class="btn btn-secondary" data-action="toggle-fiscal-settings-editor">Cancelar</button>
                </div>
              </form>
            </div>
          ` : ""}
        </article>

        <div class="nfe-dashboard-side-column">
          <article class="panel nfe-dashboard-card nfe-flow-dashboard-card">
            <div class="section-header nfe-dashboard-section-header">
              <div>
                <h3>Novo fluxo de emissão</h3>
                <p>A emissão agora acontece em uma página própria, separada da aba de vendas, para deixar o trabalho mais rápido e organizado.</p>
              </div>
            </div>
            <div class="nfe-flow-dashboard-list">
              ${renderNfeFlowStep({
                step: 1,
                icon: "rocket",
                title: "Cadastre a NF-e em página separada",
                description: "Use a nova rota dedicada para informar cliente, escolher produtos, ajustar valores e emitir sem depender da aba Vendas.",
                action: "open-new-nfe-page",
              })}
              ${renderNfeFlowStep({
                step: 2,
                icon: "file-check",
                title: "Gere os documentos fiscais",
                description: "Ao emitir, o sistema salva o XML mock autorizado e o DANFE em PDF para download imediato.",
              })}
              ${renderNfeFlowStep({
                step: 3,
                icon: "history",
                title: "Consulte o histórico aqui",
                description: "Depois da emissão, a NF-e volta para esta aba com número, status, cliente e links de XML/PDF.",
                action: "scroll-nfe-history",
              })}
            </div>
          </article>

          <article class="panel nfe-dashboard-card nfe-quick-access-card">
            <div class="section-header nfe-dashboard-section-header">
              <div>
                <h3>Acesso rápido</h3>
                <p>Últimas NF-e emitidas com status, valor e atalho de download.</p>
              </div>
            </div>

            ${recentIssued.length ? `
              <div class="nfe-quick-access-list">
                ${recentIssued.map((record) => renderNfeQuickAccessRow(record)).join("")}
              </div>
              <button type="button" class="nfe-inline-link" data-action="scroll-nfe-history">
                Ver todas as NF-e emitidas
                <span aria-hidden="true">${renderNfeDashboardIcon("arrow")}</span>
              </button>
            ` : renderEmptyState("Nenhuma NF-e emitida", "Assim que você emitir a primeira NF-e, ela aparecerá aqui.")}
          </article>
        </div>
      </section>

      <section id="nfe-issued-history" class="panel nfe-dashboard-card nfe-history-card">
        <div class="section-header nfe-dashboard-section-header">
          <div>
            <h3>NF-e emitidas</h3>
            <p>XML autorizado e DANFE em PDF disponíveis para download.</p>
          </div>
          <span class="nfe-status-pill is-neutral">${formatNumber(issued.length)} registro(s)</span>
        </div>
        <section class="panel toolbar-panel nfe-history-toolbar" data-filter-scope="nfe">
          <div class="toolbar-row nfe-history-toolbar-row">
            <label class="toolbar-field toolbar-search">
              <span>Busca</span>
              <input type="search" name="search" value="${escapeHtml(state.filters.nfe.search || "")}" placeholder="Número, cliente, chave, pagamento ou origem">
            </label>
          </div>
        </section>
        <div data-search-results-scope="nfe">${renderNfeIssuedResults()}</div>
      </section>
    </section>
  `;
}


function renderCustomersPage() {
  const search = state.filters.customers.search;
  const editing = defaultCustomerDraft(state.editing.customers);
  const activeTab = state.customersUi.activeTab || "main";
  const previewCustomer = getCustomerPreviewRecord();
  const totals = {
    total: state.data.customers.length,
    individuals: state.data.customers.filter((customer) => customer.person_type !== "PJ").length,
    companies: state.data.customers.filter((customer) => customer.person_type === "PJ").length,
    contributors: state.data.customers.filter((customer) => customer.ie_indicator === "Contribuinte").length,
  };

  return `
    ${renderHero(
      "Cadastro de clientes",
      "Cadastre clientes com dados fiscais completos para selecionar direto na emiss\u00e3o da NF-e, sem digita\u00e7\u00e3o manual.",
    )}

    <section class="metrics-grid metrics-grid-4">
      ${renderMetricCard({ label: "Clientes cadastrados", value: formatNumber(totals.total), helper: "Base pronta para NF-e" })}
      ${renderMetricCard({ label: "Pessoa f\u00edsica", value: formatNumber(totals.individuals), helper: "Clientes com CPF" })}
      ${renderMetricCard({ label: "Pessoa jur\u00eddica", value: formatNumber(totals.companies), helper: "Clientes com CNPJ" })}
      ${renderMetricCard({ label: "Contribuintes", value: formatNumber(totals.contributors), helper: "Com IE obrigat\u00f3ria" })}
    </section>

    <section class="page-grid customers-layout">
      <article class="panel customer-form-panel">
        <div class="customer-form-shell">
          <div class="section-header customer-shell-header">
            <div>
              <h3>${editing.id ? "Editar cliente" : "Novo cliente"}</h3>
              <p>${editing.id ? "Atualize o cadastro selecionado com o padrão fiscal exigido pela NF-e." : "Preencha os dados e deixe o cliente pronto para seleção imediata na emissão da nota."}</p>
            </div>
            <span class="sales-section-chip">${editing.id ? "Em edição" : "Cadastro"}</span>
          </div>
          <form id="customers-form" class="form-grid customer-form-grid">
            <input type="hidden" name="id" value="${editing.id}">
            ${renderFormFeedback("customers")}

            <div class="field-span-2 customer-form-topbar">
              <div class="customer-type-switcher customer-type-switcher-large">
                ${customerPersonTypeOptions().map((option) => `
                  <label class="customer-type-option">
                    <input type="radio" name="person_type" value="${option.value}" ${editing.person_type === option.value ? "checked" : ""}>
                    <span>${option.label}</span>
                  </label>
                `).join("")}
              </div>
            </div>

            <div class="field-span-2 customer-form-tabs" role="tablist" aria-label="Abas do cadastro de clientes">
              ${[
                { id: "main", label: "Dados principais" },
                { id: "address", label: "Endereço" },
                { id: "fiscal", label: "Fiscal" },
                { id: "notes", label: "Observações" },
              ].map((tab) => `
                <button
                  type="button"
                  class="customer-tab-button ${activeTab === tab.id ? "is-active" : ""}"
                  data-action="customer-tab"
                  data-tab="${tab.id}"
                  role="tab"
                  aria-selected="${activeTab === tab.id ? "true" : "false"}"
                >
                  ${tab.label}
                </button>
              `).join("")}
            </div>

            <section class="field-span-2 customer-tab-panel ${activeTab === "main" ? "is-active" : ""}">
              <div class="customer-form-section">
                <div class="section-header compact">
                  <div>
                    <h4>Dados principais</h4>
                    <p>Identificação do cliente e canais de contato usados no dia a dia.</p>
                  </div>
                </div>
                <div class="customer-form-section-grid customer-section-main-grid">
                  <label class="field-span-2">
                    <span data-customer-name-label>${editing.person_type === "PJ" ? "Razão social" : "Nome completo"}</span>
                    <input type="text" name="name" value="${escapeHtml(toFormValue(editing.name))}" placeholder="${editing.person_type === "PJ" ? "Ex.: Dois Irmãos Comércio Ltda" : "Ex.: João da Silva"}" required>
                  </label>
                  <label class="field-span-2 ${editing.person_type === "PJ" ? "" : "hidden"}" data-customer-trade-name>
                    <span>Nome fantasia</span>
                    <input type="text" name="trade_name" value="${escapeHtml(toFormValue(editing.trade_name))}" placeholder="Opcional">
                  </label>
                  <label class="${editing.person_type === "PF" ? "" : "hidden"}" data-customer-cpf-field>
                    <span data-customer-document-label>CPF</span>
                    <input type="text" name="cpf" value="${escapeHtml(toFormValue(editing.cpf))}" inputmode="numeric" placeholder="Somente números">
                  </label>
                  <label class="${editing.person_type === "PJ" ? "" : "hidden"}" data-customer-cnpj-field>
                    <span data-customer-document-label>CNPJ</span>
                    <input type="text" name="cnpj" value="${escapeHtml(toFormValue(editing.cnpj))}" inputmode="numeric" placeholder="Somente números">
                  </label>
                  <label>
                    <span>Telefone</span>
                    <input type="text" name="phone" value="${escapeHtml(toFormValue(editing.phone))}" placeholder="Opcional">
                  </label>
                  <label>
                    <span>WhatsApp</span>
                    <input type="text" name="whatsapp" value="${escapeHtml(toFormValue(editing.whatsapp))}" placeholder="Opcional">
                  </label>
                  <label class="field-span-2">
                    <span>E-mail</span>
                    <input type="email" name="email" value="${escapeHtml(toFormValue(editing.email))}" placeholder="Opcional">
                  </label>
                </div>
              </div>
            </section>

            <section class="field-span-2 customer-tab-panel ${activeTab === "address" ? "is-active" : ""}">
              <div class="customer-form-section">
                <div class="section-header compact">
                  <div>
                    <h4>Endereço</h4>
                    <p>Busque pelo CEP e complete o endereço fiscal do cliente.</p>
                  </div>
                </div>
                <div class="customer-form-section-grid customer-section-address-grid">
                  <label>
                    <span>CEP</span>
                    <input type="text" name="zip_code" value="${escapeHtml(formatZipCode(editing.zip_code))}" inputmode="numeric" placeholder="00000-000">
                  </label>
                  <label class="field-span-2">
                    <span>Rua</span>
                    <input type="text" name="street" value="${escapeHtml(toFormValue(editing.street))}" placeholder="Rua, avenida, estrada" required>
                  </label>
                  <label>
                    <span>Número</span>
                    <input type="text" name="number" value="${escapeHtml(toFormValue(editing.number))}" placeholder="Ex.: 120" required>
                  </label>
                  <label>
                    <span>Bairro</span>
                    <input type="text" name="district" value="${escapeHtml(toFormValue(editing.district))}" placeholder="Bairro" required>
                  </label>
                  <label class="field-span-2">
                    <span>Complemento</span>
                    <input type="text" name="complement" value="${escapeHtml(toFormValue(editing.complement))}" placeholder="Opcional">
                  </label>
                  <label>
                    <span>Cidade</span>
                    <input type="text" name="city" value="${escapeHtml(toFormValue(editing.city))}" placeholder="Cidade" required>
                  </label>
                  <label>
                    <span>Estado</span>
                    <input type="text" name="state" value="${escapeHtml(toFormValue(editing.state))}" maxlength="2" placeholder="UF" required>
                  </label>
                </div>
              </div>
            </section>

            <section class="field-span-2 customer-tab-panel ${activeTab === "fiscal" ? "is-active" : ""}">
              <div class="customer-form-section">
                <div class="section-header compact">
                  <div>
                    <h4>Fiscal</h4>
                    <p>Campos fiscais necessários para emissão segura de NF-e.</p>
                  </div>
                </div>
                <div class="customer-form-section-grid customer-section-fiscal-grid">
                  <label>
                    <span>Indicador IE</span>
                    <select name="ie_indicator">
                      ${customerIeIndicatorOptions().map((option) => `
                        <option value="${option.value}" ${editing.ie_indicator === option.value ? "selected" : ""}>${option.label}</option>
                      `).join("")}
                    </select>
                  </label>
                  <label class="${editing.ie_indicator === "Contribuinte" ? "" : "hidden"}" data-customer-ie-field>
                    <span>Inscrição Estadual</span>
                    <input type="text" name="state_registration" value="${escapeHtml(toFormValue(editing.state_registration))}" placeholder="Obrigatória para contribuinte">
                  </label>
                  <label>
                    <span>Código IBGE do município</span>
                    <input type="text" name="city_ibge_code" value="${escapeHtml(toFormValue(editing.city_ibge_code))}" inputmode="numeric" placeholder="7 dígitos" required>
                  </label>
                  <label class="${editing.person_type === "PF" ? "" : "hidden"}" data-customer-rg-field>
                    <span>RG</span>
                    <input type="text" name="rg" value="${escapeHtml(toFormValue(editing.rg))}" placeholder="Opcional">
                  </label>
                  <label class="${editing.person_type === "PF" ? "" : "hidden"}" data-customer-birth-date-field>
                    <span>Data de nascimento</span>
                    <input type="date" name="birth_date" value="${escapeHtml(toFormValue(editing.birth_date))}">
                  </label>
                </div>
              </div>
            </section>

            <section class="field-span-2 customer-tab-panel ${activeTab === "notes" ? "is-active" : ""}">
              <div class="customer-form-section">
                <div class="section-header compact">
                  <div>
                    <h4>Observações</h4>
                    <p>Espaço para anotações internas do cadastro.</p>
                  </div>
                </div>
                <div class="customer-form-section-grid customer-section-notes-grid">
                  <label class="field-span-2">
                    <span>Observações</span>
                    <textarea name="notes" rows="7" placeholder="Informações adicionais sobre o cliente">${escapeHtml(toFormValue(editing.notes))}</textarea>
                  </label>
                </div>
              </div>
            </section>

            <div class="form-actions field-span-2 customer-form-actions">
              <button type="submit" class="btn btn-primary">Salvar cliente</button>
              <button type="button" class="btn btn-secondary" data-action="clear-customers-form">Limpar formulário</button>
            </div>
          </form>
        </div>
      </article>

      <article class="panel customer-list-panel">
        <div class="section-header customer-shell-header">
          <div>
            <h3>Lista de clientes</h3>
            <p>Busque, visualize e gerencie os clientes já cadastrados.</p>
          </div>
          <span class="sales-section-chip">${formatNumber(totals.total)} registros</span>
        </div>

        ${previewCustomer ? renderCustomerPreviewCard(previewCustomer) : ""}

        <section class="customer-list-toolbar" data-filter-scope="customers">
          <label class="toolbar-field toolbar-search customer-search-field">
            <span>Buscar</span>
            <input type="search" name="search" value="${escapeHtml(search)}" placeholder="Digite nome, CPF, CNPJ, IE ou cidade...">
          </label>
        </section>
        <div data-search-results-scope="customers">${renderCustomersListResults()}</div>
      </article>
    </section>
  `;
}


function renderSalesPage() {
  const editing = state.editing.sales;
  const { period } = getFilteredSalesData();
  const currentDate = editing?.sale_date || localTodayIso();
  const currentTime = editing?.sale_time || currentTimeValue();
  const salesPaymentMethods = state.data.options.sales_payment_methods?.length
    ? state.data.options.sales_payment_methods
    : state.data.options.payment_methods;
  const selectedPaymentMethod = editing?.payment_method || salesPaymentMethods[0] || state.data.options.payment_methods[0] || "";
  const draftAmount = editing?.total_amount || editing?.amount || 0;

  return `
    <div class="sales-page-compact">
      ${renderSalesExecutiveHeader()}

      ${renderSalesFiltersBar()}

      <div data-search-results-scope="sales" data-search-results-part="metrics">${renderSalesMetricsSection()}</div>

      <section class="page-grid page-grid-2 sales-main-grid">
        <article class="panel sales-form-card">
          <div class="section-header sales-form-header">
            <div class="sales-section-heading-wrap">
              <span class="sales-section-heading-icon sales-section-heading-icon-form" aria-hidden="true">${renderSalesIcon("quick_sale")}</span>
              <div>
              <h3>${editing ? "Editar venda rápida" : "Nova venda rápida"}</h3>
              <p>${editing ? "Atualize o lançamento selecionado mantendo o fluxo simples do caixa." : "Preencha valor, pagamento, data e hora para registrar uma venda em poucos segundos."}</p>
              </div>
            </div>
            <span class="sales-section-chip">${escapeHtml(period.label)}</span>
          </div>
          <form id="sales-form" class="form-grid quick-sale-form">
            <input type="hidden" name="id" value="${editing?.id ?? ""}">
            ${renderFormFeedback("sales")}
            <label class="field-span-2 quick-sale-amount sales-amount-field">
              <span>Valor da venda</span>
              ${renderMoneyInput({ name: "amount", value: draftAmount, required: true, classes: "money-input-large" })}
            </label>
            <label class="sales-payment-field">
              <span>Meio de pagamento</span>
              <div class="sales-inline-control">
                <span class="sales-inline-control-icon" aria-hidden="true">${renderSalesIcon("payment")}</span>
                <select name="payment_method" required>
                  ${renderPaymentOptions(selectedPaymentMethod, salesPaymentMethods)}
                </select>
              </div>
            </label>
            <div class="field-span-2 quick-sale-meta">
              <label>
                <span>Data da venda</span>
                <div class="sales-inline-control">
                  <span class="sales-inline-control-icon" aria-hidden="true">${renderSalesIcon("calendar")}</span>
                  <input type="date" name="sale_date" value="${currentDate}" required>
                </div>
              </label>
              <label>
                <span>Hora da venda</span>
                <div class="sales-inline-control">
                  <span class="sales-inline-control-icon" aria-hidden="true">${renderSalesIcon("clock")}</span>
                  <input type="time" name="sale_time" value="${currentTime}" step="60" required>
                </div>
              </label>
            </div>

            <div class="form-actions field-span-2">
              <button type="submit" class="btn btn-primary">${editing ? "Salvar venda" : "Registrar venda"}</button>
              <button type="button" class="btn btn-secondary" data-action="clear-sales-form">Limpar formulário</button>
            </div>
          </form>
        </article>
        <div data-search-results-scope="sales" data-search-results-part="history">${renderSalesHistoryPanel()}</div>
      </section>

      <div data-search-results-scope="sales" data-search-results-part="insights">${renderSalesInsightsSection()}</div>
    </div>
  `;
}


function summarizeQuoteItems(quote) {
  return quote.items
    .map((item) => `${item.item_name || item.product_name} (${formatNumber(item.quantity)})`)
    .join(", ");
}


function buildDuplicateQuoteDraft(quote) {
  const quoteDate = todayIso();
  return {
    ...quote,
    __composer_key: `quote-duplicate:${quote.id}:${Date.now()}`,
    id: "",
    quote_date: quoteDate,
    validity_date: getDefaultQuoteValidityDate(quoteDate),
    status: "Pendente",
    notes: "",
    items: (quote.items || []).map((item) => createQuoteDraftItem(item)),
  };
}


function buildQuoteDraftSnapshot() {
  const form = document.getElementById("quotes-form");
  if (!form) return null;

  const payload = normalizeMoneyPayload(
    form,
    normalizePayload(Object.fromEntries(new FormData(form).entries())),
  );
  const items = getQuoteItems().filter((item) => item.item_name);
  const manualCustomerName = String(payload.customer_name_manual || "").trim();
  const quoteDate = payload.quote_date || todayIso();
  const totals = getQuoteTotals(items);

  return {
    id: payload.id || "Prévia",
    quote_date: quoteDate,
    validity_date: payload.validity_date || getDefaultQuoteValidityDate(quoteDate),
    customer_name: manualCustomerName || "Cliente não informado",
    customer_name_manual: manualCustomerName,
    status: "Pendente",
    notes: "",
    subtotal_amount: totals.subtotal,
    discount_amount: 0,
    total_amount: totals.total,
    items,
  };
}


function buildQuotePayloadFromForm(form) {
  const payload = normalizeMoneyPayload(
    form,
    normalizePayload(Object.fromEntries(new FormData(form).entries())),
  );
  const id = payload.id;
  delete payload.id;
  delete payload.draft_item_name;
  delete payload.draft_quantity;
  delete payload.draft_unit;
  delete payload.draft_unit_price;
  delete payload.customer_phone;
  delete payload.customer_document;
  payload.items = getQuoteItems().map((item) => ({ ...item }));
  payload.status = "Pendente";
  payload.discount_amount = "0.00";
  payload.customer_name_manual = String(payload.customer_name_manual || "").trim();
  payload.quote_date = payload.quote_date || localTodayIso();
  payload.validity_date = payload.validity_date || getDefaultQuoteValidityDate(payload.quote_date);
  payload.notes = "";
  return { id, payload };
}


function syncQuoteEditorState(savedQuote = null) {
  state.editing.quotes = savedQuote
    ? {
      ...savedQuote,
      __composer_key: `quote:${savedQuote.id}`,
    }
    : null;
  resetQuoteComposer();
}


async function persistQuoteForm(form, { successMessage, showSuccessState = true, keepEditorState = true } = {}) {
  const { id, payload } = buildQuotePayloadFromForm(form);

  try {
    if (!payload.customer_name_manual) {
      throw new Error("Informe o nome do cliente.");
    }
    if (!payload.items.length) {
      throw new Error("Adicione pelo menos um item ao orçamento.");
    }

    payload.items.forEach((item, index) => {
      if (!item.item_name) {
        throw new Error(`Informe a descrição do item ${index + 1}.`);
      }
      if (!isValidNumber(item.quantity, { min: 0.01, allowZero: false })) {
        throw new Error(`Informe uma quantidade válida no item ${index + 1}.`);
      }
      if (!isValidNumber(item.unit_price, { min: 0, allowZero: true })) {
        throw new Error(`Informe um valor unitário válido no item ${index + 1}.`);
      }
    });
  } catch (error) {
    showToast(error.message, "error");
    return null;
  }

  setFormBusy(form, true);
  try {
    const response = id
      ? await api.update("quotes", id, payload)
      : await api.create("quotes", payload);
    const message = successMessage || (id ? "Orçamento atualizado com sucesso." : "Orçamento salvo com sucesso.");
    await loadData();
    const savedId = response?.item?.id ?? response?.id;
    const refreshedQuote = state.data.quotes.find((item) => String(item.id) === String(savedId)) || response?.item || response;
    if (showSuccessState) {
      showToast(message);
    }
    if (keepEditorState) {
      syncQuoteEditorState(refreshedQuote);
      renderCurrentPage();
    }
    return refreshedQuote;
  } catch (error) {
    showToast(error.message, "error");
    return null;
  } finally {
    setFormBusy(form, false);
  }
}


function parseFilenameFromDisposition(headerValue = "") {
  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const simpleMatch = headerValue.match(/filename="?([^"]+)"?/i);
  return simpleMatch?.[1] || "";
}


function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}


async function fetchQuotePdfBlob(quoteId) {
  const response = await fetch(`/api/quotes/${quoteId}/pdf`, {
    method: "GET",
    credentials: "same-origin",
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Não foi possível gerar o PDF do orçamento.");
  }

  return {
    blob: await response.blob(),
    filename: parseFilenameFromDisposition(response.headers.get("Content-Disposition") || "") || `orcamento-${quoteId}.pdf`,
  };
}


async function openQuotePdfDocument(quoteId) {
  const { blob, filename } = await fetchQuotePdfBlob(quoteId);

  if (window.desktopShell?.isElectron) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const payload = { base64: bytesToBase64(bytes), filename };
    await window.desktopShell.openPdfFile(payload);
    return;
  }

  const pdfUrl = URL.createObjectURL(blob);
  const popup = window.open(pdfUrl, "_blank", "noopener");
  if (!popup) {
    URL.revokeObjectURL(pdfUrl);
    throw new Error("Permita pop-ups para abrir o PDF do orçamento.");
  }

  setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
}


async function handleCurrentQuoteDocumentAction() {
  const form = document.getElementById("quotes-form");
  if (!form) return;

  const savedQuote = await persistQuoteForm(form, {
    showSuccessState: false,
    keepEditorState: false,
  });
  if (!savedQuote?.id) {
    return;
  }

  try {
    await openQuotePdfDocument(savedQuote.id);
    clearEditing("quotes");
    showToast("PDF gerado com sucesso. Tela pronta para um novo orçamento.");
  } catch (error) {
    showToast(error.message, "error");
  }
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
  const editing = state.editing.quotes;
  syncQuoteComposerState();

  return `
    <section class="quotes-studio-page">
      <form id="quotes-form" class="quotes-builder-form quote-studio-form quotes-builder-panel" novalidate>
        <input type="hidden" name="id" value="${editing?.id ?? ""}">

        <section class="quote-studio-card quote-studio-client-card">
          <div class="quote-studio-section-title">
            <span class="quote-studio-section-icon" aria-hidden="true">${renderChecksPageIcon("user")}</span>
            <h3>Dados do cliente</h3>
          </div>
          <div class="quote-studio-client-grid">
            <label class="quote-studio-field">
              <span>Nome do cliente</span>
              <div class="quote-studio-input-shell">
                <span aria-hidden="true">${renderChecksPageIcon("user")}</span>
                <input type="text" name="customer_name_manual" value="${escapeHtml(toFormValue(editing?.customer_name_manual || editing?.customer_name || ""))}" placeholder="Digite o nome do cliente" required>
              </div>
            </label>
            <label class="quote-studio-field">
              <span>Telefone / WhatsApp</span>
              <div class="quote-studio-input-shell">
                <span aria-hidden="true">${renderChecksPageIcon("check")}</span>
                <input type="text" name="customer_phone" value="" placeholder="(00) 00000-0000" inputmode="tel">
              </div>
            </label>
            <label class="quote-studio-field">
              <span>CPF / CNPJ</span>
              <div class="quote-studio-input-shell">
                <span aria-hidden="true">${renderChecksPageIcon("file")}</span>
                <input type="text" name="customer_document" value="" placeholder="000.000.000-00">
              </div>
            </label>
          </div>
        </section>

        <section class="quote-studio-content">
          ${renderQuoteDraftEditor()}

          <section class="quote-studio-card quote-studio-items-card quotes-items-section">
            <div class="quote-studio-section-title">
              <span class="quote-studio-section-icon" aria-hidden="true">${renderChecksPageIcon("file")}</span>
              <h3>Itens do orçamento</h3>
            </div>
            <div class="quotes-items-board" data-quote-items-list>
              ${renderQuoteItemsList()}
            </div>
          </section>
        </section>

        <footer class="quote-studio-actions form-actions quotes-main-actions quotes-main-actions-compact">
          <button type="button" class="btn btn-secondary" data-action="clear-quotes-form">
            <span aria-hidden="true">${renderChecksPageIcon("clean")}</span>
            Limpar
          </button>
          <button type="button" class="btn btn-primary quotes-primary-submit quote-studio-pdf-button" data-action="generate-quote-pdf">
            <span aria-hidden="true">${renderChecksPageIcon("file")}</span>
            Gerar PDF
          </button>
        </footer>
      </form>
    </section>
  `;
}


function getFilteredMissingItems() {
  const search = String(state.filters.missing_items.search || "").trim().toLowerCase();
  const items = [...state.data.missing_items];
  if (!search) {
    return items;
  }
  return items.filter((item) => String(item.name || "").toLowerCase().includes(search));
}


function isMissingItemReceived(item) {
  const status = String(item.status || item.effective_status || "").toLowerCase();
  return Boolean(item.received_at || item.arrived_at || item.arrival_date || item.is_received || status.includes("receb"));
}


function getMissingItemReceivedDate(item) {
  return item.received_at || item.arrived_at || item.arrival_date || "";
}


function getMissingItemsSummaryData() {
  const total = state.data.missing_items.length;
  const received = state.data.missing_items.filter(isMissingItemReceived).length;
  return {
    total,
    pending: Math.max(total - received, 0),
    received,
  };
}


function renderMissingItemsMetric({ icon, label, value, helper, tone = "default" }) {
  return `
    <article class="missing-items-metric missing-items-metric-${tone}">
      <span class="missing-items-metric-icon" aria-hidden="true">${icon}</span>
      <div>
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(String(value))}</strong>
        <small>${escapeHtml(helper)}</small>
      </div>
    </article>
  `;
}


function renderMissingItemsMetrics() {
  const summary = getMissingItemsSummaryData();
  const metrics = [
    {
      icon: renderChecksPageIcon("file"),
      label: "Total de itens",
      value: formatNumber(summary.total),
      helper: "Itens cadastrados",
      tone: "total",
    },
    {
      icon: renderSalesIcon("clock"),
      label: "Pendentes",
      value: formatNumber(summary.pending),
      helper: "Aguardando reposição",
      tone: "pending",
    },
    {
      icon: renderChecksPageIcon("check"),
      label: "Recebidos",
      value: formatNumber(summary.received),
      helper: "Já foram recebidos",
      tone: "received",
    },
  ];

  return `
    <section class="missing-items-metrics-grid">
      ${metrics.map((metric) => renderMissingItemsMetric(metric)).join("")}
    </section>
  `;
}


function renderMissingItemsFormFeedback() {
  const feedback = state.formFeedback.missing_items;
  if (!feedback) {
    return `<div class="missing-items-success-alert hidden field-span-2" data-form-feedback="missing_items"></div>`;
  }

  if (feedback.tone !== "success") {
    return `
      <p class="form-feedback form-feedback-${feedback.tone} field-span-2" data-form-feedback="missing_items">
        ${escapeHtml(feedback.message || "")}
      </p>
    `;
  }

  return `
    <div class="missing-items-success-alert field-span-2" data-form-feedback="missing_items">
      <span class="missing-items-success-alert-icon" aria-hidden="true">${renderChecksPageIcon("check")}</span>
      <div>
        <strong>Item cadastrado com sucesso!</strong>
        <small>O item foi adicionado à lista de itens faltantes.</small>
      </div>
    </div>
  `;
}


function renderMissingItemStatusBadge(item) {
  if (isMissingItemReceived(item)) {
    return `
      <span class="missing-item-status-badge is-received">
        <span aria-hidden="true">${renderChecksPageIcon("check")}</span>
        Recebido
      </span>
    `;
  }

  return `
    <span class="missing-item-status-badge is-pending">
      <span aria-hidden="true">${renderSalesIcon("clock")}</span>
      Pendente
    </span>
  `;
}


function renderMissingItemArrivalControl(item) {
  const isReceived = isMissingItemReceived(item);
  const receivedDate = getMissingItemReceivedDate(item);
  const label = isReceived
    ? `Recebido${receivedDate ? ` em ${formatDate(receivedDate)}` : ""}`
    : "Marcar como chegou";

  return `
    <button
      type="button"
      class="missing-item-arrival-switch ${isReceived ? "is-on" : ""}"
      data-action="request-missing-item-arrived"
      data-id="${item.id}"
      role="switch"
      aria-checked="${isReceived ? "true" : "false"}"
      ${isReceived ? "disabled" : ""}
    >
      <span class="missing-item-switch-track" aria-hidden="true">
        <span class="missing-item-switch-thumb"></span>
      </span>
      <span>${escapeHtml(label)}</span>
    </button>
  `;
}


function getMissingItemIcon(index) {
  const icons = [renderChecksPageIcon("file"), renderSalesIcon("quantity"), renderChecksPageIcon("edit"), renderChecksPageIcon("clean")];
  return icons[index % icons.length];
}


function renderMissingItemsListResults() {
  const items = getFilteredMissingItems();
  const pagination = paginateRecords(items, state.filters.missing_items.page, MISSING_ITEMS_PER_PAGE);
  state.filters.missing_items.page = pagination.page;
  const pagedItems = pagination.items;
  const tokens = buildPaginationTokens(pagination.page, pagination.totalPages);
  const startRecord = items.length ? ((pagination.page - 1) * MISSING_ITEMS_PER_PAGE) + 1 : 0;
  const endRecord = items.length ? startRecord + pagedItems.length - 1 : 0;

  return items.length ? `
    <div class="missing-items-table-shell">
      <table class="missing-items-table">
        <thead>
          <tr>
            <th>ITEM</th>
            <th>STATUS</th>
            <th>CHEGOU</th>
            <th>AÇÕES</th>
          </tr>
        </thead>
        <tbody>
          ${pagedItems.map((item, index) => `
            <tr>
              <td>
                <div class="missing-item-name-cell">
                  <span class="missing-item-row-icon" aria-hidden="true">${getMissingItemIcon(index)}</span>
                  <strong>${escapeHtml(item.name)}</strong>
                </div>
              </td>
              <td>${renderMissingItemStatusBadge(item)}</td>
              <td>${renderMissingItemArrivalControl(item)}</td>
              <td>
                <button type="button" class="missing-item-delete-button" data-action="delete-missing-item" data-id="${item.id}" title="Excluir item" aria-label="Excluir item">
                  ${renderChecksPageIcon("trash")}
                </button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <footer class="missing-items-pagination">
        <span>Mostrando ${formatNumber(startRecord)} a ${formatNumber(endRecord)} de ${formatNumber(items.length)} itens</span>
        <div class="missing-items-pagination-controls" aria-label="Paginação de itens faltantes">
          <button type="button" data-action="missing-items-prev-page" ${pagination.page <= 1 ? "disabled" : ""} aria-label="Página anterior">
            <span aria-hidden="true">‹</span>
          </button>
          ${tokens.map((token) => (token === "..."
            ? `<span class="missing-items-pagination-ellipsis">...</span>`
            : `
              <button
                type="button"
                class="${Number(token) === pagination.page ? "is-active" : ""}"
                data-action="missing-items-go-page"
                data-page="${token}"
              >
                ${token}
              </button>
            `
          )).join("")}
          <button type="button" data-action="missing-items-next-page" ${pagination.page >= pagination.totalPages ? "disabled" : ""} aria-label="Próxima página">
            <span aria-hidden="true">›</span>
          </button>
        </div>
      </footer>
    </div>
  ` : renderEmptyState("Nenhum item faltante encontrado", "Adicione um item ou ajuste a busca pelo nome.");
}


function renderMissingItemsPage() {
  const filteredItems = getFilteredMissingItems();

  return `
    <section class="missing-items-studio">
      ${renderMissingItemsMetrics()}

      <section class="missing-items-workspace">
        <article class="missing-items-card missing-items-form-card">
          <div class="missing-items-card-heading">
            <h3>Novo item faltante</h3>
            <p>Informe o nome do item que precisa ser reposto.</p>
          </div>
          <form id="missing-items-form" class="missing-items-form">
            ${renderMissingItemsFormFeedback()}
            <label class="missing-items-field">
              <span>Nome do item <strong>*</strong></span>
              <div class="missing-items-input-shell">
                <span aria-hidden="true">${renderSalesIcon("quantity")}</span>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="Ex.: Cimento, cano 100mm, argamassa, telha..."
                  autocomplete="off"
                >
              </div>
            </label>
            <button type="submit" class="missing-items-submit-button">
              <span aria-hidden="true">${renderChecksPageIcon("plus")}</span>
              Adicionar item
            </button>
          </form>
        </article>

        <article class="missing-items-card missing-items-list-card">
          <div class="missing-items-list-header">
            <div class="missing-items-card-heading">
              <h3>Lista de itens faltantes</h3>
              <p>Acompanhe todos os itens que estão pendentes de reposição.</p>
            </div>
            <section class="missing-items-list-tools" data-filter-scope="missing_items">
              <label class="missing-items-search-field" aria-label="Buscar item">
                <span aria-hidden="true">${renderSalesIcon("search")}</span>
                <input type="search" name="search" value="${escapeHtml(state.filters.missing_items.search || "")}" placeholder="Buscar item...">
              </label>
              <button type="button" class="missing-items-filter-button" data-action="apply-missing-items-filter">
                <span aria-hidden="true">${renderSalesIcon("filters")}</span>
                Filtrar
              </button>
            </section>
          </div>
          <div class="missing-items-list-counter">${formatNumber(filteredItems.length)} item(ns) encontrados</div>
          <div data-search-results-scope="missing_items">${renderMissingItemsListResults()}</div>
        </article>
      </section>
    </section>
  `;
}


function renderMissingItemsPageLegacy() {
  return `
    ${renderHero(
      "Itens Faltantes",
      "Cadastre rapidamente itens que precisam ser repostos e marque como chegou quando forem encontrados ou entregues.",
    )}

    <section class="page-grid page-grid-2 missing-items-page-grid">
      <article class="panel">
        <div class="section-header">
          <div>
            <h3>Novo item faltante</h3>
            <p>Informe somente o nome do item. Nada além disso será salvo no banco.</p>
          </div>
        </div>
        <form id="missing-items-form" class="form-grid">
          ${renderFormFeedback("missing_items")}
          <label class="field-span-2">
            <span>Nome do item</span>
            <input
              type="text"
              name="name"
              required
              placeholder="Ex: Cimento, Areia, Cano 100mm, Argamassa..."
              autocomplete="off"
            >
          </label>
          <div class="form-actions field-span-2">
            <button type="submit" class="btn btn-primary">Adicionar item</button>
          </div>
        </form>
      </article>

      <article class="panel">
        <div class="section-header">
          <div>
            <h3>Lista de itens faltantes</h3>
            <p>${state.data.missing_items.length} item(ns) aguardando chegada.</p>
          </div>
        </div>
        <section class="toolbar-panel missing-items-search-panel" data-filter-scope="missing_items">
          <label class="toolbar-field toolbar-search">
            <span>Buscar item</span>
            <input type="search" name="search" value="${escapeHtml(state.filters.missing_items.search || "")}" placeholder="Buscar item">
          </label>
        </section>
        <div data-search-results-scope="missing_items">${renderMissingItemsListResults()}</div>
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
      "Registre despesas da loja, acompanhe totais por período e lance pagamentos com menos etapas no dia a dia.",
    )}

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
        <label><span>Valor</span>${renderMoneyInput({ name: "amount", value: editing?.amount ?? 0, required: true })}</label>
        <label><span>Forma de pagamento</span><select name="payment_method" required>${renderPaymentOptions(editing?.payment_method || state.data.options.payment_methods[0])}</select></label>
        <div class="form-actions field-span-2">
          <button type="submit" class="btn btn-primary">${editing ? "Salvar conta" : "Cadastrar conta paga"}</button>
          <button type="button" class="btn btn-secondary" data-action="clear-expenses-form">Limpar formulário</button>
        </div>
      </form>
    </article>

    ${renderPeriodToolbar("expenses", {
      showSearch: true,
      searchPlaceholder: "Buscar por descrição ou forma de pagamento",
    })}

    <section class="metrics-grid metrics-grid-4">
      ${renderMetricCard({ label: "Pago hoje", value: formatMoney(sumBy(todayExpenses, (expense) => expense.amount)), helper: `${todayExpenses.length} conta(s)` })}
      ${renderMetricCard({ label: "Na semana", value: formatMoney(sumBy(weekExpenses, (expense) => expense.amount)), helper: `${weekExpenses.length} conta(s)` })}
      ${renderMetricCard({ label: "No mês", value: formatMoney(sumBy(monthExpenses, (expense) => expense.amount)), helper: `${monthExpenses.length} conta(s)`, tone: "brand" })}
      ${renderMetricCard({ label: "No ano", value: formatMoney(sumBy(yearExpenses, (expense) => expense.amount)), helper: `${yearExpenses.length} conta(s)` })}
    </section>

    <div data-search-results-scope="expenses" data-search-results-part="insights">${renderExpensesInsightsSection()}</div>

    <div data-search-results-scope="expenses" data-search-results-part="recent">${renderExpensesRecentPanel()}</div>
  `;
}


function renderBillsPage() {
  const editing = state.editing.bills;

  return `
    ${renderHero(
      "Boletos",
      "Controle os boletos a pagar com alertas de vencimento, filtros rápidos e atualização imediata do status.",
    )}

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
              <strong>Marcar como pago</strong>
              <small>Marque quando o boleto já tiver sido quitado.</small>
            </div>
          </label>
        </div>
        <div class="form-actions field-span-2">
          <button type="submit" class="btn btn-primary">${editing ? "Salvar boleto" : "Cadastrar boleto"}</button>
          <button type="button" class="btn btn-secondary" data-action="clear-bills-form">Limpar formulário</button>
        </div>
      </form>
    </article>

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
    <div data-search-results-scope="bills" data-search-results-part="list">${renderBillsListPanel()}</div>
  `;
}


function renderChecksPage() {
  const editing = state.editing.checks;
  const formTitle = editing ? "Editar cheque" : "Dados do cheque";

  return `
    <section class="checks-studio-page">
      <header class="checks-studio-header">
        <button type="button" class="checks-menu-button" aria-label="Menu">
          ${renderChecksPageIcon("menu")}
        </button>
        <div>
          <h2>Cheques</h2>
          <p><span>Gestão</span><span aria-hidden="true">›</span><strong>Cheques</strong></p>
        </div>
      </header>

      <div data-search-results-scope="checks" data-search-results-part="metrics">${renderChecksStudioMetrics()}</div>

      <form id="checks-form" class="checks-studio-form" novalidate>
        <input type="hidden" name="id" value="${editing?.id ?? ""}">
        ${renderFormFeedback("checks")}

        <section class="checks-studio-card checks-details-card">
          <div class="checks-section-title">
            <span aria-hidden="true">${renderChecksPageIcon("user")}</span>
            <h3>${escapeHtml(formTitle)}</h3>
          </div>
          <div class="checks-details-grid">
            <label>
              <span>Número do cheque <em>*</em></span>
              <input type="text" name="check_number" value="${escapeHtml(toFormValue(editing?.check_number))}" placeholder="Ex.: 123456" required>
            </label>
            <label>
              <span>Emitente / Cliente <em>*</em></span>
              <input type="text" name="beneficiary" value="${escapeHtml(toFormValue(editing?.beneficiary))}" placeholder="Nome do emitente ou cliente" required>
            </label>
            <label>
              <span>Observações</span>
              <input type="text" name="notes" value="${escapeHtml(toFormValue(editing?.notes))}" placeholder="Ex.: banco, acordo, condição, etc.">
            </label>
          </div>
        </section>

        <section class="checks-studio-card checks-entry-card">
          <div class="checks-section-title">
            <span aria-hidden="true">${renderChecksPageIcon("file")}</span>
            <h3>${editing ? "Atualizar cheque" : "Adicionar cheque"}</h3>
          </div>
          <div class="checks-entry-grid">
            <label>
              <span>Valor <em>*</em></span>
              ${renderMoneyInput({ name: "amount", value: editing?.amount ?? 0, required: true })}
            </label>
            <label>
              <span>Data de emissão <em>*</em></span>
              <input type="date" name="issue_date" value="${editing?.issue_date || todayIso()}" required>
            </label>
            <label>
              <span>Vencimento <em>*</em></span>
              <input type="date" name="due_date" value="${editing?.due_date || todayIso()}" required>
            </label>
            <label>
              <span>Status <em>*</em></span>
              <select name="status" required>${renderCheckStatusOptions(editing?.status || "Pendente")}</select>
            </label>
            <button type="submit" class="btn btn-primary checks-add-button">
              ${renderChecksPageIcon("plus")}
              ${editing ? "Salvar cheque" : "Adicionar cheque"}
            </button>
          </div>
        </section>
      </form>

      <div data-search-results-scope="checks" data-search-results-part="list">${renderChecksListPanel()}</div>

      <div class="checks-footer-actions">
        <button type="button" class="btn btn-secondary" data-action="clear-checks-form">
          ${renderChecksPageIcon("plus")}
          Novo cheque
        </button>
        <button type="button" class="btn btn-secondary" data-action="clear-checks-form">
          ${renderChecksPageIcon("clean")}
          Limpar
        </button>
        <button type="submit" class="btn btn-secondary" form="checks-form">
          ${renderChecksPageIcon("save")}
          Salvar
        </button>
        <button type="button" class="btn btn-secondary" data-action="print-checks-page">
          ${renderChecksPageIcon("print")}
          Imprimir
        </button>
      </div>
    </section>
  `;
}


function renderDateCalculatorPage() {
  const calculation = state.dateCalculator;
  const differenceValue = calculation.differenceDays === null
    ? ""
    : `${formatNumber(calculation.differenceDays)} dia${calculation.differenceDays === 1 ? "" : "s"}`;

  return `
    ${renderHero(
      "Calcular Dias",
      "Calcule a diferença entre datas ou descubra uma data futura com facilidade.",
      `<button type="button" class="btn btn-secondary" data-action="clear-date-calculator">Limpar campos</button>`,
    )}

    <section class="page-grid page-grid-2 date-calculator-grid">
      <article class="panel date-calculator-panel">
        <div class="date-calculator-panel-head">
          <span class="date-calculator-panel-icon" aria-hidden="true">${renderDateCalculatorIcon("difference")}</span>
          <div>
            <h3>Calcular diferença entre datas</h3>
            <p>Compare duas datas e veja o intervalo exato em dias, sem depender de horário.</p>
          </div>
        </div>

        <form class="date-calculator-form" id="date-calculator-difference-form">
          <div class="date-calculator-form-grid">
            <label>
              <span>Data de início</span>
              <input
                type="date"
                name="difference_start_date"
                value="${escapeHtml(calculation.differenceStartDate || todayIso())}"
                data-date-calculator-field="differenceStartDate"
                required
              >
            </label>
            <label>
              <span>Data final</span>
              <input
                type="date"
                name="difference_end_date"
                value="${escapeHtml(calculation.differenceEndDate || todayIso())}"
                data-date-calculator-field="differenceEndDate"
                required
              >
            </label>
          </div>

          <p class="date-calculator-note">O cálculo considera apenas a data informada, sem influência de hora ou fuso.</p>
          ${renderDateCalculatorFeedback(calculation.differenceMessage, calculation.differenceTone)}

          <div class="date-calculator-actions">
            <button type="button" class="btn btn-primary" data-action="calculate-date-difference">Calcular diferença</button>
          </div>
        </form>

        ${renderDateCalculatorResultCard({
          eyebrow: "Resultado",
          title: "Diferença em dias",
          value: differenceValue,
          helper: calculation.differenceDays === null
            ? ""
            : `Entre ${formatDate(calculation.differenceStartDate)} e ${formatDate(calculation.differenceEndDate)} existem ${formatNumber(calculation.differenceDays)} dia${calculation.differenceDays === 1 ? "" : "s"} de diferença.`,
          tone: calculation.differenceTone === "error" ? "danger" : "brand",
          emptyText: "Escolha a data de início e a data final para ver a diferença em dias.",
        })}
      </article>

      <article class="panel date-calculator-panel">
        <div class="date-calculator-panel-head">
          <span class="date-calculator-panel-icon is-accent" aria-hidden="true">${renderDateCalculatorIcon("future")}</span>
          <div>
            <h3>Calcular data futura</h3>
            <p>Descubra qual será a data resultante ao avançar uma quantidade de dias e veja o dia da semana correspondente.</p>
          </div>
        </div>

        <form class="date-calculator-form" id="date-calculator-future-form">
          <div class="date-calculator-form-grid">
            <label>
              <span>Data base</span>
              <input
                type="date"
                name="future_base_date"
                value="${escapeHtml(calculation.futureBaseDate || todayIso())}"
                data-date-calculator-field="futureBaseDate"
                required
              >
            </label>
            <label>
              <span>Dias para frente</span>
              <input
                type="number"
                min="1"
                step="1"
                inputmode="numeric"
                placeholder="Ex.: 10"
                name="future_days_ahead"
                value="${escapeHtml(calculation.futureDaysAhead || "")}"
                data-date-calculator-field="futureDaysAhead"
                required
              >
            </label>
          </div>

          <p class="date-calculator-note">Aceita apenas números inteiros positivos para avançar a data base.</p>
          ${renderDateCalculatorFeedback(calculation.futureMessage, calculation.futureTone)}

          <div class="date-calculator-actions">
            <button type="button" class="btn btn-primary" data-action="calculate-future-date">Calcular data</button>
          </div>
        </form>

        ${renderDateCalculatorResultCard({
          eyebrow: "Resultado",
          title: "Nova data",
          value: calculation.futureResultDate ? formatDate(calculation.futureResultDate) : "",
          helper: calculation.futureResultDate
            ? `Dia da semana: ${calculation.futureWeekday}.`
            : "",
          tone: calculation.futureTone === "error" ? "danger" : "accent",
          emptyText: "Informe uma data base e quantos dias deseja avançar para descobrir o resultado.",
        })}
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
    const totalPaid = sumBy(rows, (item) => item.amount);
    const averageTicket = rows.length ? totalPaid / rows.length : 0;
    const largestExpense = [...rows].sort((left, right) => Number(right.amount || 0) - Number(left.amount || 0))[0];
    return {
      title: "Relatório de contas pagas",
      subtitle: period.label,
      metrics: [
        { label: "Total pago", value: formatMoney(totalPaid), helper: `${rows.length} lançamento(s)` },
        { label: "Ticket médio", value: formatMoney(averageTicket), helper: "Valor médio por lançamento" },
        { label: "Pagamento mais usado", value: getPaymentTotals(rows, "payment_method", "amount")[0]?.label || "-", helper: "Forma principal" },
        { label: "Maior lançamento", value: largestExpense ? formatMoney(largestExpense.amount) : "-", helper: largestExpense?.description || "Sem lançamentos" },
      ],
      chart: groupByDay(rows, "payment_date", (item) => item.amount, 7),
      tableHeaders: ["Data", "Descrição", "Pagamento", "Valor"],
      tableRows: rows.map((item) => [formatDate(item.payment_date), item.description, item.payment_method, formatMoney(item.amount)]),
      csvColumns: [
        { label: "Data", value: (item) => item.payment_date },
        { label: "Descrição", value: (item) => item.description },
        { label: "Pagamento", value: (item) => item.payment_method },
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
    "missing-items-form": () => submitMissingItemsForm(form),
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


function handlePageDragOver(event) {
  const dropzone = event.target instanceof HTMLElement
    ? event.target.closest("[data-products-upload-dropzone]")
    : null;
  if (!dropzone) return;
  event.preventDefault();
  dropzone.classList.add("is-dragover");
}


function handlePageDragLeave(event) {
  const dropzone = event.target instanceof HTMLElement
    ? event.target.closest("[data-products-upload-dropzone]")
    : null;
  if (!dropzone) return;
  if (event.relatedTarget instanceof Node && dropzone.contains(event.relatedTarget)) {
    return;
  }
  dropzone.classList.remove("is-dragover");
}


function handlePageDrop(event) {
  const dropzone = event.target instanceof HTMLElement
    ? event.target.closest("[data-products-upload-dropzone]")
    : null;
  if (!dropzone) return;
  event.preventDefault();
  dropzone.classList.remove("is-dragover");

  const fileInput = document.getElementById("products-import-file");
  const files = event.dataTransfer?.files;
  if (!(fileInput instanceof HTMLInputElement) || !files?.length) return;

  try {
    fileInput.files = files;
  } catch {
    return;
  }

  updateProductsImportSelection(fileInput);
}


function handlePageClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;

  const actionMap = {
    "clear-products-form": () => clearEditing("products"),
    "cancel-products-form": () => clearEditing("products"),
    "clear-customers-form": () => clearEditing("customers"),
    "customer-tab": () => {
      state.customersUi.activeTab = button.dataset.tab || "main";
      renderCurrentPage();
    },
    "view-customer": () => {
      state.customersUi.previewId = id || null;
      renderCurrentPage();
    },
    "close-customer-preview": () => {
      state.customersUi.previewId = null;
      renderCurrentPage();
    },
    "clear-sales-form": () => clearEditing("sales"),
    "clear-quotes-form": () => clearEditing("quotes"),
    "clear-expenses-form": () => clearEditing("expenses"),
    "clear-bills-form": () => clearEditing("bills"),
    "clear-checks-form": () => clearEditing("checks"),
    "reset-products-form": () => {
      const form = document.getElementById("products-form");
      if (form) {
        resetProductsForm(form);
      }
    },
    "products-prev-page": () => {
      state.filters.products.page = Math.max((state.filters.products.page || 1) - 1, 1);
      renderFilterResultsScope("products");
    },
    "products-next-page": () => {
      state.filters.products.page = (state.filters.products.page || 1) + 1;
      renderFilterResultsScope("products");
    },
    "products-go-page": () => {
      state.filters.products.page = Math.max(Number(button.dataset.page || 1), 1);
      renderFilterResultsScope("products");
    },
    "toggle-products-filters": () => {
      state.filters.products.show_advanced = !state.filters.products.show_advanced;
      renderCurrentPage();
    },
    "clear-products-filters": () => {
      resetProductsFilters();
      renderCurrentPage();
    },
    "products-quick-filter": () => {
      const nextValue = button.dataset.filterValue || "";
      state.filters.products.quick_filter = state.filters.products.quick_filter === nextValue ? "" : nextValue;
      state.filters.products.page = 1;
      renderCurrentPage();
    },
    "checks-quick-filter": () => {
      state.filters.checks.quick_filter = button.dataset.filterValue || "all";
      state.filters.checks.page = 1;
      renderFilterResultsScope("checks");
    },
    "missing-items-prev-page": () => {
      state.filters.missing_items.page = Math.max((state.filters.missing_items.page || 1) - 1, 1);
      renderFilterResultsScope("missing_items");
    },
    "missing-items-next-page": () => {
      state.filters.missing_items.page = (state.filters.missing_items.page || 1) + 1;
      renderFilterResultsScope("missing_items");
    },
    "missing-items-go-page": () => {
      state.filters.missing_items.page = Math.max(Number(button.dataset.page || 1), 1);
      renderFilterResultsScope("missing_items");
    },
    "apply-missing-items-filter": () => {
      state.filters.missing_items.page = 1;
      renderCurrentPage();
    },
    "request-missing-item-arrived": () => {
      void markMissingItemArrived(id);
    },
    "bills-prev-page": () => {
      state.filters.bills.page = Math.max((state.filters.bills.page || 1) - 1, 1);
      renderFilterResultsScope("bills");
    },
    "bills-next-page": () => {
      state.filters.bills.page = (state.filters.bills.page || 1) + 1;
      renderFilterResultsScope("bills");
    },
    "bills-go-page": () => {
      state.filters.bills.page = Math.max(Number(button.dataset.page || 1), 1);
      renderFilterResultsScope("bills");
    },
    "request-bill-paid-confirmation": () => {
      void requestBillPaidConfirmation(id);
    },
    "checks-prev-page": () => {
      state.filters.checks.page = Math.max((state.filters.checks.page || 1) - 1, 1);
      renderFilterResultsScope("checks");
    },
    "checks-next-page": () => {
      state.filters.checks.page = (state.filters.checks.page || 1) + 1;
      renderFilterResultsScope("checks");
    },
    "checks-go-page": () => {
      state.filters.checks.page = Math.max(Number(button.dataset.page || 1), 1);
      renderFilterResultsScope("checks");
    },
    "mark-check-compensated": () => {
      void toggleCheckCompensated(id, true);
    },
    "print-checks-page": () => {
      window.print();
    },
    "clear-products-import": () => {
      clearProductsImportSelection();
    },
    "sales-prev-page": () => {
      state.filters.sales.page = Math.max((state.filters.sales.page || 1) - 1, 1);
      renderFilterResultsScope("sales");
    },
    "sales-next-page": () => {
      state.filters.sales.page = (state.filters.sales.page || 1) + 1;
      renderFilterResultsScope("sales");
    },
    "sales-go-page": () => {
      state.filters.sales.page = Math.max(Number(button.dataset.page || 1), 1);
      renderFilterResultsScope("sales");
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
    "toggle-sales-filters": () => {
      state.filters.sales.show_advanced = !state.filters.sales.show_advanced;
      renderCurrentPage();
    },
    "show-all-sales-history": () => {
      const salesDates = state.data.sales
        .map((sale) => sale.sale_date)
        .filter(Boolean)
        .sort();

      state.filters.sales.search = "";
      state.filters.sales.payment_method = "";
      state.filters.sales.page = 1;
      state.filters.sales.show_advanced = true;

      if (salesDates.length) {
        state.filters.sales.preset = "custom";
        state.filters.sales.start = salesDates[0];
        state.filters.sales.end = salesDates[salesDates.length - 1];
      } else {
        state.filters.sales.preset = "month";
        state.filters.sales.start = monthStart;
        state.filters.sales.end = todayIso();
      }

        renderCurrentPage();
      },
      "edit-product": () => editEntity("products", id),
      "duplicate-product": () => {
        const product = state.data.products.find((item) => String(item.id) === String(id));
        if (!product) return;
        state.editing.products = buildDuplicateProductDraft(product);
        clearFormFeedback("products");
        renderCurrentPage();
      },
    "edit-customer": () => editEntity("customers", id),
    "edit-sale": () => editEntity("sales", id),
      "edit-quote": () => editEntity("quotes", id),
      "duplicate-quote": () => {
        const quote = state.data.quotes.find((item) => String(item.id) === String(id));
        if (!quote) return;
        state.editing.quotes = buildDuplicateQuoteDraft(quote);
        clearFormFeedback("quotes");
        renderCurrentPage();
      },
      "edit-expense": () => editEntity("expenses", id),
    "edit-bill": () => editEntity("bills", id),
    "edit-check": () => editEntity("checks", id),
    "delete-product": () => deleteEntity("products", id, "produto"),
    "delete-customer": () => deleteEntity("customers", id, "cliente"),
    "delete-sale": () => deleteEntity("sales", id, "venda"),
    "delete-quote": () => deleteEntity("quotes", id, "orçamento"),
    "delete-expense": () => deleteEntity("expenses", id, "conta paga"),
    "delete-bill": () => deleteEntity("bills", id, "boleto"),
    "delete-missing-item": () => deleteMissingItem(id),
    "delete-check": () => deleteEntity("checks", id, "cheque"),
    "pdf-quote": () => {
      if (id) {
        void openQuotePdfDocument(id).catch((error) => showToast(error.message, "error"));
      }
    },
    "generate-quote-pdf": () => {
      void handleCurrentQuoteDocumentAction();
    },
    "open-new-nfe-page": () => {
      window.location.assign("/nfe/nova");
    },
    "toggle-fiscal-settings-editor": () => {
      state.nfe.fiscalEditorOpen = !state.nfe.fiscalEditorOpen;
      if (!state.nfe.fiscalEditorOpen) {
        clearFormFeedback("fiscal");
      }
      renderCurrentPage();
    },
    "scroll-nfe-history": () => {
      const historySection = document.getElementById("nfe-issued-history");
      historySection?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    "calculate-date-difference": () => {
      const { differenceStartDate, differenceEndDate } = state.dateCalculator;
      if (!differenceStartDate || !differenceEndDate) {
        state.dateCalculator.differenceDays = null;
        state.dateCalculator.differenceTone = "error";
        state.dateCalculator.differenceMessage = "Informe a data de início e a data final para calcular a diferença.";
        renderCurrentPage();
        return;
      }

      const difference = diffDaysBetweenIsoDates(differenceStartDate, differenceEndDate);
      if (difference === null) {
        state.dateCalculator.differenceDays = null;
        state.dateCalculator.differenceTone = "error";
        state.dateCalculator.differenceMessage = "Não foi possível interpretar as datas informadas. Revise os campos e tente novamente.";
        renderCurrentPage();
        return;
      }

      if (difference < 0) {
        state.dateCalculator.differenceDays = null;
        state.dateCalculator.differenceTone = "error";
        state.dateCalculator.differenceMessage = "A data final não pode ser anterior à data inicial.";
        renderCurrentPage();
        return;
      }

      state.dateCalculator.differenceDays = difference;
      state.dateCalculator.differenceTone = "success";
      state.dateCalculator.differenceMessage = `Entre ${formatDate(differenceStartDate)} e ${formatDate(differenceEndDate)} existem ${formatNumber(difference)} dia${difference === 1 ? "" : "s"} de diferença.`;
      renderCurrentPage();
    },
    "calculate-future-date": () => {
      const { futureBaseDate, futureDaysAhead } = state.dateCalculator;
      const daysAhead = Number(futureDaysAhead);

      if (!futureBaseDate) {
        state.dateCalculator.futureResultDate = "";
        state.dateCalculator.futureWeekday = "";
        state.dateCalculator.futureTone = "error";
        state.dateCalculator.futureMessage = "Informe a data base para calcular a data futura.";
        renderCurrentPage();
        return;
      }

      if (!futureDaysAhead || !Number.isInteger(daysAhead) || daysAhead <= 0) {
        state.dateCalculator.futureResultDate = "";
        state.dateCalculator.futureWeekday = "";
        state.dateCalculator.futureTone = "error";
        state.dateCalculator.futureMessage = "Informe uma quantidade válida de dias usando apenas números inteiros positivos.";
        renderCurrentPage();
        return;
      }

      const resultDate = addDaysToIsoDate(futureBaseDate, daysAhead);
      if (!resultDate) {
        state.dateCalculator.futureResultDate = "";
        state.dateCalculator.futureWeekday = "";
        state.dateCalculator.futureTone = "error";
        state.dateCalculator.futureMessage = "Não foi possível calcular a data futura com os valores informados.";
        renderCurrentPage();
        return;
      }

      const weekday = getFullWeekdayLabel(resultDate);
      state.dateCalculator.futureResultDate = resultDate;
      state.dateCalculator.futureWeekday = weekday;
      state.dateCalculator.futureTone = "success";
      state.dateCalculator.futureMessage = `Resultado: ${formatDate(resultDate)}. Dia da semana: ${weekday}.`;
      renderCurrentPage();
    },
    "clear-date-calculator": () => {
      state.dateCalculator = createInitialDateCalculatorState();
      renderCurrentPage();
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

  if (target instanceof HTMLInputElement && target.dataset.dateCalculatorField) {
    updateDateCalculatorField(target.dataset.dateCalculatorField, target.value);
    return;
  }

  if (target instanceof HTMLInputElement && target.id === "products-import-file") {
    updateProductsImportSelection(target);
    return;
  }

  if (target instanceof HTMLInputElement && target.dataset.action === "mark-missing-item-arrived") {
    void markMissingItemArrived(target.dataset.id);
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
      if (scope === "sales" && target.name !== "page") {
        state.filters.sales.page = 1;
      }
      if (scope === "products" && target.name !== "page") {
        state.filters.products.page = 1;
      }
      if (scope === "missing_items" && target.name !== "page") {
        state.filters.missing_items.page = 1;
      }
      if (scope === "bills" && target.name !== "page") {
        state.filters.bills.page = 1;
      }
      if (scope === "checks" && target.name !== "page") {
        state.filters.checks.page = 1;
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
  if (form?.getAttribute("id") === "customers-form") {
    const fieldName = target.getAttribute("name") || "";
    if (fieldName === "person_type" || fieldName === "ie_indicator") {
      syncCustomerFormVisibility(form);
    }
    if (fieldName === "zip_code") {
      target.value = formatZipCode(target.value);
      void hydrateCustomerAddressFromCep(form, target.value);
    }
    if (fieldName === "state") {
      target.value = String(target.value || "").toUpperCase().slice(0, 2);
    }
  }

  if (form?.getAttribute("id") === "checks-form" && target.getAttribute("name") === "check_number") {
    target.value = normalizeCheckNumberValue(target.value);
  }

  if (form?.getAttribute("id") === "products-form") {
    const fieldName = target.getAttribute("name") || "";
    if (fieldName === "margin_percent") {
      updateProductPricing(form, "margin");
      return;
    }
    if (fieldName === "active") {
      return;
    }
  }

  if (form?.getAttribute("id") === "quotes-form") {
    const fieldName = target.getAttribute("name") || "";
    if (["draft_item_name", "draft_unit", "draft_quantity", "draft_unit_price"].includes(fieldName)) {
      updateQuoteTotals(form);
      return;
    }
    if (fieldName === "quote_date") {
      syncQuoteValidityField(form);
      return;
    }
    if (fieldName === "validity_date") {
      target.dataset.autoManaged = String(shouldKeepQuoteValidityAutomatic(
        form.querySelector('[name="quote_date"]')?.value,
        target.value,
      ));
      updateQuoteTotals(form);
      return;
    }
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
  }
}


function handlePageInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (target instanceof HTMLInputElement && target.dataset.dateCalculatorField) {
    updateDateCalculatorField(target.dataset.dateCalculatorField, target.value);
    if (target.dataset.dateCalculatorField === "futureDaysAhead") {
      target.value = state.dateCalculator.futureDaysAhead;
    }
    return;
  }

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
    if (scope === "sales") {
      state.filters.sales.page = 1;
    }
    if (scope === "products") {
      state.filters.products.page = 1;
    }
    if (scope === "missing_items") {
      state.filters.missing_items.page = 1;
    }
    if (scope === "bills") {
      state.filters.bills.page = 1;
    }
    if (scope === "checks") {
      state.filters.checks.page = 1;
    }
    clearTimeout(searchTimers.get(scope));
    searchTimers.set(scope, setTimeout(() => {
      searchTimers.delete(scope);
      if (scope === "missing_items") {
        renderCurrentPage();
        return;
      }
      renderFilterResultsScope(scope);
    }, SEARCH_INPUT_DEBOUNCE_MS));
    return;
  }

  const form = target.closest("form");
  if (form?.getAttribute("id") === "customers-form") {
    const fieldName = target.getAttribute("name") || "";
    if (fieldName === "cpf" || fieldName === "cnpj" || fieldName === "city_ibge_code") {
      target.value = digitsOnly(target.value);
    }
    if (fieldName === "zip_code") {
      target.value = formatZipCode(target.value);
    }
    if (fieldName === "state") {
      target.value = String(target.value || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
    }
  }

  if (form?.getAttribute("id") === "products-form") {
    const fieldName = target.getAttribute("name") || "";
    if (fieldName === "margin_percent") {
      updateProductPricing(form, "margin");
      return;
    }
    if (fieldName === "cost_price") {
      updateProductPricing(form, "cost");
      return;
    }
    if (fieldName === "sale_price") {
      updateProductPricing(form, "sale");
      return;
    }
  }

  if (form?.getAttribute("id") === "quotes-form") {
    const fieldName = target.getAttribute("name") || "";
    if (["draft_quantity", "draft_unit", "draft_unit_price", "draft_item_name"].includes(fieldName)) {
      updateQuoteTotals(form);
      return;
    }
    if (fieldName === "validity_date") {
      target.dataset.autoManaged = String(shouldKeepQuoteValidityAutomatic(
        form.querySelector('[name="quote_date"]')?.value,
        target.value,
      ));
      return;
    }
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
  if (scope === "customers") {
    state.customersUi.activeTab = "main";
    state.customersUi.previewId = null;
  }
  if (scope === "quotes") {
    resetQuoteComposer();
  }
  clearFormFeedback(scope);
  renderCurrentPage();
}


function editEntity(scope, id) {
  state.editing[scope] = state.data[scope].find((item) => String(item.id) === String(id)) || null;
  if (scope === "customers") {
    state.customersUi.activeTab = "main";
    state.customersUi.previewId = id || null;
  }
  if (scope === "quotes") {
    resetQuoteComposer();
  }
  clearFormFeedback(scope);
  renderCurrentPage();
}


async function deleteEntity(scope, id, label) {
  const confirmed = await showConfirmDialog({
    title: "Confirmar exclusão",
    message: `Tem certeza que deseja excluir este ${label}?`,
    detail: "Essa ação não poderá ser desfeita.",
    confirmLabel: "Excluir",
    cancelLabel: "Cancelar",
    tone: "danger",
  });
  if (!confirmed) {
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


async function deleteMissingItem(id) {
  const confirmed = await showConfirmDialog({
    title: "Confirmar exclusão",
    message: "Deseja excluir este item faltante?",
    detail: "Essa ação remove o item da lista de faltantes.",
    confirmLabel: "Excluir",
    cancelLabel: "Cancelar",
    tone: "danger",
  });
  if (!confirmed) {
    return;
  }

  try {
    await api.remove("missing-items", id);
    state.editing.missing_items = null;
    clearFormFeedback("missing_items");
    await loadData();
    showToast("Item faltante excluído com sucesso.");
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


async function requestBillPaidConfirmation(id) {
  if (!id) return;
  const bill = state.data.bills.find((item) => String(item.id) === String(id));
  if (!bill || bill.is_paid) return;

  const confirmed = await showConfirmDialog({
    title: "Confirmar pagamento",
    message: "Deseja marcar como pago esse boleto?",
    detail: bill.beneficiary || "",
    confirmLabel: "Sim",
    cancelLabel: "Cancelar",
  });

  if (confirmed) {
    await toggleBillPaid(id, true);
  }
}


async function toggleCheckCompensated(id, isCompensated, input = null) {
  if (!id) return;
  if (!isCompensated) {
    if (input instanceof HTMLInputElement) {
      input.checked = false;
    }
    return;
  }

  const confirmed = await showConfirmDialog({
    title: "Confirmar compensação",
    message: "Deseja marcar este cheque como compensado?",
    confirmLabel: "Sim",
    cancelLabel: "Cancelar",
  });
  if (!confirmed) {
    if (input instanceof HTMLInputElement) {
      input.checked = false;
    }
    return;
  }

  try {
    await api.update("checks", id, { status: "Compensado" });
    if (state.editing.checks && String(state.editing.checks.id) === String(id)) {
      state.editing.checks = null;
    }
    clearFormFeedback("checks");
    await loadData();
    showToast("Cheque marcado como compensado com sucesso.");
  } catch (error) {
    if (input instanceof HTMLInputElement) {
      input.checked = false;
    }
    showToast(error.message, "error");
    await loadData();
  }
}


async function markMissingItemArrived(id) {
  if (!id) return;
  const confirmed = await showConfirmDialog({
    title: "Confirmar recebimento",
    message: "Deseja marcar este item como recebido?",
    confirmLabel: "Sim",
    cancelLabel: "Cancelar",
  });
  if (!confirmed) {
    await loadData();
    return;
  }

  try {
    await api.remove("missing-items", id);
    state.editing.missing_items = null;
    clearFormFeedback("missing_items");
    await loadData();
    showToast("Item marcado como recebido.");
  } catch (error) {
    showToast(error.message, "error");
    await loadData();
  }
}


async function submitMissingItemsForm(form) {
  const payload = normalizePayload(Object.fromEntries(new FormData(form).entries()));
  const name = String(payload.name || "").trim();

  if (!name) {
    const message = "Informe o nome do item faltante.";
    updateFormFeedback("missing_items", form, message, "error");
    showToast(message, "error");
    return;
  }

  setFormBusy(form, true);
  try {
    await api.post("/api/missing-items", { name });
    setFormFeedback("missing_items", "Item cadastrado com sucesso!", "success");
    showToast("Item faltante cadastrado com sucesso.");
    state.editing.missing_items = null;
    await loadData();
  } catch (error) {
    updateFormFeedback("missing_items", form, error.message, "error");
    showToast(error.message, "error");
  } finally {
    setFormBusy(form, false);
  }
}


async function submitSimpleForm(form, scope) {
  const payload = normalizeMoneyPayload(
    form,
    normalizePayload(Object.fromEntries(new FormData(form).entries())),
  );
  const id = payload.id;
  delete payload.id;
  if (scope === "products") {
    delete payload.margin_percent;
  }
  if (scope === "customers") {
    Object.assign(payload, normalizeCustomerPayload(payload));
  }
  if (scope === "checks") {
    payload.check_number = normalizeCheckNumberValue(payload.check_number);
    const checkNumberField = form.querySelector('[name="check_number"]');
    if (checkNumberField instanceof HTMLInputElement) {
      checkNumberField.value = payload.check_number || "";
    }
  }

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
    state.nfe.fiscalEditorOpen = false;
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
  await persistQuoteForm(form);
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
      updateProductsImportSelection(fileInput);
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

// ===== AUTO ATUALIZAÇÃO DA HORA DA VENDA =====
(function () {
  let intervaloHoraVenda = null;
  let usuarioAlterouHoraVenda = false;
  let campoHoraAtual = null;

  function horaAtualHHMM() {
    const agora = new Date();
    const h = String(agora.getHours()).padStart(2, "0");
    const m = String(agora.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }

  function encontrarCampoHoraVenda() {
    return (
      document.querySelector('#sales-form input[type="time"]') ||
      document.querySelector('input[name="sale_time"]') ||
      document.querySelector('input[name="time"]') ||
      document.querySelector('input[type="time"]')
    );
  }

  function atualizarHoraVenda() {
    const campo = encontrarCampoHoraVenda();

    if (!campo) return;

    if (campoHoraAtual !== campo) {
      campoHoraAtual = campo;
      usuarioAlterouHoraVenda = false;

      campo.addEventListener("input", () => {
        usuarioAlterouHoraVenda = true;
      });
    }

    if (!usuarioAlterouHoraVenda) {
      campo.value = horaAtualHHMM();
    }
  }

  function iniciarRelogioVenda() {
    if (intervaloHoraVenda) {
      clearInterval(intervaloHoraVenda);
    }

    atualizarHoraVenda();
    intervaloHoraVenda = setInterval(atualizarHoraVenda, 10000);
  }

  document.addEventListener("DOMContentLoaded", iniciarRelogioVenda);

  const observador = new MutationObserver(() => {
    atualizarHoraVenda();
  });

  observador.observe(document.body, {
    childList: true,
    subtree: true,
  });

  iniciarRelogioVenda();
})();
