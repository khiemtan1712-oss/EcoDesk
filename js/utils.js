import { getPricing, isNewProduct } from "./commerce.js";
import { renderIcon } from "./icons.js";
import { normalizeProductTags, formatShortDateTimeVN } from "./storage.js";

export const $ = (selector, parent = document) => parent.querySelector(selector);
export const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

export const formatPrice = (price) =>
  Number(price).toLocaleString("vi-VN", { style: "currency", currency: "VND" });
export const formatCurrency = formatPrice;

export const escapeHtml = (val = "") =>
  String(val ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const AUTH_NOTICE_KEY = "ecodesk_auth_notice";
export const AUTH_NOTICE_TYPE_KEY = "ecodesk_auth_notice_type";
export const AUTH_NEXT_KEY = "ecodesk_pending_next";

export const getParam = (key) => new URLSearchParams(window.location.search).get(key);

export const HOME_PATH = "./index.html";

const KNOWN_APP_PATHS = new Set([
  "/",
  "/index.html",
  "/products.html",
  "/detail.html",
  "/cart.html",
  "/checkout.html",
  "/account.html",
  "/customer-orders.html",
  "/payment-support.html",
  "/contact.html",
  "/admin.html",
  "/add.html",
  "/edit.html",
  "/login.html",
  "/register.html"
]);

function normalizeCandidatePathname(pathname = "") {
  const clean = String(pathname || "").trim().toLowerCase().replace(/\/{2,}/g, "/");
  if (!clean || clean === "/") return "/index.html";
  return clean;
}

function decodeNextSafely(value) {
  let current = String(value || "").trim();
  for (let i = 0; i < 3 && /%[0-9a-f]{2}/i.test(current); i += 1) {
    try {
      const decoded = decodeURIComponent(current).trim();
      if (decoded === current) break;
      current = decoded;
    } catch {
      return "";
    }
  }
  return current;
}

/**
 * Kiểm tra đường dẫn có phải trang xác thực (đăng nhập / đăng ký) hay không.
 */
export function isAuthPagePath(pathname = typeof window !== "undefined" ? window.location.pathname : "") {
  const clean = String(pathname || "").trim().toLowerCase().replace(/\/+$/, "");
  return (
    clean.endsWith("/login.html") ||
    clean.endsWith("/register.html") ||
    clean === "/login" ||
    clean === "/register"
  );
}

/**
 * Chuẩn hóa tham số `next` bằng URL/URLSearchParams:
 * giải mã an toàn tối đa 3 lớp, chỉ chấp nhận route EcoDesk hợp lệ cùng origin,
 * từ chối URL ngoài hoặc javascript:, không bao giờ trả về trang đăng nhập/đăng ký.
 */
export function resolveSafeNextUrl(rawNext, { depth = 0 } = {}) {
  if (typeof window === "undefined") return "";
  if (typeof rawNext !== "string" || depth > 4) return "";
  const decoded = decodeNextSafely(rawNext);
  if (!decoded || /[\u0000-\u001F\u007F]/.test(decoded)) return "";
  if (decoded.startsWith("//") || decoded.startsWith("\\\\")) return "";
  if (/^(javascript|data|vbscript|file):/i.test(decoded)) return "";

  try {
    const parsed = new URL(decoded, window.location.origin);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    if (parsed.origin !== window.location.origin) return "";

    const normalizedPath = normalizeCandidatePathname(parsed.pathname);
    if (!KNOWN_APP_PATHS.has(normalizedPath)) return "";

    if (isAuthPagePath(normalizedPath)) {
      const nested = parsed.searchParams.get("next");
      return nested ? resolveSafeNextUrl(nested, { depth: depth + 1 }) : "";
    }

    return `${normalizedPath}${parsed.search}${parsed.hash}`;
  } catch {
    return "";
  }
}

/**
 * Điểm quyết định điều hướng duy nhất sau khi đăng nhập thành công:
 * mọi tài khoản và mọi vai trò đều chuyển thẳng về trang chủ EcoDesk,
 * không sử dụng `next`, vai trò hay trang truy cập trước đó.
 */
export function resolvePostLoginRedirect() {
  return HOME_PATH;
}

/**
 * Tạo URL điều hướng tới login.html hoặc register.html sạch, không gắn `next`.
 */
export function buildAuthUrl(targetPage = "./login.html") {
  if (typeof window === "undefined") return targetPage;
  const target = new URL(targetPage, window.location.origin);
  return target.pathname;
}

/**
 * Lưu thông báo hiển thị trên trang đăng nhập và xóa mọi `next` cũ khỏi sessionStorage.
 */
export function storeAuthRedirectState({ notice = "", noticeType = "info" } = {}) {
  try {
    sessionStorage.removeItem(AUTH_NEXT_KEY);
    if (notice) {
      sessionStorage.setItem(AUTH_NOTICE_KEY, notice);
      sessionStorage.setItem(AUTH_NOTICE_TYPE_KEY, noticeType || "info");
    }
  } catch {}
}

/**
 * Xóa trạng thái chuyển hướng & thông báo sau khi đã xử lý xong để tránh lặp khi reload.
 */
export function consumeAuthRedirectState() {
  try {
    sessionStorage.removeItem(AUTH_NEXT_KEY);
    sessionStorage.removeItem(AUTH_NOTICE_KEY);
    sessionStorage.removeItem(AUTH_NOTICE_TYPE_KEY);
  } catch {}
}

/**
 * Chuyển hướng tới trang đăng nhập an toàn (không bao giờ lồng login.html hoặc gắn `next`).
 */
export function redirectToLogin({ notice = "", noticeType = "info", replace = false } = {}) {
  storeAuthRedirectState({ notice, noticeType });
  const destination = buildAuthUrl("./login.html");
  if (replace) {
    window.location.replace(destination);
  } else {
    window.location.href = destination;
  }
}

export const PROVINCES = [
  "TP. Hồ Chí Minh",
  "Hà Nội",
  "Đà Nẵng",
  "Hải Phòng",
  "Cần Thơ",
  "Bình Dương",
  "Đồng Nai",
  "Bà Rịa - Vũng Tàu",
  "An Giang",
  "Bắc Giang",
  "Bắc Kạn",
  "Bạc Liêu",
  "Bắc Ninh",
  "Bến Tre",
  "Bình Định",
  "Bình Phước",
  "Bình Thuận",
  "Cà Mau",
  "Cao Bằng",
  "Đắk Lắk",
  "Đắk Nông",
  "Điện Biên",
  "Đồng Tháp",
  "Gia Lai",
  "Hà Giang",
  "Hà Nam",
  "Hà Tĩnh",
  "Hải Dương",
  "Hậu Giang",
  "Hòa Bình",
  "Hưng Yên",
  "Khánh Hòa",
  "Kiên Giang",
  "Kon Tum",
  "Lai Châu",
  "Lâm Đồng",
  "Lạng Sơn",
  "Lào Cai",
  "Long An",
  "Nam Định",
  "Nghệ An",
  "Ninh Bình",
  "Ninh Thuận",
  "Phú Thọ",
  "Phú Yên",
  "Quảng Bình",
  "Quảng Nam",
  "Quảng Ngãi",
  "Quảng Ninh",
  "Quảng Trị",
  "Sóc Trăng",
  "Sơn La",
  "Tây Ninh",
  "Thái Bình",
  "Thái Nguyên",
  "Thanh Hóa",
  "Thừa Thiên Huế",
  "Tiền Giang",
  "Trà Vinh",
  "Tuyên Quang",
  "Vĩnh Long",
  "Vĩnh Phúc",
  "Yên Bái"
];

export function showToast(message, duration = 2200) {
  const toast = $("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove("hidden");
  window.setTimeout(() => toast.classList.add("hidden"), duration);
}

export function getCategoryName(categories, categoryId) {
  return categories.find((category) => category.id === categoryId)?.name || "Chưa phân loại";
}

export function normalizeSearchText(str = "") {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

export function resolveColorSwatch(label = "") {
  const norm = normalizeSearchText(label);
  const rules = [
    { re: /den|black|carbon|stealth/, hex: "#1f2421", border: "#1f2421" },
    { re: /trang|white|ngoc|sua/, hex: "#f8fafc", border: "#cbd5e1" },
    { re: /xam|ghi|tro|titan|gray|grey/, hex: "#64748b", border: "#475569" },
    { re: /bac|silver|nhom/, hex: "#cbd5e1", border: "#94a3b8" },
    { re: /tim|lavender|violet|purple/, hex: "#7c3aed", border: "#6d28d9" },
    { re: /xanh\s*(duong|bien|navy|blue|coban)/, hex: "#2563eb", border: "#1d4ed8" },
    { re: /xanh\s*(la|reu|eco|luc|green)/, hex: "#1f7a5c", border: "#14513e" },
    { re: /xanh/, hex: "#0ea5e9", border: "#0284c7" },
    { re: /do|red|ruou/, hex: "#dc2626", border: "#b91c1c" },
    { re: /hong|pink|rose|pastel/, hex: "#ec4899", border: "#db2777" },
    { re: /cam|orange/, hex: "#ea580c", border: "#c2410c" },
    { re: /vang|gold|yellow/, hex: "#eab308", border: "#ca8a04" },
    { re: /oc cho|walnut|nau dam|ca phe/, hex: "#5c3d28", border: "#442c1c" },
    { re: /go soi|soi|oak|vang go|maple|nau|kem|beige|be/, hex: "#c89d6c", border: "#a67c4e" }
  ];
  for (const r of rules) {
    if (r.re.test(norm)) return { hex: r.hex, border: r.border, matched: true };
  }
  return { hex: "#94a3b8", border: "#64748b", matched: false };
}

export function getProductEffectivePrice(product) {
  const hasVariants = Array.isArray(product?.variants) && product.variants.length > 0;
  if (hasVariants) {
    const activePrices = product.variants
      .map((v) => {
        const raw = v.price != null && !isNaN(v.price) ? Number(v.price) : Number(product.price || 0);
        return getPricing({ ...product, price: raw }, new Date(), v).price;
      })
      .filter((p) => !isNaN(p) && p > 0);
    if (activePrices.length > 0) return Math.min(...activePrices);
  }
  return getPricing(product).price;
}

function getRelevanceScore(product, normQuery) {
  if (!normQuery) return 0;
  const name = normalizeSearchText(product.name);
  const desc = normalizeSearchText(product.description);
  const tags = normalizeProductTags(product.tags).map(normalizeSearchText).join(" ");
  const variantsText = Array.isArray(product.variants)
    ? product.variants.map((v) => normalizeSearchText(`${v.name || ""} ${v.sku || ""}`)).join(" ")
    : "";

  let score = 0;
  if (name === normQuery) score += 120;
  else if (name.startsWith(normQuery)) score += 90;
  else if (name.includes(normQuery)) score += 65;

  const tokens = normQuery.split(/\s+/).filter(Boolean);
  for (const tok of tokens) {
    if (name.includes(tok)) score += 20;
    if (tags.includes(tok)) score += 12;
    if (variantsText.includes(tok)) score += 10;
    if (desc.includes(tok)) score += 5;
  }
  if (tags.includes(normQuery)) score += 25;
  if (variantsText.includes(normQuery)) score += 18;
  if (desc.includes(normQuery)) score += 10;
  return score;
}

export function sortProducts(products, sortValue, searchTerm = "") {
  const sorted = [...products];
  const normQuery = normalizeSearchText(searchTerm);
  const sorters = {
    relevance: (a, b) => {
      const diff = getRelevanceScore(b, normQuery) - getRelevanceScore(a, normQuery);
      if (diff !== 0) return diff;
      return (Number(b.sold) || 0) - (Number(a.sold) || 0) || new Date(b.createdAt) - new Date(a.createdAt);
    },
    soldDesc: (a, b) =>
      (Number(b.sold) || 0) - (Number(a.sold) || 0) ||
      (Number(b.rating) || 0) - (Number(a.rating) || 0) ||
      new Date(b.createdAt) - new Date(a.createdAt),
    priceAsc: (a, b) => getProductEffectivePrice(a) - getProductEffectivePrice(b),
    priceDesc: (a, b) => getProductEffectivePrice(b) - getProductEffectivePrice(a),
    nameAsc: (a, b) => a.name.localeCompare(b.name, "vi"),
    nameDesc: (a, b) => b.name.localeCompare(a.name, "vi"),
    newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    oldest: (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  };
  return sorted.sort(sorters[sortValue] || sorters.newest);
}

export function renderRatingStars(rating = 0) {
  const parsed = Number(rating);
  const score = Number.isFinite(parsed) ? Math.max(0, Math.min(5, parsed)) : 0;
  const starPath = "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";

  let starsHtml = "";
  for (let i = 1; i <= 5; i++) {
    let fillPercent = 0;
    if (score >= i) {
      fillPercent = 100;
    } else if (score > i - 1) {
      fillPercent = Math.round((score - (i - 1)) * 100);
    } else {
      fillPercent = 0;
    }

    starsHtml += `
      <span class="star-cell" aria-hidden="true">
        <svg class="star-svg star-bg" viewBox="0 0 24 24" focusable="false"><path fill="#dce3df" d="${starPath}"/></svg>
        ${fillPercent > 0 ? `
          <span class="star-fill-clip" style="width: ${fillPercent}%;">
            <svg class="star-svg star-fg" viewBox="0 0 24 24" focusable="false"><path fill="#e59a20" d="${starPath}"/></svg>
          </span>
        ` : ""}
      </span>
    `;
  }

  return `
    <span class="rating-stars" title="${score.toFixed(1)} / 5.0 sao" aria-label="${score.toFixed(1)} trên 5 sao">
      ${starsHtml}
    </span>
  `;
}

export function productCard(product, categories) {
  const tags = normalizeProductTags(product.tags)
    .map((tag) => `<span class="badge">${tag}</span>`)
    .join("");
  const pricing = getPricing(product);
  const ratingValue = Number(product.rating || 0);
  const reviewCount = Number(product.reviewCount || 0);

  // Tính toán tồn kho và trạng thái từ biến thể hoặc thuộc tính sản phẩm
  const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
  let totalStock = 0;
  let availableVariantCount = 0;
  let soldOutVariantCount = 0;

  if (hasVariants) {
    product.variants.forEach((v) => {
      const s = Math.max(0, Number(v.stock) || 0);
      totalStock += s;
      if (s > 0) availableVariantCount++;
      else soldOutVariantCount++;
    });
  } else {
    totalStock = Math.max(0, Number(product.stock) || 0);
  }

  const isOutOfStock = totalStock <= 0 || product.status === "Hết hàng" || product.status === "Tạm hết hàng" || product.status === "Ngừng kinh doanh";
  const hasPartialSoldOut = hasVariants && availableVariantCount > 0 && soldOutVariantCount > 0;
  const isLowStock = !isOutOfStock && totalStock <= 15;

  let stockBadgeHtml = "";
  if (isOutOfStock) {
    stockBadgeHtml = `<span class="product-stock-pill out-of-stock"><span class="stock-dot"></span>Tạm hết hàng</span>`;
  } else if (hasPartialSoldOut) {
    stockBadgeHtml = `<span class="product-stock-pill in-stock"><span class="stock-dot"></span>Còn hàng</span> <span class="product-partial-soldout-hint">Một số mẫu đã hết hàng</span>`;
  } else if (isLowStock) {
    stockBadgeHtml = `<span class="product-stock-pill low-stock"><span class="stock-dot"></span>Sắp hết hàng (${totalStock})</span>`;
  } else {
    stockBadgeHtml = `<span class="product-stock-pill in-stock"><span class="stock-dot"></span>Còn hàng</span>`;
  }

  // Hiển thị giá "Từ ..." nếu các biến thể có mức giá khác nhau
  let priceHtml = `${pricing.percent ? `<del>${formatPrice(pricing.original)}</del> ` : ""}<strong>${formatPrice(pricing.price)}</strong>`;
  if (hasVariants) {
    const varPricings = product.variants.map((v) => {
      const raw = v.price != null && !isNaN(v.price) ? Number(v.price) : Number(product.price || 0);
      return getPricing({ ...product, price: raw }, new Date(), v);
    });
    const minFinal = Math.min(...varPricings.map((p) => p.price));
    const maxFinal = Math.max(...varPricings.map((p) => p.price));
    const minPricing = varPricings.find((p) => p.price === minFinal) || pricing;
    if (minFinal < maxFinal) {
      priceHtml = minPricing.percent > 0
        ? `Từ <del>${formatPrice(minPricing.original)}</del> <strong>${formatPrice(minPricing.price)}</strong>`
        : `Từ <strong>${formatPrice(minFinal)}</strong>`;
    } else if (minPricing.percent > 0) {
      priceHtml = `<del>${formatPrice(minPricing.original)}</del> <strong>${formatPrice(minPricing.price)}</strong>`;
    } else {
      priceHtml = `<strong>${formatPrice(minFinal)}</strong>`;
    }
    if (pricing.isUpcoming) {
      priceHtml += `<span class="upcoming-sale-hint" style="display: block; font-size: 11px; color: #d97706; font-weight: 600; margin-top: 2px; line-height: 1.3;">Sắp sale ${formatShortDateTimeVN(pricing.upcomingStartAt)} (-${pricing.upcomingPercent}%)</span>`;
    }
  }

  // Rút trích các lựa chọn màu sắc thực tế từ biến thể
  const colorSwatches = [];
  if (hasVariants) {
    const seenColors = new Set();
    for (const v of product.variants) {
      if (!v.options || typeof v.options !== "object") continue;
      const colorEntry = Object.entries(v.options).find(([k]) => /màu|color/i.test(k));
      if (!colorEntry) continue;
      const colorVal = String(colorEntry[1] || "").trim();
      if (!colorVal || seenColors.has(colorVal)) continue;
      seenColors.add(colorVal);
      const vRaw = v.price != null && !isNaN(v.price) ? Number(v.price) : Number(product.price || 0);
      const vPricing = getPricing({ ...product, price: vRaw }, new Date(), v);
      const swatch = resolveColorSwatch(colorVal);
      colorSwatches.push({
        label: colorVal,
        hex: swatch.hex,
        border: swatch.border,
        variantId: v.id || "",
        image: v.image || product.image,
        priceText: vPricing.percent
          ? `<del>${formatPrice(vPricing.original)}</del> <strong>${formatPrice(vPricing.price)}</strong>`
          : `<strong>${formatPrice(vPricing.price)}</strong>`,
        stock: Number(v.stock) || 0
      });
    }
  }

  const maxSwatches = 5;
  const visibleSwatches = colorSwatches.slice(0, maxSwatches);
  const extraSwatchesCount = Math.max(0, colorSwatches.length - maxSwatches);

  const swatchRowHtml = visibleSwatches.length > 0
    ? `
      <div class="card-swatches" role="group" aria-label="Tùy chọn màu sắc">
        ${visibleSwatches.map((sw, idx) => `
          <button
            type="button"
            class="card-swatch-btn ${idx === 0 ? "is-active" : ""} ${sw.stock <= 0 ? "is-sold-out" : ""}"
            data-swatch-img="${escapeHtml(sw.image)}"
            data-swatch-variant="${escapeHtml(sw.variantId)}"
            data-swatch-price-html="${escapeHtml(sw.priceText)}"
            data-product-id="${escapeHtml(product.id)}"
            title="${escapeHtml(sw.label)}${sw.stock <= 0 ? " (Tạm hết hàng)" : ""}"
            aria-label="Màu ${escapeHtml(sw.label)}"
          >
            <span class="card-swatch-dot" style="background: ${sw.hex}; border-color: ${sw.border};"></span>
          </button>
        `).join("")}
        ${extraSwatchesCount > 0 ? `<span class="card-swatch-more">+${extraSwatchesCount}</span>` : ""}
      </div>
    `
    : "";

  const defaultDetailUrl = `detail.html?id=${encodeURIComponent(product.id)}`;

  bindCardSwatchEvents();

  return `
    <article class="product-card ${isOutOfStock ? "is-out-of-stock" : ""}" data-product-card="${escapeHtml(product.id)}">
      <div class="product-image-wrap" style="position: relative;">
        <a class="product-image" href="${defaultDetailUrl}" data-card-link>
          <div class="card-corner-badges">
            ${pricing.percent ? `<span class="badge-sale-pill">${pricing.badgeText || `-${pricing.percent}%`}</span>` : ""}
            ${pricing.isUpcoming ? `<span class="badge-upcoming-pill" title="Sắp sale lúc ${formatShortDateTimeVN(pricing.upcomingStartAt)}">Sắp sale</span>` : ""}
            ${isNewProduct(product) ? `<span class="badge-new-pill">Mới</span>` : ""}
          </div>
          ${isOutOfStock ? `<div class="card-out-overlay">Tạm hết hàng</div>` : ""}
          <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" data-card-img>
        </a>
        <button type="button" class="card-wishlist-btn" data-wishlist-btn data-product-id="${escapeHtml(product.id)}" title="Lưu vào danh sách yêu thích" aria-label="Thêm vào yêu thích" style="position: absolute; top: 10px; right: 10px; z-index: 5; width: 34px; height: 34px; border-radius: 50%; background: rgba(255,255,255,0.92); border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.12); font-size: 15px; transition: transform 0.15s ease;">
          <span class="wishlist-icon" style="display: flex; align-items: center; justify-content: center;">${renderIcon("heart", { size: 18, class: "wishlist-heart-svg" })}</span>
        </button>
      </div>
      <div class="product-body">
        <div class="badge-row">${tags}<span class="badge">${escapeHtml(getCategoryName(categories, product.categoryId))}</span></div>
        <h3><a href="${defaultDetailUrl}" data-card-link>${escapeHtml(product.name)}</a></h3>
        <p class="description">${escapeHtml(product.description)}</p>
        ${swatchRowHtml}
        <div class="featured-rating" aria-label="${reviewCount > 0 ? `Đánh giá ${ratingValue.toFixed(1)} trên 5 (${reviewCount} đánh giá), ${product.sold} lượt bán` : `Chưa có đánh giá, ${product.sold} lượt bán`}">
          ${reviewCount > 0
      ? `${renderRatingStars(ratingValue)}<span class="rating-score">${ratingValue.toFixed(1)}</span><span class="rating-count">(${reviewCount}) • ${product.sold} đã bán</span>`
      : `<span class="rating-count">Chưa có đánh giá • ${product.sold} đã bán</span>`
    }
        </div>
        <div class="product-meta-row">
          ${stockBadgeHtml}
          ${hasVariants ? `<span class="product-variant-count-tag">${colorSwatches.length > 0 ? `${colorSwatches.length} màu` : `${product.variants.length} lựa chọn`}</span>` : ""}
        </div>
        <div class="product-foot">
          <span class="price" data-card-price>${priceHtml}</span>
          <a class="btn-outline" href="${defaultDetailUrl}" data-card-link>Xem chi tiết</a>
        </div>
      </div>
    </article>
  `;
}

function bindCardSwatchEvents() {
  if (typeof window === "undefined" || window.__ecodeskCardSwatchBound) return;
  window.__ecodeskCardSwatchBound = true;
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".card-swatch-btn");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();

    const card = btn.closest(".product-card");
    if (!card) return;

    card.querySelectorAll(".card-swatch-btn").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");

    const imgEl = card.querySelector("[data-card-img]");
    const nextImg = btn.getAttribute("data-swatch-img");
    if (imgEl && nextImg) imgEl.src = nextImg;

    const priceEl = card.querySelector("[data-card-price]");
    const nextPriceHtml = btn.getAttribute("data-swatch-price-html");
    if (priceEl && nextPriceHtml) priceEl.innerHTML = nextPriceHtml;

    const prodId = btn.getAttribute("data-product-id");
    const variantId = btn.getAttribute("data-swatch-variant");
    if (prodId && variantId) {
      const targetHref = `detail.html?id=${encodeURIComponent(prodId)}&variant=${encodeURIComponent(variantId)}`;
      card.querySelectorAll("[data-card-link]").forEach((a) => a.setAttribute("href", targetHref));
    }
  });
}

/**
 * Tìm bản ghi sản phẩm chính thức khớp chính xác theo ID hoặc mã SKU nội bộ.
 * Không khớp một phần hay gần đúng để tránh lọc nhầm sang sản phẩm khác.
 */
export function findProductByIdentifier(products = [], identifier = "") {
  const needle = String(identifier || "").trim().toLowerCase();
  if (!needle || !Array.isArray(products) || products.length === 0) return null;

  const byId = products.find((p) => String(p?.id || "").trim().toLowerCase() === needle);
  if (byId) return byId;

  return (
    products.find((p) => {
      if (String(p?.sku || "").trim().toLowerCase() === needle) return true;
      return (
        Array.isArray(p?.variants) &&
        p.variants.some((v) => String(v?.sku || "").trim().toLowerCase() === needle)
      );
    }) || null
  );
}
