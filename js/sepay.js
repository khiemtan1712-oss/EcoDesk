let cachedConfig = null;
let lastConfigFetchMs = 0;

export function isQrPaymentMethod(paymentMethod) {
  if (!paymentMethod) return false;
  const normalized = String(paymentMethod)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  return normalized.includes("QR") || normalized.includes("CHUYEN KHOAN") || normalized.includes("BANK");
}

export async function fetchSepayPublicConfig(force = false) {
  const now = Date.now();
  if (!force && cachedConfig && now - lastConfigFetchMs < 15000) {
    return cachedConfig;
  }
  try {
    const res = await fetch("/api/payments/sepay/config", { cache: "no-store" });
    if (!res.ok) return cachedConfig || null;
    const data = await res.json();
    cachedConfig = data;
    lastConfigFetchMs = now;
    return data;
  } catch {
    return cachedConfig || null;
  }
}

export async function triggerSepayBackendSync() {
  try {
    const res = await fetch("/api/payments/sepay/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    const data = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      httpStatus: res.status,
      ...data
    };
  } catch (err) {
    return {
      ok: false,
      status: "ERROR",
      message: err?.message || "Không thể kết nối backend để đồng bộ SePay."
    };
  }
}

export function buildSepayQrImageUrl({
  accountNumber,
  bankCode,
  amount,
  paymentReference,
  template = "compact"
}) {
  const cleanAcc = String(accountNumber || "").trim();
  const cleanBank = String(bankCode || "").trim();
  const cleanRef = String(paymentReference || "").trim();
  const intAmount = Math.max(0, Math.round(Number(amount || 0)));

  if (!cleanAcc || !cleanBank || !cleanRef || intAmount <= 0) {
    return "";
  }

  const params = new URLSearchParams({
    acc: cleanAcc,
    bank: cleanBank,
    amount: String(intAmount),
    des: cleanRef,
    template
  });
  return `https://qr.sepay.vn/img?${params.toString()}`;
}

export function getOrderPaymentStatusInfo(order) {
  const method = String(order?.paymentMethod || "").trim();
  const rawPaymentStatus = String(order?.paymentStatus || "").trim().toUpperCase();
  const orderStatus = String(order?.status || "").trim().toLowerCase();

  if (!isQrPaymentMethod(method)) {
    if (rawPaymentStatus === "PAID") {
      return {
        code: "PAID",
        label: "Đã thanh toán",
        shortLabel: "Đã TT · COD",
        badgeClass: "paid",
        isPaid: true,
        isQr: false
      };
    }
    if (!rawPaymentStatus && orderStatus === "hoàn thành") {
      return {
        code: "COD_COMPLETED",
        label: "Đã thanh toán (COD)",
        shortLabel: "Đã TT · COD",
        badgeClass: "paid",
        isPaid: true,
        isQr: false
      };
    }
    return {
      code: "COD",
      label: "Thu tiền khi nhận (COD)",
      shortLabel: "Thu tiền khi nhận (COD)",
      badgeClass: "cod",
      isPaid: false,
      isQr: false
    };
  }

  if (rawPaymentStatus === "PAID") {
    return {
      code: "PAID",
      label: "Đã thanh toán",
      shortLabel: "Đã TT · QR",
      badgeClass: "paid",
      isPaid: true,
      isQr: true
    };
  }

  if (rawPaymentStatus === "NEEDS_REVIEW") {
    return {
      code: "NEEDS_REVIEW",
      label: "Cần đối soát giao dịch",
      shortLabel: "Cần đối soát",
      badgeClass: "review",
      isPaid: false,
      isQr: true
    };
  }

  // Legacy pre-SePay completed QR orders stay untouched without claiming live SePay verification.
  if (!rawPaymentStatus && !order?.paymentReference && orderStatus === "hoàn thành") {
    return {
      code: "LEGACY_COMPLETED",
      label: "Đã hoàn tất (đơn cũ)",
      shortLabel: "Đơn cũ · Hoàn tất",
      badgeClass: "paid",
      isPaid: true,
      isQr: true
    };
  }

  return {
    code: "UNPAID",
    label: "Chờ thanh toán",
    shortLabel: "Chờ TT · QR",
    badgeClass: "unpaid",
    isPaid: false,
    isQr: true
  };
}

