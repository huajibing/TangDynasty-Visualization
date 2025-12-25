// 地图视图：使用 D3-geo 绘制底图与地点标记，支持悬浮提示与点击选中。

import BaseChart from "./BaseChart.js";
import { Tooltip } from "../components/tooltip.js";
import {
  createDaoColorScale,
  createPopulationRadiusScale,
} from "../utils/scales.js";
import {
  getAdministrativeLevelColor,
  getDaoColor,
  getProductTypeColor,
} from "../utils/colors.js";
import {
  formatHouseholdSize,
  formatHouseholds,
  formatPopulation,
  Format,
} from "../utils/format.js";
import eventBus, { EVENTS } from "../utils/eventBus.js";

class MapView extends BaseChart {
  get defaultOptions() {
    return {
      ...super.defaultOptions,
      geoData: null,
      radiusRange: [3, 18],
      // 颜色编码（colorMode 为兼容旧 API 的别名）
      colorEncoding: "product", // dao | product | level
      colorMode: "product", // dao | product | level
      // markerEncoding 控制“点大小”映射方式（禁止使用 Confidence）
      markerEncoding: "population", // population | productRichness | householdSize | fixed
      projectionCenter: [104, 35.5],
      projectionScale: 1.15,
      enableZoom: true,
      minZoom: 0.85,
      maxZoom: 8,
      pointOpacity: 0.88,
      boundaryStrokeWidth: 1,
    };
  }

  _setupScales() {
    this.projection = this._createProjection();
    this.pathGenerator = d3.geoPath().projection(this.projection);

    this.radiusScale = this._createMarkerRadiusScale();
    this.colorScale = this._createColorScale();
  }

  _getColorEncoding() {
    const raw =
      this.options?.colorEncoding ?? this.options?.colorMode ?? "product";
    return raw === "product" || raw === "level" || raw === "dao"
      ? raw
      : "product";
  }

  _getMarkerEncoding() {
    const raw = this.options?.markerEncoding ?? "population";
    if (raw === "productRichness" || raw === "householdSize" || raw === "fixed")
      return raw;
    return "population";
  }

  _createMarkerRadiusScale() {
    const encoding = this._getMarkerEncoding();
    const range = Array.isArray(this.options.radiusRange)
      ? this.options.radiusRange
      : [3, 18];
    const minR = Number.isFinite(range?.[0]) ? range[0] : 3;
    const maxR = Number.isFinite(range?.[1]) ? range[1] : 18;

    if (encoding === "fixed") {
      const fixed = (minR + maxR) / 2;
      return () => fixed;
    }

    if (encoding === "population") {
      const values = (this.data || [])
        .map((d) => d.Population)
        .filter((value) => Number.isFinite(value));
      const extent = values.length > 0 ? d3.extent(values) : [1000, 1000000];
      return createPopulationRadiusScale(extent, [minR, maxR]);
    }

    const getValue = (d) => {
      if (!d) return null;
      if (encoding === "productRichness") return d.productRichness;
      return d.householdSize;
    };

    const values = (this.data || [])
      .map(getValue)
      .filter((value) => Number.isFinite(value));
    const fallbackDomain = encoding === "productRichness" ? [0, 20] : [0, 10];
    const domain = this._normalizeExtent(
      values.length ? d3.extent(values) : null,
      fallbackDomain,
    );
    return d3.scaleSqrt().domain(domain).range([minR, maxR]).clamp(true);
  }

  _normalizeExtent(extent, fallback) {
    if (!Array.isArray(extent) || extent.length < 2) return [...fallback];
    let [min, max] = extent;
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [...fallback];
    if (min === max) {
      if (min === 0) return [0, 1];
      return [min * 0.95, min * 1.05];
    }
    return [Math.min(min, max), Math.max(min, max)];
  }

  render() {
    this._renderLayers();
    this._renderBoundaries();
    this._renderPoints();
    this._bindBackgroundClick();

    this._renderInteractionControls();
    this._applyInteractionMode();
  }

  _renderLayers() {
    this.mapLayer = this.chartGroup
      .selectAll(".map-layer")
      .data([null])
      .join("g")
      .attr("class", "map-layer");

    this.boundaryLayer = this.mapLayer
      .selectAll(".map-boundaries")
      .data([null])
      .join("g")
      .attr("class", "map-boundaries");

    this.pointLayer = this.mapLayer
      .selectAll(".map-points")
      .data([null])
      .join("g")
      .attr("class", "map-points");
  }

