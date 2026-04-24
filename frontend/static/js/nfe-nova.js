import { api } from "/static/js/api.js";

const BRAND_NAME = "Material de Construção Dois Irmãos";
const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const numberFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const PAYMENT_METHOD_OPTIONS = ["Dinheiro", "Pix", "Débito", "Crédito", "Cheque", "Boleto", "À Prazo"];

const state = {
  user: null,
  products: [],
  customers: [],
  settings: {},
  items: [],
  busy: false,
  feedback: null,
  lastEmission: null,
  draft: {
    customer_id: "",
    payment_method: "Dinheiro",
    notes: "",
    product_search: "",
  },
};

const elements = {
  root: document.getElementById("nfe-builder-root"),
  userName: document.getElementById("nfe-user-name"),
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindEvents();
  try {
    const auth = await api.me();
    state.user = auth.user;
    elements.userName.textContent = state.user?.full_name || "Administrador";
  } catch {
    window.location.assign("/");
    return;
  }

  try {
    const bootstrap = await api.bootstrap();
    state.products = (bootstrap.products || []).filter((product) => product.active !== false);
    state.customers = bootstrap.customers || [];
    state.settings = bootstrap.fiscal_settings || {};
    document.title = `${BRAND_NAME} | Nova NF-e`;
    render();
  } catch (error) {
    state.feedback = { tone: "error", message: error.message || "Não foi possível carregar a página da NF-e." };
    render();
  }
}

function bindEvents() {
  elements.root.addEventListener("submit", handleSubmit);
  elements.root.addEventListener("click", handleClick);
  elements.root.addEventListener("input", handleInput);
  elements.root.addEventListener("change", handleChange);
  elements.root.addEventListener("focusin", handleFocusIn);
  elements.root.addEventListener("beforeinput", handleBeforeInput);
  elements.root.addEventListener("paste", handlePaste);
}

