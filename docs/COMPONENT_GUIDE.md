# 可视化组件开发指南

本文档提供项目中可视化组件的开发规范、实现模板和最佳实践。

## 1. 组件架构

### 1.1 基类定义

所有图表组件继承自 `BaseChart` 基类：

```javascript
// js/charts/BaseChart.js

/**
 * 图表基类
 * 提供通用的初始化、渲染、更新和销毁方法
 */
class BaseChart {
  /**
   * @param {string} selector - CSS 选择器
   * @param {Array} data - 数据数组
   * @param {Object} options - 配置选项
   */
  constructor(selector, data, options = {}) {
    this.container = d3.select(selector);
    this.data = data;
    this.options = this._mergeOptions(options);

    this._validateContainer();
    this._init();
  }

  /**
   * 默认配置
   */
  get defaultOptions() {
    return {
      margin: { top: 20, right: 20, bottom: 30, left: 40 },
      responsive: true,
      animationDuration: 300,
      colorScheme: 'default'
    };
  }

  /**
   * 合并配置
   */
  _mergeOptions(options) {
    return {
      ...this.defaultOptions,
      ...options,
      margin: { ...this.defaultOptions.margin, ...options.margin }
    };
  }

  /**
   * 验证容器
   */
  _validateContainer() {
    if (this.container.empty()) {
      throw new Error(`Container not found: ${this.container}`);
    }
  }

  /**
   * 初始化
   */
  _init() {
    this._setupDimensions();
    this._createSvg();
    this._setupScales();
    this._bindResizeHandler();
    this.render();
  }

  /**
   * 设置尺寸
   */
  _setupDimensions() {
    const rect = this.container.node().getBoundingClientRect();
    const { margin } = this.options;

    this.outerWidth = rect.width;
    this.outerHeight = rect.height;
    this.width = this.outerWidth - margin.left - margin.right;
    this.height = this.outerHeight - margin.top - margin.bottom;
  }

  /**
   * 创建 SVG
   */
  _createSvg() {
    const { margin } = this.options;

    this.svg = this.container
      .append('svg')
      .attr('class', 'chart-svg')
      .attr('width', this.outerWidth)
      .attr('height', this.outerHeight);

    this.chartGroup = this.svg
      .append('g')
      .attr('class', 'chart-group')
      .attr('transform', `translate(${margin.left},${margin.top})`);
  }

  /**
   * 设置比例尺 - 子类实现
   */
  _setupScales() {
    // Override in subclass
  }

  /**
   * 绑定 resize 处理
   */
  _bindResizeHandler() {
    if (!this.options.responsive) return;

    this._resizeHandler = this._debounce(() => {
      this._setupDimensions();
      this._updateSvgSize();
      this._setupScales();
      this.render();
    }, 250);

    window.addEventListener('resize', this._resizeHandler);
  }

  /**
   * 更新 SVG 尺寸
   */
  _updateSvgSize() {
    this.svg
      .attr('width', this.outerWidth)
      .attr('height', this.outerHeight);
  }

  /**
   * 渲染 - 子类实现
   */
  render() {
    // Override in subclass
  }

  /**
   * 更新数据
   */
  update(newData) {
    this.data = newData;
    this._setupScales();
    this.render();
  }

  /**
   * 高亮指定数据点
   * @param {Array<string>} ids - 要高亮的 ID 列表
   */
  highlight(ids) {
    // Override in subclass
  }

  /**
   * 清除高亮
   */
  clearHighlight() {
    // Override in subclass
  }

  /**
   * 销毁图表
   */
  destroy() {
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
    }
    this.container.selectAll('*').remove();
    this.data = null;
  }

  /**
   * 防抖函数
   */
  _debounce(func, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
}

export default BaseChart;
```

### 1.2 组件生命周期

```
constructor()
    │
    ▼
_init()
    ├── _setupDimensions()
    ├── _createSvg()
    ├── _setupScales()
    ├── _bindResizeHandler()
    └── render()
           │
           ▼
      [用户交互]
           │
    ┌──────┴──────┐
    ▼             ▼
update()     highlight()
    │             │
    ▼             ▼
render()    [更新视觉状态]
    │
    ▼
destroy()
```

## 2. 核心组件实现

### 2.1 地图视图 (MapView)

