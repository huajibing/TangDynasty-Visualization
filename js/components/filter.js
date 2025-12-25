// 筛选器组件：按道、物产类别等维度筛选数据。

import {
  getAdministrativeLevelColor,
  getDaoColor,
  getProductTypeColor,
} from "../utils/colors.js";

function resolveContainer(target) {
  if (!target) return null;
  if (typeof target === "string") {
    return document.querySelector(target);
  }
  return target;
}

export class FilterPanel {
  constructor(container, options = {}) {
    this.container = resolveContainer(container);
    this.options = options;
    this._unsubscribers = [];
    this._suspend = false;
  }

  render(filters = {}) {
    if (!this.container) return;
    this._cleanup();
    this.container.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "filter";

    const daoGroup = this._renderDaoGroup(filters.daoIds || []);
    if (daoGroup) wrapper.appendChild(daoGroup);

    const levelGroup = this._renderLevelGroup(filters.levels || []);
    if (levelGroup) wrapper.appendChild(levelGroup);

    const populationGroup = this._renderRangeGroup({
      title: "人口范围",
      key: "populationRange",
      unitHint: "人",
      range: filters.populationRange,
      step: 1,
      placeholder: this.options.valueRanges?.population,
    });
    if (populationGroup) wrapper.appendChild(populationGroup);

    const householdGroup = this._renderRangeGroup({
      title: "户均人口范围",
      key: "householdRange",
      unitHint: "人/户",
      range: filters.householdRange,
      step: 0.1,
      placeholder: this.options.valueRanges?.householdSize,
    });
    if (householdGroup) wrapper.appendChild(householdGroup);

    const richnessGroup = this._renderRangeGroup({
      title: "物产种类范围",
      key: "productRichnessRange",
      unitHint: "种",
      range: filters.productRichnessRange,
      step: 1,
      placeholder: this.options.valueRanges?.productRichness,
    });
    if (richnessGroup) wrapper.appendChild(richnessGroup);

    const productGroup = this._renderProductGroup(filters.productTypes || []);
    if (productGroup) wrapper.appendChild(productGroup);

    const actions = this._renderActions();
    wrapper.appendChild(actions);

    this.container.appendChild(wrapper);
  }

  setFilters(filters = {}) {
    this._suspend = true;
    const {
      daoIds = [],
      productTypes = [],
      levels = [],
      populationRange = null,
      householdRange = null,
      productRichnessRange = null,
    } = filters;

    this.container
      ?.querySelectorAll('input[data-filter-type="dao"]')
      ?.forEach((input) => {
        input.checked = daoIds.includes(input.value);
      });

    this.container
      ?.querySelectorAll('input[data-filter-type="product"]')
      ?.forEach((input) => {
        input.checked = productTypes.includes(input.value);
      });

    this.container
      ?.querySelectorAll('input[data-filter-type="level"]')
      ?.forEach((input) => {
        input.checked = levels.includes(input.value);
      });

    const setRange = (key, range) => {
      const minInput = this.container?.querySelector(
        `input[data-filter-type="range"][data-filter-key="${key}"][data-bound="min"]`,
      );
      const maxInput = this.container?.querySelector(
        `input[data-filter-type="range"][data-filter-key="${key}"][data-bound="max"]`,
      );

      const min = Array.isArray(range) ? range[0] : null;
      const max = Array.isArray(range) ? range[1] : null;
      if (minInput) minInput.value = Number.isFinite(min) ? `${min}` : "";
      if (maxInput) maxInput.value = Number.isFinite(max) ? `${max}` : "";
    };

    setRange("populationRange", populationRange);
    setRange("householdRange", householdRange);
    setRange("productRichnessRange", productRichnessRange);

    this._suspend = false;
  }

