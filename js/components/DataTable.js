/**
 * 数据表组件：可排序的州府数据表
 */

import { getDaoColor } from "../utils/colors.js";
import {
  formatPopulation,
  formatHouseholds,
  formatHouseholdSize,
  Format,
} from "../utils/format.js";
import eventBus, { EVENTS } from "../utils/eventBus.js";

function resolveContainer(target) {
  if (!target) return null;
  if (typeof target === "string") {
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
    this.sortCriteria = [{ key: "Location_Name", order: "asc" }];
    this.sortKey = "Location_Name";
    this.sortOrder = "asc";
    this.searchTerm = "";
    this.currentPage = 1;
    this.selectedIds = [];
    this.highlightIds = [];
    this._lastSelectedIndex = null;
    this._selectAllCheckbox = null;
    this._selectAllBtn = null;
    this._clearBtn = null;
    this._resetSortBtn = null;

    this._columns = [
      { key: "Location_Name", label: "地名", type: "name" },
      { key: "daoName", label: "所属道", type: "dao" },
      { key: "Administrative_Level", label: "级别", type: "text" },
      {
        key: "Population",
        label: "人口",
        type: "number",
        format: formatPopulation,
      },
      {
        key: "Households",
        label: "户数",
        type: "number",
        format: formatHouseholds,
      },
      {
        key: "householdSize",
        label: "户均人口",
        type: "number",
        format: formatHouseholdSize,
      },
      {
        key: "productRichness",
        label: "物产种类",
        type: "number",
        format: (v) => Format.number(v, { fallback: "-" }),
      },
    ];
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "datatable-container";

    // 工具栏
    const toolbar = this._renderToolbar();
    wrapper.appendChild(toolbar);

    // 表格
    const tableWrapper = document.createElement("div");
    tableWrapper.className = "datatable__wrapper";
    this._tableBody = document.createElement("tbody");
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
    this.data = data.filter((d) => d.Administrative_Level !== "道");
    this.currentPage = 1;
    this._applyFilters();
    this._updateTable();
    this._updatePagination();
  }

  _renderToolbar() {
    const toolbar = document.createElement("div");
    toolbar.className = "datatable__toolbar";

    // 搜索框
    const searchBox = document.createElement("div");
    searchBox.className = "datatable__search";

    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.className = "datatable__search-input";
    searchInput.placeholder = "搜索地名...";
    searchInput.addEventListener("input", (e) => {
      this.searchTerm = e.target.value.trim();
      this.currentPage = 1;
      this._applyFilters();
      this._updateTable();
      this._updatePagination();
    });

    searchBox.appendChild(searchInput);
    toolbar.appendChild(searchBox);

    // 信息
    this._infoEl = document.createElement("div");
    this._infoEl.className = "datatable__info";
    toolbar.appendChild(this._infoEl);

    // 选择控制
    const selection = document.createElement("div");
    selection.className = "datatable__selection";

    this._selectAllBtn = document.createElement("button");
    this._selectAllBtn.type = "button";
    this._selectAllBtn.className = "datatable__selection-btn";
    this._selectAllBtn.textContent = "全选";
    this._selectAllBtn.addEventListener("click", () => {
      const ids = (this.filteredData || []).map((item) => item.Location_ID);
      this._setSelection(ids);
    });

    this._clearBtn = document.createElement("button");
    this._clearBtn.type = "button";
    this._clearBtn.className = "datatable__selection-btn";
    this._clearBtn.textContent = "清空";
    this._clearBtn.addEventListener("click", () => {
      this._setSelection([]);
    });

    this._resetSortBtn = document.createElement("button");
    this._resetSortBtn.type = "button";
    this._resetSortBtn.className = "datatable__selection-btn";
    this._resetSortBtn.textContent = "重置排序";
    this._resetSortBtn.title = "Shift+点击表头可添加第二排序；空值始终排在最后";
    this._resetSortBtn.addEventListener("click", () => {
      this._resetSort();
    });

    selection.appendChild(this._selectAllBtn);
    selection.appendChild(this._clearBtn);
    selection.appendChild(this._resetSortBtn);
    toolbar.appendChild(selection);

    return toolbar;
  }

  _renderTable() {
    const table = document.createElement("table");
    table.className = "datatable__table";

    // 表头
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    const selectTh = document.createElement("th");
    selectTh.className = "datatable__select-col";
    selectTh.setAttribute("aria-label", "选择");

    this._selectAllCheckbox = document.createElement("input");
    this._selectAllCheckbox.type = "checkbox";
    this._selectAllCheckbox.className = "datatable__checkbox";
    this._selectAllCheckbox.title = "全选/清空";
    this._selectAllCheckbox.addEventListener("click", (event) => {
      event.stopPropagation();
      if (this._selectAllCheckbox.checked) {
        const ids = (this.filteredData || []).map((item) => item.Location_ID);
        this._setSelection(ids);
        return;
      }
      this._setSelection([]);
    });
    selectTh.appendChild(this._selectAllCheckbox);
    headerRow.appendChild(selectTh);

    this._columns.forEach((col) => {
      const th = document.createElement("th");
      th.dataset.key = col.key;
      th.innerHTML = `
	        ${col.label}
	        <span class="datatable__sort-icon">${this._getSortIndicator(col.key)}</span>
	      `;

      if (this._isSorted(col.key)) {
        th.classList.add("is-sorted");
      }

      th.addEventListener("click", (event) => this._handleSort(col.key, event));
      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);
    table.appendChild(this._tableBody);

    return table;
  }

  _renderPagination() {
    const pagination = document.createElement("div");
    pagination.className = "datatable__pagination";

    this._pageInfoEl = document.createElement("div");
    this._pageInfoEl.className = "datatable__page-info";

    const controls = document.createElement("div");
    controls.className = "datatable__page-controls";

    this._prevBtn = document.createElement("button");
    this._prevBtn.className = "datatable__page-btn";
    this._prevBtn.textContent = "‹";
    this._prevBtn.addEventListener("click", () =>
      this._goToPage(this.currentPage - 1),
    );

    this._nextBtn = document.createElement("button");
    this._nextBtn.className = "datatable__page-btn";
    this._nextBtn.textContent = "›";
    this._nextBtn.addEventListener("click", () =>
      this._goToPage(this.currentPage + 1),
    );

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
      result = result.filter(
        (d) =>
          d.Location_Name?.toLowerCase().includes(term) ||
          d.daoName?.toLowerCase().includes(term),
      );
    }

    // 排序（稳定 + 支持多列；空值始终排在最后）
    const criteria =
      Array.isArray(this.sortCriteria) && this.sortCriteria.length > 0
        ? this.sortCriteria
        : [{ key: this.sortKey, order: this.sortOrder }];

    const withIndex = result.map((item, index) => ({ item, index }));
    withIndex.sort((left, right) => {
      for (const entry of criteria) {
        const key = entry?.key;
        if (!key) continue;
        const order = entry?.order === "desc" ? "desc" : "asc";
        const type = this._getColumnType(key);
        const cmp = this._compareValues(left.item?.[key], right.item?.[key], {
          order,
          type,
        });
        if (cmp !== 0) return cmp;
      }
      return left.index - right.index;
    });
    result = withIndex.map((entry) => entry.item);

    this.filteredData = result;
  }

  _updateTable() {
    if (!this._tableBody) return;

    const { pageSize } = this.options;
    const start = (this.currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageData = this.filteredData.slice(start, end);

    this._tableBody.innerHTML = "";

    if (pageData.length === 0) {
      const emptyRow = document.createElement("tr");
      const emptyCell = document.createElement("td");
      emptyCell.colSpan = this._columns.length + 1;
      emptyCell.className = "datatable__empty";
      emptyCell.textContent = this.searchTerm ? "未找到匹配的地点" : "暂无数据";
      emptyRow.appendChild(emptyCell);
      this._tableBody.appendChild(emptyRow);
      return;
    }

    const highlightSet = new Set(this.highlightIds || []);

    pageData.forEach((item, index) => {
      const globalIndex = start + index;
      const row = document.createElement("tr");
      row.dataset.id = item.Location_ID;

      if (this.selectedIds.includes(item.Location_ID)) {
        row.classList.add("is-selected");
      }
      if (highlightSet.has(item.Location_ID)) {
        row.classList.add("is-highlighted");
      }

      row.addEventListener("click", (event) =>
        this._handleRowClick(item, event, globalIndex),
      );

      const selectCell = document.createElement("td");
      selectCell.className = "datatable__select-cell";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "datatable__checkbox";
      checkbox.checked = this.selectedIds.includes(item.Location_ID);
      checkbox.addEventListener("click", (event) => {
        event.stopPropagation();
        this._handleCheckboxClick(item, event, globalIndex);
      });
      selectCell.appendChild(checkbox);
      row.appendChild(selectCell);

      this._columns.forEach((col) => {
        const td = document.createElement("td");
        const value = item[col.key];

        if (col.type === "number") {
          td.classList.add("is-numeric");
          td.textContent = col.format ? col.format(value) : (value ?? "-");
        } else if (col.type === "name") {
          td.classList.add("is-name");
          td.textContent = value || "-";
        } else if (col.type === "dao") {
          if (value) {
            const tag = document.createElement("span");
            tag.className = "datatable__dao-tag";
            tag.style.backgroundColor = getDaoColor(
              item.Parent_ID || item.Location_ID,
            );
            tag.textContent = value;
            td.appendChild(tag);
          } else {
            td.textContent = "-";
          }
        } else {
          td.textContent = value || "-";
        }

        row.appendChild(td);
      });

      this._tableBody.appendChild(row);
    });

    // 更新信息
    if (this._infoEl) {
      const selected = this.selectedIds?.length
        ? ` · 已选 ${this.selectedIds.length}`
        : "";
      this._infoEl.textContent = `共 ${this.filteredData.length} 条记录${selected}`;
    }

    this._updateSelectAllState();
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
        this._pageInfoEl.textContent = "";
      }
    }

    if (this._prevBtn) {
      this._prevBtn.disabled = this.currentPage <= 1;
    }
    if (this._nextBtn) {
      this._nextBtn.disabled = this.currentPage >= totalPages;
    }
  }

  _handleSort(key, event) {
    const isMulti = Boolean(event?.shiftKey);
    const next = this._nextSortCriteria(key, { isMulti });
    this.sortCriteria = next;

    const primary = next[0] || { key: "Location_Name", order: "asc" };
    this.sortKey = primary.key;
    this.sortOrder = primary.order;

    this.currentPage = 1;
    this._applyFilters();
    this._updateTable();
    this._updatePagination();
    this._updateSortIndicators();
  }

  _resetSort() {
    this.sortCriteria = [{ key: "Location_Name", order: "asc" }];
    this.sortKey = "Location_Name";
    this.sortOrder = "asc";
    this.currentPage = 1;
    this._applyFilters();
    this._updateTable();
    this._updatePagination();
    this._updateSortIndicators();
  }

  _nextSortCriteria(key, { isMulti } = {}) {
    const current = Array.isArray(this.sortCriteria) ? this.sortCriteria : [];
    const normalized = current
      .filter((entry) => entry && typeof entry.key === "string" && entry.key)
      .map((entry) => ({
        key: entry.key,
        order: entry.order === "desc" ? "desc" : "asc",
      }));

    const existingIndex = normalized.findIndex((entry) => entry.key === key);

    if (!isMulti) {
      if (existingIndex === 0) {
        const currentOrder = normalized[0].order;
        return [{ key, order: currentOrder === "asc" ? "desc" : "asc" }];
      }
      return [{ key, order: "asc" }];
    }

    const next = [...normalized];
    if (existingIndex >= 0) {
      const currentOrder = next[existingIndex].order;
      next[existingIndex] = {
        key,
        order: currentOrder === "asc" ? "desc" : "asc",
      };
    } else {
      next.push({ key, order: "asc" });
    }

    return next.slice(0, 3);
  }

  _getSortIndicator(key) {
    const index = Array.isArray(this.sortCriteria)
      ? this.sortCriteria.findIndex((entry) => entry?.key === key)
      : -1;
    if (index < 0) return "▽";
    const order = this.sortCriteria[index]?.order === "desc" ? "desc" : "asc";
    return `${order === "asc" ? "▲" : "▼"}${index + 1}`;
  }

  _isSorted(key) {
    return (
      Array.isArray(this.sortCriteria) &&
      this.sortCriteria.some((entry) => entry?.key === key)
    );
  }

  _getColumnType(key) {
    const col = (this._columns || []).find((entry) => entry.key === key);
    return col?.type || "text";
  }

  _compareValues(aVal, bVal, { order, type } = {}) {
    const dir = order === "desc" ? -1 : 1;
    const aMissing =
      aVal == null || (typeof aVal === "number" && !Number.isFinite(aVal));
    const bMissing =
      bVal == null || (typeof bVal === "number" && !Number.isFinite(bVal));

    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;
    if (bMissing) return -1;

    if (type === "number") {
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      if (!Number.isFinite(aNum) && !Number.isFinite(bNum)) return 0;
      if (!Number.isFinite(aNum)) return 1;
      if (!Number.isFinite(bNum)) return -1;
      if (aNum === bNum) return 0;
      return (aNum < bNum ? -1 : 1) * dir;
    }

    const aStr = `${aVal}`.toLowerCase();
    const bStr = `${bVal}`.toLowerCase();
    const cmp = aStr.localeCompare(bStr, "zh-CN");
    if (cmp === 0) return 0;
    return cmp * dir;
  }

  _updateSortIndicators() {
    const ths = this.container?.querySelectorAll(
      ".datatable__table th[data-key]",
    );
    ths?.forEach((th) => {
      const key = th.dataset.key;
      const icon = th.querySelector(".datatable__sort-icon");
      const index = Array.isArray(this.sortCriteria)
        ? this.sortCriteria.findIndex((entry) => entry?.key === key)
        : -1;

      if (index >= 0) {
        th.classList.add("is-sorted");
        const order =
          this.sortCriteria[index]?.order === "desc" ? "desc" : "asc";
        if (icon)
          icon.textContent = `${order === "asc" ? "▲" : "▼"}${index + 1}`;
        return;
      }

      th.classList.remove("is-sorted");
      if (icon) icon.textContent = "▽";
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

  _handleRowClick(item, event, globalIndex) {
    const append = Boolean(event?.metaKey || event?.ctrlKey);
    const range = Boolean(event?.shiftKey);
    const id = item.Location_ID;

    let nextSelected = [];

    if (range && Number.isInteger(this._lastSelectedIndex)) {
      const start = Math.min(this._lastSelectedIndex, globalIndex);
      const end = Math.max(this._lastSelectedIndex, globalIndex);
      const rangeIds = (this.filteredData || [])
        .slice(start, end + 1)
        .map((row) => row.Location_ID);
      nextSelected = append
        ? [...new Set([...(this.selectedIds || []), ...rangeIds])]
        : rangeIds;
    } else if (append) {
      if (this.selectedIds.includes(id)) {
        nextSelected = this.selectedIds.filter((value) => value !== id);
      } else {
        nextSelected = [...this.selectedIds, id];
      }
    } else {
      nextSelected = [id];
    }

    this._lastSelectedIndex = globalIndex;
    this._setSelection(nextSelected);
  }

  _handleCheckboxClick(item, event, globalIndex) {
    const range = Boolean(event?.shiftKey);
    const id = item.Location_ID;
    let nextSelected = [];

    if (range && Number.isInteger(this._lastSelectedIndex)) {
      const start = Math.min(this._lastSelectedIndex, globalIndex);
      const end = Math.max(this._lastSelectedIndex, globalIndex);
      const rangeIds = (this.filteredData || [])
        .slice(start, end + 1)
        .map((row) => row.Location_ID);
      nextSelected = [...new Set([...(this.selectedIds || []), ...rangeIds])];
    } else if ((this.selectedIds || []).includes(id)) {
      nextSelected = (this.selectedIds || []).filter((value) => value !== id);
    } else {
      nextSelected = [...(this.selectedIds || []), id];
    }

    this._lastSelectedIndex = globalIndex;
    this._setSelection(nextSelected);
  }

  _setSelection(ids = [], { emit } = {}) {
    const unique = Array.isArray(ids) ? Array.from(new Set(ids)) : [];
    this.selectedIds = unique;
    this._syncRowStyles();
    if (emit === false) return;
    eventBus.emit(
      EVENTS.LOCATION_SELECT,
      unique.length ? { ids: unique } : null,
    );
  }

  _syncRowStyles() {
    if (!this._tableBody) return;
    const selectedSet = new Set(this.selectedIds || []);
    const highlightSet = new Set(this.highlightIds || []);

    this._tableBody.querySelectorAll("tr").forEach((row) => {
      const rowId = row.dataset.id;
      if (!rowId) return;
      row.classList.toggle("is-selected", selectedSet.has(rowId));
      row.classList.toggle("is-highlighted", highlightSet.has(rowId));
      const checkbox = row.querySelector("input.datatable__checkbox");
      if (checkbox) checkbox.checked = selectedSet.has(rowId);
    });

    if (this._infoEl) {
      const selected = this.selectedIds?.length
        ? ` · 已选 ${this.selectedIds.length}`
        : "";
      this._infoEl.textContent = `共 ${this.filteredData.length} 条记录${selected}`;
    }

    this._updateSelectAllState();
  }

  _updateSelectAllState() {
    if (!this._selectAllCheckbox) return;
    const total = this.filteredData?.length || 0;
    const selectedCount = this.selectedIds?.length || 0;
    if (total === 0) {
      this._selectAllCheckbox.checked = false;
      this._selectAllCheckbox.indeterminate = false;
      return;
    }

    if (selectedCount === 0) {
      this._selectAllCheckbox.checked = false;
      this._selectAllCheckbox.indeterminate = false;
      return;
    }

    const visibleIds = new Set(
      (this.filteredData || []).map((item) => item.Location_ID),
    );
    const visibleSelected = (this.selectedIds || []).filter((id) =>
      visibleIds.has(id),
    );
    this._selectAllCheckbox.checked =
      visibleSelected.length === visibleIds.size;
    this._selectAllCheckbox.indeterminate =
      visibleSelected.length > 0 && visibleSelected.length < visibleIds.size;
  }

  setSelection(ids = []) {
    this._setSelection(ids, { emit: false });
  }

  highlight(ids = []) {
    this.highlightIds = ids || [];
    this._syncRowStyles();
  }

  destroy() {
    if (this.container) {
      this.container.innerHTML = "";
    }
  }
}

export default DataTable;
