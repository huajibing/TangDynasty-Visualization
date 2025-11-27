// 比例尺工厂：集中维护常用 scale，确保各视图配置一致。

import { COLORS, PRODUCT_TYPE_KEYS } from './colors.js';

const DEFAULT_RADIUS_RANGE = [3, 18];
const DEFAULT_RANGE = [0, 1];

function ensureD3() {
  if (typeof d3 === 'undefined') {
    throw new Error('[scales] D3.js is required to create scales');
  }
  return d3;
}

function normalizeExtent(extent, { positive = false, fallback = [0, 1] } = {}) {
  if (!Array.isArray(extent) || extent.length < 2) {
    return [...fallback];
  }

  let [min, max] = extent;
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return [...fallback];
  }

  if (positive) {
    min = Math.max(min, 1e-6);
    max = Math.max(max, min * 10);
  } else if (min === max) {
    if (min === 0) {
      max = 1;
    } else {
      max = min * 1.05;
      min = min * 0.95;
    }
  }

  return [min, max];
}

export function createLinearScale(domain, range = DEFAULT_RANGE, { nice = true, clamp = false } = {}) {
  const d3Ref = ensureD3();
  const safeDomain = normalizeExtent(domain);
  const scale = d3Ref.scaleLinear().domain(safeDomain).range(range);

  if (nice) scale.nice();
  if (clamp) scale.clamp(true);
  return scale;
}

export function createPopulationScale(
  domain,
  range = DEFAULT_RANGE,
  { log = false, nice = true, clamp = true } = {},
) {
  const d3Ref = ensureD3();
  const safeDomain = normalizeExtent(domain, { positive: log, fallback: [1, 1000000] });
  const scale = log ? d3Ref.scaleLog() : d3Ref.scaleLinear();

  scale.domain(safeDomain).range(range);
  if (log) {
    scale.clamp(true);
  } else if (nice) {
    scale.nice();
  }
  if (clamp && !log) scale.clamp(true);

  return scale;
}

export function createHouseholdSizeScale(domain, range = DEFAULT_RANGE, { nice = true } = {}) {
  return createLinearScale(domain, range, { nice, clamp: true });
}

export function createProductRichnessScale(domain, range = DEFAULT_RANGE, { nice = true } = {}) {
  return createLinearScale(domain, range, { nice, clamp: true });
}

export function createPopulationRadiusScale(domain, range = DEFAULT_RADIUS_RANGE) {
  const d3Ref = ensureD3();
  const safeDomain = normalizeExtent(domain, { positive: true, fallback: [1000, 1000000] });
  return d3Ref.scaleSqrt().domain(safeDomain).range(range).clamp(true);
}

export function createProductTypeColorScale(domain = PRODUCT_TYPE_KEYS) {
  const d3Ref = ensureD3();
  const safeDomain = Array.isArray(domain) && domain.length > 0 ? domain : PRODUCT_TYPE_KEYS;
  const colors = safeDomain.map(key => COLORS.productTypes[key] || COLORS.theme.secondary);
  return d3Ref.scaleOrdinal().domain(safeDomain).range(colors);
}

export function createDaoColorScale(domain = Object.keys(COLORS.daos)) {
  const d3Ref = ensureD3();
  const safeDomain = Array.isArray(domain) && domain.length > 0 ? domain : Object.keys(COLORS.daos);
  const colors = safeDomain.map(key => COLORS.daos[key] || COLORS.theme.primary);
  return d3Ref.scaleOrdinal().domain(safeDomain).range(colors);
}
