// 户均人口直方图：支持全局与分面模式，Brush 与 Hover 联动地图/散点图。

import BaseChart from './BaseChart.js';
import { Tooltip } from '../components/tooltip.js';
import { formatHouseholdSize, Format } from '../utils/format.js';
import eventBus, { EVENTS } from '../utils/eventBus.js';

const FACET_PADDING = { top: 14, right: 8, bottom: 32, left: 40 };

class Histogram extends BaseChart {
  constructor(selector, data, options) {
    super(selector, data, options);
    this.currentBrush = null;
    this._isRestoringBrush = false;
    this._isClearingBrush = false;
    this.previousFacetMode = this.options.facetMode;
    this._applyFacetModeClass();
  }

  get defaultOptions() {
    const base = super.defaultOptions;
    return {
      ...base,
      margin: {
        ...base.margin,
        left: 48,
        bottom: 52,
      },
      field: 'householdSize',
      bins: 12,
      brushEnabled: true,
      xLabel: '户均人口',
      yLabel: '地点数量',
      facetMode: 'global', // global | level | dao
      valueCap: 12,
    };
  }

  update(newData, newOptions = {}) {
    if (newData) {
      this.data = newData;
    }
    const nextOptions = this._mergeOptions({ ...this.options, ...newOptions });
    const facetModeChanged = nextOptions.facetMode !== this.options.facetMode;
    this.options = nextOptions;
    if (facetModeChanged) {
      this.currentBrush = null;
      this.previousFacetMode = nextOptions.facetMode;
    }
    this._applyFacetModeClass();
    this._setupDimensions();
    this._updateSvgSize();
    this._setupScales();
    this.render();
  }

  _setupScales() {
    this.brushInstances = new Map();
    this.facetBars = null;

    if (this.options.facetMode === 'global') {
      this._setupGlobalScales();
    } else {
      this._setupFacetScales();
    }
  }

  render() {
    this.chartGroup.selectAll('*').remove();
    if (this.options.facetMode !== 'global' && (!this.facets || this.facets.length === 0)) {
      this._renderEmpty('暂无数据');
      return;
    }
    if (this.options.facetMode === 'global' && (!this.bins || this.bins.length === 0)) {
      this._renderEmpty('暂无数据');
      return;
    }

    if (this.options.facetMode === 'global') {
      this._renderGlobal();
    } else {
      this._renderFacets();
    }

    this._renderSelectionLabel(this.currentBrush?.range || null);
    this._restoreBrushSelection();
  }

  _renderEmpty(message) {
    this.chartGroup
      .selectAll('.chart__empty')
      .data([null])
      .join('text')
      .attr('class', 'chart__empty')
      .attr('x', this.width / 2)
      .attr('y', this.height / 2)
      .attr('text-anchor', 'middle')
      .text(message);
  }

  _renderGlobal() {
    this._renderAxes();
    this.bars = this._renderBars(this.chartGroup, this.bins, this.xScale, this.yScale);

    if (this.options.brushEnabled) {
      this._setupBrush(this.chartGroup, this.xScale, this.yScale, 'global');
    }
  }

  _renderFacets() {
    const layout = this.facetLayout || { cols: 1, gapX: 18, gapY: 18 };
    const { cols, gapX, gapY } = layout;
    this.facetBars = new Map();

    const groups = this.chartGroup
      .selectAll('.histogram-facet')
      .data(this.facets, (facet) => facet.key)
      .join('g')
      .attr('class', 'histogram-facet')
      .attr('transform', (facet, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = col * (facet.width + gapX);
        const y = row * (facet.height + gapY);
        return `translate(${x},${y})`;
      });

    groups.each((facet, idx, nodes) => {
      const group = d3.select(nodes[idx]);
      this._renderFacet(group, facet);
    });
  }

