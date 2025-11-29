# 唐代人口物产可视化与可视分析系统构建计划

## 1. 项目概况 (Project Overview)

*   **项目名称**：盛世霓裳——唐代（开元/天宝）人口与物产地理分布可视分析
*   **项目背景**：基于《新唐书·地理志》数据，通过Web交互技术，重现唐代鼎盛时期（开元、天宝年间）的人口分布格局与物产经济结构。
*   **核心目标**：实现多视图联动的可视化系统，支持用户从地理、行政区划、人口规模、物产种类等多个维度探索唐代社会经济特征，回答关于人口密度、物产聚集、地缘经济关联等探索性问题。
*   **适用场景**：可视化课程设计展示、历史地理数据探索工具。

---

## 2. 技术栈与开发环境 (Tech Stack)

鉴于“不使用现代前端框架”的需求，本项目将回归Web开发的本源，强调底层DOM操作与轻量级图表库的使用。

*   **核心语言**：HTML5, CSS3, Vanilla JavaScript (ES6+)。
*   **可视化引擎**：
    *   **D3.js (v7)**：用于绘制高度定制化的地图、力导向图或复杂的关联视图（推荐）。
    *   *备选：Apache ECharts*：如果需要快速构建标准图表（柱状图、散点图），可混合使用。
*   **地图支持**：
    *   **Leaflet.js**：用于加载底图瓦片（如有现代地图对照需求）。
    *   或者直接使用 **D3.js Geo** 模块配合 GeoJSON 绘制空白地理轮廓（更符合历史风格）。
*   **数据处理**：JavaScript 原生 `fetch` API 读取 JSON/CSV，`Lodash` (可选) 用于数据聚合与筛选。
*   **样式与布局**：CSS Grid / Flexbox，不使用 Bootstrap 等重型UI库，保持代码轻量。

---

## 3. 数据层设计 (Data Structure)

根据PDF中的数据提取结果，前端将加载两份核心数据文件，并在内存中进行关联：

1.  **`locations.json` (地理位置表)**
    *   **Key**: `Location_ID`
    *   **Fields**: `Location_Name`, `Parent_ID` (所属道), `Administrative_Level` (道/府/州), `Latitude`, `Longitude` (WGS84坐标)。
2.  **`population_products.json` / `.csv` (属性表)**
    *   **Key**: 关联 `Location_ID`
    *   **Fields**: `Households` (户数), `Population` (口数), `Products` (嵌套对象: 农产品/纺织品/药材/矿产等)。

**前端数据预处理逻辑**：
*   计算 **户均人口 (Household Size)** = `Population` / `Households`。
*   计算 **物产丰富度 (Product Richness)** = 该地点记录的物产总条目数。
*   构建 **物产倒排索引**：例如 `{'丝绸': ['Location_A', 'Location_B']}`，便于反向查询。

---

## 4. 功能模块与任务抽象映射 (Functional Design)

本部分将PDF中提到的 **6个探索性问题（任务抽象）** 转化为具体的可视化视图和交互功能。

### 布局规划
采用 **Dashboard（仪表盘）** 布局：
*   **中央（主视图）**：交互式地理地图。
*   **左侧（控制面板与统计）**：行政区划树、总览数据。
*   **底部（关联分析）**：散点图与直方图。
*   **右侧（物产详情）**：词云或共现网络图。

### 详细功能设计

#### 4.1. 核心视图：唐代地理信息交互地图 (Map View)
*   **对应任务**：
    *   **任务1 (人口密度)**：通过圆点大小（Radius）映射“人口总数”，颜色深浅（Color Saturation）映射“人口密度”（注：因古代面积数据缺失，可用“户口/行政级别”替代，或仅用颜色表示人口数）。
    *   **任务3 (地理聚集性)**：在地图上通过不同形状（Shape）标记不同类别的物产（如：矿产用菱形，纺织用圆形）。
