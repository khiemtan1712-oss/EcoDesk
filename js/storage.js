import { loadSeedData } from "./data.js";
import { getDiscountPromotionStatus, calculateDiscountPricing, getPricing } from "./commerce.js";
import { createOrderStatusNotification } from "./notifications.js";
import { DEFAULT_STAFF_PERMISSIONS, DEFAULT_CASHIER_PERMISSIONS } from "./permissions.js";

const PRODUCT_KEY = "ecodesk_products";
const CATEGORY_KEY = "ecodesk_categories";
const ORDER_KEY = "ecodesk_orders";
const CART_KEY = "ecodesk_cart";
const USER_KEY = "ecodesk_users";
const SESSION_KEY = "ecodesk_current_user";
const CAMPAIGN_KEY = "ecodesk_campaigns";
const BANNER_KEY = "ecodesk_banners";
const AUDIT_LOG_KEY = "ecodesk_audit_logs";

const read = (key, fallback = []) => {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

// API Fetch helper
function getActorUserIdHeader() {
  try {
    const s = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    if (s) {
      const parsed = JSON.parse(s);
      if (parsed && parsed.id) return String(parsed.id);
    }
  } catch {}
  return "";
}

export function getApiBaseUrl() {
  if (typeof window !== "undefined" && window.__ECODESK_API_URL__) {
    return String(window.__ECODESK_API_URL__).replace(/\/+$/, "");
  }
  try {
    if (typeof import.meta !== "undefined" && import.meta?.env?.VITE_API_URL) {
      return String(import.meta.env.VITE_API_URL).replace(/\/+$/, "");
    }
  } catch {}
  return "";
}

async function apiFetch(endpoint, options = {}) {
  try {
    const actorId = getActorUserIdHeader();
    const baseUrl = getApiBaseUrl();
    const resolvedUrl = (baseUrl && typeof endpoint === "string" && endpoint.startsWith("/"))
      ? `${baseUrl}${endpoint}`
      : endpoint;
    const res = await fetch(resolvedUrl, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(actorId ? { "X-EcoDesk-User-Id": actorId } : {}),
        ...(options.headers || {})
      }
    });
    const rawText = await res.text().catch(() => "");
    let payload = null;
    if (rawText) {
      try {
        payload = JSON.parse(rawText);
      } catch {
        payload = null;
      }
    }

    if (!res.ok) {
      const hasJsonError = Boolean(payload && typeof payload === "object" && (payload.error || payload.message));
      const isProxyOrGatewayDown =
        (!hasJsonError && (res.status === 500 || res.status === 502 || res.status === 503 || res.status === 504)) ||
        (res.status === 504);

      if (isProxyOrGatewayDown) {
        console.error(`[API] Máy chủ hoặc proxy không phản hồi hợp lệ tại ${endpoint}: HTTP ${res.status}`);
        const unavailableErr = new Error(
          "Không thể kết nối máy chủ EcoDesk. Vui lòng kiểm tra backend đã khởi động hoặc thử lại sau."
        );
        unavailableErr.status = res.status;
        unavailableErr.isHttpError = true;
        unavailableErr.isBackendUnavailable = true;
        throw unavailableErr;
      }

      const error = new Error(
        (payload && (payload.error || payload.message)) ||
          (res.status >= 500
            ? "Máy chủ đang gặp sự cố. Vui lòng thử lại sau."
            : `Yêu cầu không thành công (${res.status}).`)
      );
      error.status = res.status;
      error.data = payload || {};
      error.isHttpError = true;
      throw error;
    }

    if (!rawText) return null;
    if (payload === null) {
      console.error(`[API] Phản hồi JSON không hợp lệ từ ${endpoint}`);
      throw new Error("Phản hồi từ máy chủ không đúng định dạng dữ liệu.");
    }
    return payload;
  } catch (err) {
    if (!err.isHttpError) {
      console.error(`[API] Lỗi kết nối hoặc phản hồi tại ${endpoint}:`, err.message);
    }
    throw err;
  }
}

/**
 * Kiểm tra trạng thái đơn hàng đã hoàn thành / giao thành công để tính lượt bán & xác minh đánh giá
 */
export function isOrderCompletedForSales(status) {
  if (!status) return false;
  const s = String(status).trim().toLowerCase();
  return s === "hoàn thành" || s === "hoàn tất" || s === "đã giao" || s === "giao thành công";
}