function render() {
  const settingsReady = Boolean(
    state.settings.company_name
    && state.settings.trade_name
    && state.settings.cnpj
    && state.settings.state_registration
    && state.settings.city
    && state.settings.state,
  );
  const totalAmount = getItemsTotal();
  const selectedCustomer = getSelectedCustomer();

  elements.root.innerHTML = `
    <section class="metrics-grid metrics-grid-4">
      ${renderMetricCard("Produtos disponíveis", formatNumber(state.products.length), "Busca por nome ou SKU")}
      ${renderMetricCard("Itens na NF-e", formatNumber(state.items.length), "Lista montada nesta página", state.items.length ? "brand" : "neutral")}
      ${renderMetricCard("Total da NF-e", formatMoney(totalAmount), "Atualiza conforme os itens", totalAmount > 0 ? "success" : "neutral")}
      ${renderMetricCard("Emitente fiscal", settingsReady ? "Pronto" : "Pendente", settingsReady ? "Configuração fiscal preenchida" : "Revise a aba NF-e do painel", settingsReady ? "success" : "warning")}
    </section>

    ${state.feedback ? renderFeedback(state.feedback.tone, state.feedback.message) : ""}

    ${state.lastEmission ? `
      <section class="panel nfe-emission-result">
        <div class="section-header">
          <div>
            <h3>NF-e emitida com sucesso</h3>
            <p>Os arquivos fiscais já estão disponíveis para baixar.</p>
          </div>
        </div>
        <div class="quick-summary-card-grid">
          <div class="quick-summary-card emphasis">
            <span>Número</span>
            <strong>${escapeHtml(String(state.lastEmission.number_nfe || "-"))}</strong>
            <small>Série ${escapeHtml(String(state.lastEmission.series_nfe || "-"))}</small>
          </div>
          <div class="quick-summary-card">
            <span>Cliente</span>
            <strong>${escapeHtml(state.lastEmission.customer_name || "Cliente não informado")}</strong>
            <small>${escapeHtml(state.lastEmission.status_nfe || "-")}</small>
          </div>
          <div class="quick-summary-card">
            <span>Total</span>
            <strong>${formatMoney(state.lastEmission.total_amount || 0)}</strong>
            <small>${escapeHtml((state.lastEmission.authorization_date || "").slice(0, 10) || "Data não informada")}</small>
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" data-action="download-xml" data-id="${state.lastEmission.id}">Baixar XML</button>
          <button type="button" class="btn btn-primary" data-action="download-pdf" data-id="${state.lastEmission.id}">Baixar PDF</button>
          <button type="button" class="btn btn-secondary" data-action="new-draft">Emitir outra NF-e</button>
        </div>
      </section>
    ` : ""}

    <form id="nfe-builder-form" class="nfe-builder-layout">
      <section class="panel">
        <div class="section-header">
          <div>
            <h3>Cliente</h3>
            <p>Selecione um cliente cadastrado para preencher automaticamente os dados fiscais da NF-e.</p>
          </div>
        </div>
        <div class="form-grid nfe-form-grid">
          <label class="field-span-2">
            <span>Selecionar cliente</span>
            <select name="customer_id" required>
              <option value="">Selecione um cliente cadastrado</option>
              ${state.customers.map((customer) => `
                <option value="${customer.id}" ${String(state.draft.customer_id) === String(customer.id) ? "selected" : ""}>
                  ${escapeHtml(buildCustomerOptionLabel(customer))}
                </option>
              `).join("")}
            </select>
          </label>
          <label>
            <span>Forma de pagamento</span>
            <select name="payment_method">
              ${PAYMENT_METHOD_OPTIONS.map((item) => `
                <option value="${item}" ${state.draft.payment_method === item ? "selected" : ""}>${item}</option>
              `).join("")}
            </select>
          </label>
          <label class="field-span-2">
            <span>Observações</span>
            <textarea name="notes" rows="4" placeholder="Informações complementares da NF-e">${escapeHtml(state.draft.notes)}</textarea>
          </label>
          ${selectedCustomer ? `
            <div class="field-span-2 nfe-customer-summary">
              <div class="nfe-customer-summary-grid">
                <article class="quick-summary-card">
                  <span>Destinatário</span>
                  <strong>${escapeHtml(selectedCustomer.name || "-")}</strong>
                  <small>${escapeHtml(selectedCustomer.person_type === "PJ" ? "Pessoa jurídica" : "Pessoa física")}</small>
                </article>
                <article class="quick-summary-card">
                  <span>Documento</span>
                  <strong>${escapeHtml(selectedCustomer.document_formatted || "-")}</strong>
                  <small>${escapeHtml(selectedCustomer.ie_indicator === "Nao contribuinte" ? "Não contribuinte" : selectedCustomer.ie_indicator || "-")}</small>
                </article>
                <article class="quick-summary-card">
                  <span>Localidade</span>
                  <strong>${escapeHtml([selectedCustomer.city, selectedCustomer.state].filter(Boolean).join("/") || "-")}</strong>
                  <small>IBGE ${escapeHtml(selectedCustomer.city_ibge_code || "-")}</small>
                </article>
              </div>
              <div class="nfe-customer-summary-details">
                <p><strong>Endereço:</strong> ${escapeHtml(buildCustomerAddress(selectedCustomer))}</p>
                <p><strong>Contato:</strong> ${escapeHtml(selectedCustomer.phone || selectedCustomer.email || "Não informado")}</p>
                <p><strong>IE:</strong> ${escapeHtml(selectedCustomer.state_registration || "Não se aplica")}</p>
              </div>
            </div>
          ` : `
            <div class="field-span-2 empty-state compact">
              <strong>Selecione um cliente para continuar</strong>
              <p>O XML e o DANFE usarão automaticamente os dados fiscais do cadastro escolhido.</p>
            </div>
          `}
        </div>
      </section>

      <section class="panel">
        <div class="section-header">
          <div>
            <h3>Itens da NF-e</h3>
            <p>Busque o produto por nome ou SKU, adicione na lista e ajuste quantidade ou valor unitário se necessário.</p>
          </div>
        </div>

        <div class="nfe-product-adder">
          <label class="toolbar-field">
            <span>Produto</span>
            <input
              type="text"
              name="product_search"
              list="nfe-product-suggestions"
              value="${escapeHtml(state.draft.product_search)}"
              placeholder="Digite SKU ou nome do produto"
              autocomplete="off"
            >
            <datalist id="nfe-product-suggestions">
              ${state.products.map((product) => `
                ${product.sku || product.code ? `<option value="${escapeHtml(product.sku || product.code)}">${escapeHtml(`${product.sku || product.code} • ${product.name}`)}</option>` : ""}
                <option value="${escapeHtml(product.name || "")}">${escapeHtml(`${product.sku || product.code || ""} • ${product.name}`)}</option>
              `).join("")}
            </datalist>
          </label>
          <button type="button" class="btn btn-primary" data-action="add-item">Adicionar item</button>
        </div>

        ${state.items.length ? `
          <div class="nfe-items-stack">
            ${state.items.map((item) => renderItemRow(item)).join("")}
          </div>
        ` : `
          <div class="empty-state compact">
            <strong>Nenhum item adicionado</strong>
            <p>Comece buscando um produto por nome ou SKU e clique em "Adicionar item".</p>
          </div>
        `}
      </section>

      <section class="panel">
        <div class="section-header">
          <div>
            <h3>Resumo da NF-e</h3>
            <p>Confira o total antes de emitir os arquivos fiscais mock.</p>
          </div>
        </div>

        <div class="quick-summary-card-grid">
          <div class="quick-summary-card">
            <span>Itens</span>
            <strong>${formatNumber(state.items.length)}</strong>
            <small>${state.items.length ? "Item(ns) pronto(s) para emissão" : "Adicione produtos para continuar"}</small>
          </div>
          <div class="quick-summary-card">
            <span>Forma de pagamento</span>
            <strong>${escapeHtml(state.draft.payment_method || "-")}</strong>
            <small>Esse dado segue para o XML/PDF mock</small>
          </div>
          <div class="quick-summary-card emphasis">
            <span>Total da NF-e</span>
            <strong id="nfe-total-amount">${formatMoney(totalAmount)}</strong>
            <small>Calculado automaticamente pela soma dos itens</small>
          </div>
        </div>

        <div class="form-actions nfe-builder-actions">
          <button type="submit" class="btn btn-primary btn-block" ${state.busy ? "disabled" : ""}>
            ${state.busy ? "Emitindo NF-e..." : "Emitir NF-e"}
          </button>
        </div>
      </section>
    </form>
  `;

  syncMoneyInputs(elements.root);
  updateTotalsUI();
}

