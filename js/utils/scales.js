// 比例尺工具占位实现

export function createLinearScale(domain, range) {
  if (!window.d3) return null;
  return window.d3.scaleLinear().domain(domain).range(range);
}
