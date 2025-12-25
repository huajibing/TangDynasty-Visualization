// 应用入口：初始化数据管线、全局状态与四个视图，完成联动交互。

import { appConfig } from "./config.js";
import MapView from "./charts/MapView.js";
import Histogram from "./charts/Histogram.js";
import ScatterPlot from "./charts/ScatterPlot.js";
import NetworkGraph from "./charts/NetworkGraph.js";
import DaoProductStackedChart from "./charts/DaoProductStackedChart.js";
import ProductRanking from "./charts/ProductRanking.js";
import DaoProfileChart from "./charts/DaoProfileChart.js";
import DataLoader from "./data/dataLoader.js";
import DataProcessor from "./data/dataProcessor.js";
import DataQuery from "./data/dataQuery.js";
import { AppState } from "./state.js";
import { Sidebar } from "./components/sidebar.js";
import { PanelManager } from "./components/panelManager.js";
import {
  WindowLayoutManager,
  createDefaultWorkspaceLayout,
} from "./components/windowLayoutManager.js";
import { DataTable } from "./components/DataTable.js";
import SettingsPanel from "./components/SettingsPanel.js";
import Tour from "./components/tour.js";
import { initCollapsibleFooter } from "./components/footer.js";
import {
  COLORS,
  PRODUCT_TYPE_KEYS,
  getAdministrativeLevelColor,
  getDaoColor,
  getProductTypeColor,
  refreshColorsFromCss,
} from "./utils/colors.js";
import { Format } from "./utils/format.js";
import eventBus, { EVENTS } from "./utils/eventBus.js";
import {
  initTheme,
  bindThemeToggle,
  getThemeState,
  setThemeMode,
  THEME_EVENT_NAME,
} from "./theme.js";

// 优先初始化主题，确保 CSS 变量与 data-theme 就位
initTheme();
// 主题就绪后立刻从 CSS 同步 JS 色板，避免初次渲染与 CSS 不一致
refreshColorsFromCss();

const LAYOUT_STORAGE_KEY = "tang_layout_mode";
const LAYOUT_MODE = {
  FLOATING: "floating",
  WORKSPACE: "workspace",
};

const WORKSPACE_LAYOUT_STORAGE_KEY = "tang_workspace_layout";
const WORKSPACE_LAYOUT_VERSION = 1;

const APP_SETTINGS_STORAGE_KEY = "tang_app_settings";
const APP_SETTINGS_VERSION = 1;
const DEFAULT_APP_SETTINGS = {
  basemap: "tang", // tang | modern
  mapEncoding: { colorEncoding: "product", markerEncoding: "population" },
  selectionAsFilter: false,
  legendConfig: { showMarkerLegend: true },
};

let appSettingsSaveTimer = null;
const geoDataCache = new Map();

function normalizeBasemap(value) {
  return value === "modern" ? "modern" : "tang";
}

function resolveGeoFilenameForBasemap(basemap) {
  const key = normalizeBasemap(basemap);
  const config = appConfig?.geoFilenames || {};
  if (key === "modern") return config.modern || "china_geo.json";
  return config.tang || "tang_china_geo.json";
}

async function loadGeoDataForBasemap(basemap) {
  const key = normalizeBasemap(basemap);
  const cached = geoDataCache.get(key);
  if (cached) return cached;

  const filename = resolveGeoFilenameForBasemap(key);
  const geoData = await DataLoader.fetchJSON(filename, appConfig.dataPath);
  geoDataCache.set(key, geoData);
  return geoData;
}

async function bootstrap() {
  // eslint-disable-next-line no-console
  console.log("Tang visualization app bootstrap (phase 4)", appConfig);

  // 绑定主题切换按钮（如果存在）
  bindThemeToggle(".theme-toggle");

  try {
    const persistedSettings = loadAppSettings();
    const initialBasemap = normalizeBasemap(persistedSettings.basemap);
    const geoFilename = resolveGeoFilenameForBasemap(initialBasemap);
    const rawData = await DataLoader.loadAll(appConfig.dataPath, {
      geoFilename,
    });
    geoDataCache.set(initialBasemap, rawData.geoData);
    const processed = DataProcessor.process(rawData);
    DataQuery.init(processed);

    // 基础数据检查输出，便于验证数据管线是否正常
    // eslint-disable-next-line no-console
    console.groupCollapsed("[DataPipeline] 加载校验");
    // eslint-disable-next-line no-console
    console.log("地点数量:", processed.data.length);
    // eslint-disable-next-line no-console
    console.log("人口总数:", processed.statistics?.totalPopulation ?? 0);
    // eslint-disable-next-line no-console
    console.log("户数总数:", processed.statistics?.totalHouseholds ?? 0);
    // eslint-disable-next-line no-console
    console.log(
      "物产种类数:",
      processed.statistics?.productFrequency?.size ?? 0,
    );
    // eslint-disable-next-line no-console
    console.log(
      "物产类别数:",
      processed.statistics?.productTypeCount?.size ?? 0,
    );
    // eslint-disable-next-line no-console
    console.log("GeoJSON features:", rawData.geoData?.features?.length ?? 0);
    // eslint-disable-next-line no-console
    console.groupEnd();

    initApp(processed, rawData, persistedSettings);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Data pipeline initialization failed", error);
  }
}

function initApp(processed, rawData, persistedSettings = null) {
  const initialLayoutMode = loadLayoutMode();
  applyLayoutModeToDom(initialLayoutMode);
  initCollapsibleFooter();

  const settings = persistedSettings || loadAppSettings();

  const state = new AppState({
    layoutMode: initialLayoutMode,
    basemap: settings.basemap,
    filters: { daoIds: [], productTypes: [], householdRange: null },
    mapEncoding: settings.mapEncoding,
    legendConfig: settings.legendConfig,
    selection: { asFilter: settings.selectionAsFilter },
  });

  const context = {
    data: processed.data,
    filteredData: processed.data,
    geoData: rawData.geoData,
    indices: processed.indices,
    statistics: processed.statistics,
    state,
    charts: {},
    sidebar: null,
    settingsPanel: null,
    panelManager: null,
    workspaceLayoutManager: null,
    floatingPanelOpenSnapshot: null,
    tour: null,
    workspaceTour: null,
    workspaceTourShownOnce: false,
    workspaceTourPending: false,
  };

  context.charts = mountCharts(context);
  context.sidebar = initSidebar(context);
  context.settingsPanel = initSettingsPanel(context);
  context.panelManager = initPanelManager(context);
  initLayoutMode(context);
  initThemeBridge(context);
  bindEventBridges(context);
  bindChartControls(context);
  applyFiltersAndRender(context, state.get("filters"));
  context.tour = initTour(context);
  context.workspaceTour = initWorkspaceTour(context);
  maybeStartWorkspaceTour(context);

  // 确保散点图在初次布局稳定后完成一次基于最终尺寸的渲染，
  // 避免个别浏览器在首帧尚未完成布局时计算到异常尺寸而导致空白。
  window.requestAnimationFrame(() => {
    context.charts.scatter?.update(context.filteredData);
  });

  // 暴露给浏览器控制台，便于后续快速检查
  window.__tangData = { rawData, ...processed };
}

function loadLayoutMode() {
  if (typeof window === "undefined") return LAYOUT_MODE.FLOATING;
  try {
    const stored = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    return stored === LAYOUT_MODE.WORKSPACE
      ? LAYOUT_MODE.WORKSPACE
      : LAYOUT_MODE.FLOATING;
  } catch {
    return LAYOUT_MODE.FLOATING;
  }
}