```javascript
// js/charts/MapView.js

import BaseChart from './BaseChart.js';
import { Tooltip } from '../components/tooltip.js';
import { COLORS } from '../utils/colors.js';

class MapView extends BaseChart {
  get defaultOptions() {
    return {
      ...super.defaultOptions,
      projection: 'mercator',
      zoomEnabled: true,
      minZoom: 1,
      maxZoom: 8,
      radiusRange: [3, 20],
      colorField: 'dominantProductType'
    };
  }

  _setupScales() {
    // 投影设置
    this.projection = d3.geoMercator()
      .center([105, 35])  // 中国中心
      .scale(this.width * 1.2)
      .translate([this.width / 2, this.height / 2]);

    this.pathGenerator = d3.geoPath().projection(this.projection);

    // 人口 -> 半径比例尺
    const popExtent = d3.extent(
      this.data.filter(d => d.Population),
      d => d.Population
    );
    this.radiusScale = d3.scaleSqrt()
      .domain(popExtent)
      .range(this.options.radiusRange);

    // 物产类型 -> 颜色比例尺
    this.colorScale = d3.scaleOrdinal()
      .domain(Object.keys(COLORS.productTypes))
      .range(Object.values(COLORS.productTypes));
  }

  render() {
    this._renderBoundaries();
    this._renderPoints();
    this._bindEvents();

    if (this.options.zoomEnabled) {
      this._setupZoom();
    }
  }

  _renderBoundaries() {
    const boundaryGroup = this.chartGroup
      .selectAll('.boundary-group')
      .data([null])
      .join('g')
      .attr('class', 'boundary-group');

    // 假设 geoData 通过 options 传入
    if (this.options.geoData) {
      boundaryGroup
        .selectAll('.boundary')
        .data(this.options.geoData.features)
        .join('path')
        .attr('class', 'map__boundary')
        .attr('d', this.pathGenerator);
    }
  }

  _renderPoints() {
    const pointsGroup = this.chartGroup
      .selectAll('.points-group')
      .data([null])
      .join('g')
      .attr('class', 'points-group');

    // 过滤有坐标的数据点
    const validData = this.data.filter(
      d => d.Latitude && d.Longitude
    );

    this.points = pointsGroup
      .selectAll('.location-point')
      .data(validData, d => d.Location_ID)
      .join(
        enter => enter
          .append('circle')
          .attr('class', 'location-point')
          .attr('cx', d => this.projection([d.Longitude, d.Latitude])[0])
          .attr('cy', d => this.projection([d.Longitude, d.Latitude])[1])
          .attr('r', 0)
          .attr('fill', d => this.colorScale(d.dominantProductType))
          .call(enter => enter
            .transition()
            .duration(this.options.animationDuration)
            .attr('r', d => this.radiusScale(d.Population) || 3)
          ),
        update => update
          .call(update => update
            .transition()
            .duration(this.options.animationDuration)
            .attr('cx', d => this.projection([d.Longitude, d.Latitude])[0])
            .attr('cy', d => this.projection([d.Longitude, d.Latitude])[1])
            .attr('r', d => this.radiusScale(d.Population) || 3)
            .attr('fill', d => this.colorScale(d.dominantProductType))
          ),
        exit => exit
          .call(exit => exit
            .transition()
            .duration(this.options.animationDuration)
            .attr('r', 0)
            .remove()
          )
      );
  }

  _bindEvents() {
    this.points
      .on('mouseover', (event, d) => {
        this._handleMouseOver(event, d);
      })
      .on('mouseout', () => {
        this._handleMouseOut();
      })
      .on('click', (event, d) => {
        this._handleClick(event, d);
      });
  }

  _handleMouseOver(event, d) {
    // 高亮当前点
    d3.select(event.currentTarget)
      .raise()
      .classed('is-hovered', true);

    // 显示 Tooltip
    const content = this._formatTooltip(d);
    Tooltip.show(event, content);

    // 触发回调
    this.options.onHover?.(d);
  }

  _handleMouseOut() {
    this.points.classed('is-hovered', false);
    Tooltip.hide();
  }

  _handleClick(event, d) {
    event.stopPropagation();

    // 切换选中状态
    const isSelected = d3.select(event.currentTarget).classed('is-selected');
    this.points.classed('is-selected', false);

    if (!isSelected) {
      d3.select(event.currentTarget).classed('is-selected', true);
      this.options.onClick?.(d);
    } else {
      this.options.onClick?.(null);
    }
  }

  _formatTooltip(d) {
    return `
      <div class="tooltip__title">${d.Location_Name}</div>
      <div class="tooltip__content">
        <div class="tooltip__row">
          <span class="tooltip__label">行政级别</span>
          <span class="tooltip__value">${d.Administrative_Level}</span>
        </div>
        ${d.Population ? `
        <div class="tooltip__row">
          <span class="tooltip__label">人口</span>
          <span class="tooltip__value">${d.Population.toLocaleString()}人</span>
        </div>
        ` : ''}
        ${d.Households ? `
        <div class="tooltip__row">
          <span class="tooltip__label">户数</span>
          <span class="tooltip__value">${d.Households.toLocaleString()}户</span>
        </div>
        ` : ''}
        ${d.productRichness > 0 ? `
        <div class="tooltip__row">
          <span class="tooltip__label">物产种类</span>
          <span class="tooltip__value">${d.productRichness}种</span>
        </div>
        ` : ''}
      </div>
    `;
  }

  _setupZoom() {
    const zoom = d3.zoom()
      .scaleExtent([this.options.minZoom, this.options.maxZoom])
      .on('zoom', (event) => {
        this.chartGroup.attr('transform', event.transform);
      });

    this.svg.call(zoom);
  }

  highlight(ids) {
    this.points
      .classed('is-highlighted', d => ids.includes(d.Location_ID))
      .classed('is-dimmed', d => ids.length > 0 && !ids.includes(d.Location_ID));
  }

  clearHighlight() {
    this.points
      .classed('is-highlighted', false)
      .classed('is-dimmed', false);
  }

  /**
   * 缩放到指定区域
   * @param {Array<string>} ids - 要聚焦的地点 ID 列表
   */
  zoomToLocations(ids) {
    const locations = this.data.filter(d => ids.includes(d.Location_ID));
    if (locations.length === 0) return;

    const coords = locations.map(d => [d.Longitude, d.Latitude]);
    const bounds = [
      [d3.min(coords, d => d[0]), d3.min(coords, d => d[1])],
      [d3.max(coords, d => d[0]), d3.max(coords, d => d[1])]
    ];

    // 计算缩放变换
    const [[x0, y0], [x1, y1]] = bounds.map(this.projection);
    const dx = x1 - x0;
    const dy = y1 - y0;
    const x = (x0 + x1) / 2;
    const y = (y0 + y1) / 2;
    const scale = Math.min(8, 0.9 / Math.max(dx / this.width, dy / this.height));
    const translate = [this.width / 2 - scale * x, this.height / 2 - scale * y];

    this.svg.transition()
      .duration(750)
      .call(
        d3.zoom().transform,
        d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
      );
  }
}

export default MapView;
```

