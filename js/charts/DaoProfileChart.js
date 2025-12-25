// 十道画像（聚合统计视图）：按道汇总人口/户数/户均人口/物产种类等指标，点击条形可驱动筛选。

import BaseChart from "./BaseChart.js";
import { Tooltip } from "../components/tooltip.js";
import { Format, formatNumber } from "../utils/format.js";
import { getDaoColor } from "../utils/colors.js";

function formatAxisWan(value) {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value) >= 10000)
    return Format.wan(value, "万", { digits: 1, fallback: "" });
  return formatNumber(value, { maximumFractionDigits: 0, fallback: "" });
}

function formatAxisFixed(value, digits = 1) {
  return formatNumber(value, { maximumFractionDigits: digits, fallback: "-" });
}

function getDaoId(item) {
  if (!item) return null;
  if (item.Administrative_Level === "道") return item.Location_ID;
  return item.Parent_ID || null;
}

function compareZh(a, b) {
  return `${a || ""}`.localeCompare(`${b || ""}`, "zh-CN");
}

const METRICS = {
  population: {
    key: "population",
    label: "人口总量",
    axisLabel: "人口总量（万）",
    getValue: (row) => row.population,
    formatAxis: formatAxisWan,
    formatValue: (value) => Format.population(value),
  },
  households: {
    key: "households",
    label: "户数总量",
    axisLabel: "户数总量（万）",
    getValue: (row) => row.households,
    formatAxis: formatAxisWan,
    formatValue: (value) => Format.households(value),
  },
  householdSize: {
    key: "householdSize",
    label: "平均户均人口",
    axisLabel: "平均户均人口",
    getValue: (row) => row.householdSize,
    formatAxis: (value) => formatAxisFixed(value, 1),
    formatValue: (value) => `${formatAxisFixed(value, 1)}`,
  },
  productRichness: {
    key: "productRichness",
    label: "平均物产种类",
    axisLabel: "平均物产种类数",
    getValue: (row) => row.productRichness,
    formatAxis: (value) => formatAxisFixed(value, 1),
    formatValue: (value) => `${formatAxisFixed(value, 1)}`,
  },
  locationCount: {
    key: "locationCount",
    label: "州府数量",
    axisLabel: "州府数量",
    getValue: (row) => row.locationCount,
    formatAxis: (value) => formatAxisFixed(value, 0),
    formatValue: (value) => `${formatAxisFixed(value, 0)}处`,
  },
};

class DaoProfileChart extends BaseChart {
  get defaultOptions() {
    const base = super.defaultOptions;
    return {
      ...base,
      margin: {
        ...base.margin,
        top: 20,
        right: 24,
        bottom: 46,
        left: 92,
      },
      metric: "population",
      maxDaos: 10,
      onHover: null,
      onClick: null,
    };
  }

  update(newData, newOptions = {}) {
    if (newData) {
      this.data = newData;
    }
    this.options = this._mergeOptions({ ...this.options, ...newOptions });
    this._setupDimensions();
    this._updateSvgSize();
    this._setupScales();
    this.render();
  }

  _setupScales() {
    const metric = this._getMetricConfig();
    const aggregates = this._aggregateByDao(this.data);

    const rows = aggregates
      .slice()
      .sort((a, b) => {
        const aValue = metric.getValue(a);
        const bValue = metric.getValue(b);
        const aNum = Number.isFinite(aValue) ? aValue : -Infinity;
        const bNum = Number.isFinite(bValue) ? bValue : -Infinity;
        const diff = bNum - aNum;
        if (diff !== 0) return diff;
        return compareZh(a.daoName, b.daoName);
      })
      .slice(0, Math.max(0, this.options.maxDaos || 10));

    this.rows = rows;
    this.daoNameById = new Map(rows.map((row) => [row.daoId, row.daoName]));

    const max = d3.max(rows, (row) => {
      const value = metric.getValue(row);
      return Number.isFinite(value) ? value : 0;
    });

    const safeMax = Number.isFinite(max) && max > 0 ? max : 1;
    this.xScale = d3
      .scaleLinear()
      .domain([0, safeMax])
      .range([0, this.width])
      .nice();
    this.yScale = d3
      .scaleBand()
      .domain(rows.map((row) => row.daoId))
      .range([0, this.height])
      .padding(0.18);
  }

  render() {
    this.chartGroup.selectAll("*").remove();

    if (!this.rows || this.rows.length === 0) {
      this._renderEmpty("暂无数据");
      return;
    }

    this._renderAxes();
    this._renderBars();
  }

  _renderEmpty(message) {
    this.chartGroup
      .selectAll(".dao-profile__empty")
      .data([null])
      .join("text")
      .attr("class", "dao-profile__empty")
      .attr("x", this.width / 2)
      .attr("y", this.height / 2)
      .attr("text-anchor", "middle")
      .text(message);
  }

  _renderAxes() {
    const metric = this._getMetricConfig();

    const xAxis = d3
      .axisBottom(this.xScale)
      .ticks(5)
      .tickFormat(metric.formatAxis);
    const yAxis = d3
      .axisLeft(this.yScale)
      .tickFormat((daoId) => this.daoNameById.get(daoId) || daoId);

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

    const bottomOffset = (this.options.margin?.bottom ?? 30) - 8;
    this.chartGroup
      .selectAll(".x-label")
      .data([null])
      .join("text")
      .attr("class", "axis-label x-label")
      .attr("x", this.width / 2)
      .attr("y", this.height + bottomOffset)
      .attr("text-anchor", "middle")
      .text(metric.axisLabel || metric.label);
  }

