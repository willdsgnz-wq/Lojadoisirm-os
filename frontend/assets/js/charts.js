import { escapeHtml, formatMoney, formatNumber } from "./helpers.js";

export function renderMetricCard({ label, value, helper = "", tone = "default" }) {
  return `
    <article class="metric-card metric-${tone}">
      <span class="metric-label">${escapeHtml(label)}</span>
      <strong class="metric-value">${escapeHtml(String(value))}</strong>
      <small class="metric-helper">${escapeHtml(helper)}</small>
    </article>
  `;
}

export function renderBarChart({ title, subtitle = "", data = [], format = "money" }) {
  const maxValue = Math.max(...data.map((item) => Number(item.value || 0)), 1);
  const bars = data.map((item) => {
    const value = Number(item.value || 0);
    const height = Math.max((value / maxValue) * 100, value > 0 ? 10 : 2);
    const formattedValue = format === "count" ? formatNumber(value) : formatMoney(value);
    return `
      <div class="bar-item" title="${escapeHtml(`${item.label}: ${formattedValue}`)}">
        <div class="bar-track">
          <div class="bar-fill" style="height:${height}%"></div>
        </div>
        <span class="bar-label">${escapeHtml(item.label)}</span>
        <small class="bar-value">${escapeHtml(formattedValue)}</small>
      </div>
    `;
  }).join("");

  return `
    <section class="chart-card">
      <div class="section-header">
        <div>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(subtitle)}</p>
        </div>
      </div>
      <div class="bar-chart ${data.length <= 4 ? "bar-chart-wide" : ""}">
        ${bars || `<div class="empty-inline">Sem dados para exibir.</div>`}
      </div>
    </section>
  `;
}

export function renderStatList({ title, subtitle = "", rows = [], money = true }) {
  const numericValues = rows.map((row) => Number(row.value || 0)).filter((value) => Number.isFinite(value));
  const maxValue = Math.max(...numericValues, 1);
  return `
    <section class="chart-card">
      <div class="section-header">
        <div>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(subtitle)}</p>
        </div>
      </div>
      <div class="stat-list">
        ${rows.map((row) => `
          ${(() => {
            const numericValue = Number(row.value || 0);
            const displayValue = money
              ? formatMoney(row.value)
              : (Number.isFinite(numericValue) ? formatNumber(numericValue) : escapeHtml(String(row.value)));
            const width = Number.isFinite(numericValue)
              ? Math.max((numericValue / maxValue) * 100, 8)
              : 100;
            return `
          <div class="stat-row">
            <div>
              <strong>${escapeHtml(row.label)}</strong>
              ${row.helper ? `<small>${escapeHtml(row.helper)}</small>` : ""}
            </div>
            <div class="stat-row-right">
              <span>${displayValue}</span>
              <div class="stat-progress">
                <div style="width:${width}%"></div>
              </div>
            </div>
          </div>
            `;
          })()}
        `).join("") || `<div class="empty-inline">Sem dados para exibir.</div>`}
      </div>
    </section>
  `;
}

export function renderEmptyState(title, text) {
  return `
    <div class="empty-state">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(text)}</span>
    </div>
  `;
}

export function renderBadge(label, tone = "neutral") {
  return `<span class="badge badge-${tone}">${escapeHtml(label)}</span>`;
}
