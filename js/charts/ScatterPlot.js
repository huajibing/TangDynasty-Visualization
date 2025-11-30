// 人口 vs 物产丰富度散点图：支持 Hover 提示与外部高亮。

import BaseChart from './BaseChart.js';
import { Tooltip } from '../components/tooltip.js';
import {
  createPopulationScale,
  createProductRichnessScale,
  createProductTypeColorScale,
} from '../utils/scales.js';
import { formatHouseholdSize, formatPopulation, Format } from '../utils/format.js';
import eventBus, { EVENTS } from '../utils/eventBus.js';

const MODE_CONFIG = {
  population: {
    key: 'population',
    xField: 'Population',
    xLabel: '人口数量',
    logScale: true,
    formatter: formatPopulation,
  },
  household: {
    key: 'household',
    xField: 'householdSize',
    xLabel: '户均人口',
    logScale: false,
    formatter: formatHouseholdSize,
  },
};

class ScatterPlot extends BaseChart {
  get defaultOptions() {
    const base = super.defaultOptions;
    return {
      ...base,
      margin: {
        ...base.margin,
        left: 60,
        right: 16,
        bottom: 52,
      },
      xField: 'Population',
      yField: 'productRichness',
      colorField: 'dominantProductType',
      xLabel: '人口数量',
      yLabel: '物产种类数',
      logScale: true,
      pointRadius: 5,
      mode: 'population', // population | household
    };
  }

  _setupScales() {
    const mode = this._getModeConfig();
    this.currentMode = mode;
    const xField = mode.xField;
    const { yField, colorField } = this.options;

    // 仅保留人口、物产丰富度都为有效数值，且存在主导物产类别的点，
    // 避免出现「空白分类」图例项。
    this.validData = (this.data || []).filter(
      (d) =>
        Number.isFinite(d[xField]) &&
        Number.isFinite(d[yField]) &&
        d[colorField],
    );

    const xValues = this.validData.map((d) => d[xField]);
    const yValues = this.validData.map((d) => d[yField]);

    const xExtent = xValues.length > 0 ? d3.extent(xValues) : [1, 10];
    const yExtent = yValues.length > 0 ? d3.extent(yValues) : [0, 10];

    this.xScale = createPopulationScale(xExtent, [0, this.width], {
      log: mode.logScale,
      nice: true,
    });

    this.yScale = createProductRichnessScale(
      [Math.min(0, yExtent[0]), yExtent[1]],
      [this.height, 0],
      { nice: true },
    );
    // 仅使用当前数据中实际出现的物产类别构建颜色比例尺，
    // 防止 legend 中出现「空白」项。
    const presentTypes = Array.from(
      new Set(this.validData.map((d) => d[colorField])),
    );
    this.colorScale = createProductTypeColorScale(presentTypes);
  }