function parseOrderItemsSafe(order) {
  if (!order) return [];
  if (Array.isArray(order.items)) return order.items;
  if (order.itemsJson) {
    try {
      const parsed = JSON.parse(order.itemsJson);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
}

const WIN1252_REV_MAP = new Map([
  ["€", 0x80], ["‚", 0x82], ["ƒ", 0x83], ["„", 0x84], ["…", 0x85],
  ["†", 0x86], ["‡", 0x87], ["ˆ", 0x88], ["‰", 0x89], ["Š", 0x8A],
  ["‹", 0x8B], ["Œ", 0x8C], ["Ž", 0x8E], ["‘", 0x91], ["’", 0x92],
  ["“", 0x93], ["”", 0x94], ["•", 0x95], ["–", 0x96], ["—", 0x97],
  ["˜", 0x98], ["™", 0x99], ["š", 0x9A], ["›", 0x9B], ["œ", 0x9C],
  ["ž", 0x9E], ["Ÿ", 0x9F]
]);

export function cleanMojibake(str) {
  if (typeof str !== "string" || !str) return str;
  let s = str;

  // 1. Tiền xử lý các biến thể đặc biệt của Đ/đ trước khi giải mã
  s = s.replace(/Ä[\u0080-\u009f\u0000-\u001f\s\uFFFD\u25A0-\u25A9□\?']?en/gi, "Đen");
  s = s.replace(/Ä['’`\?‘]/g, "đ");
  s = s.replace(/Ä‘/g, "đ");

  // 2. Thử giải mã nhị phân Windows-1252 -> UTF-8 cho chuỗi bị double-encoding
  if (/[ÄÃáàảãạâăéèẻẽẹêíìỉĩịóòỏõọôơúùủũụưýỳỷỹỵº»¼½¾¿]/.test(s)) {
    try {
      const bytes = [];
      const encoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        const code = s.charCodeAt(i);
        if (WIN1252_REV_MAP.has(ch)) {
          bytes.push(WIN1252_REV_MAP.get(ch));
        } else if (code <= 0xFF) {
          bytes.push(code);
        } else if (encoder) {
          const encoded = encoder.encode(ch);
          for (let j = 0; j < encoded.length; j++) bytes.push(encoded[j]);
        } else if (typeof Buffer !== "undefined") {
          const buf = Buffer.from(ch, "utf8");
          for (let j = 0; j < buf.length; j++) bytes.push(buf[j]);
        }
      }
      const decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-8") : null;
      const decoded = decoder
        ? decoder.decode(new Uint8Array(bytes))
        : (typeof Buffer !== "undefined" ? Buffer.from(bytes).toString("utf8") : "");
      if (decoded && !decoded.includes("\uFFFD")) {
        s = decoded;
      }
    } catch (_) {}
  }

  // 3. Quy tắc từ điển khử triệt để mọi tàn dư lỗi font thường gặp
  const replacements = [
    [/Ä[\u0080-\u009f\u0000-\u001f\s\uFFFD\u25A1□\?']?en/gi, "Đen"],
    [/Ä['’`\?‘]?áº§u/gi, "đầu"],
    [/Ä['’`\?‘]?áº£n/gi, "đản"],
    [/Ä['’`\?‘]?á»[\u0087\u0099]?/gi, "điệ"],
    [/Ä['’`\?‘]?á/gi, "đ"],
    [/Ä['’`\?‘]/g, "đ"],
    [/Báo£n/g, "Bản"],
    [/Báº£n/g, "Bản"],
    [/chuyÃªn/g, "chuyên"],
    [/sÃ¢u/g, "sâu"],
    [/XÃ¡m/g, "Xám"],
    [/mÃ¡y/g, "máy"],
    [/xoa bÃ³p/g, "xoa bóp"],
    [/Ä['’`‘]?Ã¨n/g, "Đèn"],
    [/BÃ\s*n/g, "Bàn"],
    [/Gháº¿/g, "Ghế"],
    [/Ã¡/g, "á"],
    [/Ã\s/g, "à"],
    [/áº£/g, "ả"],
    [/Ã£/g, "ã"],
    [/áº¡/g, "ạ"],
    [/Ã¢/g, "â"],
    [/áº¥/g, "ấ"],
    [/áº§/g, "ầ"],
    [/áº©/g, "ẩ"],
    [/áº«/g, "ẫ"],
    [/áº­/g, "ậ"],
    [/Äƒ/g, "ă"],
    [/áº¯/g, "ắ"],
    [/áº±/g, "ằ"],
    [/áº³/g, "ẳ"],
    [/áºµ/g, "ẵ"],
    [/áº·/g, "ặ"],
    [/Ã©/g, "é"],
    [/Ã¨/g, "è"],
    [/áº»/g, "ẻ"],
    [/áº½/g, "ẽ"],
    [/áº¹/g, "ẹ"],
    [/Ãª/g, "ê"],
    [/áº¿/g, "ế"],
    [/á»\u0081/g, "ề"],
    [/á»ƒ/g, "ể"],
    [/á»…/g, "ễ"],
    [/á»‡/g, "ệ"],
    [/Ã­/g, "í"],
    [/Ã¬/g, "ì"],
    [/á»‰/g, "ỉ"],
    [/Ä©/g, "ĩ"],
    [/á»‹/g, "ị"],
    [/Ã³/g, "ó"],
    [/Ã²/g, "ò"],
    [/á»\u008f/g, "ỏ"],
    [/Ãµ/g, "õ"],
    [/á»\u008d/g, "ọ"],
    [/Ã´/g, "ô"],
    [/á»\u0091/g, "ố"],
    [/á»\u0093/g, "ồ"],
    [/á»\u0095/g, "ổ"],
    [/á»\u0097/g, "ỗ"],
    [/á»\u0099/g, "ộ"],
    [/Æ¡/g, "ơ"],
    [/á»\u009b/g, "ớ"],
    [/á»\u009d/g, "ờ"],
    [/á»\u009f/g, "ở"],
    [/á»¡/g, "ỡ"],
    [/á»£/g, "ợ"],
    [/Ãº/g, "ú"],
    [/Ã¹/g, "ù"],
    [/á»§/g, "ủ"],
    [/Å©/g, "ũ"],
    [/á»¥/g, "ụ"],
    [/Æ°/g, "ư"],
    [/á»©/g, "ứ"],
    [/á»«/g, "ừ"],
    [/á»­/g, "ử"],
    [/á»¯/g, "ữ"],
    [/á»±/g, "ự"],
    [/Ã½/g, "ý"],
    [/á»³/g, "ỳ"],
    [/á»·/g, "ỷ"],
    [/á»¹/g, "ỹ"],
    [/á»µ/g, "ỵ"],
    [/Ä\u0090/g, "Đ"],
    [/Ä\u0091/g, "đ"],
    [/Ä\u0080/g, "Đ"],
    [/Ä[\u0080-\u009f]/g, "Đ"]
  ];

  for (const [re, rep] of replacements) {
    s = s.replace(re, rep);
  }
  return s;
}

function orderContainsProductRecord(order, productId) {
  if (!order || !productId) return false;
  const targetId = String(productId).trim().toLowerCase();
  const items = parseOrderItemsSafe(order);
  return items.some((item) => {
    const pid = String(item.productId || "").trim().toLowerCase();
    const id = String(item.id || "").trim().toLowerCase();
    const vid = String(item.variantId || "").trim().toLowerCase();
    const sku = String(item.variantSku || "").trim().toLowerCase();
    if (pid === targetId || id === targetId) return true;
    if (id.startsWith(targetId + "-") || id.startsWith(targetId + "_")) return true;
    if (vid.startsWith(targetId + "-") || vid.startsWith(targetId + "_")) return true;
    return false;
  });
}

/**
 * Xác minh một đánh giá có gắn với đơn hàng đã giao/hoàn tất của chính user cho sản phẩm đó hay không
 */
export function isVerifiedPurchaseReviewRecord(review, ordersList = []) {
  if (!review || review.isDeleted) return false;
  const reviewUserId = review.userId ? String(review.userId).trim() : "";
  const reviewEmail = review.userEmail ? String(review.userEmail).trim().toLowerCase() : "";
  const reviewProductId = String(review.productId || "").trim();
  if (!reviewProductId) return false;
  const targetOrderId = review.orderId ? String(review.orderId).trim() : null;
  const orders = Array.isArray(ordersList) ? ordersList : [];

  const matchesUser = (o) => {
    if (reviewUserId && o.userId) {
      return String(o.userId).trim().toLowerCase() === reviewUserId.toLowerCase();
    }
    if (reviewEmail && o.customerEmail) {
      return String(o.customerEmail).trim().toLowerCase() === reviewEmail;
    }
    return false;
  };

  if (targetOrderId) {
    const exactOrder = orders.find((o) => String(o.id).trim().toLowerCase() === targetOrderId.toLowerCase());
    if (!exactOrder) return false;
    return (
      matchesUser(exactOrder) &&
      isOrderCompletedForSales(exactOrder.status) &&
      orderContainsProductRecord(exactOrder, reviewProductId)
    );
  }

  return orders.some(
    (o) =>
      matchesUser(o) &&
      isOrderCompletedForSales(o.status) &&
      orderContainsProductRecord(o, reviewProductId)
  );
}

export function isNewTagText(tag) {
  const norm = String(tag || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
  return norm === "moi" || norm === "moi ve" || norm === "new" || norm === "new arrival";
}

/**
 * Chuẩn hóa tags sản phẩm: loại bỏ nhãn trùng với "Mới" (vì badge Mới dùng newBadge) và khử trùng lặp không phân biệt hoa thường
 */
export function normalizeProductTags(tags) {
  const list = Array.isArray(tags)
    ? tags
    : (typeof tags === "string" ? tags.split(",") : []);
  const seen = new Set();
  const result = [];
  for (const raw of list) {
    const clean = String(raw || "").trim();
    if (!clean || isNewTagText(clean)) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
  }
  return result;
}

export function normalizeImageUrlKey(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (/^(https?:|data:|blob:)/i.test(raw)) {
    return raw;
  }
  return raw
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .replace(/\/{2,}/g, "/")
    .toLowerCase();
}

export function deduplicateGalleryEntries(gallery = [], excludeUrls = []) {
  if (!Array.isArray(gallery) || gallery.length === 0) return [];
  const seen = new Set(
    (Array.isArray(excludeUrls) ? excludeUrls : [])
      .map((u) => normalizeImageUrlKey(u))
      .filter(Boolean)
  );
  const result = [];
  for (const entry of gallery) {
    const url = typeof entry === "string" ? entry.trim() : String(entry?.url || "").trim();
    if (!url) continue;
    const key = normalizeImageUrlKey(url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(typeof entry === "string" ? url : { ...entry, url });
  }
  return result;
}

export function sanitizeProductRecord(product) {
  if (!product || typeof product !== "object") return product;
  const cleanTags = normalizeProductTags(product.tags);
  let rawGallery = Array.isArray(product.gallery) ? product.gallery : [];
  if (rawGallery.length === 0 && product.galleryJson) {
    try {
      const parsed = typeof product.galleryJson === "string" ? JSON.parse(product.galleryJson) : product.galleryJson;
      if (Array.isArray(parsed)) rawGallery = parsed;
    } catch {}
  }
  const cleanGallery = deduplicateGalleryEntries(rawGallery);

  // Khử lỗi font / mojibake trong tên, mô tả, biến thể và thuộc tính
  const cleanName = cleanMojibake(product.name || "");
  const cleanDesc = cleanMojibake(product.description || "");

  let cleanVariants = product.variants;
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    cleanVariants = product.variants.map((v) => {
      const cleanOptions = {};
      if (v.options && typeof v.options === "object") {
        for (const [k, val] of Object.entries(v.options)) {
          cleanOptions[cleanMojibake(k)] = cleanMojibake(String(val || ""));
        }
      }
      let vName = cleanMojibake(v.name || "");
      if ((!vName || /Ä|Ã|áº|á»|Báº|XÃ|[\uFFFD□]/.test(vName)) && Object.keys(cleanOptions).length > 0) {
        vName = Object.values(cleanOptions).filter(Boolean).join(" / ");
      }
      if (String(product.id) === "P025") {
        const p025Map = {
          "P025-VAR-1": "Đen Stealth / Bản 4 đầu massage",
          "P025-VAR-2": "Đen Stealth / Bản 6 đầu chuyên sâu",
          "P025-VAR-3": "Xám Titan / Bản 4 đầu massage",
          "P025-VAR-4": "Xám Titan / Bản 6 đầu chuyên sâu"
        };
        if (p025Map[v.id]) vName = p025Map[v.id];
      }
      return {
        ...v,
        name: vName,
        options: cleanOptions
      };
    });
  }

  let cleanAttributes = product.attributes;
  if (Array.isArray(product.attributes) && product.attributes.length > 0) {
    cleanAttributes = product.attributes.map((a) => ({
      ...a,
      name: cleanMojibake(a.name || ""),
      values: Array.isArray(a.values) ? a.values.map(cleanMojibake) : a.values
    }));
  }

  const next = {
    ...product,
    name: cleanName,
    description: cleanDesc,
    tags: cleanTags,
    variants: cleanVariants,
    attributes: cleanAttributes
  };

  if (Array.isArray(product.gallery) || rawGallery.length > 0) {
    next.gallery = cleanGallery;
    if (product.galleryJson !== undefined) {
      next.galleryJson = JSON.stringify(cleanGallery);
    }
  }
  return next;
}

export function sanitizeProductsCollection(list = []) {
  if (!Array.isArray(list)) return [];
  return list.map((p) => sanitizeProductRecord(p));
}

/**
 * Tính toán tổng tồn kho thực tế của sản phẩm
 * (Nếu có biến thể: tổng tồn kho bằng tổng số lượng tồn của các biến thể)
 */
export function computeProductStock(product) {
  if (!product) return 0;
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    return product.variants.reduce((sum, v) => sum + Math.max(0, Number(v.stock) || 0), 0);
  }
  return Math.max(0, Number(product.stock) || 0);
}

/**
 * Tính toán trạng thái kinh doanh tổng hợp của sản phẩm
 */
export function computeProductStatus(product) {
  if (!product) return "Tạm hết hàng";
  if (product.status === "Ngừng kinh doanh") return "Ngừng kinh doanh";
  const stock = computeProductStock(product);
  if (stock <= 0) return "Tạm hết hàng";
  if (stock <= 15) return "Sắp hết";
  return "Còn hàng";
}

/**
 * Kiểm tra dải giá của sản phẩm nếu các biến thể có giá khác nhau
 */
export function getProductPriceRange(product) {
  if (!product) return { min: 0, max: 0, hasRange: false };
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    const prices = product.variants.map((v) => Number(v.price)).filter((p) => !isNaN(p) && p > 0);
    if (prices.length > 0) {
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      return { min, max, hasRange: min < max };
    }
  }
  const base = Number(product.price) || 0;
  return { min: base, max: base, hasRange: false };
}

/**
 * Tóm tắt tồn kho chi tiết (hỗ trợ kiểm tra hết hàng từng phần / toàn bộ)
 */
export function getProductStockSummary(product) {
  if (!product) {
    return {
      totalStock: 0,
      status: "Tạm hết hàng",
      hasVariants: false,
      hasPartialSoldOut: false,
      variantCount: 0,
      availableVariantCount: 0
    };
  }

  const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
  if (!hasVariants) {
    const stock = Math.max(0, Number(product.stock) || 0);
    const status = product.status === "Ngừng kinh doanh"
      ? "Ngừng kinh doanh"
      : (stock <= 0 ? "Tạm hết hàng" : (stock <= 15 ? "Sắp hết" : "Còn hàng"));
    return {
      totalStock: stock,
      status,
      hasVariants: false,
      hasPartialSoldOut: false,
      variantCount: 0,
      availableVariantCount: stock > 0 ? 1 : 0
    };
  }

  const variantCount = product.variants.length;
  let totalStock = 0;
  let availableVariantCount = 0;
  let soldOutVariantCount = 0;

  product.variants.forEach((v) => {
    const s = Math.max(0, Number(v.stock) || 0);
    totalStock += s;
    if (s > 0) availableVariantCount++;
    else soldOutVariantCount++;
  });

  let status = "Còn hàng";
  if (product.status === "Ngừng kinh doanh") {
    status = "Ngừng kinh doanh";
  } else if (availableVariantCount === 0 || totalStock <= 0) {
    status = "Tạm hết hàng";
  } else if (totalStock <= 15) {
    status = "Sắp hết";
  }

  const hasPartialSoldOut = availableVariantCount > 0 && soldOutVariantCount > 0;

  return {
    totalStock,
    status,
    hasVariants: true,
    hasPartialSoldOut,
    variantCount,
    availableVariantCount
  };
}

export async function initStore() {
  let backendLoaded = false;

  // 1. Đồng bộ từ Java Spring Boot Backend (MySQL)
  try {
    const [categories, products, campaigns, banners, orders, users] = await Promise.all([
      apiFetch("/api/categories").catch(() => null),
      apiFetch("/api/products").catch(() => null),
      apiFetch("/api/campaigns").catch(() => null),
      apiFetch("/api/banners").catch(() => null),
      apiFetch("/api/orders").catch(() => null),
      apiFetch("/api/users").catch(() => null)
    ]);

    if (categories && Array.isArray(categories) && categories.length > 0) {
      write(CATEGORY_KEY, categories);
      backendLoaded = true;
    }
    if (products && Array.isArray(products) && products.length > 0) {
      const existingLocal = read(PRODUCT_KEY) || [];
      const localMap = new Map(existingLocal.map((p) => [String(p.id), p]));
      let seed = null;
      try {
        seed = await loadSeedData();
      } catch (_) {}
      const seedMap = new Map((seed?.products || []).map((sp) => [String(sp.id), sp]));

      const mergedProducts = products.map((bp) => {
        const lp = localMap.get(String(bp.id));
        const sp = seedMap.get(String(bp.id));

        let variants = [];
        let attributes = [];
        let hasVariants = false;

        // 1. bp.variants từ backend (nếu có)
        if (Array.isArray(bp.variants) && bp.variants.length > 0) {
          variants = bp.variants;
          hasVariants = true;
        } else if (bp.variantsJson) {
          try {
            const parsed = typeof bp.variantsJson === "string" ? JSON.parse(bp.variantsJson) : bp.variantsJson;
            if (Array.isArray(parsed) && parsed.length > 0) {
              variants = parsed;
              hasVariants = true;
            }
          } catch (_) {}
        }

        // 2. localStorage variants (giữ lại nếu backend chưa đồng bộ)
        if (variants.length === 0 && lp && Array.isArray(lp.variants) && lp.variants.length > 0) {
          variants = lp.variants;
          hasVariants = true;
        }

        // 3. seed variants (dự phòng)
        if (variants.length === 0 && sp && Array.isArray(sp.variants) && sp.variants.length > 0) {
          variants = sp.variants;
          hasVariants = true;
        }

        // Đồng bộ attributes
        if (Array.isArray(bp.attributes) && bp.attributes.length > 0) {
          attributes = bp.attributes;
        } else if (bp.attributesJson) {
          try {
            const parsed = typeof bp.attributesJson === "string" ? JSON.parse(bp.attributesJson) : bp.attributesJson;
            if (Array.isArray(parsed) && parsed.length > 0) {
              attributes = parsed;
            }
          } catch (_) {}
        }

        if (attributes.length === 0 && lp && Array.isArray(lp.attributes) && lp.attributes.length > 0) {
          attributes = lp.attributes;
        }

        if (attributes.length === 0 && sp && Array.isArray(sp.attributes) && sp.attributes.length > 0) {
          attributes = sp.attributes;
        }

        // Đồng bộ cấu hình Nhãn Mới & Khuyến Mãi
        let newBadge = bp.newBadge || null;
        if (!newBadge && bp.newBadgeJson) {
          try {
            newBadge = typeof bp.newBadgeJson === "string" ? JSON.parse(bp.newBadgeJson) : bp.newBadgeJson;
          } catch (_) {}
        }
        if (!newBadge && lp && lp.newBadge) newBadge = lp.newBadge;

        let discount = bp.discount || null;
        if (!discount && bp.discountJson) {
          try {
            discount = typeof bp.discountJson === "string" ? JSON.parse(bp.discountJson) : bp.discountJson;
          } catch (_) {}
        }
        if (!discount && lp && lp.discount) discount = lp.discount;

        // Đồng bộ gallery ảnh & liên kết biến thể
        let gallery = [];
        if (Array.isArray(bp.gallery) && bp.gallery.length > 0) {
          gallery = bp.gallery;
        } else if (bp.galleryJson) {
          try {
            const parsed = typeof bp.galleryJson === "string" ? JSON.parse(bp.galleryJson) : bp.galleryJson;
            if (Array.isArray(parsed) && parsed.length > 0) gallery = parsed;
          } catch (_) {}
        }
        if (gallery.length === 0 && lp && Array.isArray(lp.gallery) && lp.gallery.length > 0) {
          gallery = lp.gallery;
        }
        if (gallery.length === 0 && sp && Array.isArray(sp.gallery) && sp.gallery.length > 0) {
          gallery = sp.gallery;
        }

        const prodObj = {
          ...bp,
          newBadge,
          discount,
          gallery,
          galleryJson: JSON.stringify(gallery),
          updatedAt: bp.updatedAt || lp?.updatedAt || null,
          updatedBy: bp.updatedBy || lp?.updatedBy || null,
          hasVariants: Boolean(hasVariants || (variants && variants.length > 0)),
          attributes,
          variants
        };

        if (prodObj.hasVariants && prodObj.variants.length > 0) {
          prodObj.stock = computeProductStock(prodObj);
          prodObj.status = computeProductStatus(prodObj);
        }

        return prodObj;
      });

      // Giữ lại sản phẩm chỉ có ở localStorage (nếu có)
      const backendIdSet = new Set(products.map((p) => String(p.id)));
      for (const lp of existingLocal) {
        if (!backendIdSet.has(String(lp.id))) {
          mergedProducts.push(lp);
        }
      }

      write(PRODUCT_KEY, mergedProducts);
      backendLoaded = true;
    }
    if (campaigns && Array.isArray(campaigns)) {
      write(CAMPAIGN_KEY, campaigns);
    }
    if (banners && Array.isArray(banners)) {
      write(BANNER_KEY, banners);
    }
    if (orders && Array.isArray(orders)) {
      write(ORDER_KEY, orders);
    }
    if (users && Array.isArray(users)) {
      write(USER_KEY, users);
    }
  } catch (e) {
    console.warn("Backend Spring Boot chưa sẵn sàng, sử dụng dữ liệu dự phòng cục bộ.");
  }

  // 2. Dự phòng Seed Data nếu Backend chưa có dữ liệu hoặc đang khởi động
  if (!backendLoaded && (!localStorage.getItem(PRODUCT_KEY) || getProducts().length === 0)) {
    const seed = await loadSeedData();
    if (!localStorage.getItem(PRODUCT_KEY)) write(PRODUCT_KEY, seed.products);
    if (!localStorage.getItem(CATEGORY_KEY)) write(CATEGORY_KEY, seed.categories);
    if (!localStorage.getItem(ORDER_KEY)) write(ORDER_KEY, seed.orders || []);
    if (!localStorage.getItem(CAMPAIGN_KEY)) write(CAMPAIGN_KEY, seed.campaigns || []);
    if (!localStorage.getItem(BANNER_KEY)) write(BANNER_KEY, seed.banners || []);
  }

  // 3. Đồng bộ nâng cấp biến thể cho dữ liệu sản phẩm trong localStorage (P002, P003...)
  try {
    const existingProds = read(PRODUCT_KEY);
    if (Array.isArray(existingProds) && existingProds.length > 0) {
      const seed = await loadSeedData();
      let hasChange = false;

      // Loại bỏ các ID ghế trùng lặp đã được gộp vào P026
      const deprecatedDuplicateIds = new Set(["P030", "P031", "P034", "P037", "P038"]);
      let sanitizedProds = existingProds.filter((p) => !deprecatedDuplicateIds.has(String(p.id)));
      if (sanitizedProds.length !== existingProds.length) {
        hasChange = true;
      }

      const supersededSeedImages = new Set([
        "./images/11-8974.jpg",
        "./images/800x800_21-3071.jpg",
        "./images/fufutech-modern-4colors-banner.jpg"
      ]);
      const supersededVariantImages = {
        "P026-VAR-1": "./images/1_1-2096.jpg",
        "P026-VAR-7": "./images/54_4(118).jpg",
        "P027-VAR-1": "./images/800x800_21-3071.jpg",
        "P028-VAR-3": "./images/13-4091.jpg"
      };

      const upgraded = sanitizedProds.map((p) => {
        const seedMatch = (seed.products || []).find((sp) => sp.id === p.id);
        if (seedMatch) {
          if (seedMatch.image && p.image !== seedMatch.image && supersededSeedImages.has(p.image)) {
            hasChange = true;
            p = { ...p, image: seedMatch.image };
          }
          if (Array.isArray(p.variants) && Array.isArray(seedMatch.variants)) {
            let varImgChanged = false;
            const syncedVars = p.variants.map((v) => {
              const sv = seedMatch.variants.find((item) => item.id === v.id);
              if (sv && sv.image && v.image !== sv.image && supersededVariantImages[v.id] === v.image) {
                varImgChanged = true;
                return { ...v, image: sv.image };
              }
              return v;
            });
            if (varImgChanged) {
              hasChange = true;
              p = { ...p, variants: syncedVars };
            }
          }
          if (seedMatch.newBadge && (!p.newBadge || JSON.stringify(p.newBadge) !== JSON.stringify(seedMatch.newBadge))) {
            hasChange = true;
            p = { ...p, newBadge: seedMatch.newBadge };
          }
          if (seedMatch.discount && (!p.discount || JSON.stringify(p.discount) !== JSON.stringify(seedMatch.discount))) {
            hasChange = true;
            p = { ...p, discount: seedMatch.discount };
          }
          if (seedMatch.gallery && (!p.gallery || JSON.stringify(deduplicateGalleryEntries(p.gallery)) !== JSON.stringify(deduplicateGalleryEntries(seedMatch.gallery)))) {
            hasChange = true;
            p = { ...p, gallery: deduplicateGalleryEntries(seedMatch.gallery) };
          }
          // Cập nhật P026 vừa được hợp nhất toàn diện với gallery sạch và 2 tầng lựa chọn
          if (p.id === "P026" && seedMatch.variants && (seedMatch.variants.length !== (p.variants?.length || 0) || (seedMatch.gallery?.length || 0) > (p.gallery?.length || 0))) {
            hasChange = true;
            p = {
              ...p,
              name: seedMatch.name,
              price: seedMatch.price,
              image: seedMatch.image,
              description: seedMatch.description,
              gallery: deduplicateGalleryEntries(seedMatch.gallery),
              hasVariants: true,
              attributes: seedMatch.attributes,
              variants: seedMatch.variants,
              stock: computeProductStock(seedMatch),
              status: computeProductStatus(seedMatch)
            };
          }
        }
        const cleanedProd = sanitizeProductRecord(p);
        if (JSON.stringify(cleanedProd.tags) !== JSON.stringify(p.tags) || JSON.stringify(cleanedProd.gallery) !== JSON.stringify(p.gallery)) {
          hasChange = true;
        }
        p = cleanedProd;
        if (seedMatch && seedMatch.price > 0 && (Number(p.price) === 0 || p.isDraft || p.status === "Bản nháp")) {
          hasChange = true;
          return {
            ...p,
            ...seedMatch,
            stock: seedMatch.hasVariants && seedMatch.variants ? computeProductStock(seedMatch) : seedMatch.stock,
            status: seedMatch.hasVariants && seedMatch.variants ? computeProductStatus(seedMatch) : seedMatch.status
          };
        }
        if (seedMatch && seedMatch.variants && (!p.variants || p.variants.length === 0)) {
          hasChange = true;
          return {
            ...p,
            hasVariants: true,
            attributes: seedMatch.attributes,
            variants: seedMatch.variants,
            stock: computeProductStock(seedMatch),
            status: computeProductStatus(seedMatch)
          };
        }
        if (p.variants && p.variants.length > 0) {
          const computedStk = computeProductStock(p);
          const computedStat = computeProductStatus(p);
          if (p.stock !== computedStk || p.status !== computedStat) {
            hasChange = true;
            return { ...p, stock: computedStk, status: computedStat };
          }
        }
        return p;
      });

      // Đồng bộ thêm sản phẩm mới (P026 - P036) nếu chưa có trong localStorage
      const existingIdSet = new Set(sanitizedProds.map((p) => String(p.id)));
      (seed.products || []).forEach((sp) => {
        if (!existingIdSet.has(String(sp.id)) && !deprecatedDuplicateIds.has(String(sp.id))) {
          hasChange = true;
          upgraded.push(sp);
        }
      });

      if (hasChange) {
        write(PRODUCT_KEY, upgraded);
      }
    }
  } catch (e) {
    console.warn("Lỗi khi kiểm tra nâng cấp biến thể cục bộ:", e);
  }

  // Đồng bộ danh sách người dùng từ file users.json trên máy chủ
  await syncUsersFromDisk();

  // Đồng bộ dữ liệu đánh giá & bình luận từ Backend API (/api/reviews) hoặc file dự phòng
  try {
    const revApiRes = await fetch("/api/reviews");
    if (revApiRes.ok) {
      const apiReviews = await revApiRes.json();
      if (Array.isArray(apiReviews) && apiReviews.length > 0) {
        const backendMap = {};
        for (const r of apiReviews) {
          if (!r || r.isDeleted) continue;
          const pid = String(r.productId || "");
          if (!pid) continue;
          if (!backendMap[pid]) backendMap[pid] = [];

          let adminReply = null;
          if (r.adminReply && typeof r.adminReply === "object") {
            adminReply = r.adminReply;
          } else if (r.adminReplyJson) {
            try { adminReply = JSON.parse(r.adminReplyJson); } catch {}
          }

          let comments = [];
          if (Array.isArray(r.comments)) {
            comments = r.comments;
          } else if (r.commentsJson) {
            try { comments = JSON.parse(r.commentsJson); } catch {}
          }

          backendMap[pid].push({
            id: r.id,
            productId: pid,
            orderId: r.orderId || null,
            userId: r.userId || null,
            userEmail: r.userEmail || null,
            authorName: r.authorName || "Khách hàng EcoDesk",
            authorAvatar: r.authorAvatar || null,
            rating: Number(r.rating) || 5,
            comment: r.comment || "",
            verifiedPurchase: Boolean(r.verifiedPurchase),
            date: (r.createdAt || "").slice(0, 10),
            createdAt: r.createdAt || new Date().toISOString(),
            updatedAt: r.updatedAt || null,
            isDeleted: Boolean(r.isDeleted),
            adminReply,
            comments: Array.isArray(comments) ? comments : []
          });
        }
        localStorage.setItem("ecodesk_customer_reviews", JSON.stringify(backendMap));
      }
    }
  } catch {}

  try {
    const revRes = await fetch("/api-reviews");
    if (revRes.ok) {
      const diskReviews = await revRes.json();
      if (diskReviews && typeof diskReviews === "object" && !Array.isArray(diskReviews) && Object.keys(diskReviews).length > 0) {
        const localRaw = JSON.parse(localStorage.getItem("ecodesk_customer_reviews") || "{}");
        const localReviews = localRaw && typeof localRaw === "object" && !Array.isArray(localRaw) ? localRaw : {};
        const mergedReviews = { ...diskReviews };
        Object.keys(localReviews).forEach((pid) => {
          const lList = Array.isArray(localReviews[pid]) ? localReviews[pid] : [];
          const dList = Array.isArray(mergedReviews[pid]) ? mergedReviews[pid] : [];
          const byId = new Map(dList.map((r, i) => [String(r.id || `REV_LEGACY_${pid}_${i}`), r]));
          lList.forEach((lr, i) => {
            const rid = String(lr.id || `REV_LEGACY_${pid}_${i}`);
            const dr = byId.get(rid);
            if (!dr) {
              byId.set(rid, lr);
            } else {
              const drTs = new Date(dr.deletedAt || dr.updatedAt || dr.adminReply?.updatedAt || dr.adminReply?.createdAt || dr.createdAt || 0).getTime();
              const lrTs = new Date(lr.deletedAt || lr.updatedAt || lr.adminReply?.updatedAt || lr.adminReply?.createdAt || lr.createdAt || 0).getTime();
              if (lrTs > drTs) byId.set(rid, lr);
            }
          });
          mergedReviews[pid] = Array.from(byId.values());
        });
        localStorage.setItem("ecodesk_customer_reviews", JSON.stringify(mergedReviews));
      }
    }
  } catch {}

  // Khởi tạo người dùng admin dự phòng nếu chưa có
  if (!localStorage.getItem(USER_KEY) || read(USER_KEY).length === 0) {
    const defaultAdmin = {
      id: "U_ADMIN",
      name: "Quản trị viên EcoDesk",
      email: "admin@ecodesk.vn",
      password: "admin",
      role: "admin",
      phone: "0901234567",
      createdAt: new Date().toISOString(),
      spendTotal: 0,
      tier: null,
      coupons: [],
      favorites: [],
      avatar: null
    };
    write(USER_KEY, [defaultAdmin]);
    syncUsersToDisk([defaultAdmin]);
  }

  // Đồng bộ nhất quán tags, gallery, lượt bán (từ đơn hoàn tất) và điểm đánh giá xác minh vào cache cục bộ
  try {
    const storedProds = read(PRODUCT_KEY);
    if (Array.isArray(storedProds) && storedProds.length > 0) {
      const orders = read(ORDER_KEY);
      let synced = sanitizeProductsCollection(storedProds);
      synced = syncProductsSoldWithOrders(synced, Array.isArray(orders) ? orders : []);
      synced = syncProductsRatingWithReviews(synced, Array.isArray(orders) ? orders : []);
      if (JSON.stringify(synced) !== JSON.stringify(storedProds)) {
        write(PRODUCT_KEY, synced);
      }
    }
  } catch {}
}

export function syncProductsSoldWithOrders(productsList = [], ordersList = []) {
  const soldMap = {};
  for (const o of ordersList) {
    if (o && isOrderCompletedForSales(o.status)) {
      const items = parseOrderItemsSafe(o);
      for (const item of items) {
        const pId = item.productId || item.id;
        if (pId) {
          soldMap[String(pId)] = (soldMap[String(pId)] || 0) + (Math.max(1, Number(item.quantity) || 1));
        }
      }
    }
  }
  return productsList.map((p) => ({
    ...p,
    sold: soldMap[String(p.id)] || 0
  }));
}

export function syncProductsRatingWithReviews(productsList = [], ordersList = null) {
  let reviewsMap = {};
  try {
    const raw = JSON.parse(localStorage.getItem("ecodesk_customer_reviews") || "{}");
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      reviewsMap = raw;
    }
  } catch {}
  const orders = Array.isArray(ordersList) ? ordersList : read(ORDER_KEY);
  return productsList.map((p) => {
    const rawList = Array.isArray(reviewsMap[String(p.id)]) ? reviewsMap[String(p.id)] : [];
    const valid = rawList.filter((r) => {
      if (!r || r.isDeleted) return false;
      const ratingNum = Number(r.rating);
      if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) return false;
      return isVerifiedPurchaseReviewRecord({ ...r, productId: r.productId || p.id }, orders);
    });
    const count = valid.length;
    const avg = count > 0
      ? Number((valid.reduce((sum, r) => sum + Number(r.rating), 0) / count).toFixed(1))
      : 0;
    return {
      ...p,
      rating: avg,
      reviewCount: count
    };
  });
}

export const getProducts = () => {
  const prods = read(PRODUCT_KEY);
  const orders = read(ORDER_KEY);
  let result = sanitizeProductsCollection(Array.isArray(prods) ? prods : []);

  // Tự động đồng bộ và lưu lại vào localStorage nếu phát hiện dữ liệu cũ bị lỗi font/mojibake
  try {
    if (Array.isArray(prods) && prods.length > 0) {
      const rawStr = JSON.stringify(prods);
      const cleanStr = JSON.stringify(result);
      if (rawStr !== cleanStr) {
        write(PRODUCT_KEY, result);
      }
    }
  } catch (_) {}

  if (result.length > 0 && Array.isArray(orders)) {
    result = syncProductsSoldWithOrders(result, orders);
  }
  if (result.length > 0) {
    result = syncProductsRatingWithReviews(result, orders);
  }
  if (Array.isArray(result)) {
    return result.map((p) => {
      if (Array.isArray(p.variants) && p.variants.length > 0) {
        return {
          ...p,
          stock: computeProductStock(p),
          status: computeProductStatus(p)
        };
      }
      return p;
    });
  }
  return result;
};
export const getCategories = () => read(CATEGORY_KEY);
export const getOrders = () => read(ORDER_KEY);
export const saveProducts = (products) => write(PRODUCT_KEY, products);
export const saveCategories = (categories) => write(CATEGORY_KEY, categories);
export async function syncUsersFromDisk() {
  try {
    const res = await fetch("/api-users");
    if (res.ok) {
      const diskUsers = await res.json();
      if (Array.isArray(diskUsers) && diskUsers.length > 0) {
        const localUsers = read(USER_KEY, []);
        const map = new Map();
        localUsers
          .filter((u) => u && String(u.id) !== "U_ADMIN_01" && !u.hidden)
          .forEach((u) => map.set(String(u.id), u));
        diskUsers
          .filter((du) => du && String(du.id) !== "U_ADMIN_01" && !du.hidden)
          .forEach((du) => {
          if (!map.has(String(du.id))) {
            map.set(String(du.id), du);
          } else {
            const loc = map.get(String(du.id));
            map.set(String(du.id), {
              ...loc,
              avatar: loc.avatar || du.avatar || null,
              permissions: loc.permissions && loc.permissions.length > 0 ? loc.permissions : (du.permissions || []),
              favorites: Array.from(new Set([...(loc.favorites || []), ...(du.favorites || [])]))
            });
          }
        });
        const merged = Array.from(map.values());
        write(USER_KEY, merged);
        return merged;
      }
    }
  } catch (err) {
    console.warn("Không đồng bộ được users từ disk:", err);
  }
  return getUsers();
}

export const loadUsersFromDisk = syncUsersFromDisk;

export async function syncUsersToDisk(users = getUsers()) {
  try {
    await fetch("/api-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(users)
    });
  } catch (err) {
    console.warn("Không lưu được users ra disk:", err);
  }
}

export const saveUsers = (users) => {
  write(USER_KEY, users);
  syncUsersToDisk(users).catch(() => {});
};
export const getCampaigns = () => read(CAMPAIGN_KEY);
export const saveCampaigns = (campaigns) => write(CAMPAIGN_KEY, campaigns);
export const getBanners = () => read(BANNER_KEY);
export const saveBanners = (banners) => write(BANNER_KEY, banners);
export const saveOrders = (orders) => write(ORDER_KEY, orders);
export const getAuditLogs = () => read(AUDIT_LOG_KEY);
export const saveAuditLogs = (logs) => write(AUDIT_LOG_KEY, logs);

export function addAuditLog(entry = {}) {
  const currentLogs = getAuditLogs();
  const logItem = {
    id: `LOG_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...entry
  };
  saveAuditLogs([logItem, ...currentLogs]);
  return logItem;
}

export async function createCategory(category) {
  const newCat = {
    id: category.id.trim(),
    name: category.name.trim()
  };

  try {
    const saved = await apiFetch("/api/categories", {
      method: "POST",
      body: JSON.stringify(newCat)
    });
    if (saved) {
      const categories = getCategories();
      const next = [saved, ...categories.filter(c => c.id !== saved.id)];
      saveCategories(next);
      return saved;
    }
  } catch (err) {
    console.warn("Lưu danh mục vào API thất bại, lưu cục bộ:", err);
  }

  const categories = getCategories();
  const next = [...categories.filter(c => c.id !== newCat.id), newCat];
  saveCategories(next);
  return newCat;
}

export async function updateCategory(id, updates) {
  try {
    const updated = await apiFetch(`/api/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates)
    });
    if (updated) {
      const categories = getCategories().map(c => c.id === id ? { ...c, ...updated } : c);
      saveCategories(categories);
      return updated;
    }
  } catch (err) {
    console.warn("Cập nhật danh mục trên API thất bại, cập nhật cục bộ:", err);
  }

  const categories = getCategories().map(c => c.id === id ? { ...c, ...updates } : c);
  saveCategories(categories);
  return categories.find(c => c.id === id);
}

export async function deleteCategory(id) {
  try {
    await apiFetch(`/api/categories/${id}`, { method: "DELETE" });
  } catch (err) {
    console.warn("Xóa danh mục trên API thất bại:", err);
  }
  const categories = getCategories().filter(c => c.id !== id);
  saveCategories(categories);
}

export async function updateUserRole(userId, newRole, note = "") {
  const updated = await apiFetch(`/api/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify({ role: newRole, note })
  });
  if (updated) {
    const users = getUsers().map(u => {
      if (String(u.id) === String(userId)) {
        const defaultPerms = newRole === "cashier"
          ? [...DEFAULT_CASHIER_PERMISSIONS]
          : (newRole === "staff" ? [...DEFAULT_STAFF_PERMISSIONS] : []);
        return {
          ...u,
          ...updated,
          role: updated.role || newRole,
          note: updated.note ?? note,
          permissions: Array.isArray(updated.permissions) ? updated.permissions : defaultPerms
        };
      }
      return u;
    });
    saveUsers(users);
    return updated;
  }
  return null;
}

export async function updateUserActiveStatus(userId, active) {
  const updated = await apiFetch(`/api/users/${userId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ active: Boolean(active) })
  });
  if (updated) {
    const users = getUsers().map(u =>
      String(u.id) === String(userId) ? { ...u, active: updated.active !== false } : u
    );
    saveUsers(users);
  }
  return updated;
}

export async function createStaffAccountByAdmin(payload) {
  const created = await apiFetch("/api/users", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  if (created) {
    const users = getUsers().filter((u) => String(u.id) !== String(created.id));
    saveUsers([...users, created]);
  }
  return created;
}

export async function refreshCurrentUserSession() {
  const cur = getCurrentUser();
  if (!cur || !cur.id) return null;
  try {
    const fresh = await apiFetch(`/api/users/${encodeURIComponent(cur.id)}`);
    if (fresh && fresh.id) {
      if (fresh.active === false || fresh.hidden) {
        logoutUser();
        return null;
      }
      const merged = { ...cur, ...fresh };
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(merged));
      } catch {}
      write(SESSION_KEY, merged);
      const users = getUsers().map((u) => String(u.id) === String(fresh.id) ? { ...u, ...fresh } : u);
      write(USER_KEY, users);
      return merged;
    }
  } catch (err) {
    if (err && (err.status === 401 || err.status === 403)) {
      logoutUser();
      return null;
    }
  }
  return cur;
}

export async function updateOrderShippingInfo(orderId, { customerName, customerPhone, shippingAddress, note }) {
  const updatedAt = new Date().toISOString();
  const payload = {
    customerName: (customerName || "").trim(),
    customerPhone: (customerPhone || "").trim(),
    shippingAddress: (shippingAddress || "").trim(),
    note: (note || "").trim(),
    updatedAt
  };

  try {
    await apiFetch(`/api/orders/${orderId}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.warn("Cập nhật thông tin giao hàng qua API thất bại, cập nhật cục bộ:", err);
  }

  const orders = getOrders().map(o => {
    if (String(o.id) === String(orderId)) {
      return {
        ...o,
        customerName: payload.customerName || o.customerName,
        customerPhone: payload.customerPhone || o.customerPhone,
        shippingAddress: payload.shippingAddress || o.shippingAddress,
        note: payload.note !== undefined ? payload.note : o.note,
        updatedAt
      };
    }
    return o;
  });

  saveOrders(orders);
  return orders.find(o => String(o.id) === String(orderId));
}

export async function updateOrderStatus(orderId, newStatus, note = "", cancelReason = "", cancelledBy = "") {
  const timestamp = new Date().toISOString();
  
  // Lấy lịch sử hiện tại và bổ sung sự kiện mới
  const existingOrders = getOrders();
  const currentOrder = existingOrders.find((o) => String(o.id) === String(orderId));
  let history = [];
  if (currentOrder) {
    if (Array.isArray(currentOrder.statusHistory)) {
      history = [...currentOrder.statusHistory];
    } else if (currentOrder.statusHistoryJson) {
      try {
        const parsed = JSON.parse(currentOrder.statusHistoryJson);
        if (Array.isArray(parsed)) history = parsed;
      } catch (e) {
        history = [];
      }
    }
  }

  // Nếu lịch sử chưa có và đơn có createdAt, khởi tạo bước đặt đơn
  if (history.length === 0 && currentOrder && currentOrder.createdAt) {
    history.push({
      status: "Chờ xác nhận",
      timestamp: currentOrder.createdAt,
      note: "Đơn hàng đã được đặt thành công",
      by: currentOrder.customerName || "Khách hàng"
    });
  }

  const actor = cancelledBy || (newStatus === "Đã hủy" ? "Khách hàng" : "Quản trị viên / Cửa hàng");
  history.push({
    status: newStatus,
    timestamp,
    note: note || (cancelReason ? `Lý do: ${cancelReason}` : `Đổi trạng thái sang ${newStatus}`),
    by: actor
  });

  const currentActor = getCurrentUser();
  const payload = { 
    status: newStatus, 
    note,
    actorUserId: currentActor?.id || undefined,
    cancelReason: cancelReason || undefined,
    cancelledAt: newStatus === "Đã hủy" ? timestamp : undefined,
    cancelledBy: cancelledBy || undefined,
    statusHistoryJson: JSON.stringify(history)
  };

  try {
    await apiFetch(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  } catch (err) {
    if (err?.isHttpError && err.status >= 400 && err.status < 500) {
      throw err;
    }
    console.warn("Cập nhật trạng thái đơn qua API thất bại, cập nhật cục bộ:", err);
  }

  // Nếu đơn hàng bị hủy, hoàn lại số lượng tồn kho cho đúng biến thể và sản phẩm (chỉ hoàn 1 lần duy nhất)
  if (newStatus === "Đã hủy") {
    const orderToCancel = existingOrders.find((o) => String(o.id) === String(orderId));
    if (orderToCancel && !orderToCancel.stockRestored) {
      let items = [];
      try {
        if (orderToCancel.itemsJson) items = JSON.parse(orderToCancel.itemsJson);
        else if (Array.isArray(orderToCancel.items)) items = orderToCancel.items;
      } catch (e) {}

      if (items.length > 0) {
        const products = getProducts();
        for (const item of items) {
          const pId = item.productId || item.id;
          const targetProduct = products.find((p) => String(p.id) === String(pId));
          if (targetProduct) {
            const qty = Number(item.quantity) || 1;
            if (item.variantId && Array.isArray(targetProduct.variants)) {
              const targetVar = targetProduct.variants.find((v) => String(v.id) === String(item.variantId));
              if (targetVar) {
                targetVar.stock = (Number(targetVar.stock) || 0) + qty;
                targetVar.status = targetVar.stock === 0 ? "Tạm hết hàng" : (targetVar.stock <= 15 ? "Sắp hết" : "Còn hàng");
              }
              targetProduct.stock = computeProductStock(targetProduct);
            } else {
              targetProduct.stock = (Number(targetProduct.stock) || 0) + qty;
            }
            targetProduct.status = computeProductStatus(targetProduct);
          }
        }
        saveProducts(products);
      }
    }
  }

  const orders = getOrders().map(o => {
    if (String(o.id) === String(orderId)) {
      return {
        ...o,
        status: newStatus,
        cancelReason: cancelReason || o.cancelReason,
        cancelledAt: newStatus === "Đã hủy" ? (o.cancelledAt || timestamp) : o.cancelledAt,
        cancelledBy: cancelledBy || o.cancelledBy || (newStatus === "Đã hủy" ? "Khách hàng" : undefined),
        stockRestored: newStatus === "Đã hủy" ? true : o.stockRestored,
        statusHistory: history,
        statusHistoryJson: JSON.stringify(history)
      };
    }
    return o;
  });

  saveOrders(orders);
  const updatedOrder = orders.find(o => String(o.id) === String(orderId));
  if (updatedOrder) {
    try {
      createOrderStatusNotification({
        order: updatedOrder,
        oldStatus: currentOrder?.status || "",
        newStatus,
        note: note || cancelReason
      });
    } catch (err) {
      console.warn("Lỗi khi tạo thông báo trạng thái đơn hàng:", err);
    }
  }
  return updatedOrder;
}

function upsertOrderInLocalCache(savedOrder) {
  if (!savedOrder || !savedOrder.id) return savedOrder;
  const list = getOrders();
  const idx = list.findIndex((o) => String(o.id) === String(savedOrder.id));
  if (idx >= 0) {
    list[idx] = savedOrder;
  } else {
    list.unshift(savedOrder);
  }
  saveOrders(list);
  return savedOrder;
}

export async function requestOrderCancel(orderId, reason) {
  const user = getCurrentUser();
  if (!user || !user.id) {
    throw new Error("Bạn cần đăng nhập tài khoản sở hữu đơn hàng để gửi yêu cầu hủy.");
  }
  const saved = await apiFetch(`/api/orders/${encodeURIComponent(orderId)}/cancel-request`, {
    method: "POST",
    body: JSON.stringify({
      userId: user.id,
      reason: String(reason || "").trim(),
      requestedBy: user.name || user.email || "Khách hàng"
    })
  });
  return upsertOrderInLocalCache(saved);
}

export async function reviewOrderCancelRequest(orderId, decision, note = "") {
  const actor = getCurrentUser();
  if (!actor || !actor.id) {
    throw new Error("Bạn cần đăng nhập bằng tài khoản quản trị viên hoặc nhân viên.");
  }
  const saved = await apiFetch(`/api/orders/${encodeURIComponent(orderId)}/cancel-review`, {
    method: "POST",
    body: JSON.stringify({
      actorUserId: actor.id,
      decision,
      note: String(note || "").trim()
    })
  });
  upsertOrderInLocalCache(saved);
  if (String(decision).toUpperCase() === "APPROVE") {
    try {
      const freshProducts = await apiFetch("/api/products");
      if (Array.isArray(freshProducts)) {
        saveProducts(freshProducts);
      }
    } catch {}
  }
  return saved;
}

export async function confirmOrderRefund(orderId, note = "") {
  const actor = getCurrentUser();
  if (!actor || !actor.id) {
    throw new Error("Bạn cần đăng nhập bằng tài khoản quản trị viên hoặc nhân viên.");
  }
  const saved = await apiFetch(`/api/orders/${encodeURIComponent(orderId)}/refund-confirm`, {
    method: "POST",
    body: JSON.stringify({
      actorUserId: actor.id,
      note: String(note || "").trim()
    })
  });
  return upsertOrderInLocalCache(saved);
}

export async function confirmCodPayment(orderId) {
  const actor = getCurrentUser();
  if (!actor || !actor.id) {
    throw new Error("Bạn cần đăng nhập bằng tài khoản quản trị viên hoặc nhân viên có quyền.");
  }
  const saved = await apiFetch(`/api/orders/${encodeURIComponent(orderId)}/confirm-cod-payment`, {
    method: "POST",
    body: JSON.stringify({
      actorUserId: actor.id
    })
  });
  return upsertOrderInLocalCache(saved);
}

export function findProduct(id) {
  return getProducts().find((product) => String(product.id) === String(id));
}

export async function createProduct(product) {
  const finalVars = Array.isArray(product.variants) ? product.variants : [];
  const finalAttrs = Array.isArray(product.attributes) ? product.attributes : [];
  const rawGallery = Array.isArray(product.gallery) ? product.gallery : [];
  const finalGallery = deduplicateGalleryEntries(rawGallery);
  const cleanTags = normalizeProductTags(product.tags);
  const hasVars = Boolean(product.hasVariants || finalVars.length > 0);
  const currentUser = getCurrentUser();
  const currentAdminName = currentUser ? (currentUser.name || currentUser.email) : "Quản trị viên";
  const nowIso = new Date().toISOString();

  const newProduct = {
    ...product,
    id: product.id || `P${Date.now()}`,
    tags: cleanTags,
    rating: 0,
    reviewCount: 0,
    sold: Number(product.sold) || 0,
    createdAt: product.createdAt || nowIso.slice(0, 10),
    updatedAt: nowIso,
    updatedBy: currentAdminName,
    newBadge: product.newBadge || null,
    discount: product.discount || null,
    newBadgeJson: JSON.stringify(product.newBadge || null),
    discountJson: JSON.stringify(product.discount || null),
    gallery: finalGallery,
    galleryJson: JSON.stringify(finalGallery),
    hasVariants: hasVars,
    variants: finalVars,
    attributes: finalAttrs,
    variantsJson: JSON.stringify(finalVars),
    attributesJson: JSON.stringify(finalAttrs)
  };

  try {
    const saved = await apiFetch("/api/products", {
      method: "POST",
      body: JSON.stringify(newProduct)
    });
    if (saved) {
      const mergedSaved = {
        ...newProduct,
        ...saved,
        newBadge: product.newBadge || null,
        discount: product.discount || null,
        gallery: finalGallery,
        updatedAt: nowIso,
        updatedBy: currentAdminName,
        hasVariants: hasVars,
        variants: finalVars,
        attributes: finalAttrs
      };
      const products = getProducts();
      saveProducts([mergedSaved, ...products.filter(p => String(p.id) !== String(mergedSaved.id))]);
      return mergedSaved;
    }
  } catch (err) {
    console.warn("Lưu sản phẩm vào API thất bại, lưu cục bộ:", err);
  }

  const products = getProducts();
  saveProducts([newProduct, ...products]);
  return newProduct;
}

export async function updateProduct(id, updates) {
  const currentProds = getProducts();
  const existingProd = currentProds.find((p) => String(p.id) === String(id));
  const currentUser = getCurrentUser();
  const currentAdminName = currentUser ? (currentUser.name || currentUser.email) : (existingProd?.updatedBy || "Quản trị viên");
  const nowIso = new Date().toISOString();

  const finalVariants = updates.variants !== undefined
    ? (Array.isArray(updates.variants) ? updates.variants : [])
    : (existingProd?.variants || []);

  const finalAttributes = updates.attributes !== undefined
    ? (Array.isArray(updates.attributes) ? updates.attributes : [])
    : (existingProd?.attributes || []);

  const rawGallery = updates.gallery !== undefined
    ? (Array.isArray(updates.gallery) ? updates.gallery : [])
    : (existingProd?.gallery || []);
  const finalGallery = deduplicateGalleryEntries(rawGallery);

  const hasVars = Boolean(updates.hasVariants ?? (finalVariants.length > 0 || existingProd?.hasVariants));

  const finalNewBadge = updates.newBadge !== undefined ? updates.newBadge : (existingProd?.newBadge || null);
  const finalDiscount = updates.discount !== undefined ? updates.discount : (existingProd?.discount || null);
  const finalTags = updates.tags !== undefined
    ? normalizeProductTags(updates.tags)
    : normalizeProductTags(existingProd?.tags);

  const payload = {
    ...existingProd,
    ...updates,
    tags: finalTags,
    updatedAt: nowIso,
    updatedBy: currentAdminName,
    newBadge: finalNewBadge,
    discount: finalDiscount,
    newBadgeJson: JSON.stringify(finalNewBadge),
    discountJson: JSON.stringify(finalDiscount),
    gallery: finalGallery,
    galleryJson: JSON.stringify(finalGallery),
    hasVariants: hasVars,
    variants: finalVariants,
    attributes: finalAttributes,
    variantsJson: JSON.stringify(finalVariants),
    attributesJson: JSON.stringify(finalAttributes)
  };

  try {
    const updated = await apiFetch(`/api/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    if (updated) {
      const mergedUpdated = {
        ...(existingProd || {}),
        ...updated,
        ...payload,
        gallery: finalGallery,
        hasVariants: hasVars,
        variants: finalVariants,
        attributes: finalAttributes
      };
      const products = currentProds.map((p) => String(p.id) === String(id) ? mergedUpdated : p);
      saveProducts(products);
      return mergedUpdated;
    }
  } catch (err) {
    console.warn("Cập nhật API thất bại, cập nhật cục bộ:", err);
  }

  const mergedLocal = {
    ...(existingProd || {}),
    ...payload,
    hasVariants: hasVars,
    variants: finalVariants,
    attributes: finalAttributes
  };
  const products = currentProds.map((product) => String(product.id) === String(id) ? mergedLocal : product);
  saveProducts(products);
  return mergedLocal;
}

export async function deleteProduct(id) {
  try {
    await apiFetch(`/api/products/${id}`, { method: "DELETE" });
  } catch (err) {
    console.warn("Xóa trên API thất bại:", err);
  }
  saveProducts(getProducts().filter((product) => String(product.id) !== String(id)));
}

export function getCartKey() {
  const user = getCurrentUser();
  return user && user.id ? `ecodesk_cart_${user.id}` : "ecodesk_cart_guest";
}

export function getCart() {
  return read(getCartKey());
}

/**
 * Hợp nhất giỏ hàng khách vãng lai vào giỏ hàng của tài khoản ngay khi đăng nhập hoặc hoàn tất đăng ký.
 */
export function mergeGuestCartToUser(userId) {
  if (!userId) return [];
  const guestKey = "ecodesk_cart_guest";
  const guestCart = read(guestKey, []);
  if (!Array.isArray(guestCart) || guestCart.length === 0) {
    return read(`ecodesk_cart_${userId}`, []);
  }

  const userKey = `ecodesk_cart_${userId}`;
  const currentUserCart = read(userKey, []);
  const merged = Array.isArray(currentUserCart) ? [...currentUserCart] : [];

  for (const guestItem of guestCart) {
    if (!guestItem || !guestItem.productId) continue;
    const guestQty = Math.max(1, Math.floor(Number(guestItem.quantity) || 1));
    const idx = merged.findIndex(
      (item) =>
        String(item.productId) === String(guestItem.productId) &&
        String(item.variantId || "") === String(guestItem.variantId || "")
    );

    const product = findProduct(guestItem.productId);
    let maxStock = Number.POSITIVE_INFINITY;
    if (product) {
      const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
      if (hasVariants && guestItem.variantId) {
        const matchedVar = product.variants.find(
          (v) => String(v.id) === String(guestItem.variantId) || String(v.sku) === String(guestItem.variantId)
        );
        if (matchedVar && matchedVar.stock != null) {
          maxStock = Math.max(1, Number(matchedVar.stock) || 1);
        }
      } else if (product.stock != null) {
        maxStock = Math.max(1, Number(product.stock) || 1);
      }
    }

    if (idx >= 0) {
      const existingQty = Math.max(0, Number(merged[idx].quantity) || 0);
      merged[idx] = {
        ...merged[idx],
        quantity: Math.min(maxStock, existingQty + guestQty)
      };
    } else {
      merged.push({
        ...guestItem,
        quantity: Math.min(maxStock, guestQty)
      });
    }
  }

  write(userKey, merged);
  write(guestKey, []);
  return merged;
}

export function addToCart(productId, quantity = 1, variantId = null, variantOptions = null, variantName = null, variantPrice = null, variantImage = null) {
  const key = getCartKey();
  const cart = read(key);
  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  const product = findProduct(productId);
  if (!product) throw new Error("Sản phẩm không tồn tại.");

  const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
  let matchedVariant = null;
  let maxStock = 0;
  let variantSku = null;

  if (hasVariants) {
    if (!variantId) {
      throw new Error("Vui lòng chọn đầy đủ phân loại (màu sắc, kích thước hoặc phiên bản) trước khi thêm vào giỏ hàng.");
    }
    matchedVariant = product.variants.find(
      (varItem) => String(varItem.id) === String(variantId) || String(varItem.sku) === String(variantId)
    );
    if (!matchedVariant) {
      throw new Error("Phân loại sản phẩm bạn chọn không còn tồn tại hoặc đã thay đổi. Vui lòng tải lại trang.");
    }
    variantId = matchedVariant.id || variantId;
    maxStock = Math.max(0, Number(matchedVariant.stock) || 0);
    variantSku = matchedVariant.sku || null;
    variantName = matchedVariant.name || variantName || null;
    variantOptions = matchedVariant.options || variantOptions || null;
    variantImage = matchedVariant.image || variantImage || product.image;
  } else {
    variantId = null;
    maxStock = Math.max(0, Number(product.stock) || 0);
    variantImage = variantImage || product.image;
  }

  // Luôn tính lại giá thực tế tại thời điểm thêm từ dữ liệu admin/storage
  const rawBasePrice = matchedVariant && matchedVariant.price != null && !isNaN(matchedVariant.price)
    ? Number(matchedVariant.price)
    : Number(product.price || 0);
  const resolvedPricing = getPricing({ ...product, price: rawBasePrice }, new Date(), matchedVariant);
  const resolvedUnitPrice = Number(resolvedPricing.price || rawBasePrice);

  if (maxStock <= 0) {
    throw new Error(`Sản phẩm "${variantName ? `${product.name} (${variantName})` : product.name}" hiện đang tạm hết hàng.`);
  }

  const currentIdx = cart.findIndex((item) => 
    String(item.productId) === String(productId) && 
    String(item.variantId || "") === String(variantId || "")
  );

  let nextCart = [...cart];
  if (currentIdx >= 0) {
    const currentQty = Number(cart[currentIdx].quantity) || 0;
    const newQty = Math.min(maxStock, currentQty + qty);
    if (currentQty >= maxStock) {
      throw new Error(`Bạn đã có ${currentQty} sản phẩm trong giỏ (đạt số lượng tồn kho tối đa: ${maxStock}).`);
    }
    nextCart[currentIdx] = {
      ...cart[currentIdx],
      variantId: variantId ? String(variantId) : null,
      variantSku: variantSku,
      variantName: variantName || cart[currentIdx].variantName,
      selectedOptions: variantOptions || cart[currentIdx].selectedOptions || null,
      quantity: newQty,
      price: resolvedUnitPrice,
      image: variantImage || cart[currentIdx].image
    };
  } else {
    const addQty = Math.min(maxStock, qty);
    nextCart.push({
      productId: String(productId),
      variantId: variantId ? String(variantId) : null,
      variantSku: variantSku,
      variantName: variantName || null,
      selectedOptions: variantOptions || null,
      price: resolvedUnitPrice,
      image: variantImage || product.image,
      quantity: addQty
    });
  }

  write(key, nextCart);
  return nextCart;
}

export function updateCartItem(productId, quantity, variantId = null) {
  const key = getCartKey();
  const cart = read(key);
  const matchItem = (item) => 
    String(item.productId) === String(productId) && 
    String(item.variantId || "") === String(variantId || "");

  if (quantity <= 0) {
    const next = cart.filter((item) => !matchItem(item));
    write(key, next);
    return next;
  }

  const product = findProduct(productId);
  let maxStock = product ? computeProductStock(product) : 999;
  if (product && variantId && Array.isArray(product.variants)) {
    const v = product.variants.find(varItem => String(varItem.id) === String(variantId) || String(varItem.sku) === String(variantId));
    if (v) maxStock = Number(v.stock) || 0;
  }

  const validQty = Math.max(1, Math.min(maxStock, Math.floor(quantity)));
  const next = cart.map((item) => matchItem(item) ? { ...item, quantity: validQty } : item);
  write(key, next);
  return next;
}

export function clearCart(userId = getCurrentUser()?.id) {
  const key = userId ? `ecodesk_cart_${userId}` : getCartKey();
  write(key, []);
  try { localStorage.removeItem("ecodesk_cart"); } catch {}
}

export function getCartCount() {
  return getCart().reduce((total, item) => total + item.quantity, 0);
}

export function getUsers() {
  return read(USER_KEY);
}

export function getCurrentUser() {
  try {
    let sessionUser = null;
    const sessionVal = sessionStorage.getItem(SESSION_KEY);
    if (sessionVal) sessionUser = JSON.parse(sessionVal);
    else {
      const localVal = localStorage.getItem(SESSION_KEY);
      if (localVal) sessionUser = JSON.parse(localVal);
    }
    if (sessionUser) {
      const full = getUsers().find(u => String(u.id) === String(sessionUser.id));
      if (full) {
        sessionUser.name = full.name || sessionUser.name;
        sessionUser.avatar = full.avatar || null;
        sessionUser.permissions = full.permissions || [];
        sessionUser.role = full.role || sessionUser.role;
      }
    }
    return sessionUser;
  } catch {}
  return null;
}

export const tierForSpend = (spend) => spend >= 30000000 ? "Kim cương" : spend >= 10000000 ? "Vàng" : spend >= 3000000 ? "Bạc" : "Đồng";
const tierCoupon = { "Bạc": 3, "Vàng": 5, "Kim cương": 10 };

export function getAccount(userId = getCurrentUser()?.id) {
  const account = getUsers().find((user) => String(user.id) === String(userId)) || null;
  if (!account) return null;
  
  // Tính tổng chi tiêu tự động dựa trên các đơn hàng đã mua thành công (Hoàn thành)
  const orders = getOrders();
  const completed = orders.filter(o => 
    (String(o.userId) === String(userId) || (o.customerEmail && o.customerEmail.toLowerCase() === (account.email || "").toLowerCase())) &&
    o.status === "Hoàn thành"
  );
  if (completed.length > 0) {
    const dynamicSpend = completed.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const dynamicTier = tierForSpend(dynamicSpend);
    return {
      ...account,
      spendTotal: dynamicSpend,
      tier: dynamicTier
    };
  }
  return account;
}

function issueCoupon(type, percent, label, options = {}) {
  const suffix = crypto.getRandomValues(new Uint8Array(3)).reduce((code, byte) => code + byte.toString(16).padStart(2, "0"), "").toUpperCase();
  return { code: `${type}-${Date.now().toString(36).toUpperCase()}-${suffix}`, type, percent, label, used: false, createdAt: new Date().toISOString(), expiresAt: options.expiresAt || new Date(Date.now() + 60 * 86400000).toISOString(), ...options };
}

export function getActiveCoupons(userId = getCurrentUser()?.id) {
  const account = getAccount(userId);
  if (!account) return [];
  const now = new Date();
  const coupons = [...(account.coupons || [])];
  const activeSales = getCampaigns().filter((campaign) => campaign.active && new Date(campaign.startAt) <= now && new Date(campaign.endAt) >= now);
  const products = getProducts();
  for (const campaign of activeSales) {
    if (coupons.some((coupon) => coupon.campaignId === campaign.id)) continue;
    const product = products.find((item) => String(item.id) === String(campaign.productId));
    if (!product) continue;
    coupons.unshift(issueCoupon("SALE", campaign.percent || campaign.value || 10, `Sale hôm nay · ${product.name}`, {
      campaignId: campaign.id,
      productId: product.id,
      condition: `Chỉ dùng khi mua ${product.name}; mỗi mã dùng một lần.`,
      expiresAt: campaign.endAt
    }));
  }
  return coupons.filter((coupon) => !coupon.used && new Date(coupon.expiresAt) >= now);
}

export function getProductPrice(product, now = new Date(), variant = null) {
  const basePrice = (variant && variant.price != null) ? Number(variant.price) : Number(product.price);

  // 1. Kiểm tra chương trình khuyến mãi theo lịch riêng của từng sản phẩm
  const promoStatus = getDiscountPromotionStatus(product, now);
  if (promoStatus.active) {
    const calc = calculateDiscountPricing(basePrice, promoStatus.discount);
    if (calc.isValid) {
      return {
        original: basePrice,
        price: calc.price,
        percent: calc.percent,
        savings: calc.savings,
        code: `PROMO-${product.id}`,
        label: calc.label,
        badgeText: calc.badgeText,
        isProductPromo: true
      };
    }
  }

  // 2. Dự phòng: Chiến dịch ưu đãi chung / Ngày đôi / Ngày lễ
  const active = getCampaigns().filter((campaign) => campaign.active && String(campaign.productId) === String(product.id) && new Date(campaign.startAt) <= now && new Date(campaign.endAt) >= now).sort((a, b) => (b.percent || b.value || 0) - (a.percent || a.value || 0))[0];
  const number = Number.parseInt(String(product.id).replace(/\D/g, ""), 10) || 0;
  const doubleDay = now.getDate() === now.getMonth() + 1;
  const doublePercent = doubleDay ? Math.min(15, 10 + number % 6) : 0;
  const holidays = [
    { code: "MAR08", month: 2, day: 8, days: 1, name: "Quốc tế Phụ nữ" },
    { code: "APR30", month: 3, day: 30, days: 2, name: "Đại lễ tháng Tư" },
    { code: "SEP02", month: 8, day: 2, days: 1, name: "Quốc khánh" },
    { code: "OCT20", month: 9, day: 20, days: 1, name: "Ngày Phụ nữ Việt Nam" },
    { code: "NOV20", month: 10, day: 20, days: 1, name: "Ngày Nhà giáo Việt Nam" },
    { code: "DEC24", month: 11, day: 24, days: 2, name: "Mùa lễ hội cuối năm" }
  ].find((holiday) => {
    const date = new Date(now.getFullYear(), holiday.month, holiday.day);
    const offset = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - date) / 86400000);
    return Math.abs(offset) <= holiday.days;
  });
  const holidayPercent = holidays ? 20 + number % 31 : 0;
  const manualPercent = Number(active?.percent || active?.value || 0);
  let percent = Math.max(doublePercent, holidayPercent, manualPercent);
  let code = active?.code || "";
  let label = active?.name || "";
  if (holidayPercent > manualPercent && holidayPercent >= doublePercent) {
    code = `HOLIDAY-${holidays.code}-${product.id}`;
    label = holidays.name;
  }
  if (doubleDay && doublePercent >= Math.max(holidayPercent, manualPercent)) {
    percent = Math.min(15, doublePercent);
    code = `DOUBLE-${String(now.getMonth() + 1).padStart(2, "0")}-${product.id}`;
    label = "Ưu đãi ngày đôi";
  } else if (doubleDay) {
    percent = Math.min(15, percent);
  }
  if (active && manualPercent >= Math.max(doublePercent, holidayPercent)) {
    code = active.code;
    label = active.name;
  }
  if (active?.type !== "special") percent = Math.min(50, percent);
  return {
    original: basePrice,
    price: Math.round(basePrice * (100 - percent) / 100),
    percent,
    savings: Math.round(basePrice * (percent / 100)),
    code,
    label,
    badgeText: percent > 0 ? `-${percent}%` : ""
  };
}

function toSessionUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || "customer",
    avatar: user.avatar || null,
    permissions: user.permissions || []
  };
}

/**
 * Băm mật khẩu một chiều bằng thuật toán SHA-256 (Web Crypto API)
 */
export async function hashPassword(plainText) {
  if (!plainText) return "";
  try {
    if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(plainText);
      const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch {}
  return plainText;
}

/**
 * Kiểm tra mật khẩu (hỗ trợ cả mật khẩu băm SHA-256 và mật khẩu cũ dự phòng)
 */
export async function verifyPassword(plainInput, stored) {
  if (!plainInput || !stored) return false;
  // Nếu mật khẩu lưu trữ là chuỗi băm SHA-256 (64 ký tự hex)
  if (stored.length === 64 && /^[0-9a-fA-F]{64}$/.test(stored)) {
    const hashed = await hashPassword(plainInput);
    return hashed.toLowerCase() === stored.toLowerCase();
  }
  // Tương thích ngược với tài khoản bản rõ
  return plainInput === stored;
}

/**
 * Kiểm tra độ mạnh của mật khẩu theo chuẩn bảo mật (tối thiểu 8 ký tự cho đặt lại / đổi mật khẩu)
 */
export function isStrongPassword(password) {
  if (!password || typeof password !== "string") return false;
  return (
    password.length >= 8 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password)
  );
}

/**
 * Kiểm tra độ mạnh mật khẩu khi đăng ký tài khoản mới (đủ 5 tiêu chí trên form)
 */
export function isStrongRegisterPassword(password) {
  if (!password || typeof password !== "string") return false;
  return (
    password.length >= 10 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

function establishAuthenticatedSession(rawUser) {
  const safeUser = { ...rawUser };
  delete safeUser.password;
  const sessionUser = toSessionUser(safeUser);
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
  } catch {}
  write(SESSION_KEY, sessionUser);
  mergeGuestCartToUser(sessionUser.id);
  const existingUsers = getUsers().filter((u) => String(u.id) !== String(safeUser.id));
  write(USER_KEY, [safeUser, ...existingUsers]);
  syncUsersToDisk();
  return sessionUser;
}

/**
 * Bước 1 đăng ký: gửi thông tin & yêu cầu backend gửi OTP 6 chữ số thật qua email
 */
export async function requestRegistrationOtp(data) {
  try {
    return await apiFetch("/api/auth/register/request-otp", {
      method: "POST",
      body: JSON.stringify({
        name: (data.name || "").trim(),
        email: (data.email || "").trim().toLowerCase(),
        password: data.password || "",
        phone: (data.phone || "").trim()
      })
    });
  } catch (err) {
    if (err.isHttpError) throw err;
    throw new Error("Không thể kết nối máy chủ gửi email OTP (/api/auth). Vui lòng khởi động backend Spring Boot và cấu hình SMTP.");
  }
}

/**
 * Bước 2 đăng ký: xác thực OTP từ email, kích hoạt tài khoản & tự đăng nhập
 */
export async function verifyRegistrationOtp(email, otp) {
  let res;
  try {
    res = await apiFetch("/api/auth/register/verify-otp", {
      method: "POST",
      body: JSON.stringify({
        email: (email || "").trim().toLowerCase(),
        otp: (otp || "").trim()
      })
    });
  } catch (err) {
    if (err.isHttpError) throw err;
    throw new Error("Không thể kết nối máy chủ xác thực OTP (/api/auth). Vui lòng thử lại.");
  }
  if (!res || !res.user) {
    throw new Error("Phản hồi xác thực tài khoản không hợp lệ.");
  }
  const sessionUser = establishAuthenticatedSession(res.user);
  getActiveCoupons(sessionUser.id);
  return { user: sessionUser, message: res.message };
}

export async function registerUser(data) {
  return requestRegistrationOtp(data);
}

export async function loginUser(email, password) {
  const normalizedEmail = (email || "").trim().toLowerCase();
  if (!normalizedEmail || !password) {
    throw new Error("Vui lòng nhập đầy đủ email và mật khẩu.");
  }

  let user;
  try {
    user = await apiFetch("/api/users/login", {
      method: "POST",
      body: JSON.stringify({ email: normalizedEmail, password })
    });
  } catch (err) {
    if (err.isHttpError) {
      throw err;
    }
    throw new Error("Không thể kết nối máy chủ đăng nhập (/api/users/login). Vui lòng kiểm tra backend đã khởi động hoặc thử lại sau.");
  }

  if (!user || typeof user !== "object" || !user.id || !user.email) {
    throw new Error("Phản hồi đăng nhập từ máy chủ không hợp lệ. Vui lòng thử lại.");
  }

  return establishAuthenticatedSession(user);
}

/**
 * Yêu cầu đặt lại mật khẩu: gửi OTP thật qua SMTP trên server, không tạo mã ở phía trình duyệt
 */
export async function requestPasswordReset(email) {
  const normalized = (email || "").trim().toLowerCase();
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("Vui lòng nhập địa chỉ email hợp lệ.");
  }

  try {
    return await apiFetch("/api/auth/password-reset/request-otp", {
      method: "POST",
      body: JSON.stringify({ email: normalized })
    });
  } catch (err) {
    if (err.isHttpError) throw err;
    throw new Error("Không thể kết nối máy chủ gửi email OTP (/api/auth). Vui lòng kiểm tra backend đang chạy.");
  }
}

/**
 * Xác thực mã OTP từ email trên server và đặt lại mật khẩu mới
 */
export async function verifyAndResetPassword(email, otp, newPassword) {
  const normalized = (email || "").trim().toLowerCase();
  const trimmedOtp = (otp || "").trim();

  if (!normalized || !trimmedOtp || !newPassword) {
    throw new Error("Vui lòng điền đầy đủ Email, mã xác thực và mật khẩu mới.");
  }
  if (!/^\d{6}$/.test(trimmedOtp)) {
    throw new Error("Mã xác thực OTP phải gồm đúng 6 chữ số.");
  }
  if (!isStrongPassword(newPassword)) {
    throw new Error("Mật khẩu mới phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và chữ số.");
  }

  try {
    return await apiFetch("/api/auth/password-reset/verify", {
      method: "POST",
      body: JSON.stringify({
        email: normalized,
        otp: trimmedOtp,
        newPassword
      })
    });
  } catch (err) {
    if (err.isHttpError) throw err;
    throw new Error("Không thể kết nối máy chủ xác thực OTP (/api/auth). Vui lòng thử lại.");
  }
}

/**
 * Đổi mật khẩu từ trang tài khoản cá nhân
 */
export async function updateUserPassword(userId, currentPassword, newPassword) {
  if (!userId || !currentPassword || !newPassword) {
    throw new Error("Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.");
  }

  if (!isStrongPassword(newPassword)) {
    throw new Error("Mật khẩu mới phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và chữ số.");
  }

  try {
    const res = await apiFetch(`/api/users/${encodeURIComponent(userId)}/change-password`, {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword })
    });
    return { success: true, message: res?.message || "Đổi mật khẩu thành công!" };
  } catch (err) {
    if (err.isHttpError) throw err;
    throw new Error("Không thể kết nối máy chủ để đổi mật khẩu. Vui lòng thử lại sau.");
  }
}

/**
 * Cập nhật ảnh đại diện người dùng
 */
export async function updateUserAvatar(userId, avatarDataUrl) {
  if (!userId) throw new Error("Chưa xác định tài khoản.");

  const users = getUsers();
  const user = users.find((u) => String(u.id) === String(userId));
  if (!user) throw new Error("Không tìm thấy người dùng.");

  user.avatar = avatarDataUrl || null;
  user.avatarUpdatedAt = new Date().toISOString();
  saveUsers(users);

  const cur = getCurrentUser();
  if (cur && String(cur.id) === String(userId)) {
    const updatedCur = { ...cur, avatar: user.avatar };
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(updatedCur));
    } catch {}
    write(SESSION_KEY, updatedCur);
  }

  return user;
}

/**
 * Phân quyền chi tiết cho tài khoản nhân viên
 */
export async function updateStaffPermissions(userId, permissions = [], adminUser = getCurrentUser()) {
  if (!adminUser || adminUser.role !== "admin") {
    throw new Error("Chỉ Quản trị viên mới có quyền cập nhật quyền hạn cho nhân viên.");
  }

  const updated = await apiFetch(`/api/users/${userId}/permissions`, {
    method: "PATCH",
    body: JSON.stringify({ permissions: Array.isArray(permissions) ? permissions : [] })
  });

  const users = getUsers();
  const target = users.find((u) => String(u.id) === String(userId));
  if (target) {
    target.permissions = Array.isArray(updated?.permissions) ? updated.permissions : (Array.isArray(permissions) ? permissions : []);
    target.permissionsUpdatedAt = updated?.permissionsUpdatedAt || new Date().toISOString();
    target.permissionsUpdatedBy = updated?.permissionsUpdatedBy || adminUser.name || adminUser.email;
    saveUsers(users);
  }

  return updated || target;
}

export function logoutUser() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem("ecodesk_checkout_coupon");
    sessionStorage.removeItem("ecodesk_auth_notice");
    sessionStorage.removeItem("ecodesk_auth_notice_type");
    sessionStorage.removeItem("ecodesk_pending_next");
    sessionStorage.removeItem("ecodesk_pending_favorite");
    localStorage.removeItem("ecodesk_cart");
  } catch {}
  localStorage.removeItem(SESSION_KEY);
}