*   **实现细节**：
    *   使用 D3.js 绘制中国轮廓（GeoJSON）。
    *   根据经纬度绘制 300+ 个州/府的坐标点。
    *   **交互**：Hover 显示Tooltip（州名、户口、主要贡品）；Click 触发全局联动（高亮该州在其他图表中的位置）。

#### 4.2. 辅助视图 A：户均规模分布直方图 (Distribution Histogram)
*   **对应任务**：
    *   **任务2 (户均规模差异)**：识别离群值（Outliers）。
*   **实现细节**：
    *   X轴：户均人口（如 1-10+）；Y轴：州/府数量。
    *   **交互 (Brushing)**：用户在直方图上框选“户均 > 8人”的区域，地图上自动高亮这些特殊的州（验证其是否集中在边疆或特定区域）。

#### 4.3. 辅助视图 B：人口 vs 物产丰富度散点图 (Correlation Scatter Plot)
*   **对应任务**：
    *   **任务5 (物产类型与规模)** & **任务6 (丰富度与人口)**。
*   **实现细节**：
    *   X轴：人口数量（对数坐标）；Y轴：物产种类数量。
    *   颜色编码：该地区的主导物产类型（如：红色代表纺织品主导，蓝色代表矿产主导）。
    *   **分析目标**：观察是否呈现正相关（右上角聚集），或者是否存在“人口少但物产极丰富”的资源型城市（左上角）。

#### 4.4. 辅助视图 C：物产共现网络图 (Co-occurrence Network / Chord Diagram)
*   **对应任务**：
    *   **任务4 (物产共现关系)**。
*   **实现细节**：
    *   节点：具体的物产（如：银、麝香、绢）。
    *   连线：两个物产如果在同一个州同时出现，则连线，线宽代表共现频次。
    *   **交互**：点击“麝香”，地图上高亮所有出产麝香的地点，展示其地理分布特征（如是否沿山脉分布）。

#### 4.5. 侧边栏：多维钻取控制器 (Drill-down Filter)
*   **功能**：
    *   **道（Dao）过滤器**：复选框，选择“河南道”、“关内道”等，地图自动缩放至该区域。
    *   **物产类别过滤器**：开关按钮，仅查看“药材”或“矿产”。

---

## 5. 实现步骤 (Implementation Roadmap)

### 第一阶段：基础设施搭建 (Setup)
1.  **文件结构创建**：
    ```text
    /project-root
      ├── index.html          # 入口文件
      ├── css/
      │   └── style.css       # 样式表 (Grid布局)
      ├── js/
      │   ├── main.js         # 主逻辑入口
      │   ├── dataLoader.js   # 数据加载与清洗
      │   ├── charts/         # 图表组件
      │   │   ├── mapView.js
      │   │   ├── scatterPlot.js
      │   │   ├── histogram.js
      │   │   └── networkGraph.js
      │   └── utils.js        # 工具函数 (如颜色比例尺)
      └── data/
          ├── locations.json
          ├── population_products.json
          └── china_geo.json  # 中国地理轮廓GeoJSON (需自行下载)
    ```
2.  **引入库**：在 `index.html` 中通过 CDN 引入 D3.js。

### 第二阶段：数据处理 (Data Processing)
1.  编写 `dataLoader.js`：
    *   使用 `Promise.all` 并行加载两个数据文件。
    *   合并数据：将户口、物产信息注入到 `locations` 数组中。
    *   生成统计数据：计算各“道”的总人口，计算全局的物产频次。

### 第三阶段：核心地图开发 (Map Development)
1.  编写 `mapView.js`：
    *   定义投影 `d3.geoMercator()`。
    *   绘制底图路径。
    *   绘制数据点（Circles）：
        *   半径 scale: `d3.scaleSqrt().domain([minPop, maxPop]).range([2, 10])`。
        *   颜色 scale: 根据所属“道”或人口密度填色。
    *   实现 Tooltip：创建一个绝对定位的 `div`，Hover 时更新 HTML 内容并显示。