  _renderBoundaries() {
    const features = this.options.geoData?.features || [];

    if (features.length === 0) {
      this.boundaryLayer.selectAll("*").remove();
      return;
    }

    const polygonFeatures = features.filter((f) => {
      const type = f?.geometry?.type;
      return type === "Polygon" || type === "MultiPolygon";
    });
    const lineFeatures = features.filter((f) => {
      const type = f?.geometry?.type;
      return type === "LineString" || type === "MultiLineString";
    });

    // 同时渲染多边形与线条：先画面、再画线，保证线条在面之上。
    const renderFeatures = [...polygonFeatures, ...lineFeatures];

    if (renderFeatures.length === 0) {
      this.boundaryLayer.selectAll("*").remove();
      return;
    }

    const paths = this.boundaryLayer
      .selectAll(".map__boundary")
      .data(
        renderFeatures,
        (d, i) =>
          `${d?.geometry?.type || "Unknown"}-${
            d?.properties?.code ||
            d?.id ||
            d?.properties?.name ||
            d?.properties?.fullname ||
            i
          }`,
      )
      .join("path")
      .attr("class", "map__boundary")
      .attr("d", (d) => this.pathGenerator(d))
      .style("stroke-width", `${this.options.boundaryStrokeWidth}px`)
      .order();

    // 当边界计算结果异常时，提供调试提示
    const hasVisibleBoundary = paths.size() > 0;
    if (!hasVisibleBoundary) {
      // eslint-disable-next-line no-console
      console.warn("[MapView] 边界未渲染，geoData 可能格式异常");
    }
  }

  _renderPoints() {
    const validData = this.data.filter(
      (d) => Number.isFinite(d.Latitude) && Number.isFinite(d.Longitude),
    );

    this.chartGroup.selectAll(".chart__empty").remove();
    if (validData.length === 0) {
      this.chartGroup
        .selectAll(".chart__empty")
        .data([null])
        .join("text")
        .attr("class", "chart__empty")
        .attr("x", this.width / 2)
        .attr("y", this.height / 2)
        .attr("text-anchor", "middle")
        .text("暂无坐标数据");
      return;
    }

    this.points = this.pointLayer
      .selectAll(".location-point")
      .data(validData, (d) => d.Location_ID)
      .join(
        (enter) =>
          enter
            .append("circle")
            .attr("class", "location-point")
            .attr("cx", (d) => this._projectPoint(d)[0])
            .attr("cy", (d) => this._projectPoint(d)[1])
            .attr("r", 0)
            .attr("fill", (d) => this._getColor(d))
            .attr("opacity", this.options.pointOpacity)
            .call((enterSelection) =>
              enterSelection
                .transition()
                .duration(this.options.animationDuration)
                .attr("r", (d) => this._getRadius(d)),
            ),
        (update) =>
          update.call((updateSelection) =>
            updateSelection
              .transition()
              .duration(this.options.animationDuration)
              .attr("cx", (d) => this._projectPoint(d)[0])
              .attr("cy", (d) => this._projectPoint(d)[1])
              .attr("r", (d) => this._getRadius(d))
              .attr("fill", (d) => this._getColor(d))
              .attr("opacity", this.options.pointOpacity),
          ),
        (exit) =>
          exit.call((exitSelection) =>
            exitSelection
              .transition()
              .duration(this.options.animationDuration)
              .attr("r", 0)
              .remove(),
          ),
      );

    this._bindPointEvents();
  }

  _bindPointEvents() {
    if (!this.points) return;

    this.points
      .on("mouseenter", (event, d) => {
        d3.select(event.currentTarget).classed("is-hovered", true).raise();
        Tooltip.show(event, this._buildTooltip(d));
        eventBus.emit(EVENTS.LOCATION_HOVER, d);
        this.options.onHover?.(d);
      })
      .on("mouseleave", () => {
        this.points.classed("is-hovered", false);
        Tooltip.hide();
        eventBus.emit(EVENTS.LOCATION_HOVER, null);
      })
      .on("click", (event, d) => {
        if (this.interactionMode && this.interactionMode !== "navigate") return;
        event.stopPropagation();
        this._handleSelection(event, d);
      });
  }