function loadAppSettings() {
  if (typeof window === "undefined") return { ...DEFAULT_APP_SETTINGS };

  try {
    const raw = window.localStorage.getItem(APP_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_APP_SETTINGS };
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== APP_SETTINGS_VERSION)
      return { ...DEFAULT_APP_SETTINGS };
    const settings = parsed.settings || {};

    const colorEncoding =
      settings?.mapEncoding?.colorEncoding === "product" ||
      settings?.mapEncoding?.colorEncoding === "level" ||
      settings?.mapEncoding?.colorEncoding === "dao"
        ? settings.mapEncoding.colorEncoding
        : DEFAULT_APP_SETTINGS.mapEncoding.colorEncoding;
    const markerEncoding =
      settings?.mapEncoding?.markerEncoding === "productRichness" ||
      settings?.mapEncoding?.markerEncoding === "householdSize" ||
      settings?.mapEncoding?.markerEncoding === "fixed" ||
      settings?.mapEncoding?.markerEncoding === "population"
        ? settings.mapEncoding.markerEncoding
        : DEFAULT_APP_SETTINGS.mapEncoding.markerEncoding;

    const selectionAsFilter =
      typeof settings.selectionAsFilter === "boolean"
        ? settings.selectionAsFilter
        : DEFAULT_APP_SETTINGS.selectionAsFilter;
    const showMarkerLegend = settings?.legendConfig?.showMarkerLegend !== false;
    const basemap =
      settings?.basemap === "modern" ? "modern" : DEFAULT_APP_SETTINGS.basemap;

    return {
      basemap,
      mapEncoding: { colorEncoding, markerEncoding },
      selectionAsFilter,
      legendConfig: { showMarkerLegend },
    };
  } catch {
    return { ...DEFAULT_APP_SETTINGS };
  }
}

function persistAppSettings(context) {
  if (typeof window === "undefined") return;
  if (!context?.state) return;

  const snapshot = {
    version: APP_SETTINGS_VERSION,
    updatedAt: Date.now(),
    settings: {
      basemap: normalizeBasemap(context.state.get("basemap")),
      mapEncoding:
        context.state.get("mapEncoding") || DEFAULT_APP_SETTINGS.mapEncoding,
      selectionAsFilter: Boolean(context.state.get("selection")?.asFilter),
      legendConfig:
        context.state.get("legendConfig") || DEFAULT_APP_SETTINGS.legendConfig,
    },
  };

  try {
    window.localStorage.setItem(
      APP_SETTINGS_STORAGE_KEY,
      JSON.stringify(snapshot),
    );
  } catch {
    // ignore
  }
}

function schedulePersistAppSettings(context) {
  if (typeof window === "undefined") return;
  if (appSettingsSaveTimer) {
    window.clearTimeout(appSettingsSaveTimer);
  }
  appSettingsSaveTimer = window.setTimeout(() => {
    appSettingsSaveTimer = null;
    persistAppSettings(context);
  }, 200);
}

function applyLayoutModeToDom(mode) {
  const app = document.getElementById("app");
  if (!app) return;
  app.classList.toggle("is-workspace", mode === LAYOUT_MODE.WORKSPACE);
}

function initLayoutMode(context) {
  const current = context.state.get("layoutMode") || LAYOUT_MODE.FLOATING;
  bindLayoutToggle(context);
  setLayoutMode(context, current, { persist: false });
}

function bindLayoutToggle(context) {
  const button = document.querySelector("[data-layout-toggle]");
  if (!button) return;

  button.addEventListener("click", () => {
    const current = context.state.get("layoutMode") || LAYOUT_MODE.FLOATING;
    const next =
      current === LAYOUT_MODE.WORKSPACE
        ? LAYOUT_MODE.FLOATING
        : LAYOUT_MODE.WORKSPACE;
    setLayoutMode(context, next, { persist: true });
  });
}

function setLayoutMode(context, mode, { persist } = {}) {
  const nextMode =
    mode === LAYOUT_MODE.WORKSPACE
      ? LAYOUT_MODE.WORKSPACE
      : LAYOUT_MODE.FLOATING;
  const previousMode = context.state.get("layoutMode") || LAYOUT_MODE.FLOATING;

  if (nextMode === LAYOUT_MODE.FLOATING) {
    context.workspaceTour?.close?.({ persist: false });
  }

  if (
    previousMode === LAYOUT_MODE.WORKSPACE &&
    nextMode === LAYOUT_MODE.FLOATING
  ) {
    exitWorkspaceMode(context);
  }

  context.state.update({ layoutMode: nextMode });
  applyLayoutModeToDom(nextMode);
  syncLayoutToggleUi(nextMode);

  const needsWorkspaceMount =
    nextMode === LAYOUT_MODE.WORKSPACE && !context.workspaceLayoutManager;

  if (previousMode !== nextMode || needsWorkspaceMount) {
    if (nextMode === LAYOUT_MODE.WORKSPACE) {
      syncFloatingPanelInlineStylesForMode(LAYOUT_MODE.WORKSPACE);
      enterWorkspaceMode(context);
      maybeStartWorkspaceTour(context);
    } else {
      syncFloatingPanelInlineStylesForMode(LAYOUT_MODE.FLOATING);
      context.panelManager?.setInteractionEnabled(true);
      restoreFloatingPanelOpenSnapshot(context);
    }
  }

  if (nextMode === LAYOUT_MODE.FLOATING) {
    context.panelManager?.setInteractionEnabled(true);
  }

  if (persist && typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LAYOUT_STORAGE_KEY, nextMode);
    } catch {
      // ignore
    }
  }

  window.requestAnimationFrame(() => resizeVisibleWindows(context));
}

function syncLayoutToggleUi(mode) {
  const button = document.querySelector("[data-layout-toggle]");
  if (!button) return;

  const iconEl = button.querySelector("[data-layout-icon]");
  const labelEl = button.querySelector("[data-layout-label]");

  const isWorkspace = mode === LAYOUT_MODE.WORKSPACE;
  button.setAttribute("aria-pressed", isWorkspace ? "true" : "false");

  if (iconEl) iconEl.textContent = isWorkspace ? "▦" : "▣";
  if (labelEl) labelEl.textContent = isWorkspace ? "工作区" : "浮动";
}

function syncFloatingPanelInlineStylesForMode(mode) {
  const panels = document.querySelectorAll(".floating-panel");
  panels.forEach((panel) => {
    if (!(panel instanceof HTMLElement)) return;
    if (mode === LAYOUT_MODE.WORKSPACE) {
      stashInlineLayoutStyles(panel);
      clearInlineLayoutStyles(panel);
      return;
    }
    restoreInlineLayoutStyles(panel);
  });
}

function stashInlineLayoutStyles(panel) {
  if (!panel || panel.dataset.layoutStyleStashed === "true") return;

  const keys = [
    "left",
    "top",
    "right",
    "bottom",
    "width",
    "height",
    "transform",
  ];
  const snapshot = Object.fromEntries(
    keys.map((key) => [key, panel.style[key] || ""]),
  );
  panel.dataset.layoutStyleSnapshot = JSON.stringify(snapshot);
  panel.dataset.layoutStyleStashed = "true";
}

function clearInlineLayoutStyles(panel) {
  panel.style.left = "";
  panel.style.top = "";
  panel.style.right = "";
  panel.style.bottom = "";
  panel.style.width = "";
  panel.style.height = "";
  panel.style.transform = "";
}

function restoreInlineLayoutStyles(panel) {
  const snapshot = panel?.dataset?.layoutStyleSnapshot;
  if (!snapshot) return;

  try {
    const parsed = JSON.parse(snapshot);
    Object.entries(parsed || {}).forEach(([key, value]) => {
      panel.style[key] = value || "";
    });
  } catch {
    // ignore
  }

  delete panel.dataset.layoutStyleSnapshot;
  delete panel.dataset.layoutStyleStashed;
}

let workspaceLayoutSaveTimer = null;

