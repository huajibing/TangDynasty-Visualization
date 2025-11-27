// 全局色板：与 css/variables.css 中的设计令牌保持一致，便于 JS 与样式层统一配色。

const cssRoot = typeof document !== 'undefined' ? document.documentElement : null;

function readCssVar(varName, fallback) {
  if (!cssRoot || typeof window === 'undefined' || !window.getComputedStyle) {
    return fallback;
  }

  const value = window.getComputedStyle(cssRoot).getPropertyValue(varName);
  return value ? value.trim() || fallback : fallback;
}

const theme = {
  primary: readCssVar('--color-primary', '#c0392b'),
  primaryLight: readCssVar('--color-primary-light', '#e74c3c'),
  primaryDark: readCssVar('--color-primary-dark', '#922b21'),
  secondary: readCssVar('--color-secondary', '#d35400'),
  accent: readCssVar('--color-accent', '#f39c12'),
  background: readCssVar('--color-bg-primary', '#fdf6e3'),
  backgroundAlt: readCssVar('--color-bg-secondary', '#f5f0e1'),
  text: readCssVar('--color-text-primary', '#2c3e50'),
  textMuted: readCssVar('--color-text-secondary', '#7f8c8d'),
};

const productTypes = {
  '农产品': readCssVar('--color-product-agriculture', '#27ae60'),
  '纺织品': readCssVar('--color-product-textile', '#9b59b6'),
  '药材': readCssVar('--color-product-medicine', '#1abc9c'),
  '矿产/金属': readCssVar('--color-product-mineral', '#95a5a6'),
  '畜产品/土特产': readCssVar('--color-product-livestock', '#e67e22'),
  '其他/待分类': readCssVar('--color-product-other', '#34495e'),
};

const daos = {
  dao_001: readCssVar('--color-dao-guannei', '#c0392b'),
  dao_002: readCssVar('--color-dao-henan', '#2980b9'),
  dao_003: readCssVar('--color-dao-hedong', '#8e44ad'),
  dao_004: readCssVar('--color-dao-hebei', '#16a085'),
  dao_005: readCssVar('--color-dao-shannan', '#d35400'),
  dao_006: readCssVar('--color-dao-longyou', '#f39c12'),
  dao_007: readCssVar('--color-dao-huainan', '#27ae60'),
  dao_008: readCssVar('--color-dao-jiangnan', '#1abc9c'),
  dao_009: readCssVar('--color-dao-jiannan', '#9b59b6'),
  dao_010: readCssVar('--color-dao-lingnan', '#e74c3c'),
};

const administrativeLevels = {
  道: theme.primary,
  都: readCssVar('--color-info', '#3498db'),
  府: theme.secondary,
  州: theme.accent,
  '都护府': readCssVar('--color-warning', '#f39c12'),
};

export const COLORS = {
  theme,
  productTypes,
  daos,
  administrativeLevels,
};

export const PRODUCT_TYPE_KEYS = Object.keys(productTypes);

export function getProductTypeColor(type) {
  return productTypes[type] || theme.secondary;
}

export function getDaoColor(daoId) {
  return daos[daoId] || theme.primary;
}

export function getAdministrativeLevelColor(level) {
  return administrativeLevels[level] || theme.accent;
}
