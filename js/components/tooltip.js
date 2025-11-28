// Tooltip 组件：提供统一的悬浮信息框显示/隐藏与边界校正。

const DEFAULT_OFFSET = { x: 12, y: 12 };

export const Tooltip = {
  init(container = document.body) {
    if (this.element) return this;

    this.element = document.createElement('div');
    this.element.className = 'tooltip';
    this.element.setAttribute('role', 'tooltip');
    this.element.setAttribute('aria-hidden', 'true');

    container.appendChild(this.element);
    return this;
  },

  show(event, content = '', offset = DEFAULT_OFFSET) {
    if (typeof document === 'undefined') return;
    this.init();

    const { x, y } = this._extractPosition(event, offset);
    this.element.innerHTML = content;
    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;
    this.element.classList.add('is-visible');
    this.element.setAttribute('aria-hidden', 'false');

    this._adjustPosition();
  },

  hide() {
    if (!this.element) return;
    this.element.classList.remove('is-visible');
    this.element.setAttribute('aria-hidden', 'true');
  },

  destroy() {
    if (!this.element) return;
    this.element.remove();
    this.element = null;
  },

  _extractPosition(event, offset = DEFAULT_OFFSET) {
    const safeOffset = offset || DEFAULT_OFFSET;
    if (event && typeof event === 'object') {
      if (typeof event.clientX === 'number' && typeof event.clientY === 'number') {
        return { x: event.clientX + safeOffset.x, y: event.clientY + safeOffset.y };
      }
      if (typeof event.pageX === 'number' && typeof event.pageY === 'number') {
        return {
          x: event.pageX - window.scrollX + safeOffset.x,
          y: event.pageY - window.scrollY + safeOffset.y,
        };
      }
      if (Array.isArray(event) && event.length >= 2) {
        return { x: event[0] + safeOffset.x, y: event[1] + safeOffset.y };
      }
      if (typeof event.x === 'number' && typeof event.y === 'number') {
        return { x: event.x + safeOffset.x, y: event.y + safeOffset.y };
      }
    }
    return { x: safeOffset.x, y: safeOffset.y };
  },

  _adjustPosition() {
    if (!this.element) return;
    const rect = this.element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = parseFloat(this.element.style.left) || 0;
    let top = parseFloat(this.element.style.top) || 0;

    if (rect.right > viewportWidth) {
      left = Math.max(DEFAULT_OFFSET.x, viewportWidth - rect.width - DEFAULT_OFFSET.x);
    }
    if (rect.bottom > viewportHeight) {
      top = Math.max(DEFAULT_OFFSET.y, viewportHeight - rect.height - DEFAULT_OFFSET.y);
    }

    this.element.style.left = `${left}px`;
    this.element.style.top = `${top}px`;
  },
};

export default Tooltip;
