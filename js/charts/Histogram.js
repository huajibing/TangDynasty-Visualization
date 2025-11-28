// 户均人口直方图：展示 householdSize 分布，支持 Brush 选区与高亮。

import BaseChart from './BaseChart.js';
import { Tooltip } from '../components/tooltip.js';
import { formatHouseholdSize, Format } from '../utils/format.js';
import eventBus, { EVENTS } from '../utils/eventBus.js';

class Histogram extends BaseChart {
  get defaultOptions() {
    return {
      ...super.defaultOptions,
      field: 'householdSize',
      bins: 12,
      brushEnabled: true,
      xLabel: '户均人口',
      yLabel: '地点数量',
    };
  }

  _setupScales() {
    this.valueData = this.data
      .map(item => ({ id: item.Location_ID, value: item[this.options.field] }))
      .filter(item => Number.isFinite(item.value));

    if (this.valueData.length === 0) {
      this.bins = [];
      this.xScale = d3.scaleLinear().domain([0, 1]).range([0, this.width]);
      this.yScale = d3.scaleLinear().domain([0, 1]).range([this.height, 0]);
      return;
    }

    const extent = d3.extent(this.valueData, d => d.value);
    const binGenerator = d3
      .bin()
      .value(d => d.value)
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
      .domain([0, d3.max(this.bins, bin => bin.length) || 1])
      .range([this.height, 0])
      .nice();
  }

  render() {
    this.chartGroup.selectAll('.chart__empty').remove();
    if (!this.bins || this.bins.length === 0) {
      this.chartGroup
        .selectAll('.chart__empty')
        .data([null])
        .join('text')
        .attr('class', 'chart__empty')
        .attr('x', this.width / 2)
        .attr('y', this.height / 2)
        .attr('text-anchor', 'middle')
        .text('暂无数据');
      return;
    }

    this._renderAxes();
    this._renderBars();

    if (this.options.brushEnabled) {
      this._setupBrush();
    }
  }

  _renderAxes() {
    const xAxis = d3.axisBottom(this.xScale).ticks(this.options.bins);
    const yAxis = d3.axisLeft(this.yScale).ticks(6).tickFormat(d3.format('d'));

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
      .attr('y', this.height + 36)
      .attr('text-anchor', 'middle')
      .text(this.options.xLabel);

    this.chartGroup
      .selectAll('.y-label')
      .data([null])
      .join('text')
      .attr('class', 'axis-label y-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -this.height / 2)
      .attr('y', -36)
      .attr('text-anchor', 'middle')
      .text(this.options.yLabel);
  }

  _renderBars() {
    if (!this.bins || this.bins.length === 0) return;

    const binWidth = this.xScale(this.bins[0].x1) - this.xScale(this.bins[0].x0);
    const barWidth = Math.max(2, binWidth - 2);

    this.bars = this.chartGroup
      .selectAll('.bar')
      .data(this.bins, bin => `${bin.x0}-${bin.x1}`)
      .join(
        enter =>
          enter
            .append('rect')
            .attr('class', 'bar')
            .attr('x', bin => this.xScale(bin.x0) + 1)
            .attr('y', this.height)
            .attr('width', barWidth)
            .attr('height', 0)
            .call(enterSelection =>
              enterSelection
                .transition()
                .duration(this.options.animationDuration)
                .attr('y', bin => this.yScale(bin.length))
                .attr('height', bin => this.height - this.yScale(bin.length)),
            ),
        update =>
          update.call(updateSelection =>
            updateSelection
              .transition()
              .duration(this.options.animationDuration)
              .attr('x', bin => this.xScale(bin.x0) + 1)
              .attr('y', bin => this.yScale(bin.length))
              .attr('width', barWidth)
              .attr('height', bin => this.height - this.yScale(bin.length)),
          ),
        exit => exit.remove(),
      );

    this.bars
      .on('mouseenter', (event, bin) => {
        d3.select(event.currentTarget).classed('is-hovered', true);
        Tooltip.show(event, this._buildTooltip(bin));
      })
      .on('mouseleave', event => {
        d3.select(event.currentTarget).classed('is-hovered', false);
        Tooltip.hide();
      });
  }

  _setupBrush() {
    if (!this.bins || this.bins.length === 0) return;

    const brush = d3
      .brushX()
      .extent([
        [0, 0],
        [this.width, this.height],
      ])
      .on('brush', event => this._handleBrush(event))
      .on('end', event => this._handleBrushEnd(event));

    this.brushGroup = this.chartGroup
      .selectAll('.brush')
      .data([null])
      .join('g')
      .attr('class', 'brush')
      .call(brush);
  }

  _handleBrush(event) {
    if (!event.selection) {
      this.bars.classed('is-selected', false);
      return;
    }
    const [x0, x1] = event.selection.map(this.xScale.invert);
    this.bars.classed('is-selected', bin => bin.x0 >= x0 && bin.x1 <= x1);
  }

  _handleBrushEnd(event) {
    if (!event.selection) {
      this.bars.classed('is-selected', false);
      this._emitSelection([], null);
      return;
    }

    const [x0, x1] = event.selection.map(this.xScale.invert);
    const selectedIds = this.valueData
      .filter(item => item.value >= x0 && item.value <= x1)
      .map(item => item.id);

    this._emitSelection(selectedIds, [x0, x1]);
  }

  _emitSelection(ids, range) {
    this.options.onBrush?.(ids, range);
    eventBus.emit(
      EVENTS.HOUSEHOLD_RANGE_CHANGE,
      range ? { ids, range } : null,
    );
  }

  _buildTooltip(bin) {
    const rangeText = `${formatHouseholdSize(bin.x0, { decimals: 1 })} - ${formatHouseholdSize(
      bin.x1,
      { decimals: 1 },
    )}`;

    return Format.tooltip('户均人口分布', [
      { label: '范围', value: rangeText },
      { label: '地点数量', value: bin.length },
    ]);
  }

  highlight(ids = []) {
    if (!this.bars) return;
    const idSet = new Set(ids || []);
    this.bars.classed(
      'is-highlighted',
      bin => bin.some(item => idSet.has(item.id)) && idSet.size > 0,
    );
  }

  clearHighlight() {
    this.bars?.classed('is-highlighted', false).classed('is-selected', false);
  }
}

export default Histogram;