function enterWorkspaceMode(context) {
  if (context.workspaceLayoutManager) return;

  context.floatingPanelOpenSnapshot = snapshotOpenPanels();
  context.panelManager?.setInteractionEnabled(false);

  const root = document.querySelector("[data-workspace-layout]");
  if (!(root instanceof HTMLElement)) return;

  const initialLayout = loadWorkspaceLayout();
  const windowRegistry = buildWorkspaceWindowRegistry();

  const manager = new WindowLayoutManager({
    root,
    windows: windowRegistry,
    getWindowTitle: (windowId) =>
      getWorkspaceWindowTitle(windowRegistry, windowId),
    onLayoutChange: (layout) => scheduleSaveWorkspaceLayout(layout),
    onResize: () => {
      window.requestAnimationFrame(() => resizeVisibleWindows(context));
    },
  });

  // 先同步“打开窗口集合”，再挂载布局，避免出现空窗口
  const openSet = collectWorkspaceWindowIds(initialLayout);
  syncPanelsOpenState(context, openSet);

  context.workspaceLayoutManager = manager;
  manager.mount(initialLayout);
}

function exitWorkspaceMode(context) {
  if (!context.workspaceLayoutManager) return;
  context.workspaceLayoutManager.destroy();
  context.workspaceLayoutManager = null;
}

function restoreFloatingPanelOpenSnapshot(context) {
  const snapshot = Array.isArray(context.floatingPanelOpenSnapshot)
    ? context.floatingPanelOpenSnapshot
    : null;
  if (!snapshot || !context.panelManager) return;

  const openSet = new Set(snapshot);
  const panelIds = [
    "sidebar",
    "histogram",
    "scatter",
    "insights",
    "products",
    "network",
    "datatable",
    "settings",
  ];
  panelIds.forEach((panelId) => {
    if (openSet.has(panelId)) context.panelManager.open(panelId);
    else context.panelManager.close(panelId);
  });

  context.floatingPanelOpenSnapshot = null;
}

function snapshotOpenPanels() {
  const openPanels = document.querySelectorAll(".floating-panel.is-open");
  const ids = [];
  openPanels.forEach((panel) => {
    if (!(panel instanceof HTMLElement)) return;
    const panelId = panel.dataset.panelId;
    if (panelId) ids.push(panelId);
  });
  return ids;
}

function buildWorkspaceWindowRegistry() {
  const ids = [
    "map",
    "sidebar",
    "histogram",
    "scatter",
    "insights",
    "products",
    "network",
    "datatable",
    "settings",
  ];
  const registry = new Map();

  ids.forEach((id) => {
    const selector =
      id === "map"
        ? ".window--map"
        : `.floating-panel[data-panel-id=\"${id}\"]`;
    const el = document.querySelector(selector);
    if (el instanceof HTMLElement) {
      registry.set(id, el);
    }
  });

  return registry;
}

function getWorkspaceWindowTitle(registry, windowId) {
  if (windowId === "map") return "地图";
  const el = registry.get(windowId);
  const title = el?.querySelector?.(".floating-panel__title")?.textContent;
  return (title || windowId || "").trim();
}

function collectWorkspaceWindowIds(layout) {
  const set = new Set();
  const visit = (node) => {
    if (!node) return;
    if (node.type === "leaf") {
      (node.tabs || []).forEach((id) => set.add(id));
      return;
    }
    visit(node.first);
    visit(node.second);
  };
  visit(layout);
  if (!set.has("map")) set.add("map");
  return set;
}

function syncPanelsOpenState(context, openSet) {
  if (!context.panelManager) return;

  const panelIds = [
    "sidebar",
    "histogram",
    "scatter",
    "insights",
    "products",
    "network",
    "datatable",
    "settings",
  ];
  panelIds.forEach((panelId) => {
    if (openSet.has(panelId)) context.panelManager.open(panelId);
    else context.panelManager.close(panelId);
  });
}

function loadWorkspaceLayout() {
  if (typeof window === "undefined") return createDefaultWorkspaceLayout();
  let parsed = null;
  try {
    const raw = window.localStorage.getItem(WORKSPACE_LAYOUT_STORAGE_KEY);
    if (!raw) return createDefaultWorkspaceLayout();
    parsed = JSON.parse(raw);
  } catch {
    return createDefaultWorkspaceLayout();
  }

  if (!parsed || parsed.version !== WORKSPACE_LAYOUT_VERSION) {
    return createDefaultWorkspaceLayout();
  }
  if (!isValidWorkspaceNode(parsed.layout)) {
    return createDefaultWorkspaceLayout();
  }
  return parsed.layout;
}

function scheduleSaveWorkspaceLayout(layout) {
  if (typeof window === "undefined") return;
  if (!layout) return;
  if (workspaceLayoutSaveTimer) {
    window.clearTimeout(workspaceLayoutSaveTimer);
  }

  workspaceLayoutSaveTimer = window.setTimeout(() => {
    workspaceLayoutSaveTimer = null;
    try {
      const payload = {
        version: WORKSPACE_LAYOUT_VERSION,
        updatedAt: Date.now(),
        layout,
        openWindows: Array.from(collectWorkspaceWindowIds(layout)),
      };
      window.localStorage.setItem(
        WORKSPACE_LAYOUT_STORAGE_KEY,
        JSON.stringify(payload),
      );
    } catch {
      // ignore
    }
  }, 200);
}

function isValidWorkspaceNode(node, depth = 0) {
  if (!node || depth > 16) return false;
  if (node.type === "leaf") {
    if (typeof node.id !== "string" || !node.id) return false;
    if (!Array.isArray(node.tabs)) return false;
    if (node.tabs.some((id) => typeof id !== "string")) return false;
    if (node.active != null && typeof node.active !== "string") return false;
    return true;
  }

  if (node.type === "split") {
    const directionOk = node.direction === "row" || node.direction === "column";
    if (!directionOk) return false;
    if (typeof node.ratio !== "number" || !Number.isFinite(node.ratio))
      return false;
    return (
      isValidWorkspaceNode(node.first, depth + 1) &&
      isValidWorkspaceNode(node.second, depth + 1)
    );
  }

  return false;
}

function resizeVisibleWindows(context) {
  const hooks = buildPanelResizeHooks(context);
  if (context.workspaceLayoutManager) {
    const openWindows = context.workspaceLayoutManager.getOpenWindows();
    openWindows.forEach((windowId) => {
      if (windowId === "map") return;
      hooks[windowId]?.();
    });
    context.charts.map?.update(context.filteredData);
    return;
  }

  document.querySelectorAll(".floating-panel.is-open").forEach((panel) => {
    if (!(panel instanceof HTMLElement)) return;
    const panelId = panel.dataset.panelId;
    if (!panelId) return;
    hooks[panelId]?.();
  });

  context.charts.map?.update(context.filteredData);
}

function initThemeBridge(context) {
  if (typeof window === "undefined") return;

  // 当主题变化时，同步 JS 色板并刷新图表与图例
  window.addEventListener(THEME_EVENT_NAME, () => {
    refreshColorsFromCss();

    const data = context.filteredData || context.data || [];
    updateLegendForContext(context, data);

    context.charts.map?.update(data);
    context.charts.histogram?.update(data);
    context.charts.scatter?.update(data);
    context.charts.daoProfile?.update(data);
    context.charts.daoProduct?.update(data);
    context.charts.productRanking?.update(data);
    context.charts.network?.update(data);
    context.settingsPanel?.render(buildSettingsPayload(context));
    context.tour?.refresh?.();
  });
}

