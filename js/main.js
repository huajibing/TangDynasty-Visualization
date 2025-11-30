// 应用入口：初始化数据管线、全局状态与四个视图，完成联动交互。

import { appConfig } from './config.js';
import MapView from './charts/MapView.js';
import Histogram from './charts/Histogram.js';
import ScatterPlot from './charts/ScatterPlot.js';
import NetworkGraph from './charts/NetworkGraph.js';
import DaoProductStackedChart from './charts/DaoProductStackedChart.js';
import ProductRanking from './charts/ProductRanking.js';
import DataLoader from './data/dataLoader.js';
import DataProcessor from './data/dataProcessor.js';
import DataQuery from './data/dataQuery.js';
import { AppState } from './state.js';
import { Sidebar } from './components/sidebar.js';
import { PanelManager } from './components/panelManager.js';
import { DataTable } from './components/DataTable.js';
import {
  COLORS,
  PRODUCT_TYPE_KEYS,
  getAdministrativeLevelColor,
  getDaoColor,
  getProductTypeColor,
  refreshColorsFromCss,
} from './utils/colors.js';
import eventBus, { EVENTS } from './utils/eventBus.js';
import { initTheme, bindThemeToggle, THEME_EVENT_NAME } from './theme.js';

// 优先初始化主题，确保 CSS 变量与 data-theme 就位
initTheme();
// 主题就绪后立刻从 CSS 同步 JS 色板，避免初次渲染与 CSS 不一致
refreshColorsFromCss();

async function bootstrap() {
  // eslint-disable-next-line no-console
  console.log('Tang visualization app bootstrap (phase 4)', appConfig);

  // 绑定主题切换按钮（如果存在）
  bindThemeToggle('.theme-toggle');

  try {
    const rawData = await DataLoader.loadAll(appConfig.dataPath);
    const processed = DataProcessor.process(rawData);
    DataQuery.init(processed);

    // 基础数据检查输出，便于验证数据管线是否正常
    // eslint-disable-next-line no-console
    console.groupCollapsed('[DataPipeline] 加载校验');
    // eslint-disable-next-line no-console
    console.log('地点数量:', processed.data.length);
    // eslint-disable-next-line no-console
    console.log('人口总数:', processed.statistics?.totalPopulation ?? 0);
    // eslint-disable-next-line no-console
    console.log('户数总数:', processed.statistics?.totalHouseholds ?? 0);
    // eslint-disable-next-line no-console
    console.log('物产种类数:', processed.statistics?.productFrequency?.size ?? 0);
    // eslint-disable-next-line no-console
    console.log('物产类别数:', processed.statistics?.productTypeCount?.size ?? 0);
    // eslint-disable-next-line no-console
    console.log('GeoJSON features:', rawData.geoData?.features?.length ?? 0);
    // eslint-disable-next-line no-console
    console.groupEnd();

    initApp(processed, rawData);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Data pipeline initialization failed', error);
  }
}