### 2.2 直方图 (Histogram)

```javascript
// js/charts/Histogram.js

import BaseChart from './BaseChart.js';
import { Tooltip } from '../components/tooltip.js';

class Histogram extends BaseChart {
  get defaultOptions() {
    return {
      ...super.defaultOptions,
      field: 'householdSize',
      bins: 10,
      brushEnabled: true,
      xLabel: '户均人口',
      yLabel: '州府数量'
    };
  }

  _setupScales() {
    const values = this.data
      .map(d => d[this.options.field])
      .filter(v => v !== null && !isNaN(v));

    // 分箱
    const histogram = d3.bin()
      .value(d => d)
      .domain(d3.extent(values))
      .thresholds(this.options.bins);

    this.bins = histogram(values);

    // X 比例尺
    this.xScale = d3.scaleLinear()
      .domain([this.bins[0].x0, this.bins[this.bins.length - 1].x1])
      .range([0, this.width]);

    // Y 比例尺
    this.yScale = d3.scaleLinear()
      .domain([0, d3.max(this.bins, d => d.length)])
      .nice()
      .range([this.height, 0]);
  }

  render() {
    this._renderAxes();
    this._renderBars();

    if (this.options.brushEnabled) {
      this._setupBrush();
    }
  }

  _renderAxes() {
    // X 轴
    const xAxis = d3.axisBottom(this.xScale)
      .ticks(this.options.bins);

    this.chartGroup
      .selectAll('.x-axis')
      .data([null])
      .join('g')
      .attr('class', 'axis x-axis')
      .attr('transform', `translate(0,${this.height})`)
      .call(xAxis);

    // X 轴标签
    this.chartGroup
      .selectAll('.x-label')
      .data([null])
      .join('text')
      .attr('class', 'axis-label x-label')
      .attr('x', this.width / 2)
      .attr('y', this.height + 35)
      .attr('text-anchor', 'middle')
      .text(this.options.xLabel);

    // Y 轴
    const yAxis = d3.axisLeft(this.yScale);

    this.chartGroup
      .selectAll('.y-axis')
      .data([null])
      .join('g')
      .attr('class', 'axis y-axis')
      .call(yAxis);

    // Y 轴标签
    this.chartGroup
      .selectAll('.y-label')
      .data([null])
      .join('text')
      .attr('class', 'axis-label y-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -this.height / 2)
      .attr('y', -35)
      .attr('text-anchor', 'middle')
      .text(this.options.yLabel);
  }

  _renderBars() {
    const barWidth = this.width / this.bins.length - 1;

    this.bars = this.chartGroup
      .selectAll('.bar')
      .data(this.bins)
      .join(
        enter => enter
          .append('rect')
          .attr('class', 'bar')
          .attr('x', d => this.xScale(d.x0) + 0.5)
          .attr('y', this.height)
          .attr('width', barWidth)
          .attr('height', 0)
          .call(enter => enter
            .transition()
            .duration(this.options.animationDuration)
            .attr('y', d => this.yScale(d.length))
            .attr('height', d => this.height - this.yScale(d.length))
          ),
        update => update
          .call(update => update
            .transition()
            .duration(this.options.animationDuration)
            .attr('x', d => this.xScale(d.x0) + 0.5)
            .attr('y', d => this.yScale(d.length))
            .attr('width', barWidth)
            .attr('height', d => this.height - this.yScale(d.length))
          ),
        exit => exit.remove()
      );

    // 绑定事件
    this.bars
      .on('mouseover', (event, d) => {
        d3.select(event.currentTarget).classed('is-hovered', true);
        Tooltip.show(event, `
          <div>范围: ${d.x0.toFixed(1)} - ${d.x1.toFixed(1)}</div>
          <div>数量: ${d.length}</div>
        `);
      })
      .on('mouseout', (event) => {
        d3.select(event.currentTarget).classed('is-hovered', false);
        Tooltip.hide();
      });
  }

  _setupBrush() {
    const brush = d3.brushX()
      .extent([[0, 0], [this.width, this.height]])
      .on('brush', (event) => this._handleBrush(event))
      .on('end', (event) => this._handleBrushEnd(event));

    this.brushGroup = this.chartGroup
      .selectAll('.brush')
      .data([null])
      .join('g')
      .attr('class', 'brush')
      .call(brush);
  }

  _handleBrush(event) {
    if (!event.selection) return;

    const [x0, x1] = event.selection.map(this.xScale.invert);

    // 高亮选中的柱子
    this.bars.classed('is-selected', d => d.x0 >= x0 && d.x1 <= x1);
  }

  _handleBrushEnd(event) {
    if (!event.selection) {
      this.bars.classed('is-selected', false);
      this.options.onBrush?.(null);
      return;
    }

    const [x0, x1] = event.selection.map(this.xScale.invert);

    // 获取落在范围内的原始数据 ID
    const selectedIds = this.data
      .filter(d => {
        const value = d[this.options.field];
        return value !== null && value >= x0 && value <= x1;
      })
      .map(d => d.Location_ID);

    this.options.onBrush?.(selectedIds, [x0, x1]);
  }

  highlight(ids) {
    if (!ids || ids.length === 0) {
      this.bars.classed('is-highlighted', false);
      return;
    }

    // 计算每个 bin 中包含的高亮 ID 数量
    const idSet = new Set(ids);
    const dataByValue = new Map();

    this.data.forEach(d => {
      const value = d[this.options.field];
      if (value !== null) {
        dataByValue.set(d.Location_ID, value);
      }
    });

    this.bars.classed('is-highlighted', (bin) => {
      return bin.some(value => {
        const matchingId = [...dataByValue.entries()]
          .find(([id, v]) => v === value && idSet.has(id));
        return !!matchingId;
      });
    });
  }
}

export default Histogram;
```

