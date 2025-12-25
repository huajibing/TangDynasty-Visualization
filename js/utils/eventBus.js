// 轻量级事件总线，用于跨组件通信（地图、直方图、散点图、网络图等）。

class EventBus {
  constructor() {
    this.events = new Map();
  }

  on(event, callback) {
    if (!event || typeof callback !== "function") return () => {};

    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    const listeners = this.events.get(event);
    listeners.add(callback);

    return () => this.off(event, callback);
  }

  once(event, callback) {
    if (!event || typeof callback !== "function") return () => {};
    const wrapper = (payload) => {
      callback(payload);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  off(event, callback) {
    if (!event) return;
    const listeners = this.events.get(event);
    if (!listeners) return;

    if (callback) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this.events.delete(event);
      }
    } else {
      this.events.delete(event);
    }
  }

  emit(event, payload) {
    const listeners = this.events.get(event);
    if (!listeners || listeners.size === 0) return;

    listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`[eventBus] handler for ${event} failed`, error);
      }
    });
  }

  clear(event) {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }
}

export const EVENTS = {
  LOCATION_SELECT: "location:select",
  LOCATION_HOVER: "location:hover",
  BRUSH_UPDATE: "brush:update",
  FILTER_CHANGE: "filter:change",
  PRODUCT_SELECT: "productSelected",
  DAO_SELECT: "daoSelected",
  HOUSEHOLD_RANGE_CHANGE: "householdRangeChanged",
  HISTOGRAM_BIN_HOVER: "histogram:binHover",
  PRODUCT_HOVER: "product:hover",
};

export const eventBus = new EventBus();

export default eventBus;