### 第四阶段：图表组件开发 (Charts Development)
1.  **直方图**：使用 D3 的 `d3.bin()` 对户均人口数据进行分箱，绘制矩形条。
2.  **散点图**：绘制 X-Y 坐标轴，渲染圆点。
3.  **网络图**：处理物产数据，生成 Node 和 Link 数组，使用 `d3.forceSimulation` 计算布局。

### 第五阶段：联动交互 (Interaction & Linking)
这是最关键的一步，实现“可视分析”的核心。
1.  **建立全局状态 (State Management)**：
    *   在 `main.js` 中维护一个 `state` 对象，例如：
        ```javascript
        let state = {
            selectedDao: null,      // 当前选中的道
            highlightedIds: [],     // 当前高亮的Location ID列表
            selectedProduct: null   // 当前选中的物产
        };
        ```
2.  **事件监听与分发**：
    *   当直方图被 Brush 时 -> 更新 `state.highlightedIds` -> 调用 `mapView.updateHighlight()` 和 `scatterPlot.updateHighlight()`。
    *   当点击地图上的点 -> 更新 `state.selectedDao` -> 过滤其他图表数据。

### 第六阶段：UI 美化与叙事 (Polishing)
1.  **视觉风格**：应用唐代风格配色（朱红、赭石、藤黄）。
2.  **排版**：使用 CSS Grid 确保在不同屏幕下的适配。
3.  **引导文案**：在界面侧边添加简短的说明，引导用户发现数据中的规律（如：“试着点击河南道，观察其惊人的人口密度”）。

---

## 6. 开发难点预警

1.  **坐标缺失或偏差**：古地名对应的现代坐标可能都在同一个城市（如西安市区可能有多个古县坐标重叠）。
    *   *解决方案*：使用 D3 的 Force 布局防止点重叠 (Collision detection)，或者在地图放大时才显示具体县级点。
2.  **数据量级差异**：人口数据跨度极大（从几千到几十万）。
    *   *解决方案*：使用对数尺度 (Log Scale) 映射半径，防止大圆遮挡小圆。
3.  **物产解析**：物产字段是文本或嵌套对象，需要提取并统计。
    *   *解决方案*：在数据加载阶段完成“扁平化”处理，生成一个单独的 `Products_List` 供分析使用。
---

## 7. 分阶段开发 TODO 规划

### 阶段 0：项目基础设施与目录搭建

- [x] 按 `docs/DIRECTORY_STRUCTURE.md` 建立完整目录和空白文件：`index.html`、基础 CSS 文件（`variables.css`, `reset.css`, `base.css`, `layout.css`, `style.css`）以及 JS 入口和模块文件（`main.js`, `config.js`, `state.js` 等），确保路径与文档一致。
- [x] 新建 `data/` 目录，将当前根目录下的 `locations.json`、`population_products.json` 移入 `data/`，并为后续的 `china_geo.json` 预留位置（已创建占位文件）。
- [x] 新建 `.eslintrc.json`、`.prettierrc`、`.editorconfig`、`.gitignore` 等配置文件，配置内容遵循 `docs/STYLE_GUIDE_JS.md` 和 `docs/STYLE_GUIDE_CSS.md` 中的风格要求。
- [x] 初始化 npm 环境（`npm install`），验证 `npm run start` 能启动静态服务器，`npm run lint`、`npm run format:check` 在当前骨架项目状态下均能正常通过（仅保留少量占位代码的 lint warning）。
- [x] 按 `docs/GIT_WORKFLOW.md` 规范整理 Git：使用 `main`/`develop` 分支，已完成首次初始化提交（`chore(config): bootstrap project structure (phase 0)`），后续开发从 `develop` 创建 `feature/*` 分支并使用 Conventional Commits 规范提交。

