# 数据结构与接口规范

本文档定义项目中使用的数据格式、字段说明和数据处理接口。

## 1. 原始数据结构

### 1.1 地理位置数据 (locations.json)

```typescript
interface LocationsFile {
  locations: Location[];
}

interface Location {
  Location_ID: string;           // 唯一标识符
  Location_Name: string;         // 地名（繁体中文）
  Parent_ID: string | null;      // 父级行政区 ID
  Administrative_Level: string;  // 行政级别
  Latitude: number | null;       // 纬度 (WGS84)
  Longitude: number | null;      // 经度 (WGS84)
  Present_Location: string | null; // 今地名
}
```

#### 字段说明

| 字段 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| Location_ID | string | 是 | 唯一标识，格式为 `{type}_{number}` | `"dao_001"`, `"fu_00001"`, `"zhou_00003"` |
| Location_Name | string | 是 | 唐代地名，使用繁体中文 | `"關內道"`, `"京兆府"`, `"華州"` |
| Parent_ID | string \| null | 否 | 所属上级行政区的 ID，道级为 null | `"dao_001"`, `null` |
| Administrative_Level | string | 是 | 行政级别 | `"道"`, `"府"`, `"州"`, `"都"` |
| Latitude | number \| null | 否 | WGS84 纬度坐标 | `34.24642` |
| Longitude | number \| null | 否 | WGS84 经度坐标 | `108.90698` |
| Present_Location | string \| null | 否 | 对应的现代地名 | `"陕西省西安市莲湖区"` |

#### ID 命名规则

| 前缀 | 说明 | 示例 |
|------|------|------|
| `dao_` | 道级行政区 | `dao_001` (關內道) |
| `capital_` | 都城 | `capital_001` (上都) |
| `fu_` | 府级行政区 | `fu_00001` (京兆府) |
| `zhou_` | 州级行政区 | `zhou_00001` (華州) |
| `duhufu_` | 都护府 | `duhufu_001` |

### 1.2 人口物产数据 (population_products.json)

```typescript
interface PopulationProductsFile {
  population_products: PopulationProduct[];
}

interface PopulationProduct {
  Location_ID: string;           // 关联地点 ID
  Location_Name: string;         // 地名
  Administrative_Level: string;  // 行政级别
  Households: number | null;     // 户数
  Population: number | null;     // 人口数
  Confidence: number;            // 数据置信度 (0-1)
  Notes: string;                 // 备注说明
  Products: ProductCategories;   // 物产分类
  Raw_Excerpts: RawExcerpt[];   // 原文摘录
}

interface ProductCategories {
  "农产品": string[];
  "纺织品": string[];
  "药材": string[];
  "矿产/金属": string[];
  "畜产品/土特产": string[];
  "其他/待分类": string[];
}

interface RawExcerpt {
  file: string;    // 原文文件路径
  start: number;   // 起始行号
  end: number;     // 结束行号
  text: string;    // 原文内容
}
```

#### 字段说明

| 字段 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| Location_ID | string | 是 | 关联 locations.json 中的地点 | `"fu_00001"` |
| Households | number \| null | 否 | 天宝年间户数 | `362921` |
| Population | number \| null | 否 | 天宝年间人口数 | `1960188` |
| Confidence | number | 是 | 数据置信度 (0-1) | `0.95` |
| Products | object | 是 | 六类物产分类 | 见下方 |

#### 物产类别定义

| 类别 | 说明 | 示例 |
|------|------|------|
| 农产品 | 粮食、果蔬等农作物 | 水土稻、麥、麰、紫稈粟 |
| 纺织品 | 丝绸、布帛等织物 | 隔紗、粲席、鞾氈、绢 |
| 药材 | 中药材 | 酸棗仁、地骨皮、麝香 |
| 矿产/金属 | 矿石、金属制品 | 银、铜、铁、朱砂 |
| 畜产品/土特产 | 动物产品、土特产 | 蠟、毛、羽、革、角 |
| 其他/待分类 | 其他物品或待分类 | 弓、刀 |

### 1.3 地理边界数据 (china_geo.json)

使用标准 GeoJSON 格式：

```typescript
interface GeoJSONFile {
  type: "FeatureCollection";
  features: Feature[];
}

interface Feature {
  type: "Feature";
  properties: {
    name: string;      // 区域名称
    adcode?: string;   // 行政区划代码
    level?: string;    // 行政级别
  };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
}
```

## 2. 处理后数据结构

### 2.1 合并后的地点数据

