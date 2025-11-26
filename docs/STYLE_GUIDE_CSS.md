# CSS 样式规范

本规范定义了项目中 CSS 的编写风格、命名约定和组织方式。

## 1. 文件组织

### 1.1 目录结构

```
css/
├── variables.css       # CSS 变量定义（颜色、间距、字体等）
├── reset.css           # 浏览器重置样式
├── base.css            # 基础元素样式
├── layout.css          # 布局相关样式
├── style.css           # 主样式表（导入其他文件）
├── components/         # 组件样式
│   ├── tooltip.css
│   ├── legend.css
│   ├── filter.css
│   └── sidebar.css
└── charts/             # 图表样式
    ├── map.css
    ├── histogram.css
    ├── scatter.css
    └── network.css
```

### 1.2 导入顺序

```css
/* style.css */
@import 'variables.css';
@import 'reset.css';
@import 'base.css';
@import 'layout.css';
@import 'components/tooltip.css';
@import 'components/legend.css';
@import 'charts/map.css';
/* ... */
```

## 2. CSS 变量（设计令牌）

### 2.1 变量定义

```css
/* variables.css */
:root {
  /* ===== 颜色系统 ===== */

  /* 唐代风格主色调 */
  --color-primary: #c0392b;       /* 朱红 */
  --color-primary-light: #e74c3c;
  --color-primary-dark: #922b21;

  --color-secondary: #d35400;     /* 赭石 */
  --color-accent: #f39c12;        /* 藤黄 */

  /* 中性色 */
  --color-bg-primary: #fdf6e3;    /* 宣纸色 */
  --color-bg-secondary: #f5f0e1;
  --color-bg-tertiary: #ebe6d7;

  --color-text-primary: #2c3e50;
  --color-text-secondary: #7f8c8d;
  --color-text-muted: #bdc3c7;

  /* 边框与分割线 */
  --color-border: #d5d0c1;
  --color-border-light: #e8e4d9;

  /* 语义色 */
  --color-success: #27ae60;
  --color-warning: #f39c12;
  --color-error: #e74c3c;
  --color-info: #3498db;

  /* ===== 物产类别颜色 ===== */
  --color-product-agriculture: #27ae60;   /* 农产品 - 绿 */
  --color-product-textile: #9b59b6;       /* 纺织品 - 紫 */
  --color-product-medicine: #1abc9c;      /* 药材 - 青 */
  --color-product-mineral: #95a5a6;       /* 矿产 - 灰 */
  --color-product-livestock: #e67e22;     /* 畜产品 - 橙 */
  --color-product-other: #34495e;         /* 其他 - 深灰 */

  /* ===== 行政区划颜色 ===== */
  --color-dao-guannei: #c0392b;
  --color-dao-henan: #2980b9;
  --color-dao-hedong: #8e44ad;
  --color-dao-hebei: #16a085;
  --color-dao-shannan: #d35400;
  --color-dao-longyou: #f39c12;
  --color-dao-huainan: #27ae60;
  --color-dao-jiangnan: #1abc9c;
  --color-dao-jiannan: #9b59b6;
  --color-dao-lingnan: #e74c3c;

  /* ===== 间距系统 ===== */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-2xl: 48px;

  /* ===== 字体系统 ===== */
  --font-family-base: -apple-system, BlinkMacSystemFont, 'Segoe UI',
    'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  --font-family-mono: 'SF Mono', 'Fira Code', Consolas, monospace;
  --font-family-serif: 'Songti SC', 'STSong', 'SimSun', serif;

  --font-size-xs: 12px;
  --font-size-sm: 14px;
  --font-size-md: 16px;
  --font-size-lg: 18px;
  --font-size-xl: 20px;
  --font-size-2xl: 24px;
  --font-size-3xl: 32px;

  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-bold: 600;

  --line-height-tight: 1.25;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.75;

  /* ===== 圆角 ===== */
  --radius-sm: 2px;
  --radius-md: 4px;
  --radius-lg: 8px;
  --radius-full: 9999px;

  /* ===== 阴影 ===== */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.15);

  /* ===== 过渡 ===== */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
  --transition-slow: 350ms ease;

  /* ===== 层级 ===== */
  --z-dropdown: 100;
  --z-tooltip: 200;
  --z-modal: 300;
  --z-notification: 400;

  /* ===== 布局 ===== */
  --sidebar-width: 280px;
  --aside-width: 320px;
  --header-height: 64px;
  --footer-height: 48px;
}
```

### 2.2 变量使用

```css
/* 始终使用变量，避免硬编码 */
.card {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  box-shadow: var(--shadow-sm);
}

.card:hover {
  box-shadow: var(--shadow-md);
  transition: box-shadow var(--transition-normal);
}
```

## 3. 命名规范

### 3.1 BEM 命名法

本项目采用 BEM (Block-Element-Modifier) 命名规范：

```css
/* Block：独立的组件 */
.chart {}
.sidebar {}
.tooltip {}

/* Element：组件的组成部分，用双下划线连接 */
.chart__title {}
.chart__container {}
.chart__legend {}
.sidebar__header {}
.sidebar__content {}

/* Modifier：组件或元素的变体，用双连字符连接 */
.chart--fullscreen {}
.chart--loading {}
.chart__title--large {}
.sidebar--collapsed {}
```