function mountCharts(context) {
  const { data, geoData, indices, state } = context;
  const mapEncoding = state.get("mapEncoding") || {};
  const datatable = new DataTable("#datatable-container", {
    pageSize: 50,
  });
  datatable.render();
  datatable.update(data);

  return {
    map: new MapView("#map-container", data, {
      geoData,
      colorMode: mapEncoding.colorEncoding,
      colorEncoding: mapEncoding.colorEncoding,
      markerEncoding: mapEncoding.markerEncoding,
    }),
    histogram: new Histogram("#histogram-container", data, {
      // 延迟首帧绘制，统一交给后续 update 流程，避免首次计算到异常尺寸
      autoRender: false,
    }),
    scatter: new ScatterPlot("#scatter-container", data, {
      autoRender: false,
    }),
    daoProfile: new DaoProfileChart("#dao-profile-container", data, {
      autoRender: false,
      onHover: (payload) => handleHoverHighlight(context, payload),
      onClick: (payload) => {
        if (!payload) return;
        const append = Boolean(
          payload.originalEvent?.metaKey || payload.originalEvent?.ctrlKey,
        );
        if (append) {
          updateDaoComparison(context, payload.daoId, true);
          context.state.update({ hoveredIds: payload.ids || [] });
          return;
        }
        const nextFilters = {
          ...state.get("filters"),
          daoIds: payload.daoId ? [payload.daoId] : [],
        };
        state.update({ filters: nextFilters, hoveredIds: payload.ids || [] });
        context.charts.histogram?.clearBrush?.();
      },
    }),
    daoProduct: new DaoProductStackedChart("#dao-product-container", data, {
      autoRender: false,
      onHover: (payload) => handleHoverHighlight(context, payload),
      onClick: (payload) => {
        if (!payload) return;
        const append = Boolean(
          payload.originalEvent?.metaKey || payload.originalEvent?.ctrlKey,
        );
        if (append) {
          updateDaoComparison(context, payload.daoId, true);
          context.state.update({ hoveredIds: payload.ids || [] });
          return;
        }
        const nextFilters = {
          ...state.get("filters"),
          daoIds: payload.daoId ? [payload.daoId] : [],
          productTypes: payload.productType ? [payload.productType] : [],
        };
        state.update({ filters: nextFilters, hoveredIds: payload.ids || [] });
        context.charts.histogram?.clearBrush?.();
      },
    }),
    productRanking: new ProductRanking("#product-ranking-container", data, {
      autoRender: false,
    }),
    network: new NetworkGraph("#network-container", data, {
      cooccurrence: indices?.productCooccurrence,
      productIndex: indices?.productIndex,
      minCooccurrence: 2,
    }),
    datatable,
  };
}

function initPanelManager(context) {
  // 防抖函数，避免 resize 过于频繁
  const debounce = (fn, delay) => {
    let timer = null;
    return (...args) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  };

  const hooks = buildPanelResizeHooks(context);

  const handleResize = debounce((panelId) => {
    hooks[panelId]?.();
  }, 100);

  return new PanelManager({
    onPanelChange: (panelId, isOpen) => {
      const isWorkspace =
        context.state.get("layoutMode") === LAYOUT_MODE.WORKSPACE;
      if (isWorkspace) {
        if (context.workspaceLayoutManager) {
          if (isOpen) context.workspaceLayoutManager.addWindow(panelId);
          else context.workspaceLayoutManager.removeWindow(panelId);
        }
        context.tour?.refresh?.();
        return;
      }

      context.tour?.refresh?.();
      if (!isOpen) return;
      window.requestAnimationFrame(() => handleResize(panelId));
    },
    onPanelResize: (panelId) => {
      if (context.state.get("layoutMode") === LAYOUT_MODE.WORKSPACE) return;
      handleResize(panelId);
      context.tour?.refresh?.();
    },
  });
}

function buildPanelResizeHooks(context) {
  return {
    histogram: () => {
      context.charts.histogram?.update?.(context.filteredData);
    },
    scatter: () => {
      context.charts.scatter?.update?.(context.filteredData);
    },
    insights: () => {
      context.charts.daoProfile?.update?.(context.filteredData);
    },
    products: () => {
      context.charts.daoProduct?.update?.(context.filteredData);
      context.charts.productRanking?.update?.(context.filteredData);
    },
    network: () => {
      context.charts.network?.resize?.();
    },
  };
}

function initSidebar(context) {
  const daoOptions = buildDaoOptions(context.indices);
  const mapEncoding = context.state.get("mapEncoding") || {};
  const legendSections = buildLegendSections({
    daoOptions,
    mapEncoding,
    legendConfig: context.state.get("legendConfig") || {},
    data: context.filteredData || context.data || [],
    radiusRange: context.charts.map?.options?.radiusRange,
  });
  const levelOptions = buildLevelOptions(context.indices, context.data);

  const sidebar = new Sidebar(
    ".floating-panel--sidebar .floating-panel__body",
    {
      onFilterChange: (filters) => {
        const nextFilters = { ...context.state.get("filters"), ...filters };
        context.state.update({ filters: nextFilters });
      },
      onMapEncodingChange: (nextEncoding) => {
        const prev = context.state.get("mapEncoding") || {};
        context.state.update({
          mapEncoding: {
            ...prev,
            ...(nextEncoding || {}),
          },
        });
      },
      onSelectionAsFilterChange: (asFilter) => {
        const prevSelection = context.state.get("selection") || {};
        context.state.update({
          selection: {
            ...prevSelection,
            asFilter: Boolean(asFilter),
          },
        });
      },
      onResetFilters: () => {
        const nextFilters = {
          ...context.state.get("filters"),
          daoIds: [],
          productTypes: [],
          levels: [],
          populationRange: null,
          householdRange: null,
          productRichnessRange: null,
        };
        context.state.update({ filters: nextFilters });
        context.charts.histogram?.clearBrush?.();
      },
    },
  );

  sidebar.render({
    daoOptions,
    levelOptions,
    productTypes: PRODUCT_TYPE_KEYS,
    valueRanges: {
      population: context.statistics?.populationExtent,
      householdSize: context.statistics?.householdSizeExtent,
      productRichness: context.statistics?.productRichnessExtent,
    },
    legendSections,
    mapEncoding,
    filters: context.state.get("filters"),
    selectionAsFilter: Boolean(context.state.get("selection")?.asFilter),
    stats: summarizeData(context.data),
    comparisonItems: buildComparisonItems(context),
    tips: [
      "任务 1：在地图上观察不同颜色与圆点大小，识别人口高度集中的州府与稀疏地区。",
      "任务 2：在直方图中框选户均人口 > 8 人的区间，查看这些异常地区在地图上的空间分布。",
      "任务 3：在筛选器中切换不同道或物产类别，对比各区域的地理聚集性与经济特征。",
      "任务 4：在网络图中点击某种物产（如「麝香」），观察相关地点在地图与散点图中的分布。",
      "任务 5：在散点图中关注同一物产类别下，不同人口规模地区的物产丰富度差异。",
      "任务 6：清空筛选后，结合散点图与地图，整体判断人口规模与物产种类之间是否存在正相关。",
      "任务 7：打开「洞察」面板切换指标，点击某一道快速筛选并观察其它视图的联动变化。",
    ],
  });

  return sidebar;
}

function buildSettingsPayload(context) {
  const themeState = getThemeState();
  const selectionState = context.state.get("selection") || {};
  const legendConfig = context.state.get("legendConfig") || {};

  return {
    themeMode: themeState.mode,
    layoutMode: context.state.get("layoutMode"),
    basemap: normalizeBasemap(context.state.get("basemap")),
    mapEncoding:
      context.state.get("mapEncoding") || DEFAULT_APP_SETTINGS.mapEncoding,
    selectionAsFilter: Boolean(selectionState.asFilter),
    showMarkerLegend: legendConfig.showMarkerLegend !== false,
  };
}

function initSettingsPanel(context) {
  const panel = new SettingsPanel("#settings-container", {
    onThemeModeChange: (mode) => {
      setThemeMode(mode);
    },
    onLayoutModeChange: (mode) => {
      setLayoutMode(context, mode, { persist: true });
    },
    onBasemapChange: (basemap) => {
      context.state.update({ basemap: normalizeBasemap(basemap) });
    },
    onMapEncodingChange: (nextEncoding) => {
      const prev = context.state.get("mapEncoding") || {};
      context.state.update({
        mapEncoding: {
          ...prev,
          ...(nextEncoding || {}),
        },
      });
    },
    onSelectionAsFilterChange: (asFilter) => {
      const prevSelection = context.state.get("selection") || {};
      context.state.update({
        selection: {
          ...prevSelection,
          asFilter: Boolean(asFilter),
        },
      });
    },
    onToggleMarkerLegend: (show) => {
      const prevLegend = context.state.get("legendConfig") || {};
      context.state.update({
        legendConfig: {
          ...prevLegend,
          showMarkerLegend: Boolean(show),
        },
      });
    },
    onRestoreDefaults: () => restoreDefaultSettings(context),
    onRestartTour: () => {
      if (!context.tour) return;
      context.tour.steps = buildTourSteps(context);
      context.tour.start({ force: true });
    },
  });

  panel.render(buildSettingsPayload(context));
  return panel;
}

