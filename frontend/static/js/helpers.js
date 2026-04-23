const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatLocalIsoDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeDateValue(value) {
  if (!value) return "";
  if (value instanceof Date) {
    return formatLocalIsoDate(value);
  }

  const rawValue = String(value).trim();
  if (!rawValue) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    return rawValue;
  }

  if (/^\d{4}-\d{2}-\d{2}[T\s]/.test(rawValue)) {
    const normalizedInput = rawValue.includes("T") ? rawValue : rawValue.replace(" ", "T");
    const parsedDate = new Date(normalizedInput);
    if (!Number.isNaN(parsedDate.getTime())) {
      return formatLocalIsoDate(parsedDate);
    }
    return rawValue.slice(0, 10);
  }

  const parsedDate = new Date(rawValue);
  if (!Number.isNaN(parsedDate.getTime())) {
    return formatLocalIsoDate(parsedDate);
  }

  return "";
}

export function formatMoney(value = 0) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

export function formatNumber(value = 0) {
  return new Intl.NumberFormat("pt-BR").format(Number(value || 0));
}

export function formatDate(value) {
  if (!value) return "-";
  const normalizedValue = normalizeDateValue(value);
  if (!normalizedValue) return "-";
  const date = new Date(`${normalizedValue}T00:00:00`);
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function todayIso() {
  return formatLocalIsoDate(new Date());
}

export function parseDate(value) {
  const normalizedValue = normalizeDateValue(value);
  if (!normalizedValue) return null;
  return new Date(`${normalizedValue}T00:00:00`);
}

export function toIso(date) {
  return formatLocalIsoDate(date);
}

export function startOfWeek(date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function endOfWeek(date) {
  const copy = startOfWeek(date);
  copy.setDate(copy.getDate() + 6);
  return copy;
}

export function getPresetRange(preset, custom = {}) {
  const now = parseDate(todayIso());
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  switch (preset) {
    case "day":
      return {
        start: custom.day || todayIso(),
        end: custom.day || todayIso(),
        label: custom.day ? `Dia ${formatDate(custom.day)}` : "Dia específico",
      };
    case "yesterday":
      return {
        start: toIso(yesterday),
        end: toIso(yesterday),
        label: "Ontem",
      };
    case "week":
      return {
        start: toIso(startOfWeek(today)),
        end: toIso(endOfWeek(today)),
        label: "Esta semana",
      };
    case "month": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return {
        start: toIso(start),
        end: toIso(end),
        label: "Este mês",
      };
    }
    case "year": {
      const start = new Date(today.getFullYear(), 0, 1);
      const end = new Date(today.getFullYear(), 11, 31);
      return {
        start: toIso(start),
        end: toIso(end),
        label: "Este ano",
      };
    }
    case "custom":
      return {
        start: custom.start || todayIso(),
        end: custom.end || todayIso(),
        label: "Período personalizado",
      };
    case "today":
    default:
      return {
        start: todayIso(),
        end: todayIso(),
        label: "Hoje",
      };
  }
}

export function isBetween(dateValue, range) {
  const date = normalizeDateValue(dateValue);
  const start = normalizeDateValue(range.start);
  const end = normalizeDateValue(range.end);
  if (!date || !start || !end) return false;
  return date >= start && date <= end;
}

export function filterByPeriod(records, key, period) {
  return records.filter((record) => isBetween(record[key], period));
}

export function sumBy(records, resolver) {
  return records.reduce((total, record) => total + Number(resolver(record) || 0), 0);
}

export function countBy(records, predicate = () => true) {
  return records.filter(predicate).length;
}

export function groupByDay(records, key, valueResolver, days = 7) {
  const result = [];
  const today = parseDate(todayIso());
  for (let index = days - 1; index >= 0; index -= 1) {
    const current = new Date(today);
    current.setDate(today.getDate() - index);
    const iso = toIso(current);
    const total = sumBy(records.filter((item) => normalizeDateValue(item[key]) === iso), valueResolver);
    result.push({
      label: WEEKDAY_LABELS[current.getDay()],
      value: total,
      date: iso,
    });
  }
  return result;
}

export function groupByWeek(records, key, valueResolver, weeks = 8) {
  const result = [];
  const today = parseDate(todayIso());
  const currentWeekStart = startOfWeek(today);
  for (let index = weeks - 1; index >= 0; index -= 1) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(currentWeekStart.getDate() - index * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const start = toIso(weekStart);
    const end = toIso(weekEnd);
    const total = sumBy(
      records.filter((item) => isBetween(item[key], { start, end })),
      valueResolver,
    );
    result.push({
      label: `${String(weekStart.getDate()).padStart(2, "0")}/${String(weekStart.getMonth() + 1).padStart(2, "0")}`,
      value: total,
      start,
      end,
    });
  }
  return result;
}

export function groupByMonth(records, key, valueResolver, months = 12) {
  const result = [];
  const now = new Date();
  for (let index = months - 1; index >= 0; index -= 1) {
    const current = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const start = toIso(current);
    const end = toIso(new Date(current.getFullYear(), current.getMonth() + 1, 0));
    const total = sumBy(
      records.filter((item) => isBetween(item[key], { start, end })),
      valueResolver,
    );
    result.push({
      label: MONTH_LABELS[current.getMonth()],
      value: total,
      month: current.getMonth() + 1,
      year: current.getFullYear(),
    });
  }
  return result;
}

export function sortByDateDesc(records, key) {
  return [...records].sort((first, second) => normalizeDateValue(second[key]).localeCompare(normalizeDateValue(first[key])));
}

export function getPaymentTotals(records, paymentKey, amountKey) {
  const totals = new Map();
  records.forEach((record) => {
    const label = record[paymentKey] || "Não informado";
    const current = totals.get(label) || 0;
    totals.set(label, current + Number(record[amountKey] || 0));
  });

  return [...totals.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((first, second) => second.value - first.value);
}

export function getCategoryTotals(records, categoryKey, amountKey) {
  const totals = new Map();
  records.forEach((record) => {
    const label = record[categoryKey] || "Sem categoria";
    const current = totals.get(label) || 0;
    totals.set(label, current + Number(record[amountKey] || 0));
  });
  return [...totals.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((first, second) => second.value - first.value);
}

export function getProductRanking(sales, limit = 5) {
  const totals = new Map();
  sales.forEach((sale) => {
    sale.items.forEach((item) => {
      const current = totals.get(item.product_id) || {
        label: item.product_name,
        quantity: 0,
        revenue: 0,
      };
      current.quantity += Number(item.quantity || 0);
      current.revenue += Number(item.total_price || 0);
      totals.set(item.product_id, current);
    });
  });

  return [...totals.values()]
    .sort((first, second) => second.quantity - first.quantity)
    .slice(0, limit);
}

export function getStatusTotals(records, statusKey, amountKey) {
  const totals = new Map();
  records.forEach((record) => {
    const label = record[statusKey] || "Sem status";
    const current = totals.get(label) || 0;
    totals.set(label, current + Number(record[amountKey] || 0));
  });
  return [...totals.entries()].map(([label, value]) => ({ label, value }));
}

export function buildCsv(rows, columns) {
  const lines = [
    columns.map((column) => column.label).join(";"),
    ...rows.map((row) => columns.map((column) => String(column.value(row) ?? "")).join(";")),
  ];
  return `\uFEFF${lines.join("\n")}`;
}

export function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function toFormValue(value) {
  return value ?? "";
}
