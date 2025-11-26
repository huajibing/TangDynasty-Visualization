// 应用入口：负责初始化数据加载和视图创建
// 阶段 1：接入数据加载与预处理管线，输出基础调试信息。

import { appConfig } from './config.js';
import DataLoader from './data/dataLoader.js';
import DataProcessor from './data/dataProcessor.js';
import DataQuery from './data/dataQuery.js';

async function bootstrap() {
  // eslint-disable-next-line no-console
  console.log('Tang visualization app bootstrap (phase 1)', appConfig);

  try {
    const rawData = await DataLoader.loadAll(appConfig.dataPath);
    const processed = DataProcessor.process(rawData);
    DataQuery.init(processed);

    const { data, statistics } = processed;

    // 基础数据检查输出，便于验证数据管线是否正常
    // eslint-disable-next-line no-console
    console.groupCollapsed('[DataPipeline] 加载校验');
    // eslint-disable-next-line no-console
    console.log('地点数量:', data.length);
    // eslint-disable-next-line no-console
    console.log('人口总数:', statistics?.totalPopulation ?? 0);
    // eslint-disable-next-line no-console
    console.log('户数总数:', statistics?.totalHouseholds ?? 0);
    // eslint-disable-next-line no-console
    console.log('物产种类数:', statistics?.productFrequency?.size ?? 0);
    // eslint-disable-next-line no-console
    console.log('物产类别数:', statistics?.productTypeCount?.size ?? 0);
    // eslint-disable-next-line no-console
    console.log('GeoJSON features:', rawData.geoData?.features?.length ?? 0);
    // eslint-disable-next-line no-console
    console.groupEnd();

    // 暴露给浏览器控制台，便于后续快速检查
    window.__tangData = { rawData, ...processed };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Data pipeline initialization failed', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
