import { initStore, getCategories, getProducts, normalizeProductTags } from "./storage.js";
import {
  $,
  escapeHtml,
  findProductByIdentifier,
  formatPrice,
  getCategoryName,
  normalizeSearchText,
  productCard,
  resolveColorSwatch,
  sortProducts
} from "./utils.js";
import { revealOnScroll } from "./scroll-reveal.js";
import { renderIcon, initIcons } from "./icons.js";
import { syncWishlistButtons } from "./favorites.js";
import { getPricing } from "./commerce.js";

const PRICE_PRESETS = [
  { key: "all", label: "Tất cả mức giá", min: null, max: null },
  { key: "under500", label: "Dưới 500.000đ", min: null, max: 499999 },
  { key: "500to2m", label: "500.000đ – 2.000.000đ", min: 500000, max: 2000000 },
  { key: "2mto5m", label: "2.000.000đ – 5.000.000đ", min: 2000000, max: 5000000 },
  { key: "over5m", label: "Trên 5.000.000đ", min: 5000001, max: null }
];

const LEGACY_PRICE_MAP = {
  under300: { min: null, max: 299999, label: "Dưới 300.000đ" },
  "300to800": { min: 300000, max: 800000, label: "300.000đ – 800.000đ" },
  over800: { min: 800001, max: null, label: "Trên 800.000đ" }
};

const STOCK_OPTIONS = [
  { key: "all", label: "Tất cả tình trạng" },
  { key: "in_stock", label: "Còn hàng" },
  { key: "low_stock", label: "Sắp hết hàng" },
  { key: "out_of_stock", label: "Tạm hết hàng" }
];

const VALID_SORTS = new Set([
  "relevance",
  "newest",
  "soldDesc",
  "priceAsc",
  "priceDesc",
  "nameAsc",
  "nameDesc",
  "oldest"
]);

const state = {
  search: "",
  category: "all",
  product: "",
  price: "all",
  minPrice: "",
  maxPrice: "",
  stock: "all",
  sort: "newest",
  attrs: {}
};

function getProductStockState(product) {
  const hasVariants = Array.isArray(product?.variants) && product.variants.length > 0;
  let totalStock = 0;
  if (hasVariants) {
    totalStock = product.variants.reduce((sum, v) => sum + Math.max(0, Number(v.stock) || 0), 0);
  } else {
    totalStock = Math.max(0, Number(product?.stock) || 0);
  }
  const statusStr = String(product?.status || "");
  const isOut = totalStock <= 0 || statusStr === "Hết hàng" || statusStr === "Tạm hết hàng" || statusStr === "Ngừng kinh doanh";
  const isLow = !isOut && totalStock <= 15;
  return { totalStock, isOut, isLow };
}

function getPriceRangeBounds() {
  if (state.minPrice !== "" || state.maxPrice !== "") {
    const min = state.minPrice !== "" && !isNaN(Number(state.minPrice)) ? Math.max(0, Number(state.minPrice)) : null;
    const max = state.maxPrice !== "" && !isNaN(Number(state.maxPrice)) ? Math.max(0, Number(state.maxPrice)) : null;
    return { min, max };
  }
  const preset = PRICE_PRESETS.find((p) => p.key === state.price);
  if (preset) return { min: preset.min, max: preset.max };
  const legacy = LEGACY_PRICE_MAP[state.price];
  if (legacy) return { min: legacy.min, max: legacy.max };
  return { min: null, max: null };
}

function productMatchesPrice(product, bounds) {
  if (bounds.min == null && bounds.max == null) return true;
  const hasVariants = Array.isArray(product?.variants) && product.variants.length > 0;
  let candidatePrices = [];
  if (hasVariants) {
    candidatePrices = product.variants.map((v) => {
      const raw = v.price != null && !isNaN(v.price) ? Number(v.price) : Number(product.price || 0);
      return getPricing({ ...product, price: raw }, new Date(), v).price;
    });
  } else {
    candidatePrices = [getPricing(product).price];
  }
  return candidatePrices.some((p) => {
    if (bounds.min != null && p < bounds.min) return false;
    if (bounds.max != null && p > bounds.max) return false;
    return true;
  });
}