### 2.3 散点图 (ScatterPlot)

```javascript
// js/charts/ScatterPlot.js

import BaseChart from './BaseChart.js';
import { Tooltip } from '../components/tooltip.js';
import { COLORS } from '../utils/colors.js';

class ScatterPlot extends BaseChart {
  get defaultOptions() {
    return {
      ...super.defaultOptions,
      xField: 'Population',
      yField: 'productRichness',
      colorField: 'dominantProductType',
      xLabel: '人口数量',
      yLabel: '物产种类数',
      logScale: true,  // X 轴使用对数坐标
      pointRadius: 5
    };
  }

  _setupScales() {
    const { xField, yField, colorField } = this.options;

    // 过滤有效数据
    this.validData = this.data.filter(d =>
      d[xField] !== null && d[yField] !== null
    );

    // X 比例尺
    const xExtent = d3.extent(this.validData, d => d[xField]);
    this.xScale = this.options.logScale
      ? d3.scaleLog().domain([Math.max(1, xExtent[0]), xExtent[1]])
      : d3.scaleLinear().domain(xExtent);
    this.xScale.range([0, this.width]).nice();

    // Y 比例尺
    const yExtent = d3.extent(this.validData, d => d[yField]);
    this.yScale = d3.scaleLinear()
      .domain([0, yExtent[1]])
      .range([this.height, 0])
      .nice();

    // 颜色比例尺
    this.colorScale = d3.scaleOrdinal()
      .domain(Object.keys(COLORS.productTypes))
      .range(Object.values(COLORS.productTypes));
  }

  render() {
    this._renderAxes();
    this._renderPoints();
    this._renderLegend();
  }

  _renderAxes() {
    // X 轴
    const xAxis = this.options.logScale
      ? d3.axisBottom(this.xScale).ticks(5, '~s')
      : d3.axisBottom(this.xScale);

    this.chartGroup
      .selectAll('.x-axis')
      .data([null])
      .join('g')
      .attr('class', 'axis x-axis')
      .attr('transform', `translate(0,${this.height})`)
      .call(xAxis);

    // X 轴标签
    this.chartGroup
      .selectAll('.x-label')
      .data([null])
      .join('text')
      .attr('class', 'axis-label x-label')
      .attr('x', this.width / 2)
      .attr('y', this.height + 35)
      .attr('text-anchor', 'middle')
      .text(this.options.xLabel);

    // Y 轴
    this.chartGroup
      .selectAll('.y-axis')
      .data([null])
      .join('g')
      .attr('class', 'axis y-axis')
      .call(d3.axisLeft(this.yScale));

    // Y 轴标签
    this.chartGroup
      .selectAll('.y-label')
      .data([null])
      .join('text')
      .attr('class', 'axis-label y-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -this.height / 2)
      .attr('y', -35)
      .attr('text-anchor', 'middle')
      .text(this.options.yLabel);
  }

  _renderPoints() {
    const { xField, yField, colorField, pointRadius } = this.options;

    this.points = this.chartGroup
      .selectAll('.scatter-point')
      .data(this.validData, d => d.Location_ID)
      .join(
        enter => enter
          .append('circle')
          .attr('class', 'scatter-point')
          .attr('cx', d => this.xScale(d[xField]))
          .attr('cy', d => this.yScale(d[yField]))
          .attr('r', 0)
          .attr('fill', d => this.colorScale(d[colorField]))
          .call(enter => enter
            .transition()
            .duration(this.options.animationDuration)
            .attr('r', pointRadius)
          ),
        update => update
          .call(update => update
            .transition()
            .duration(this.options.animationDuration)
            .attr('cx', d => this.xScale(d[xField]))
            .attr('cy', d => this.yScale(d[yField]))
            .attr('fill', d => this.colorScale(d[colorField]))
          ),
        exit => exit.remove()
      );

    // 绑定事件
    this.points
      .on('mouseover', (event, d) => {
        d3.select(event.currentTarget)
          .raise()
          .classed('is-hovered', true)
          .attr('r', pointRadius * 1.5);

        Tooltip.show(event, this._formatTooltip(d));
        this.options.onHover?.(d);
      })
      .on('mouseout', (event) => {
        d3.select(event.currentTarget)
          .classed('is-hovered', false)
          .attr('r', pointRadius);

        Tooltip.hide();
      })
      .on('click', (event, d) => {
        this.options.onClick?.(d);
      });
  }

  _renderLegend() {
    // 实现图例渲染
  }

  _formatTooltip(d) {
    return `
      <div class="tooltip__title">${d.Location_Name}</div>
      <div class="tooltip__content">
        <div class="tooltip__row">
          <span class="tooltip__label">${this.options.xLabel}</span>
          <span class="tooltip__value">${d[this.options.xField]?.toLocaleString() || '-'}</span>
        </div>
        <div class="tooltip__row">
          <span class="tooltip__label">${this.options.yLabel}</span>
          <span class="tooltip__value">${d[this.options.yField] || '-'}</span>
        </div>
      </div>
    `;
  }

  highlight(ids) {
    this.points
      .classed('is-highlighted', d => ids.includes(d.Location_ID))
      .classed('is-dimmed', d => ids.length > 0 && !ids.includes(d.Location_ID));
  }

  clearHighlight() {
    this.points
      .classed('is-highlighted', false)
      .classed('is-dimmed', false);
  }
}

export default ScatterPlot;
```

