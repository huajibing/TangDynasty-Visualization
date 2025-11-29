// 物产共现网络图：基于物产共现关系构建力导向布局。

import BaseChart from './BaseChart.js';
import { Tooltip } from '../components/tooltip.js';
import { COLORS } from '../utils/colors.js';
import eventBus, { EVENTS } from '../utils/eventBus.js';

class NetworkGraph extends BaseChart {
  get defaultOptions() {
    return {
      ...super.defaultOptions,
      minCooccurrence: 2,
      linkDistance: 65,
      linkStrength: 0.35,
      chargeStrength: -100,
      centerStrength: 0.08,
      maxNodes: 120,
      zoomMinScale: 0.5,
      zoomMaxScale: 3,
    };
  }

  _setupScales() {
    if (this.simulation) {
      this.simulation.stop();
    }

    this._prepareData();

    const nodeCounts = this.nodes.map((node) => node.count);
    const linkCounts = this.links.map((link) => link.count);

    const nodeExtent = nodeCounts.length > 0 ? d3.extent(nodeCounts) : [1, 1];
    if (nodeExtent[0] === nodeExtent[1]) {
      nodeExtent[1] = nodeExtent[0] + 1;
    }

    const linkExtent = linkCounts.length > 0 ? d3.extent(linkCounts) : [1, 1];
    if (linkExtent[0] === linkExtent[1]) {
      linkExtent[1] = linkExtent[0] + 1;
    }

    this.sizeScale = d3.scaleSqrt().domain(nodeExtent).range([6, 18]).clamp(true);
    this.linkWidthScale = d3.scaleLinear().domain(linkExtent).range([1, 6]).clamp(true);
  }

  render() {
    this.chartGroup.selectAll('.chart__empty').remove();
    if (!this.nodes || this.nodes.length === 0) {
      this.chartGroup
        .selectAll('.chart__empty')
        .data([null])
        .join('text')
        .attr('class', 'chart__empty')
        .attr('x', this.width / 2)
        .attr('y', this.height / 2)
        .attr('text-anchor', 'middle')
        .text('暂无共现数据');
      return;
    }

    this._ensureLayers();
    this._renderLinks();
    this._renderNodes();
    this._setupSimulation();
    this._setupZoom();
    this._bindBackgroundClick();
  }

  _ensureLayers() {
    // graphLayer 作为缩放/平移的根节点，内部再分别挂载连线与节点层
    this.graphLayer = this.chartGroup
      .selectAll('.network-graph-layer')
      .data([null])
      .join('g')
      .attr('class', 'network-graph-layer');

    this.linkLayer = this.graphLayer
      .selectAll('.network-links-layer')
      .data([null])
      .join('g')
      .attr('class', 'network-links-layer');

    this.nodeLayer = this.graphLayer
      .selectAll('.network-nodes-layer')
      .data([null])
      .join('g')
      .attr('class', 'network-nodes-layer');
  }

  _prepareData() {
    const productIndex =
      this.options.productIndex instanceof Map
        ? this.options.productIndex
        : this._buildProductIndexFromData();

    const cooccurrence =
      this.options.cooccurrence instanceof Map
        ? this.options.cooccurrence
        : this._buildCooccurrenceFromData(productIndex);

    const minCount = this.options.minCooccurrence || 1;

    this.nodes = Array.from(productIndex.entries())
      .map(([name, ids]) => ({ id: name, name, count: ids.length }))
      .filter((node) => node.count >= 2);

    const nodeSet = new Set(this.nodes.map((node) => node.id));

    this.links = Array.from(cooccurrence.entries())
      .filter(([, count]) => count >= minCount)
      .map(([key, count]) => {
        const [source, target] = key.split('|');
        return { source, target, count };
      })
      .filter((link) => nodeSet.has(link.source) && nodeSet.has(link.target));

    if (this.options.maxNodes && this.nodes.length > this.options.maxNodes) {
      this.nodes = this.nodes.sort((a, b) => b.count - a.count).slice(0, this.options.maxNodes);
      const allowed = new Set(this.nodes.map((node) => node.id));
      this.links = this.links.filter(
        (link) => allowed.has(link.source) && allowed.has(link.target),
      );
    }
  }