> 阶段 0 实施记录（同步当前进度与实现细节）
>
> - 入口与布局：建立 `index.html`，使用仪表盘布局预留地图、直方图、散点图、网络图以及左右侧边栏和页脚区域，并通过 CDN 引入 D3 v7 与 `js/main.js`（参见 `index.html`）。
> - 样式骨架：在 `css/` 下创建 `variables.css`（设计令牌）、`reset.css`、`base.css`、`layout.css`、`style.css`，以及 `css/components/*.css` 和 `css/charts/*.css` 的占位实现，采用 CSS Grid + Flex 构建主布局。
> - JS 模块结构：在 `js/` 下创建入口与模块文件，包括 `main.js`、`config.js`、`state.js`、`data/`（`dataLoader.js`, `dataProcessor.js`, `dataQuery.js`）、`charts/`（`BaseChart.js`, `MapView.js`, `Histogram.js`, `ScatterPlot.js`, `NetworkGraph.js`）、`components/`（`tooltip.js`, `legend.js`, `filter.js`, `sidebar.js`）、`utils/`（`scales.js`, `colors.js`, `format.js`, `dom.js`, `eventBus.js`），当前为可运行的占位实现，后续阶段在此基础上补充具体逻辑。
> - 工具链：配置 ESLint（`.eslintrc.json`）、Prettier（`.prettierrc`）与 `.editorconfig`，并通过 `package.json` 中的 `npm run lint`、`npm run format:check`、`npm run start` 进行验证，确保基础开发环境可用。
> - 版本控制：在项目根目录初始化 Git 仓库，创建 `main` 和 `develop` 分支，并完成一次包含阶段 0 结构与配置的初始提交，为后续按文档规范进行分支管理与版本发布打好基础。

### 阶段 1：数据层实现（DataLoader / DataProcessor / DataQuery）

- [x] 在 `js/data/dataLoader.js` 实现 `DataLoader`：按 `docs/DATA_SPECIFICATION.md` 中的接口定义，编写 `loadAll()` 和 `fetchJSON()`，从 `/data` 并行加载 `locations.json`、`population_products.json`、`china_geo.json`，并对 HTTP 错误和解析错误进行统一报错处理。
- [x] 在 `js/data/dataProcessor.js` 实现数据合并：将 `locations.locations` 与 `population_products.population_products` 按 `Location_ID` 关联为 `ProcessedLocation[]`，计算 `householdSize`、`productRichness`、`dominantProductType`、`daoName` 等派生字段，并妥善处理 `Households`/`Population` 为 `null` 或 0 的情况。
- [x] 在 `js/data/dataProcessor.js` 中实现统计与索引构建：生成 `Statistics`（各种 Extent 和分布统计）以及 `DataIndices`（`locationById`、`locationsByLevel`、`locationsByDao`、`productIndex`、`productCooccurrence` 等），接口形式按文档约定。
- [x] 在 `js/data/dataQuery.js` 提供高层封装查询函数，例如：按道/行政级别筛选地点、按户均人口或人口范围过滤、按物产名称或类别查找地点、按 ID 获取完整 `ProcessedLocation`。
- [x] 在早期的 `js/main.js` 中加入简单的调试逻辑：调用 DataLoader + DataProcessor 后在控制台打印数据量、人口总数、物产种类数等，以验证数据管线是否与 `plan.md` 和 `docs/DATA_SPECIFICATION.md` 描述一致。

### 阶段 2：工具层与可视化基类（Utils + BaseChart）

- [x] 在 `js/utils/scales.js` 定义统一的比例尺工厂函数：人口半径比例尺、人口/户均人口坐标轴比例尺、物产丰富度比例尺、颜色比例尺等，所有图表从这里获取 scale，避免重复配置。
- [x] 在 `js/utils/colors.js` 建立全局色板：唐代风格主色（朱红、赭石、藤黄等）以及按道/物产类别的颜色映射，保持 JS 中的色值与 `css/variables.css` 中 CSS 变量一致。
- [x] 在 `js/utils/format.js` 实现格式化工具函数：人口/户数千分位格式化、百分比显示、中文单位（“万户”“万人”）转换以及 Tooltip 文本拼接，供各个组件统一使用。
- [x] 在 `js/utils/eventBus.js` 实现轻量级事件总线（`on`/`off`/`emit`），用于图表和 UI 组件之间的解耦通信（如 `daoSelected`、`householdRangeChanged`、`productSelected` 等事件）。
- [x] 参考 `docs/COMPONENT_GUIDE.md` 在 `js/charts/BaseChart.js` 实现 `BaseChart` 基类：容器校验、尺寸与 margin 初始化、`<svg>` 和主 `<g>` 创建、自适应 `resize` 逻辑，以及抽象的 `render()`/`update()`/`destroy()` 生命周期接口，供后续所有图表继承。

