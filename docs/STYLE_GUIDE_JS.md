# JavaScript 编码规范

本规范基于 ESLint Recommended 和 Airbnb JavaScript Style Guide，并针对本项目特点进行了调整。

## 1. 基本格式

### 1.1 缩进与空格

```javascript
// 使用 2 个空格缩进
function processData(data) {
  return data.map(item => {
    return item.value * 2;
  });
}

// 运算符两侧加空格
const sum = a + b;
const obj = { key: value };

// 逗号后加空格
const arr = [1, 2, 3];
function fn(a, b, c) {}

// 冒号后加空格（对象字面量）
const config = {
  width: 800,
  height: 600
};
```

### 1.2 换行规则

```javascript
// 每行不超过 100 个字符
// 长方法链换行
d3.select('#container')
  .selectAll('circle')
  .data(data)
  .join('circle')
  .attr('cx', d => xScale(d.x))
  .attr('cy', d => yScale(d.y))
  .attr('r', 5);

// 对象解构换行（超过 3 个属性）
const {
  Location_ID,
  Location_Name,
  Population,
  Households,
  Products
} = locationData;

// 参数列表换行
function createChart(
  container,
  data,
  options,
  callbacks
) {
  // ...
}
```

### 1.3 分号与逗号

```javascript
// 始终使用分号
const name = 'Tang';
const population = 1000000;

// 尾随逗号（便于 git diff）
const config = {
  width: 800,
  height: 600,
  margin: {
    top: 20,
    right: 30,
    bottom: 40,
    left: 50,
  },
};
```

## 2. 命名规范

### 2.1 变量与函数

```javascript
// 变量：camelCase
const maxPopulation = 1000000;
const selectedLocationIds = [];

// 常量：UPPER_SNAKE_CASE
const MAX_ZOOM_LEVEL = 8;
const DEFAULT_COLOR = '#e74c3c';
const PRODUCT_TYPES = ['农产品', '纺织品', '药材', '矿产/金属'];

// 函数：camelCase，动词开头
function loadData() {}
function calculatePopulationDensity(pop, area) {}
function renderMap(data) {}
function handleClick(event) {}
function isValidLocation(loc) {}  // 布尔返回值用 is/has/can 开头

// 私有成员：下划线前缀
class Chart {
  _bindEvents() {}
  _calculateDimensions() {}
}
```

### 2.2 类与构造函数

```javascript
// 类名：PascalCase
class MapView {
  constructor(selector, data) {
    this.selector = selector;
    this.data = data;
  }
}

class DataProcessor {
  static process(data) {}
}

// 工厂函数：createXxx
function createTooltip(options) {
  return { /* ... */ };
}
```

### 2.3 文件命名

```
# 模块文件：camelCase
dataLoader.js
mapView.js
scatterPlot.js

# 类文件：PascalCase（可选）
MapView.js
NetworkGraph.js

# 常量/配置文件
config.js
constants.js
```

### 2.4 项目特定命名

```javascript
// 地理/历史相关命名使用拼音或英文
const daoName = '关内道';        // 道
const fuName = '京兆府';         // 府
const zhouName = '华州';         // 州

// 数据字段保持与 JSON 一致（下划线）
const { Location_ID, Location_Name, Population } = item;

// 处理后的变量使用 camelCase
const locationId = item.Location_ID;
const locationName = item.Location_Name;
```

## 3. 变量声明

### 3.1 const 优先

```javascript
// 优先使用 const
const data = await loadData();
const processedData = processData(data);

// 需要重新赋值时使用 let
let currentZoom = 1;
let selectedId = null;

// 禁止使用 var
// var oldStyle = 'bad';  // ❌ 不要使用
```

### 3.2 解构赋值

```javascript
// 对象解构
const { width, height, margin } = config;
const { Location_ID: id, Location_Name: name } = location;

// 数组解构
const [first, second, ...rest] = items;
const [minPop, maxPop] = d3.extent(data, d => d.Population);

// 参数解构
function renderCircle({ cx, cy, r, fill }) {
  // ...
}

// 默认值
const { width = 800, height = 600 } = options;
```

## 4. 函数

### 4.1 箭头函数

```javascript
// 简单回调使用箭头函数
data.map(d => d.value);
data.filter(d => d.Population > 10000);
data.sort((a, b) => a.name.localeCompare(b.name));

// 需要 this 绑定时使用普通函数
class Chart {
  bindEvents() {
    this.svg.on('click', function(event) {
      // 这里 this 指向被点击的 DOM 元素
      d3.select(this).attr('fill', 'red');
    });
  }
}

// 或使用箭头函数配合 event.currentTarget
class Chart {
  bindEvents() {
    this.svg.on('click', (event) => {
      d3.select(event.currentTarget).attr('fill', 'red');
    });
  }
}
```