  _renderFacet(group, facet) {
    const { padding } = this.facetLayout;
    const labelOffset = this.facetLayout?.labelOffset ?? 30;
    const inner = group
      .selectAll('.histogram-facet__inner')
      .data([facet.key])
      .join('g')
      .attr('class', 'histogram-facet__inner')
      .attr('transform', `translate(${padding.left},${padding.top})`);

    group
      .selectAll('.histogram-facet__title')
      .data([facet.label])
      .join('text')
      .attr('class', 'histogram-facet__title')
      .attr('x', 2)
      .attr('y', 12)
      .text((d) => d);

    const xAxis = d3.axisBottom(facet.xScale).ticks(4);
    const yAxis = d3.axisLeft(facet.yScale).ticks(3).tickFormat(d3.format('d'));

    inner
      .selectAll('.x-axis')
      .data([null])
      .join('g')
      .attr('class', 'axis x-axis')
      .attr('transform', `translate(0,${facet.innerHeight})`)
      .call(xAxis);

    inner.selectAll('.y-axis').data([null]).join('g').attr('class', 'axis y-axis').call(yAxis);

    inner
      .selectAll('.x-label')
      .data([null])
      .join('text')
      .attr('class', 'axis-label x-label')
      .attr('x', facet.innerWidth / 2)
      .attr('y', facet.innerHeight + labelOffset)
      .attr('text-anchor', 'middle')
      .text(this.options.xLabel);

    inner
      .selectAll('.y-label')
      .data([null])
      .join('text')
      .attr('class', 'axis-label y-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -facet.innerHeight / 2)
      .attr('y', -40)
      .attr('text-anchor', 'middle')
      .text(this.options.yLabel);

    const bars = this._renderBars(inner, facet.bins, facet.xScale, facet.yScale, facet.label);
    this.facetBars.set(facet.key, bars);

    if (this.options.brushEnabled) {
      this._setupBrush(inner, facet.xScale, facet.yScale, facet.key);
    }
  }

  _renderAxes() {
    const xAxis = d3.axisBottom(this.xScale).ticks(this.options.bins);
    const yAxis = d3.axisLeft(this.yScale).ticks(6).tickFormat(d3.format('d'));

    const bottomOffset = (this.options.margin?.bottom ?? 30) - 8;

    this.chartGroup
      .selectAll('.x-axis')
      .data([null])
      .join('g')
      .attr('class', 'axis x-axis')
      .attr('transform', `translate(0,${this.height})`)
      .call(xAxis);

    this.chartGroup
      .selectAll('.y-axis')
      .data([null])
      .join('g')
      .attr('class', 'axis y-axis')
      .call(yAxis);

    this.chartGroup
      .selectAll('.x-label')
      .data([null])
      .join('text')
      .attr('class', 'axis-label x-label')
      .attr('x', this.width / 2)
      .attr('y', this.height + bottomOffset)
      .attr('text-anchor', 'middle')
      .text(this.options.xLabel);

    this.chartGroup
      .selectAll('.y-label')
      .data([null])
      .join('text')
      .attr('class', 'axis-label y-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -this.height / 2)
      .attr('y', -40)
      .attr('text-anchor', 'middle')
      .text(this.options.yLabel);
  }

  _renderBars(container, bins, xScale, yScale, facetLabel = null) {
    if (!bins || bins.length === 0) return null;

    const binWidth = xScale(bins[0].x1) - xScale(bins[0].x0);
    const barWidth = Math.max(2, binWidth - 2);
    const duration = this.currentBrush ? 0 : this.options.animationDuration;

    const bars = container
      .selectAll('.bar')
      .data(bins, (bin) => `${bin.x0}-${bin.x1}`)
      .join(
        (enter) =>
          enter
            .append('rect')
            .attr('class', 'bar')
            .attr('x', (bin) => xScale(bin.x0) + 1)
            .attr('y', yScale(0))
            .attr('width', barWidth)
            .attr('height', 0)
            .call((enterSelection) =>
              enterSelection
                .transition()
                .duration(duration)
                .attr('y', (bin) => yScale(bin.length))
                .attr('height', (bin) => yScale(0) - yScale(bin.length)),
            ),
        (update) =>
          update.call((updateSelection) =>
            updateSelection
              .transition()
              .duration(duration)
              .attr('x', (bin) => xScale(bin.x0) + 1)
              .attr('y', (bin) => yScale(bin.length))
              .attr('width', barWidth)
              .attr('height', (bin) => yScale(0) - yScale(bin.length)),
          ),
        (exit) => exit.remove(),
      );

    bars
      .on('mouseenter', (event, bin) => {
        d3.select(event.currentTarget).classed('is-hovered', true);
        Tooltip.show(event, this._buildTooltip(bin, facetLabel));
        this._emitHover(bin);
      })
      .on('mouseleave', (event) => {
        d3.select(event.currentTarget).classed('is-hovered', false);
        Tooltip.hide();
        this._emitHover(null);
      });

    return bars;
  }

  _setupBrush(container, xScale, yScale, facetKey) {
    if (!this.valueData || this.valueData.length === 0) return;

    const brush = d3
      .brushX()
      .extent([
        [0, 0],
        [xScale.range()[1], yScale.range()[0]],
      ])
      .on('brush', (event) => this._handleBrush(event, xScale, facetKey))
      .on('end', (event) => this._handleBrushEnd(event, xScale, facetKey));

    const brushGroup = container
      .selectAll('.brush')
      .data([facetKey || 'global'])
      .join('g')
      .attr('class', 'brush')
      .call(brush);

    this.brushInstances.set(facetKey || 'global', { brush, group: brushGroup });
  }

  _handleBrush(event, xScale, facetKey) {
    if (this._isRestoringBrush || this._isClearingBrush) return;
    if (!event.selection) {
      this._clearSelectionState();
      this.currentBrush = null;
      this._renderSelectionLabel(null);
      return;
    }
    this._clearOtherBrushes(facetKey);
    const [x0, x1] = event.selection.map(xScale.invert);
    this.currentBrush = { key: facetKey || 'global', range: [x0, x1] };
    this._applyRangeSelection(x0, x1);
    this._renderSelectionLabel(this.currentBrush.range);
  }

  _handleBrushEnd(event, xScale, facetKey) {
    if (this._isRestoringBrush || this._isClearingBrush) return;
    if (!event.selection) {
      this._clearSelectionState();
      this._emitSelection([], null);
      this.currentBrush = null;
      this._renderSelectionLabel(null);
      return;
    }

    const [x0, x1] = event.selection.map(xScale.invert);
    this.currentBrush = { key: facetKey || 'global', range: [x0, x1] };
    const selectedIds = this.valueData
      .filter((item) => item.value >= x0 && item.value <= x1)
      .map((item) => item.id);

    this._emitSelection(selectedIds, [x0, x1]);
    this._renderSelectionLabel(this.currentBrush.range);
  }

  _emitSelection(ids, range) {
    this.options.onBrush?.(ids, range);
    eventBus.emit(EVENTS.HOUSEHOLD_RANGE_CHANGE, range ? { ids, range } : null);
  }

  _emitHover(bin) {
    if (!bin) {
      eventBus.emit(EVENTS.HISTOGRAM_BIN_HOVER, null);
      return;
    }
    const ids = (bin || []).map((item) => item.id);
    eventBus.emit(EVENTS.HISTOGRAM_BIN_HOVER, { ids, range: [bin.x0, bin.x1] });
  }

  _buildTooltip(bin, facetLabel = null) {
    const cappedMax =
      this.options.valueCap && bin.x1 >= this.options.valueCap ? `${this.options.valueCap}+` : null;
    const maxText = cappedMax
      ? cappedMax
      : formatHouseholdSize(bin.x1, { decimals: 1 });
    const rangeText = `${formatHouseholdSize(bin.x0, { decimals: 1 })} - ${maxText}`;

    const rows = [
      facetLabel ? { label: '分面', value: facetLabel } : null,
      { label: '范围', value: rangeText },
      { label: '地点数量', value: bin.length },
    ].filter(Boolean);

    return Format.tooltip('户均人口分布', rows);
  }

  highlight(ids = []) {
    const idSet = new Set(ids || []);
    if (this.options.facetMode !== 'global') {
      this.facetBars?.forEach((barSelection) => {
        barSelection.classed('is-highlighted', (bin) => bin.some((item) => idSet.has(item.id)));
      });
      return;
    }

    if (!this.bars) return;
    this.bars.classed(
      'is-highlighted',
      (bin) => bin.some((item) => idSet.has(item.id)) && idSet.size > 0,
    );
  }

  clearHighlight() {
    this.bars?.classed('is-highlighted', false).classed('is-selected', false);
    if (this.facetBars) {
      this.facetBars.forEach((barSelection) => {
        barSelection.classed('is-highlighted', false).classed('is-selected', false);
      });
    }
  }

  clearBrush() {
    if (this.brushInstances) {
      this.brushInstances.forEach(({ brush, group }) => group.call(brush.move, null));
    }
    this.clearHighlight();
    this.currentBrush = null;
    this._renderSelectionLabel(null);
  }

  _setupGlobalScales() {
    this.valueData = this.data
      .map((item) => ({
        id: item.Location_ID,
        value: this._clampValue(item[this.options.field]),
      }))
      .filter((item) => Number.isFinite(item.value));

    if (this.valueData.length === 0) {
      this.bins = [];
      this.xScale = d3.scaleLinear().domain([0, 1]).range([0, this.width]);
      this.yScale = d3.scaleLinear().domain([0, 1]).range([this.height, 0]);
      return;
    }

    const extent = d3.extent(this.valueData, (d) => d.value);
    const binGenerator = d3
      .bin()
      .value((d) => d.value)
      .domain(extent)
      .thresholds(this.options.bins);

    this.bins = binGenerator(this.valueData);

    this.xScale = d3
      .scaleLinear()
      .domain([this.bins[0].x0, this.bins[this.bins.length - 1].x1])
      .range([0, this.width])
      .nice();

    this.yScale = d3
      .scaleLinear()
      .domain([0, d3.max(this.bins, (bin) => bin.length) || 1])
      .range([this.height, 0])
      .nice();
  }

  _setupFacetScales() {
    this.valueData = this.data
      .map((item) => ({
        id: item.Location_ID,
        value: this._clampValue(item[this.options.field]),
        level: item.Administrative_Level,
        dao: item.daoName || item.Parent_ID || '未知',
      }))
      .filter((item) => Number.isFinite(item.value));

    if (this.valueData.length === 0) {
      this.facets = [];
      return;
    }

    const xExtent = d3.extent(this.valueData, (d) => d.value);
    const groups = this._buildFacetGroups(this.valueData);
    const binGenerator = d3
      .bin()
      .value((d) => d.value)
      .domain(xExtent)
      .thresholds(this.options.bins);

    const layout = this._computeFacetLayout(groups.length, FACET_PADDING);
    this.facetLayout = layout;

    this.facets = groups.map((group) => {
      const bins = binGenerator(group.values);
      const xScale = d3
        .scaleLinear()
        .domain([bins[0].x0, bins[bins.length - 1].x1])
        .range([0, layout.innerWidth])
        .nice();
      const yScale = d3
        .scaleLinear()
        .domain([0, d3.max(bins, (bin) => bin.length) || 1])
        .range([layout.innerHeight, 0])
        .nice();

      return {
        key: group.key,
        label: group.label,
        values: group.values,
        bins,
        xScale,
        yScale,
        width: layout.facetWidth,
        height: layout.facetHeight,
        innerWidth: layout.innerWidth,
        innerHeight: layout.innerHeight,
      };
    });
  }

  _buildFacetGroups(values) {
    if (this.options.facetMode === 'level') {
      const prioritizedLevels = ['府', '州'];
      const groups = prioritizedLevels
        .map((level) => ({
          key: level,
          label: `${level}级`,
          values: values.filter((item) => item.level === level),
        }))
        .filter((group) => group.values.length > 0);

      const other = values.filter(
        (item) => !prioritizedLevels.includes(item.level) && item.level !== '道',
      );
      if (other.length > 0) {
        groups.push({
          key: '其他',
          label: '其他层级',
          values: other,
        });
      }
      return groups;
    }

    // facetMode === 'dao'
    const grouped = d3.groups(values, (item) => item.dao || '未知');
    return grouped
      .map(([dao, list]) => ({
        key: dao,
        label: dao,
        values: list,
      }))
      .sort((a, b) => b.values.length - a.values.length);
  }

  _computeFacetLayout(count, padding) {
    const isDaoMode = this.options.facetMode === 'dao';
    const cols = isDaoMode ? 2 : 1;
    const gapX = 18;
    const gapY = 18;
    const rows = Math.max(1, Math.ceil(count / cols));
    const availableWidth = Math.max(180, this.width - gapX * (cols - 1));
    const availableHeight = Math.max(260, this.height - gapY * (rows - 1));
    const facetWidth = Math.max(160, availableWidth / cols);
    const labelOffset = 36;
    const rawFacetHeight = availableHeight / rows;
    const maxInnerHeight = Math.max(
      100,
      rawFacetHeight - padding.top - padding.bottom - labelOffset,
    );
    const innerHeight = Math.min(
      maxInnerHeight,
      rawFacetHeight - padding.top - labelOffset,
    );
    const facetHeight = padding.top + padding.bottom + labelOffset + innerHeight;
    const innerWidth = Math.max(72, facetWidth - padding.left - padding.right);

    return {
      cols,
      rows,
      gapX,
      gapY,
      facetWidth,
      facetHeight,
      innerWidth,
      innerHeight,
      padding,
      labelOffset,
    };
  }

  _applyFacetModeClass() {
    if (!this.container) return;
    const dom = this.container.node ? this.container.node() : null;
    if (!dom || !dom.classList) return;

    dom.classList.remove('is-facet-level', 'is-facet-dao', 'is-facet-global');
    const modeClass =
      this.options.facetMode === 'dao'
        ? 'is-facet-dao'
        : this.options.facetMode === 'level'
          ? 'is-facet-level'
          : 'is-facet-global';
    dom.classList.add(modeClass);
  }

  _clearOtherBrushes(activeKey) {
    if (!this.brushInstances) return;
    this._isClearingBrush = true;
    this.brushInstances.forEach(({ brush, group }, key) => {
      if (key !== activeKey) {
        group.call(brush.move, null);
      }
    });
    this._isClearingBrush = false;
  }

  _restoreBrushSelection() {
    if (!this.currentBrush || !this.brushInstances?.size) return;
    const { key = 'global', range } = this.currentBrush;
    if (!range || range.length < 2) return;
    const instance = this.brushInstances.get(key);
    if (!instance) return;

    const scale =
      key === 'global'
        ? this.xScale
        : this.facets?.find((facet) => facet.key === key)?.xScale || this.xScale;
    if (!scale) return;

    const [x0, x1] = range.map((value) => scale(value));
    this._isRestoringBrush = true;
    instance.group.call(instance.brush.move, [x0, x1]);
    window.requestAnimationFrame(() => {
      this._isRestoringBrush = false;
    });
  }

  _renderSelectionLabel(range) {
    const data = range && range.length === 2 ? [range] : [];
    const formatRange = (values) => {
      const maxLabel =
        this.options.valueCap && values[1] >= this.options.valueCap
          ? `${formatHouseholdSize(this.options.valueCap, { decimals: 1 })}+`
          : formatHouseholdSize(values[1], { decimals: 1 });
      return `${formatHouseholdSize(values[0], { decimals: 1 })} - ${maxLabel}`;
    };

    this.chartGroup
      .selectAll('.selection-label')
      .data(data)
      .join('text')
      .attr('class', 'selection-label')
      .attr('x', this.width)
      .attr('y', -8)
      .attr('text-anchor', 'end')
      .text((values) => `选择区间：${formatRange(values)}`);
  }

  _applyRangeSelection(x0, x1) {
    if (this.options.facetMode === 'global') {
      this.bars?.classed('is-selected', (bin) => bin.x0 >= x0 && bin.x1 <= x1);
      return;
    }
    this.facetBars?.forEach((bars) => {
      bars.classed('is-selected', (bin) => bin.x0 >= x0 && bin.x1 <= x1);
    });
  }

  _clearSelectionState() {
    if (this.options.facetMode === 'global') {
      this.bars?.classed('is-selected', false);
      return;
    }
    this.facetBars?.forEach((bars) => bars.classed('is-selected', false));
  }

  _clampValue(value) {
    if (!Number.isFinite(value)) return null;
    if (!Number.isFinite(this.options.valueCap)) return value;
    return Math.min(value, this.options.valueCap);
  }
}

export default Histogram;
