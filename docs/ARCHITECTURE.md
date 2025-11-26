# 技术架构文档

## 1. 系统架构概览

本项目采用纯前端架构，无需后端服务器支持（仅需静态文件服务器）。

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户界面层 (View)                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │  地图视图 │ │  直方图  │ │  散点图  │ │  网络图  │           │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘           │
│       │            │            │            │                  │
│       └────────────┴────────────┴────────────┘                  │
│                           │                                      │
├───────────────────────────┼──────────────────────────────────────┤
│                    状态管理层 (State)                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  AppState: { selectedDao, highlightedIds, filters... }  │    │
│  └─────────────────────────────────────────────────────────┘    │
├───────────────────────────┼──────────────────────────────────────┤
│                    数据处理层 (Data)                             │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                   │
│  │ DataLoader │ │ Processor  │ │  Indexer   │                   │
│  └────────────┘ └────────────┘ └────────────┘                   │
├───────────────────────────┼──────────────────────────────────────┤
│                    工具层 (Utils)                                │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                    │
│  │ Scales │ │ Colors │ │ Format │ │  DOM   │                    │
│  └────────┘ └────────┘ └────────┘ └────────┘                    │
└─────────────────────────────────────────────────────────────────┘
```

## 2. 技术选型详解

### 2.1 核心技术栈

#### D3.js v7

选择 D3.js 作为可视化引擎的原因：

- **高度可定制**：支持从底层构建任意形式的可视化
- **地理支持完善**：内置 d3-geo 模块，支持多种地图投影
- **数据驱动**：声明式的数据绑定方式，便于实现视图联动
- **社区成熟**：丰富的示例和文档支持

```javascript
// CDN 引入方式
<script src="https://d3js.org/d3.v7.min.js"></script>

// 或使用模块化版本
<script type="module">
  import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
</script>
```

#### 原生 JavaScript (ES6+)

不使用现代前端框架的设计决策：

- **学习成本低**：无需额外学习框架 API
- **代码轻量**：无运行时开销
- **透明度高**：便于理解底层 DOM 操作
- **长期稳定**：不依赖框架版本更新

使用的 ES6+ 特性：

```javascript
// 模块化
import { loadData } from './data/dataLoader.js';

// 解构赋值
const { locations, products } = data;

// 箭头函数
data.filter(d => d.population > 10000);

// Promise / async-await
const data = await fetch('data/locations.json').then(r => r.json());

// 模板字符串
const html = `<div class="tooltip">${name}: ${population}人</div>`;

// 展开运算符
const merged = { ...defaults, ...options };
```

### 2.2 布局系统

采用 CSS Grid 作为主布局系统：

```css
/* 仪表盘主布局 */
.dashboard {
  display: grid;
  grid-template-columns: 280px 1fr 320px;
  grid-template-rows: auto 1fr auto;
  grid-template-areas:
    "header header header"
    "sidebar main aside"
    "sidebar bottom aside";
  height: 100vh;
  gap: 16px;
}
```

### 2.3 外部依赖清单

| 依赖 | 版本 | CDN 地址 | 用途 |
|------|------|----------|------|
| D3.js | 7.8.5 | `https://d3js.org/d3.v7.min.js` | 可视化核心 |
| TopoJSON | 3.0.2 | `https://unpkg.com/topojson@3` | 地理数据压缩（可选） |

## 3. 模块设计

### 3.1 入口模块 (main.js)

负责应用初始化和模块协调：

```javascript
// main.js 职责
class App {
  constructor() {
    this.state = new AppState();
    this.charts = {};
  }

  async init() {
    // 1. 加载数据
    const data = await DataLoader.load();

    // 2. 预处理数据
    this.processedData = DataProcessor.process(data);

    // 3. 初始化图表
    this.initCharts();

    // 4. 绑定交互
    this.bindEvents();
  }

  initCharts() {
    this.charts.map = new MapView('#map-container', this.processedData);
    this.charts.histogram = new Histogram('#histogram-container', this.processedData);
    this.charts.scatter = new ScatterPlot('#scatter-container', this.processedData);
    this.charts.network = new NetworkGraph('#network-container', this.processedData);
  }
}
```

### 3.2 状态管理模块 (state.js)

采用发布-订阅模式管理全局状态：