function initApp(processed, rawData) {
  const state = new AppState({
    filters: { daoIds: [], productTypes: [], householdRange: null },
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
    panelManager: null,
  };

  context.charts = mountCharts(context);
  context.sidebar = initSidebar(context);
  context.panelManager = initPanelManager(context);
  initThemeBridge(context);
  bindEventBridges(context);
  bindChartControls(context);
  applyFiltersAndRender(context, state.get('filters'));

  // 确保散点图在初次布局稳定后完成一次基于最终尺寸的渲染，
  // 避免个别浏览器在首帧尚未完成布局时计算到异常尺寸而导致空白。
  window.requestAnimationFrame(() => {
    context.charts.scatter?.update(context.filteredData);
  });

  // 暴露给浏览器控制台，便于后续快速检查
  window.__tangData = { rawData, ...processed };
}

function initThemeBridge(context) {
  if (typeof window === 'undefined') return;

  // 当主题变化时，同步 JS 色板并刷新图表与图例
  window.addEventListener(THEME_EVENT_NAME, () => {
    refreshColorsFromCss();

    const data = context.filteredData || context.data || [];
    const daoOptions = buildDaoOptions(context.indices);
    const legendSections = buildLegendSections(daoOptions);

    context.sidebar?.updateLegend(legendSections);

    context.charts.map?.update(data);
    context.charts.histogram?.update(data);
    context.charts.scatter?.update(data);
    context.charts.daoProduct?.update(data);
    context.charts.productRanking?.update(data);
    context.charts.network?.update(data);
  });
}

function mountCharts(context) {
  const { data, geoData, indices, state } = context;
  const datatable = new DataTable('#datatable-container', {
    pageSize: 50,
  });
  datatable.render();
  datatable.update(data);

  return {
    map: new MapView('#map-container', data, {
      geoData,
      colorMode: 'dao',
    }),
    histogram: new Histogram('#histogram-container', data, {
      // 延迟首帧绘制，统一交给后续 update 流程，避免首次计算到异常尺寸
      autoRender: false,
    }),
    scatter: new ScatterPlot('#scatter-container', data, {
      autoRender: false,
    }),
    daoProduct: new DaoProductStackedChart('#dao-product-container', data, {
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
          ...state.get('filters'),
          daoIds: payload.daoId ? [payload.daoId] : [],
          productTypes: payload.productType ? [payload.productType] : [],
        };
        state.update({ filters: nextFilters, hoveredIds: payload.ids || [] });
        context.charts.histogram?.clearBrush?.();
      },
    }),
    productRanking: new ProductRanking('#product-ranking-container', data, {
      autoRender: false,
    }),
    network: new NetworkGraph('#network-container', data, {
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

  const handleResize = debounce((panelId) => {
    if (panelId === 'histogram') {
      context.charts.histogram?.resize?.();
      context.charts.histogram?.update?.(context.filteredData);
    } else if (panelId === 'scatter') {
      context.charts.scatter?.resize?.();
      context.charts.scatter?.update?.(context.filteredData);
    } else if (panelId === 'products') {
      context.charts.daoProduct?.resize?.();
      context.charts.daoProduct?.update?.(context.filteredData);
      context.charts.productRanking?.resize?.();
      context.charts.productRanking?.update?.(context.filteredData);
    } else if (panelId === 'network') {
      context.charts.network?.resize?.();
    }
  }, 100);

  const panelManager = new PanelManager({
    onPanelChange: (panelId, isOpen) => {
      // 面板打开时，触发对应图表的 resize 以适应新尺寸
      if (isOpen) {
        window.requestAnimationFrame(() => handleResize(panelId));
      }
    },
    onPanelResize: (panelId) => {
      // 面板大小改变时，更新对应图表
      handleResize(panelId);
    },
  });

  return panelManager;
}

function initSidebar(context) {
  const daoOptions = buildDaoOptions(context.indices);
  const legendSections = buildLegendSections(daoOptions);

  const sidebar = new Sidebar('.floating-panel--sidebar .floating-panel__body', {
    onFilterChange: (filters) => {
      const nextFilters = { ...context.state.get('filters'), ...filters };
      context.state.update({ filters: nextFilters });
    },
    onResetFilters: () => {
      const nextFilters = { ...context.state.get('filters'), daoIds: [], productTypes: [] };
      context.state.update({ filters: nextFilters });
      context.charts.histogram?.clearBrush?.();
    },
  });

  sidebar.render({
    daoOptions,
    productTypes: PRODUCT_TYPE_KEYS,
    legendSections,
    filters: context.state.get('filters'),
    stats: summarizeData(context.data),
    comparisonItems: buildComparisonItems(context),
    tips: [
      '任务 1：在地图上观察不同颜色与圆点大小，识别人口高度集中的州府与稀疏地区。',
      '任务 2：在直方图中框选户均人口 > 8 人的区间，查看这些异常地区在地图上的空间分布。',
      '任务 3：在筛选器中切换不同道或物产类别，对比各区域的地理聚集性与经济特征。',
      '任务 4：在网络图中点击某种物产（如「麝香」），观察相关地点在地图与散点图中的分布。',
      '任务 5：在散点图中关注同一物产类别下，不同人口规模地区的物产丰富度差异。',
      '任务 6：清空筛选后，结合散点图与地图，整体判断人口规模与物产种类之间是否存在正相关。',
    ],
  });

  return sidebar;
}

function bindEventBridges(context) {
  const { state } = context;

  eventBus.on(EVENTS.LOCATION_SELECT, (location) => handleLocationSelect(context, location));
  eventBus.on(EVENTS.HOUSEHOLD_RANGE_CHANGE, (payload) => handleHouseholdRange(context, payload));
  eventBus.on(EVENTS.PRODUCT_SELECT, (product) => handleProductSelect(context, product));
  eventBus.on(EVENTS.HISTOGRAM_BIN_HOVER, (payload) => handleHoverHighlight(context, payload));
  eventBus.on(EVENTS.PRODUCT_HOVER, (payload) => handleHoverHighlight(context, payload));

  state.subscribe('filters', (filters) => {
    // eslint-disable-next-line no-console
    console.debug('[App] filters updated', filters);
    applyFiltersAndRender(context, filters);
  });

  state.subscribe('highlightedIds', () => syncHighlights(context));
  state.subscribe('selectedLocationIds', () => syncHighlights(context));
  state.subscribe('hoveredIds', () => syncHighlights(context));
  state.subscribe('comparison', () => {
    context.sidebar?.updateComparison(buildComparisonItems(context));
  });
  state.subscribe('selectedProduct', (product) => {
    context.charts.network?.highlight(product ? [product] : []);
    context.charts.productRanking?.highlightProduct(product);
    syncHighlights(context);
  });
}

function bindChartControls(context) {
  initHistogramModeToggle(context);
  initScatterModeToggle(context);
  initStackedModeToggle(context);
}

function handleLocationSelect(context, payload) {
  const location = payload?.location ?? payload;
  const append = Boolean(payload?.append);
  const id = location?.Location_ID || null;
  const daoId = location ? getDaoId(location) : null;
  const prevSelected = context.state.get('selectedLocationIds') || [];

  let selectedIds = Array.isArray(payload?.ids) ? payload.ids.slice(0, 2) : [];

  if (!selectedIds.length) {
    if (!id) {
      selectedIds = [];
    } else if (append) {
      if (prevSelected.includes(id)) {
        selectedIds = prevSelected.filter((value) => value !== id);
      } else {
        selectedIds = [...prevSelected, id].slice(0, 2);
      }
    } else {
      selectedIds = [id];
    }
  }

  context.state.update({
    selectedDaoId: daoId,
    selectedLocationIds: selectedIds,
    highlightedIds: selectedIds,
    comparison: {
      ...(context.state.get('comparison') || {}),
      locations: selectedIds,
    },
  });
}

function handleHouseholdRange(context, payload) {
  const range = payload?.range || null;
  const ids = (payload?.ids || []).filter((id) => getVisibleIdSet(context).has(id));
  const nextFilters = { ...context.state.get('filters'), householdRange: range };

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
  const prev = context.state.get('comparison') || {};
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
  const toolbar = document.querySelector('#histogram-toolbar');
  if (!toolbar) return;

  const buttons = Array.from(toolbar.querySelectorAll('[data-mode]'));
  const setActive = (mode) => {
    buttons.forEach((btn) => {
      const isActive = btn.dataset.mode === mode;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  };

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode || 'global';
      setActive(mode);
      context.charts.histogram?.update(context.filteredData, { facetMode: mode });
    });
  });

  setActive(context.charts.histogram?.options?.facetMode || 'global');
}