  _handleSelection(event, location) {
    const append = Boolean(event?.metaKey || event?.ctrlKey);
    const id = location?.Location_ID || null;
    const prev = Array.isArray(this.selectedIds) ? this.selectedIds : [];
    let nextSelected = [];

    if (!id) {
      nextSelected = [];
    } else if (append) {
      if (prev.includes(id)) {
        nextSelected = prev.filter((item) => item !== id);
      } else {
        nextSelected = [...prev, id];
      }
    } else {
      nextSelected = [id];
    }

    this.selectedIds = nextSelected;
    this.points.classed("is-selected", (d) =>
      this.selectedIds?.includes(d.Location_ID),
    );

    const payload = id ? { location, append, ids: nextSelected } : null;
    eventBus.emit(EVENTS.LOCATION_SELECT, payload);
    this.options.onClick?.(payload);
  }

  _bindBackgroundClick() {
    if (!this.svg) return;
    this.svg.on("click.map-clear", (event) => {
      if (this.interactionMode && this.interactionMode !== "navigate") return;
      const target = event.target;
      if (target && typeof target.closest === "function") {
        if (target.closest(".location-point")) return;
      }
      this._clearSelection();
      eventBus.emit(EVENTS.LOCATION_SELECT, null);
      this.options.onClick?.(null);
    });
  }

  _renderInteractionControls() {
    if (!this.container || this.container.empty()) return;
    const root = this.container.node();
    if (!root) return;

    if (!this.interactionMode) {
      this.interactionMode = "navigate";
    }

    const existing = root.querySelector(".map-controls");
    if (existing) return;

    const controls = document.createElement("div");
    controls.className = "map-controls";

    const buildButton = (mode, label, icon) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "map-controls__btn";
      btn.dataset.mode = mode;
      btn.setAttribute(
        "aria-pressed",
        mode === this.interactionMode ? "true" : "false",
      );
      btn.title = label;
      btn.innerHTML = `<span class="map-controls__icon">${icon}</span><span class="map-controls__label">${label}</span>`;
      btn.addEventListener("click", () => this._setInteractionMode(mode));
      return btn;
    };

