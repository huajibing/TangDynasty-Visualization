// 全局状态管理占位模块
// 后续阶段将根据 ARCHITECTURE.md 中的 AppState 设计进行扩展。

export class AppState {
  constructor(initialState = {}) {
    this._state = { ...initialState };
    this._listeners = new Map();
  }

  get(key) {
    return this._state[key];
  }

  set(key, value) {
    const previous = this._state[key];
    this._state[key] = value;
    this._notify(key, value, previous);
  }

  subscribe(key, callback) {
    if (!this._listeners.has(key)) {
      this._listeners.set(key, new Set());
    }
    this._listeners.get(key).add(callback);
    return () => {
      this._listeners.get(key)?.delete(callback);
    };
  }

  _notify(key, next, prev) {
    const listeners = this._listeners.get(key);
    if (!listeners) return;
    listeners.forEach((listener) => listener(next, prev));
  }
}