function restoreDefaultSettings(context) {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(APP_SETTINGS_STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  setThemeMode("auto");
  setLayoutMode(context, LAYOUT_MODE.FLOATING, { persist: true });

  const prevSelection = context.state.get("selection") || {};
  context.state.update({
    basemap: DEFAULT_APP_SETTINGS.basemap,
    mapEncoding: { ...DEFAULT_APP_SETTINGS.mapEncoding },
    legendConfig: { ...DEFAULT_APP_SETTINGS.legendConfig },
    selection: {
      ...prevSelection,
      asFilter: DEFAULT_APP_SETTINGS.selectionAsFilter,
    },
  });

  context.settingsPanel?.render(buildSettingsPayload(context));
}

function buildTourSteps(context) {
  const steps = [
    {
      id: "panels",
      target: '[data-tour-anchor="panel-toggles"]',
      title: "面板开关",
      content:
        "通过这里快速打开/收起各分析面板（指引、直方图、散点图、洞察、物产、网络图、设置）。",
    },
    {
      id: "map",
      target: () =>
        document.querySelector(".map-controls") ||
        document.querySelector('[data-tour-anchor="map"]'),
      title: "地图交互",
      content:
        "拖拽漫游；使用左上角按钮切换框选/套索以选择地点，驱动多视图联动。",
    },
    {
      id: "layout",
      target: "[data-layout-toggle]",
      title: "布局模式",
      content:
        "点击这里在“浮动 / 工作区”布局间切换。工作区模式支持拖拽窗口 tab 拆分/合并，便于做分屏讲解与对比。",
    },
    {
      id: "workspace",
      target: () => document.querySelector(".workspace-tabs"),
      title: "拆分与合并",
      content:
        "在工作区模式下，拖拽窗口 tab：放到九宫格边缘可拆分；放到中心或拖到目标窗口的 tab 栏可合并为一个窗口（通过 tab 切换内容）。",
      skipIfMissingTarget: true,
    },
  ];

  steps.push(
    {
      id: "filters",
      target: '[data-tour-anchor="filters"]',
      title: "筛选器",
      content:
        "按道、级别、人口/户均/物产种类区间筛选，观察地图与其它视图同步变化。",
    },
    {
      id: "comparison",
      target: '[data-tour-anchor="comparison"]',
      title: "对比卡片",
      content: "Ctrl/⌘ 多选地点或道进行并排对比，辅助教学与讲解。",
    },
    {
      id: "settings",
      target: '[data-tour-anchor="settings-entry"]',
      title: "设置入口",
      content:
        "在设置中切换主题、布局模式与地图编码；也可随时在设置中重新打开引导。",
    },
  );

  return steps;
}

function initTour(context) {
  const tour = new Tour(buildTourSteps(context), {
    storageKey: "tang_tour_status",
    version: 1,
    onClose: () => {
      if (!context?.workspaceTourPending) return;
      context.workspaceTourPending = false;
      maybeStartWorkspaceTour(context);
    },
  });

  window.requestAnimationFrame(() => tour.maybeAutoStart());
  context.state.subscribe("layoutMode", () => tour.refresh());
  return tour;
}

function initWorkspaceTour(context) {
  const steps = [
    {
      id: "workspace-tabs",
      target: () =>
        document.querySelector(".workspace-tabs") ||
        document.querySelector(".workspace-leaf") ||
        document.querySelector("[data-workspace-layout]"),
      title: "工作区：拆分与合并",
      content:
        "拖拽窗口 tab：放到九宫格边缘可拆分；放到中心或拖到目标窗口的 tab 栏可合并为一个窗口（通过 tab 切换内容）。",
    },
  ];

  const tour = new Tour(steps, {
    storageKey: "tang_workspace_tour_status",
    version: 1,
  });

  context.state.subscribe("layoutMode", () => tour.refresh());
  return tour;
}

function maybeStartWorkspaceTour(context) {
  if (!context?.workspaceTour) return;
  if (context?.workspaceTourShownOnce) return;
  if (context?.tour?.isOpen) {
    context.workspaceTourPending = true;
    return;
  }
  const isWorkspace =
    context?.state?.get?.("layoutMode") === LAYOUT_MODE.WORKSPACE;
  if (!isWorkspace) return;

  context.workspaceTourShownOnce = true;
  window.requestAnimationFrame(() => {
    context.workspaceTour?.start?.({ force: false });
  });
}

function bindEventBridges(context) {
  const { state } = context;
  let basemapRequestId = 0;

  eventBus.on(EVENTS.LOCATION_SELECT, (location) =>
    handleLocationSelect(context, location),
  );
  eventBus.on(EVENTS.HOUSEHOLD_RANGE_CHANGE, (payload) =>
    handleHouseholdRange(context, payload),
  );
  eventBus.on(EVENTS.PRODUCT_SELECT, (product) =>
    handleProductSelect(context, product),
  );
  eventBus.on(EVENTS.HISTOGRAM_BIN_HOVER, (payload) =>
    handleHoverHighlight(context, payload),
  );
  eventBus.on(EVENTS.PRODUCT_HOVER, (payload) =>
    handleHoverHighlight(context, payload),
  );

  state.subscribe("basemap", (nextBasemap, prevBasemap) => {
    const basemap = normalizeBasemap(nextBasemap);
    const requestId = (basemapRequestId += 1);

    schedulePersistAppSettings(context);
    context.settingsPanel?.render(buildSettingsPayload(context));

    loadGeoDataForBasemap(basemap)
      .then((geoData) => {
        if (requestId !== basemapRequestId) return;
        if (!geoData) return;

        context.geoData = geoData;
        const data = context.filteredData || context.data || [];
        context.charts.map?.update(data, { geoData });
      })
      .catch((error) => {
        if (requestId !== basemapRequestId) return;
        // eslint-disable-next-line no-console
        console.error("[Basemap] failed to load geojson", error);
        const fallback = normalizeBasemap(prevBasemap);
        if (fallback !== basemap) state.update({ basemap: fallback });
      });
  });

  state.subscribe("mapEncoding", (next) => {
    context.sidebar?.updateMapEncoding?.(next);
    updateLegendForContext(context, context.filteredData || context.data || []);
    context.charts.map?.update(context.filteredData || context.data || [], {
      colorEncoding: next?.colorEncoding,
      markerEncoding: next?.markerEncoding,
    });
    schedulePersistAppSettings(context);
    context.settingsPanel?.render(buildSettingsPayload(context));
  });

  state.subscribe("legendConfig", () => {
    updateLegendForContext(context, context.filteredData || context.data || []);
    schedulePersistAppSettings(context);
    context.settingsPanel?.render(buildSettingsPayload(context));
  });

  state.subscribe("layoutMode", () => {
    context.settingsPanel?.render(buildSettingsPayload(context));
    context.tour?.refresh?.();
  });

  state.subscribe("filters", (filters) => {
    // eslint-disable-next-line no-console
    console.debug("[App] filters updated", filters);
    applyFiltersAndRender(context, filters);
  });

  state.subscribe("highlightedIds", () => syncHighlights(context));
  state.subscribe("selection", (next, prev) => {
    context.sidebar?.updateSelectionAsFilter(next?.asFilter);
    const nextAsFilter = Boolean(next?.asFilter);
    const prevAsFilter = Boolean(prev?.asFilter);
    if (nextAsFilter !== prevAsFilter) {
      schedulePersistAppSettings(context);
      context.settingsPanel?.render(buildSettingsPayload(context));
    }
    if (nextAsFilter || prevAsFilter) {
      applyFiltersAndRender(context, state.get("filters"));
      return;
    }
    syncHighlights(context);
  });
  state.subscribe("hoveredIds", () => syncHighlights(context));
  state.subscribe("comparison", () => {
    context.sidebar?.updateComparison(buildComparisonItems(context));
  });
  state.subscribe("selectedProduct", (product) => {
    context.charts.network?.highlight(product ? [product] : []);
    context.charts.productRanking?.highlightProduct(product);
    syncHighlights(context);
  });
}

function bindChartControls(context) {
  initHistogramModeToggle(context);
  initScatterModeToggle(context);
  initStackedModeToggle(context);
  initDaoProfileMetricToggle(context);
}

function handleLocationSelect(context, payload) {
  const location = payload?.location ?? payload;
  const append = Boolean(payload?.append);
  const id = location?.Location_ID || null;
  const daoId = location ? getDaoId(location) : null;
  const prevSelectionState = context.state.get("selection") || {};
  const prevSelected = Array.isArray(prevSelectionState.locationIds)
    ? prevSelectionState.locationIds
    : [];

  let selectedIds = Array.isArray(payload?.ids) ? payload.ids : null;

  if (!selectedIds) {
    if (!id) {
      selectedIds = [];
    } else if (append) {
      if (prevSelected.includes(id)) {
        selectedIds = prevSelected.filter((value) => value !== id);
      } else {
        selectedIds = [...prevSelected, id];
      }
    } else {
      selectedIds = [id];
    }
  }

  const takeLast = (list, count) => {
    if (!Array.isArray(list) || count <= 0) return [];
    const start = Math.max(0, list.length - count);
    const out = [];
    for (let i = start; i < list.length; i += 1) out.push(list[i]);
    return out;
  };

  context.state.update({
    selectedDaoId: daoId,
    selection: {
      ...prevSelectionState,
      locationIds: selectedIds,
    },
    highlightedIds: selectedIds,
    comparison: {
      ...(context.state.get("comparison") || {}),
      locations: takeLast(selectedIds, 2),
    },
  });
}

function handleHouseholdRange(context, payload) {
  const range = payload?.range || null;
  const ids = (payload?.ids || []).filter((id) =>
    getVisibleIdSet(context).has(id),
  );
  const nextFilters = {
    ...context.state.get("filters"),
    householdRange: range,
  };

  context.state.update({
    filters: nextFilters,
    highlightedIds: ids,
  });
}

function handleProductSelect(context, productName) {
  const ids = getProductHighlightIds(context, productName);
  context.state.update({
    selectedProduct: productName || null,
    highlightedIds: ids,
  });
}

function handleHoverHighlight(context, payload) {
  const visibleIds = getVisibleIdSet(context);
  const ids = (payload?.ids || []).filter((id) => visibleIds.has(id));
  context.state.update({ hoveredIds: ids });
}

function updateDaoComparison(context, daoId, append = false) {
  const prev = context.state.get("comparison") || {};
  const currentDaos = Array.isArray(prev.daos) ? prev.daos : [];

  let nextDaos = [];
  if (!daoId) {
    nextDaos = [];
  } else if (append) {
    if (currentDaos.includes(daoId)) {
      nextDaos = currentDaos.filter((value) => value !== daoId);
    } else {
      nextDaos = [...currentDaos, daoId].slice(0, 2);
    }
  } else {
    nextDaos = [daoId];
  }

  context.state.update({
    comparison: {
      ...prev,
      daos: nextDaos,
    },
  });
}

function initHistogramModeToggle(context) {
  const toolbar = document.querySelector("#histogram-toolbar");
  if (!toolbar) return;

  const buttons = Array.from(toolbar.querySelectorAll("[data-mode]"));
  const setActive = (mode) => {
    buttons.forEach((btn) => {
      const isActive = btn.dataset.mode === mode;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  };

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode || "global";
      setActive(mode);
      context.charts.histogram?.update(context.filteredData, {
        facetMode: mode,
      });
    });
  });

  setActive(context.charts.histogram?.options?.facetMode || "global");
}

