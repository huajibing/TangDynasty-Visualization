// 数据查询模块占位实现
// 后续阶段会注入实际的 processed data 与 indices。

const DataQuery = {
  init({ data, indices }) {
    this.data = data || [];
    this.indices = indices || {};
  },

  // 示例查询：按 ID 获取地点（阶段 1 中补全所有接口）
  getById(id) {
    if (!this.indices || !this.indices.locationById) return undefined;
    return this.indices.locationById.get(id);
  },
};

export default DataQuery;
