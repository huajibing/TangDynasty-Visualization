// 数据加载模块占位实现
// 具体逻辑参考 docs/DATA_SPECIFICATION.md 与 ARCHITECTURE.md。

const DataLoader = {
  async loadAll() {
    // 阶段 1 中实现实际加载逻辑
    return {
      locations: null,
      products: null,
      geoData: null,
    };
  },

  async fetchJSON(filename) {
    const response = await fetch(`./data/${filename}`);
    if (!response.ok) {
      throw new Error(`Failed to load ${filename}: ${response.status}`);
    }
    return response.json();
  },
};

export default DataLoader;
