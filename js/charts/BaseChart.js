// 图表基类：负责容器校验、尺寸计算、SVG 创建及 resize 处理。

const MIN_INNER_SIZE = 120;

class BaseChart {
  constructor(selector, data = [], options = {}) {
    if (typeof d3 === 'undefined') {
      throw new Error('[BaseChart] D3.js is required. Please ensure the CDN script is loaded.');
    }

    this.selector = selector;
    this.container = selector && typeof selector === 'object' && typeof selector.node === 'function'
      ? selector
      : d3.select(selector);
    this.data = data || [];
    this.options = this._mergeOptions(options);

    this._validateContainer();
    this._init();
  }

  get defaultOptions() {
    return {
      margin: { top: 20, right: 20, bottom: 30, left: 40 },
      responsive: true,
      animationDuration: 300,
      colorScheme: 'default',
      autoRender: true,
    };
  }

  _mergeOptions(options) {
    const defaults = this.defaultOptions;
    const margin = { ...defaults.margin, ...(options.margin || {}) };
    return { ...defaults, ...options, margin };
  }

  _validateContainer() {
    if (!this.container || this.container.empty()) {
      const target = typeof this.selector === 'string' ? this.selector : '[D3 selection]';
      throw new Error(`[BaseChart] Container not found: ${target}`);
    }
  }

  _init() {
    this._setupDimensions();
    this._createSvg();
    this._setupScales();
    this._bindResizeHandler();

    if (this.options.autoRender) {
      this.render();
    }
  }

  _setupDimensions() {
    const rect = this.container.node().getBoundingClientRect();
    const { margin } = this.options;

    const outerWidth = Math.max(rect.width || 0, margin.left + margin.right + MIN_INNER_SIZE);
    const outerHeight = Math.max(rect.height || 0, margin.top + margin.bottom + MIN_INNER_SIZE);

    this.outerWidth = outerWidth;
    this.outerHeight = outerHeight;
    this.width = Math.max(outerWidth - margin.left - margin.right, MIN_INNER_SIZE * 0.5);
    this.height = Math.max(outerHeight - margin.top - margin.bottom, MIN_INNER_SIZE * 0.5);
  }

  _createSvg() {
    const { margin } = this.options;

    this.svg = this.container
      .selectAll('svg.chart-svg')
      .data([null])
      .join('svg')
      .attr('class', 'chart-svg')
      .attr('width', this.outerWidth)
      .attr('height', this.outerHeight);

    this.chartGroup = this.svg
      .selectAll('g.chart-group')
      .data([null])
      .join('g')
      .attr('class', 'chart-group')
      .attr('transform', `translate(${margin.left},${margin.top})`);
  }

  // 子类重写，根据数据和尺寸创建比例尺
  _setupScales() {}

  _bindResizeHandler() {
    if (!this.options.responsive) return;

    this._resizeHandler = this._debounce(() => {
      this._setupDimensions();
      this._updateSvgSize();
      this._setupScales();
      this.render();
    }, 200);

    window.addEventListener('resize', this._resizeHandler);
  }

  _updateSvgSize() {
    const { margin } = this.options;
    this.svg.attr('width', this.outerWidth).attr('height', this.outerHeight);
    this.chartGroup.attr('transform', `translate(${margin.left},${margin.top})`);
  }

  // 子类重写：核心渲染逻辑
  render() {}

  update(newData, newOptions = {}) {
    if (newData) {
      this.data = newData;
    }
    if (newOptions && Object.keys(newOptions).length > 0) {
      this.options = this._mergeOptions({ ...this.options, ...newOptions });
    }

    this._setupDimensions();
    this._updateSvgSize();
    this._setupScales();
    this.render();
  }

  highlight() {}

  clearHighlight() {}

  destroy() {
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
    }
    if (this.container) {
      this.container.selectAll('*').remove();
    }

    this.data = null;
  }

  _debounce(func, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
}

export default BaseChart;
