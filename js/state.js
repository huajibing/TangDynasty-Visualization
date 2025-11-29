// 全局状态管理：集中存储筛选条件、选中项和高亮信息，并提供订阅接口。

const DEFAULT_STATE = {
  selectedDaoId: null,
  selectedLocationIds: [],
  highlightedIds: [],
  selectedProduct: null,
  hoverLocationId: null,
  filters: {
    daoIds: [],
    productTypes: [],
    householdRange: null,
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

    changedKeys.forEach(key => {
      this._notify(key, this._state[key], previous[key]);
    });

    this._notify('*', this._state, previous);
    return this._state;
  }

  subscribe(key, callback) {
    const eventKey = key || '*';
    if (typeof callback !== 'function') return () => {};

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
    return this.subscribe('*', callback);
  }

  _mergeState(base, patch) {
    const merged = { ...(base || DEFAULT_STATE), ...(patch || {}) };
    merged.filters = {
      ...(base?.filters || DEFAULT_STATE.filters),
      ...(patch?.filters || {}),
    };
    merged.selectedLocationIds = Array.isArray(merged.selectedLocationIds)
      ? merged.selectedLocationIds
      : [];
    merged.highlightedIds = Array.isArray(merged.highlightedIds)
      ? merged.highlightedIds
      : [];
    merged.filters.daoIds = Array.isArray(merged.filters.daoIds)
      ? merged.filters.daoIds
      : [];
    merged.filters.productTypes = Array.isArray(merged.filters.productTypes)
      ? merged.filters.productTypes
      : [];

    return merged;
  }

  _diffKeys(prev, next) {
    return Object.keys(next).filter(key => !this._isEqual(prev[key], next[key]));
  }

  _isEqual(a, b) {
    if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((value, index) => this._isEqual(value, b[index]));
    }
    if (a && b && typeof a === 'object') {
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      for (const key of keys) {
        if (!this._isEqual(a[key], b[key])) return false;
      }
      return true;
    }
    return false;
  }

  _deepClone(target) {
    if (typeof structuredClone === 'function') {
      return structuredClone(target);
    }
    return JSON.parse(JSON.stringify(target));
  }

  _notify(key, next, prev) {
    const listeners = this._listeners.get(key);
    if (!listeners) return;
    listeners.forEach(listener => {
      try {
        listener(next, prev);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[AppState] listener failed', error);
      }
    });
  }
}
