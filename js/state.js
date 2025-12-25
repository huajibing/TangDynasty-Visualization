// 全局状态管理：集中存储筛选条件、选中项和高亮信息，并提供订阅接口。

const DEFAULT_STATE = {
  layoutMode: "floating", // floating | workspace
  basemap: "tang", // tang | modern
  selectedDaoId: null,
  selectedDaoIds: [],
  mapEncoding: {
    colorEncoding: "product", // dao | product | level
    markerEncoding: "population", // population | productRichness | householdSize | fixed
  },
  legendConfig: {
    showMarkerLegend: true,
  },
  highlightedIds: [],
  hoveredIds: [],
  selectedProduct: null,
  hoverLocationId: null,
  selection: {
    locationIds: [],
    asFilter: false,
  },
  comparison: {
    locations: [],
    daos: [],
  },
  filters: {
    daoIds: [],
    productTypes: [],
    levels: [],
    populationRange: null,
    householdRange: null,
    productRichnessRange: null,
  },
};

export class AppState {
  constructor(initialState = {}) {
    this._state = this._mergeState(DEFAULT_STATE, initialState);
    this._listeners = new Map();
  }

  get(key) {
    if (!key) return this._state;
    return this._state[key];
  }

  getState() {
    return this._deepClone(this._state);
  }

  set(key, value) {
    return this.update({ [key]: value });
  }

  update(partial = {}) {
    const nextState = this._mergeState(this._state, partial);
    const changedKeys = this._diffKeys(this._state, nextState);

    if (changedKeys.length === 0) {
      return this._state;
    }

    const previous = this._state;
    this._state = nextState;

    changedKeys.forEach((key) => {
      this._notify(key, this._state[key], previous[key]);
    });

    this._notify("*", this._state, previous);
    return this._state;
  }

  subscribe(key, callback) {
    const eventKey = key || "*";
    if (typeof callback !== "function") return () => {};

    if (!this._listeners.has(eventKey)) {
      this._listeners.set(eventKey, new Set());
    }
    const listeners = this._listeners.get(eventKey);
    listeners.add(callback);

    return () => {
      listeners.delete(callback);
    };
  }

  onChange(callback) {
    return this.subscribe("*", callback);
  }

  _mergeState(base, patch) {
    const merged = { ...(base || DEFAULT_STATE), ...(patch || {}) };
    merged.basemap = merged.basemap === "modern" ? "modern" : "tang";
    merged.mapEncoding = {
      ...(base?.mapEncoding || DEFAULT_STATE.mapEncoding),
      ...(patch?.mapEncoding || {}),
    };
    merged.mapEncoding.colorEncoding =
      typeof merged.mapEncoding.colorEncoding === "string"
        ? merged.mapEncoding.colorEncoding
        : DEFAULT_STATE.mapEncoding.colorEncoding;
    merged.mapEncoding.markerEncoding =
      typeof merged.mapEncoding.markerEncoding === "string"
        ? merged.mapEncoding.markerEncoding
        : DEFAULT_STATE.mapEncoding.markerEncoding;
    merged.legendConfig = {
      ...(base?.legendConfig || DEFAULT_STATE.legendConfig),
      ...(patch?.legendConfig || {}),
    };
    merged.legendConfig.showMarkerLegend =
      merged.legendConfig.showMarkerLegend !== false;
    merged.filters = {
      ...(base?.filters || DEFAULT_STATE.filters),
      ...(patch?.filters || {}),
    };
    merged.selection = {
      ...(base?.selection || DEFAULT_STATE.selection),
      ...(patch?.selection || {}),
    };
    merged.selection.locationIds = Array.isArray(merged.selection.locationIds)
      ? merged.selection.locationIds
      : [];
    merged.selection.asFilter = Boolean(merged.selection.asFilter);
    merged.selectedDaoIds = Array.isArray(merged.selectedDaoIds)
      ? merged.selectedDaoIds
      : [];
    merged.highlightedIds = Array.isArray(merged.highlightedIds)
      ? merged.highlightedIds
      : [];
    merged.hoveredIds = Array.isArray(merged.hoveredIds)
      ? merged.hoveredIds
      : [];
    merged.filters.daoIds = Array.isArray(merged.filters.daoIds)
      ? merged.filters.daoIds
      : [];
    merged.filters.productTypes = Array.isArray(merged.filters.productTypes)
      ? merged.filters.productTypes
      : [];
    merged.filters.levels = Array.isArray(merged.filters.levels)
      ? merged.filters.levels
      : [];

    const normalizeRange = (range) => {
      if (!Array.isArray(range) || range.length < 2) return null;
      const min = Number.isFinite(range[0]) ? range[0] : null;
      const max = Number.isFinite(range[1]) ? range[1] : null;
      return min === null && max === null ? null : [min, max];
    };

    merged.filters.populationRange = normalizeRange(
      merged.filters.populationRange,
    );
    merged.filters.householdRange = normalizeRange(
      merged.filters.householdRange,
    );
    merged.filters.productRichnessRange = normalizeRange(
      merged.filters.productRichnessRange,
    );
    merged.comparison = {
      ...(base?.comparison || DEFAULT_STATE.comparison),
      ...(patch?.comparison || {}),
    };
    merged.comparison.locations = Array.isArray(merged.comparison.locations)
      ? merged.comparison.locations.slice(0, 2)
      : [];
    merged.comparison.daos = Array.isArray(merged.comparison.daos)
      ? merged.comparison.daos.slice(0, 2)
      : [];

    return merged;
  }

  _diffKeys(prev, next) {
    return Object.keys(next).filter(
      (key) => !this._isEqual(prev[key], next[key]),
    );
  }

  _isEqual(a, b) {
    if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((value, index) => this._isEqual(value, b[index]));
    }
    if (a && b && typeof a === "object") {
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      for (const key of keys) {
        if (!this._isEqual(a[key], b[key])) return false;
      }
      return true;
    }
    return false;
  }

  _deepClone(target) {
    if (typeof structuredClone === "function") {
      return structuredClone(target);
    }
    return JSON.parse(JSON.stringify(target));
  }

  _notify(key, next, prev) {
    const listeners = this._listeners.get(key);
    if (!listeners) return;
    listeners.forEach((listener) => {
      try {
        listener(next, prev);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[AppState] listener failed", error);
      }
    });
  }
}
