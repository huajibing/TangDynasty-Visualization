// 数据查询模块：基于 DataProcessor 生成的索引提供常用查询接口。

const DataQuery = {
  init({ data, indices, statistics }) {
    this.data = data || [];
    this.indices = indices || this.createEmptyIndices();
    this.statistics = statistics || null;
  },

  createEmptyIndices() {
    return {
      locationById: new Map(),
      locationsByLevel: new Map(),
      locationsByDao: new Map(),
      productIndex: new Map(),
      productCooccurrence: new Map(),
    };
  },

  getAll() {
    return this.data;
  },

  getById(id) {
    if (!id) return undefined;
    if (this.indices?.locationById?.size) {
      return this.indices.locationById.get(id);
    }
    return this.data.find(item => item.Location_ID === id);
  },

  getByDao(daoId) {
    if (!daoId) return [];
    if (this.indices?.locationsByDao?.size) {
      return this.indices.locationsByDao.get(daoId) || [];
    }
    return this.data.filter(item => item.Parent_ID === daoId || item.Location_ID === daoId);
  },

  getByAdministrativeLevel(level) {
    if (!level) return [];
    if (this.indices?.locationsByLevel?.size) {
      return this.indices.locationsByLevel.get(level) || [];
    }
    return this.data.filter(item => item.Administrative_Level === level);
  },

  getByProduct(productName) {
    if (!productName) return [];
    const ids = this.indices?.productIndex?.get(productName) || [];
    if (ids.length === 0) return [];
    return ids.map(id => this.getById(id)).filter(Boolean);
  },

  getByProductType(type) {
    if (!type) return [];
    return this.data.filter(item => Array.isArray(item?.Products?.[type]) && item.Products[type].length > 0);
  },

  filterByPopulation(min = -Infinity, max = Infinity) {
    return this.data.filter(item =>
      Number.isFinite(item.Population) && item.Population >= min && item.Population <= max
    );
  },

  filterByHouseholdSize(min = -Infinity, max = Infinity) {
    return this.data.filter(item =>
      Number.isFinite(item.householdSize) && item.householdSize >= min && item.householdSize <= max
    );
  },

  getProductCooccurrence(minCount = 2) {
    const links = [];
    const cooccur = this.indices?.productCooccurrence || new Map();
    cooccur.forEach((count, key) => {
      if (count >= minCount) {
        const [source, target] = key.split('|');
        links.push({ source, target, count });
      }
    });
    return links;
  },
};

export default DataQuery;