### 3.2 命名示例

```css
/* 地图组件 */
.map {}
.map__container {}
.map__svg {}
.map__overlay {}
.map__controls {}
.map__zoom-in {}
.map__zoom-out {}
.map--interactive {}
.map--static {}

/* 地点标记 */
.location-point {}
.location-point--selected {}
.location-point--highlighted {}
.location-point--dimmed {}

/* 侧边栏 */
.sidebar {}
.sidebar__header {}
.sidebar__title {}
.sidebar__content {}
.sidebar__section {}
.sidebar__section-title {}
.sidebar--collapsed {}

/* 筛选器 */
.filter {}
.filter__group {}
.filter__label {}
.filter__checkbox {}
.filter__checkbox--checked {}
```

### 3.3 JavaScript 钩子

用于 JavaScript 交互的类名使用 `js-` 前缀，这些类不应包含任何样式：

```html
<button class="btn btn--primary js-submit">提交</button>
<div class="modal js-modal" data-modal-id="confirm">...</div>
```

```css
/* 不要给 js- 前缀的类添加样式 */
/* ❌ .js-submit { ... } */
```

### 3.4 状态类

状态相关的类使用 `is-` 或 `has-` 前缀：

```css
.sidebar.is-collapsed {}
.chart.is-loading {}
.location-point.is-selected {}
.location-point.is-highlighted {}
.tooltip.is-visible {}
.form-field.has-error {}
```

## 4. 代码格式

### 4.1 基本格式

```css
/* 选择器单独一行 */
.selector-one,
.selector-two,
.selector-three {
  /* 属性按类型分组 */

  /* 定位 */
  position: absolute;
  top: 0;
  left: 0;
  z-index: 10;

  /* 盒模型 */
  display: flex;
  width: 100%;
  padding: var(--spacing-md);
  margin: 0;

  /* 排版 */
  font-size: var(--font-size-md);
  line-height: var(--line-height-normal);
  color: var(--color-text-primary);

  /* 视觉 */
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);

  /* 其他 */
  cursor: pointer;
  transition: all var(--transition-normal);
}
```

### 4.2 属性顺序

建议按以下顺序组织属性：

1. **定位** - position, top, right, bottom, left, z-index
2. **盒模型** - display, flex, grid, width, height, padding, margin, overflow
3. **排版** - font, line-height, text-align, color
4. **视觉** - background, border, border-radius, box-shadow, opacity
5. **动画** - transition, transform, animation
6. **其他** - cursor, pointer-events, user-select

### 4.3 简写属性

```css
/* 使用简写 */
.element {
  margin: 10px 20px;           /* 而非分别设置 */
  padding: 10px;
  background: #fff url(...) no-repeat center;
  font: 500 16px/1.5 sans-serif;
}

/* 明确单边时使用具体属性 */
.element {
  margin-bottom: 20px;         /* 只需要底部边距时 */
  border-left: 2px solid red;  /* 只需要左边框时 */
}
```

## 5. 布局

### 5.1 仪表盘主布局

```css
/* 使用 CSS Grid 构建主布局 */
.dashboard {
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr var(--aside-width);
  grid-template-rows: var(--header-height) 1fr auto;
  grid-template-areas:
    "header header header"
    "sidebar main aside"
    "sidebar footer aside";
  min-height: 100vh;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--color-bg-secondary);
}

.dashboard__header {
  grid-area: header;
}

.dashboard__sidebar {
  grid-area: sidebar;
}

.dashboard__main {
  grid-area: main;
}

.dashboard__aside {
  grid-area: aside;
}

.dashboard__footer {
  grid-area: footer;
}
```

### 5.2 响应式断点

```css
/* 断点变量（在 :root 中定义） */
:root {
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
}

/* 移动优先响应式设计 */
.dashboard {
  display: flex;
  flex-direction: column;
}

@media (min-width: 768px) {
  .dashboard {
    display: grid;
    grid-template-columns: 1fr;
  }
}

@media (min-width: 1024px) {
  .dashboard {
    grid-template-columns: var(--sidebar-width) 1fr;
  }
}

@media (min-width: 1280px) {
  .dashboard {
    grid-template-columns: var(--sidebar-width) 1fr var(--aside-width);
  }
}
```

### 5.3 Flexbox 工具类

```css
/* 常用 Flex 布局 */
.flex { display: flex; }
.flex-col { flex-direction: column; }
.flex-wrap { flex-wrap: wrap; }

.items-center { align-items: center; }
.items-start { align-items: flex-start; }
.items-end { align-items: flex-end; }

.justify-center { justify-content: center; }
.justify-between { justify-content: space-between; }
.justify-end { justify-content: flex-end; }

.flex-1 { flex: 1; }
.flex-none { flex: none; }

.gap-sm { gap: var(--spacing-sm); }
.gap-md { gap: var(--spacing-md); }
.gap-lg { gap: var(--spacing-lg); }
```

## 6. SVG 样式

### 6.1 地图样式