  getFilters() {
    const daoIds = Array.from(
      this.container?.querySelectorAll(
        'input[data-filter-type="dao"]:checked',
      ) || [],
    ).map((input) => input.value);

    const productTypes = Array.from(
      this.container?.querySelectorAll(
        'input[data-filter-type="product"]:checked',
      ) || [],
    ).map((input) => input.value);

    const levels = Array.from(
      this.container?.querySelectorAll(
        'input[data-filter-type="level"]:checked',
      ) || [],
    ).map((input) => input.value);

    const parseNumber = (raw) => {
      const text = `${raw ?? ""}`.trim();
      if (!text) return null;
      const value = Number(text);
      return Number.isFinite(value) ? value : null;
    };

    const readRange = (key) => {
      const minInput = this.container?.querySelector(
        `input[data-filter-type="range"][data-filter-key="${key}"][data-bound="min"]`,
      );
      const maxInput = this.container?.querySelector(
        `input[data-filter-type="range"][data-filter-key="${key}"][data-bound="max"]`,
      );
      const min = parseNumber(minInput?.value);
      const max = parseNumber(maxInput?.value);
      if (min === null && max === null) return null;
      return [min, max];
    };

    const populationRange = readRange("populationRange");
    const householdRange = readRange("householdRange");
    const productRichnessRange = readRange("productRichnessRange");

    return {
      daoIds,
      productTypes,
      levels,
      populationRange,
      householdRange,
      productRichnessRange,
    };
  }

  destroy() {
    this._cleanup();
    if (this.container) {
      this.container.innerHTML = "";
    }
  }

  _renderDaoGroup(selectedDaoIds = []) {
    const { daoOptions = [] } = this.options;
    if (!Array.isArray(daoOptions) || daoOptions.length === 0) return null;

    const group = document.createElement("div");
    group.className = "filter__group";

    const title = document.createElement("div");
    title.className = "filter__label";
    title.textContent = "按道筛选";
    group.appendChild(title);

    const list = document.createElement("div");
    list.className = "filter__options filter__options--dao";

    daoOptions.forEach((option) => {
      const item = document.createElement("label");
      item.className = "filter__option";
      item.title = option.name || option.id;

      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = option.id;
      input.dataset.filterType = "dao";
      input.checked = selectedDaoIds.includes(option.id);
      const colorChip = document.createElement("span");
      colorChip.className = "filter__chip";
      colorChip.style.backgroundColor = getDaoColor(option.id);

      const text = document.createElement("span");
      text.textContent = option.count
        ? `${option.name} (${option.count})`
        : option.name;

      item.appendChild(input);
      item.appendChild(colorChip);
      item.appendChild(text);
      list.appendChild(item);

      const handler = () => this._emitChange();
      input.addEventListener("change", handler);
      this._unsubscribers.push(() =>
        input.removeEventListener("change", handler),
      );
    });

    group.appendChild(list);
    return group;
  }

  _renderProductGroup(selectedTypes = []) {
    const { productTypeOptions = [] } = this.options;
    if (!Array.isArray(productTypeOptions) || productTypeOptions.length === 0)
      return null;

    const group = document.createElement("div");
    group.className = "filter__group";

    const title = document.createElement("div");
    title.className = "filter__label";
    title.textContent = "按物产类别筛选";
    group.appendChild(title);

    const list = document.createElement("div");
    list.className = "filter__options filter__options--product";

    productTypeOptions.forEach((type) => {
      const item = document.createElement("label");
      item.className = "filter__option";
      item.title = type;

      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = type;
      input.dataset.filterType = "product";
      input.checked = selectedTypes.includes(type);

      const chip = document.createElement("span");
      chip.className = "filter__chip";
      chip.style.backgroundColor = getProductTypeColor(type);

      const text = document.createElement("span");
      text.textContent = type;

      item.appendChild(input);
      item.appendChild(chip);
      item.appendChild(text);
      list.appendChild(item);

      const handler = () => this._emitChange();
      input.addEventListener("change", handler);
      this._unsubscribers.push(() =>
        input.removeEventListener("change", handler),
      );
    });

    group.appendChild(list);
    return group;
  }

