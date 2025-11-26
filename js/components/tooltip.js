// Tooltip 组件占位实现

export class Tooltip {
  constructor(container = document.body) {
    this.container = container;
    this.element = document.createElement('div');
    this.element.className = 'tooltip';
    this.container.appendChild(this.element);
  }

  show(_content, _position) {
    // 阶段 2 中实现具体渲染逻辑
    this.element.style.opacity = '1';
  }

  hide() {
    this.element.style.opacity = '0';
  }
}
