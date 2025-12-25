// 道 × 物产类别堆叠条形图：对比各道的物产结构，支持 hover 高亮与点击筛选。

import BaseChart from "./BaseChart.js";
import { Tooltip } from "../components/tooltip.js";
import { getProductTypeColor, PRODUCT_TYPE_KEYS } from "../utils/colors.js";
import { Format } from "../utils/format.js";

class DaoProductStackedChart extends BaseChart {
  get defaultOptions() {
    const base = super.defaultOptions;
    return {
      ...base,
      margin: {
        ...base.margin,
        left: 96,
        right: 16,
        bottom: 44,
        top: 16,
      },
      productTypes: PRODUCT_TYPE_KEYS,
      mode: "count", // count | share
      onHover: null,
      onClick: null,
    };
  }

  _setupScales() {
    this._prepareData();

    if (!this.rows || this.rows.length === 0) {
      this.xScale = d3.scaleLinear().domain([0, 1]).range([0, this.width]);
      this.yScale = d3.scaleBand().domain([]).range([0, this.height]);
      return;
    }

    const xMax =
      this.options.mode === "share"
        ? 1
        : d3.max(this.rows, (row) => row.totalCount) || 1;

    this.xScale = d3
      .scaleLinear()
      .domain([0, xMax])
      .range([0, this.width])
      .nice();
    this.yScale = d3
      .scaleBand()
      .domain(this.rows.map((row) => row.daoName))
      .range([0, this.height])
      .padding(0.18);
  }

  render() {
    this.chartGroup.selectAll(".chart__empty").remove();
    if (!this.rows || this.rows.length === 0) {
      this.chartGroup
        .selectAll(".chart__empty")
        .data([null])
        .join("text")
        .attr("class", "chart__empty")
        .attr("x", this.width / 2)
        .attr("y", this.height / 2)
        .attr("text-anchor", "middle")
        .text("暂无物产数据");
      return;
    }

    this._renderAxes();
    this._renderStacks();
  }

  _renderAxes() {
    const xAxis = d3.axisBottom(this.xScale).ticks(5);
    const yAxis = d3.axisLeft(this.yScale);
    const bottomOffset = (this.options.margin?.bottom ?? 32) - 6;

    this.chartGroup
      .selectAll(".x-axis")
      .data([null])
      .join("g")
      .attr("class", "axis x-axis")
      .attr("transform", `translate(0,${this.height})`)
      .call(xAxis);

    this.chartGroup
      .selectAll(".y-axis")
      .data([null])
      .join("g")
      .attr("class", "axis y-axis")
      .call(yAxis);

    this.chartGroup
      .selectAll(".x-label")
      .data([null])
      .join("text")
      .attr("class", "axis-label x-label")
      .attr("x", this.width / 2)
      .attr("y", this.height + bottomOffset)
      .attr("text-anchor", "middle")
      .text(this.options.mode === "share" ? "物产结构占比" : "物产条目数");
  }

  _renderStacks() {
    const series = this.chartGroup
      .selectAll(".stack-series")
      .data(this.stackData, (stack) => stack.key)
      .join("g")
      .attr("class", "stack-series")
      .attr("fill", (stack) => getProductTypeColor(stack.key));

    const segments = series
      .selectAll(".stack-segment")
      .data(
        (stack) =>
          stack.map((segment) => {
            segment.__seriesKey = stack.key;
            return segment;
          }),
        (segment) => `${segment.data.daoId}-${segment.__seriesKey}`,
      )
      .join("rect")
      .attr("class", "stack-segment")
      .attr("x", (d) => this.xScale(d[0]))
      .attr("y", (d) => this.yScale(d.data.daoName))
      .attr("width", (d) =>
        Math.max(1.5, this.xScale(d[1]) - this.xScale(d[0])),
      )
      .attr("height", this.yScale.bandwidth())
      .attr("opacity", 0.92)
      .on("mouseenter", (event, d) => {
        const seriesKey = d.__seriesKey;
        const ids = this._getSegmentIds(d.data.daoId, seriesKey);
        d3.select(event.currentTarget).classed("is-hovered", true);
        this.options.onHover?.({
          ids,
          daoId: d.data.daoId,
          daoName: d.data.daoName,
          productType: seriesKey,
        });
        Tooltip.show(event, this._formatTooltip(d, seriesKey, ids.length));
      })
      .on("mouseleave", (event) => {
        d3.select(event.currentTarget).classed("is-hovered", false);
        Tooltip.hide();
        this.options.onHover?.(null);
      })
      .on("click", (event, d) => {
        const seriesKey = d.__seriesKey;
        const ids = this._getSegmentIds(d.data.daoId, seriesKey);
        this.options.onClick?.({
          ids,
          daoId: d.data.daoId,
          daoName: d.data.daoName,
          productType: seriesKey,
          originalEvent: event,
        });
      });

    this.segments = segments;
  }

