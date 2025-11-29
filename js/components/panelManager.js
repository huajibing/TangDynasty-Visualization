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

  _bindPanelEvents(panel, panelId) {
    // 关闭按钮
    const closeBtn = panel.querySelector('.floating-panel__close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close(panelId));
    }

    // 拖拽功能（可选）
    const header = panel.querySelector('.floating-panel__header');
    if (header) {
      this._enableDrag(panel, header);
    }
  }

  _bindToggleEvents(button, panelId) {
    button.addEventListener('click', () => this.toggle(panelId));
  }

  _enableDrag(panel, handle) {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    const onMouseDown = (e) => {
      // 排除点击关闭按钮
      if (e.target.closest('.floating-panel__close')) return;

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
