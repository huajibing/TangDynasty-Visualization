const DEFAULT_SPLIT_RATIO = 0.62;
const MIN_SPLIT_RATIO = 0.15;
const MAX_SPLIT_RATIO = 0.85;

function createId(prefix) {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now()}`;
}

export function createDefaultWorkspaceLayout() {
  const left = {
    type: "leaf",
    id: createId("leaf"),
    tabs: ["map"],
    active: "map",
  };

  const rightTop = {
    type: "leaf",
    id: createId("leaf"),
    tabs: ["sidebar"],
    active: "sidebar",
  };

  const rightBottom = {
    type: "leaf",
    id: createId("leaf"),
    tabs: ["datatable"],
    active: "datatable",
  };

  return {
    type: "split",
    direction: "row",
    ratio: DEFAULT_SPLIT_RATIO,
    first: left,
    second: {
      type: "split",
      direction: "column",
      ratio: 0.55,
      first: rightTop,
      second: rightBottom,
    },
  };
}

function collectWindowIds(node, set) {
  if (!node) return;
  if (node.type === "leaf") {
    (node.tabs || []).forEach((id) => set.add(id));
    return;
  }
  collectWindowIds(node.first, set);
  collectWindowIds(node.second, set);
}

function findLeafById(node, leafId, parent = null, parentKey = null) {
  if (!node) return null;
  if (node.type === "leaf") {
    return node.id === leafId ? { node, parent, parentKey } : null;
  }
  return (
    findLeafById(node.first, leafId, node, "first") ||
    findLeafById(node.second, leafId, node, "second")
  );
}

function findLeafContainingWindow(
  node,
  windowId,
  parent = null,
  parentKey = null,
) {
  if (!node) return null;
  if (node.type === "leaf") {
    return (node.tabs || []).includes(windowId)
      ? { node, parent, parentKey }
      : null;
  }
  return (
    findLeafContainingWindow(node.first, windowId, node, "first") ||
    findLeafContainingWindow(node.second, windowId, node, "second")
  );
}

function replaceChild(parent, key, nextNode) {
  if (!parent || !key) return;
  parent[key] = nextNode;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isHTMLElement(target) {
  return target instanceof HTMLElement;
}

export class WindowLayoutManager {
  constructor({
    root,
    windows,
    getWindowTitle,
    onLayoutChange,
    onResize,
  } = {}) {
    this.root = root;
    this.windows =
      windows instanceof Map ? windows : new Map(Object.entries(windows || {}));
    this.getWindowTitle =
      typeof getWindowTitle === "function" ? getWindowTitle : () => "";
    this.onLayoutChange =
      typeof onLayoutChange === "function" ? onLayoutChange : null;
    this.onResize = typeof onResize === "function" ? onResize : null;

    this.layout = null;
    this.activeLeafId = null;

    this._originalPlacements = new Map();
    this._dragState = null;
    this._currentDrop = null;
  }

  mount(layout) {
    if (!this.root) return;
    this.layout = layout;
    this._captureOriginalPlacements();
    this.render();
  }

  destroy() {
    this._cleanupDragState();
    this._restoreOriginalPlacements();
    if (this.root) {
      this.root.innerHTML = "";
    }
    this.layout = null;
    this.activeLeafId = null;
  }

  serialize() {
    return this.layout;
  }

  getOpenWindows() {
    const set = new Set();
    collectWindowIds(this.layout, set);
    return Array.from(set);
  }

  addWindow(windowId) {
    if (!this.layout || !this.windows.has(windowId)) return;
    if (windowId === "map") return;

    const existing = findLeafContainingWindow(this.layout, windowId);
    if (existing) {
      existing.node.active = windowId;
      this.activeLeafId = existing.node.id;
      this.render();
      this._emitChange();
      this._emitResize();
      return;
    }

    const target = this._resolveTargetLeafForNewWindow();
    if (!target) return;

    target.node.tabs = Array.isArray(target.node.tabs) ? target.node.tabs : [];
    target.node.tabs.push(windowId);
    target.node.active = windowId;
    this.activeLeafId = target.node.id;

    this.render();
    this._emitChange();
    this._emitResize();
  }

  removeWindow(windowId) {
    if (!this.layout) return;
    if (windowId === "map") return;

    const located = findLeafContainingWindow(this.layout, windowId);
    if (!located) return;

    const leaf = located.node;
    leaf.tabs = (leaf.tabs || []).filter((id) => id !== windowId);
    if (leaf.active === windowId) {
      leaf.active = leaf.tabs[0] || null;
    }

    this._collapseEmptyLeaves();
    this.render();
    this._emitChange();
    this._emitResize();
  }

  render() {
    if (!this.root || !this.layout) return;

    this._resetWorkspaceMountedFlags();
    this.root.innerHTML = "";
    this.root.appendChild(this._renderNode(this.layout));
    this._emitResize();
  }

  setLayout(layout) {
    this.layout = layout;
    this.render();
    this._emitChange();
  }

  _emitChange() {
    this.onLayoutChange?.(this.serialize());
  }

  _emitResize() {
    this.onResize?.();
  }

  _captureOriginalPlacements() {
    this.windows.forEach((element, windowId) => {
      if (!isHTMLElement(element)) return;
      if (this._originalPlacements.has(windowId)) return;
      this._originalPlacements.set(windowId, {
        parent: element.parentElement,
        nextSibling: element.nextSibling,
      });
    });
  }

  _restoreOriginalPlacements() {
    this.windows.forEach((element, windowId) => {
      const placement = this._originalPlacements.get(windowId);
      if (!placement || !isHTMLElement(element)) return;

      element.hidden = false;
      delete element.dataset.workspaceMounted;

      if (placement.parent) {
        placement.parent.insertBefore(element, placement.nextSibling || null);
      }
    });
  }

  _resetWorkspaceMountedFlags() {
    this.windows.forEach((element) => {
      if (!isHTMLElement(element)) return;
      delete element.dataset.workspaceMounted;
      element.hidden = false;
    });
  }

  _renderNode(node) {
    if (node.type === "leaf") {
      return this._renderLeaf(node);
    }
    return this._renderSplit(node);
  }

  _renderSplit(split) {
    const container = document.createElement("div");
    container.className = `workspace-split workspace-split--${split.direction}`;

    const paneA = document.createElement("div");
    paneA.className = "workspace-pane";
    paneA.appendChild(this._renderNode(split.first));

    const divider = document.createElement("div");
    divider.className = "workspace-divider";

    const paneB = document.createElement("div");
    paneB.className = "workspace-pane";
    paneB.appendChild(this._renderNode(split.second));

    container.appendChild(paneA);
    container.appendChild(divider);
    container.appendChild(paneB);

    const ratio = Number.isFinite(split.ratio)
      ? split.ratio
      : DEFAULT_SPLIT_RATIO;
    this._applySplitRatio(split, paneA, paneB, ratio);

    divider.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const rect = container.getBoundingClientRect();
      const isRow = split.direction === "row";

      const onMove = (e) => {
        const currentRect =
          rect.width && rect.height ? rect : container.getBoundingClientRect();
        const position = isRow
          ? e.clientX - currentRect.left
          : e.clientY - currentRect.top;
        const size = isRow ? currentRect.width : currentRect.height;
        if (!size) return;
        const next = clamp(position / size, MIN_SPLIT_RATIO, MAX_SPLIT_RATIO);
        split.ratio = next;
        this._applySplitRatio(split, paneA, paneB, next);
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        this._emitChange();
        this._emitResize();
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });

    return container;
  }

  _applySplitRatio(split, paneA, paneB, ratio) {
    const safe = clamp(
      Number(ratio) || DEFAULT_SPLIT_RATIO,
      MIN_SPLIT_RATIO,
      MAX_SPLIT_RATIO,
    );
    split.ratio = safe;
    const percent = safe * 100;
    const remain = 100 - percent;
    paneA.style.flex = `0 0 calc(${percent}% - 5px)`;
    paneB.style.flex = `0 0 calc(${remain}% - 5px)`;
  }

  _renderLeaf(leaf) {
    const container = document.createElement("div");
    container.className = "workspace-leaf";
    container.dataset.leafId = leaf.id;

    container.addEventListener("pointerdown", () => {
      this.activeLeafId = leaf.id;
    });

    const tabs = document.createElement("div");
    tabs.className = "workspace-tabs";

    const tabIds = Array.isArray(leaf.tabs) ? leaf.tabs.filter(Boolean) : [];
    if (!tabIds.includes(leaf.active) && tabIds.length > 0) {
      leaf.active = tabIds[0];
    }

    tabIds.forEach((windowId) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `workspace-tab${leaf.active === windowId ? " is-active" : ""}`;
      btn.textContent = this.getWindowTitle(windowId) || windowId;
      btn.dataset.windowId = windowId;
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        leaf.active = windowId;
        this.activeLeafId = leaf.id;
        this.render();
        this._emitChange();
      });
      btn.addEventListener("pointerdown", (event) => {
        this._startTabDrag(event, windowId, leaf.id);
      });
      tabs.appendChild(btn);
    });

    const content = document.createElement("div");
    content.className = "workspace-content";

    // dock/stack overlay
    const overlay = document.createElement("div");
    overlay.className = "workspace-drop-overlay";
    ["left", "top", "center", "bottom", "right"].forEach((zoneId) => {
      const zone = document.createElement("div");
      zone.className = "workspace-drop-zone";
      zone.dataset.zone = zoneId;
      overlay.appendChild(zone);
    });
    content.appendChild(overlay);

    const activeWindowId = leaf.active;
    if (activeWindowId && tabIds.includes(activeWindowId)) {
      const windowElement = this.windows.get(activeWindowId);
      if (isHTMLElement(windowElement)) {
        windowElement.dataset.workspaceMounted = "true";
        windowElement.hidden = false;
        content.appendChild(windowElement);
      }
    }

    container.appendChild(tabs);
    container.appendChild(content);

    return container;
  }

  _resolveTargetLeafForNewWindow() {
    if (!this.layout) return null;
    if (this.activeLeafId) {
      const found = findLeafById(this.layout, this.activeLeafId);
      if (found) return found;
    }
    const datatableLeaf = findLeafContainingWindow(this.layout, "datatable");
    if (datatableLeaf) return datatableLeaf;
    return this._findFirstLeaf();
  }

  _findFirstLeaf(node = this.layout, parent = null, parentKey = null) {
    if (!node) return null;
    if (node.type === "leaf") return { node, parent, parentKey };
    return (
      this._findFirstLeaf(node.first, node, "first") ||
      this._findFirstLeaf(node.second, node, "second")
    );
  }

  _startTabDrag(event, windowId, sourceLeafId) {
    if (!event.isPrimary) return;
    if (!this.layout) return;

    event.preventDefault();
    event.stopPropagation();

    this._cleanupDragState();
    this._dragState = { windowId, sourceLeafId };

    const onMove = (e) => this._handleDragMove(e);
    const onUp = (e) => this._handleDragEnd(e);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });

    this._dragState.cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }

  _handleDragMove(event) {
    if (!this._dragState) return;

    const element = document.elementFromPoint(event.clientX, event.clientY);
    const leafEl = element?.closest?.(".workspace-leaf");
    if (!leafEl) {
      this._clearDropTarget();
      return;
    }

    const leafId = leafEl.dataset.leafId;
    if (!leafId) {
      this._clearDropTarget();
      return;
    }

    if (leafId === this._dragState.sourceLeafId) {
      const source = findLeafById(this.layout, this._dragState.sourceLeafId);
      const sourceTabs = Array.isArray(source?.node?.tabs)
        ? source.node.tabs.filter(Boolean)
        : [];
      if (sourceTabs.length <= 1) {
        this._clearDropTarget();
        return;
      }
    }

    const rect = leafEl.getBoundingClientRect();
    const isOverTabs = Boolean(element?.closest?.(".workspace-tabs"));
    const relX = (event.clientX - rect.left) / rect.width;
    const relY = (event.clientY - rect.top) / rect.height;
    const zone = isOverTabs
      ? "center"
      : relX < 0.25
        ? "left"
        : relX > 0.75
          ? "right"
          : relY < 0.25
            ? "top"
            : relY > 0.75
              ? "bottom"
              : "center";

    if (leafId === this._dragState.sourceLeafId && zone === "center") {
      this._clearDropTarget();
      return;
    }

    this._setDropTarget(leafEl, leafId, zone);
  }

  _handleDragEnd() {
    if (!this._dragState) return;

    const { windowId, sourceLeafId } = this._dragState;
    const drop = this._currentDrop;
    this._cleanupDragState();

    if (!drop) return;
    const { leafId: targetLeafId, zone } = drop;
    this._clearDropTarget();

    this._dockWindow(windowId, sourceLeafId, targetLeafId, zone);
  }

  _dockWindow(windowId, sourceLeafId, targetLeafId, zone) {
    if (!this.layout) return;
    if (!targetLeafId || !zone) return;

    const source = findLeafById(this.layout, sourceLeafId);
    const target = findLeafById(this.layout, targetLeafId);
    if (!target) return;

    if (source?.node?.id === target.node.id && zone === "center") {
      target.node.active = windowId;
      this.activeLeafId = target.node.id;
      this.render();
      this._emitChange();
      return;
    }

    // 从源 leaf 移除
    if (source?.node) {
      source.node.tabs = (source.node.tabs || []).filter(
        (id) => id !== windowId,
      );
      if (source.node.active === windowId) {
        source.node.active = source.node.tabs[0] || null;
      }
    }

    if (zone === "center") {
      target.node.tabs = Array.isArray(target.node.tabs)
        ? target.node.tabs
        : [];
      if (!target.node.tabs.includes(windowId)) {
        target.node.tabs.push(windowId);
      }
      target.node.active = windowId;
      this.activeLeafId = target.node.id;
    } else {
      // 先确保目标 leaf 不包含该 window（同 leaf 内拖到边缘时）
      target.node.tabs = (target.node.tabs || []).filter(
        (id) => id !== windowId,
      );
      if (target.node.active === windowId) {
        target.node.active = target.node.tabs[0] || null;
      }

      const direction = zone === "left" || zone === "right" ? "row" : "column";
      const before = zone === "left" || zone === "top";
      const newLeaf = {
        type: "leaf",
        id: createId("leaf"),
        tabs: [windowId],
        active: windowId,
      };

      const split = {
        type: "split",
        direction,
        ratio: 0.5,
        first: before ? newLeaf : target.node,
        second: before ? target.node : newLeaf,
      };

      if (!target.parent) {
        this.layout = split;
      } else {
        replaceChild(target.parent, target.parentKey, split);
      }

      this.activeLeafId = newLeaf.id;
    }

    this._collapseEmptyLeaves();
    this.render();
    this._emitChange();
    this._emitResize();
  }

  _collapseEmptyLeaves() {
    if (!this.layout) return;

    const collapse = (node, parent = null, parentKey = null) => {
      if (!node) return;
      if (node.type === "leaf") return;

      collapse(node.first, node, "first");
      collapse(node.second, node, "second");

      const left = node.first;
      const right = node.second;
      const leftEmpty = left?.type === "leaf" && (left.tabs || []).length === 0;
      const rightEmpty =
        right?.type === "leaf" && (right.tabs || []).length === 0;

      if (leftEmpty && right) {
        if (!parent) this.layout = right;
        else replaceChild(parent, parentKey, right);
      } else if (rightEmpty && left) {
        if (!parent) this.layout = left;
        else replaceChild(parent, parentKey, left);
      }
    };

    collapse(this.layout);

    // 兜底：保证至少有 map
    const windows = new Set();
    collectWindowIds(this.layout, windows);
    if (!windows.has("map")) {
      const leaf = this._findFirstLeaf();
      if (leaf?.node?.type === "leaf") {
        leaf.node.tabs = Array.isArray(leaf.node.tabs) ? leaf.node.tabs : [];
        leaf.node.tabs.unshift("map");
        leaf.node.active = leaf.node.active || "map";
      }
    }
  }

  _setDropTarget(leafEl, leafId, zone) {
    if (
      this._currentDrop?.leafId === leafId &&
      this._currentDrop?.zone === zone
    )
      return;

    this._clearDropTarget();
    this._currentDrop = { leafId, zone, leafEl };
    leafEl.classList.add("is-drop-target");

    const zones = leafEl.querySelectorAll(".workspace-drop-zone");
    zones.forEach((z) => {
      z.classList.toggle("is-active", z.dataset.zone === zone);
    });
  }

  _clearDropTarget() {
    const drop = this._currentDrop;
    if (!drop) return;
    drop.leafEl?.classList?.remove("is-drop-target");
    drop.leafEl
      ?.querySelectorAll?.(".workspace-drop-zone")
      ?.forEach?.((z) => z.classList.remove("is-active"));
    this._currentDrop = null;
  }

  _cleanupDragState() {
    if (!this._dragState) return;
    this._dragState.cleanup?.();
    this._dragState = null;
    this._clearDropTarget();
  }
}
