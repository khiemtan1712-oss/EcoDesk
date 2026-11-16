import * as lucide from "lucide";

// Expose lucide globally with icons included for compatibility
if (typeof window !== "undefined") {
  window.lucide = {
    ...lucide,
    createIcons: (opts = {}) =>
      lucide.createIcons({
        icons: lucide.icons,
        ...opts
      })
  };
}

/**
 * Inline SVG fallback definitions (Basic Rounded Lineal - Lucide style)
 * Ensures navigation & core storefront icons always render even if Lucide fails to load.
 */
const FALLBACK_ICONS = {
  House: [["path", { d: "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" }], ["path", { d: "M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" }]],
  Armchair: [["path", { d: "M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3" }], ["path", { d: "M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z" }], ["path", { d: "M5 18v2" }], ["path", { d: "M19 18v2" }]],
  Headset: [["path", { d: "M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3Z" }], ["path", { d: "M21 16v2a4 4 0 0 1-4 4h-5" }]],
  Settings2: [["path", { d: "M20 7h-9" }], ["path", { d: "M14 17H5" }], ["circle", { cx: "17", cy: "17", r: "3" }], ["circle", { cx: "7", cy: "7", r: "3" }]],
  Search: [["circle", { cx: "11", cy: "11", r: "8" }], ["path", { d: "m21 21-4.3-4.3" }]],
  Heart: [["path", { d: "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" }]],
  ShoppingBag: [["path", { d: "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" }], ["path", { d: "M3 6h18" }], ["path", { d: "M16 10a4 4 0 0 1-8 0" }]],
  Bell: [["path", { d: "M10.268 21a2 2 0 0 0 3.464 0" }], ["path", { d: "M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" }]],
  BellOff: [["path", { d: "M10.268 21a2 2 0 0 0 3.464 0" }], ["path", { d: "M17 17H4a1 1 0 0 1-.74-1.673C4.59 13.956 6 12.499 6 8a6 6 0 0 1 .258-1.742" }], ["path", { d: "m2 2 20 20" }], ["path", { d: "M8.668 3.01A6 6 0 0 1 18 8c0 2.687.77 4.653 1.707 6.05" }]],
  UserRound: [["circle", { cx: "12", cy: "8", r: "5" }], ["path", { d: "M20 21a8 8 0 0 0-16 0" }]],
  UserRoundPlus: [["path", { d: "M2 21a8 8 0 0 1 13.292-6" }], ["circle", { cx: "10", cy: "8", r: "5" }], ["path", { d: "M19 16v6" }], ["path", { d: "M22 19h-6" }]],
  User: [["path", { d: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" }], ["circle", { cx: "12", cy: "7", r: "4" }]],
  LogOut: [["path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" }], ["polyline", { points: "16 17 21 12 16 7" }], ["line", { x1: "21", x2: "9", y1: "12", y2: "12" }]],
  LogIn: [["path", { d: "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" }], ["polyline", { points: "10 17 15 12 10 7" }], ["line", { x1: "15", x2: "3", y1: "12", y2: "12" }]],
  Menu: [["line", { x1: "4", x2: "20", y1: "12", y2: "12" }], ["line", { x1: "4", x2: "20", y1: "6", y2: "6" }], ["line", { x1: "4", x2: "20", y1: "18", y2: "18" }]],
  X: [["path", { d: "M18 6 6 18" }], ["path", { d: "m6 6 12 12" }]],
  ChevronLeft: [["path", { d: "m15 18-6-6 6-6" }]],
  ChevronRight: [["path", { d: "m9 18 6-6-6-6" }]],
  ChevronDown: [["path", { d: "m6 9 6 6 6-6" }]],
  ChevronUp: [["path", { d: "m18 15-6-6-6 6" }]],
  ArrowRight: [["path", { d: "M5 12h14" }], ["path", { d: "m12 5 7 7-7 7" }]],
  ArrowLeft: [["path", { d: "m12 19-7-7 7-7" }], ["path", { d: "M19 12H5" }]],
  ArrowUpRight: [["path", { d: "M7 7h10v10" }], ["path", { d: "M7 17 17 7" }]],
  Check: [["path", { d: "M20 6 9 17l-5-5" }]],
  CheckCircle2: [["circle", { cx: "12", cy: "12", r: "10" }], ["path", { d: "m9 12 2 2 4-4" }]],
  XCircle: [["circle", { cx: "12", cy: "12", r: "10" }], ["path", { d: "m15 9-6 6" }], ["path", { d: "m9 9 6 6" }]],
  AlertTriangle: [["path", { d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" }], ["path", { d: "M12 9v4" }], ["path", { d: "M12 17h.01" }]],
  Clock: [["circle", { cx: "12", cy: "12", r: "10" }], ["polyline", { points: "12 6 12 12 16 14" }]],
  Package: [["path", { d: "M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" }], ["path", { d: "M12 22V12" }], ["path", { d: "m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7" }], ["path", { d: "m7.5 4.27 9 5.15" }]],
  Truck: [["path", { d: "M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" }], ["path", { d: "M15 18H9" }], ["path", { d: "M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" }], ["circle", { cx: "17", cy: "18", r: "2" }], ["circle", { cx: "7", cy: "18", r: "2" }]],
  CreditCard: [["rect", { width: "20", height: "14", x: "2", y: "5", rx: "2" }], ["line", { x1: "2", x2: "22", y1: "10", y2: "10" }]],
  MapPin: [["path", { d: "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" }], ["circle", { cx: "12", cy: "10", r: "3" }]],
  ShieldCheck: [["path", { d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" }], ["path", { d: "m9 12 2 2 4-4" }]],
  Sparkles: [["path", { d: "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" }], ["path", { d: "M20 3v4" }], ["path", { d: "M22 5h-4" }], ["path", { d: "M4 17v2" }], ["path", { d: "M5 18H3" }]],
  Layers2: [["path", { d: "m16.02 12 5.48 3.13a1 1 0 0 1 0 1.74L13 21.74a2 2 0 0 1-2 0l-8.5-4.87a1 1 0 0 1 0-1.74L7.98 12" }], ["path", { d: "M13 13.74a2 2 0 0 1-2 0L2.5 8.87a1 1 0 0 1 0-1.74L11 2.26a2 2 0 0 1 2 0l8.5 4.87a1 1 0 0 1 0 1.74Z" }]],
  Lock: [["rect", { width: "18", height: "11", x: "3", y: "11", rx: "2", ry: "2" }], ["path", { d: "M7 11V7a5 5 0 0 1 10 0v4" }]],
  Eye: [["path", { d: "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" }], ["circle", { cx: "12", cy: "12", r: "3" }]],
  EyeOff: [["path", { d: "M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" }], ["path", { d: "M14.084 14.158a3 3 0 0 1-4.242-4.242" }], ["path", { d: "M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" }], ["path", { d: "m2 2 20 20" }]]
};

/**
 * Convert kebab-case (e.g. shopping-bag, user-round, layers-2) to PascalCase (ShoppingBag, UserRound, Layers2)
 */
export function toPascalCase(str) {
  if (!str) return "";
  return String(str)
    .trim()
    .replace(/(^\w|-\w|_\w)/g, (m) => m.replace(/[-_]/g, "").toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "");
}

/**
 * Resolve icon attributes and child SVG primitives from bundled Lucide, global window.lucide, or inline fallback.
 */
function resolveIconSpec(name) {
  const pascal = toPascalCase(name);
  const iconRegistry = lucide?.icons || (typeof window !== "undefined" ? window.lucide?.icons : null) || {};
  const iconData = iconRegistry[pascal] || iconRegistry[name];

  if (Array.isArray(iconData)) {
    // Lucide v0.468 format: ["svg", defaultAttrs, children]
    if (iconData[0] === "svg") {
      return {
        defaultAttrs: iconData[1] || {},
        children: Array.isArray(iconData[2]) ? iconData[2] : []
      };
    }
    // Older tuple array format: [["path", {...}], ...]
    if (Array.isArray(iconData[0])) {
      return {
        defaultAttrs: { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24" },
        children: iconData
      };
    }
  }

  // Fallback inline SVG primitives
  const fallbackChildren = FALLBACK_ICONS[pascal] || FALLBACK_ICONS[name];
  if (fallbackChildren) {
    return {
      defaultAttrs: { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24" },
      children: fallbackChildren
    };
  }

  return null;
}

/**
 * Render a Lucide SVG string directly for template literals
 * @param {string} name - e.g. "shopping-bag", "heart", "search", "check"
 * @param {object} options - { size, strokeWidth, class, fill, stroke, ariaHidden, title, style }
 */
export function renderIcon(name, options = {}) {
  if (!name) return "";
  const hasExplicitSize = options.size != null;
  const size = Number(options.size) || 20;
  const strokeWidth = options.strokeWidth || 1.8;
  const fill = options.fill || "none";
  const stroke = options.stroke || "currentColor";
  const customClass = options.class || "";
  const ariaHidden = options.ariaHidden !== false;
  const title = options.title ? `<title>${options.title}</title>` : "";

  const spec = resolveIconSpec(name);
  if (spec) {
    const inlineSizeStyle = hasExplicitSize
      ? `width:${size}px;height:${size}px;flex-shrink:0;`
      : "";
    const combinedStyle = `${inlineSizeStyle}${options.style || ""}`.trim();

    const attrs = {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      ...spec.defaultAttrs,
      width: size,
      height: size,
      "stroke-width": strokeWidth,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      fill,
      stroke,
      class: `lucide lucide-${String(name).toLowerCase()} ${customClass}`.trim(),
      ...(combinedStyle ? { style: combinedStyle } : {}),
      ...(ariaHidden ? { "aria-hidden": "true" } : {})
    };

    const attrStr = Object.entries(attrs)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `${k}="${String(v).replace(/"/g, "&quot;")}"`)
      .join(" ");

    const innerSvg = spec.children
      .map(([tag, childAttrs]) => {
        const cStr = Object.entries(childAttrs || {})
          .map(([k, v]) => `${k}="${String(v).replace(/"/g, "&quot;")}"`)
          .join(" ");
        return `<${tag} ${cStr}/>`;
      })
      .join("");

    return `<svg ${attrStr}>${title}${innerSvg}</svg>`;
  }

  // Last-resort placeholder if icon name unknown
  return `<i data-lucide="${name}" class="lucide ${customClass}" ${ariaHidden ? 'aria-hidden="true"' : ""}></i>`;
}

/**
 * Create a live SVG DOM Element for a placeholder <i data-lucide="...">
 */
function createSvgNodeFromPlaceholder(placeholder, name) {
  const spec = resolveIconSpec(name);
  if (!spec) return null;

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");

  const existingClass = placeholder.getAttribute("class") || "";
  const combinedClasses = Array.from(
    new Set(["lucide", `lucide-${name.toLowerCase()}`, ...existingClass.split(/\s+/).filter(Boolean)])
  ).join(" ");

  const defaultAttrs = {
    xmlns: svgNS,
    viewBox: "0 0 24 24",
    width: "20",
    height: "20",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "1.8",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    ...spec.defaultAttrs,
    "stroke-width": "1.8",
    "stroke-linecap": "round",
    "stroke-linejoin": "round"
  };

  for (const [k, v] of Object.entries(defaultAttrs)) {
    if (k !== "class" && v !== undefined && v !== null) {
      svg.setAttribute(k, String(v));
    }
  }

  // Copy non-data-lucide attributes from placeholder (id, style, title, role, etc.)
  for (const attr of Array.from(placeholder.attributes)) {
    if (attr.name === "data-lucide" || attr.name === "icon-name" || attr.name === "class") continue;
    svg.setAttribute(attr.name, attr.value);
  }

  svg.setAttribute("class", combinedClasses);
  if (!svg.hasAttribute("aria-hidden") && !svg.hasAttribute("aria-label")) {
    svg.setAttribute("aria-hidden", "true");
  }

  for (const [tag, childAttrs] of spec.children) {
    const child = document.createElementNS(svgNS, tag);
    for (const [k, v] of Object.entries(childAttrs || {})) {
      child.setAttribute(k, String(v));
    }
    svg.appendChild(child);
  }

  return svg;
}

/**
 * Initialize all un-rendered <i data-lucide="..."> elements inside the container.
 * Uses :not(svg) so already-rendered SVGs are never duplicated or re-processed.
 */
export function initIcons(container = document) {
  if (typeof document === "undefined") return;
  try {
    const root = container && typeof container.querySelectorAll === "function" ? container : document;
    const placeholders = root.querySelectorAll("[data-lucide]:not(svg), [icon-name]:not(svg)");
    if (!placeholders.length) return;

    placeholders.forEach((el) => {
      const iconName = el.getAttribute("data-lucide") || el.getAttribute("icon-name");
      if (!iconName) return;
      const svgEl = createSvgNodeFromPlaceholder(el, iconName);
      if (svgEl && el.parentNode) {
        el.parentNode.replaceChild(svgEl, el);
      } else {
        console.warn(`[EcoDesk Icons] Icon "${iconName}" not found in Lucide or fallback registry.`);
      }
    });
  } catch (err) {
    console.warn("[EcoDesk Icons] Failed to init icons:", err);
  }
}

// Auto-run once DOM is ready if in browser
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initIcons());
  } else {
    initIcons();
  }
}

export default {
  renderIcon,
  initIcons,
  toPascalCase,
  lucide
};
