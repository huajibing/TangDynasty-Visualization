// 主题管理：负责浅色 / 深色 / 自动模式的切换与持久化，
// 并通过 data-theme 属性驱动 CSS 变量，从而影响整体视觉风格。

const STORAGE_KEY = "tang-vis-theme-mode";
export const THEME_EVENT_NAME = "tang-theme-change";

/** @typedef {'light' | 'dark' | 'auto'} ThemeMode */

let currentMode = /** @type {ThemeMode} */ ("auto");
let resolvedTheme = /** @type {'light' | 'dark'} */ ("light");
let mediaQuery;

function readStoredMode() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "auto") {
      return stored;
    }
  } catch (error) {
    // 忽略存储异常，使用默认模式
  }
  return null;
}

function getSystemPreference() {
  if (typeof window === "undefined" || !window.matchMedia) {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function persistMode(mode) {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch (error) {
    // 存储失败时忽略，不影响功能
  }
}

function updateDom(mode, theme) {
  const root = document.documentElement;
  if (!root) return;

  root.dataset.theme = theme;
  root.dataset.themeMode = mode;

  const event = new CustomEvent(THEME_EVENT_NAME, {
    detail: { mode, theme },
  });
  window.dispatchEvent(event);
}

function applyTheme(mode) {
  currentMode = mode;
  const system = getSystemPreference();
  resolvedTheme = mode === "auto" ? system : mode;

  persistMode(mode);
  updateDom(mode, resolvedTheme);
}

function handleSystemChange() {
  if (currentMode !== "auto") return;
  applyTheme("auto");
}

/**
 * 初始化主题系统：从本地存储恢复模式，并在自动模式下订阅系统主题变化。
 * @param {{ defaultMode?: ThemeMode }=} options
 */
export function initTheme(options = {}) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const stored = readStoredMode();
  const initialMode =
    stored ||
    (options.defaultMode === "light" || options.defaultMode === "dark"
      ? options.defaultMode
      : "auto");

  if (window.matchMedia) {
    mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleSystemChange);
    } else if (typeof mediaQuery.addListener === "function") {
      // 兼容旧浏览器
      mediaQuery.addListener(handleSystemChange);
    }
  }

  applyTheme(initialMode);
}

/**
 * 循环切换主题模式：auto -> light -> dark -> auto。
 * 返回当前模式与解析后的实际主题（light / dark）。
 * @returns {{ mode: ThemeMode, theme: 'light' | 'dark' }}
 */
export function cycleThemeMode() {
  const next =
    currentMode === "auto"
      ? "light"
      : currentMode === "light"
        ? "dark"
        : /** @type {ThemeMode} */ ("auto");
  applyTheme(next);
  return { mode: currentMode, theme: resolvedTheme };
}

/**
 * 获取当前主题状态。
 */
export function getThemeState() {
  return { mode: currentMode, theme: resolvedTheme };
}

/**
 * 直接设置主题模式（light/dark/auto），用于 Settings 等显式选择场景。
 * @param {ThemeMode} mode
 * @returns {{ mode: ThemeMode, theme: 'light' | 'dark' }}
 */
export function setThemeMode(mode) {
  const next =
    mode === "light" || mode === "dark" || mode === "auto" ? mode : "auto";
  applyTheme(next);
  return { mode: currentMode, theme: resolvedTheme };
}

/**
 * 绑定主题切换按钮，并根据主题变化更新文案与图标。
 * @param {string | HTMLElement | null} target
 */
export function bindThemeToggle(target) {
  if (typeof document === "undefined") return;

  const root =
    typeof target === "string" ? document.querySelector(target) : target;

  if (!root) return;

  const button = root.matches("button") ? root : root.querySelector("button");

  if (!button) return;

  const iconEl = button.querySelector("[data-theme-icon]");
  const labelEl = button.querySelector("[data-theme-label]");

  const render = (state) => {
    const { mode, theme } = state || getThemeState();

    if (iconEl) {
      // ☀ 日间 / ☾ 夜间 / A 自动
      iconEl.textContent =
        mode === "auto" ? "A" : theme === "dark" ? "☾" : "☀";
    }
    if (labelEl) {
      labelEl.textContent =
        mode === "auto" ? "自动" : theme === "dark" ? "夜间" : "日间";
    }

    button.setAttribute(
      "aria-label",
      mode === "auto"
        ? "切换主题（当前：自动跟随系统）"
        : `切换主题（当前：${theme === "dark" ? "夜间模式" : "日间模式"}）`,
    );
  };

  button.addEventListener("click", () => {
    const next = cycleThemeMode();
    render(next);
  });

  window.addEventListener(THEME_EVENT_NAME, () => {
    render();
  });

  // 初始化渲染一次
  render();
}