function initScatterModeToggle(context) {
  const toolbar = document.querySelector('#scatter-toolbar');
  if (!toolbar) return;

  const buttons = Array.from(toolbar.querySelectorAll('[data-mode]'));
  const setActive = (mode) => {
    buttons.forEach((btn) => {
      const isActive = btn.dataset.mode === mode;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  };

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode || 'population';
      setActive(mode);
      context.charts.scatter?.update(context.filteredData, { mode });
    });
  });

  setActive(context.charts.scatter?.options?.mode || 'population');
}

function initStackedModeToggle(context) {
  const toolbar = document.querySelector('#stacked-toolbar');
  if (!toolbar) return;

  const buttons = Array.from(toolbar.querySelectorAll('[data-mode]'));
  const setActive = (mode) => {
    buttons.forEach((btn) => {
      const isActive = btn.dataset.mode === mode;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  };

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode || 'count';
      setActive(mode);
      context.charts.daoProduct?.update(context.filteredData, { mode });
    });
  });

  setActive(context.charts.daoProduct?.options?.mode || 'count');
}

function applyFiltersAndRender(context, filters = {}) {
  const filtered = filterData(context.data, filters);
  context.filteredData = filtered;

  updateChartsData(context, filtered);
  context.sidebar?.updateStats(summarizeData(filtered));
  context.sidebar?.updateFilters(filters);
  const visibleIdSet = new Set(filtered.map((item) => item.Location_ID));
  const prevSelected = context.state.get('selectedLocationIds') || [];
  const prevHighlighted = context.state.get('highlightedIds') || [];
  const prevHovered = context.state.get('hoveredIds') || [];
  const comparisonState = context.state.get('comparison') || {};
  const visibleDaos = new Set(
    filtered
      .map((item) => getDaoId(item))
      .filter(Boolean),
  );
  const selectedIds = prevSelected.filter((id) => visibleIdSet.has(id));
  const highlightedIds = prevHighlighted.filter((id) => visibleIdSet.has(id));
  const hoveredIds = prevHovered.filter((id) => visibleIdSet.has(id));
  const nextComparison = {
    ...comparisonState,
    locations: selectedIds,
    daos: (comparisonState.daos || []).filter((daoId) => visibleDaos.has(daoId)).slice(0, 2),
  };

  if (
    selectedIds.length !== prevSelected.length ||
    highlightedIds.length !== prevHighlighted.length ||
    hoveredIds.length !== prevHovered.length ||
    nextComparison.locations !== comparisonState.locations ||
    nextComparison.daos !== comparisonState.daos
  ) {
    context.state.update({
      selectedLocationIds: selectedIds,
      highlightedIds,
      hoveredIds,
      comparison: nextComparison,
    });
  }

  const statusMessage = filtered.length === 0 ? '当前筛选条件下暂无匹配地点' : '';
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
  const selectedProduct = context.state.get('selectedProduct');

  if (selectedProduct) {
    charts.network?.highlight([selectedProduct]);
  } else {
    charts.network?.clearHighlight();
  }

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
  const filters = context.state.get('filters') || {};
  const visibleIds = getVisibleIdSet(context);
  const selectedIds = context.state.get('selectedLocationIds') || [];
  const hoveredIds = context.state.get('hoveredIds') || [];

  let ids = context.state.get('highlightedIds') || [];

  if (context.state.get('selectedProduct')) {
    ids = getProductHighlightIds(context, context.state.get('selectedProduct'));
  } else if (filters.householdRange) {
    ids = idsWithinRange(context.filteredData, filters.householdRange);
  }

  const combined = [...new Set([...hoveredIds, ...ids, ...selectedIds])].filter((id) =>
    visibleIds.has(id),
  );
  return combined;
}

