// 地图视图：使用 D3-geo 绘制底图与地点标记，支持悬浮提示与点击选中。

import BaseChart from './BaseChart.js';
import { Tooltip } from '../components/tooltip.js';
import { createDaoColorScale, createPopulationRadiusScale } from '../utils/scales.js';
import { getAdministrativeLevelColor, getDaoColor, getProductTypeColor } from '../utils/colors.js';
import {
  formatHouseholdSize,
  formatHouseholds,
  formatPopulation,
  Format,
} from '../utils/format.js';
import eventBus, { EVENTS } from '../utils/eventBus.js';

class MapView extends BaseChart {
  get defaultOptions() {
    return {
      ...super.defaultOptions,
      geoData: null,
      radiusRange: [3, 18],
      colorMode: 'dao', // dao | product | level
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

    const populations = this.data
      .map((d) => d.Population)
      .filter((value) => Number.isFinite(value));
    const popExtent = populations.length > 0 ? d3.extent(populations) : [1000, 1000000];
    this.radiusScale = createPopulationRadiusScale(popExtent, this.options.radiusRange);

    this.colorScale = this._createColorScale();
  }

  render() {
    this._renderLayers();
    this._renderBoundaries();
    this._renderPoints();

    if (this.options.enableZoom) {
      this._setupZoom();
    }
  }

  _renderLayers() {
    this.mapLayer = this.chartGroup
      .selectAll('.map-layer')
      .data([null])
      .join('g')
      .attr('class', 'map-layer');

    this.boundaryLayer = this.mapLayer
      .selectAll('.map-boundaries')
      .data([null])
      .join('g')
      .attr('class', 'map-boundaries');

    this.pointLayer = this.mapLayer
      .selectAll('.map-points')
      .data([null])
      .join('g')
      .attr('class', 'map-points');
  }

  _renderBoundaries() {
    const features = this.options.geoData?.features || [];

    if (features.length === 0) {
      this.boundaryLayer.selectAll('*').remove();
      return;
    }

    // 只渲染多边形类型的 features
    const polygonFeatures = features.filter((f) => {
      const type = f?.geometry?.type;
      return type === 'Polygon' || type === 'MultiPolygon';
    });

    const paths = this.boundaryLayer
      .selectAll('.map__boundary')
      .data(
        polygonFeatures,
        (d) => d?.properties?.code || d?.id || d?.properties?.name || Math.random(),
      )
      .join('path')
      .attr('class', 'map__boundary')
      .attr('d', (d) => this.pathGenerator(d))
      .style('stroke-width', `${this.options.boundaryStrokeWidth}px`);

    // 当边界计算结果异常时，提供调试提示
    const hasVisibleBoundary = paths.size() > 0;
    if (!hasVisibleBoundary) {
      // eslint-disable-next-line no-console
      console.warn('[MapView] 边界未渲染，geoData 可能格式异常');
    }
  }

  _renderPoints() {
    const validData = this.data.filter(
      (d) => Number.isFinite(d.Latitude) && Number.isFinite(d.Longitude),
    );

    this.chartGroup.selectAll('.chart__empty').remove();
    if (validData.length === 0) {
      this.chartGroup
        .selectAll('.chart__empty')
        .data([null])
        .join('text')
        .attr('class', 'chart__empty')
        .attr('x', this.width / 2)
        .attr('y', this.height / 2)
        .attr('text-anchor', 'middle')
        .text('暂无坐标数据');
      return;
    }

    this.points = this.pointLayer
      .selectAll('.location-point')
      .data(validData, (d) => d.Location_ID)
      .join(
        (enter) =>
          enter
            .append('circle')
            .attr('class', 'location-point')
            .attr('cx', (d) => this._projectPoint(d)[0])
            .attr('cy', (d) => this._projectPoint(d)[1])
            .attr('r', 0)
            .attr('fill', (d) => this._getColor(d))
            .attr('opacity', this.options.pointOpacity)
            .call((enterSelection) =>
              enterSelection
                .transition()
                .duration(this.options.animationDuration)
                .attr('r', (d) => this._getRadius(d)),
            ),
        (update) =>
          update.call((updateSelection) =>
            updateSelection
              .transition()
              .duration(this.options.animationDuration)
              .attr('cx', (d) => this._projectPoint(d)[0])
              .attr('cy', (d) => this._projectPoint(d)[1])
              .attr('r', (d) => this._getRadius(d))
              .attr('fill', (d) => this._getColor(d))
              .attr('opacity', this.options.pointOpacity),
          ),
        (exit) =>
          exit.call((exitSelection) =>
            exitSelection
              .transition()
              .duration(this.options.animationDuration)
              .attr('r', 0)
              .remove(),
          ),
      );

    this._bindPointEvents();
  }

  _bindPointEvents() {
    if (!this.points) return;

    this.points
      .on('mouseenter', (event, d) => {
        d3.select(event.currentTarget).classed('is-hovered', true).raise();
        Tooltip.show(event, this._buildTooltip(d));
        eventBus.emit(EVENTS.LOCATION_HOVER, d);
        this.options.onHover?.(d);
      })
      .on('mouseleave', () => {
        this.points.classed('is-hovered', false);
        Tooltip.hide();
        eventBus.emit(EVENTS.LOCATION_HOVER, null);
      })
      .on('click', (event, d) => {
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
        nextSelected = [...prev, id].slice(-2);
      }
    } else {
      nextSelected = [id];
    }

    this.selectedIds = nextSelected;
    this.points.classed('is-selected', (d) => this.selectedIds?.includes(d.Location_ID));

    const payload = id ? { location, append, ids: nextSelected } : null;
    eventBus.emit(EVENTS.LOCATION_SELECT, payload);
    this.options.onClick?.(payload);
  }

  _projectPoint(datum) {
    const projected = this.projection([datum.Longitude, datum.Latitude]);
    return projected || [0, 0];
  }

  _getRadius(datum) {
    if (!Number.isFinite(datum.Population)) return this.options.radiusRange[0];
    return this.radiusScale(datum.Population);
  }

  _createProjection() {
    const projection = d3.geoMercator();
    const featureCollection = this.options.geoData;

    if (featureCollection?.features?.length) {
      // 只使用多边形类型的 features
      const polygonFeatures = featureCollection.features.filter((f) => {
        const type = f?.geometry?.type;
        return type === 'Polygon' || type === 'MultiPolygon';
      });

      if (polygonFeatures.length > 0) {
        const filteredCollection = {
          type: 'FeatureCollection',
          features: polygonFeatures,
        };

        const padding = 12;
        const extent = [
          [padding, padding],
          [Math.max(padding, this.width - padding), Math.max(padding, this.height - padding)],
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
    const mode = this.options.colorMode;
    if (mode === 'dao') {
      const daoIds = Array.from(
        new Set(
          this.data
            .map((d) =>
              d.Administrative_Level === '道' ? d.Location_ID : d.Parent_ID || d.daoId || d.daoName,
            )
            .filter(Boolean),
        ),
      );
      return createDaoColorScale(daoIds);
    }

    if (mode === 'product') {
      return null;
    }

    return null;
  }

  _getColor(datum) {
    if (this.options.colorMode === 'product') {
      return getProductTypeColor(datum.dominantProductType);
    }

    if (this.options.colorMode === 'level') {
      return getAdministrativeLevelColor(datum.Administrative_Level);
    }

    const daoId =
      datum.Administrative_Level === '道' ? datum.Location_ID : datum.Parent_ID || datum.daoId;
    return this.colorScale ? this.colorScale(daoId) : getDaoColor(daoId);
  }

  _buildTooltip(datum) {
    return Format.tooltip(datum.Location_Name, [
      { label: '所属道', value: datum.daoName || '-' },
      { label: '行政级别', value: datum.Administrative_Level || '-' },
      { label: '人口', value: formatPopulation(datum.Population) },
      { label: '户数', value: formatHouseholds(datum.Households) },
      { label: '户均人口', value: formatHouseholdSize(datum.householdSize) },
      { label: '物产种类', value: datum.productRichness },
      { label: '主导物产', value: datum.dominantProductType || '-' },
    ]);
  }

  _setupZoom() {
    if (!this.mapLayer) return;

    if (this.zoomBehavior) {
      this.svg.on('.zoom', null);
    }

    const baseStrokeWidth = this.options.boundaryStrokeWidth;

    this.zoomBehavior = d3
      .zoom()
      .scaleExtent([this.options.minZoom, this.options.maxZoom])
      .on('zoom', (event) => {
        this.mapLayer.attr('transform', event.transform);
        // 根据缩放级别调整边界线粗细，放大时线条变细
        this.boundaryLayer
          .selectAll('.map__boundary')
          .style('stroke-width', `${baseStrokeWidth / event.transform.k}px`);
      });

    this.svg.call(this.zoomBehavior);
  }

  highlight(ids = []) {
    const idSet = new Set(ids || []);
    this.points
      ?.classed('is-highlighted', (d) => idSet.has(d.Location_ID))
      .classed('is-dimmed', (d) => idSet.size > 0 && !idSet.has(d.Location_ID));
  }

  clearHighlight() {
    this.points?.classed('is-highlighted', false).classed('is-dimmed', false);
  }

  destroy() {
    if (this.zoomBehavior) {
      this.svg.on('.zoom', null);
    }
    super.destroy();
  }
}

export default MapView;
