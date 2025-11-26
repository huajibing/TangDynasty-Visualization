// 文本与数值格式化工具占位实现

export function formatNumber(value) {
  if (value == null || Number.isNaN(value)) return '-';
  return new Intl.NumberFormat('zh-CN').format(value);
}