  _renderLevelGroup(selectedLevels = []) {
    const { levelOptions = [] } = this.options;
    if (!Array.isArray(levelOptions) || levelOptions.length === 0) return null;

    const group = document.createElement("div");
    group.className = "filter__group";

    const title = document.createElement("div");
    title.className = "filter__label";
    title.textContent = "按行政级别筛选";
    group.appendChild(title);

    const list = document.createElement("div");
    list.className = "filter__options filter__options--level";

    levelOptions.forEach((level) => {
      const item = document.createElement("label");
      item.className = "filter__option";
      item.title = level;

      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = level;
      input.dataset.filterType = "level";
      input.checked = selectedLevels.includes(level);

      const chip = document.createElement("span");
      chip.className = "filter__chip";
      chip.style.backgroundColor = getAdministrativeLevelColor(level);

      const text = document.createElement("span");
      text.textContent = level;

      item.appendChild(input);
      item.appendChild(chip);
      item.appendChild(text);
      list.appendChild(item);

      const handler = () => this._emitChange();
      input.addEventListener("change", handler);
      this._unsubscribers.push(() =>
        input.removeEventListener("change", handler),
      );
    });

    group.appendChild(list);
    return group;
  }

  _renderRangeGroup({ title, key, unitHint, range, step, placeholder } = {}) {
    if (!key) return null;

    const group = document.createElement("div");
    group.className = "filter__group";

    const label = document.createElement("div");
    label.className = "filter__label";
    label.textContent = title || key;
    group.appendChild(label);

    const container = document.createElement("div");
    container.className = "filter__range";

    const minInput = document.createElement("input");
    minInput.type = "number";
    minInput.inputMode = "decimal";
    minInput.step = Number.isFinite(step) ? `${step}` : "1";
    minInput.placeholder = Array.isArray(placeholder)
      ? `${placeholder[0] ?? ""}`
      : "最小值";
    minInput.className = "filter__range-input";
    minInput.dataset.filterType = "range";
    minInput.dataset.filterKey = key;
    minInput.dataset.bound = "min";
    minInput.value =
      Array.isArray(range) && Number.isFinite(range[0]) ? `${range[0]}` : "";

    const sep = document.createElement("span");
    sep.className = "filter__range-sep";
    sep.textContent = "—";

    const maxInput = document.createElement("input");
    maxInput.type = "number";
    maxInput.inputMode = "decimal";
    maxInput.step = Number.isFinite(step) ? `${step}` : "1";
    maxInput.placeholder = Array.isArray(placeholder)
      ? `${placeholder[1] ?? ""}`
      : "最大值";
    maxInput.className = "filter__range-input";
    maxInput.dataset.filterType = "range";
    maxInput.dataset.filterKey = key;
    maxInput.dataset.bound = "max";
    maxInput.value =
      Array.isArray(range) && Number.isFinite(range[1]) ? `${range[1]}` : "";

    const unit = document.createElement("span");
    unit.className = "filter__range-unit";
    unit.textContent = unitHint || "";

    const handler = () => this._emitChange();
    minInput.addEventListener("change", handler);
    maxInput.addEventListener("change", handler);
    this._unsubscribers.push(() =>
      minInput.removeEventListener("change", handler),
    );
    this._unsubscribers.push(() =>
      maxInput.removeEventListener("change", handler),
    );

    container.appendChild(minInput);
    container.appendChild(sep);
    container.appendChild(maxInput);
    if (unitHint) container.appendChild(unit);
    group.appendChild(container);
    return group;
  }

  _renderActions() {
    const container = document.createElement("div");
    container.className = "filter__actions";

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "filter__reset";
    resetBtn.textContent = "清空筛选";
    const handler = () => {
      this.setFilters({
        daoIds: [],
        productTypes: [],
        levels: [],
        populationRange: null,
        householdRange: null,
        productRichnessRange: null,
      });
      this._emitChange();
      this.options.onReset?.();
    };
    resetBtn.addEventListener("click", handler);
    this._unsubscribers.push(() =>
      resetBtn.removeEventListener("click", handler),
    );

    container.appendChild(resetBtn);
    return container;
  }

  _emitChange() {
    if (this._suspend) return;
    const filters = this.getFilters();
    this.options.onChange?.(filters);
  }

  _cleanup() {
    this._unsubscribers.forEach((fn) => {
      try {
        fn();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn("[FilterPanel] cleanup listener failed", error);
      }
    });
    this._unsubscribers = [];
  }
}
