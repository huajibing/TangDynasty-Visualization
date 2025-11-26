// 数据预处理模块占位实现
// 阶段 1 将按 docs/DATA_SPECIFICATION.md 完成具体逻辑。

const DataProcessor = {
  process(rawData) {
    // 返回占位结构，防止后续模块在阶段 0 中调用时报错
    return {
      data: [],
      statistics: null,
      indices: null,
      rawData,
    };
  },
};

export default DataProcessor;
