// 应用入口：初始化数据管线并挂载核心四个视图，建立基础联动。

import { appConfig } from './config.js';
import MapView from './charts/MapView.js';
import Histogram from './charts/Histogram.js';
import ScatterPlot from './charts/ScatterPlot.js';
import NetworkGraph from './charts/NetworkGraph.js';
import DataLoader from './data/dataLoader.js';
import DataProcessor from './data/dataProcessor.js';
import DataQuery from './data/dataQuery.js';
import eventBus, { EVENTS } from './utils/eventBus.js';

async function bootstrap() {
  // eslint-disable-next-line no-console
  console.log('Tang visualization app bootstrap (phase 3)', appConfig);

  try {
    const rawData = await DataLoader.loadAll(appConfig.dataPath);
    const processed = DataProcessor.process(rawData);
    DataQuery.init(processed);

    const { data, statistics, indices } = processed;

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

    mountCharts({ data, geoData: rawData.geoData, indices });

    // 暴露给浏览器控制台，便于后续快速检查
    window.__tangData = { rawData, ...processed };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Data pipeline initialization failed', error);
  }
}

function mountCharts({ data, geoData, indices }) {
  const mapView = new MapView('#map-container', data, {
    geoData,
    colorMode: 'dao',
  });

  const histogram = new Histogram('#histogram-container', data);

  const scatterPlot = new ScatterPlot('#scatter-container', data);

  const networkGraph = new NetworkGraph('#network-container', data, {
    cooccurrence: indices?.productCooccurrence,
    productIndex: indices?.productIndex,
    minCooccurrence: 2,
  });

  // 事件联动：地点选中或 Brush 选择驱动各视图高亮
  eventBus.on(EVENTS.LOCATION_SELECT, location => {
    const ids = location ? [location.Location_ID] : [];
    if (ids.length === 0) {
      mapView.clearHighlight();
      histogram.clearHighlight();
      scatterPlot.clearHighlight();
      networkGraph.clearHighlight();
      return;
    }

    mapView.highlight(ids);
    histogram.highlight(ids);
    scatterPlot.highlight(ids);

    if (location?.Products) {
      const products = Object.values(location.Products)
        .filter(Array.isArray)
        .flat();
      networkGraph.highlight(products);
    } else {
      networkGraph.clearHighlight();
    }
  });

  eventBus.on(EVENTS.HOUSEHOLD_RANGE_CHANGE, payload => {
    const ids = payload?.ids || [];
    if (ids.length === 0) {
      mapView.clearHighlight();
      scatterPlot.clearHighlight();
      return;
    }
    mapView.highlight(ids);
    scatterPlot.highlight(ids);
  });

  eventBus.on(EVENTS.PRODUCT_SELECT, productName => {
    if (!productName) {
      networkGraph.clearHighlight();
      mapView.clearHighlight();
      scatterPlot.clearHighlight();
      return;
    }

    const related = DataQuery.getByProduct(productName);
    const ids = related.map(item => item.Location_ID);
    mapView.highlight(ids);
    scatterPlot.highlight(ids);
    networkGraph.highlight([productName]);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
