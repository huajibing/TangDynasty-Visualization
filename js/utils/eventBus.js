// 轻量级事件总线占位实现

export const eventBus = {
  _listeners: new Map(),

  on(eventName, handler) {
    if (!this._listeners.has(eventName)) {
      this._listeners.set(eventName, new Set());
    }
    this._listeners.get(eventName).add(handler);
  },

  off(eventName, handler) {
    const handlers = this._listeners.get(eventName);
    if (!handlers) return;
    handlers.delete(handler);
  },

  emit(eventName, payload) {
    const handlers = this._listeners.get(eventName);
    if (!handlers) return;
    handlers.forEach((handler) => handler(payload));
  },
};