### 2.4 网络图 (NetworkGraph)

```javascript
// js/charts/NetworkGraph.js

import BaseChart from './BaseChart.js';
import { Tooltip } from '../components/tooltip.js';
import { COLORS } from '../utils/colors.js';

class NetworkGraph extends BaseChart {
  get defaultOptions() {
    return {
      ...super.defaultOptions,
      minCooccurrence: 3,
      nodeRadius: 8,
      linkStrength: 0.5,
      chargeStrength: -100
    };
  }

  _prepareData() {
    // 从原始数据构建网络数据
    const productLocations = new Map();

    this.data.forEach(d => {
      if (!d.Products) return;
      Object.values(d.Products).flat().forEach(product => {
        if (!productLocations.has(product)) {
          productLocations.set(product, new Set());
        }
        productLocations.get(product).add(d.Location_ID);
      });
    });

    // 构建节点
    this.nodes = [...productLocations.entries()]
      .filter(([, locations]) => locations.size >= 2)
      .map(([name, locations]) => ({
        id: name,
        name,
        count: locations.size
      }));

    // 构建边（共现关系）
    const nodeSet = new Set(this.nodes.map(n => n.id));
    const cooccurrence = new Map();

    this.data.forEach(d => {
      if (!d.Products) return;
      const products = Object.values(d.Products)
        .flat()
        .filter(p => nodeSet.has(p));

      for (let i = 0; i < products.length; i++) {
        for (let j = i + 1; j < products.length; j++) {
          const key = [products[i], products[j]].sort().join('|');
          cooccurrence.set(key, (cooccurrence.get(key) || 0) + 1);
        }
      }
    });

    this.links = [...cooccurrence.entries()]
      .filter(([, count]) => count >= this.options.minCooccurrence)
      .map(([key, count]) => {
        const [source, target] = key.split('|');
        return { source, target, count };
      });
  }

  _setupScales() {
    this._prepareData();

    // 节点大小比例尺
    const countExtent = d3.extent(this.nodes, d => d.count);
    this.sizeScale = d3.scaleSqrt()
      .domain(countExtent)
      .range([4, 16]);

    // 边宽度比例尺
    const linkExtent = d3.extent(this.links, d => d.count);
    this.linkWidthScale = d3.scaleLinear()
      .domain(linkExtent)
      .range([1, 5]);
  }

  render() {
    this._renderLinks();
    this._renderNodes();
    this._setupSimulation();
  }

  _renderLinks() {
    this.linkElements = this.chartGroup
      .selectAll('.network-link')
      .data(this.links)
      .join('line')
      .attr('class', 'network-link')
      .attr('stroke-width', d => this.linkWidthScale(d.count));
  }

  _renderNodes() {
    this.nodeElements = this.chartGroup
      .selectAll('.network-node')
      .data(this.nodes)
      .join('g')
      .attr('class', 'network-node');

    this.nodeElements
      .selectAll('circle')
      .data(d => [d])
      .join('circle')
      .attr('r', d => this.sizeScale(d.count))
      .attr('fill', COLORS.primary);

    this.nodeElements
      .selectAll('text')
      .data(d => [d])
      .join('text')
      .attr('dy', d => this.sizeScale(d.count) + 12)
      .attr('text-anchor', 'middle')
      .attr('class', 'network-label')
      .text(d => d.name);

    // 绑定事件
    this.nodeElements
      .on('mouseover', (event, d) => {
        this._highlightConnected(d);
        Tooltip.show(event, `
          <div class="tooltip__title">${d.name}</div>
          <div>出现次数: ${d.count}</div>
        `);
        this.options.onHover?.(d);
      })
      .on('mouseout', () => {
        this._clearHighlight();
        Tooltip.hide();
      })
      .on('click', (event, d) => {
        this.options.onClick?.(d);
      });

    // 拖拽
    this.nodeElements.call(
      d3.drag()
        .on('start', (event, d) => this._dragStarted(event, d))
        .on('drag', (event, d) => this._dragged(event, d))
        .on('end', (event, d) => this._dragEnded(event, d))
    );
  }

  _setupSimulation() {
    this.simulation = d3.forceSimulation(this.nodes)
      .force('link', d3.forceLink(this.links)
        .id(d => d.id)
        .strength(this.options.linkStrength)
      )
      .force('charge', d3.forceManyBody()
        .strength(this.options.chargeStrength)
      )
      .force('center', d3.forceCenter(this.width / 2, this.height / 2))
      .force('collision', d3.forceCollide()
        .radius(d => this.sizeScale(d.count) + 5)
      )
      .on('tick', () => this._tick());
  }

  _tick() {
    this.linkElements
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    this.nodeElements
      .attr('transform', d => `translate(${d.x},${d.y})`);
  }

  _dragStarted(event, d) {
    if (!event.active) this.simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  _dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  _dragEnded(event, d) {
    if (!event.active) this.simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  _highlightConnected(node) {
    const connectedIds = new Set([node.id]);

    this.links.forEach(link => {
      if (link.source.id === node.id) connectedIds.add(link.target.id);
      if (link.target.id === node.id) connectedIds.add(link.source.id);
    });

    this.nodeElements.classed('is-dimmed', d => !connectedIds.has(d.id));
    this.linkElements.classed('is-dimmed', d =>
      d.source.id !== node.id && d.target.id !== node.id
    );
  }

  _clearHighlight() {
    this.nodeElements.classed('is-dimmed', false);
    this.linkElements.classed('is-dimmed', false);
  }

  highlight(productNames) {
    if (!productNames || productNames.length === 0) {
      this._clearHighlight();
      return;
    }

    const nameSet = new Set(productNames);
    this.nodeElements.classed('is-highlighted', d => nameSet.has(d.name));
  }

  destroy() {
    if (this.simulation) {
      this.simulation.stop();
    }
    super.destroy();
  }
}

export default NetworkGraph;
```