function renderItemRow(item) {
  return `
    <article class="nfe-item-row" data-item-id="${item.id}">
      <div class="nfe-item-main">
        <strong>${escapeHtml(item.description)}</strong>
        <small>
          SKU ${escapeHtml(item.sku || "-")} • NCM ${escapeHtml(item.ncm || "-")} • CFOP ${escapeHtml(item.cfop || "-")} • Origem ${escapeHtml(item.origin || "-")} • CSOSN ${escapeHtml(item.csosn || "-")}
        </small>
      </div>
      <label>
        <span>Quantidade</span>
        <input type="number" min="0.01" step="0.01" value="${escapeHtml(String(item.quantity))}" data-item-field="quantity" data-item-id="${item.id}">
      </label>
      <label>
        <span>Valor unitário</span>
        ${renderMoneyInput(`unit_price_${item.id}`, item.unit_price, item.id)}
      </label>
      <div class="nfe-item-total">
        <span>Total</span>
        <strong data-item-total="${item.id}">${formatMoney(getItemSubtotal(item))}</strong>
        <small>${escapeHtml(item.unit || "UN")}</small>
      </div>
      <button type="button" class="btn btn-secondary nfe-item-remove" data-action="remove-item" data-id="${item.id}">Remover</button>
    </article>
  `;
}