export async function placeOrder({
  items,
  couponCode = "",
  customerInfo = {},
  shippingMethod = "Giao hàng tiêu chuẩn (Toàn quốc)",
  shippingFee = 0,
  billingAddress = ""
}) {
  const session = getCurrentUser();
  if (!session) throw new Error("Vui lòng đăng nhập để đặt hàng.");
  const account = getAccount(session.id) || session;
  const products = getProducts();
  const now = new Date();

  if (!items || !items.length) {
    throw new Error("Giỏ hàng của bạn đang trống, không thể tạo đơn hàng.");
  }
  
  // Tính toán lại giá và kiểm tra tồn kho trực tiếp từ danh mục sản phẩm và biến thể
  const lines = items.map((item) => {
    const { productId, quantity, variantId, variantName, variantSku, price, image } = item;
    const product = products.find((p) => String(p.id) === String(productId));
    if (!product) {
      throw new Error(`Sản phẩm trong giỏ không còn tồn tại trên hệ thống.`);
    }

    const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
    let variant = null;
    if (variantId && hasVariants) {
      variant = product.variants.find((v) => String(v.id) === String(variantId) || String(v.sku) === String(variantId));
    }
    if (hasVariants && !variant) {
      throw new Error(`Sản phẩm "${product.name}" yêu cầu chọn phân loại hợp lệ hoặc phân loại trong giỏ đã thay đổi. Vui lòng cập nhật lại giỏ hàng.`);
    }

    const availableStock = variant ? Math.max(0, Number(variant.stock) || 0) : Math.max(0, Number(product.stock) || 0);
    const itemLabel = variant ? `${product.name} (${variant.name})` : (variantName ? `${product.name} (${variantName})` : product.name);

    if (availableStock < quantity) {
      throw new Error(`Sản phẩm "${itemLabel}" chỉ còn ${availableStock} chiếc trong kho, không đủ đáp ứng số lượng đặt (${quantity}).`);
    }

    const basePrice = (variant && variant.price != null) ? Number(variant.price) : ((price != null && !isNaN(price)) ? Number(price) : Number(product.price));
    const pricing = getProductPrice({ ...product, price: basePrice }, now, variant);

    return {
      productId: product.id,
      variantId: variant ? variant.id : (variantId || null),
      variantSku: variant ? variant.sku : (variantSku || null),
      variantName: variant ? variant.name : (variantName || null),
      name: product.name,
      quantity: Number(quantity) || 1,
      unitPrice: pricing.price,
      originalPrice: basePrice,
      image: (variant && variant.image) || image || product.image,
      saleCode: pricing.code
    };
  });

  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  let discount = 0;
  if (couponCode) {
    try {
      const check = await apiFetch(`/api/campaigns/validate?code=${encodeURIComponent(couponCode)}&amount=${subtotal}`);
      if (check && check.valid) {
        discount = check.discount || 0;
      }
    } catch {
      // Fallback local coupon check
      const coupon = (account.coupons || []).find(c => c.code.toLowerCase() === couponCode.trim().toLowerCase());
      if (coupon) discount = Math.round(subtotal * (coupon.percent || 10) / 100);
    }
  }

  // Quy tắc EcoDesk: Miễn phí vận chuyển toàn quốc cho đơn từ 2.000.000đ
  const finalShippingFee = subtotal >= 2000000 ? 0 : Math.max(0, Number(shippingFee) || 0);

  // Trừ tồn kho chính xác cho từng biến thể và sản phẩm (chống bán vượt)
  for (const line of lines) {
    const targetProduct = products.find((p) => String(p.id) === String(line.productId));
    if (targetProduct) {
      if (line.variantId && Array.isArray(targetProduct.variants)) {
        const targetVariant = targetProduct.variants.find((v) => String(v.id) === String(line.variantId));
        if (targetVariant) {
          targetVariant.stock = Math.max(0, Number(targetVariant.stock) - line.quantity);
          targetVariant.status = targetVariant.stock === 0 ? "Tạm hết hàng" : (targetVariant.stock <= 15 ? "Sắp hết" : "Còn hàng");
        }
        targetProduct.stock = computeProductStock(targetProduct);
      } else {
        targetProduct.stock = Math.max(0, Number(targetProduct.stock) - line.quantity);
      }
      targetProduct.status = computeProductStatus(targetProduct);
    }
  }
  saveProducts(products);

  const initialHistory = [
    {
      status: "Chờ xác nhận",
      timestamp: now.toISOString(),
      note: "Đơn hàng đã được đặt thành công",
      by: customerInfo.name || session.name || "Khách hàng"
    }
  ];

  const orderPayload = {
    id: `ORD-${Date.now()}`,
    userId: session.id,
    customerName: customerInfo.name || session.name || "Khách hàng EcoDesk",
    customerPhone: customerInfo.phone || account.phone || "",
    customerEmail: customerInfo.email || session.email || "",
    shippingAddress: customerInfo.address || "Giao tận nơi",
    shippingMethod: shippingMethod || customerInfo.shippingMethod || "Giao hàng tiêu chuẩn (Toàn quốc)",
    billingAddress: billingAddress || customerInfo.billingAddress || customerInfo.address || "Giống địa chỉ giao hàng",
    note: customerInfo.note || "",
    paymentMethod: customerInfo.paymentMethod || "Chuyển khoản QR (VietQR / Napas 247)",
    couponCode: couponCode || "",
    subtotal: subtotal,
    discount: discount,
    shippingFee: finalShippingFee,
    total: Math.max(0, subtotal - discount + finalShippingFee),
    status: "Chờ xác nhận",
    stockRestored: false,
    itemsJson: JSON.stringify(lines),
    statusHistory: initialHistory,
    statusHistoryJson: JSON.stringify(initialHistory),
    createdAt: now.toISOString()
  };

  try {
    const savedOrder = await apiFetch("/api/orders", {
      method: "POST",
      body: JSON.stringify(orderPayload)
    });
    if (savedOrder) {
      if (!savedOrder.statusHistory && savedOrder.statusHistoryJson) {
        try {
          savedOrder.statusHistory = JSON.parse(savedOrder.statusHistoryJson);
        } catch (e) {}
      }
      saveOrders([savedOrder, ...getOrders()]);
      clearCart(session.id);
      return savedOrder;
    }
  } catch (err) {
    console.warn("Lưu đơn hàng vào API thất bại, lưu cục bộ:", err);
  }

  saveOrders([orderPayload, ...getOrders()]);
  clearCart(session.id);
  return orderPayload;
}

