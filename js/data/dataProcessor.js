// 数据预处理模块：负责合并原始数据、计算派生字段、统计信息与索引。

const DataProcessor = {
  process(rawData) {
    if (!rawData) {
      return {
        data: [],
        statistics: null,
        indices: this.buildIndices([]),
        rawData,
      };
    }

    const merged = this.mergeData(rawData);
    const enhanced = this.computeDerivedFields(merged);
    const statistics = this.computeStatistics(enhanced);
    const indices = this.buildIndices(enhanced);

    return {
      data: enhanced,
      statistics,
      indices,
      rawData,
    };
  },

  mergeData(rawData) {
    const locationList = rawData?.locations?.locations || [];
    const productList = rawData?.products?.population_products || [];
    const productMap = new Map(
      productList.map((item) => [item.Location_ID, item]),
    );

    const merged = locationList.map((loc) => {
      const productEntry = productMap.get(loc.Location_ID);
      const merged = {
        ...loc,
        ...(productEntry || {}),
      };

      return {
        ...merged,
        Households: productEntry?.Households ?? null,
        Population: productEntry?.Population ?? null,
        Confidence: productEntry?.Confidence ?? 0,
        Products: this.normalizeProducts(productEntry?.Products),
      };
    });

    const removedDaoIds = new Set(
      merged
        .filter(
          (item) =>
            item.Administrative_Level === "道" &&
            item.Location_Name?.trim() === "山南道",
        )
        .map((item) => item.Location_ID),
    );

    return merged
      .filter((item) => !removedDaoIds.has(item.Location_ID))
      .map((item) =>
        removedDaoIds.has(item.Parent_ID) ? { ...item, Parent_ID: null } : item,
      );
  },

  computeDerivedFields(data) {
    const locationMap = new Map(data.map((item) => [item.Location_ID, item]));
    const daoNameById = new Map(
      data
        .filter((item) => item.Administrative_Level === "道")
        .map((item) => [item.Location_ID, item.Location_Name]),
    );

    return data.map((item) => {
      const householdSize = this.computeHouseholdSize(item);
      const productRichness = this.countProducts(item.Products);
      const dominantProductType = this.getDominantType(item.Products);
      const daoName = this.getDaoName(item, locationMap, daoNameById);

      return {
        ...item,
        householdSize,
        productRichness,
        dominantProductType,
        daoName,
      };
    });
  },

  computeStatistics(data) {
    const stats = {
      totalLocations: data.length,
      totalPopulation: 0,
      totalHouseholds: 0,
      populationExtent: [Infinity, -Infinity],
      householdsExtent: [Infinity, -Infinity],
      householdSizeExtent: [Infinity, -Infinity],
      productRichnessExtent: [Infinity, -Infinity],
      levelDistribution: new Map(),
      daoDistribution: new Map(),
      productFrequency: new Map(),
      productTypeCount: new Map(),
    };

    data.forEach((item) => {
      if (Number.isFinite(item.Population)) {
        stats.totalPopulation += item.Population;
        this.updateExtent(stats.populationExtent, item.Population);
      }

      if (Number.isFinite(item.Households)) {
        stats.totalHouseholds += item.Households;
        this.updateExtent(stats.householdsExtent, item.Households);
      }

      if (Number.isFinite(item.householdSize)) {
        this.updateExtent(stats.householdSizeExtent, item.householdSize);
      }

      if (Number.isFinite(item.productRichness)) {
        this.updateExtent(stats.productRichnessExtent, item.productRichness);
      }

      const levelCount =
        stats.levelDistribution.get(item.Administrative_Level) || 0;
      stats.levelDistribution.set(item.Administrative_Level, levelCount + 1);

      const daoKey = item.daoName || "未知";
      const daoCount = stats.daoDistribution.get(daoKey) || 0;
      stats.daoDistribution.set(daoKey, daoCount + 1);

      if (item.Products) {
        Object.entries(item.Products).forEach(([type, list]) => {
          const items = Array.isArray(list) ? list : [];
          const typeTotal = stats.productTypeCount.get(type) || 0;
          stats.productTypeCount.set(type, typeTotal + items.length);

          items.forEach((product) => {
            const current = stats.productFrequency.get(product) || 0;
            stats.productFrequency.set(product, current + 1);
          });
        });
      }
    });

    stats.populationExtent = this.normalizeExtent(stats.populationExtent);
    stats.householdsExtent = this.normalizeExtent(stats.householdsExtent);
    stats.householdSizeExtent = this.normalizeExtent(stats.householdSizeExtent);
    stats.productRichnessExtent = this.normalizeExtent(
      stats.productRichnessExtent,
    );

    return stats;
  },

  buildIndices(data) {
    const indices = {
      locationById: new Map(),
      locationsByLevel: new Map(),
      locationsByDao: new Map(),
      productIndex: new Map(),
      productCooccurrence: new Map(),
    };

    data.forEach((item) => {
      indices.locationById.set(item.Location_ID, item);

      const levelList =
        indices.locationsByLevel.get(item.Administrative_Level) || [];
      levelList.push(item);
      indices.locationsByLevel.set(item.Administrative_Level, levelList);

      const daoId =
        item.Administrative_Level === "道" ? item.Location_ID : item.Parent_ID;
      if (daoId) {
        const daoList = indices.locationsByDao.get(daoId) || [];
        daoList.push(item);
        indices.locationsByDao.set(daoId, daoList);
      }

      if (!item.Products) return;
      const allProducts = Object.values(item.Products)
        .filter(Array.isArray)
        .flat();

      allProducts.forEach((product) => {
        const locations = indices.productIndex.get(product) || [];
        locations.push(item.Location_ID);
        indices.productIndex.set(product, locations);
      });

      for (let i = 0; i < allProducts.length; i += 1) {
        for (let j = i + 1; j < allProducts.length; j += 1) {
          const key = [allProducts[i], allProducts[j]].sort().join("|");
          const count = indices.productCooccurrence.get(key) || 0;
          indices.productCooccurrence.set(key, count + 1);
        }
      }
    });

    return indices;
  },

  normalizeProducts(products) {
    const emptyProducts = {
      农产品: [],
      纺织品: [],
      药材: [],
      "矿产/金属": [],
      "畜产品/土特产": [],
      "其他/待分类": [],
    };

    if (!products) {
      return { ...emptyProducts };
    }

    return Object.keys(emptyProducts).reduce((acc, key) => {
      acc[key] = Array.isArray(products[key]) ? products[key] : [];
      return acc;
    }, {});
  },

  computeHouseholdSize(item) {
    if (
      item.Households === null ||
      item.Households === undefined ||
      item.Households === 0 ||
      item.Population === null ||
      item.Population === undefined
    ) {
      return null;
    }

    return item.Population / item.Households;
  },

  countProducts(products) {
    if (!products) return 0;
    return Object.values(products).reduce(
      (sum, arr) => sum + (arr?.length || 0),
      0,
    );
  },

  getDominantType(products) {
    if (!products) return null;

    let maxType = null;
    let maxCount = 0;

    Object.entries(products).forEach(([type, list]) => {
      const count = Array.isArray(list) ? list.length : 0;
      if (count > maxCount) {
        maxCount = count;
        maxType = type;
      }
    });

    return maxCount > 0 ? maxType : null;
  },

  getDaoName(item, locationMap, daoNameById) {
    if (item.Administrative_Level === "道") {
      return item.Location_Name;
    }

    let parentId = item.Parent_ID;
    while (parentId) {
      if (daoNameById.has(parentId)) {
        return daoNameById.get(parentId);
      }
      const parent = locationMap.get(parentId);
      parentId = parent?.Parent_ID || null;
    }

    return null;
  },

  updateExtent(extent, value) {
    extent[0] = Math.min(extent[0], value);
    extent[1] = Math.max(extent[1], value);
  },

  normalizeExtent(extent) {
    const [min, max] = extent;
    if (min === Infinity || max === -Infinity) {
      return [0, 0];
    }
    return [min, max];
  },
};

export default DataProcessor;