```typescript
interface ProcessedLocation {
  // === 基础信息 ===
  Location_ID: string;
  Location_Name: string;
  Parent_ID: string | null;
  Administrative_Level: string;

  // === 地理信息 ===
  Latitude: number | null;
  Longitude: number | null;
  Present_Location: string | null;

  // === 人口数据 ===
  Households: number | null;
  Population: number | null;
  Confidence: number;

  // === 物产数据 ===
  Products: ProductCategories;

  // === 派生字段 ===
  householdSize: number | null;        // 户均人口 = Population / Households
  productRichness: number;             // 物产丰富度 = 物产总数
  dominantProductType: string | null;  // 主导物产类型
  daoName: string | null;              // 所属道名称（便于显示）
}
```

### 2.2 统计汇总数据

```typescript
interface Statistics {
  // 全局统计
  totalLocations: number;
  totalPopulation: number;
  totalHouseholds: number;

  // 范围统计
  populationExtent: [number, number];    // [min, max]
  householdsExtent: [number, number];
  householdSizeExtent: [number, number];
  productRichnessExtent: [number, number];

  // 分布统计
  levelDistribution: Map<string, number>;  // 按行政级别
  daoDistribution: Map<string, number>;    // 按道统计

  // 物产统计
  productFrequency: Map<string, number>;   // 物产出现频次
  productTypeCount: Map<string, number>;   // 各类物产数量
}
```

### 2.3 索引数据

```typescript
interface DataIndices {
  // ID 索引
  locationById: Map<string, ProcessedLocation>;

  // 层级索引
  locationsByLevel: Map<string, ProcessedLocation[]>;
  locationsByDao: Map<string, ProcessedLocation[]>;

  // 物产倒排索引
  productIndex: Map<string, string[]>;  // 物产名 -> Location_ID[]

  // 共现矩阵
  productCooccurrence: Map<string, Map<string, number>>;
}
```

## 3. 数据处理接口

### 3.1 数据加载模块

```javascript
/**
 * 数据加载器
 */
const DataLoader = {
  /**
   * 加载所有数据文件
   * @returns {Promise<RawData>} 原始数据对象
   */
  async loadAll() {
    const [locations, products, geoData] = await Promise.all([
      this.fetchJSON('locations.json'),
      this.fetchJSON('population_products.json'),
      this.fetchJSON('china_geo.json')
    ]);
    return { locations, products, geoData };
  },

  /**
   * 加载单个 JSON 文件
   * @param {string} filename - 文件名
   * @returns {Promise<Object>} JSON 数据
   */
  async fetchJSON(filename) {
    const response = await fetch(`./data/${filename}`);
    if (!response.ok) {
      throw new Error(`Failed to load ${filename}`);
    }
    return response.json();
  }
};
```

### 3.2 数据处理模块