## 3. 辅助组件

### 3.1 Tooltip 组件

```javascript
// js/components/tooltip.js

export const Tooltip = {
  element: null,

  init() {
    this.element = d3.select('body')
      .append('div')
      .attr('class', 'tooltip')
      .attr('role', 'tooltip')
      .attr('aria-hidden', 'true');
  },

  show(event, content) {
    if (!this.element) this.init();

    const x = event.pageX + 10;
    const y = event.pageY - 10;

    this.element
      .html(content)
      .style('left', `${x}px`)
      .style('top', `${y}px`)
      .attr('aria-hidden', 'false')
      .classed('is-visible', true);

    // 边界检测
    this._adjustPosition();
  },

  hide() {
    if (!this.element) return;

    this.element
      .classed('is-visible', false)
      .attr('aria-hidden', 'true');
  },

  _adjustPosition() {
    const rect = this.element.node().getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    let left = parseFloat(this.element.style('left'));
    let top = parseFloat(this.element.style('top'));

    // 右边界
    if (rect.right > viewport.width) {
      left = left - rect.width - 20;
    }

    // 下边界
    if (rect.bottom > viewport.height) {
      top = top - rect.height - 20;
    }

    this.element
      .style('left', `${left}px`)
      .style('top', `${top}px`);
  },

  destroy() {
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
  }
};
```