export async function fetchUserOrders(userId) {
  try {
    const orders = await apiFetch(`/api/orders/user/${userId}`);
    if (orders && Array.isArray(orders)) {
      orders.forEach(o => {
        if (!o.statusHistory && o.statusHistoryJson) {
          try {
            o.statusHistory = JSON.parse(o.statusHistoryJson);
          } catch (e) {}
        }
      });
      // Merge with existing orders in localStorage
      const local = getOrders();
      const localMap = new Map(local.map(o => [String(o.id), o]));
      orders.forEach(o => localMap.set(String(o.id), o));
      const merged = Array.from(localMap.values());
      saveOrders(merged);
      return orders;
    }
  } catch (err) {
    console.warn("Không thể tải đơn hàng từ API cho user:", userId, err);
  }
  return [];
}

export async function fetchOrderById(orderId) {
  if (!orderId) return null;
  try {
    const order = await apiFetch(`/api/orders/${encodeURIComponent(orderId)}`);
    if (order) {
      if (!order.statusHistory && order.statusHistoryJson) {
        try {
          order.statusHistory = JSON.parse(order.statusHistoryJson);
        } catch (e) {}
      }
      const local = getOrders();
      const idx = local.findIndex(o => String(o.id) === String(order.id));
      if (idx >= 0) {
        local[idx] = order;
      } else {
        local.unshift(order);
      }
      saveOrders(local);
      return order;
    }
  } catch (err) {
    console.warn("Không thể tải chi tiết đơn hàng từ API:", orderId, err);
  }
  return null;
}

