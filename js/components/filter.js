// 筛选器组件：按道、物产类别等维度筛选数据。

import { getDaoColor, getProductTypeColor } from '../utils/colors.js';

function resolveContainer(target) {
  if (!target) return null;
  if (typeof target === 'string') {
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
    this.container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'filter';

    const daoGroup = this._renderDaoGroup(filters.daoIds || []);
    if (daoGroup) wrapper.appendChild(daoGroup);

    const productGroup = this._renderProductGroup(filters.productTypes || []);
    if (productGroup) wrapper.appendChild(productGroup);

    const actions = this._renderActions();
    wrapper.appendChild(actions);

    this.container.appendChild(wrapper);
  }

  setFilters(filters = {}) {
    this._suspend = true;
    const { daoIds = [], productTypes = [] } = filters;

    this.container
      ?.querySelectorAll('input[data-filter-type="dao"]')
      ?.forEach(input => {
        input.checked = daoIds.includes(input.value);
      });

    this.container
      ?.querySelectorAll('input[data-filter-type="product"]')
      ?.forEach(input => {
        input.checked = productTypes.includes(input.value);
      });

    this._suspend = false;
  }

  getFilters() {
    const daoIds = Array.from(
      this.container?.querySelectorAll('input[data-filter-type="dao"]:checked') || [],
    ).map(input => input.value);

    const productTypes = Array.from(
      this.container?.querySelectorAll('input[data-filter-type="product"]:checked') || [],
    ).map(input => input.value);

    return { daoIds, productTypes };
  }

  destroy() {
    this._cleanup();
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  _renderDaoGroup(selectedDaoIds = []) {
    const { daoOptions = [] } = this.options;
    if (!Array.isArray(daoOptions) || daoOptions.length === 0) return null;

    const group = document.createElement('div');
    group.className = 'filter__group';

    const title = document.createElement('div');
    title.className = 'filter__label';
    title.textContent = '按道筛选';
    group.appendChild(title);

    const list = document.createElement('div');
    list.className = 'filter__options';

    daoOptions.forEach(option => {
      const item = document.createElement('label');
      item.className = 'filter__option';
      item.title = option.name || option.id;

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = option.id;
      input.dataset.filterType = 'dao';
      input.checked = selectedDaoIds.includes(option.id);
      const colorChip = document.createElement('span');
      colorChip.className = 'filter__chip';
      colorChip.style.backgroundColor = getDaoColor(option.id);

      const text = document.createElement('span');
      text.textContent = option.count ? `${option.name} (${option.count})` : option.name;

      item.appendChild(input);
      item.appendChild(colorChip);
      item.appendChild(text);
      list.appendChild(item);

      const handler = () => this._emitChange();
      input.addEventListener('change', handler);
      this._unsubscribers.push(() => input.removeEventListener('change', handler));
    });

    group.appendChild(list);
    return group;
  }

  _renderProductGroup(selectedTypes = []) {
    const { productTypeOptions = [] } = this.options;
    if (!Array.isArray(productTypeOptions) || productTypeOptions.length === 0) return null;

    const group = document.createElement('div');
    group.className = 'filter__group';

    const title = document.createElement('div');
    title.className = 'filter__label';
    title.textContent = '按物产类别筛选';
    group.appendChild(title);

    const list = document.createElement('div');
    list.className = 'filter__options';

    productTypeOptions.forEach(type => {
      const item = document.createElement('label');
      item.className = 'filter__option';
      item.title = type;

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = type;
      input.dataset.filterType = 'product';
      input.checked = selectedTypes.includes(type);

      const chip = document.createElement('span');
      chip.className = 'filter__chip';
      chip.style.backgroundColor = getProductTypeColor(type);

      const text = document.createElement('span');
      text.textContent = type;

      item.appendChild(input);
      item.appendChild(chip);
      item.appendChild(text);
      list.appendChild(item);

      const handler = () => this._emitChange();
      input.addEventListener('change', handler);
      this._unsubscribers.push(() => input.removeEventListener('change', handler));
    });

    group.appendChild(list);
    return group;
  }

  _renderActions() {
    const container = document.createElement('div');
    container.className = 'filter__actions';

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'filter__reset';
    resetBtn.textContent = '清空筛选';
    const handler = () => {
      this.setFilters({ daoIds: [], productTypes: [] });
      this._emitChange();
      this.options.onReset?.();
    };
    resetBtn.addEventListener('click', handler);
    this._unsubscribers.push(() => resetBtn.removeEventListener('click', handler));

    container.appendChild(resetBtn);
    return container;
  }

  _emitChange() {
    if (this._suspend) return;
    const filters = this.getFilters();
    this.options.onChange?.(filters);
  }

  _cleanup() {
    this._unsubscribers.forEach(fn => {
      try {
        fn();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('[FilterPanel] cleanup listener failed', error);
      }
    });
    this._unsubscribers = [];
  }
}
