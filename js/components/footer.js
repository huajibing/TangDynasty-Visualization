const FOOTER_STORAGE_KEY = "tang_footer_about_open";

function readStoredOpen(storageKey) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw === null) return null;
    return raw === "true";
  } catch {
    return null;
  }
}

function writeStoredOpen(storageKey, open) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, open ? "true" : "false");
  } catch {
    // ignore
  }
}

export function initCollapsibleFooter(options = {}) {
  const { storageKey = FOOTER_STORAGE_KEY, defaultOpen = false } = options;

  const footer = document.querySelector("[data-collapsible-footer]");
  if (!footer) return { destroy() {} };

  const details = footer.querySelector("details");
  if (!details) return { destroy() {} };

  const storedOpen = readStoredOpen(storageKey);
  details.open = storedOpen ?? defaultOpen;
  footer.classList.toggle("is-open", details.open);

  const onToggle = () => {
    footer.classList.toggle("is-open", details.open);
    writeStoredOpen(storageKey, details.open);
  };

  details.addEventListener("toggle", onToggle);

  return {
    destroy() {
      details.removeEventListener("toggle", onToggle);
    },
  };
}