> 阶段 2 实施记录：
> - 在 `utils/scales.js` 统一人口、户均人口、物产丰富度及颜色比例尺工厂，加入极值兜底和 log/linear 选项。
> - 在 `utils/colors.js` 读取 CSS 设计令牌生成色板，覆盖主题色、十道颜色与物产类别颜色，并提供快捷获取函数。
> - 在 `utils/format.js` 提供数字、百分比、万人/万户单位转换与 Tooltip 拼接的安全格式化工具（包含 HTML 转义）。
> - 在 `utils/eventBus.js` 引入带 on/off/once/emit 的事件总线及常用事件常量，支持取消订阅与错误隔离。
> - 在 `charts/BaseChart.js` 完成基类：容器校验、尺寸计算、SVG/`<g>` 创建、可选自动渲染与 resize 防抖，提供 `render`/`update`/`destroy` 占位以供子类扩展。

### 阶段 3：四个核心视图实现（地图 + 直方图 + 散点图 + 网络图）

- [x] 准备并接入底图数据：获取符合 `docs/DATA_SPECIFICATION.md` 要求的 `china_geo.json` 并放入 `data/`，在 `DataLoader.loadAll()` 中加入加载逻辑；在 `MapView` 中验证 GeoJSON 能正确渲染。
- [x] 在 `js/charts/MapView.js` 基于 D3-geo 实现地图视图：绘制中国轮廓（`FeatureCollection`）、将 `ProcessedLocation` 中有经纬度的数据投影为点，使用人口大小和道/行政级别映射圆半径和颜色，Hover 展示 Tooltip，Click 触发选中事件。
- [x] 在 `js/charts/Histogram.js` 实现户均人口直方图：使用 `d3.bin()` 对 `householdSize` 分箱，绘制条形，支持 Brush 交互将选中区间通过 `eventBus.emit('householdRangeChanged', range)` 广播。
- [x] 在 `js/charts/ScatterPlot.js` 实现人口 vs 物产丰富度散点图：X 轴人口（可选对数坐标），Y 轴 `productRichness`，颜色编码 `dominantProductType`，支持点的 Hover 高亮和根据外部状态（如地图选中）进行点高亮。
- [x] 在 `js/charts/NetworkGraph.js` 实现物产共现网络图：从 `productCooccurrence` 构建节点与边，使用 `d3.forceSimulation` 进行布局，节点 Hover 显示物产信息，Click 通过事件总线广播 `productSelected`，以驱动地图和其他图表高亮相关地点。

> 阶段 3 实施记录：
> - 接入真实 `china_geo.json`，MapView 使用 Mercator 投影 + `fitExtent` 绘制边界并支持缩放平移。
> - MapView 基于人口半径与道颜色渲染地点，Hover Tooltip，点击选中并通过事件总线广播地点高亮。
> - Histogram 使用 `d3.bin` 分箱户均人口，Brush 选区通过 `HOUSEHOLD_RANGE_CHANGE` 广播并驱动地图/散点高亮。
> - ScatterPlot 采用人口对数轴与物产丰富度轴，颜色映射主导物产类型，Hover/点击联动地图与事件总线。
> - NetworkGraph 读取共现 Map 构建力导向网络，节点/连线 Tooltip 与点击广播 `PRODUCT_SELECT`，支持高亮联动。
> - `main.js` 完成四图初始化与基础联动：地点选中、户均 Brush、物产点击均可驱动跨视图高亮。

### 阶段 4：全局状态管理、联动交互与 UI 组件