### 4.2 默认参数

```javascript
// 使用默认参数
function createScale(domain, range = [0, 100]) {
  return d3.scaleLinear().domain(domain).range(range);
}

// 对象参数默认值
function renderChart(data, options = {}) {
  const {
    width = 800,
    height = 600,
    margin = { top: 20, right: 20, bottom: 30, left: 40 }
  } = options;
  // ...
}
```

### 4.3 函数长度与复杂度

```javascript
// 单一职责：一个函数只做一件事
// ❌ 不好的写法
function loadAndProcessAndRenderData() {
  // 太多职责
}

// ✅ 好的写法
async function init() {
  const data = await loadData();
  const processed = processData(data);
  renderCharts(processed);
}

// 函数体不超过 50 行，超过则拆分
// 圈复杂度不超过 10
```

## 5. 类与模块

### 5.1 类定义

```javascript
class MapView {
  // 静态属性
  static defaultOptions = {
    projection: 'mercator',
    zoomable: true
  };

  // 构造函数
  constructor(selector, data, options = {}) {
    this.container = d3.select(selector);
    this.data = data;
    this.options = { ...MapView.defaultOptions, ...options };

    this._init();
  }

  // 公有方法
  render() {
    this._setupScales();
    this._drawMap();
    this._bindEvents();
  }

  update(newData) {
    this.data = newData;
    this.render();
  }

  highlight(ids) {
    this.circles
      .classed('highlighted', d => ids.includes(d.Location_ID));
  }

  // 私有方法（约定以下划线开头）
  _init() {
    this._setupDimensions();
    this._createSvg();
  }

  _setupDimensions() {
    const rect = this.container.node().getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
  }

  _bindEvents() {
    this.circles
      .on('mouseover', this._handleMouseOver.bind(this))
      .on('mouseout', this._handleMouseOut.bind(this));
  }

  // 事件处理方法
  _handleMouseOver(event, d) {
    Tooltip.show(event, this._formatTooltip(d));
  }

  // 销毁方法
  destroy() {
    this.container.selectAll('*').remove();
  }
}
```

### 5.2 模块导出

```javascript
// 命名导出（推荐）
// dataLoader.js
export async function loadLocations() {}
export async function loadProducts() {}
export const DATA_PATH = './data/';

// 默认导出（类或主要功能）
// MapView.js
export default class MapView {}

// 工具模块使用对象导出
// utils/format.js
export const Format = {
  number(n) {
    return n.toLocaleString('zh-CN');
  },
  percentage(n) {
    return (n * 100).toFixed(1) + '%';
  }
};
```

### 5.3 导入顺序

```javascript
// 1. 外部库
import * as d3 from 'd3';

// 2. 项目配置
import { CONFIG } from './config.js';

// 3. 工具函数
import { Format } from './utils/format.js';
import { Colors } from './utils/colors.js';

// 4. 组件/类
import { Tooltip } from './components/tooltip.js';
import MapView from './charts/MapView.js';

// 5. 数据相关
import { DataLoader } from './data/dataLoader.js';
```

## 6. D3.js 特定规范

### 6.1 选择器链

```javascript
// 方法链分行书写，保持清晰
const circles = svg
  .selectAll('circle')
  .data(data, d => d.Location_ID)  // 使用 key 函数
  .join(
    enter => enter
      .append('circle')
      .attr('class', 'location-point')
      .attr('cx', d => projection([d.Longitude, d.Latitude])[0])
      .attr('cy', d => projection([d.Longitude, d.Latitude])[1])
      .attr('r', 0)
      .call(enter => enter
        .transition()
        .duration(500)
        .attr('r', d => radiusScale(d.Population))
      ),
    update => update
      .call(update => update
        .transition()
        .duration(300)
        .attr('r', d => radiusScale(d.Population))
      ),
    exit => exit
      .call(exit => exit
        .transition()
        .duration(200)
        .attr('r', 0)
        .remove()
      )
  );
```

### 6.2 比例尺命名

```javascript
// 比例尺变量以 Scale 结尾
const xScale = d3.scaleLinear();
const yScale = d3.scaleLinear();
const colorScale = d3.scaleOrdinal();
const radiusScale = d3.scaleSqrt();

// 或使用简写（小型项目）
const x = d3.scaleLinear();
const y = d3.scaleLinear();
const color = d3.scaleOrdinal();
```

