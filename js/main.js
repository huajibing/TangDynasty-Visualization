// 应用入口：负责初始化数据加载和视图创建
// 阶段 0 中仅保留基本结构，具体逻辑在后续阶段实现。

import { appConfig } from './config.js';

function bootstrap() {
  // 预留挂载点，后续会在此调用 DataLoader / DataProcessor 等模块
  // eslint-disable-next-line no-console
  console.log('Tang visualization app bootstrap (phase 0)', appConfig);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
