# 盛世霓裳 —— 唐代人口与物产地理分布可视分析系统

> 基于《新唐书·地理志》数据，通过 Web 交互技术重现唐代鼎盛时期（开元、天宝年间）的人口分布格局与物产经济结构。

## 项目概述

本项目是一个多视图联动的可视化分析系统，支持用户从地理、行政区划、人口规模、物产种类等多个维度探索唐代社会经济特征。

### 核心功能

- **交互式地理地图**：展示唐代 300+ 州府的地理分布与人口数据
- **户均规模直方图**：分析户均人口分布，识别异常区域
- **人口-物产散点图**：探索人口规模与物产丰富度的相关性
- **物产共现网络图**：展示不同物产之间的共现关系
- **多维筛选控制器**：支持按道、物产类别等维度进行数据钻取

### 适用场景

- 可视化课程设计展示
- 历史地理数据探索工具
- 数字人文研究平台

## 快速开始

### 环境要求

- 现代浏览器（Chrome 90+、Firefox 88+、Safari 14+、Edge 90+）
- 本地开发服务器（用于加载 JSON 数据）

### 安装与运行

```bash
# 克隆项目
git clone <repository-url>
cd tang_visualization

# 方式一：使用 Python 内置服务器
python -m http.server 8080

# 方式二：使用 Node.js http-server
npx http-server -p 8080

# 方式三：使用 VS Code Live Server 插件
# 右键 index.html -> Open with Live Server
```

访问 `http://localhost:8080` 即可查看项目。

## 项目结构

```
tang_visualization/
├── index.html              # 入口文件
├── css/
│   ├── style.css           # 主样式表
│   ├── components/         # 组件样式
│   │   ├── map.css
│   │   ├── histogram.css
│   │   ├── scatter.css
│   │   └── network.css
│   └── variables.css       # CSS 变量定义
├── js/
│   ├── main.js             # 主逻辑入口
│   ├── config.js           # 全局配置
│   ├── state.js            # 状态管理
│   ├── data/
│   │   ├── dataLoader.js   # 数据加载
│   │   └── dataProcessor.js # 数据预处理
│   ├── charts/
│   │   ├── mapView.js      # 地图视图
│   │   ├── histogram.js    # 直方图
│   │   ├── scatterPlot.js  # 散点图
│   │   └── networkGraph.js # 网络图
│   ├── components/
│   │   ├── tooltip.js      # 提示框
│   │   ├── legend.js       # 图例
│   │   └── filter.js       # 筛选器
│   └── utils/
│       ├── scales.js       # 比例尺工具
│       ├── colors.js       # 颜色方案
│       └── format.js       # 格式化工具
├── data/
│   ├── locations.json      # 地理位置数据
│   ├── population_products.json  # 人口物产数据
│   └── china_geo.json      # 中国地理边界 GeoJSON
├── assets/
│   ├── fonts/              # 字体文件
│   └── images/             # 图片资源
├── docs/                   # 开发文档
│   ├── ARCHITECTURE.md     # 技术架构
│   ├── STYLE_GUIDE_JS.md   # JavaScript 规范
│   ├── STYLE_GUIDE_CSS.md  # CSS 规范
│   ├── DATA_SPECIFICATION.md  # 数据规范
│   ├── COMPONENT_GUIDE.md  # 组件开发指南
│   └── GIT_WORKFLOW.md     # Git 工作流
├── .eslintrc.json          # ESLint 配置
├── .prettierrc             # Prettier 配置
├── .editorconfig           # 编辑器配置
└── package.json            # 项目配置
```

## 技术栈

| 类别 | 技术选型 | 版本 | 用途 |
|------|---------|------|------|
| 核心语言 | HTML5, CSS3, JavaScript | ES6+ | 页面结构、样式、逻辑 |
| 可视化引擎 | D3.js | v7.x | 地图、图表、网络图 |
| 地图支持 | D3-geo | v3.x | 地理投影与路径生成 |
| 布局系统 | CSS Grid + Flexbox | - | 响应式仪表盘布局 |
| 代码规范 | ESLint + Prettier | - | 代码质量保证 |

## 开发文档

详细的开发文档请参阅 `docs/` 目录：

- [技术架构文档](docs/ARCHITECTURE.md) - 系统架构与模块设计
- [目录结构规范](docs/DIRECTORY_STRUCTURE.md) - 项目目录组织与文件命名
- [JavaScript 编码规范](docs/STYLE_GUIDE_JS.md) - JS 代码风格指南
- [CSS 样式规范](docs/STYLE_GUIDE_CSS.md) - CSS 编写规范
- [数据结构规范](docs/DATA_SPECIFICATION.md) - 数据格式与接口定义
- [组件开发指南](docs/COMPONENT_GUIDE.md) - 可视化组件开发规范
- [Git 工作流](docs/GIT_WORKFLOW.md) - 版本控制与协作规范

## 浏览器兼容性

| 浏览器 | 最低版本 | 备注 |
|--------|---------|------|
| Chrome | 90+ | 推荐 |
| Firefox | 88+ | 支持 |
| Safari | 14+ | 支持 |
| Edge | 90+ | 支持 |

## 许可证

本项目仅用于教育和研究目的。

## 致谢

- 数据来源：《新唐书·地理志》
- 地理坐标：中国历史地理信息系统 (CHGIS)
