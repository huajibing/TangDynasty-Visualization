// 侧边栏组件：汇总统计、筛选器、图例和探索提示。

import { FilterPanel } from './filter.js';
import { Legend } from './legend.js';
import {
  formatHouseholdSize,
  formatHouseholds,
  formatPopulation,
  Format,
} from '../utils/format.js';
import { getProductTypeColor } from '../utils/colors.js';

function resolveContainer(target) {
  if (!target) return null;
  if (typeof target === 'string') {
    return document.querySelector(target);
  }
  return target;
}

export class Sidebar {
  constructor(container, options = {}) {
    this.container = resolveContainer(container);
    this.options = options;
    this.filterPanel = null;
    this.legend = null;
    this.metricRefs = {};
    this.statusEl = null;
    this.comparisonContainer = null;
  }

  render(payload = {}) {
    if (!this.container) return;

    this.destroy();
    this.container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'sidebar';

    const statsSection = this._renderStats(payload.stats);
    if (statsSection) wrapper.appendChild(statsSection);

    const comparisonSection = this._renderComparison(payload.comparisonItems);
    if (comparisonSection) wrapper.appendChild(comparisonSection);

    const filterSection = document.createElement('section');
    filterSection.className = 'sidebar__block';
    const filterTitle = document.createElement('h2');
    filterTitle.className = 'sidebar__title';
    filterTitle.textContent = '筛选器';

    const filterContainer = document.createElement('div');
    filterContainer.className = 'sidebar__filters';
    filterSection.appendChild(filterTitle);
    filterSection.appendChild(filterContainer);
    wrapper.appendChild(filterSection);

    this.filterPanel = new FilterPanel(filterContainer, {
      daoOptions: payload.daoOptions || [],
      productTypeOptions: payload.productTypes || [],
      onChange: (filters) => this.options.onFilterChange?.(filters),
      onReset: () => this.options.onResetFilters?.(),
    });
    this.filterPanel.render(payload.filters);

    const legendSection = document.createElement('section');
    legendSection.className = 'sidebar__block';
    const legendTitle = document.createElement('h2');
    legendTitle.className = 'sidebar__title';
    legendTitle.textContent = '图例';
    const legendContainer = document.createElement('div');
    legendContainer.className = 'sidebar__legend';
    legendSection.appendChild(legendTitle);
    legendSection.appendChild(legendContainer);
    wrapper.appendChild(legendSection);

    this.legend = new Legend(legendContainer);
    this.legend.render(payload.legendSections || []);

    const tipsSection = this._renderTips(payload.tips);
    if (tipsSection) wrapper.appendChild(tipsSection);

    this.container.appendChild(wrapper);
  }

  updateStats(stats = {}) {
    const defaults = {
      totalLocations: 0,
      totalPopulation: 0,
      totalHouseholds: 0,
      averageHouseholdSize: null,
      averageProductRichness: null,
    };
    const merged = { ...defaults, ...(stats || {}) };

    if (this.metricRefs.totalLocations) {
      this.metricRefs.totalLocations.textContent = Format.number(merged.totalLocations, {
        fallback: '0',
      });
    }
    if (this.metricRefs.totalPopulation) {
      this.metricRefs.totalPopulation.textContent = formatPopulation(merged.totalPopulation);
    }
    if (this.metricRefs.totalHouseholds) {
      this.metricRefs.totalHouseholds.textContent = formatHouseholds(merged.totalHouseholds);
    }
    if (this.metricRefs.averageHouseholdSize) {
      this.metricRefs.averageHouseholdSize.textContent = formatHouseholdSize(
        merged.averageHouseholdSize,
      );
    }
    if (this.metricRefs.averageProductRichness) {
      this.metricRefs.averageProductRichness.textContent = Format.number(
        merged.averageProductRichness,
        {
          maximumFractionDigits: 1,
          fallback: '-',
        },
      );
    }
  }

  updateFilters(filters) {
    this.filterPanel?.setFilters(filters);
  }

  updateLegend(sections = []) {
    this.legend?.render(sections);
  }

  updateComparison(items = []) {
    if (!this.comparisonContainer) return;
    this.comparisonContainer.innerHTML = '';
    const list = Array.isArray(items) ? items.slice(0, 2) : [];

    if (list.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'comparison__placeholder';
      empty.textContent = '在地图/数据表 Ctrl/⌘ 多选地点，或在堆叠图 Ctrl/⌘ 点击两道进行对比';
      this.comparisonContainer.appendChild(empty);
      return;
    }

    list.forEach((item) => {
      const card = this._buildComparisonCard(item);
      this.comparisonContainer.appendChild(card);
    });
  }

  setStatus(message = '') {
    if (!this.statusEl) return;
    this.statusEl.textContent = message;
    this.statusEl.classList.toggle('is-visible', Boolean(message));
  }

  destroy() {
    this.filterPanel?.destroy();
    this.legend?.destroy();
    this.filterPanel = null;
    this.legend = null;
    this.metricRefs = {};
    this.statusEl = null;
    this.comparisonContainer = null;
  }