  _renderBars() {
    const metric = this._getMetricConfig();
    const bandHeight = this.yScale.bandwidth();
    const duration = this.options.animationDuration || 0;

    const barGroup = this.chartGroup
      .selectAll(".dao-profile__bars")
      .data([null])
      .join("g")
      .attr("class", "dao-profile__bars");

    const bars = barGroup
      .selectAll("rect.dao-profile__bar")
      .data(this.rows, (row) => row.daoId)
      .join(
        (enter) =>
          enter
            .append("rect")
            .attr("class", "dao-profile__bar")
            .attr("x", 0)
            .attr("y", (row) => this.yScale(row.daoId))
            .attr("height", bandHeight)
            .attr("width", 0)
            .attr("fill", (row) => getDaoColor(row.daoId))
            .call((enterSelection) =>
              enterSelection
                .transition()
                .duration(duration)
                .attr("width", (row) =>
                  this.xScale(this._safeMetricValue(metric, row)),
                ),
            ),
        (update) =>
          update.call((updateSelection) =>
            updateSelection
              .transition()
              .duration(duration)
              .attr("y", (row) => this.yScale(row.daoId))
              .attr("height", bandHeight)
              .attr("fill", (row) => getDaoColor(row.daoId))
              .attr("width", (row) =>
                this.xScale(this._safeMetricValue(metric, row)),
              ),
          ),
        (exit) => exit.remove(),
      );

    bars
      .on("pointerenter", (event, row) => {
        Tooltip.show(event, this._buildTooltip(row));
        this._emitHover({ daoId: row.daoId, ids: row.ids || [] });
      })
      .on("pointerleave", () => {
        Tooltip.hide();
        this._emitHover(null);
      })
      .on("click", (event, row) => {
        if (typeof this.options.onClick === "function") {
          this.options.onClick({
            daoId: row.daoId,
            ids: row.ids || [],
            originalEvent: event,
          });
        }
      });

    const valueLabels = barGroup
      .selectAll("text.dao-profile__value")
      .data(this.rows, (row) => row.daoId)
      .join("text")
      .attr("class", "dao-profile__value")
      .attr("x", (row) => this.xScale(this._safeMetricValue(metric, row)) + 6)
      .attr("y", (row) => (this.yScale(row.daoId) || 0) + bandHeight / 2)
      .attr("dominant-baseline", "middle")
      .text((row) => metric.formatValue(metric.getValue(row)));

    valueLabels
      .transition()
      .duration(duration)
      .attr("x", (row) => this.xScale(this._safeMetricValue(metric, row)) + 6)
      .attr("y", (row) => (this.yScale(row.daoId) || 0) + bandHeight / 2);
  }

  _emitHover(payload) {
    if (typeof this.options.onHover === "function") {
      this.options.onHover(payload);
    }
  }

  _getMetricConfig() {
    const metricKey = this.options.metric;
    return METRICS[metricKey] || METRICS.population;
  }

  _safeMetricValue(metric, row) {
    const value = metric.getValue(row);
    return Number.isFinite(value) ? value : 0;
  }

  _buildTooltip(row) {
    if (!row) return "";

    return Format.tooltip(row.daoName || row.daoId, [
      {
        label: "州府数量",
        value: `${formatAxisFixed(row.locationCount, 0)}处`,
      },
      { label: "人口总量", value: Format.population(row.population) },
      { label: "户数总量", value: Format.households(row.households) },
      { label: "平均户均人口", value: formatAxisFixed(row.householdSize, 1) },
      { label: "平均物产种类", value: formatAxisFixed(row.productRichness, 1) },
    ]);
  }

  _aggregateByDao(data) {
    const aggregates = new Map();

    (data || []).forEach((item) => {
      if (!item) return;
      if (item.Administrative_Level === "道") return;

      const daoId = getDaoId(item);
      if (!daoId) return;

      const record =
        aggregates.get(daoId) ||
        (() => {
          const initial = {
            daoId,
            daoName: item.daoName || "",
            population: 0,
            households: 0,
            locationCount: 0,
            householdSizeSum: 0,
            householdSizeCount: 0,
            productRichnessSum: 0,
            productRichnessCount: 0,
            ids: [],
          };
          aggregates.set(daoId, initial);
          return initial;
        })();

      record.locationCount += 1;
      if (item.Location_ID) record.ids.push(item.Location_ID);
      if (!record.daoName && item.daoName) record.daoName = item.daoName;

      if (Number.isFinite(item.Population))
        record.population += item.Population;
      if (Number.isFinite(item.Households))
        record.households += item.Households;

      if (Number.isFinite(item.householdSize)) {
        record.householdSizeSum += item.householdSize;
        record.householdSizeCount += 1;
      }
      if (Number.isFinite(item.productRichness)) {
        record.productRichnessSum += item.productRichness;
        record.productRichnessCount += 1;
      }
    });

    return Array.from(aggregates.values()).map((record) => {
      const householdSize =
        record.householdSizeCount > 0
          ? record.householdSizeSum / record.householdSizeCount
          : null;
      const productRichness =
        record.productRichnessCount > 0
          ? record.productRichnessSum / record.productRichnessCount
          : null;

      return {
        daoId: record.daoId,
        daoName: record.daoName || record.daoId,
        population: record.population,
        households: record.households,
        householdSize,
        productRichness,
        locationCount: record.locationCount,
        ids: record.ids,
      };
    });
  }
}

export default DaoProfileChart;