  highlight(ids = []) {
    if (!this.segments) return;
    const idSet = new Set(ids || []);
    const hasIds = idSet.size > 0;

    this.segments
      .classed("is-highlighted", (d) => {
        if (!hasIds) return false;
        const segIds = this._getSegmentIds(d.data.daoId, d.__seriesKey);
        return segIds.some((id) => idSet.has(id));
      })
      .classed("is-dimmed", (d) => {
        if (!hasIds) return false;
        const segIds = this._getSegmentIds(d.data.daoId, d.__seriesKey);
        return !segIds.some((id) => idSet.has(id));
      });
  }

  clearHighlight() {
    this.segments?.classed("is-highlighted", false).classed("is-dimmed", false);
  }

  _prepareData() {
    const productTypes =
      this.options.productTypes && this.options.productTypes.length > 0
        ? this.options.productTypes
        : PRODUCT_TYPE_KEYS;

    const daoMap = new Map();
    (this.data || []).forEach((item) => {
      const daoId = this._getDaoId(item);
      if (!daoId) return;
      const daoName = item.daoName || daoId;
      const entry = daoMap.get(daoId) || {
        daoId,
        daoName,
        totals: this._emptyTotals(productTypes),
        segmentIds: new Map(),
        totalCount: 0,
      };

      productTypes.forEach((type) => {
        const count = Array.isArray(item?.Products?.[type])
          ? item.Products[type].length
          : 0;
        if (count > 0) {
          entry.totals[type] = (entry.totals[type] || 0) + count;
          const key = `${daoId}|${type}`;
          const ids = entry.segmentIds.get(key) || new Set();
          ids.add(item.Location_ID);
          entry.segmentIds.set(key, ids);
          entry.totalCount += count;
        }
      });

      daoMap.set(daoId, entry);
    });

    const rows = Array.from(daoMap.values())
      .filter((row) => row.totalCount > 0)
      .sort((a, b) => b.totalCount - a.totalCount);

    this.segmentIndex = new Map();
    rows.forEach((row) => {
      row.segmentIds.forEach((set, key) => {
        this.segmentIndex.set(key, Array.from(set));
      });
    });

    this.rows = rows.map((row) => {
      const normalized = {
        daoId: row.daoId,
        daoName: row.daoName,
        totalCount: row.totalCount,
      };
      normalized.rawTotals = { ...row.totals };
      productTypes.forEach((type) => {
        const count = row.totals[type] || 0;
        normalized[type] =
          this.options.mode === "share" && row.totalCount > 0
            ? count / row.totalCount
            : count;
      });
      return normalized;
    });

    this.stackData = d3.stack().keys(productTypes)(this.rows);
  }

  _emptyTotals(types) {
    return types.reduce((acc, type) => {
      acc[type] = 0;
      return acc;
    }, {});
  }

  _formatTooltip(segment, productType, locationCount = 0) {
    const rawCount =
      segment.data.rawTotals?.[productType] ?? segment.data[productType] ?? 0;
    const percentage =
      segment.data.totalCount > 0 ? rawCount / segment.data.totalCount : 0;

    return Format.tooltip(`${segment.data.daoName} · ${productType}`, [
      { label: "条目数", value: Format.number(rawCount, { fallback: "0" }) },
      { label: "占比", value: Format.percentage(percentage, 1, "0%") },
      { label: "关联地点", value: `${locationCount} 个` },
    ]);
  }

  _getSegmentIds(daoId, productType) {
    const key = `${daoId}|${productType}`;
    return this.segmentIndex.get(key) || [];
  }

  _getDaoId(item) {
    if (!item) return null;
    if (item.Administrative_Level === "道") return item.Location_ID;
    return item.Parent_ID || null;
  }
}

export default DaoProductStackedChart;