  _renderStats(stats = {}) {
    const section = document.createElement('section');
    section.className = 'sidebar__block';

    const title = document.createElement('h2');
    title.className = 'sidebar__title';
    title.textContent = '数据总览';
    section.appendChild(title);

    const list = document.createElement('div');
    list.className = 'sidebar__metrics';
    const metrics = [
      { key: 'totalLocations', label: '地点数量' },
      { key: 'totalPopulation', label: '总人口' },
      { key: 'totalHouseholds', label: '总户数' },
      { key: 'averageHouseholdSize', label: '户均人口' },
      { key: 'averageProductRichness', label: '平均物产种类' },
    ];

    metrics.forEach((metric) => {
      const item = document.createElement('div');
      item.className = 'sidebar__metric';

      const label = document.createElement('span');
      label.className = 'sidebar__metric-label';
      label.textContent = metric.label;

      const value = document.createElement('span');
      value.className = 'sidebar__metric-value';
      value.textContent = '-';

      item.appendChild(label);
      item.appendChild(value);
      list.appendChild(item);

      this.metricRefs[metric.key] = value;
    });

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'sidebar__status';
    this.statusEl.setAttribute('aria-live', 'polite');

    section.appendChild(list);
    section.appendChild(this.statusEl);
    this.updateStats(stats);
    return section;
  }

  _renderComparison(items = []) {
    const section = document.createElement('section');
    section.className = 'sidebar__block sidebar__comparison';

    const title = document.createElement('h2');
    title.className = 'sidebar__title';
    title.textContent = '对比卡片';
    section.appendChild(title);

    const container = document.createElement('div');
    container.className = 'comparison-grid';
    section.appendChild(container);
    this.comparisonContainer = container;

    this.updateComparison(items);
    return section;
  }

  _renderTips(tips = []) {
    const validTips = (tips || []).filter(Boolean);
    if (validTips.length === 0) return null;

    const section = document.createElement('section');
    section.className = 'sidebar__block sidebar__tips';

    const title = document.createElement('h2');
    title.className = 'sidebar__title';
    title.textContent = '探索提示';

    const list = document.createElement('ul');
    list.className = 'sidebar__tip-list';

    validTips.forEach((tip) => {
      const item = document.createElement('li');
      item.textContent = tip;
      list.appendChild(item);
    });

    section.appendChild(title);
    section.appendChild(list);
    return section;
  }

  _buildComparisonCard(item) {
    const card = document.createElement('div');
    card.className = 'comparison-card';

    const header = document.createElement('div');
    header.className = 'comparison-card__header';

    const titleBox = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'comparison-card__name';
    name.textContent = item.label;
    const subtitle = document.createElement('div');
    subtitle.className = 'comparison-card__subtitle';
    subtitle.textContent = item.subtitle || '';
    titleBox.appendChild(name);
    titleBox.appendChild(subtitle);

    const tag = document.createElement('span');
    tag.className = 'comparison-card__tag';
    tag.textContent = item.type === 'dao' ? '道级' : '地点';

    header.appendChild(titleBox);
    header.appendChild(tag);

    const metrics = document.createElement('div');
    metrics.className = 'comparison-card__metrics';
    const metricDefs = [
      { label: '人口', value: formatPopulation(item.population) },
      { label: '户数', value: formatHouseholds(item.households) },
      { label: '户均人口', value: formatHouseholdSize(item.householdSize) },
      {
        label: '物产条目',
        value: Format.number(item.productRichness, { fallback: '-' }),
      },
    ];
    metricDefs.forEach((metric) => {
      const row = document.createElement('div');
      row.className = 'comparison-card__metric';
      const label = document.createElement('span');
      label.textContent = metric.label;
      const value = document.createElement('span');
      value.className = 'comparison-card__metric-value';
      value.textContent = metric.value;
      row.appendChild(label);
      row.appendChild(value);
      metrics.appendChild(row);
    });

    const breakdown = document.createElement('div');
    breakdown.className = 'comparison-card__breakdown';
    const total = item.breakdown?.reduce((sum, entry) => sum + (entry.count || 0), 0) || 0;
    if (total === 0) {
      const empty = document.createElement('div');
      empty.className = 'comparison-card__empty';
      empty.textContent = '暂无物产数据';
      breakdown.appendChild(empty);
    } else {
      const bar = document.createElement('div');
      bar.className = 'comparison-card__bar';
      item.breakdown.forEach((entry) => {
        const segment = document.createElement('span');
        segment.className = 'comparison-card__bar-segment';
        segment.style.width = `${Math.max((entry.ratio || 0) * 100, 2)}%`;
        segment.style.backgroundColor = entry.color || getProductTypeColor(entry.type);
        segment.title = `${entry.type} ${entry.count}`;
        bar.appendChild(segment);
      });
      const legend = document.createElement('div');
      legend.className = 'comparison-card__legend';
      item.breakdown.forEach((entry) => {
        const pill = document.createElement('span');
        pill.className = 'comparison-card__pill';
        pill.style.backgroundColor = entry.color || getProductTypeColor(entry.type);
        pill.textContent = `${entry.type} ${entry.count}`;
        legend.appendChild(pill);
      });
      breakdown.appendChild(bar);
      breakdown.appendChild(legend);
    }

    card.appendChild(header);
    card.appendChild(metrics);
    card.appendChild(breakdown);
    return card;
  }
}