  _buildProductIndexFromData() {
    const index = new Map();

    this.data.forEach((item) => {
      if (!item?.Products) return;
      Object.values(item.Products)
        .filter(Array.isArray)
        .flat()
        .forEach((product) => {
          const list = index.get(product) || [];
          list.push(item.Location_ID);
          index.set(product, list);
        });
    });

    return index;
  }

  _buildCooccurrenceFromData(productIndex) {
    const coMap = new Map();

    this.data.forEach((item) => {
      if (!item?.Products) return;
      const products = Object.values(item.Products)
        .filter(Array.isArray)
        .flat()
        .filter((product) => productIndex.has(product));

      for (let i = 0; i < products.length; i += 1) {
        for (let j = i + 1; j < products.length; j += 1) {
          const key = [products[i], products[j]].sort().join('|');
          coMap.set(key, (coMap.get(key) || 0) + 1);
        }
      }
    });

    return coMap;
  }

  _renderLinks() {
    this.linkElements = this.linkLayer
      .selectAll('.network-link')
      .data(this.links, (d) => `${d.source}-${d.target}`)
      .join('line')
      .attr('class', 'network-link')
      .attr('stroke-width', (d) => this.linkWidthScale(d.count))
      .attr('stroke', 'rgba(52, 73, 94, 0.35)')
      // 连线仅作为视觉背景，不参与交互命中，避免影响节点拖拽
      .attr('pointer-events', 'none');
  }

  _renderNodes() {
    this.nodeElements = this.nodeLayer
      .selectAll('.network-node')
      .data(this.nodes, (d) => d.id)
      .join(
        (enter) => {
          const group = enter.append('g').attr('class', 'network-node');
          group.append('circle');
          group.append('text');
          return group;
        },
        (update) => update,
        (exit) => exit.remove(),
      );

    const circles = this.nodeElements
      .select('circle')
      .attr('r', (d) => this.sizeScale(d.count))
      .attr('fill', COLORS.theme.primary)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.2);

    // 提升圆形的命中区域，便于拖拽与点击
    circles.attr('vector-effect', 'non-scaling-stroke');

