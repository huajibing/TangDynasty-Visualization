// 地图视图：使用 D3-geo 绘制底图与地点标记，支持悬浮提示与点击选中。

import BaseChart from './BaseChart.js';
import { Tooltip } from '../components/tooltip.js';
import {
  createDaoColorScale,
  createPopulationRadiusScale,
} from '../utils/scales.js';
import {
  getAdministrativeLevelColor,
  getDaoColor,
  getProductTypeColor,
} from '../utils/colors.js';
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
    };
  }

  _setupScales() {
    this.projection = this._createProjection();
    this.pathGenerator = d3.geoPath().projection(this.projection);

    const populations = this.data
      .map(d => d.Population)
      .filter(value => Number.isFinite(value));
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

    this.boundaryLayer
      .selectAll('.map__boundary')
      .data(features, d => d?.properties?.code || d?.id || d?.properties?.name || Math.random())
      .join('path')
      .attr('class', 'map__boundary')
      .attr('d', feature => this.pathGenerator(feature));
  }

  _renderPoints() {
    const validData = this.data.filter(
      d => Number.isFinite(d.Latitude) && Number.isFinite(d.Longitude),
    );

    this.points = this.pointLayer
      .selectAll('.location-point')
      .data(validData, d => d.Location_ID)
      .join(
        enter =>
          enter
            .append('circle')
            .attr('class', 'location-point')
            .attr('cx', d => this._projectPoint(d)[0])
            .attr('cy', d => this._projectPoint(d)[1])
            .attr('r', 0)
            .attr('fill', d => this._getColor(d))
            .attr('opacity', this.options.pointOpacity)
            .call(enterSelection =>
              enterSelection
                .transition()
                .duration(this.options.animationDuration)
                .attr('r', d => this._getRadius(d)),
            ),
        update =>
          update.call(updateSelection =>
            updateSelection
              .transition()
              .duration(this.options.animationDuration)
              .attr('cx', d => this._projectPoint(d)[0])
              .attr('cy', d => this._projectPoint(d)[1])
              .attr('r', d => this._getRadius(d))
              .attr('fill', d => this._getColor(d))
              .attr('opacity', this.options.pointOpacity),
          ),
        exit =>
          exit.call(exitSelection =>
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
        this._handleSelection(d);
      });
  }

  _handleSelection(location) {
    const isSame = this.selectedId === location?.Location_ID;
    this.selectedId = isSame ? null : location?.Location_ID || null;

    this.points.classed('is-selected', d => d.Location_ID === this.selectedId);

    const payload = this.selectedId ? location : null;
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
    const features = this.options.geoData;

    if (features?.features?.length) {
      const padding = 12;
      projection.fitExtent(
        [
          [padding, padding],
          [this.width - padding, this.height - padding],
        ],
        features,
      );
      return projection;
    }

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
            .map(d =>
              d.Administrative_Level === '道'
                ? d.Location_ID
                : d.Parent_ID || d.daoId || d.daoName,
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

    this.zoomBehavior = d3
      .zoom()
      .scaleExtent([this.options.minZoom, this.options.maxZoom])
      .on('zoom', event => {
        this.mapLayer.attr('transform', event.transform);
      });

    this.svg.call(this.zoomBehavior);
  }

  highlight(ids = []) {
    const idSet = new Set(ids || []);
    this.points
      ?.classed('is-highlighted', d => idSet.has(d.Location_ID))
      .classed('is-dimmed', d => idSet.size > 0 && !idSet.has(d.Location_ID));
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
