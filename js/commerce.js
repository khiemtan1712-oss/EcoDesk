/**
 * Tính ngày kết thúc của nhãn "Sản phẩm mới" theo lịch dương chính xác (GMT+7)
 * Xử lý chính xác ngày cuối tháng (28/29 tháng 2, 30/31 ngày).
 */
export function calculateNewBadgeEndDate(startDateStr, months = 2) {
  if (!startDateStr) return "";
  const parts = String(startDateStr).slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return "";
  const [y, m, d] = parts;
  const mNum = Math.max(1, parseInt(months, 10) || 2);

  const targetYear = y + Math.floor((m - 1 + mNum) / 12);
  const targetMonth = (m - 1 + mNum) % 12; // 0-based
  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const targetDay = Math.min(d, daysInTargetMonth);

  const mm = String(targetMonth + 1).padStart(2, "0");
  const dd = String(targetDay).padStart(2, "0");
  return `${targetYear}-${mm}-${dd}`;
}

/**
 * Lấy ngày hôm nay định dạng YYYY-MM-DD theo múi giờ Việt Nam (GMT+7)
 */
export function getVietnamTodayString(date = new Date()) {
  const d = new Date(date.getTime() + (date.getTimezoneOffset() + 420) * 60000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Lấy ngày giờ hiện tại định dạng YYYY-MM-DDTHH:mm theo múi giờ Việt Nam (GMT+7)
 */
export function getVietnamNowDateTimeString(date = new Date()) {
  const d = new Date(date.getTime() + (date.getTimezoneOffset() + 420) * 60000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

/**
 * Kiểm tra và lấy trạng thái chi tiết của nhãn "Sản phẩm mới"
 * Trạng thái: "disabled" (Đã tắt), "upcoming" (Chưa bắt đầu), "active" (Đang áp dụng), "expired" (Đã kết thúc)
 */
export function getNewBadgeStatus(product, now = new Date()) {
  if (!product || !product.newBadge || !product.newBadge.enabled) {
    return {
      status: "disabled",
      label: "Đã tắt",
      active: false,
      badge: product?.newBadge || null,
      startDate: "",
      endDate: "",
      expiresAtText: "Chưa cấu hình"
    };
  }

  const nb = product.newBadge;
  const startDate = nb.startDate || "";
  let endDate = nb.endDate || "";

  if (nb.mode === "months" || !endDate) {
    endDate = calculateNewBadgeEndDate(startDate, Number(nb.months) || 2);
  }

  if (!startDate || !endDate) {
    return {
      status: "disabled",
      label: "Đã tắt",
      active: false,
      badge: nb,
      startDate,
      endDate,
      expiresAtText: "Thiếu ngày áp dụng"
    };
  }

  // So sánh mốc thời gian theo múi giờ Việt Nam (+07:00)
  const startTime = new Date(`${startDate}T00:00:00+07:00`).getTime();
  const endTime = new Date(`${endDate}T23:59:59+07:00`).getTime();
  const nowTime = now.getTime();

  if (nowTime < startTime) {
    return {
      status: "upcoming",
      label: "Chưa bắt đầu",
      active: false,
      badge: nb,
      startDate,
      endDate,
      expiresAtText: `Bắt đầu từ ${startDate}`
    };
  }

  if (nowTime > endTime) {
    return {
      status: "expired",
      label: "Đã kết thúc",
      active: false,
      badge: nb,
      startDate,
      endDate,
      expiresAtText: `Đã hết hạn ngày ${endDate}`
    };
  }

  return {
    status: "active",
    label: "Đang áp dụng",
    active: true,
    badge: nb,
    startDate,
    endDate,
    expiresAtText: `Hết hạn ngày ${endDate}`
  };
}

/**
 * Kiểm tra xem sản phẩm có đang hiển thị nhãn "Mới" hay không
 */
export function isNewProduct(product, now = new Date()) {
  return getNewBadgeStatus(product, now).active;
}

/**
 * Kiểm tra và lấy trạng thái chi tiết của chương trình khuyến mãi / giảm giá theo sản phẩm
 * Trạng thái: "disabled" (Đã tắt), "upcoming" (Chưa bắt đầu), "active" (Đang áp dụng), "expired" (Đã kết thúc)
 */
export function getDiscountPromotionStatus(product, now = new Date()) {
  if (!product || !product.discount || !product.discount.enabled) {
    return {
      status: "disabled",
      label: "Đã tắt",
      active: false,
      discount: product?.discount || null,
      type: "percentage",
      value: 0,
      startAt: "",
      endAt: "",
      periodText: "Chưa bật khuyến mãi"
    };
  }

  const dc = product.discount;
  const startAt = dc.startAt || "";
  const endAt = dc.endAt || "";
  const type = dc.type === "fixed" ? "fixed" : "percentage";
  const value = Number(dc.value) || 0;

  if (!startAt || !endAt || value <= 0) {
    return {
      status: "disabled",
      label: "Đã tắt",
      active: false,
      discount: dc,
      type,
      value,
      startAt,
      endAt,
      periodText: "Chưa đủ thông tin cấu hình"
    };
  }

  const startTime = new Date(startAt).getTime();
  const endTime = new Date(endAt).getTime();
  const nowTime = now.getTime();

  if (nowTime < startTime) {
    return {
      status: "upcoming",
      label: "Chưa bắt đầu",
      active: false,
      discount: dc,
      type,
      value,
      startAt,
      endAt,
      periodText: `Bắt đầu từ ${startAt.replace("T", " ")}`
    };
  }

  if (nowTime > endTime) {
    return {
      status: "expired",
      label: "Đã kết thúc",
      active: false,
      discount: dc,
      type,
      value,
      startAt,
      endAt,
      periodText: `Đã kết thúc lúc ${endAt.replace("T", " ")}`
    };
  }

  return {
    status: "active",
    label: "Đang áp dụng",
    active: true,
    discount: dc,
    type,
    value,
    startAt,
    endAt,
    periodText: `Đến ${endAt.replace("T", " ")}`
  };
}

/**
 * Tính toán giá sau giảm và mức tiết kiệm cho một mức giá cơ sở
 */
export function calculateDiscountPricing(basePrice, discountConfig) {
  const price = Math.max(0, Number(basePrice) || 0);
  if (!discountConfig || !discountConfig.enabled || price <= 0) {
    return {
      original: price,
      price: price,
      savings: 0,
      percent: 0,
      label: "",
      badgeText: "",
      isValid: true
    };
  }

  const type = discountConfig.type === "fixed" ? "fixed" : "percentage";
  const val = Number(discountConfig.value) || 0;

  let savings = 0;
  let percent = 0;
  let discountedPrice = price;

  if (type === "fixed") {
    savings = Math.max(0, Math.min(price, val));
    discountedPrice = Math.max(0, price - savings);
    percent = price > 0 ? Math.round((savings / price) * 100) : 0;
  } else {
    percent = Math.max(0, Math.min(100, val));
    savings = Math.round(price * (percent / 100));
    discountedPrice = Math.max(0, price - savings);
  }

  const isValid = discountedPrice > 0 && savings > 0 && savings < price;

  return {
    original: price,
    price: discountedPrice,
    savings,
    percent,
    label: type === "percentage" ? `-${percent}%` : "Đang giảm giá",
    badgeText: type === "percentage" ? `-${percent}%` : "Đang giảm giá",
    isValid
  };
}

export function isBannerActive(banner, now = new Date()) {
  if (!banner.active) return false;
  const start = new Date(banner.startAt || 0);
  const end = new Date(banner.endAt || "2999-12-31T23:59");
  if (now < start || now > end) return false;
  if (banner.frequency === "daily") return true;
  if (banner.frequency === "weekly") return now.getDay() === start.getDay();
  if (banner.frequency === "monthly") return now.getDate() === start.getDate();
  return true;
}

export { getProductPrice as getPricing } from "./storage.js";
