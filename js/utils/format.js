// 文本与数值格式化工具：统一数字、百分比、单位与 Tooltip 文本拼接。

const DEFAULT_FALLBACK = '-';

function isValidNumber(value) {
  return Number.isFinite(value);
}

function stripTrailingZeros(value) {
  return `${value}`.replace(/\.0+$/, '').replace(/(\.\d*?[1-9])0+$/, '$1');
}

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return `${value}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatNumber(value, { minimumFractionDigits, maximumFractionDigits, fallback } = {}) {
  if (!isValidNumber(value)) return fallback ?? DEFAULT_FALLBACK;

  const hasFraction = minimumFractionDigits !== undefined || maximumFractionDigits !== undefined;
  const formatter = new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits,
    maximumFractionDigits: hasFraction ? maximumFractionDigits ?? minimumFractionDigits : undefined,
  });

  return formatter.format(value);
}

export function formatPercentage(value, digits = 1, fallback = DEFAULT_FALLBACK) {
  if (!isValidNumber(value)) return fallback;
  const ratio = Math.abs(value) <= 1 ? value * 100 : value;
  return `${stripTrailingZeros(ratio.toFixed(digits))}%`;
}

export function formatWan(value, suffix = '', { digits = 1, fallback = DEFAULT_FALLBACK } = {}) {
  if (!isValidNumber(value)) return fallback;
  const wanValue = value / 10000;
  const formatted = stripTrailingZeros(wanValue.toFixed(digits));
  return `${formatted}${suffix}`;
}

export function formatPopulation(value, options = {}) {
  const fallback = options.fallback ?? DEFAULT_FALLBACK;
  if (!isValidNumber(value)) return fallback;

  if (Math.abs(value) >= 10000) {
    return formatWan(value, '万人', { digits: options.digits ?? 1, fallback });
  }

  const formatted = formatNumber(value, { maximumFractionDigits: options.maxDecimals ?? 0, fallback });
  return `${formatted}人`;
}

export function formatHouseholds(value, options = {}) {
  const fallback = options.fallback ?? DEFAULT_FALLBACK;
  if (!isValidNumber(value)) return fallback;

  if (Math.abs(value) >= 10000) {
    return formatWan(value, '万户', { digits: options.digits ?? 1, fallback });
  }

  const formatted = formatNumber(value, { maximumFractionDigits: options.maxDecimals ?? 0, fallback });
  return `${formatted}户`;
}

export function formatHouseholdSize(value, options = {}) {
  const fallback = options.fallback ?? DEFAULT_FALLBACK;
  if (!isValidNumber(value)) return fallback;
  const fractionDigits = options.decimals ?? 1;
  return formatNumber(value, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    fallback,
  });
}

export function buildTooltipContent(title, rows = []) {
  const header = title ? `<div class="tooltip__title">${escapeHtml(title)}</div>` : '';
  const contentRows = rows
    .filter(row => row && row.value !== undefined && row.value !== null && row.value !== '')
    .map(row => {
      return `
        <div class="tooltip__row">
          <span class="tooltip__label">${escapeHtml(row.label)}</span>
          <span class="tooltip__value">${escapeHtml(row.value)}</span>
        </div>
      `;
    })
    .join('');

  return `${header}<div class="tooltip__content">${contentRows}</div>`;
}

export const Format = {
  number: formatNumber,
  percentage: formatPercentage,
  population: formatPopulation,
  households: formatHouseholds,
  householdSize: formatHouseholdSize,
  wan: formatWan,
  tooltip: buildTooltipContent,
};