function initScatterModeToggle(context) {
  const toolbar = document.querySelector("#scatter-toolbar");
  if (!toolbar) return;

  const buttons = Array.from(toolbar.querySelectorAll("[data-mode]"));
  const setActive = (mode) => {
    buttons.forEach((btn) => {
      const isActive = btn.dataset.mode === mode;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  };

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode || "population";
      setActive(mode);
      context.charts.scatter?.update(context.filteredData, { mode });
    });
  });

  setActive(context.charts.scatter?.options?.mode || "population");
}

function initStackedModeToggle(context) {
  const toolbar = document.querySelector("#stacked-toolbar");
  if (!toolbar) return;

  const buttons = Array.from(toolbar.querySelectorAll("[data-mode]"));
  const setActive = (mode) => {
    buttons.forEach((btn) => {
      const isActive = btn.dataset.mode === mode;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  };

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode || "count";
      setActive(mode);
      context.charts.daoProduct?.update(context.filteredData, { mode });
    });
  });

  setActive(context.charts.daoProduct?.options?.mode || "count");
}

function initDaoProfileMetricToggle(context) {
  const toolbar = document.querySelector("#dao-profile-toolbar");
  if (!toolbar) return;

  const buttons = Array.from(toolbar.querySelectorAll("[data-mode]"));
  const setActive = (mode) => {
    buttons.forEach((btn) => {
      const isActive = btn.dataset.mode === mode;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  };

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode || "population";
      setActive(mode);
      context.charts.daoProfile?.update(context.filteredData, { metric: mode });
    });
  });

  setActive(context.charts.daoProfile?.options?.metric || "population");
}

function applyFiltersAndRender(context, filters = {}) {
  const selectionState = context.state.get("selection") || {};
  const selectionIds = Array.isArray(selectionState.locationIds)
    ? selectionState.locationIds
    : [];
  const selectionAsFilter = Boolean(selectionState.asFilter);

  let filtered = filterData(context.data, filters);
  if (selectionAsFilter && selectionIds.length > 0) {
    const selectedSet = new Set(selectionIds);
    filtered = filtered.filter((item) => selectedSet.has(item.Location_ID));
  }

  context.filteredData = filtered;

  updateChartsData(context, filtered);
  context.sidebar?.updateStats(summarizeData(filtered));
  updateLegendForContext(context, filtered);
  context.sidebar?.updateFilters(filters);
  const visibleIdSet = new Set(filtered.map((item) => item.Location_ID));
  const prevSelectionState = context.state.get("selection") || {};
  const prevSelected = Array.isArray(prevSelectionState.locationIds)
    ? prevSelectionState.locationIds
    : [];
  const prevHighlighted = context.state.get("highlightedIds") || [];
  const prevHovered = context.state.get("hoveredIds") || [];
  const comparisonState = context.state.get("comparison") || {};
  const visibleDaos = new Set(
    filtered.map((item) => getDaoId(item)).filter(Boolean),
  );
  const selectedIds = prevSelected.filter((id) => visibleIdSet.has(id));
  const highlightedIds = prevHighlighted.filter((id) => visibleIdSet.has(id));
  const hoveredIds = prevHovered.filter((id) => visibleIdSet.has(id));
  const takeLast = (list, count) => {
    if (!Array.isArray(list) || count <= 0) return [];
    const start = Math.max(0, list.length - count);
    const out = [];
    for (let i = start; i < list.length; i += 1) out.push(list[i]);
    return out;
  };
  const nextComparison = {
    ...comparisonState,
    locations: takeLast(selectedIds, 2),
    daos: (comparisonState.daos || [])
      .filter((daoId) => visibleDaos.has(daoId))
      .slice(0, 2),
  };
  const nextSelection = {
    ...prevSelectionState,
    locationIds: selectedIds,
  };

  if (
    selectedIds.length !== prevSelected.length ||
    highlightedIds.length !== prevHighlighted.length ||
    hoveredIds.length !== prevHovered.length ||
    nextComparison.locations !== comparisonState.locations ||
    nextComparison.daos !== comparisonState.daos
  ) {
    context.state.update({
      selection: nextSelection,
      highlightedIds,
      hoveredIds,
      comparison: nextComparison,
    });
  }

  const statusMessage =
    filtered.length === 0 ? "当前筛选条件下暂无匹配地点" : "";
  context.sidebar?.setStatus(statusMessage);
  if (filtered.length === 0) {
    context.charts.histogram?.clearBrush?.();
  }

  context.sidebar?.updateComparison(buildComparisonItems(context));
  syncHighlights(context);
}