```css
/* 地图容器 */
.map__svg {
  width: 100%;
  height: 100%;
}

/* 地理边界 */
.map__boundary {
  fill: var(--color-bg-tertiary);
  stroke: var(--color-border);
  stroke-width: 0.5;
}

.map__boundary--province {
  stroke-width: 1;
}

.map__boundary--dao {
  fill: none;
  stroke: var(--color-primary);
  stroke-width: 1.5;
  stroke-dasharray: 4 2;
}
```

### 6.2 数据点样式

```css
/* 地点标记 */
.location-point {
  fill: var(--color-primary);
  fill-opacity: 0.7;
  stroke: #fff;
  stroke-width: 1;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.location-point:hover {
  fill-opacity: 1;
  stroke-width: 2;
}

.location-point.is-selected {
  fill: var(--color-accent);
  stroke: var(--color-primary);
  stroke-width: 2;
}

.location-point.is-highlighted {
  fill-opacity: 1;
  stroke: var(--color-accent);
  stroke-width: 2;
}

.location-point.is-dimmed {
  fill-opacity: 0.2;
  stroke-opacity: 0.2;
}
```

### 6.3 图表元素

```css
/* 坐标轴 */
.axis path,
.axis line {
  fill: none;
  stroke: var(--color-border);
  shape-rendering: crispEdges;
}

.axis text {
  font-size: var(--font-size-xs);
  fill: var(--color-text-secondary);
}

/* 网格线 */
.grid line {
  stroke: var(--color-border-light);
  stroke-dasharray: 2 2;
}

/* 柱状图 */
.bar {
  fill: var(--color-primary);
  transition: fill var(--transition-fast);
}

.bar:hover {
  fill: var(--color-primary-light);
}

.bar.is-selected {
  fill: var(--color-accent);
}

/* 散点 */
.scatter-point {
  fill-opacity: 0.6;
  stroke: #fff;
  stroke-width: 1;
}

.scatter-point:hover {
  fill-opacity: 1;
  r: attr(r) + 2;
}
```

## 7. 组件样式

### 7.1 Tooltip

```css
.tooltip {
  position: absolute;
  z-index: var(--z-tooltip);
  max-width: 300px;
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
  color: #fff;
  background: rgba(44, 62, 80, 0.95);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.tooltip.is-visible {
  opacity: 1;
}

.tooltip__title {
  margin-bottom: var(--spacing-xs);
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-md);
}

.tooltip__content {
  color: rgba(255, 255, 255, 0.9);
}

.tooltip__row {
  display: flex;
  justify-content: space-between;
  gap: var(--spacing-md);
}

.tooltip__label {
  color: rgba(255, 255, 255, 0.7);
}

.tooltip__value {
  font-weight: var(--font-weight-medium);
}
```

### 7.2 图例

```css
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
}

.legend--vertical {
  flex-direction: column;
}

.legend__item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  cursor: pointer;
}

.legend__color {
  width: 12px;
  height: 12px;
  border-radius: var(--radius-sm);
}

.legend__label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.legend__item:hover .legend__label {
  color: var(--color-text-primary);
}

.legend__item.is-inactive {
  opacity: 0.4;
}
```

### 7.3 卡片

```css
.card {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--color-border-light);
}

.card__title {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.card__body {
  padding: var(--spacing-md);
}

.card__footer {
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-bg-secondary);
  border-top: 1px solid var(--color-border-light);
}
```

## 8. 动画

### 8.1 过渡

```css
/* 基础过渡 */
.fade-enter {
  opacity: 0;
}

.fade-enter-active {
  opacity: 1;
  transition: opacity var(--transition-normal);
}

.fade-exit {
  opacity: 1;
}

.fade-exit-active {
  opacity: 0;
  transition: opacity var(--transition-normal);
}
```

### 8.2 关键帧动画

```css
/* 加载动画 */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* 脉冲效果 */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.skeleton {
  background: var(--color-bg-tertiary);
  animation: pulse 1.5s ease-in-out infinite;
}

/* 淡入动画 */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.chart--animated {
  animation: fadeIn 0.5s ease-out;
}
```

## 9. 打印样式

```css
@media print {
  /* 隐藏交互元素 */
  .sidebar,
  .filter,
  .tooltip,
  .btn {
    display: none !important;
  }

  /* 调整布局 */
  .dashboard {
    display: block;
  }

  .chart {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  /* 使用打印友好的颜色 */
  .chart__title {
    color: #000;
  }

  /* 移除阴影 */
  .card {
    box-shadow: none;
    border: 1px solid #ccc;
  }
}
```

## 10. 无障碍

```css
/* 焦点样式 */
:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

:focus:not(:focus-visible) {
  outline: none;
}

:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* 跳过链接 */
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-primary);
  color: #fff;
  z-index: 1000;
}

.skip-link:focus {
  top: 0;
}

/* 屏幕阅读器专用 */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* 高对比度模式 */
@media (prefers-contrast: high) {
  .location-point {
    stroke-width: 2;
  }

  .bar {
    stroke: #000;
    stroke-width: 1;
  }
}

/* 减少动画 */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```