    this.nodeElements
      .select('text')
      .attr('class', 'network-label')
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => this.sizeScale(d.count) + 12)
      .text((d) => d.name);

    this.nodeElements
      .on('mouseenter', (event, node) => {
        // 如果没有选中节点，才显示悬浮高亮效果
        if (!this.currentSelectedProduct) {
          this._highlightConnected(node);
        }
        Tooltip.show(event, this._formatTooltip(node));
        this.options.onHover?.(node);
      })
      .on('mouseleave', () => {
        // 如果有选中节点，恢复选中状态；否则清除高亮
        if (this.currentSelectedProduct) {
          this.highlight([this.currentSelectedProduct]);
        } else {
          this._clearHighlight();
        }
        Tooltip.hide();
      })
      .on('click', (event, node) => {
        // 阻止冒泡到背景点击，避免立刻触发"失焦"
        event.stopPropagation();
        const nextName = this.currentSelectedProduct === node.name ? null : node.name;
        eventBus.emit(EVENTS.PRODUCT_SELECT, nextName);
        this.options.onClick?.(node);
      });

    this.nodeElements.call(
      d3
        .drag()
        .on('start', (event, node) => this._dragStarted(event, node))
        .on('drag', (event, node) => this._dragged(event, node))
        .on('end', (event, node) => this._dragEnded(event, node)),
    );
  }

  _setupSimulation() {
    if (this.simulation) {
      this.simulation.stop();
    }

    const { linkDistance, linkStrength, chargeStrength, centerStrength } = this.options;

    this.simulation = d3
      .forceSimulation(this.nodes)
      .force(
        'link',
        d3
          .forceLink(this.links)
          .id((d) => d.id)
          .distance(linkDistance)
          .strength(linkStrength),
      )
      .force('charge', d3.forceManyBody().strength(chargeStrength))
      .force('center', d3.forceCenter(this.width / 2, this.height / 2))
      // X/Y 吸引力：让不同连通分量向中心聚拢，避免过于分散
      .force('x', d3.forceX(this.width / 2).strength(centerStrength))
      .force('y', d3.forceY(this.height / 2).strength(centerStrength))
      .force(
        'collision',
        d3.forceCollide().radius((node) => this.sizeScale(node.count) + 4),
      )
      .on('tick', () => this._tick());
  }

  _tick() {
    this.linkElements
      ?.attr('x1', (d) => (typeof d.source === 'object' ? d.source.x : 0))
      .attr('y1', (d) => (typeof d.source === 'object' ? d.source.y : 0))
      .attr('x2', (d) => (typeof d.target === 'object' ? d.target.x : 0))
      .attr('y2', (d) => (typeof d.target === 'object' ? d.target.y : 0));

    this.nodeElements?.attr('transform', (d) => `translate(${d.x},${d.y})`);
  }

  _dragStarted(event, node) {
    if (!event.active) this.simulation.alphaTarget(0.3).restart();
    node.fx = node.x;
    node.fy = node.y;
  }

  _dragged(event, node) {
    node.fx = event.x;
    node.fy = event.y;
  }

  _dragEnded(event, node) {
    if (!event.active) this.simulation.alphaTarget(0);
    node.fx = null;
    node.fy = null;
  }

  _highlightConnected(node) {
    const connected = new Set([node.id]);
    this.links.forEach((link) => {
      const sourceId = link.source.id || link.source;
      const targetId = link.target.id || link.target;
      if (sourceId === node.id) connected.add(targetId);
      if (targetId === node.id) connected.add(sourceId);
    });

    this.nodeElements
      .classed('is-highlighted', (datum) => datum.id === node.id)
      .classed('is-connected', (datum) => connected.has(datum.id) && datum.id !== node.id)
      .classed('is-dimmed', (datum) => !connected.has(datum.id));

    // 动态调整节点圆的半径
    this.nodeElements.select('circle')
      .transition()
      .duration(180)
      .attr('r', (datum) => {
        const baseR = this.sizeScale(datum.count);
        if (datum.id === node.id) return baseR * 1.5;
        if (connected.has(datum.id)) return baseR * 1.15;
        return baseR;
      });

    this.linkElements
      .classed('is-highlighted', (link) => link.source.id === node.id || link.target.id === node.id)
      .classed('is-dimmed', (link) => link.source.id !== node.id && link.target.id !== node.id);

    // 动态调整边的宽度
    this.linkElements
      .transition()
      .duration(180)
      .attr('stroke-width', (link) => {
        const baseWidth = this.linkWidthScale(link.count);
        if (link.source.id === node.id || link.target.id === node.id) return baseWidth * 2;
        return baseWidth;
      });
  }

  _clearHighlight() {
    this.nodeElements
      ?.classed('is-dimmed', false)
      .classed('is-highlighted', false)
      .classed('is-connected', false);

    // 恢复节点原始半径
    this.nodeElements?.select('circle')
      .transition()
      .duration(180)
      .attr('r', (node) => this.sizeScale(node.count));

    this.linkElements?.classed('is-dimmed', false).classed('is-highlighted', false);

    // 恢复边的原始宽度
    this.linkElements
      ?.transition()
      .duration(180)
      .attr('stroke-width', (link) => this.linkWidthScale(link.count));
  }

  _formatTooltip(node) {
    return `
      <div class="tooltip__title">${node.name}</div>
      <div class="tooltip__content">
        <div class="tooltip__row">
          <span class="tooltip__label">关联地点数</span>
          <span class="tooltip__value">${node.count}</span>
        </div>
      </div>
    `;
  }

  highlight(productNames = []) {
    this.currentSelectedProduct = Array.isArray(productNames) && productNames.length > 0
      ? productNames[0]
      : null;

    const nameSet = new Set(productNames || []);
    const hasSelection = nameSet.size > 0;

    // 找出所有与选中节点相连的节点
    const connectedNodes = new Set(nameSet);
    if (hasSelection) {
      this.links.forEach((link) => {
        const sourceId = link.source.id || link.source;
        const targetId = link.target.id || link.target;
        if (nameSet.has(sourceId)) connectedNodes.add(targetId);
        if (nameSet.has(targetId)) connectedNodes.add(sourceId);
      });
    }

    // 设置节点状态
    this.nodeElements
      ?.classed('is-highlighted', (node) => nameSet.has(node.name))
      .classed('is-connected', (node) => hasSelection && connectedNodes.has(node.id) && !nameSet.has(node.name))
      .classed('is-dimmed', (node) => hasSelection && !connectedNodes.has(node.id));

    // 动态调整节点圆的半径以实现放大效果
    this.nodeElements?.select('circle')
      .transition()
      .duration(180)
      .attr('r', (node) => {
        const baseR = this.sizeScale(node.count);
        if (nameSet.has(node.name)) return baseR * 1.5; // 选中节点放大 1.5 倍
        if (hasSelection && connectedNodes.has(node.id)) return baseR * 1.15; // 相连节点略微放大
        return baseR;
      });

    // 设置边状态
    this.linkElements
      ?.classed('is-highlighted', (link) => {
        const sourceId = link.source.id || link.source;
        const targetId = link.target.id || link.target;
        return nameSet.has(sourceId) || nameSet.has(targetId);
      })
      .classed('is-dimmed', (link) => {
        if (!hasSelection) return false;
        const sourceId = link.source.id || link.source;
        const targetId = link.target.id || link.target;
        return !nameSet.has(sourceId) && !nameSet.has(targetId);
      });

    // 动态调整高亮边的宽度
    this.linkElements
      ?.transition()
      .duration(180)
      .attr('stroke-width', (link) => {
        const baseWidth = this.linkWidthScale(link.count);
        const sourceId = link.source.id || link.source;
        const targetId = link.target.id || link.target;
        if (nameSet.has(sourceId) || nameSet.has(targetId)) return baseWidth * 2;
        return baseWidth;
      });
  }

  clearHighlight() {
    this.currentSelectedProduct = null;
    this._clearHighlight();
  }

  _setupZoom() {
    if (!this.svg || !this.graphLayer) return;

    const minScale = this.options.zoomMinScale || 0.5;
    const maxScale = this.options.zoomMaxScale || 3;

    if (!this.zoomBehavior) {
      this.zoomBehavior = d3
        .zoom()
        .scaleExtent([minScale, maxScale])
        .on('zoom', (event) => {
          this.graphLayer.attr('transform', event.transform);
          this.currentTransform = event.transform;
          // 有源事件说明是用户交互，后续不要自动居中了
          if (event.sourceEvent) {
            this.hasUserTransform = true;
          }
        });

      this.svg.call(this.zoomBehavior);
    }

    const transform = this.currentTransform || d3.zoomIdentity;
    this.svg.call(this.zoomBehavior.transform, transform);
  }

  _centerAfterSimulation() {
    if (!this.nodes || this.nodes.length === 0) return;
    if (!this.svg || !this.zoomBehavior) return;
    // 如果用户已经手动平移/缩放，就不再强制居中，避免打断交互
    if (this.hasUserTransform) return;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    this.nodes.forEach((node) => {
      if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x);
      minY = Math.min(minY, node.y);
      maxY = Math.max(maxY, node.y);
    });

    if (!Number.isFinite(minX) || !Number.isFinite(maxX) || minX === maxX) return;

    const width = maxX - minX || 1;
    const height = maxY - minY || 1;
    const paddingFactor = 1.4;

    const scale = Math.min(
      this.width / (width * paddingFactor),
      this.height / (height * paddingFactor),
      this.options.zoomMaxScale || 3,
    );

    const centerX = minX + width / 2;
    const centerY = minY + height / 2;

    const transform = d3.zoomIdentity
      .translate(this.width / 2, this.height / 2)
      .scale(scale)
      .translate(-centerX, -centerY);

    this.currentTransform = transform;

    this.svg
      .transition()
      .duration(400)
      .call(this.zoomBehavior.transform, transform);
  }

  _bindBackgroundClick() {
    if (!this.svg) return;
    // 点击网络图背景区域时清除当前物产聚焦
    this.svg.on('click.network-clear', (event) => {
      const target = event.target;
      if (target && typeof target.closest === 'function') {
        if (target.closest('.network-node')) return;
      }
      eventBus.emit(EVENTS.PRODUCT_SELECT, null);
    });
  }

  destroy() {
    if (this.simulation) {
      this.simulation.stop();
    }
    if (this.svg && this.zoomBehavior) {
      this.svg.on('.zoom', null);
      this.svg.on('click.network-clear', null);
    }
    super.destroy();
  }
}

export default NetworkGraph;
