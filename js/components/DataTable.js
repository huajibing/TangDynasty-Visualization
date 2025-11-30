/**
 * 数据表组件：可排序的州府数据表
 */

import { getDaoColor } from '../utils/colors.js';
import { formatPopulation, formatHouseholds, formatHouseholdSize, Format } from '../utils/format.js';
import eventBus, { EVENTS } from '../utils/eventBus.js';

function resolveContainer(target) {
  if (!target) return null;
  if (typeof target === 'string') {
    return document.querySelector(target);
  }
  return target;
}

export class DataTable {
  constructor(container, options = {}) {
    this.container = resolveContainer(container);
    this.options = {
      pageSize: 50,
      ...options,
    };

    this.data = [];
    this.filteredData = [];
    this.sortKey = 'Location_Name';
    this.sortOrder = 'asc';
    this.searchTerm = '';
    this.currentPage = 1;
    this.selectedIds = [];

    this._columns = [
      { key: 'Location_Name', label: '地名', type: 'name' },
      { key: 'daoName', label: '所属道', type: 'dao' },
      { key: 'Administrative_Level', label: '级别', type: 'text' },
      { key: 'Population', label: '人口', type: 'number', format: formatPopulation },
      { key: 'Households', label: '户数', type: 'number', format: formatHouseholds },
      { key: 'householdSize', label: '户均人口', type: 'number', format: formatHouseholdSize },
      { key: 'productRichness', label: '物产种类', type: 'number', format: (v) => Format.number(v, { fallback: '-' }) },
    ];
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'datatable-container';

    // 工具栏
    const toolbar = this._renderToolbar();
    wrapper.appendChild(toolbar);

    // 表格
    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'datatable__wrapper';
    this._tableBody = document.createElement('tbody');
    const table = this._renderTable();
    tableWrapper.appendChild(table);
    wrapper.appendChild(tableWrapper);

    // 分页
    this._paginationEl = this._renderPagination();
    wrapper.appendChild(this._paginationEl);

    this.container.appendChild(wrapper);
    this._updateTable();
  }

  update(data = []) {
    this.data = data.filter((d) => d.Administrative_Level !== '道');
    this.currentPage = 1;
    this._applyFilters();
    this._updateTable();
    this._updatePagination();
  }

  _renderToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'datatable__toolbar';

    // 搜索框
    const searchBox = document.createElement('div');
    searchBox.className = 'datatable__search';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'datatable__search-input';
    searchInput.placeholder = '搜索地名...';
    searchInput.addEventListener('input', (e) => {
      this.searchTerm = e.target.value.trim();
      this.currentPage = 1;
      this._applyFilters();
      this._updateTable();
      this._updatePagination();
    });

    searchBox.appendChild(searchInput);
    toolbar.appendChild(searchBox);

    // 信息
    this._infoEl = document.createElement('div');
    this._infoEl.className = 'datatable__info';
    toolbar.appendChild(this._infoEl);