function productMatchesSearch(product, rawSearch) {
  const normQuery = normalizeSearchText(rawSearch);
  if (!normQuery) return true;
  const haystack = normalizeSearchText([
    product.name,
    product.id,
    product.description,
    normalizeProductTags(product.tags).join(" "),
    ...(Array.isArray(product.variants)
      ? product.variants.map((v) => `${v.name || ""} ${v.sku || ""} ${Object.values(v.options || {}).join(" ")}`)
      : [])
  ].join(" "));
  const tokens = normQuery.split(/\s+/).filter(Boolean);
  return tokens.every((tok) => haystack.includes(tok));
}

function productMatchesAttrs(product, attrsMap) {
  const entries = Object.entries(attrsMap || {}).filter(([, vals]) => Array.isArray(vals) && vals.length > 0);
  if (entries.length === 0) return true;
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (variants.length === 0) return false;

  return variants.some((variant) => {
    if (!variant.options || typeof variant.options !== "object") return false;
    return entries.every(([attrName, allowedVals]) => {
      const val = String(variant.options[attrName] || "").trim();
      return allowedVals.includes(val);
    });
  });
}

function extractCategoryAttributes(products) {
  const attrMap = new Map();
  for (const product of products) {
    if (!Array.isArray(product.variants) || product.variants.length === 0) continue;
    const perProductSeen = new Set();
    for (const v of product.variants) {
      if (!v.options || typeof v.options !== "object") continue;
      for (const [rawKey, rawVal] of Object.entries(v.options)) {
        const attrName = String(rawKey || "").trim();
        const attrVal = String(rawVal || "").trim();
        if (!attrName || !attrVal) continue;
        if (!attrMap.has(attrName)) attrMap.set(attrName, new Map());
        const valMap = attrMap.get(attrName);
        if (!valMap.has(attrVal)) valMap.set(attrVal, new Set());
        valMap.get(attrVal).add(product.id);
        perProductSeen.add(`${attrName}::${attrVal}`);
      }
    }
  }

  return Array.from(attrMap.entries())
    .map(([name, valMap]) => ({
      name,
      values: Array.from(valMap.entries())
        .map(([value, idSet]) => ({ value, count: idSet.size }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "vi"))
    }))
    .filter((attr) => attr.values.length > 0);
}

function pruneStaleAttributeFilters(availableAttrs) {
  const validByName = new Map(availableAttrs.map((a) => [a.name, new Set(a.values.map((v) => v.value))]));
  let changed = false;
  for (const [attrName, vals] of Object.entries(state.attrs)) {
    const allowedSet = validByName.get(attrName);
    if (!allowedSet) {
      delete state.attrs[attrName];
      changed = true;
      continue;
    }
    const nextVals = (vals || []).filter((v) => allowedSet.has(v));
    if (nextVals.length !== (vals || []).length) changed = true;
    if (nextVals.length > 0) state.attrs[attrName] = nextVals;
    else delete state.attrs[attrName];
  }
  return changed;
}

function readStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  state.search = params.get("search") || "";
  state.category = params.get("category") || "all";
  state.product = (params.get("product") || "").trim();
  state.price = params.get("price") || "all";
  state.minPrice = params.get("minPrice") || "";
  state.maxPrice = params.get("maxPrice") || "";
  state.stock = STOCK_OPTIONS.some((o) => o.key === params.get("stock")) ? params.get("stock") : "all";

  const rawSort = params.get("sort");
  if (rawSort && VALID_SORTS.has(rawSort)) {
    state.sort = rawSort;
  } else {
    state.sort = state.search.trim() ? "relevance" : "newest";
  }
  if (state.sort === "relevance" && !state.search.trim()) {
    state.sort = "newest";
  }

  state.attrs = {};
  params.getAll("attr").forEach((entry) => {
    const idx = entry.indexOf(":");
    if (idx <= 0) return;
    const key = entry.slice(0, idx).trim();
    const vals = entry
      .slice(idx + 1)
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    if (key && vals.length > 0) {
      state.attrs[key] = Array.from(new Set(vals));
    }
  });
}