### 3.2 图例组件

```javascript
// js/components/legend.js

export class Legend {
  constructor(selector, options = {}) {
    this.container = d3.select(selector);
    this.options = {
      orientation: 'horizontal',
      itemWidth: 100,
      ...options
    };
  }

  render(items) {
    const legend = this.container
      .selectAll('.legend')
      .data([null])
      .join('div')
      .attr('class', `legend legend--${this.options.orientation}`);

    const legendItems = legend
      .selectAll('.legend__item')
      .data(items)
      .join('div')
      .attr('class', 'legend__item')
      .on('click', (event, d) => {
        const item = d3.select(event.currentTarget);
        const isActive = !item.classed('is-inactive');
        item.classed('is-inactive', isActive);
        this.options.onClick?.(d, !isActive);
      });

    legendItems
      .selectAll('.legend__color')
      .data(d => [d])
      .join('span')
      .attr('class', 'legend__color')
      .style('background-color', d => d.color);

    legendItems
      .selectAll('.legend__label')
      .data(d => [d])
      .join('span')
      .attr('class', 'legend__label')
      .text(d => d.label);
  }

  setActive(keys) {
    this.container.selectAll('.legend__item')
      .classed('is-inactive', d => !keys.includes(d.key));
  }
}
```

## 4. 组件通信

