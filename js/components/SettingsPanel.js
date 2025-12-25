// 设置面板：集中管理主题、布局、编码与选择语义等设置。

function resolveContainer(target) {
  if (!target) return null;
  if (typeof target === "string") {
    return document.querySelector(target);
  }
  return target;
}

function setActive(button, active) {
  button.classList.toggle("is-active", Boolean(active));
  button.setAttribute("aria-pressed", active ? "true" : "false");
}

export class SettingsPanel {
  constructor(container, options = {}) {
    this.container = resolveContainer(container);
    this.options = options;
  }

  render(payload = {}) {
    if (!this.container) return;
    this.container.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "settings";

    wrapper.appendChild(
      this._renderSection(
        "主题",
        "修改后立即生效（与顶部主题按钮保持同步）",
        () => this._renderThemeControls(payload),
      ),
    );
    wrapper.appendChild(
      this._renderSection(
        "布局",
        "浮动 / 工作区（与顶部布局按钮保持同步）",
        () => this._renderLayoutControls(payload),
      ),
    );
    wrapper.appendChild(
      this._renderSection("底图", "切换唐代 / 现代边界（不影响点数据）", () =>
        this._renderBasemapControls(payload),
      ),
    );
    wrapper.appendChild(
      this._renderSection(
        "地图点编码",
        "颜色与点大小映射（不使用置信度）",
        () => this._renderMapEncodingControls(payload),
      ),
    );
    wrapper.appendChild(
      this._renderSection("选择语义", "选择结果用于高亮或过滤", () =>
        this._renderSelectionControls(payload),
      ),
    );
    wrapper.appendChild(
      this._renderSection("图例显示", "控制图例中额外信息展示", () =>
        this._renderLegendControls(payload),
      ),
    );
    wrapper.appendChild(this._renderActions());

    this.container.appendChild(wrapper);
  }

  destroy() {
    if (this.container) {
      this.container.innerHTML = "";
    }
  }

  _renderSection(titleText, hintText, bodyBuilder) {
    const section = document.createElement("section");
    section.className = "settings__section";

    const header = document.createElement("div");
    header.className = "settings__section-header";

    const title = document.createElement("h3");
    title.className = "settings__section-title";
    title.textContent = titleText;

    header.appendChild(title);
    section.appendChild(header);

    if (hintText) {
      const hint = document.createElement("p");
      hint.className = "settings__hint";
      hint.textContent = hintText;
      section.appendChild(hint);
    }

    const body = bodyBuilder?.();
    if (body) section.appendChild(body);

    return section;
  }

  _renderToolbar(labelText, ariaLabel, options, activeKey, onSelect) {
    const toolbar = document.createElement("div");
    toolbar.className = "chart-toolbar";
    if (ariaLabel) toolbar.setAttribute("aria-label", ariaLabel);

    const label = document.createElement("span");
    label.className = "chart-toolbar__label";
    label.textContent = labelText;
    toolbar.appendChild(label);

    const buttons = document.createElement("div");
    buttons.className = "chart-toolbar__buttons";
    toolbar.appendChild(buttons);

    options.forEach((entry) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chart-toolbar__btn";
      btn.dataset.key = entry.key;
      btn.textContent = entry.label;
      setActive(btn, entry.key === activeKey);
      btn.addEventListener("click", () => onSelect?.(entry.key));
      buttons.appendChild(btn);
    });

    return toolbar;
  }

  _renderThemeControls(payload) {
    const themeMode = payload.themeMode || "auto";
    return this._renderToolbar(
      "模式",
      "主题模式",
      [
        { key: "auto", label: "自动" },
        { key: "light", label: "日间" },
        { key: "dark", label: "夜间" },
      ],
      themeMode,
      (mode) => this.options.onThemeModeChange?.(mode),
    );
  }

  _renderLayoutControls(payload) {
    const mode = payload.layoutMode || "floating";
    return this._renderToolbar(
      "模式",
      "布局模式",
      [
        { key: "floating", label: "浮动" },
        { key: "workspace", label: "工作区" },
      ],
      mode,
      (next) => this.options.onLayoutModeChange?.(next),
    );
  }

  _renderBasemapControls(payload) {
    const basemap = payload.basemap === "modern" ? "modern" : "tang";
    return this._renderToolbar(
      "范围",
      "地图底图",
      [
        { key: "tang", label: "唐代" },
        { key: "modern", label: "现代" },
      ],
      basemap,
      (next) => this.options.onBasemapChange?.(next),
    );
  }

  _renderMapEncodingControls(payload) {
    const mapEncoding = payload.mapEncoding || {};
    const colorEncoding = mapEncoding.colorEncoding || "dao";
    const markerEncoding = mapEncoding.markerEncoding || "population";

    const container = document.createElement("div");
    container.className = "settings__grid";

    container.appendChild(
      this._renderToolbar(
        "颜色",
        "地图颜色编码",
        [
          { key: "dao", label: "十道" },
          { key: "product", label: "物产" },
          { key: "level", label: "级别" },
        ],
        colorEncoding,
        (key) => this.options.onMapEncodingChange?.({ colorEncoding: key }),
      ),
    );

    container.appendChild(
      this._renderToolbar(
        "大小",
        "地图点大小编码",
        [
          { key: "population", label: "人口" },
          { key: "productRichness", label: "物产" },
          { key: "householdSize", label: "户均" },
          { key: "fixed", label: "固定" },
        ],
        markerEncoding,
        (key) => this.options.onMapEncodingChange?.({ markerEncoding: key }),
      ),
    );

    return container;
  }

  _renderSelectionControls(payload) {
    const asFilter = Boolean(payload.selectionAsFilter);
    return this._renderToolbar(
      "语义",
      "选择语义",
      [
        { key: "highlight", label: "高亮" },
        { key: "filter", label: "过滤" },
      ],
      asFilter ? "filter" : "highlight",
      (key) => this.options.onSelectionAsFilterChange?.(key === "filter"),
    );
  }

  _renderLegendControls(payload) {
    const showMarkerLegend = payload.showMarkerLegend !== false;
    return this._renderToolbar(
      "点大小图例",
      "点大小图例显示",
      [
        { key: "on", label: "显示" },
        { key: "off", label: "隐藏" },
      ],
      showMarkerLegend ? "on" : "off",
      (key) => this.options.onToggleMarkerLegend?.(key === "on"),
    );
  }

  _renderActions() {
    const section = document.createElement("section");
    section.className = "settings__actions";

    if (typeof this.options.onRestartTour === "function") {
      const tourBtn = document.createElement("button");
      tourBtn.type = "button";
      tourBtn.className = "settings__action-btn";
      tourBtn.textContent = "重新打开引导";
      tourBtn.addEventListener("click", () => this.options.onRestartTour?.());
      section.appendChild(tourBtn);
    }

    const restoreBtn = document.createElement("button");
    restoreBtn.type = "button";
    restoreBtn.className = "settings__action-btn";
    restoreBtn.textContent = "恢复默认";
    restoreBtn.addEventListener("click", () =>
      this.options.onRestoreDefaults?.(),
    );

    section.appendChild(restoreBtn);
    return section;
  }
}

export default SettingsPanel;