function updateChartsData(context, data) {
  context.charts.map?.update(data);
  context.charts.histogram?.update(data);
  context.charts.scatter?.update(data);
  context.charts.daoProfile?.update(data);
  context.charts.daoProduct?.update(data);
  context.charts.productRanking?.update(data);
  context.charts.network?.update(data, {
    productIndex: null,
    cooccurrence: null,
  });
  context.charts.datatable?.update(data);
}

function syncHighlights(context) {
  const charts = context.charts;
  const highlightIds = computeActiveHighlightIds(context);
  const selectionState = context.state.get("selection") || {};
  const selectionIds = Array.isArray(selectionState.locationIds)
    ? selectionState.locationIds
    : [];
  const selectedProduct = context.state.get("selectedProduct");

  if (selectedProduct) {
    charts.network?.highlight([selectedProduct]);
  } else {
    charts.network?.clearHighlight();
  }

  charts.datatable?.setSelection?.(selectionIds);

  if (!highlightIds.length) {
    charts.map?.clearHighlight();
    charts.histogram?.clearHighlight();
    charts.scatter?.clearHighlight();
    charts.daoProduct?.clearHighlight?.();
    charts.productRanking?.clearHighlight?.();
    charts.datatable?.highlight([]);
    return;
  }

  charts.map?.highlight(highlightIds);
  charts.histogram?.highlight(highlightIds);
  charts.scatter?.highlight(highlightIds);
  charts.daoProduct?.highlight(highlightIds);
  charts.productRanking?.highlightByIds?.(highlightIds);
  charts.datatable?.highlight(highlightIds);
}

function computeActiveHighlightIds(context) {
  const filters = context.state.get("filters") || {};
  const visibleIds = getVisibleIdSet(context);
  const selectionState = context.state.get("selection") || {};
  const selectedIds = Array.isArray(selectionState.locationIds)
    ? selectionState.locationIds
    : [];
  const hoveredIds = context.state.get("hoveredIds") || [];

  let ids = context.state.get("highlightedIds") || [];

  if (context.state.get("selectedProduct")) {
    ids = getProductHighlightIds(context, context.state.get("selectedProduct"));
  } else if (filters.householdRange) {
    ids = idsWithinRange(context.filteredData, filters.householdRange);
  }

  const combined = [...new Set([...hoveredIds, ...ids, ...selectedIds])].filter(
    (id) => visibleIds.has(id),
  );
  return combined;
}

function buildComparisonItems(context) {
  const comparison = context.state.get("comparison") || {};
  const visibleIds = getVisibleIdSet(context);
  const selectedLocations = (comparison.locations || []).filter((id) =>
    visibleIds.has(id),
  );

  if (selectedLocations.length > 0) {
    return selectedLocations
      .slice(0, 2)
      .map((id) => context.filteredData.find((item) => item.Location_ID === id))
      .filter(Boolean)
      .map((item) => buildComparisonFromLocation(item));
  }

  const daoIds = (comparison.daos || []).slice(0, 2);
  if (daoIds.length === 0) return [];

  return daoIds
    .map((daoId) => buildComparisonFromDao(context.filteredData, daoId))
    .filter(Boolean);
}

function buildComparisonFromLocation(item) {
  if (!item) return null;
  return {
    id: item.Location_ID,
    label: item.Location_Name,
    subtitle: `${item.daoName || "-"} · ${item.Administrative_Level || ""}`,
    type: "location",
    population: item.Population,
    households: item.Households,
    householdSize: item.householdSize,
    productRichness: item.productRichness,
    breakdown: buildProductBreakdown(item.Products),
  };
}

function buildComparisonFromDao(data, daoId) {
  if (!daoId) return null;
  const items = (data || []).filter((item) => getDaoId(item) === daoId);
  if (items.length === 0) return null;

  let population = 0;
  let households = 0;
  let householdSizeSum = 0;
  let householdSizeCount = 0;
  const productTotals = {};

  items.forEach((item) => {
    if (Number.isFinite(item.Population)) population += item.Population;
    if (Number.isFinite(item.Households)) households += item.Households;
    if (Number.isFinite(item.householdSize)) {
      householdSizeSum += item.householdSize;
      householdSizeCount += 1;
    }

    const breakdown = buildProductBreakdown(item.Products);
    breakdown.forEach((entry) => {
      productTotals[entry.type] =
        (productTotals[entry.type] || 0) + entry.count;
    });
  });

  const totalProducts = Object.values(productTotals).reduce(
    (sum, value) => sum + value,
    0,
  );

  return {
    id: daoId,
    label: items[0]?.daoName || items[0]?.Location_Name || daoId,
    subtitle: `${items.length} 地 · 道级汇总`,
    type: "dao",
    population,
    households,
    householdSize:
      householdSizeCount > 0 ? householdSizeSum / householdSizeCount : null,
    productRichness: totalProducts,
    breakdown: buildProductBreakdown(productTotals, totalProducts),
  };
}

function buildProductBreakdown(products, presetTotal = null) {
  if (!products) return [];
  const entries = Array.isArray(products)
    ? []
    : Object.entries(products).map(([type, list]) => ({
        type,
        count: Array.isArray(list) ? list.length : list || 0,
      }));

  if (Array.isArray(products)) {
    return [];
  }

  const totals =
    presetTotal !== null
      ? presetTotal
      : entries.reduce((sum, entry) => sum + (entry.count || 0), 0);

  return entries
    .map((entry) => ({
      ...entry,
      ratio: totals > 0 ? entry.count / totals : 0,
      color: getProductTypeColor(entry.type),
    }))
    .filter((entry) => entry.count > 0);
}

function updateLegendForContext(context, data) {
  const daoOptions = buildDaoOptions(context.indices);
  const mapEncoding = context.state.get("mapEncoding") || {};
  const legendConfig = context.state.get("legendConfig") || {};
  const legendSections = buildLegendSections({
    daoOptions,
    mapEncoding,
    legendConfig,
    data: data || context.filteredData || context.data || [],
    radiusRange: context.charts.map?.options?.radiusRange,
  });
  context.sidebar?.updateLegend(legendSections);
}

function filterData(data, filters = {}) {
  const daoSet = new Set(filters.daoIds || []);
  const productTypeSet = new Set(filters.productTypes || []);
  const levelSet = new Set(filters.levels || []);

  const withinRange = (value, range) => {
    if (!Array.isArray(range) || range.length < 2) return true;
    const [min, max] = range;
    const hasMin = Number.isFinite(min);
    const hasMax = Number.isFinite(max);
    if (!hasMin && !hasMax) return true;
    if (!Number.isFinite(value)) return false;
    if (hasMin && value < min) return false;
    if (hasMax && value > max) return false;
    return true;
  };

  return (data || []).filter((item) => {
    if (levelSet.size > 0) {
      const level = item?.Administrative_Level;
      if (!level || !levelSet.has(level)) return false;
    }

    if (!withinRange(item?.Population, filters.populationRange)) return false;
    if (!withinRange(item?.householdSize, filters.householdRange)) return false;
    if (!withinRange(item?.productRichness, filters.productRichnessRange))
      return false;

    if (daoSet.size > 0) {
      const daoId = getDaoId(item);
      if (!daoId || !daoSet.has(daoId)) return false;
    }

    if (productTypeSet.size > 0) {
      const hasType = Array.from(productTypeSet).some((type) => {
        const list = item?.Products?.[type];
        return Array.isArray(list) && list.length > 0;
      });
      if (!hasType) return false;
    }

    return true;
  });
}

