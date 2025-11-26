// DOM 操作工具占位实现

export function select(selector) {
  return document.querySelector(selector);
}

export function createElement(tagName, className) {
  const el = document.createElement(tagName);
  if (className) {
    el.className = className;
  }
  return el;
}
