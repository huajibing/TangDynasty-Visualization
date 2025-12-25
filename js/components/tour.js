// 引导系统（Guide/Tour）：轻量非阻塞式步骤引导，支持首访自动弹出、跳过与在设置中重开。

const DEFAULT_STORAGE_KEY = "tang_tour_status";
const DEFAULT_VERSION = 1;
const HIGHLIGHT_CLASS = "tour-highlight";

function resolveStepTarget(step) {
  if (!step) return null;
  if (typeof step.target === "function") {
    try {
      return step.target() || null;
    } catch {
      return null;
    }
  }
  if (typeof step.target === "string" && step.target) {
    return document.querySelector(step.target);
  }
  return null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safeRect(el) {
  if (!el || !(el instanceof Element)) return null;
  const rect = el.getBoundingClientRect();
  if (!rect || (!rect.width && !rect.height)) return null;
  return rect;
}

function loadTourStatus(storageKey, version) {
  if (typeof window === "undefined") return { dismissed: false };
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return { dismissed: false };
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== version) return { dismissed: false };
    return {
      dismissed: Boolean(parsed.dismissed),
    };
  } catch {
    return { dismissed: false };
  }
}

function saveTourStatus(storageKey, version, status) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        version,
        updatedAt: Date.now(),
        dismissed: Boolean(status?.dismissed),
      }),
    );
  } catch {
    // ignore
  }
}

export class Tour {
  constructor(steps = [], options = {}) {
    this.steps = Array.isArray(steps) ? steps : [];
    this.options = {
      storageKey: options.storageKey || DEFAULT_STORAGE_KEY,
      version: Number.isFinite(options.version)
        ? options.version
        : DEFAULT_VERSION,
      onClose: typeof options.onClose === "function" ? options.onClose : null,
    };

    this.currentIndex = 0;
    this.isOpen = false;

    this.root = null;
    this.card = null;
    this.scrim = null;
    this.spotlight = null;
    this.dismissCheckbox = null;
    this.activeTarget = null;

    this._pendingRaf = null;
    this._onWindowChange = () => this.refresh();
  }

  mount() {
    if (this.root) return;

    const root = document.createElement("div");
    root.className = "tour";
    root.hidden = true;

    const scrim = document.createElement("div");
    scrim.className = "tour__scrim";

    const spotlight = document.createElement("div");
    spotlight.className = "tour__spotlight";
    spotlight.hidden = true;

    const card = document.createElement("div");
    card.className = "tour__card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "false");

    root.appendChild(scrim);
    root.appendChild(spotlight);
    root.appendChild(card);
    document.body.appendChild(root);

    this.root = root;
    this.card = card;
    this.scrim = scrim;
    this.spotlight = spotlight;
  }

  maybeAutoStart() {
    const status = loadTourStatus(
      this.options.storageKey,
      this.options.version,
    );
    if (status.dismissed) return;
    this.start({ force: false, source: "auto" });
  }

  start({ force = false } = {}) {
    if (!this.steps.length) return;
    this.mount();

    if (!force) {
      const status = loadTourStatus(
        this.options.storageKey,
        this.options.version,
      );
      if (status.dismissed) return;
    }

    this.isOpen = true;
    this.currentIndex = 0;
    this.root.hidden = false;

    window.addEventListener("resize", this._onWindowChange);
    window.addEventListener("scroll", this._onWindowChange, true);

    this._renderStep();
  }

  close({ persist = true } = {}) {
    if (!this.isOpen) return;
    this.isOpen = false;

    this._clearHighlight();
    this.root.hidden = true;

    window.removeEventListener("resize", this._onWindowChange);
    window.removeEventListener("scroll", this._onWindowChange, true);

    if (persist) {
      const dismissed = Boolean(this.dismissCheckbox?.checked);
      saveTourStatus(this.options.storageKey, this.options.version, {
        dismissed,
      });
    }

    this.options.onClose?.();
  }

  next() {
    if (!this.isOpen) return;
    if (this.currentIndex >= this.steps.length - 1) {
      this.close({ persist: true });
      return;
    }
    this.currentIndex = clamp(this.currentIndex + 1, 0, this.steps.length - 1);
    this._renderStep();
  }

  prev() {
    if (!this.isOpen) return;
    this.currentIndex = clamp(this.currentIndex - 1, 0, this.steps.length - 1);
    this._renderStep();
  }

  refresh() {
    if (!this.isOpen) return;
    const step = this.steps[this.currentIndex];
    if (step?.skipIfMissingTarget) {
      const target = resolveStepTarget(step);
      const rect = safeRect(target);
      if (!rect) {
        this.next();
        return;
      }
    }
    this._applyHighlight(resolveStepTarget(step), { scrollIntoView: false });
    this._schedulePosition();
  }