    return toolbar;
  }

  _renderTable() {
    const table = document.createElement('table');
    table.className = 'datatable__table';

    // 表头
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    this._columns.forEach((col) => {
      const th = document.createElement('th');
      th.dataset.key = col.key;
      th.innerHTML = `
        ${col.label}
        <span class="datatable__sort-icon">${this.sortKey === col.key ? (this.sortOrder === 'asc' ? '▲' : '▼') : '▽'}</span>
      `;

      if (this.sortKey === col.key) {
        th.classList.add('is-sorted');
      }

      th.addEventListener('click', () => this._handleSort(col.key));
      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);
    table.appendChild(this._tableBody);

    return table;
  }

  _renderPagination() {
    const pagination = document.createElement('div');
    pagination.className = 'datatable__pagination';

    this._pageInfoEl = document.createElement('div');
    this._pageInfoEl.className = 'datatable__page-info';

    const controls = document.createElement('div');
    controls.className = 'datatable__page-controls';

    this._prevBtn = document.createElement('button');
    this._prevBtn.className = 'datatable__page-btn';
    this._prevBtn.textContent = '‹';
    this._prevBtn.addEventListener('click', () => this._goToPage(this.currentPage - 1));

    this._nextBtn = document.createElement('button');
    this._nextBtn.className = 'datatable__page-btn';
    this._nextBtn.textContent = '›';
    this._nextBtn.addEventListener('click', () => this._goToPage(this.currentPage + 1));

    controls.appendChild(this._prevBtn);
    controls.appendChild(this._nextBtn);

    pagination.appendChild(this._pageInfoEl);
    pagination.appendChild(controls);

    return pagination;
  }

  _applyFilters() {
    let result = [...this.data];

    // 搜索过滤
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter((d) =>
        d.Location_Name?.toLowerCase().includes(term) ||
        d.daoName?.toLowerCase().includes(term)
      );
    }

    // 排序
    result.sort((a, b) => {
      let aVal = a[this.sortKey];
      let bVal = b[this.sortKey];

      // 处理空值
      if (aVal == null) aVal = this.sortOrder === 'asc' ? Infinity : -Infinity;
      if (bVal == null) bVal = this.sortOrder === 'asc' ? Infinity : -Infinity;

      // 字符串比较
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal || '').toLowerCase();
        return this.sortOrder === 'asc'
          ? aVal.localeCompare(bVal, 'zh-CN')
          : bVal.localeCompare(aVal, 'zh-CN');
      }

      // 数值比较
      return this.sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    this.filteredData = result;
  }

  _updateTable() {
    if (!this._tableBody) return;

    const { pageSize } = this.options;
    const start = (this.currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageData = this.filteredData.slice(start, end);

    this._tableBody.innerHTML = '';

    if (pageData.length === 0) {
      const emptyRow = document.createElement('tr');
      const emptyCell = document.createElement('td');
      emptyCell.colSpan = this._columns.length;
      emptyCell.className = 'datatable__empty';
      emptyCell.textContent = this.searchTerm ? '未找到匹配的地点' : '暂无数据';
      emptyRow.appendChild(emptyCell);
      this._tableBody.appendChild(emptyRow);
      return;
    }

    pageData.forEach((item) => {
      const row = document.createElement('tr');
      row.dataset.id = item.Location_ID;

      if (this.selectedIds.includes(item.Location_ID)) {
        row.classList.add('is-selected');
      }

      row.addEventListener('click', (event) => this._handleRowClick(item, event));

      this._columns.forEach((col) => {
        const td = document.createElement('td');
        const value = item[col.key];

        if (col.type === 'number') {
          td.classList.add('is-numeric');
          td.textContent = col.format ? col.format(value) : (value ?? '-');
        } else if (col.type === 'name') {
          td.classList.add('is-name');
          td.textContent = value || '-';
        } else if (col.type === 'dao') {
          if (value) {
            const tag = document.createElement('span');
            tag.className = 'datatable__dao-tag';
            tag.style.backgroundColor = getDaoColor(item.Parent_ID || item.Location_ID);
            tag.textContent = value;
            td.appendChild(tag);
          } else {
            td.textContent = '-';
          }
        } else {
          td.textContent = value || '-';
        }

        row.appendChild(td);
      });

      this._tableBody.appendChild(row);
    });

    // 更新信息
    if (this._infoEl) {
      this._infoEl.textContent = `共 ${this.filteredData.length} 条记录`;
    }
  }

  _updatePagination() {
    const { pageSize } = this.options;
    const totalPages = Math.ceil(this.filteredData.length / pageSize);
    const start = (this.currentPage - 1) * pageSize + 1;
    const end = Math.min(this.currentPage * pageSize, this.filteredData.length);

    if (this._pageInfoEl) {
      if (this.filteredData.length > 0) {
        this._pageInfoEl.textContent = `第 ${start}-${end} 条，共 ${this.filteredData.length} 条`;
      } else {
        this._pageInfoEl.textContent = '';
      }
    }

    if (this._prevBtn) {
      this._prevBtn.disabled = this.currentPage <= 1;
    }
    if (this._nextBtn) {
      this._nextBtn.disabled = this.currentPage >= totalPages;
    }
  }

  _handleSort(key) {
    if (this.sortKey === key) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortOrder = 'asc';
    }

    this.currentPage = 1;
    this._applyFilters();
    this._updateTable();
    this._updatePagination();
    this._updateSortIndicators();
  }

  _updateSortIndicators() {
    const ths = this.container?.querySelectorAll('.datatable__table th');
    ths?.forEach((th) => {
      const key = th.dataset.key;
      const icon = th.querySelector('.datatable__sort-icon');
      if (key === this.sortKey) {
        th.classList.add('is-sorted');
        if (icon) icon.textContent = this.sortOrder === 'asc' ? '▲' : '▼';
      } else {
        th.classList.remove('is-sorted');
        if (icon) icon.textContent = '▽';
      }
    });
  }

  _goToPage(page) {
    const { pageSize } = this.options;
    const totalPages = Math.ceil(this.filteredData.length / pageSize);

    if (page < 1 || page > totalPages) return;

    this.currentPage = page;
    this._updateTable();
    this._updatePagination();
  }

  _handleRowClick(item, event) {
    const append = Boolean(event?.metaKey || event?.ctrlKey);
    const id = item.Location_ID;

    if (append) {
      if (this.selectedIds.includes(id)) {
        this.selectedIds = this.selectedIds.filter((value) => value !== id);
      } else {
        this.selectedIds = [...this.selectedIds, id].slice(-2);
      }
    } else {
      this.selectedIds = [id];
    }

    // 更新选中状态
    this._tableBody?.querySelectorAll('tr').forEach((row) => {
      row.classList.toggle('is-selected', this.selectedIds.includes(row.dataset.id));
    });

    // 发送事件
    eventBus.emit(EVENTS.LOCATION_SELECT, { location: item, append });
  }

  highlight(ids = []) {
    this.selectedIds = ids || [];
    this._tableBody?.querySelectorAll('tr').forEach((row) => {
      row.classList.toggle('is-selected', this.selectedIds.includes(row.dataset.id));
    });
  }

  destroy() {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

export default DataTable;
