# 项目目录结构规范

本文档定义项目的目录组织结构、文件命名规则和模块划分。

## 1. 完整目录结构

```
tang_visualization/
│
├── index.html                 # 入口 HTML 文件
│
├── css/                       # 样式文件目录
│   ├── variables.css          # CSS 变量定义
│   ├── reset.css              # 浏览器重置样式
│   ├── base.css               # 基础元素样式
│   ├── layout.css             # 布局样式
│   ├── style.css              # 主样式表（导入汇总）
│   ├── components/            # 组件样式
│   │   ├── tooltip.css
│   │   ├── legend.css
│   │   ├── filter.css
│   │   ├── sidebar.css
│   │   └── card.css
│   └── charts/                # 图表样式
│       ├── map.css
│       ├── histogram.css
│       ├── scatter.css
│       └── network.css
│
├── js/                        # JavaScript 源码目录
│   ├── main.js                # 应用入口
│   ├── config.js              # 全局配置
│   ├── state.js               # 状态管理
│   ├── data/                  # 数据处理模块
│   │   ├── dataLoader.js      # 数据加载
│   │   ├── dataProcessor.js   # 数据预处理
│   │   └── dataQuery.js       # 数据查询接口
│   ├── charts/                # 图表组件
│   │   ├── BaseChart.js       # 图表基类
│   │   ├── MapView.js         # 地图视图
│   │   ├── Histogram.js       # 直方图
│   │   ├── ScatterPlot.js     # 散点图
│   │   └── NetworkGraph.js    # 网络图
│   ├── components/            # UI 组件
│   │   ├── tooltip.js         # 提示框
│   │   ├── legend.js          # 图例
│   │   ├── filter.js          # 筛选器
│   │   └── sidebar.js         # 侧边栏
│   └── utils/                 # 工具函数
│       ├── scales.js          # 比例尺工具
│       ├── colors.js          # 颜色方案
│       ├── format.js          # 格式化工具
│       ├── dom.js             # DOM 操作工具
│       └── eventBus.js        # 事件总线
│
├── data/                      # 数据文件目录
│   ├── locations.json         # 地理位置数据
│   ├── population_products.json  # 人口物产数据
│   └── china_geo.json         # 中国地理边界 GeoJSON
│
├── assets/                    # 静态资源目录
│   ├── fonts/                 # 字体文件
│   │   └── .gitkeep
│   └── images/                # 图片资源
│       └── .gitkeep
│
├── docs/                      # 开发文档目录
│   ├── ARCHITECTURE.md        # 技术架构
│   ├── STYLE_GUIDE_JS.md      # JavaScript 规范
│   ├── STYLE_GUIDE_CSS.md     # CSS 规范
│   ├── DATA_SPECIFICATION.md  # 数据规范
│   ├── COMPONENT_GUIDE.md     # 组件开发指南
│   └── GIT_WORKFLOW.md        # Git 工作流
│
├── .eslintrc.json             # ESLint 配置
├── .prettierrc                # Prettier 配置
├── .editorconfig              # 编辑器配置
├── .gitignore                 # Git 忽略文件
├── package.json               # 项目配置
├── README.md                  # 项目说明
└── plan.md                    # 项目计划
```

## 2. 目录职责说明

### 2.1 根目录文件

| 文件 | 说明 |
|------|------|
| `index.html` | 应用入口，包含 DOM 结构和脚本引用 |
| `README.md` | 项目概述、安装和使用说明 |
| `plan.md` | 项目计划和任务分解 |
| `package.json` | 项目配置和依赖管理 |
| `.eslintrc.json` | ESLint 代码检查配置 |
| `.prettierrc` | Prettier 格式化配置 |
| `.editorconfig` | 编辑器统一配置 |
| `.gitignore` | Git 忽略规则 |

### 2.2 css/ 目录

样式文件按功能分层组织：

```
css/
├── variables.css      # 第一层：设计令牌（颜色、间距、字体等）
├── reset.css          # 第二层：浏览器重置
├── base.css           # 第三层：基础元素样式（body, a, h1-h6 等）
├── layout.css         # 第四层：页面布局（Grid, Flexbox）
├── style.css          # 汇总文件，按顺序导入以上文件
├── components/        # 第五层：通用组件样式
└── charts/            # 第六层：图表特定样式
```

**导入顺序**（在 `style.css` 中）：

```css
@import 'variables.css';
@import 'reset.css';
@import 'base.css';
@import 'layout.css';
@import 'components/tooltip.css';
@import 'components/legend.css';
@import 'components/filter.css';
@import 'components/sidebar.css';
@import 'components/card.css';
@import 'charts/map.css';
@import 'charts/histogram.css';
@import 'charts/scatter.css';
@import 'charts/network.css';
```

### 2.3 js/ 目录

JavaScript 代码按模块类型组织：

```
js/
├── main.js            # 入口：初始化应用、协调模块
├── config.js          # 配置：全局常量、配置项
├── state.js           # 状态：全局状态管理
├── data/              # 数据层：加载、处理、查询
├── charts/            # 视图层：可视化组件
├── components/        # 组件层：通用 UI 组件
└── utils/             # 工具层：纯函数工具
```

**模块依赖关系**：