  _renderStep() {
    if (!this.card) return;

    let safety = 0;
    while (safety < this.steps.length) {
      const step = this.steps[this.currentIndex];
      if (!step?.skipIfMissingTarget) break;
      const target = resolveStepTarget(step);
      const rect = safeRect(target);
      if (rect) break;
      if (this.currentIndex >= this.steps.length - 1) break;
      this.currentIndex = clamp(
        this.currentIndex + 1,
        0,
        this.steps.length - 1,
      );
      safety += 1;
    }

    const step = this.steps[this.currentIndex];
    const total = this.steps.length;

    this.card.innerHTML = "";

    const header = document.createElement("div");
    header.className = "tour__header";

    const stepLabel = document.createElement("div");
    stepLabel.className = "tour__step";
    stepLabel.textContent = `步骤 ${this.currentIndex + 1}/${total}`;

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "tour__close";
    closeBtn.setAttribute("aria-label", "关闭引导");
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", () => this.close({ persist: true }));

    header.appendChild(stepLabel);
    header.appendChild(closeBtn);

    const title = document.createElement("h3");
    title.className = "tour__title";
    title.textContent = step?.title || "";

    const content = document.createElement("p");
    content.className = "tour__content";
    content.textContent = step?.content || "";

    const footer = document.createElement("div");
    footer.className = "tour__footer";

    const dismiss = document.createElement("label");
    dismiss.className = "tour__dismiss";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    const dismissText = document.createElement("span");
    dismissText.textContent = "下次不再自动弹出";
    dismiss.appendChild(checkbox);
    dismiss.appendChild(dismissText);
    this.dismissCheckbox = checkbox;

    const buttons = document.createElement("div");
    buttons.className = "tour__buttons";

    const skipBtn = document.createElement("button");
    skipBtn.type = "button";
    skipBtn.className = "tour__btn";
    skipBtn.textContent = "跳过";
    skipBtn.addEventListener("click", () => this.close({ persist: true }));

    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "tour__btn";
    prevBtn.textContent = "上一步";
    prevBtn.disabled = this.currentIndex <= 0;
    prevBtn.addEventListener("click", () => this.prev());

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "tour__btn is-primary";
    nextBtn.textContent = this.currentIndex >= total - 1 ? "完成" : "下一步";
    nextBtn.addEventListener("click", () => this.next());

    buttons.appendChild(skipBtn);
    buttons.appendChild(prevBtn);
    buttons.appendChild(nextBtn);

    footer.appendChild(dismiss);
    footer.appendChild(buttons);

    this.card.appendChild(header);
    if (title.textContent) this.card.appendChild(title);
    if (content.textContent) this.card.appendChild(content);
    this.card.appendChild(footer);

    this._applyHighlight(resolveStepTarget(step), { scrollIntoView: true });
    this._schedulePosition();
  }

  _schedulePosition() {
    if (this._pendingRaf) cancelAnimationFrame(this._pendingRaf);
    this._pendingRaf = requestAnimationFrame(() => {
      this._pendingRaf = null;
      this._positionCard();
    });
  }

  _positionCard() {
    if (!this.card) return;
    const step = this.steps[this.currentIndex];
    const target = resolveStepTarget(step);
    const rect = safeRect(target);
    this._positionSpotlight(rect, step);

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 12;

    const cardRect = this.card.getBoundingClientRect();
    const cardWidth = cardRect.width || 320;
    const cardHeight = cardRect.height || 180;

    if (!rect) {
      this.card.style.left = "50%";
      this.card.style.top = "50%";
      this.card.style.transform = "translate(-50%, -50%)";
      return;
    }

    const preferBelow = rect.bottom + margin + cardHeight <= viewportHeight;
    const top = preferBelow
      ? rect.bottom + margin
      : Math.max(margin, rect.top - cardHeight - margin);

    let left = rect.left;
    if (left + cardWidth > viewportWidth - margin) {
      left = viewportWidth - cardWidth - margin;
    }
    left = Math.max(margin, left);

    this.card.style.transform = "none";
    this.card.style.left = `${left}px`;
    this.card.style.top = `${top}px`;
  }

  _positionSpotlight(rect, step) {
    const spotlight = this.spotlight;
    const scrim = this.scrim;
    if (!spotlight || !scrim) return;

    if (!rect) {
      spotlight.hidden = true;
      scrim.hidden = false;
      return;
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = Number.isFinite(step?.spotlightPadding)
      ? step.spotlightPadding
      : 12;

    const left = clamp(rect.left - padding, 0, viewportWidth);
    const top = clamp(rect.top - padding, 0, viewportHeight);
    const right = clamp(rect.right + padding, 0, viewportWidth);
    const bottom = clamp(rect.bottom + padding, 0, viewportHeight);

    spotlight.hidden = false;
    scrim.hidden = true;
    spotlight.style.left = `${left}px`;
    spotlight.style.top = `${top}px`;
    spotlight.style.width = `${Math.max(0, right - left)}px`;
    spotlight.style.height = `${Math.max(0, bottom - top)}px`;
  }

  _applyHighlight(target, { scrollIntoView = true } = {}) {
    if (target && target === this.activeTarget) return;
    this._clearHighlight();
    if (!target) return;
    this.activeTarget = target;
    target.classList.add(HIGHLIGHT_CLASS);
    if (!scrollIntoView) return;
    target.scrollIntoView?.({
      block: "center",
      inline: "center",
      behavior: "smooth",
    });
  }

  _clearHighlight() {
    if (this.activeTarget) {
      this.activeTarget.classList.remove(HIGHLIGHT_CLASS);
    }
    this.activeTarget = null;
  }
}

export default Tour;