export async function fetchAllOrdersFromBackend() {
  try {
    const orders = await apiFetch("/api/orders");
    if (orders && Array.isArray(orders)) {
      orders.forEach(o => {
        if (!o.statusHistory && o.statusHistoryJson) {
          try {
            o.statusHistory = JSON.parse(o.statusHistoryJson);
          } catch (e) {}
        }
      });
      saveOrders(orders);
      return orders;
    }
  } catch (err) {
    console.warn("Không thể tải danh sách đơn hàng từ API:", err);
  }
  return null;
}

export function getOrdersByUser(user) {
  if (!user) return [];
  const orders = getOrders();
  const userId = String(user.id || "");
  const userEmail = (user.email || "").toLowerCase();
  const userName = (user.name || "").toLowerCase();

  return orders.filter(o => {
    if (o.userId && String(o.userId) === userId) return true;
    if (o.customerEmail && o.customerEmail.toLowerCase() === userEmail) return true;
    if (o.customer && o.customer.toLowerCase() === userName) return true;
    if (o.customerName && o.customerName.toLowerCase() === userName) return true;
    return false;
  }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

export async function updateUserProfile(userId, profileData) {
  try {
    const updated = await apiFetch(`/api/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify({
        name: profileData.name,
        phone: profileData.phone
      })
    });
    if (updated) {
      const users = getUsers().map(u => String(u.id) === String(userId) ? { ...u, name: profileData.name, phone: profileData.phone } : u);
      saveUsers(users);

      const cur = getCurrentUser();
      if (cur && String(cur.id) === String(userId)) {
        const nextSession = { ...cur, name: profileData.name };
        try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextSession)); } catch {}
        write(SESSION_KEY, nextSession);
      }
      return updated;
    }
  } catch (err) {
    console.warn("Cập nhật thông tin user qua API thất bại, lưu cục bộ:", err);
  }

  const users = getUsers().map(u => String(u.id) === String(userId) ? { ...u, name: profileData.name, phone: profileData.phone } : u);
  saveUsers(users);
  const cur = getCurrentUser();
  if (cur && String(cur.id) === String(userId)) {
    const nextSession = { ...cur, name: profileData.name };
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextSession)); } catch {}
    write(SESSION_KEY, nextSession);
  }
  return users.find(u => String(u.id) === String(userId));
}

export function getUserAddresses(userId) {
  if (!userId) return [];
  return read(`ecodesk_addresses_${userId}`, []);
}

export function saveUserAddresses(userId, addresses) {
  if (!userId) return;
  write(`ecodesk_addresses_${userId}`, addresses);
}

export function addUserAddress(userId, addressData) {
  const addresses = getUserAddresses(userId);
  const newAddr = {
    id: `addr_${Date.now()}`,
    name: addressData.name.trim(),
    phone: addressData.phone.trim(),
    province: addressData.province || "",
    district: addressData.district || "",
    address: addressData.address.trim(),
    isDefault: addresses.length === 0 || !!addressData.isDefault
  };
  if (newAddr.isDefault) {
    addresses.forEach(a => a.isDefault = false);
  }
  addresses.push(newAddr);
  saveUserAddresses(userId, addresses);
  return newAddr;
}

export function updateUserAddress(userId, addressId, addressData) {
  let addresses = getUserAddresses(userId);
  const isDefault = !!addressData.isDefault;
  if (isDefault) {
    addresses.forEach(a => a.isDefault = false);
  }
  addresses = addresses.map(a => {
    if (a.id === addressId) {
      return {
        ...a,
        name: addressData.name.trim(),
        phone: addressData.phone.trim(),
        province: addressData.province || a.province,
        district: addressData.district || a.district,
        address: addressData.address.trim(),
        isDefault
      };
    }
    return a;
  });
  saveUserAddresses(userId, addresses);
  return addresses;
}

export function deleteUserAddress(userId, addressId) {
  let addresses = getUserAddresses(userId);
  const wasDefault = addresses.find(a => a.id === addressId)?.isDefault;
  addresses = addresses.filter(a => a.id !== addressId);
  if (wasDefault && addresses.length > 0) {
    addresses[0].isDefault = true;
  }
  saveUserAddresses(userId, addresses);
  return addresses;
}

export function setDefaultAddress(userId, addressId) {
  let addresses = getUserAddresses(userId);
  addresses = addresses.map(a => ({
    ...a,
    isDefault: a.id === addressId
  }));
  saveUserAddresses(userId, addresses);
  return addresses;
}

/* ==========================================================================
   FINANCE, PURCHASES, PAYROLL & AUDIT LOG APIS
   ========================================================================== */
export async function getFinanceSummary({ from = "", to = "" } = {}) {
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  const q = qs.toString();
  return apiFetch(`/api/finance/summary${q ? `?${q}` : ""}`);
}

export async function getFinanceTransactions(filters = {}) {
  const qs = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "" && v !== "all") {
      qs.set(k, String(v));
    }
  });
  const q = qs.toString();
  return apiFetch(`/api/finance/transactions${q ? `?${q}` : ""}`);
}

export async function getFinanceTransactionById(id) {
  return apiFetch(`/api/finance/transactions/${encodeURIComponent(id)}`);
}

export async function createFinanceTransaction(payload) {
  return apiFetch("/api/finance/transactions", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateFinanceTransaction(id, payload) {
  return apiFetch(`/api/finance/transactions/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function reconcileFinanceTransaction(id) {
  return apiFetch(`/api/finance/transactions/${encodeURIComponent(id)}/reconcile`, {
    method: "POST"
  });
}

export async function refreshProductsFromBackend() {
  try {
    const products = await apiFetch("/api/products");
    if (products && Array.isArray(products)) {
      saveProducts(products);
      return products;
    }
  } catch (err) {
    console.warn("Không thể làm mới danh sách sản phẩm từ backend:", err);
  }
  return getProducts();
}

export async function getPurchaseOrders(filters = {}) {
  const qs = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "" && v !== "all") {
      qs.set(k, String(v));
    }
  });
  const q = qs.toString();
  return apiFetch(`/api/finance/purchases${q ? `?${q}` : ""}`);
}

export async function getPurchaseOrderById(id) {
  return apiFetch(`/api/finance/purchases/${encodeURIComponent(id)}`);
}

export async function createPurchaseOrder(payload) {
  const created = await apiFetch("/api/finance/purchases", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  await refreshProductsFromBackend().catch(() => {});
  return created;
}

export async function receivePurchaseOrder(id) {
  const res = await apiFetch(`/api/finance/purchases/${encodeURIComponent(id)}/receive`, {
    method: "POST"
  });
  await refreshProductsFromBackend().catch(() => {});
  return res;
}

export async function payPurchaseOrder(id, payload) {
  return apiFetch(`/api/finance/purchases/${encodeURIComponent(id)}/pay`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function cancelPurchaseOrder(id, reason = "") {
  const res = await apiFetch(`/api/finance/purchases/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason })
  });
  await refreshProductsFromBackend().catch(() => {});
  return res;
}

export async function getInventoryMovements(filters = {}) {
  const qs = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "" && v !== "all") {
      qs.set(k, String(v));
    }
  });
  const q = qs.toString();
  return apiFetch(`/api/finance/inventory/movements${q ? `?${q}` : ""}`);
}

export async function adjustInventoryStock(payload) {
  const res = await apiFetch("/api/finance/inventory/adjust", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  await refreshProductsFromBackend().catch(() => {});
  return res;
}

export async function getPayrollRecords() {
  return apiFetch("/api/finance/payrolls");
}

export async function createPayrollRecord(payload) {
  return apiFetch("/api/finance/payrolls", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updatePayrollRecord(id, payload) {
  return apiFetch(`/api/finance/payrolls/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function payPayrollRecord(id, paymentMethod = "Chuyển khoản ngân hàng") {
  return apiFetch(`/api/finance/payrolls/${encodeURIComponent(id)}/pay`, {
    method: "POST",
    body: JSON.stringify({ paymentMethod })
  });
}

export async function getFinanceAuditLogs() {
  return apiFetch("/api/finance/audit-logs");
}