```javascript
// state.js
class AppState {
  constructor() {
    this._state = {
      selectedDao: null,        // 当前选中的道
      highlightedIds: [],       // 高亮的地点 ID 列表
      selectedProduct: null,    // 当前选中的物产
      filters: {
        daoList: [],            // 道过滤列表
        productTypes: [],       // 物产类别过滤
        populationRange: [0, Infinity]
      },
      brushRange: null          // 刷选范围
    };
    this._listeners = new Map();
  }

  // 获取状态
  get(key) {
    return this._state[key];
  }

  // 更新状态并通知订阅者
  set(key, value) {
    const oldValue = this._state[key];
    this._state[key] = value;
    this._notify(key, value, oldValue);
  }

  // 订阅状态变化
  subscribe(key, callback) {
    if (!this._listeners.has(key)) {
      this._listeners.set(key, new Set());
    }
    this._listeners.get(key).add(callback);
    return () => this._listeners.get(key).delete(callback);
  }

  // 通知订阅者
  _notify(key, newValue, oldValue) {
    const listeners = this._listeners.get(key);
    if (listeners) {
      listeners.forEach(cb => cb(newValue, oldValue));
    }
  }
}
```

### 3.3 数据加载模块 (dataLoader.js)

```javascript
// dataLoader.js
const DataLoader = {
  basePath: './data/',

  async load() {
    const [locations, populationProducts, geoData] = await Promise.all([
      this.fetchJSON('locations.json'),
      this.fetchJSON('population_products.json'),
      this.fetchJSON('china_geo.json')
    ]);

    return { locations, populationProducts, geoData };
  },

  async fetchJSON(filename) {
    const response = await fetch(this.basePath + filename);
    if (!response.ok) {
      throw new Error(`Failed to load ${filename}: ${response.status}`);
    }
    return response.json();
  }
};
```

### 3.4 数据处理模块 (dataProcessor.js)

```javascript
// dataProcessor.js
const DataProcessor = {
  process(rawData) {
    const { locations, populationProducts } = rawData;

    // 1. 合并数据
    const merged = this.mergeData(locations.locations, populationProducts.population_products);

    // 2. 计算派生字段
    const enhanced = this.computeDerivedFields(merged);

    // 3. 构建索引
    const indices = this.buildIndices(enhanced);

    return { data: enhanced, indices };
  },

  mergeData(locations, products) {
    const productMap = new Map(products.map(p => [p.Location_ID, p]));

    return locations.map(loc => ({
      ...loc,
      ...productMap.get(loc.Location_ID)
    }));
  },

  computeDerivedFields(data) {
    return data.map(d => ({
      ...d,
      // 户均人口
      householdSize: d.Households ? d.Population / d.Households : null,
      // 物产丰富度
      productRichness: this.countProducts(d.Products),
      // 主导物产类型
      dominantProductType: this.getDominantType(d.Products)
    }));
  },

  countProducts(products) {
    if (!products) return 0;
    return Object.values(products).reduce((sum, arr) => sum + arr.length, 0);
  },

  getDominantType(products) {
    if (!products) return null;
    let maxType = null, maxCount = 0;
    for (const [type, items] of Object.entries(products)) {
      if (items.length > maxCount) {
        maxCount = items.length;
        maxType = type;
      }
    }
    return maxType;
  },

  buildIndices(data) {
    // 物产倒排索引
    const productIndex = new Map();
    data.forEach(d => {
      if (!d.Products) return;
      Object.values(d.Products).flat().forEach(product => {
        if (!productIndex.has(product)) {
          productIndex.set(product, []);
        }
        productIndex.get(product).push(d.Location_ID);
      });
    });

    // 道索引
    const daoIndex = new Map();
    data.forEach(d => {
      const dao = d.Parent_ID || d.Location_ID;
      if (!daoIndex.has(dao)) {
        daoIndex.set(dao, []);
      }
      daoIndex.get(dao).push(d);
    });

    return { productIndex, daoIndex };
  }
};
```

## 4. 图表组件架构

### 4.1 基类设计

所有图表组件继承自 `BaseChart` 基类：