- [x] 在 `js/state.js` 定义 `AppState`（或等价模块）：集中存储当前选中的道、选中地点 ID 集合、物产筛选条件、户均人口区间等状态，提供 `getState()`、`update(partial)`、订阅变更回调等接口，内部可以结合 `eventBus` 做通知。
- [x] 在 `js/components/tooltip.js`、`legend.js`、`filter.js`、`sidebar.js` 中实现 UI 组件：Tooltip 负责统一的悬浮信息框，Legend 显示颜色/符号含义，Filter/Sidebar 提供按道和物产类别的筛选器，以及全局统计（总人口、总地点数等）。
- [x] 在 `js/main.js` 中完成应用初始化：加载原始数据 -> 调用 `DataProcessor` 得到处理后数据和索引 -> 初始化 `AppState` 与 `eventBus` -> 实例化地图和各图表组件，并通过构造参数传入状态和数据查询函数。
- [x] 建立视图间联动协议：直方图 Brush 更新 `AppState.householdRange` 并触发地图和散点图的高亮刷新；地图点击地点更新 `AppState.selectedLocationIds` 并在散点图中突出显示对应点；网络图节点点击更新 `AppState.selectedProduct` 并在地图上高亮相关地点。
- [x] 为所有交互路径增加健壮性处理：当筛选结果为空、地点缺少坐标、数据置信度过低等情况时，图表给出友好提示或淡化显示，并避免控制台错误；对复杂交互增加简单的调试日志（可后期移除）。

> 阶段 4 实施记录：
> - 在 `AppState` 中增加默认状态、深拷贝获取、变更对比与订阅机制，支持 filters/选中/高亮的安全合并与通知。
> - 完成侧栏组件：`Sidebar` 汇总全局统计/提示并托管 `FilterPanel` 与 `Legend`，筛选支持按道与物产类别清空/同步；Legend 渲染物产、行政级别与十道配色。
> - 应用入口重构：集中初始化数据与状态，挂载图表与侧栏，桥接事件总线，基于 `AppState` 驱动跨视图联动、筛选过滤与高亮同步。
> - 交互健壮性：筛选为空时侧栏提示并清除刷选，高亮仅落在可见数据上，地图在缺少坐标时显示占位文本，重要过滤变更输出调试日志。

### 阶段 5：样式美化、叙事增强、质量保障与发布

- [ ] 按 `docs/STYLE_GUIDE_CSS.md` 完成样式分层：实现 `css/variables.css`（设计令牌）、`reset.css`、`base.css`、`layout.css`、`style.css`，以及各组件和图表样式文件（`css/components/*.css`, `css/charts/*.css`），实现仪表盘式布局和基础响应式适配。
- [ ] 完成 `index.html` 的最终结构：语义化地组织 Header（项目标题与简要说明）、主区域（地图、直方图、散点图、网络图、侧边栏）、Footer（数据来源、制作信息等），并引入所有 CSS/JS 资源（D3 CDN、`js/main.js` 等）。
- [ ] 提炼并嵌入叙事与任务引导：在侧边栏或顶部添加简短引导文案，将本文件中列出的 6 个探索性问题转化为“操作提示”（例如“在直方图中框选户均>8人区域，观察地图上的空间分布”），同时在 `README.md` 更新使用说明与关键截图。
- [ ] 根据 `docs/STYLE_GUIDE_JS.md` 和 `.eslintrc.json` 运行并修正 `npm run lint` 和 `npm run format` 的所有问题，确保 JS/CSS/HTML 符合统一编码规范；必要时微调 ESLint/Prettier 配置以适配项目实际需求。
- [ ] 按 `docs/GIT_WORKFLOW.md` 准备首个可用版本：在若干 `feature/*` 分支完成上述阶段后合并到 `develop`，从 `develop` 创建 `release/v1.0.0` 进行最终测试，通过后合并到 `main` 并配置静态托管（GitHub Pages 或实验室服务器），形成可访问的在线版本。