    controls.appendChild(buildButton("navigate", "漫游", "🧭"));
    controls.appendChild(buildButton("box", "框选", "▭"));
    controls.appendChild(buildButton("lasso", "套索", "✎"));
    root.appendChild(controls);
  }

  _setInteractionMode(mode) {
    const next =
      mode === "box" || mode === "lasso" || mode === "navigate"
        ? mode
        : "navigate";
    if (this.interactionMode === next) return;
    this.interactionMode = next;
    this._applyInteractionMode();
  }

  _applyInteractionMode() {
    const mode = this.interactionMode || "navigate";

    const root = this.container?.node?.();
    const controls = root?.querySelector?.(".map-controls");
    controls
      ?.querySelectorAll?.("[data-mode]")
      ?.forEach?.((btn) =>
        btn.setAttribute(
          "aria-pressed",
          btn.dataset.mode === mode ? "true" : "false",
        ),
      );

    if (mode === "navigate") {
      this._teardownBrush();
      this._teardownLasso();
      if (this.options.enableZoom) {
        this._setupZoom();
      }
      return;
    }

    this._disableZoom();
    if (mode === "box") {
      this._teardownLasso();
      this._setupBrushSelect();
    } else {
      this._teardownBrush();
      this._setupLassoSelect();
    }
  }

  _disableZoom() {
    if (!this.svg) return;
    this.svg.on(".zoom", null);
    this.mapLayer?.attr("transform", null);
    this.boundaryLayer
      ?.selectAll?.(".map__boundary")
      ?.style?.("stroke-width", `${this.options.boundaryStrokeWidth}px`);
  }

  _setupBrushSelect() {
    if (!this.chartGroup) return;
    if (typeof d3 === "undefined") return;

    this._isClearingBrush = false;

    const brush = d3
      .brush()
      .extent([
        [0, 0],
        [this.width, this.height],
      ])
      .on("end", (event) => {
        if (!event?.selection) {
          if (this._isClearingBrush) {
            this._isClearingBrush = false;
            return;
          }
          eventBus.emit(EVENTS.LOCATION_SELECT, null);
          return;
        }

        const [[x0, y0], [x1, y1]] = event.selection;
        const minX = Math.min(x0, x1);
        const maxX = Math.max(x0, x1);
        const minY = Math.min(y0, y1);
        const maxY = Math.max(y0, y1);

        const ids = (this.data || [])
          .filter(
            (d) => Number.isFinite(d.Latitude) && Number.isFinite(d.Longitude),
          )
          .filter((d) => {
            const [x, y] = this._projectPoint(d);
            return x >= minX && x <= maxX && y >= minY && y <= maxY;
          })
          .map((d) => d.Location_ID);

        eventBus.emit(EVENTS.LOCATION_SELECT, ids.length ? { ids } : null);
        this._isClearingBrush = true;
        this.chartGroup.selectAll(".map-brush").call(brush.move, null);
      });

    this._brush = brush;
    this._brushGroup = this.chartGroup
      .selectAll(".map-brush")
      .data([null])
      .join("g")
      .attr("class", "map-brush")
      .call(brush);
  }

  _teardownBrush() {
    if (this._brushGroup) {
      this._brushGroup.remove();
    }
    this._brushGroup = null;
    this._brush = null;
    this._isClearingBrush = false;
  }

  _setupLassoSelect() {
    if (!this.chartGroup) return;
    if (typeof d3 === "undefined") return;

    this._lassoPoints = [];
    this._lassoActive = false;
    this._lassoPointerId = null;

    const layer = this.chartGroup
      .selectAll(".map-lasso")
      .data([null])
      .join("g")
      .attr("class", "map-lasso");

    const overlay = layer
      .selectAll("rect.map-lasso__overlay")
      .data([null])
      .join("rect")
      .attr("class", "map-lasso__overlay")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", this.width)
      .attr("height", this.height)
      .style("fill", "transparent");

    const overlayNode = overlay.node();
    this._lassoOverlayNode = overlayNode || null;

    const path = layer
      .selectAll("path.map-lasso__path")
      .data([null])
      .join("path")
      .attr("class", "map-lasso__path")
      .attr("d", "");

    const draw = () => {
      if (!this._lassoPoints || this._lassoPoints.length === 0) {
        path.attr("d", "");
        return;
      }
      const d = `M${this._lassoPoints.map((p) => p.join(",")).join("L")}`;
      path.attr("d", d);
    };

    const detachEscapeListener = () => {
      if (!this._onLassoEscapeKeyDown) return;
      window.removeEventListener("keydown", this._onLassoEscapeKeyDown, true);
      this._onLassoEscapeKeyDown = null;
    };

    const detachWindowPointerListeners = () => {
      if (this._onLassoWindowPointerUp) {
        window.removeEventListener("pointerup", this._onLassoWindowPointerUp);
      }
      if (this._onLassoWindowPointerCancel) {
        window.removeEventListener(
          "pointercancel",
          this._onLassoWindowPointerCancel,
        );
      }
      this._onLassoWindowPointerUp = null;
      this._onLassoWindowPointerCancel = null;
    };

    const releasePointerCapture = () => {
      const pointerId = this._lassoPointerId;
      this._lassoPointerId = null;
      if (!overlayNode) return;
      if (!Number.isFinite(pointerId)) return;
      try {
        overlayNode.releasePointerCapture?.(pointerId);
      } catch {
        // ignore
      }
    };

    const cancelLasso = () => {
      if (!this._lassoActive) return;
      this._lassoActive = false;
      releasePointerCapture();
      detachEscapeListener();
      detachWindowPointerListeners();
      this._lassoPoints = [];
      draw();
    };

    const finishLassoSelection = () => {
      this._lassoActive = false;
      releasePointerCapture();
      detachEscapeListener();
      detachWindowPointerListeners();

      const polygon = this._lassoPoints || [];
      if (polygon.length < 3) {
        this._lassoPoints = [];
        draw();
        eventBus.emit(EVENTS.LOCATION_SELECT, null);
        return;
      }

      const ids = (this.data || [])
        .filter(
          (d) => Number.isFinite(d.Latitude) && Number.isFinite(d.Longitude),
        )
        .filter((d) => {
          const [x, y] = this._projectPoint(d);
          return d3.polygonContains(polygon, [x, y]);
        })
        .map((d) => d.Location_ID);

      this._lassoPoints = [];
      draw();
      eventBus.emit(EVENTS.LOCATION_SELECT, ids.length ? { ids } : null);
    };

    overlay
      .on("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this._lassoActive = true;
        this._lassoPoints = [d3.pointer(event, this.chartGroup.node())];
        this._lassoPointerId = event.pointerId;
        try {
          overlayNode?.setPointerCapture?.(event.pointerId);
        } catch {
          // ignore
        }
        detachEscapeListener();
        this._onLassoEscapeKeyDown = (keyEvent) => {
          if (!this._lassoActive) return;
          if (keyEvent.key !== "Escape") return;
          keyEvent.preventDefault();
          keyEvent.stopPropagation();
          cancelLasso();
        };
        window.addEventListener("keydown", this._onLassoEscapeKeyDown, true);

        detachWindowPointerListeners();
        this._onLassoWindowPointerUp = (upEvent) => {
          if (!this._lassoActive) return;
          if (
            Number.isFinite(this._lassoPointerId) &&
            upEvent.pointerId !== this._lassoPointerId
          )
            return;
          finishLassoSelection();
        };
        this._onLassoWindowPointerCancel = (cancelEvent) => {
          if (!this._lassoActive) return;
          if (
            Number.isFinite(this._lassoPointerId) &&
            cancelEvent.pointerId !== this._lassoPointerId
          )
            return;
          cancelLasso();
        };
        window.addEventListener("pointerup", this._onLassoWindowPointerUp);
        window.addEventListener(
          "pointercancel",
          this._onLassoWindowPointerCancel,
        );
        draw();
      })
      .on("pointermove", (event) => {
        if (!this._lassoActive) return;
        const point = d3.pointer(event, this.chartGroup.node());
        const last = this._lassoPoints[this._lassoPoints.length - 1];
        const dx = point[0] - last[0];
        const dy = point[1] - last[1];
        if (dx * dx + dy * dy < 9) return;
        this._lassoPoints.push(point);
        draw();
      })
      .on("pointerup", (event) => {
        if (!this._lassoActive) return;
        event.preventDefault();
        event.stopPropagation();
        finishLassoSelection();
      })
      .on("pointercancel", (event) => {
        if (!this._lassoActive) return;
        event.preventDefault();
        event.stopPropagation();
        cancelLasso();
      })
      .on("lostpointercapture", () => {
        cancelLasso();
      });

    this._lassoLayer = layer;
  }

  _teardownLasso() {
    if (this._onLassoEscapeKeyDown) {
      window.removeEventListener("keydown", this._onLassoEscapeKeyDown, true);
    }
    this._onLassoEscapeKeyDown = null;
    if (this._onLassoWindowPointerUp) {
      window.removeEventListener("pointerup", this._onLassoWindowPointerUp);
    }
    this._onLassoWindowPointerUp = null;
    if (this._onLassoWindowPointerCancel) {
      window.removeEventListener(
        "pointercancel",
        this._onLassoWindowPointerCancel,
      );
    }
    this._onLassoWindowPointerCancel = null;
    if (this._lassoOverlayNode && Number.isFinite(this._lassoPointerId)) {
      try {
        this._lassoOverlayNode.releasePointerCapture?.(this._lassoPointerId);
      } catch {
        // ignore
      }
    }
    this._lassoOverlayNode = null;
    this._lassoPointerId = null;
    if (this._lassoLayer) {
      this._lassoLayer.remove();
    }
    this._lassoLayer = null;
    this._lassoPoints = null;
    this._lassoActive = false;
  }

  _clearSelection() {
    this.selectedIds = [];
    this.points?.classed("is-selected", false);
  }

  _projectPoint(datum) {
    const projected = this.projection([datum.Longitude, datum.Latitude]);
    return projected || [0, 0];
  }

  _getRadius(datum) {
    const encoding = this._getMarkerEncoding();
    if (encoding === "fixed") return this.radiusScale();

    const value =
      encoding === "productRichness"
        ? datum.productRichness
        : encoding === "householdSize"
          ? datum.householdSize
          : datum.Population;

    if (!Number.isFinite(value)) return this.options.radiusRange[0];
    return this.radiusScale(value);
  }

  _createProjection() {
    const projection = d3.geoMercator();
    const featureCollection = this.options.geoData;

    if (featureCollection?.features?.length) {
      const polygonFeatures = featureCollection.features.filter((f) => {
        const type = f?.geometry?.type;
        return type === "Polygon" || type === "MultiPolygon";
      });
      const lineFeatures = featureCollection.features.filter((f) => {
        const type = f?.geometry?.type;
        return type === "LineString" || type === "MultiLineString";
      });

      // 同时考虑多边形与线条来 fit，避免线条超出面范围时被裁掉。
      const fitFeatures = [...polygonFeatures, ...lineFeatures];

      if (fitFeatures.length > 0) {
        const filteredCollection = {
          type: "FeatureCollection",
          features: fitFeatures,
        };

        const padding = 12;
        const extent = [
          [padding, padding],
          [
            Math.max(padding, this.width - padding),
            Math.max(padding, this.height - padding),
          ],
        ];

        projection.fitExtent(extent, filteredCollection);
        return projection;
      }
    }

    // 回退到手动设置的投影参数
    projection
      .center(this.options.projectionCenter)
      .scale(Math.min(this.width, this.height) * this.options.projectionScale)
      .translate([this.width / 2, this.height / 2]);

    return projection;
  }

  _createColorScale() {
    const mode = this._getColorEncoding();
    if (mode === "dao") {
      const daoIds = Array.from(
        new Set(
          this.data
            .map((d) =>
              d.Administrative_Level === "道"
                ? d.Location_ID
                : d.Parent_ID || d.daoId || d.daoName,
            )
            .filter(Boolean),
        ),
      );
      return createDaoColorScale(daoIds);
    }

    if (mode === "product") {
      return null;
    }

    return null;
  }

  _getColor(datum) {
    const mode = this._getColorEncoding();

    if (mode === "product") {
      return getProductTypeColor(datum.dominantProductType);
    }

    if (mode === "level") {
      return getAdministrativeLevelColor(datum.Administrative_Level);
    }

    const daoId =
      datum.Administrative_Level === "道"
        ? datum.Location_ID
        : datum.Parent_ID || datum.daoId;
    return this.colorScale ? this.colorScale(daoId) : getDaoColor(daoId);
  }

  _buildTooltip(datum) {
    return Format.tooltip(datum.Location_Name, [
      { label: "所属道", value: datum.daoName || "-" },
      { label: "行政级别", value: datum.Administrative_Level || "-" },
      { label: "人口", value: formatPopulation(datum.Population) },
      { label: "户数", value: formatHouseholds(datum.Households) },
      { label: "户均人口", value: formatHouseholdSize(datum.householdSize) },
      { label: "物产种类", value: datum.productRichness },
      { label: "主导物产", value: datum.dominantProductType || "-" },
    ]);
  }

  _setupZoom() {
    if (!this.mapLayer) return;

    if (this.zoomBehavior) {
      this.svg.on(".zoom", null);
    }

    const baseStrokeWidth = this.options.boundaryStrokeWidth;

    this.zoomBehavior = d3
      .zoom()
      .scaleExtent([this.options.minZoom, this.options.maxZoom])
      .on("zoom", (event) => {
        this.mapLayer.attr("transform", event.transform);
        // 根据缩放级别调整边界线粗细，放大时线条变细
        this.boundaryLayer
          .selectAll(".map__boundary")
          .style("stroke-width", `${baseStrokeWidth / event.transform.k}px`);
      });

    this.svg.call(this.zoomBehavior);
  }

  highlight(ids = []) {
    const idSet = new Set(ids || []);
    this.points
      ?.classed("is-highlighted", (d) => idSet.has(d.Location_ID))
      .classed("is-dimmed", (d) => idSet.size > 0 && !idSet.has(d.Location_ID));
  }

  clearHighlight() {
    this.points?.classed("is-highlighted", false).classed("is-dimmed", false);
  }

  destroy() {
    if (this.zoomBehavior) {
      this.svg.on(".zoom", null);
    }
    if (this.svg) {
      this.svg.on("click.map-clear", null);
    }
    super.destroy();
  }
}

export default MapView;
