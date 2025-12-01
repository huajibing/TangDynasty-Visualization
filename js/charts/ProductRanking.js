// Top N 物产排行榜：按出现地点数排序，支持 hover 反查地图与点击锁定物产。

import BaseChart from './BaseChart.js';
import { Tooltip } from '../components/tooltip.js';
import { getProductTypeColor } from '../utils/colors.js';
import { Format } from '../utils/format.js';
import eventBus, { EVENTS } from '../utils/eventBus.js';

class ProductRanking extends BaseChart {
  get defaultOptions() {
    const base = super.defaultOptions;
    return {
      ...base,
      margin: {
        ...base.margin,
        left: 96,
        right: 24,
        bottom: 44,
        top: 16,
      },
      topN: 12,
    };
  }

  _setupScales() {
    this._buildStats();

    const xMax = d3.max(this.items, (item) => item.locationCount) || 1;
    this.xScale = d3.scaleLinear().domain([0, xMax]).range([0, this.width]).nice();
    this.yScale = d3
      .scaleBand()
      .domain(this.items.map((item) => item.product))
      .range([0, this.height])
      .padding(0.2);
  }

  render() {
    this.chartGroup.selectAll('.chart__empty').remove();
    if (!this.items || this.items.length === 0) {
      this.chartGroup
        .selectAll('.chart__empty')
        .data([null])
        .join('text')
        .attr('class', 'chart__empty')
        .attr('x', this.width / 2)
        .attr('y', this.height / 2)
        .attr('text-anchor', 'middle')
        .text('暂无物产数据');
      return;
    }

    this._renderAxes();
    this._renderRows();
  }

  _renderAxes() {
    const xAxis = d3.axisBottom(this.xScale).ticks(5);
    const bottomOffset = (this.options.margin?.bottom ?? 36) - 6;

    this.chartGroup
      .selectAll('.x-axis')
      .data([null])
      .join('g')
      .attr('class', 'axis x-axis')
      .attr('transform', `translate(0,${this.height})`)
      .call(xAxis);

    this.chartGroup
      .selectAll('.x-label')
      .data([null])
      .join('text')
      .attr('class', 'axis-label x-label')
      .attr('x', this.width / 2)
      .attr('y', this.height + bottomOffset)
      .attr('text-anchor', 'middle')
      .text('涉及地点数');
  }

  _renderRows() {
    const rows = this.chartGroup
      .selectAll('.ranking-row')
      .data(this.items, (item) => item.product)
      .join('g')
      .attr('class', 'ranking-row')
      .attr('transform', (item) => `translate(0,${this.yScale(item.product)})`);

    const barHeight = this.yScale.bandwidth();

    rows
      .selectAll('.ranking-label')
      .data((d) => [d])
      .join('text')
      .attr('class', 'ranking-label')
      .attr('x', -10)
      .attr('y', barHeight / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'end')
      .text((d) => d.product);

    rows
      .selectAll('.ranking-bar')
      .data((d) => [d])
      .join('rect')
      .attr('class', 'ranking-bar')
      .attr('x', 0)
      .attr('y', 0)
      .attr('height', barHeight)
      .attr('width', (d) => this.xScale(d.locationCount))
      .attr('fill', (d) => getProductTypeColor(d.productType))
      .on('mouseenter', (event, d) => {
        d3.select(event.currentTarget).classed('is-hovered', true);
        Tooltip.show(event, this._formatTooltip(d));
        eventBus.emit(EVENTS.PRODUCT_HOVER, { ids: d.locationIds, product: d.product });
      })
      .on('mouseleave', (event) => {
        d3.select(event.currentTarget).classed('is-hovered', false);
        Tooltip.hide();
        eventBus.emit(EVENTS.PRODUCT_HOVER, null);
      })
      .on('click', (_event, d) => {
        const nextSelection = this.currentSelection === d.product ? null : d.product;
        eventBus.emit(EVENTS.PRODUCT_SELECT, nextSelection);
      });

    rows
      .selectAll('.ranking-dot')
      .data((d) => [d])
      .join('circle')
      .attr('class', 'ranking-dot')
      .attr('cx', (d) => this.xScale(d.locationCount))
      .attr('cy', barHeight / 2)
      .attr('r', (d) => Math.max(3, Math.sqrt(d.daoCount) * 2))
      .attr('fill', 'rgba(255, 255, 255, 0.08)')
      .attr('stroke', (d) => getProductTypeColor(d.productType))
      .attr('stroke-width', 1);

    rows
      .selectAll('.ranking-meta')
      .data((d) => [d])
      .join('text')
      .attr('class', 'ranking-meta')
      .attr('x', (d) => this.xScale(d.locationCount) + 6)
      .attr('y', barHeight / 2)
      .attr('dy', '0.35em')
      .text((d) => `${d.locationCount} 地 · ${d.daoCount} 道`);

    this.rows = rows;
  }

  highlightProduct(name) {
    this.currentSelection = name || null;
    this.rows
      ?.classed('is-selected', (item) => item.product === name)
      .classed('is-dimmed', (item) => Boolean(name) && item.product !== name);
  }

  highlightByIds(ids = []) {
    if (!this.rows) return;
    const idSet = new Set(ids || []);
    const hasIds = idSet.size > 0;

    this.rows
      .classed('is-highlighted', (item) => item.locationIds.some((id) => idSet.has(id)))
      .classed('is-dimmed', (item) => {
        if (!hasIds && !this.currentSelection) return false;
        const matched = item.locationIds.some((id) => idSet.has(id));
        const selected = this.currentSelection && item.product === this.currentSelection;
        return !matched && !selected;
      });
  }

  clearHighlight() {
    this.rows?.classed('is-highlighted', false).classed('is-dimmed', false);
  }

  _buildStats() {
    const stats = new Map();

    (this.data || []).forEach((item) => {
      const daoId = this._getDaoId(item);
      const daoKey = daoId || item.daoName || '未知';
      const products = item?.Products || {};

      Object.entries(products).forEach(([type, list]) => {
        (Array.isArray(list) ? list : []).forEach((product) => {
          const entry =
            stats.get(product) ||
            {
              product,
              productType: type,
              locationIds: new Set(),
              daoIds: new Set(),
              occurrences: 0,
            };
          entry.productType = entry.productType || type;
          entry.locationIds.add(item.Location_ID);
          if (daoKey) entry.daoIds.add(daoKey);
          entry.occurrences += 1;
          stats.set(product, entry);
        });
      });
    });

    const items = Array.from(stats.values())
      .map((item) => ({
        product: item.product,
        productType: item.productType,
        locationIds: Array.from(item.locationIds),
        daoIds: Array.from(item.daoIds),
        locationCount: item.locationIds.size,
        daoCount: item.daoIds.size,
        occurrences: item.occurrences,
      }))
      .sort((a, b) => b.locationCount - a.locationCount)
      .slice(0, this.options.topN || 12);

    this.items = items;
  }

  _formatTooltip(item) {
    return Format.tooltip(item.product, [
      { label: '涉及地点', value: item.locationCount },
      { label: '覆盖道', value: item.daoCount },
      { label: '记录条数', value: item.occurrences },
      { label: '类别', value: item.productType || '-' },
    ]);
  }

  _getDaoId(item) {
    if (!item) return null;
    if (item.Administrative_Level === '道') return item.Location_ID;
    return item.Parent_ID || null;
  }
}

export default ProductRanking;