function writeStateToUrl() {
  const params = new URLSearchParams();
  if (state.search.trim()) params.set("search", state.search.trim());
  if (state.category && state.category !== "all") params.set("category", state.category);
  if (state.product) params.set("product", state.product);
  if (state.minPrice !== "" || state.maxPrice !== "") {
    if (state.minPrice !== "") params.set("minPrice", state.minPrice);
    if (state.maxPrice !== "") params.set("maxPrice", state.maxPrice);
  } else if (state.price && state.price !== "all") {
    params.set("price", state.price);
  }
  if (state.stock && state.stock !== "all") params.set("stock", state.stock);
  if (state.sort && state.sort !== "newest") {
    if (state.sort !== "relevance" || state.search.trim()) {
      params.set("sort", state.sort);
    }
  }
  for (const [attrName, vals] of Object.entries(state.attrs)) {
    if (Array.isArray(vals) && vals.length > 0) {
      params.append("attr", `${attrName}:${vals.join("|")}`);
    }
  }

  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}`;
  if (nextUrl !== `${window.location.pathname}${window.location.search}`) {
    window.history.replaceState(null, "", nextUrl);
  }
}

function getActiveFilterCount() {
  let count = 0;
  if (state.search.trim()) count++;
  if (state.category !== "all") count++;
  if (state.product) count++;
  if (state.minPrice !== "" || state.maxPrice !== "" || state.price !== "all") count++;
  if (state.stock !== "all") count++;
  for (const vals of Object.values(state.attrs)) {
    if (Array.isArray(vals)) count += vals.length;
  }
  return count;
}

function renderCategoryFilterList(categories, visibleProducts) {
  const container = $("#categoryFilterList");
  if (!container) return;

  const counts = new Map();
  visibleProducts.forEach((p) => {
    counts.set(p.categoryId, (counts.get(p.categoryId) || 0) + 1);
  });

  const items = [
    { id: "all", name: "Tất cả sản phẩm", count: visibleProducts.length },
    ...categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      count: counts.get(cat.id) || 0
    }))
  ];

  container.innerHTML = items
    .map(
      (item) => `
      <button
        type="button"
        class="catalog-filter-pill ${state.category === item.id ? "is-active" : ""}"
        data-cat-filter="${escapeHtml(item.id)}"
        aria-pressed="${state.category === item.id ? "true" : "false"}"
      >
        <span>${escapeHtml(item.name)}</span>
        <span class="catalog-pill-count">${item.count}</span>
      </button>
    `
    )
    .join("");
}

function renderPricePresets() {
  const container = $("#pricePresetList");
  if (!container) return;
  const usingCustomRange = state.minPrice !== "" || state.maxPrice !== "";
  container.innerHTML = PRICE_PRESETS.map((preset) => {
    const isActive = !usingCustomRange && state.price === preset.key;
    return `
      <button
        type="button"
        class="catalog-filter-pill ${isActive ? "is-active" : ""}"
        data-price-preset="${preset.key}"
        aria-pressed="${isActive ? "true" : "false"}"
      >
        <span>${preset.label}</span>
      </button>
    `;
  }).join("");
}

function renderStockFilters(scopedProducts) {
  const container = $("#stockFilterList");
  if (!container) return;

  const counts = {
    all: scopedProducts.length,
    in_stock: 0,
    low_stock: 0,
    out_of_stock: 0
  };
  scopedProducts.forEach((p) => {
    const st = getProductStockState(p);
    if (st.isOut) counts.out_of_stock++;
    else {
      counts.in_stock++;
      if (st.isLow) counts.low_stock++;
    }
  });

  container.innerHTML = STOCK_OPTIONS.map((opt) => {
    const isActive = state.stock === opt.key;
    return `
      <button
        type="button"
        class="catalog-filter-pill ${isActive ? "is-active" : ""}"
        data-stock-filter="${opt.key}"
        aria-pressed="${isActive ? "true" : "false"}"
      >
        <span>${opt.label}</span>
        <span class="catalog-pill-count">${counts[opt.key] || 0}</span>
      </button>
    `;
  }).join("");
}

function renderDynamicAttributeFilters(availableAttrs) {
  const container = $("#dynamicAttributeFilters");
  if (!container) return;
  if (!availableAttrs.length) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = availableAttrs
    .map((attr) => {
      const selectedVals = state.attrs[attr.name] || [];
      const isColorAttr = /màu|color/i.test(attr.name);

      if (isColorAttr) {
        return `
          <div class="catalog-filter-group">
            <h2 class="catalog-filter-heading">${escapeHtml(attr.name)}</h2>
            <div class="catalog-color-grid">
              ${attr.values
                .map((item) => {
                  const isActive = selectedVals.includes(item.value);
                  const swatch = resolveColorSwatch(item.value);
                  return `
                    <button
                      type="button"
                      class="catalog-swatch-chip ${isActive ? "is-active" : ""}"
                      data-attr-name="${escapeHtml(attr.name)}"
                      data-attr-val="${escapeHtml(item.value)}"
                      aria-pressed="${isActive ? "true" : "false"}"
                      title="${escapeHtml(item.value)} (${item.count})"
                    >
                      <span class="catalog-swatch-dot" style="background: ${swatch.hex}; border-color: ${swatch.border};"></span>
                      <span class="catalog-swatch-label">${escapeHtml(item.value)}</span>
                      <span class="catalog-pill-count">${item.count}</span>
                    </button>
                  `;
                })
                .join("")}
            </div>
          </div>
        `;
      }

      return `
        <div class="catalog-filter-group">
          <h2 class="catalog-filter-heading">${escapeHtml(attr.name)}</h2>
          <div class="catalog-filter-chips">
            ${attr.values
              .map((item) => {
                const isActive = selectedVals.includes(item.value);
                return `
                  <button
                    type="button"
                    class="catalog-attr-chip ${isActive ? "is-active" : ""}"
                    data-attr-name="${escapeHtml(attr.name)}"
                    data-attr-val="${escapeHtml(item.value)}"
                    aria-pressed="${isActive ? "true" : "false"}"
                  >
                    <span>${escapeHtml(item.value)}</span>
                    <span class="catalog-pill-count">${item.count}</span>
                  </button>
                `;
              })
              .join("")}
          </div>
        </div>
      `;
    })
    .join("");
}

function renderActiveFilterChips(categories, activeProductRecord = null) {
  const bar = $("#activeFilterChips");
  const clearSidebarBtn = $("#clearAllFiltersBtn");
  const filterBadge = $("#activeFilterCountBadge");
  if (!bar) return;

  const chips = [];
  if (state.category !== "all") {
    chips.push({
      type: "category",
      label: `Danh mục: ${getCategoryName(categories, state.category)}`
    });
  }
  if (state.search.trim()) {
    chips.push({
      type: "search",
      label: `Từ khóa: "${state.search.trim()}"`
    });
  }
  if (state.product) {
    chips.push({
      type: "product",
      label: activeProductRecord?.name
        ? `Sản phẩm: ${activeProductRecord.name}`
        : "Sản phẩm: Không tìm thấy"
    });
  }
  if (state.minPrice !== "" || state.maxPrice !== "") {
    const minStr = state.minPrice !== "" ? formatPrice(Number(state.minPrice)) : "0đ";
    const maxStr = state.maxPrice !== "" ? formatPrice(Number(state.maxPrice)) : "Trở lên";
    chips.push({
      type: "customPrice",
      label: `Giá: ${minStr} – ${maxStr}`
    });
  } else if (state.price !== "all") {
    const presetLabel =
      PRICE_PRESETS.find((p) => p.key === state.price)?.label ||
      LEGACY_PRICE_MAP[state.price]?.label ||
      state.price;
    chips.push({
      type: "price",
      label: `Giá: ${presetLabel}`
    });
  }
  if (state.stock !== "all") {
    const stLabel = STOCK_OPTIONS.find((s) => s.key === state.stock)?.label || state.stock;
    chips.push({
      type: "stock",
      label: `Kho: ${stLabel}`
    });
  }
  for (const [attrName, vals] of Object.entries(state.attrs)) {
    (vals || []).forEach((val) => {
      chips.push({
        type: "attr",
        attrName,
        attrVal: val,
        label: `${attrName}: ${val}`
      });
    });
  }

  const totalCount = getActiveFilterCount();
  if (clearSidebarBtn) clearSidebarBtn.hidden = totalCount === 0;
  if (filterBadge) {
    filterBadge.hidden = totalCount === 0;
    filterBadge.textContent = String(totalCount);
  }

  if (chips.length === 0) {
    bar.hidden = true;
    bar.innerHTML = "";
    return;
  }

  bar.hidden = false;
  bar.innerHTML = `
    <span class="active-filters-label">Đang lọc:</span>
    ${chips
      .map(
        (c) => `
      <button
        type="button"
        class="active-filter-chip"
        data-remove-type="${escapeHtml(c.type)}"
        data-remove-attr="${escapeHtml(c.attrName || "")}"
        data-remove-val="${escapeHtml(c.attrVal || "")}"
        aria-label="Xóa bộ lọc ${escapeHtml(c.label)}"
      >
        <span>${escapeHtml(c.label)}</span>
        <span class="active-filter-chip-x" aria-hidden="true">${renderIcon("x", { size: 13, strokeWidth: 2.2 })}</span>
      </button>
    `
      )
      .join("")}
    <button type="button" class="active-filters-clear" id="clearAllChipsBtn">Xóa tất cả</button>
  `;
}

function syncToolbarControls(categories) {
  const titleEl = $("#catalogTitle");
  if (titleEl) {
    titleEl.textContent =
      state.category !== "all" ? getCategoryName(categories, state.category) : "Tất cả sản phẩm EcoDesk";
  }

  const searchInput = $("#searchInput");
  if (searchInput && searchInput.value !== state.search) {
    searchInput.value = state.search;
  }

  const minInput = $("#minPriceInput");
  const maxInput = $("#maxPriceInput");
  if (minInput && minInput.value !== String(state.minPrice || "")) minInput.value = String(state.minPrice || "");
  if (maxInput && maxInput.value !== String(state.maxPrice || "")) maxInput.value = String(state.maxPrice || "");

  const sortSelect = $("#sortSelect");
  const relOpt = $("#sortOptionRelevance");
  const hasSearch = Boolean(state.search.trim());
  if (relOpt) relOpt.hidden = !hasSearch;
  if (!hasSearch && state.sort === "relevance") {
    state.sort = "newest";
  }
  if (sortSelect) sortSelect.value = state.sort;
}

function clearAllFilters({ keepSearch = false } = {}) {
  if (!keepSearch) state.search = "";
  state.category = "all";
  state.product = "";
  state.price = "all";
  state.minPrice = "";
  state.maxPrice = "";
  state.stock = "all";
  state.attrs = {};
  if (!state.search.trim() && state.sort === "relevance") {
    state.sort = "newest";
  }
}

function renderCatalog() {
  const categories = getCategories();
  const allProducts = getProducts().filter((p) => p.isHidden !== true);

  // Kiểm tra category từ URL có hợp lệ hay không
  if (state.category !== "all" && !categories.some((c) => c.id === state.category)) {
    state.category = "all";
  }

  // Phạm vi sản phẩm trong danh mục đang chọn (để dựng bộ lọc thuộc tính & tồn kho thực tế)
  const categoryScopedProducts = allProducts.filter(
    (p) => state.category === "all" || p.categoryId === state.category
  );

  const availableAttrs = extractCategoryAttributes(categoryScopedProducts);
  if (pruneStaleAttributeFilters(availableAttrs)) {
    writeStateToUrl();
  }

  // Tra cứu chính xác sản phẩm được chọn từ URL (?product=...) theo dữ liệu chính thức
  const activeProductRecord = state.product
    ? findProductByIdentifier(allProducts, state.product)
    : null;

  renderCategoryFilterList(categories, allProducts);
  renderPricePresets();
  renderStockFilters(categoryScopedProducts);
  renderDynamicAttributeFilters(availableAttrs);
  syncToolbarControls(categories);
  renderActiveFilterChips(categories, activeProductRecord);

  const priceBounds = getPriceRangeBounds();

  const filtered = allProducts.filter((product) => {
    if (state.product) {
      if (!activeProductRecord || String(product.id) !== String(activeProductRecord.id)) {
        return false;
      }
    }
    if (state.category !== "all" && product.categoryId !== state.category) return false;
    if (!productMatchesSearch(product, state.search)) return false;
    if (!productMatchesPrice(product, priceBounds)) return false;

    if (state.stock !== "all") {
      const st = getProductStockState(product);
      if (state.stock === "in_stock" && st.isOut) return false;
      if (state.stock === "low_stock" && !st.isLow) return false;
      if (state.stock === "out_of_stock" && !st.isOut) return false;
    }

    if (!productMatchesAttrs(product, state.attrs)) return false;
    return true;
  });

  const sortedProducts = sortProducts(filtered, state.sort, state.search);

  const countEl = $("#resultCountText");
  if (countEl) {
    if (sortedProducts.length === allProducts.length && getActiveFilterCount() === 0) {
      countEl.textContent = `Hiển thị toàn bộ ${sortedProducts.length} sản phẩm`;
    } else {
      countEl.textContent = `Tìm thấy ${sortedProducts.length} / ${allProducts.length} sản phẩm`;
    }
  }

  const listEl = $("#productList");
  if (listEl) {
    const missingSelectedProduct = Boolean(state.product && !activeProductRecord);
    listEl.innerHTML = sortedProducts.length
      ? sortedProducts.map((product) => productCard(product, categories)).join("")
      : `
        <div class="empty catalog-empty-state">
          <div class="catalog-empty-icon">${renderIcon("search", { size: 36, strokeWidth: 1.75 })}</div>
          <h3>${missingSelectedProduct ? "Không tìm thấy sản phẩm đã chọn" : "Không tìm thấy sản phẩm phù hợp"}</h3>
          <p>${
            missingSelectedProduct
              ? "Sản phẩm từ liên kết này không tồn tại hoặc hiện không còn kinh doanh. Bạn có thể xóa bộ lọc sản phẩm để xem toàn bộ danh mục EcoDesk."
              : "Không có sản phẩm nào khớp với bộ lọc hiện tại. Hãy thử điều chỉnh khoảng giá, bỏ bớt thuộc tính hoặc xem toàn bộ danh mục."
          }</p>
          <div style="display:flex; flex-wrap:wrap; gap:10px; justify-content:center;">
            ${
              state.product
                ? `<button type="button" class="btn-outline catalog-empty-reset-btn" id="emptyClearProductFilterBtn">Bỏ lọc sản phẩm</button>`
                : ""
            }
            <button type="button" class="btn catalog-empty-reset-btn" id="emptyResetFiltersBtn">Xóa tất cả bộ lọc</button>
          </div>
        </div>
      `;
    syncWishlistButtons(listEl);
    revealOnScroll(listEl);
  }

  initIcons(document);
}

function syncStickyFilterOffset() {
  const sidebar = $("#catalogSidebar");
  const header = document.querySelector(".site-header");
  if (!sidebar || !header) return;
  const headerHeight = Math.ceil(header.getBoundingClientRect().height);
  if (headerHeight > 0) {
    sidebar.style.setProperty("--catalog-sticky-top", `${headerHeight + 16}px`);
  }
}

function bindEvents() {
  const sidebar = $("#catalogSidebar");
  const toggleBtn = $("#mobileFilterToggleBtn");

  syncStickyFilterOffset();
  window.addEventListener("resize", syncStickyFilterOffset, { passive: true });
  document.fonts?.ready?.then(syncStickyFilterOffset).catch(() => {});

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener("click", () => {
      const isOpen = sidebar.classList.toggle("is-open");
      toggleBtn.setAttribute("aria-expanded", String(isOpen));
    });
  }

  const searchInput = $("#searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (event) => {
      const prevEmpty = !state.search.trim();
      state.search = event.target.value;
      const nowHasQuery = Boolean(state.search.trim());
      if (prevEmpty && nowHasQuery && state.sort === "newest") {
        state.sort = "relevance";
      } else if (!nowHasQuery && state.sort === "relevance") {
        state.sort = "newest";
      }
      writeStateToUrl();
      renderCatalog();
    });
  }

  const sortSelect = $("#sortSelect");
  if (sortSelect) {
    sortSelect.addEventListener("change", (event) => {
      state.sort = VALID_SORTS.has(event.target.value) ? event.target.value : "newest";
      writeStateToUrl();
      renderCatalog();
    });
  }

  const categoryList = $("#categoryFilterList");
  if (categoryList) {
    categoryList.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-cat-filter]");
      if (!btn) return;
      const nextCat = btn.getAttribute("data-cat-filter") || "all";
      state.category = nextCat;
      state.product = "";
      writeStateToUrl();
      renderCatalog();
    });
  }

  const pricePresetList = $("#pricePresetList");
  if (pricePresetList) {
    pricePresetList.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-price-preset]");
      if (!btn) return;
      state.price = btn.getAttribute("data-price-preset") || "all";
      state.minPrice = "";
      state.maxPrice = "";
      writeStateToUrl();
      renderCatalog();
    });
  }

  const applyCustomPrice = () => {
    const rawMin = $("#minPriceInput")?.value.trim() || "";
    const rawMax = $("#maxPriceInput")?.value.trim() || "";
    let numMin = rawMin !== "" ? Math.max(0, Number(rawMin)) : null;
    let numMax = rawMax !== "" ? Math.max(0, Number(rawMax)) : null;
    if (numMin != null && numMax != null && numMin > numMax) {
      const temp = numMin;
      numMin = numMax;
      numMax = temp;
    }
    state.minPrice = numMin != null && !isNaN(numMin) ? String(numMin) : "";
    state.maxPrice = numMax != null && !isNaN(numMax) ? String(numMax) : "";
    if (state.minPrice !== "" || state.maxPrice !== "") {
      state.price = "custom";
    } else {
      state.price = "all";
    }
    writeStateToUrl();
    renderCatalog();
  };

  $("#applyPriceRangeBtn")?.addEventListener("click", applyCustomPrice);
  ["#minPriceInput", "#maxPriceInput"].forEach((sel) => {
    $(sel)?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        applyCustomPrice();
      }
    });
  });

  const stockList = $("#stockFilterList");
  if (stockList) {
    stockList.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-stock-filter]");
      if (!btn) return;
      const nextStock = btn.getAttribute("data-stock-filter") || "all";
      state.stock = nextStock;
      writeStateToUrl();
      renderCatalog();
    });
  }

  const dynamicAttrs = $("#dynamicAttributeFilters");
  if (dynamicAttrs) {
    dynamicAttrs.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-attr-name][data-attr-val]");
      if (!btn) return;
      const attrName = btn.getAttribute("data-attr-name");
      const attrVal = btn.getAttribute("data-attr-val");
      if (!attrName || !attrVal) return;

      const current = new Set(state.attrs[attrName] || []);
      if (current.has(attrVal)) current.delete(attrVal);
      else current.add(attrVal);

      if (current.size > 0) state.attrs[attrName] = Array.from(current);
      else delete state.attrs[attrName];

      writeStateToUrl();
      renderCatalog();
    });
  }

  $("#clearAllFiltersBtn")?.addEventListener("click", () => {
    clearAllFilters();
    writeStateToUrl();
    renderCatalog();
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest("#emptyClearProductFilterBtn")) {
      state.product = "";
      writeStateToUrl();
      renderCatalog();
      return;
    }

    if (event.target.closest("#clearAllChipsBtn") || event.target.closest("#emptyResetFiltersBtn")) {
      clearAllFilters();
      writeStateToUrl();
      renderCatalog();
      return;
    }

    const chipBtn = event.target.closest(".active-filter-chip[data-remove-type]");
    if (!chipBtn) return;
    const type = chipBtn.getAttribute("data-remove-type");
    if (type === "category") state.category = "all";
    else if (type === "search") {
      state.search = "";
      if (state.sort === "relevance") state.sort = "newest";
    } else if (type === "product") state.product = "";
    else if (type === "price" || type === "customPrice") {
      state.price = "all";
      state.minPrice = "";
      state.maxPrice = "";
    } else if (type === "stock") state.stock = "all";
    else if (type === "attr") {
      const aName = chipBtn.getAttribute("data-remove-attr");
      const aVal = chipBtn.getAttribute("data-remove-val");
      if (aName && aVal && Array.isArray(state.attrs[aName])) {
        const next = state.attrs[aName].filter((v) => v !== aVal);
        if (next.length > 0) state.attrs[aName] = next;
        else delete state.attrs[aName];
      }
    }
    writeStateToUrl();
    renderCatalog();
  });

  window.addEventListener("popstate", () => {
    readStateFromUrl();
    renderCatalog();
  });

  window.addEventListener("storage", (e) => {
    if (!e.key || e.key.includes("ecodesk_products") || e.key.includes("ecodesk_categories")) {
      renderCatalog();
    }
  });
}

async function init() {
  await initStore();
  readStateFromUrl();
  bindEvents();
  renderCatalog();
}

init();
