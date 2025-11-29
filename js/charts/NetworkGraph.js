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
      nodeRadius: 8,
      linkStrength: 0.35,
      chargeStrength: -160,
      maxNodes: 120,
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

    this._renderLinks();
    this._renderNodes();
    this._setupSimulation();
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
    this.linkElements = this.chartGroup
      .selectAll('.network-link')
      .data(this.links, (d) => `${d.source}-${d.target}`)
      .join('line')
      .attr('class', 'network-link')
      .attr('stroke-width', (d) => this.linkWidthScale(d.count))
      .attr('stroke', 'rgba(52, 73, 94, 0.35)');
  }

  _renderNodes() {
    this.nodeElements = this.chartGroup
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

    this.nodeElements
      .select('circle')
      .attr('r', (d) => this.sizeScale(d.count))
      .attr('fill', COLORS.theme.primary)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.2);

    this.nodeElements
      .select('text')
      .attr('class', 'network-label')
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => this.sizeScale(d.count) + 12)
      .text((d) => d.name);

    this.nodeElements
      .on('mouseenter', (event, node) => {
        this._highlightConnected(node);
        Tooltip.show(event, this._formatTooltip(node));
        this.options.onHover?.(node);
      })
      .on('mouseleave', () => {
        this._clearHighlight();
        Tooltip.hide();
      })
      .on('click', (_event, node) => {
        eventBus.emit(EVENTS.PRODUCT_SELECT, node.name);
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
    this.simulation = d3
      .forceSimulation(this.nodes)
      .force(
        'link',
        d3
          .forceLink(this.links)
          .id((d) => d.id)
          .distance(() => 40)
          .strength(this.options.linkStrength),
      )
      .force('charge', d3.forceManyBody().strength(this.options.chargeStrength))
      .force('center', d3.forceCenter(this.width / 2, this.height / 2))
      .force(
        'collision',
        d3.forceCollide().radius((node) => this.sizeScale(node.count) + 6),
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

    this.nodeElements.classed('is-dimmed', (datum) => !connected.has(datum.id));
    this.linkElements.classed(
      'is-dimmed',
      (link) => link.source.id !== node.id && link.target.id !== node.id,
    );
  }

  _clearHighlight() {
    this.nodeElements?.classed('is-dimmed', false).classed('is-highlighted', false);
    this.linkElements?.classed('is-dimmed', false);
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
    const nameSet = new Set(productNames || []);
    this.nodeElements?.classed('is-highlighted', (node) => nameSet.has(node.name));
    this.linkElements?.classed('is-highlighted', (link) => {
      const sourceId = link.source.id || link.source;
      const targetId = link.target.id || link.target;
      return nameSet.has(sourceId) || nameSet.has(targetId);
    });
  }

  clearHighlight() {
    this._clearHighlight();
  }

  destroy() {
    if (this.simulation) {
      this.simulation.stop();
    }
    super.destroy();
  }
}

export default NetworkGraph;