function getDaoId(item) {
  if (!item) return null;
  if (item.Administrative_Level === "道") return item.Location_ID;
  return item.Parent_ID || null;
}

function buildDaoOptions(indices) {
  const list = indices?.locationsByLevel?.get("道") || [];
  return list.map((dao) => ({
    id: dao.Location_ID,
    name: dao.Location_Name,
    count: indices?.locationsByDao?.get(dao.Location_ID)?.length || 0,
  }));
}

function buildLevelOptions(indices, data = []) {
  const levelsFromIndex = Array.from(
    indices?.locationsByLevel?.keys?.() || [],
  ).filter(Boolean);
  const levels =
    levelsFromIndex.length > 0
      ? levelsFromIndex
      : Array.from(
          new Set(
            (data || [])
              .map((item) => item?.Administrative_Level)
              .filter(Boolean),
          ),
        );

  const order = ["道", "都", "都护府", "府", "州"];
  const indexOf = (value) => {
    const idx = order.indexOf(value);
    return idx < 0 ? order.length + 1 : idx;
  };

  return levels.slice().sort((a, b) => {
    const diff = indexOf(a) - indexOf(b);
    if (diff !== 0) return diff;
    return `${a}`.localeCompare(`${b}`, "zh-CN");
  });
}

function buildLegendSections(daoOptions = []) {
  const config = Array.isArray(daoOptions) ? { daoOptions } : daoOptions || {};
  const daoList = config.daoOptions || [];
  const mapEncoding = config.mapEncoding || {};
  const legendConfig = config.legendConfig || {};
  const data = config.data || [];
  const radiusRange = Array.isArray(config.radiusRange)
    ? config.radiusRange
    : [3, 18];

  const colorEncoding =
    mapEncoding.colorEncoding === "product" ||
    mapEncoding.colorEncoding === "level" ||
    mapEncoding.colorEncoding === "dao"
      ? mapEncoding.colorEncoding
      : "dao";
  const markerEncoding =
    mapEncoding.markerEncoding === "productRichness" ||
    mapEncoding.markerEncoding === "householdSize" ||
    mapEncoding.markerEncoding === "fixed" ||
    mapEncoding.markerEncoding === "population"
      ? mapEncoding.markerEncoding
      : "population";

  const daoItems =
    daoList.length > 0
      ? daoList.map((dao) => ({
          label: dao.name || dao.id,
          color: getDaoColor(dao.id),
        }))
      : Object.entries(COLORS.daos || {}).map(([daoId, color]) => ({
          label: daoId,
          color: color || getDaoColor(daoId),
        }));

  const sections = [];

  if (colorEncoding === "product") {
    sections.push({
      title: "颜色·物产类别",
      items: PRODUCT_TYPE_KEYS.map((type) => ({
        label: type,
        color: getProductTypeColor(type),
      })),
    });
  } else if (colorEncoding === "level") {
    sections.push({
      title: "颜色·行政层级",
      items: Object.entries(COLORS.administrativeLevels || {}).map(
        ([level, color]) => ({
          label: level,
          color: color || getAdministrativeLevelColor(level),
        }),
      ),
    });
  } else {
    sections.push({
      title: "颜色·十道配色",
      items: daoItems,
    });
  }

  const showMarkerLegend = legendConfig.showMarkerLegend !== false;
  if (showMarkerLegend) {
    const markerLegend = buildMarkerLegend(data, markerEncoding, radiusRange);
    if (markerLegend) sections.push(markerLegend);
  }

  return sections;
}

function buildMarkerLegend(data, markerEncoding, radiusRange) {
  const range = Array.isArray(radiusRange) ? radiusRange : [3, 18];
  const minR = Number.isFinite(range?.[0]) ? range[0] : 3;
  const maxR = Number.isFinite(range?.[1]) ? range[1] : 18;

  const labelMap = {
    population: "人口",
    productRichness: "物产种类",
    householdSize: "户均人口",
    fixed: "固定",
  };

  if (markerEncoding === "fixed") {
    return {
      title: `点大小·${labelMap[markerEncoding] || markerEncoding}`,
      items: [
        {
          label: "固定",
          color: COLORS.theme.textMuted,
          size: Math.round(((minR + maxR) / 2) * 2),
        },
      ],
    };
  }

  const values = (data || [])
    .map((item) => {
      if (markerEncoding === "productRichness") return item.productRichness;
      if (markerEncoding === "householdSize") return item.householdSize;
      return item.Population;
    })
    .filter((value) => Number.isFinite(value));

  const extent = computeNumericExtent(values);
  if (!extent) return null;

  const scale = createSqrtRadiusScale(extent, [minR, maxR]);
  const mid = (extent[0] + extent[1]) / 2;
  const samples = [extent[0], mid, extent[1]];

  const formatter =
    markerEncoding === "householdSize"
      ? (value) => Format.householdSize(value, { fallback: "-" })
      : markerEncoding === "productRichness"
        ? (value) => Format.number(value, { fallback: "-" })
        : (value) => Format.population(value, { fallback: "-" });

  return {
    title: `点大小·${labelMap[markerEncoding] || markerEncoding}`,
    items: samples.map((value) => ({
      label: formatter(value),
      color: COLORS.theme.textMuted,
      size: Math.round(scale(value) * 2),
    })),
  };
}

function computeNumericExtent(values) {
  let min = Infinity;
  let max = -Infinity;
  (values || []).forEach((value) => {
    if (!Number.isFinite(value)) return;
    if (value < min) min = value;
    if (value > max) max = value;
  });
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (min === max) {
    if (min === 0) return [0, 1];
    return [min * 0.95, min * 1.05];
  }
  return [min, max];
}

function createSqrtRadiusScale(domain, range) {
  const [min, max] =
    Array.isArray(domain) && domain.length >= 2 ? domain : [0, 1];
  const [outMin, outMax] =
    Array.isArray(range) && range.length >= 2 ? range : [3, 18];
  const span = Math.max(1e-9, max - min);

  return (value) => {
    if (!Number.isFinite(value)) return outMin;
    const clamped = Math.min(max, Math.max(min, value));
    const t = Math.sqrt((clamped - min) / span);
    return outMin + t * (outMax - outMin);
  };
}

function summarizeData(data = []) {
  const summary = {
    totalLocations: data.length,
    totalPopulation: 0,
    totalHouseholds: 0,
    averageHouseholdSize: null,
    averageProductRichness: null,
  };

  let householdSizeCount = 0;
  let householdSizeSum = 0;
  let productRichnessSum = 0;
  let productRichnessCount = 0;

  data.forEach((item) => {
    if (Number.isFinite(item.Population)) {
      summary.totalPopulation += item.Population;
    }
    if (Number.isFinite(item.Households)) {
      summary.totalHouseholds += item.Households;
    }
    if (Number.isFinite(item.householdSize)) {
      householdSizeSum += item.householdSize;
      householdSizeCount += 1;
    }
    if (Number.isFinite(item.productRichness)) {
      productRichnessSum += item.productRichness;
      productRichnessCount += 1;
    }
  });

  summary.averageHouseholdSize =
    householdSizeCount > 0 ? householdSizeSum / householdSizeCount : null;

  summary.averageProductRichness =
    productRichnessCount > 0 ? productRichnessSum / productRichnessCount : null;

  return summary;
}

function getVisibleIdSet(context) {
  return new Set(
    (context.filteredData || context.data || []).map(
      (item) => item.Location_ID,
    ),
  );
}

function idsWithinRange(data = [], range = null) {
  if (!range || range.length < 2) return [];
  const [min, max] = range;
  return data
    .filter(
      (item) =>
        Number.isFinite(item.householdSize) &&
        item.householdSize >= min &&
        item.householdSize <= max,
    )
    .map((item) => item.Location_ID);
}

function getProductHighlightIds(context, productName) {
  if (!productName) return [];
  const visibleIds = getVisibleIdSet(context);
  const related = DataQuery.getByProduct(productName) || [];
  return related
    .map((item) => item.Location_ID)
    .filter((id) => visibleIds.has(id));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