### 4.1 事件总线

```javascript
// js/utils/eventBus.js

class EventBus {
  constructor() {
    this.events = new Map();
  }

  on(event, callback) {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event).add(callback);

    // 返回取消订阅函数
    return () => this.off(event, callback);
  }

  off(event, callback) {
    const callbacks = this.events.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  emit(event, data) {
    const callbacks = this.events.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(data));
    }
  }

  once(event, callback) {
    const wrapper = (data) => {
      callback(data);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }
}

export const eventBus = new EventBus();

// 预定义事件类型
export const EVENTS = {
  LOCATION_SELECT: 'location:select',
  LOCATION_HOVER: 'location:hover',
  BRUSH_UPDATE: 'brush:update',
  FILTER_CHANGE: 'filter:change',
  PRODUCT_SELECT: 'product:select'
};
```

### 4.2 使用示例

```javascript
// main.js

import { eventBus, EVENTS } from './utils/eventBus.js';
import MapView from './charts/MapView.js';
import Histogram from './charts/Histogram.js';
import ScatterPlot from './charts/ScatterPlot.js';

// 初始化图表
const map = new MapView('#map', data, {
  onClick: (d) => eventBus.emit(EVENTS.LOCATION_SELECT, d)
});

const histogram = new Histogram('#histogram', data, {
  onBrush: (ids) => eventBus.emit(EVENTS.BRUSH_UPDATE, ids)
});

const scatter = new ScatterPlot('#scatter', data, {
  onClick: (d) => eventBus.emit(EVENTS.LOCATION_SELECT, d)
});

// 订阅事件，实现联动
eventBus.on(EVENTS.LOCATION_SELECT, (location) => {
  if (location) {
    const ids = [location.Location_ID];
    map.highlight(ids);
    histogram.highlight(ids);
    scatter.highlight(ids);
  } else {
    map.clearHighlight();
    histogram.clearHighlight();
    scatter.clearHighlight();
  }
});

eventBus.on(EVENTS.BRUSH_UPDATE, (ids) => {
  if (ids) {
    map.highlight(ids);
    scatter.highlight(ids);
  } else {
    map.clearHighlight();
    scatter.clearHighlight();
  }
});
```

## 5. 性能优化

### 5.1 大数据量处理

```javascript
// 虚拟化：仅渲染可见区域
class VirtualizedList {
  constructor(container, items, options) {
    this.itemHeight = options.itemHeight || 30;
    this.visibleCount = Math.ceil(container.clientHeight / this.itemHeight) + 2;
    this.items = items;

    this.container = container;
    this.container.style.overflow = 'auto';

    this.render();
    this.bindScroll();
  }

  render() {
    const scrollTop = this.container.scrollTop;
    const startIndex = Math.floor(scrollTop / this.itemHeight);
    const visibleItems = this.items.slice(startIndex, startIndex + this.visibleCount);

    // 渲染可见项
    // ...
  }

  bindScroll() {
    this.container.addEventListener('scroll', this._debounce(() => {
      this.render();
    }, 16));
  }
}
```

### 5.2 Canvas 降级

```javascript
// 当节点数量超过阈值时使用 Canvas
class CanvasMapView {
  constructor(selector, data, options) {
    this.canvas = document.querySelector(selector);
    this.ctx = this.canvas.getContext('2d');
    this.data = data;
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.data.forEach(d => {
      if (!d.Latitude || !d.Longitude) return;

      const [x, y] = this.projection([d.Longitude, d.Latitude]);
      const radius = this.radiusScale(d.Population) || 3;

      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.fillStyle = this.colorScale(d.dominantProductType);
      this.ctx.fill();
      this.ctx.strokeStyle = '#fff';
      this.ctx.stroke();
    });
  }
}
```
