// 数据加载模块，负责从 /data 目录读取所需的 JSON 文件。
// 具体接口规范见 docs/DATA_SPECIFICATION.md。

const DataLoader = {
  basePath: './data',

  async loadAll(basePath = this.basePath) {
    const dataPath = (basePath || this.basePath || './data').replace(/\/$/, '');
    try {
      const [locations, products, geoData] = await Promise.all([
        this.fetchJSON('locations.json', dataPath),
        this.fetchJSON('population_products.json', dataPath),
        this.fetchJSON('china_geo.json', dataPath),
      ]);

      return { locations, products, geoData };
    } catch (error) {
      // 上层需要感知错误以便提示用户或降级处理
      console.error('[DataLoader] 数据加载失败', error);
      throw error;
    }
  },

  async fetchJSON(filename, basePath = this.basePath) {
    const url = `${(basePath || this.basePath || './data').replace(/\/$/, '')}/${filename}`;

    let response;
    try {
      response = await fetch(url);
    } catch (networkError) {
      throw new Error(`Network error while loading ${filename}: ${networkError.message}`);
    }

    if (!response.ok) {
      throw new Error(`Failed to load ${filename}: ${response.status} ${response.statusText}`);
    }

    try {
      return await response.json();
    } catch (parseError) {
      throw new Error(`Invalid JSON in ${filename}: ${parseError.message}`);
    }
  },
};

export default DataLoader;