function buildComparisonItems(context) {
  const comparison = context.state.get('comparison') || {};
  const visibleIds = getVisibleIdSet(context);
  const selectedLocations = (comparison.locations || []).filter((id) => visibleIds.has(id));

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
    subtitle: `${item.daoName || '-'} · ${item.Administrative_Level || ''}`,
    type: 'location',
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
      productTotals[entry.type] = (productTotals[entry.type] || 0) + entry.count;
    });
  });

  const totalProducts = Object.values(productTotals).reduce((sum, value) => sum + value, 0);

  return {
    id: daoId,
    label: items[0]?.daoName || items[0]?.Location_Name || daoId,
    subtitle: `${items.length} 地 · 道级汇总`,
    type: 'dao',
    population,
    households,
    householdSize: householdSizeCount > 0 ? householdSizeSum / householdSizeCount : null,
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

function filterData(data, filters = {}) {
  const daoSet = new Set(filters.daoIds || []);
  const productTypeSet = new Set(filters.productTypes || []);

  return (data || []).filter((item) => {
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
  if (item.Administrative_Level === '道') return item.Location_ID;
  return item.Parent_ID || null;
}

function buildDaoOptions(indices) {
  const list = indices?.locationsByLevel?.get('道') || [];
  return list.map((dao) => ({
    id: dao.Location_ID,
    name: dao.Location_Name,
    count: indices?.locationsByDao?.get(dao.Location_ID)?.length || 0,
  }));
}

function buildLegendSections(daoOptions = []) {
  const daoItems =
    daoOptions.length > 0
      ? daoOptions.map((dao) => ({
          label: dao.name || dao.id,
          color: getDaoColor(dao.id),
        }))
      : Object.entries(COLORS.daos || {}).map(([daoId, color]) => ({
          label: daoId,
          color: color || getDaoColor(daoId),
        }));

  return [
    {
      title: '物产类别',
      items: PRODUCT_TYPE_KEYS.map((type) => ({
        label: type,
        color: getProductTypeColor(type),
      })),
    },
    {
      title: '行政层级',
      items: Object.entries(COLORS.administrativeLevels || {}).map(([level, color]) => ({
        label: level,
        color: color || getAdministrativeLevelColor(level),
      })),
    },
    {
      title: '十道配色',
      items: daoItems,
    },
  ];
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
  return new Set((context.filteredData || context.data || []).map((item) => item.Location_ID));
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
  return related.map((item) => item.Location_ID).filter((id) => visibleIds.has(id));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