```javascript
/**
 * 数据处理器
 */
const DataProcessor = {
  /**
   * 处理原始数据
   * @param {RawData} rawData - 原始数据
   * @returns {ProcessedData} 处理后的数据
   */
  process(rawData) {
    const merged = this.mergeData(rawData);
    const enhanced = this.computeDerivedFields(merged);
    const statistics = this.computeStatistics(enhanced);
    const indices = this.buildIndices(enhanced);

    return { data: enhanced, statistics, indices };
  },

  /**
   * 合并位置和人口物产数据
   * @param {RawData} rawData
   * @returns {Array<Object>}
   */
  mergeData(rawData) {
    const { locations, products } = rawData;
    const productMap = new Map(
      products.population_products.map(p => [p.Location_ID, p])
    );

    return locations.locations.map(loc => ({
      ...loc,
      ...(productMap.get(loc.Location_ID) || {
        Households: null,
        Population: null,
        Confidence: 0,
        Products: {
          "农产品": [],
          "纺织品": [],
          "药材": [],
          "矿产/金属": [],
          "畜产品/土特产": [],
          "其他/待分类": []
        }
      })
    }));
  },

  /**
   * 计算派生字段
   * @param {Array<Object>} data
   * @returns {Array<ProcessedLocation>}
   */
  computeDerivedFields(data) {
    return data.map(d => ({
      ...d,
      householdSize: d.Households && d.Households > 0
        ? d.Population / d.Households
        : null,
      productRichness: this.countProducts(d.Products),
      dominantProductType: this.getDominantType(d.Products),
      daoName: this.getDaoName(d, data)
    }));
  },

  /**
   * 计算物产总数
   * @param {ProductCategories} products
   * @returns {number}
   */
  countProducts(products) {
    if (!products) return 0;
    return Object.values(products)
      .reduce((sum, arr) => sum + (arr?.length || 0), 0);
  },

  /**
   * 获取主导物产类型
   * @param {ProductCategories} products
   * @returns {string|null}
   */
  getDominantType(products) {
    if (!products) return null;

    let maxType = null;
    let maxCount = 0;

    for (const [type, items] of Object.entries(products)) {
      const count = items?.length || 0;
      if (count > maxCount) {
        maxCount = count;
        maxType = type;
      }
    }

    return maxCount > 0 ? maxType : null;
  },

  /**
   * 构建数据索引
   * @param {Array<ProcessedLocation>} data
   * @returns {DataIndices}
   */
  buildIndices(data) {
    const indices = {
      locationById: new Map(),
      locationsByLevel: new Map(),
      locationsByDao: new Map(),
      productIndex: new Map(),
      productCooccurrence: new Map()
    };

    // 构建 ID 索引
    data.forEach(d => {
      indices.locationById.set(d.Location_ID, d);
    });

    // 构建层级索引
    data.forEach(d => {
      const level = d.Administrative_Level;
      if (!indices.locationsByLevel.has(level)) {
        indices.locationsByLevel.set(level, []);
      }
      indices.locationsByLevel.get(level).push(d);
    });

    // 构建道索引
    data.forEach(d => {
      const daoId = d.Administrative_Level === '道'
        ? d.Location_ID
        : d.Parent_ID;
      if (daoId) {
        if (!indices.locationsByDao.has(daoId)) {
          indices.locationsByDao.set(daoId, []);
        }
        indices.locationsByDao.get(daoId).push(d);
      }
    });

    // 构建物产倒排索引
    data.forEach(d => {
      if (!d.Products) return;
      const allProducts = Object.values(d.Products).flat();
      allProducts.forEach(product => {
        if (!indices.productIndex.has(product)) {
          indices.productIndex.set(product, []);
        }
        indices.productIndex.get(product).push(d.Location_ID);
      });
    });

    // 构建物产共现矩阵
    data.forEach(d => {
      if (!d.Products) return;
      const allProducts = Object.values(d.Products).flat();
      for (let i = 0; i < allProducts.length; i++) {
        for (let j = i + 1; j < allProducts.length; j++) {
          const p1 = allProducts[i];
          const p2 = allProducts[j];
          const key = [p1, p2].sort().join('|');

          if (!indices.productCooccurrence.has(key)) {
            indices.productCooccurrence.set(key, 0);
          }
          indices.productCooccurrence.set(
            key,
            indices.productCooccurrence.get(key) + 1
          );
        }
      }
    });

    return indices;
  }
};
```

### 3.3 数据查询接口

```javascript
/**
 * 数据查询器
 */
const DataQuery = {
  /**
   * 按 ID 获取地点
   * @param {string} id
   * @returns {ProcessedLocation|undefined}
   */
  getById(id) {
    return this.indices.locationById.get(id);
  },

  /**
   * 获取指定道的所有地点
   * @param {string} daoId
   * @returns {ProcessedLocation[]}
   */
  getByDao(daoId) {
    return this.indices.locationsByDao.get(daoId) || [];
  },

  /**
   * 获取出产指定物产的所有地点
   * @param {string} productName
   * @returns {ProcessedLocation[]}
   */
  getByProduct(productName) {
    const ids = this.indices.productIndex.get(productName) || [];
    return ids.map(id => this.getById(id)).filter(Boolean);
  },

  /**
   * 按人口范围筛选
   * @param {number} min
   * @param {number} max
   * @returns {ProcessedLocation[]}
   */
  filterByPopulation(min, max) {
    return this.data.filter(d =>
      d.Population !== null &&
      d.Population >= min &&
      d.Population <= max
    );
  },

  /**
   * 按户均人口范围筛选
   * @param {number} min
   * @param {number} max
   * @returns {ProcessedLocation[]}
   */
  filterByHouseholdSize(min, max) {
    return this.data.filter(d =>
      d.householdSize !== null &&
      d.householdSize >= min &&
      d.householdSize <= max
    );
  },

  /**
   * 获取物产共现数据（用于网络图）
   * @param {number} minCount - 最小共现次数
   * @returns {Array<{source: string, target: string, count: number}>}
   */
  getProductCooccurrence(minCount = 2) {
    const links = [];
    this.indices.productCooccurrence.forEach((count, key) => {
      if (count >= minCount) {
        const [source, target] = key.split('|');
        links.push({ source, target, count });
      }
    });
    return links;
  }
};
```

## 4. 数据验证

### 4.1 验证规则

