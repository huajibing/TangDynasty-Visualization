// 图例组件：渲染颜色/符号对应关系。

function resolveContainer(target) {
  if (!target) return null;
  if (typeof target === "string") {
    return document.querySelector(target);
  }
  return target;
}

export class Legend {
  constructor(container) {
    this.container = resolveContainer(container);
  }

  render(sections = []) {
    if (!this.container) return;

    this.container.innerHTML = "";
    const validSections = (sections || []).filter(
      (section) => Array.isArray(section?.items) && section.items.length > 0,
    );

    if (validSections.length === 0) {
      const placeholder = document.createElement("div");
      placeholder.className = "legend legend--empty";
      placeholder.textContent = "暂无图例";
      this.container.appendChild(placeholder);
      return;
    }

    validSections.forEach((section) => {
      const sectionEl = document.createElement("div");
      // 根据标题添加 modifier 类名
      let sectionModifier = "";
      if (section.title?.includes("十道")) {
        sectionModifier = "legend__section--dao";
      } else if (section.title?.includes("物产")) {
        sectionModifier = "legend__section--product";
      } else if (section.title?.includes("行政")) {
        sectionModifier = "legend__section--level";
      }
      sectionEl.className = `legend__section ${sectionModifier}`.trim();

      if (section.title) {
        const title = document.createElement("div");
        title.className = "legend__title";
        title.textContent = section.title;
        sectionEl.appendChild(title);
      }

      const list = document.createElement("div");
      list.className = "legend__items";

      section.items.forEach((item) => {
        const row = document.createElement("div");
        row.className = "legend__item";

        const marker = document.createElement("span");
        marker.className =
          `legend__marker ${item.shape ? `legend__marker--${item.shape}` : ""}`.trim();
        marker.style.backgroundColor = item.color || "currentColor";
        if (Number.isFinite(item.size)) {
          const size = Math.max(10, Math.min(28, item.size));
          marker.style.width = `${size}px`;
          marker.style.height = `${size}px`;
        }
        if (item.stroke) {
          marker.style.borderColor = item.stroke;
        }
        marker.title = item.label || "";

        const label = document.createElement("span");
        label.className = "legend__label";
        label.textContent = item.label || "-";

        row.appendChild(marker);
        row.appendChild(label);
        list.appendChild(row);
      });

      sectionEl.appendChild(list);
      this.container.appendChild(sectionEl);
    });
  }

  destroy() {
    if (this.container) {
      this.container.innerHTML = "";
    }
  }
}