### 6.3 数据绑定

```javascript
// 始终提供 key 函数以支持正确的更新
svg.selectAll('.bar')
  .data(data, d => d.id)  // ✅ 提供 key
  .join('rect');

// 避免匿名 key
svg.selectAll('.bar')
  .data(data)  // ❌ 无 key，可能导致更新问题
  .join('rect');
```

## 7. 异步处理

### 7.1 async/await

```javascript
// 优先使用 async/await
async function loadAllData() {
  try {
    const [locations, products, geoData] = await Promise.all([
      fetch('./data/locations.json').then(r => r.json()),
      fetch('./data/population_products.json').then(r => r.json()),
      fetch('./data/china_geo.json').then(r => r.json())
    ]);

    return { locations, products, geoData };
  } catch (error) {
    console.error('数据加载失败:', error);
    throw error;
  }
}

// 避免 Promise 地狱
// ❌ 不好的写法
fetch(url1)
  .then(r => r.json())
  .then(data => {
    return fetch(url2)
      .then(r => r.json())
      .then(data2 => {
        // 嵌套过深
      });
  });
```

### 7.2 错误处理

```javascript
// 使用 try-catch 包装 async 操作
async function init() {
  try {
    const data = await loadData();
    renderApp(data);
  } catch (error) {
    showErrorMessage('应用初始化失败');
    console.error(error);
  }
}

// 提供降级方案
async function loadWithFallback() {
  try {
    return await fetch(primaryUrl).then(r => r.json());
  } catch {
    console.warn('主数据源不可用，使用备用数据');
    return await fetch(fallbackUrl).then(r => r.json());
  }
}
```

## 8. 注释规范

### 8.1 文件头注释

```javascript
/**
 * @file 地图视图组件
 * @description 渲染唐代行政区划地图，支持缩放、平移、点击交互
 * @module charts/MapView
 */
```

### 8.2 函数注释

```javascript
/**
 * 计算人口密度
 * @param {number} population - 人口总数
 * @param {number} area - 面积（平方公里）
 * @returns {number} 人口密度（人/平方公里）
 */
function calculateDensity(population, area) {
  if (area === 0) return 0;
  return population / area;
}

/**
 * 渲染地图上的地点标记
 * @param {Array<Object>} data - 地点数据数组
 * @param {Object} options - 渲染选项
 * @param {d3.Scale} options.radiusScale - 半径比例尺
 * @param {d3.Scale} options.colorScale - 颜色比例尺
 */
function renderMarkers(data, options) {
  // ...
}
```

### 8.3 行内注释

```javascript
// 好的注释：解释"为什么"
// 使用对数尺度避免大值点遮挡小值点
const radiusScale = d3.scaleSqrt()
  .domain([0, maxPopulation])
  .range([2, 20]);

// 唐代坐标系与现代 WGS84 存在偏差，需要手动校正
const offsetX = 0.5;

// 避免无意义的注释
// ❌ 不好的注释
const x = 10;  // 设置 x 为 10
```

## 9. 性能注意事项

```javascript
// 避免在循环中创建函数
// ❌ 不好的写法
data.forEach(d => {
  setTimeout(() => console.log(d), 100);  // 每次循环创建新函数
});

// ✅ 好的写法
const logItem = (d) => console.log(d);
data.forEach(d => setTimeout(() => logItem(d), 100));

// 缓存 DOM 查询结果
// ❌ 不好的写法
function update() {
  d3.select('#chart').selectAll('circle').attr('r', 5);
  d3.select('#chart').selectAll('circle').attr('fill', 'red');
}

// ✅ 好的写法
function update() {
  const circles = d3.select('#chart').selectAll('circle');
  circles.attr('r', 5).attr('fill', 'red');
}

// 使用事件委托
// ❌ 不好的写法：每个元素绑定事件
circles.each(function() {
  d3.select(this).on('click', handleClick);
});

// ✅ 好的写法：父元素委托
svg.on('click', (event) => {
  if (event.target.matches('circle')) {
    handleClick(event);
  }
});
```

## 10. ESLint 配置

项目使用的 ESLint 规则见 `.eslintrc.json` 文件。主要规则：

```json
{
  "rules": {
    "indent": ["error", 2],
    "quotes": ["error", "single"],
    "semi": ["error", "always"],
    "no-unused-vars": "warn",
    "no-console": "off",
    "prefer-const": "error",
    "no-var": "error"
  }
}
```