  render() {
    this.chartGroup.selectAll('.chart__empty').remove();
    if (!this.validData || this.validData.length === 0) {
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
    this._renderPoints();
    this._renderLegend();
  }

  _renderAxes() {
    const xAxis = this.currentMode?.logScale
      ? d3.axisBottom(this.xScale).ticks(6, '~s')
      : d3.axisBottom(this.xScale).ticks(6);
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

    const bottomOffset = (this.options.margin?.bottom ?? 30) - 8;

    this.chartGroup
      .selectAll('.x-label')
      .data([null])
      .join('text')
      .attr('class', 'axis-label x-label')
      .attr('x', this.width / 2)
      .attr('y', this.height + bottomOffset)
      .attr('text-anchor', 'middle')
      .text(this.currentMode?.xLabel || this.options.xLabel);

    this.chartGroup
      .selectAll('.y-label')
      .data([null])
      .join('text')
      .attr('class', 'axis-label y-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -this.height / 2)
      .attr('y', -45)
      .attr('text-anchor', 'middle')
      .text(this.options.yLabel);
  }

  _renderPoints() {
    const { yField, colorField, pointRadius } = this.options;
    const xField = this.currentMode?.xField || this.options.xField;

    this.points = this.chartGroup
      .selectAll('.scatter-point')
      .data(this.validData, (d) => d.Location_ID)
      .join(
        (enter) =>
          enter
            .append('circle')
            .attr('class', 'scatter-point')
            .attr('cx', (d) => this.xScale(d[xField]))
            .attr('cy', (d) => this.yScale(d[yField]))
            .attr('r', 0)
            .attr('fill', (d) => this.colorScale(d[colorField]))
            .attr('opacity', 0.9)
            .call((enterSelection) =>
              enterSelection
                .transition()
                .duration(this.options.animationDuration)
                .attr('r', pointRadius),
            ),
        (update) =>
          update.call((updateSelection) =>
            updateSelection
              .transition()
              .duration(this.options.animationDuration)
              .attr('cx', (d) => this.xScale(d[xField]))
              .attr('cy', (d) => this.yScale(d[yField]))
              .attr('r', pointRadius)
              .attr('fill', (d) => this.colorScale(d[colorField])),
          ),
        (exit) =>
          exit.call((exitSelection) =>
            exitSelection
              .transition()
              .duration(this.options.animationDuration)
              .attr('r', 0)
              .remove(),
          ),
      );

    this.points
      .on('mouseenter', (event, d) => {
        d3.select(event.currentTarget)
          .classed('is-hovered', true)
          .raise()
          .attr('r', pointRadius * 1.4);
        Tooltip.show(event, this._formatTooltip(d));
        eventBus.emit(EVENTS.LOCATION_HOVER, d);
        this.options.onHover?.(d);
      })
      .on('mouseleave', (event) => {
        d3.select(event.currentTarget).classed('is-hovered', false).attr('r', pointRadius);
        Tooltip.hide();
        eventBus.emit(EVENTS.LOCATION_HOVER, null);
      })
      .on('click', (event, d) => {
        const append = Boolean(event?.metaKey || event?.ctrlKey);
        eventBus.emit(EVENTS.LOCATION_SELECT, { location: d, append });
        this.options.onClick?.(d);
      });
  }

  _renderLegend() {
    if (!this.colorScale) return;
    const items = this.colorScale.domain();

    // 图例放在图表左上角，避免遮挡主要散点区域
    const legend = this.chartGroup
      .selectAll('.scatter-legend')
      .data([null])
      .join('g')
      .attr('class', 'scatter-legend')
      .attr('transform', 'translate(8, 8)');

    // 添加半透明背景
    const itemCount = items.length;
    legend
      .selectAll('.scatter-legend__bg')
      .data([null])
      .join('rect')
      .attr('class', 'scatter-legend__bg')
      .attr('x', -6)
      .attr('y', -4)
      .attr('width', 112)
      .attr('height', itemCount * 18 + 8)
      .attr('rx', 6)
      .attr('stroke-width', 0.6);

    const legendItems = legend
      .selectAll('.scatter-legend__item')
      .data(items)
      .join('g')
      .attr('class', 'scatter-legend__item')
      .attr('transform', (_, index) => `translate(0, ${index * 18})`);

    legendItems
      .selectAll('rect')
      .data((d) => [d])
      .join('rect')
      .attr('width', 10)
      .attr('height', 10)
      .attr('rx', 2)
      .attr('ry', 2)
      .attr('fill', (d) => this.colorScale(d));

    legendItems
      .selectAll('text')
      .data((d) => [d])
      .join('text')
      .attr('x', 14)
      .attr('y', 9)
      .attr('class', 'scatter-legend__label')
      .style('font-size', '11px')
      .text((d) => d);
  }

  _formatTooltip(datum) {
    const xField = this.currentMode?.xField || this.options.xField;
    const xLabel = this.currentMode?.xLabel || this.options.xLabel;
    const xFormatter = this.currentMode?.formatter || formatPopulation;

    return Format.tooltip(datum.Location_Name, [
      { label: xLabel, value: xFormatter(datum[xField]) },
      { label: this.options.yLabel, value: Format.number(datum[this.options.yField]) },
      { label: '主导物产', value: datum.dominantProductType || '-' },
      { label: '所属道', value: datum.daoName || '-' },
    ]);
  }

  _getModeConfig() {
    const modeKey = this.options.mode && MODE_CONFIG[this.options.mode] ? this.options.mode : 'population';
    return MODE_CONFIG[modeKey] || MODE_CONFIG.population;
  }

  highlight(ids = []) {
    const idSet = new Set(ids || []);
    this.points
      ?.classed('is-highlighted', (d) => idSet.has(d.Location_ID))
      .classed('is-dimmed', (d) => idSet.size > 0 && !idSet.has(d.Location_ID));
  }

  clearHighlight() {
    this.points?.classed('is-highlighted', false).classed('is-dimmed', false);
  }
}

export default ScatterPlot;