function renderMoneyInput(name, value, itemId) {
  return `
    <div class="money-input-shell money-input-large">
      <span class="money-prefix">R$</span>
      <input
        type="text"
        name="${name}"
        value="${escapeHtml(formatMoneyInputValue(value))}"
        inputmode="numeric"
        autocomplete="off"
        data-money-input
        data-item-id="${itemId}"
        data-item-field="unit_price"
      >
    </div>
  `;
}

function renderMetricCard(label, value, helper, tone = "neutral") {
  return `
    <article class="metric-card ${tone !== "neutral" ? `metric-${tone}` : ""}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
      <small>${escapeHtml(helper)}</small>
    </article>
  `;
}

function renderFeedback(tone, message) {
  return `<p class="form-feedback form-feedback-${tone === "error" ? "error" : "success"}">${escapeHtml(message)}</p>`;
}

function handleClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;

  if (action === "add-item") {
    addItemFromSearch();
    return;
  }

  if (action === "remove-item") {
    state.items = state.items.filter((item) => String(item.id) !== String(id));
    render();
    return;
  }

  if (action === "download-xml") {
    window.open(`/api/nfe/${id}/xml`, "_blank", "noopener");
    return;
  }

  if (action === "download-pdf") {
    window.open(`/api/nfe/${id}/pdf`, "_blank", "noopener");
    return;
  }

  if (action === "new-draft") {
    resetDraft();
    render();
  }
}

function handleInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (isMoneyInput(target)) {
    updateItemField(target.dataset.itemId, "unit_price", parseMoneyInputValue(target.value));
    updateTotalsUI();
    return;
  }

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    const itemField = target.dataset.itemField;
    if (itemField) {
      updateItemField(target.dataset.itemId, itemField, target.value);
      updateTotalsUI();
      return;
    }

    if (target.name) {
      state.draft[target.name] = target.value;
    }
  }
}

function handleChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (target instanceof HTMLSelectElement && target.name === "customer_id") {
    state.draft.customer_id = target.value;
    render();
    return;
  }

  if (target instanceof HTMLInputElement && target.name === "product_search") {
    state.draft.product_search = target.value;
  }
}

function handleFocusIn(event) {
  const target = event.target;
  if (!isMoneyInput(target)) return;
  setMoneyCaretToEnd(target);
}

function handleBeforeInput(event) {
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

function handlePaste(event) {
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

async function handleSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.id !== "nfe-builder-form") return;

  event.preventDefault();
  state.feedback = null;

  if (!state.items.length) {
    state.feedback = { tone: "error", message: "Adicione pelo menos um item antes de emitir a NF-e." };
    render();
    return;
  }

  if (!String(state.draft.customer_id || "").trim()) {
    state.feedback = { tone: "error", message: "Selecione um cliente cadastrado para emitir a NF-e." };
    render();
    return;
  }

  state.busy = true;
  render();

  try {
    const payload = {
      customer_id: Number(state.draft.customer_id),
      payment_method: state.draft.payment_method,
      notes: state.draft.notes,
      items: state.items.map((item) => ({
        product_id: item.product_id,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price.toFixed(2)),
      })),
    };
    const response = await api.post("/api/nfe/emit", payload);
    state.lastEmission = response.item;
    state.feedback = { tone: "success", message: "NF-e emitida com sucesso. Os arquivos fiscais já estão disponíveis." };
    resetDraft();
  } catch (error) {
    state.feedback = { tone: "error", message: error.message || "Não foi possível emitir a NF-e." };
  } finally {
    state.busy = false;
    render();
  }
}