```javascript
// charts/BaseChart.js
class BaseChart {
  constructor(selector, data, options = {}) {
    this.container = d3.select(selector);
    this.data = data;
    this.options = { ...this.defaultOptions, ...options };

    this.setupDimensions();
    this.setupScales();
    this.render();
  }

  get defaultOptions() {
    return {
      margin: { top: 20, right: 20, bottom: 30, left: 40 }
    };
  }

  setupDimensions() {
    const rect = this.container.node().getBoundingClientRect();
    this.width = rect.width - this.options.margin.left - this.options.margin.right;
    this.height = rect.height - this.options.margin.top - this.options.margin.bottom;
  }

  setupScales() {
    // 子类实现
  }

  render() {
    // 子类实现
  }

  update(newData) {
    this.data = newData;
    this.render();
  }

  highlight(ids) {
    // 子类实现高亮逻辑
  }

  destroy() {
    this.container.selectAll('*').remove();
  }
}
```

### 4.2 组件通信流程

```
用户交互 (点击/刷选/悬停)
        │
        ▼
    事件处理器
        │
        ▼
  AppState.set()
        │
        ▼
  通知订阅者
        │
        ├──────────────┬──────────────┬──────────────┐
        ▼              ▼              ▼              ▼
   MapView        Histogram     ScatterPlot    NetworkGraph
  .highlight()   .highlight()   .highlight()   .highlight()
```

## 5. 交互设计

### 5.1 支持的交互类型

| 交互类型 | 触发方式 | 影响范围 | 实现方式 |
|---------|---------|---------|---------|
| 悬停高亮 | mouseover | 当前图表 | CSS :hover + D3 事件 |
| 点击选中 | click | 全局状态 | AppState 更新 |
| 刷选过滤 | d3.brush | 全局状态 | AppState 更新 |
| 缩放平移 | d3.zoom | 当前图表 | 仅地图支持 |

### 5.2 Tooltip 实现

```javascript
// components/tooltip.js
const Tooltip = {
  element: null,

  init() {
    this.element = d3.select('body')
      .append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0);
  },

  show(event, content) {
    this.element
      .html(content)
      .style('left', (event.pageX + 10) + 'px')
      .style('top', (event.pageY - 10) + 'px')
      .transition()
      .duration(200)
      .style('opacity', 1);
  },

  hide() {
    this.element
      .transition()
      .duration(200)
      .style('opacity', 0);
  }
};
```

## 6. 性能优化策略

### 6.1 渲染优化

- **虚拟化**：地图缩小时隐藏县级节点，仅显示州/府级
- **防抖节流**：resize 事件使用 debounce，mousemove 使用 throttle
- **Canvas 降级**：节点数量 > 1000 时考虑使用 Canvas 替代 SVG

### 6.2 数据优化

- **预计算**：应用启动时完成所有派生字段计算
- **索引缓存**：预构建物产倒排索引、道索引
- **懒加载**：GeoJSON 文件较大时使用 TopoJSON 压缩

### 6.3 内存管理

```javascript
// 图表销毁时清理
destroy() {
  // 移除 DOM 元素
  this.container.selectAll('*').remove();

  // 取消事件监听
  this.unsubscribe?.();

  // 清除引用
  this.data = null;
  this.scales = null;
}
```

## 7. 错误处理

### 7.1 数据加载错误

```javascript
async load() {
  try {
    const data = await this.fetchJSON(filename);
    return data;
  } catch (error) {
    console.error(`数据加载失败: ${filename}`, error);
    this.showErrorMessage('数据加载失败，请刷新页面重试');
    return null;
  }
}
```

### 7.2 渲染错误边界

```javascript
render() {
  try {
    this._render();
  } catch (error) {
    console.error('图表渲染错误:', error);
    this.container.html('<div class="error">图表渲染失败</div>');
  }
}
```

## 8. 浏览器兼容性

### 8.1 特性检测

```javascript
// utils/compat.js
const compat = {
  supportsES6Modules: 'noModule' in document.createElement('script'),
  supportsCustomProperties: CSS.supports('(--a: 0)'),
  supportsFetch: 'fetch' in window,
  supportsIntersectionObserver: 'IntersectionObserver' in window
};

// 降级处理
if (!compat.supportsFetch) {
  console.warn('浏览器不支持 Fetch API，请升级浏览器');
}
```

### 8.2 CSS 兼容性

```css
/* 渐进增强 */
.container {
  display: flex; /* 回退方案 */
  display: grid;
}

/* 特性查询 */
@supports (display: grid) {
  .container {
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  }
}
```
