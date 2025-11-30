/**
 * 悬浮面板管理器
 * 管理页面上所有悬浮面板的展开/收起状态和交互
 */

export class PanelManager {
  constructor(options = {}) {
    this.panels = new Map();
    this.toggleButtons = new Map();
    this.onPanelChange = options.onPanelChange || null;
    this.onPanelResize = options.onPanelResize || null;
    this.zIndexBase = 100;
    this.zIndexCounter = this.zIndexBase;
    this._resizeObserver = null;

    this._init();
  }

  _init() {
    // 查找所有面板和切换按钮
    document.querySelectorAll('.floating-panel').forEach((panel) => {
      const panelId = panel.dataset.panelId;
      if (panelId) {
        this.panels.set(panelId, panel);
        this._bindPanelEvents(panel, panelId);
      }
    });

    document.querySelectorAll('.panel-toggle').forEach((button) => {
      const panelId = button.dataset.panel;
      if (panelId) {
        this.toggleButtons.set(panelId, button);
        this._bindToggleEvents(button, panelId);
      }
    });

    // 初始化按钮状态
    this._syncButtonStates();

    // 设置 ResizeObserver 监听面板大小变化
    this._setupResizeObserver();

    this._initZIndexBase();
  }

  _setupResizeObserver() {
    if (typeof ResizeObserver === 'undefined') return;

    this._resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const panel = entry.target;
        const panelId = panel.dataset.panelId;
        if (panelId && this.onPanelResize) {
          // 使用 requestAnimationFrame 避免过于频繁的回调
          window.requestAnimationFrame(() => {
            this.onPanelResize(panelId, {
              width: entry.contentRect.width,
              height: entry.contentRect.height,
            });
          });
        }
      }
    });

    // 观察所有面板
    this.panels.forEach((panel) => {
      this._resizeObserver.observe(panel);
    });
  }

  _initZIndexBase() {
    const rootStyles = window.getComputedStyle(document.documentElement);
    const base = Number.parseInt(rootStyles.getPropertyValue('--z-dropdown'), 10);
    this.zIndexBase = Number.isFinite(base) ? base : 100;
    this.zIndexCounter = this.zIndexBase;

    this.panels.forEach((panel) => {
      this.zIndexCounter += 1;
      panel.style.zIndex = this.zIndexCounter;
    });
  }

  _bindPanelEvents(panel, panelId) {
    this._bindFocus(panel, panelId);

    // 关闭按钮
    const closeBtn = panel.querySelector('.floating-panel__close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close(panelId));
    }

    // 拖拽功能（可选）
    const header = panel.querySelector('.floating-panel__header');
    if (header) {
      this._enableDrag(panel, header, panelId);
    }

    this._enableResize(panel, panelId);
  }

  _bindToggleEvents(button, panelId) {
    button.addEventListener('click', () => this.toggle(panelId));
  }

  _bindFocus(panel, panelId) {
    if (!panel) return;
    panel.addEventListener('pointerdown', () => this._focusPanel(panelId));
  }

  _focusPanel(panelId) {
    const panel = this.panels.get(panelId);
    if (!panel) return;
    this.zIndexCounter += 1;
    panel.style.zIndex = this.zIndexCounter;
  }

  _normalizePanelPosition(panel) {
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) return;

    const maxLeft = Math.max(0, window.innerWidth - rect.width);
    const maxTop = Math.max(0, window.innerHeight - rect.height);
    const left = Math.min(Math.max(0, rect.left), maxLeft);
    const top = Math.min(Math.max(0, rect.top), maxTop);

    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.transform = 'none';
    panel.dataset.positionNormalized = 'true';
  }

  _enableResize(panel, panelId) {
    if (!panel || panel.dataset.resizable === 'true') return;
    const handles = [
      { direction: 'n', cursor: 'ns-resize' },
      { direction: 's', cursor: 'ns-resize' },
      { direction: 'e', cursor: 'ew-resize' },
      { direction: 'w', cursor: 'ew-resize' },
      { direction: 'ne', cursor: 'nesw-resize' },
      { direction: 'nw', cursor: 'nwse-resize' },
      { direction: 'se', cursor: 'nwse-resize' },
      { direction: 'sw', cursor: 'nesw-resize' },
    ];

    handles.forEach(({ direction, cursor }) => {
      const handle = document.createElement('div');
      handle.className = `floating-panel__resize-handle floating-panel__resize-handle--${direction}`;
      handle.style.cursor = cursor;
      handle.addEventListener('pointerdown', (event) =>
        this._startResize(event, panel, direction, panelId),
      );
      panel.appendChild(handle);
    });

    panel.dataset.resizable = 'true';
  }

  _startResize(event, panel, direction, panelId) {
    if (!panel) return;
    event.preventDefault();
    event.stopPropagation();

    this._focusPanel(panelId);
    this._normalizePanelPosition(panel);
    panel.style.transition = 'none';

    const rect = panel.getBoundingClientRect();
    const start = {
      x: event.clientX,
      y: event.clientY,
      width: rect.width,
      height: rect.height,
      left: rect.left,
      top: rect.top,
    };

    const styles = window.getComputedStyle(panel);
    const minWidth = Number.parseFloat(styles.minWidth) || 240;
    const minHeight = Number.parseFloat(styles.minHeight) || 180;
    const maxWidth = Math.max(minWidth, window.innerWidth - 24);
    const maxHeight = Math.max(minHeight, window.innerHeight - 24);

    const onPointerMove = (e) => {
      const deltaX = e.clientX - start.x;
      const deltaY = e.clientY - start.y;

      let nextWidth = start.width;
      let nextHeight = start.height;
      let nextLeft = start.left;
      let nextTop = start.top;

      if (direction.includes('e')) nextWidth = start.width + deltaX;
      if (direction.includes('s')) nextHeight = start.height + deltaY;
      if (direction.includes('w')) {
        nextWidth = start.width - deltaX;
        nextLeft = start.left + deltaX;
      }
      if (direction.includes('n')) {
        nextHeight = start.height - deltaY;
        nextTop = start.top + deltaY;
      }

      nextWidth = Math.max(minWidth, Math.min(maxWidth, nextWidth));
      nextHeight = Math.max(minHeight, Math.min(maxHeight, nextHeight));

      const maxLeft = Math.max(0, window.innerWidth - nextWidth);
      const maxTop = Math.max(0, window.innerHeight - nextHeight);
      nextLeft = Math.min(Math.max(0, nextLeft), maxLeft);
      nextTop = Math.min(Math.max(0, nextTop), maxTop);

      panel.style.width = `${nextWidth}px`;
      panel.style.height = `${nextHeight}px`;
      panel.style.left = `${nextLeft}px`;
      panel.style.top = `${nextTop}px`;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
    };

    const onPointerUp = () => {
      panel.style.transition = '';
      panel.releasePointerCapture?.(event.pointerId);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    panel.setPointerCapture?.(event.pointerId);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  _enableDrag(panel, handle, panelId) {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    const onMouseDown = (e) => {
      // 排除点击关闭按钮
      if (e.target.closest('.floating-panel__close')) return;

      this._focusPanel(panelId);
      this._normalizePanelPosition(panel);
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;

      const rect = panel.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;

      panel.style.transition = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      let newLeft = startLeft + deltaX;
      let newTop = startTop + deltaY;

      // 边界限制
      const maxLeft = window.innerWidth - panel.offsetWidth;
      const maxTop = window.innerHeight - panel.offsetHeight;

      newLeft = Math.max(0, Math.min(newLeft, maxLeft));
      newTop = Math.max(0, Math.min(newTop, maxTop));

      // 重置 transform 并使用 left/top 定位
      panel.style.transform = 'none';
      panel.style.left = `${newLeft}px`;
      panel.style.top = `${newTop}px`;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
    };

    const onMouseUp = () => {
      isDragging = false;
      panel.style.transition = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    handle.addEventListener('mousedown', onMouseDown);
  }

  _syncButtonStates() {
    this.panels.forEach((panel, panelId) => {
      const button = this.toggleButtons.get(panelId);
      if (button) {
        const isOpen = panel.classList.contains('is-open');
        button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      }
    });
  }

  open(panelId) {
    const panel = this.panels.get(panelId);
    const button = this.toggleButtons.get(panelId);

    if (panel) {
      panel.classList.add('is-open');
      this._normalizePanelPosition(panel);
      this._focusPanel(panelId);

      if (button) {
        button.setAttribute('aria-expanded', 'true');
      }

      if (this.onPanelChange) {
        this.onPanelChange(panelId, true);
      }
    }
  }

  close(panelId) {
    const panel = this.panels.get(panelId);
    const button = this.toggleButtons.get(panelId);

    if (panel) {
      panel.classList.remove('is-open');

      if (button) {
        button.setAttribute('aria-expanded', 'false');
      }

      if (this.onPanelChange) {
        this.onPanelChange(panelId, false);
      }
    }
  }

  toggle(panelId) {
    const panel = this.panels.get(panelId);
    if (panel) {
      if (panel.classList.contains('is-open')) {
        this.close(panelId);
      } else {
        this.open(panelId);
      }
    }
  }

  isOpen(panelId) {
    const panel = this.panels.get(panelId);
    return panel ? panel.classList.contains('is-open') : false;
  }

  closeAll() {
    this.panels.forEach((_, panelId) => this.close(panelId));
  }

  openAll() {
    this.panels.forEach((_, panelId) => this.open(panelId));
  }

  getPanelElement(panelId) {
    return this.panels.get(panelId) || null;
  }
}

export default PanelManager;