```javascript
/**
 * 数据验证器
 */
const DataValidator = {
  /**
   * 验证地点数据
   * @param {Location} location
   * @returns {ValidationResult}
   */
  validateLocation(location) {
    const errors = [];
    const warnings = [];

    // 必填字段检查
    if (!location.Location_ID) {
      errors.push('缺少 Location_ID');
    }
    if (!location.Location_Name) {
      errors.push('缺少 Location_Name');
    }
    if (!location.Administrative_Level) {
      errors.push('缺少 Administrative_Level');
    }

    // ID 格式检查
    if (location.Location_ID && !/^(dao|capital|fu|zhou|duhufu)_\d+$/.test(location.Location_ID)) {
      warnings.push(`Location_ID 格式不规范: ${location.Location_ID}`);
    }

    // 坐标范围检查（中国范围）
    if (location.Latitude !== null) {
      if (location.Latitude < 18 || location.Latitude > 54) {
        warnings.push(`纬度超出中国范围: ${location.Latitude}`);
      }
    }
    if (location.Longitude !== null) {
      if (location.Longitude < 73 || location.Longitude > 135) {
        warnings.push(`经度超出中国范围: ${location.Longitude}`);
      }
    }

    // 父级关系检查
    if (location.Administrative_Level !== '道' && !location.Parent_ID) {
      warnings.push('非道级单位缺少 Parent_ID');
    }

    return { valid: errors.length === 0, errors, warnings };
  },

  /**
   * 验证人口数据
   * @param {PopulationProduct} data
   * @returns {ValidationResult}
   */
  validatePopulation(data) {
    const errors = [];
    const warnings = [];

    // 人口数据合理性检查
    if (data.Population !== null && data.Households !== null) {
      const ratio = data.Population / data.Households;
      if (ratio < 1) {
        errors.push(`户均人口小于 1: ${ratio.toFixed(2)}`);
      }
      if (ratio > 20) {
        warnings.push(`户均人口异常高: ${ratio.toFixed(2)}`);
      }
    }

    // 置信度检查
    if (data.Confidence < 0 || data.Confidence > 1) {
      errors.push(`置信度超出范围: ${data.Confidence}`);
    }

    return { valid: errors.length === 0, errors, warnings };
  }
};
```

### 4.2 数据质量报告

```javascript
/**
 * 生成数据质量报告
 * @param {ProcessedData} data
 * @returns {QualityReport}
 */
function generateQualityReport(data) {
  const report = {
    totalRecords: data.length,
    completeRecords: 0,
    missingCoordinates: 0,
    missingPopulation: 0,
    lowConfidence: 0,
    validationErrors: [],
    validationWarnings: []
  };

  data.forEach(d => {
    // 坐标完整性
    if (d.Latitude === null || d.Longitude === null) {
      report.missingCoordinates++;
    }

    // 人口数据完整性
    if (d.Population === null) {
      report.missingPopulation++;
    }

    // 低置信度
    if (d.Confidence < 0.8) {
      report.lowConfidence++;
    }

    // 完整记录
    if (d.Latitude && d.Longitude && d.Population && d.Confidence >= 0.8) {
      report.completeRecords++;
    }
  });

  report.completeness = (report.completeRecords / report.totalRecords * 100).toFixed(1) + '%';

  return report;
}
```

## 5. 数据常量

### 5.1 行政区划枚举

```javascript
const ADMINISTRATIVE_LEVELS = {
  DAO: '道',
  DU: '都',
  FU: '府',
  ZHOU: '州',
  DUHUFU: '都护府'
};

const ADMINISTRATIVE_LEVEL_ORDER = ['道', '都', '府', '州', '都护府'];
```

### 5.2 十道列表

```javascript
const DAO_LIST = [
  { id: 'dao_001', name: '關內道', color: '#c0392b' },
  { id: 'dao_002', name: '河南道', color: '#2980b9' },
  { id: 'dao_003', name: '河東道', color: '#8e44ad' },
  { id: 'dao_004', name: '河北道', color: '#16a085' },
  { id: 'dao_005', name: '山南道', color: '#d35400' },
  { id: 'dao_006', name: '隴右道', color: '#f39c12' },
  { id: 'dao_007', name: '淮南道', color: '#27ae60' },
  { id: 'dao_008', name: '江南道', color: '#1abc9c' },
  { id: 'dao_009', name: '劍南道', color: '#9b59b6' },
  { id: 'dao_010', name: '嶺南道', color: '#e74c3c' }
];
```

### 5.3 物产类别

```javascript
const PRODUCT_TYPES = [
  { key: '农产品', label: '农产品', color: '#27ae60' },
  { key: '纺织品', label: '纺织品', color: '#9b59b6' },
  { key: '药材', label: '药材', color: '#1abc9c' },
  { key: '矿产/金属', label: '矿产', color: '#95a5a6' },
  { key: '畜产品/土特产', label: '土特产', color: '#e67e22' },
  { key: '其他/待分类', label: '其他', color: '#34495e' }
];
```