function addItemFromSearch() {
  const searchValue = String(state.draft.product_search || "").trim();
  if (!searchValue) {
    state.feedback = { tone: "error", message: "Digite o nome ou o SKU de um produto para adicionar." };
    render();
    return;
  }

  const product = findProduct(searchValue);
  if (!product) {
    state.feedback = { tone: "error", message: "Produto não encontrado. Digite um SKU ou nome válido da lista." };
    render();
    return;
  }

  state.items.push({
    id: generateId(),
    product_id: product.id,
    sku: product.sku || product.code || "",
    description: product.name || "Produto",
    unit: product.unit || "UN",
    quantity: 1,
    unit_price: Number(product.sale_price || 0),
    ncm: product.ncm || "",
    cfop: product.cfop_default || "",
    origin: product.origin || "",
    csosn: product.csosn || "",
  });
  state.draft.product_search = "";
  state.feedback = null;
  render();
}

function findProduct(searchValue) {
  const normalizedSearch = normalizeText(searchValue);
  return state.products.find((product) => {
    const candidates = [
      product.sku,
      product.code,
      product.name,
      `${product.sku || product.code || ""} • ${product.name || ""}`,
    ];
    return candidates.some((candidate) => normalizeText(candidate) === normalizedSearch);
  });
}


function getSelectedCustomer() {
  const selectedId = String(state.draft.customer_id || "").trim();
  if (!selectedId) return null;
  return state.customers.find((customer) => String(customer.id) === selectedId) || null;
}


function buildCustomerOptionLabel(customer) {
  const name = customer.name || "Cliente";
  const document = customer.document_formatted || customer.document || "Sem documento";
  const city = [customer.city, customer.state].filter(Boolean).join("/");
  return [name, document, city].filter(Boolean).join(" - ");
}


function buildCustomerAddress(customer) {
  const line = [customer.street, customer.number].filter(Boolean).join(", ");
  const extended = [line, customer.complement].filter(Boolean).join(", ");
  const cityState = [customer.city, customer.state].filter(Boolean).join("/");
  const parts = [extended, customer.district, cityState, customer.zip_code_formatted ? `CEP ${customer.zip_code_formatted}` : ""];
  return parts.filter(Boolean).join(", ") || customer.address || "-";
}


function updateItemField(itemId, field, rawValue) {
  state.items = state.items.map((item) => {
    if (String(item.id) !== String(itemId)) return item;
    if (field === "quantity") {
      const quantity = Number(rawValue || 0);
      return { ...item, quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 0 };
    }
    if (field === "unit_price") {
      const unitPrice = typeof rawValue === "number" ? rawValue : parseMoneyInputValue(rawValue);
      return { ...item, unit_price: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0 };
    }
    return item;
  });
}

function updateTotalsUI() {
  state.items.forEach((item) => {
    const totalElement = elements.root.querySelector(`[data-item-total="${item.id}"]`);
    if (totalElement) {
      totalElement.textContent = formatMoney(getItemSubtotal(item));
    }
  });

  const totalElement = document.getElementById("nfe-total-amount");
  if (totalElement) {
    totalElement.textContent = formatMoney(getItemsTotal());
  }
}

function getItemSubtotal(item) {
  return Number((Number(item.quantity || 0) * Number(item.unit_price || 0)).toFixed(2));
}

function getItemsTotal() {
  return state.items.reduce((total, item) => total + getItemSubtotal(item), 0);
}

function resetDraft() {
  state.items = [];
  state.draft = {
    customer_id: "",
    payment_method: "Dinheiro",
    notes: "",
    product_search: "",
  };
}

function generateId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `nfe-item-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatMoney(value) {
  return moneyFormatter.format(Number(value || 0));
}

function formatNumber(value) {
  return numberFormatter.format(Number(value || 0));
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

function syncMoneyInputs(root) {
  root.querySelectorAll("[data-money-input]").forEach((input) => {
    const initialDigits = input.dataset.moneyDigits || moneyDigitsFromValue(input.dataset.moneyValue || input.value);
    applyMoneyDigits(input, initialDigits);
  });
}

function isMoneyInput(target) {
  return target instanceof HTMLInputElement && target.matches("[data-money-input]");
}