```
main.js
  ├── config.js
  ├── state.js
  ├── data/
  │     ├── dataLoader.js
  │     ├── dataProcessor.js
  │     └── dataQuery.js
  ├── charts/
  │     ├── BaseChart.js
  │     ├── MapView.js
  │     ├── Histogram.js
  │     ├── ScatterPlot.js
  │     └── NetworkGraph.js
  ├── components/
  │     ├── tooltip.js
  │     ├── legend.js
  │     ├── filter.js
  │     └── sidebar.js
  └── utils/
        ├── scales.js
        ├── colors.js
        ├── format.js
        ├── dom.js
        └── eventBus.js
```

### 2.4 data/ 目录

存放静态数据文件：

| 文件 | 说明 | 大小参考 |
|------|------|----------|
| `locations.json` | 地理位置数据 | ~50KB |
| `population_products.json` | 人口物产数据 | ~200KB |
| `china_geo.json` | 地理边界 GeoJSON | ~500KB-2MB |

### 2.5 assets/ 目录

静态资源文件：

```
assets/
├── fonts/             # 字体文件
│   ├── custom-font.woff2
│   └── custom-font.woff
└── images/            # 图片资源
    ├── logo.svg
    ├── icons/
    │   ├── zoom-in.svg
    │   └── zoom-out.svg
    └── backgrounds/
        └── paper-texture.png
```

### 2.6 docs/ 目录

开发文档：

| 文档 | 说明 |
|------|------|
| `ARCHITECTURE.md` | 系统架构设计 |
| `STYLE_GUIDE_JS.md` | JavaScript 编码规范 |
| `STYLE_GUIDE_CSS.md` | CSS 编写规范 |
| `DATA_SPECIFICATION.md` | 数据格式规范 |
| `COMPONENT_GUIDE.md` | 组件开发指南 |
| `GIT_WORKFLOW.md` | Git 工作流程 |

## 3. 文件命名规范

### 3.1 通用规则

- **小写字母**：所有文件名使用小写
- **连字符分隔**：多个单词使用连字符 `-` 连接
- **有意义的名称**：文件名应清晰表达内容

### 3.2 按文件类型

| 文件类型 | 命名规范 | 示例 |
|---------|---------|------|
| JavaScript 模块 | camelCase.js | `dataLoader.js`, `mapView.js` |
| JavaScript 类 | PascalCase.js | `MapView.js`, `BaseChart.js` |
| CSS 文件 | kebab-case.css | `map-view.css`, `base.css` |
| JSON 数据 | snake_case.json | `population_products.json` |
| 图片资源 | kebab-case.ext | `paper-texture.png` |
| Markdown | UPPER_SNAKE_CASE.md | `STYLE_GUIDE_JS.md` |

### 3.3 命名示例

```
✓ js/charts/MapView.js       # 类文件使用 PascalCase
✓ js/utils/format.js         # 工具文件使用 camelCase
✓ css/components/tooltip.css # CSS 使用 kebab-case
✓ data/locations.json        # 数据文件使用 snake_case
✗ js/charts/map_view.js      # 不要在 JS 中使用 snake_case
✗ css/components/ToolTip.css # 不要在 CSS 中使用 PascalCase
```

## 4. 模块导入规范

### 4.1 导入顺序

```javascript
// 1. 外部库（通过 CDN 引入，作为全局变量）
// d3 通过 script 标签引入，无需 import

// 2. 配置文件
import { CONFIG } from './config.js';

// 3. 状态管理
import { AppState } from './state.js';

// 4. 工具函数
import { Format } from './utils/format.js';
import { Colors } from './utils/colors.js';
import { eventBus, EVENTS } from './utils/eventBus.js';

// 5. 数据模块
import { DataLoader } from './data/dataLoader.js';
import { DataProcessor } from './data/dataProcessor.js';

// 6. UI 组件
import { Tooltip } from './components/tooltip.js';
import { Legend } from './components/legend.js';

// 7. 图表组件
import MapView from './charts/MapView.js';
import Histogram from './charts/Histogram.js';
```

### 4.2 相对路径

```javascript
// 从 js/charts/MapView.js 导入

// 同级目录
import BaseChart from './BaseChart.js';

// 上级目录
import { CONFIG } from '../config.js';

// 其他目录
import { Tooltip } from '../components/tooltip.js';
import { Colors } from '../utils/colors.js';
```

## 5. 新增文件指南

### 5.1 添加新图表组件

1. 在 `js/charts/` 创建组件文件：
   ```
   js/charts/NewChart.js
   ```

2. 继承 `BaseChart` 基类：
   ```javascript
   import BaseChart from './BaseChart.js';

   class NewChart extends BaseChart {
     // ...
   }

   export default NewChart;
   ```

3. 在 `css/charts/` 添加样式文件：
   ```
   css/charts/new-chart.css
   ```

4. 在 `style.css` 中导入：
   ```css
   @import 'charts/new-chart.css';
   ```

5. 在 `main.js` 中使用：
   ```javascript
   import NewChart from './charts/NewChart.js';
   ```

### 5.2 添加新工具函数

1. 评估是否属于现有工具模块
2. 如果是新类别，在 `js/utils/` 创建新文件
3. 使用命名导出：
   ```javascript
   export function newUtility() {}
   export const NEW_CONSTANT = 'value';
   ```

### 5.3 添加新数据文件

1. 将数据文件放入 `data/` 目录
2. 在 `js/data/dataLoader.js` 中添加加载逻辑
3. 在 `docs/DATA_SPECIFICATION.md` 中记录数据格式
