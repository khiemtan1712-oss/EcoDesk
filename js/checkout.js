import {
  initStore,
  getCart,
  getProducts,
  getCurrentUser,
  getAccount,
  getUserAddresses,
  getActiveCoupons,
  placeOrder,
  getProductPrice,
  fetchOrderById
} from "./storage.js";
import { formatPrice, showToast, redirectToLogin, PROVINCES } from "./utils.js";
import { renderIcon, initIcons } from "./icons.js";
import { initCustomerChatWidget } from "./chat.js";
import "./assistant.js";
import {
  fetchSepayPublicConfig,
  triggerSepayBackendSync,
  buildSepayQrImageUrl,
  getOrderPaymentStatusInfo,
  isQrPaymentMethod
} from "./sepay.js";

export { PROVINCES };

// State
let cart = [];
let products = [];
let calculatedItems = [];
let appliedCoupon = "";
let selectedShipping = "standard"; // 'standard' | 'express_install'
let selectedPayment = "qr_transfer"; // 'qr_transfer' | 'cod'
let selectedBilling = "same"; // 'same' | 'different'
let isSubmitting = false;
let sepayConfig = null;
let paymentPollTimer = null;
let activeSuccessOrder = null;

const escapeHtml = (val = "") =>
  String(val).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

// Calculate subtotal, discount, shipping fee, and grand total
function calculateOrderTotals() {
  const now = new Date();
  calculatedItems = cart.map((item) => {
    const product = products.find((p) => String(p.id) === String(item.productId));
    if (!product) return null;

    let variant = null;
    if (item.variantId && Array.isArray(product.variants)) {
      variant = product.variants.find((v) => String(v.id) === String(item.variantId) || String(v.sku) === String(item.variantId));
    }
    const basePrice = (variant && variant.price != null && !isNaN(variant.price))
      ? Number(variant.price)
      : (product && product.price != null && !isNaN(product.price)
        ? Number(product.price)
        : (item.originalPrice != null ? Number(item.originalPrice) : Number(item.basePrice || item.price || 0)));
    const pricing = getProductPrice({ ...product, price: basePrice }, now, variant);

    return {
      product,
      variant,
      variantName: item.variantName || (variant && variant.name) || null,
      image: item.image || (variant && variant.image) || product.image,
      quantity: item.quantity,
      unitPrice: pricing.price,
      originalPrice: basePrice,
      lineTotal: pricing.price * item.quantity,
      saleCode: pricing.code,
      percent: pricing.percent
    };
  }).filter(Boolean);

  const subtotal = calculatedItems.reduce((sum, item) => sum + item.lineTotal, 0);

  // Validate coupon
  let discount = 0;
  let couponObj = null;
  if (appliedCoupon) {
    const available = getActiveCoupons();
    couponObj = available.find((c) => c.code.toLowerCase() === appliedCoupon.trim().toLowerCase());
    if (couponObj) {
      if (couponObj.campaignId && !calculatedItems.some((item) => item.product.id === couponObj.productId)) {
        couponObj = null; // Not applicable to cart items
      } else {
        discount = Math.round(subtotal * (couponObj.percent || 10) / 100);
      }
    }
  }

  // Shipping rules
  // Free standard shipping for orders >= 2.000.000đ
  let shippingFee = 0;
  if (selectedShipping === "standard") {
    shippingFee = subtotal >= 2000000 ? 0 : 30000;
  } else if (selectedShipping === "express_install") {
    // Free express install for orders >= 5.000.000đ, otherwise 80.000đ
    shippingFee = subtotal >= 5000000 ? 0 : 80000;
  }

  const grandTotal = Math.max(0, subtotal - discount + shippingFee);

  return {
    subtotal,
    discount,
    couponObj,
    shippingFee,
    grandTotal
  };
}

// Render Order Summary in both desktop sidebar & mobile drawer
function renderOrderSummary() {
  const totals = calculateOrderTotals();
  const totalCount = calculatedItems.reduce((sum, i) => sum + i.quantity, 0);

  // Update Item Counts
  const badge = document.getElementById("summaryItemsBadge");
  const mobileCount = document.getElementById("mobileItemCount");
  if (badge) badge.textContent = `${totalCount} sản phẩm`;
  if (mobileCount) mobileCount.textContent = `${totalCount} món`;

  // Render items markup
  const itemsHtml = calculatedItems.map((item) => `
    <div class="checkout-item-row">
      <div class="item-thumb-wrap">
        <img class="item-thumb-img" src="${item.image}" alt="${escapeHtml(item.product.name)}">
        <span class="item-qty-badge">${item.quantity}</span>
      </div>
      <div class="item-details">
        <div class="item-name">${escapeHtml(item.product.name)}</div>
        ${item.variantName ? `<div class="checkout-variant-tag" style="font-size: 11.5px; color: #15803d; font-weight: 600;">Phân loại: ${escapeHtml(item.variantName)}</div>` : ""}
        <div class="item-subtext">
          ${item.percent ? `<span style="color: #15803d; font-weight: 600;">Sale ${item.percent}%</span> · <del style="color:#94a3b8; font-size: 11.5px; margin-right: 4px;">${formatPrice(item.originalPrice)}</del>` : ""}
          ${formatPrice(item.unitPrice)}
        </div>
      </div>
      <div class="item-line-total">${formatPrice(item.lineTotal)}</div>
    </div>
  `).join("");

  const desktopList = document.getElementById("checkoutItemsList");
  const mobileList = document.getElementById("mobileSummaryItems");
  if (desktopList) desktopList.innerHTML = itemsHtml;
  if (mobileList) mobileList.innerHTML = itemsHtml;

  // Breakdown values
  const subtotalEl = document.getElementById("summarySubtotal");
  const discountRow = document.getElementById("summaryDiscountRow");
  const discountEl = document.getElementById("summaryDiscount");
  const couponTag = document.getElementById("summaryCouponTag");
  const shippingFeeEl = document.getElementById("summaryShippingFee");
  const grandTotalEl = document.getElementById("summaryGrandTotal");
  const mobileTotalEl = document.getElementById("mobileSummaryTotal");

  if (subtotalEl) subtotalEl.textContent = formatPrice(totals.subtotal);

  if (discountRow) {
    if (totals.discount > 0 && totals.couponObj) {
      discountRow.style.display = "flex";
      discountEl.textContent = `-${formatPrice(totals.discount)}`;
      couponTag.innerHTML = `${escapeHtml(totals.couponObj.code)} (${totals.couponObj.percent}%) <button type="button" id="removeCouponBtn" style="background: none; border: none; color: #15803d; cursor: pointer; padding: 0 0 0 4px; display: inline-flex; align-items: center;" aria-label="Gỡ mã">${renderIcon("x", { size: 12, strokeWidth: 2 })}</button>`;
      
      const removeBtn = document.getElementById("removeCouponBtn");
      if (removeBtn) {
        removeBtn.onclick = () => {
          appliedCoupon = "";
          sessionStorage.removeItem("ecodesk_checkout_coupon");
          const input = document.getElementById("checkoutCouponInput");
          if (input) input.value = "";
          showCouponFeedback("", "");
          renderOrderSummary();
          showToast("Đã gỡ mã ưu đãi.");
        };
      }
    } else {
      discountRow.style.display = "none";
    }
  }

  if (shippingFeeEl) {
    shippingFeeEl.textContent = totals.shippingFee === 0 ? "Miễn phí" : formatPrice(totals.shippingFee);
    shippingFeeEl.style.color = totals.shippingFee === 0 ? "#15803d" : "inherit";
  }

  if (grandTotalEl) grandTotalEl.textContent = formatPrice(totals.grandTotal);
  if (mobileTotalEl) mobileTotalEl.textContent = formatPrice(totals.grandTotal);

  // Update prices on Shipping method radio cards
  const standardPriceTag = document.getElementById("priceShippingStandard");
  const expressPriceTag = document.getElementById("priceShippingExpress");
  if (standardPriceTag) {
    standardPriceTag.textContent = totals.subtotal >= 2000000 ? "Miễn phí" : "30.000 ₫";
  }
  if (expressPriceTag) {
    expressPriceTag.textContent = totals.subtotal >= 5000000 ? "Miễn phí" : "80.000 ₫";
  }

  // Update Free Shipping Progress Bar / Text
  const progressText = document.getElementById("shippingPolicyProgress");
  if (progressText) {
    if (totals.subtotal >= 2000000) {
      progressText.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px;">${renderIcon("check", { size: 14, strokeWidth: 2 })} <strong>Bạn đã đạt điều kiện Miễn phí vận chuyển toàn quốc!</strong></span>`;
      progressText.style.color = "#15803d";
    } else {
      const needed = 2000000 - totals.subtotal;
      progressText.innerHTML = `Mua thêm <strong>${formatPrice(needed)}</strong> để được <strong>Miễn phí vận chuyển toàn quốc</strong>.`;
      progressText.style.color = "#374151";
    }
  }

  // Clone breakdown to mobile drawer if open
  const mobileBreakdown = document.getElementById("mobileSummaryBreakdown");
  const desktopBreakdown = document.getElementById("summaryBreakdown");
  if (mobileBreakdown && desktopBreakdown) {
    mobileBreakdown.innerHTML = desktopBreakdown.innerHTML;
  }
}

function showCouponFeedback(msg, type = "error") {
  const box = document.getElementById("couponFeedback");
  if (!box) return;
  if (!msg) {
    box.style.display = "none";
    box.textContent = "";
    return;
  }
  box.style.display = "block";
  box.className = `coupon-feedback ${type}`;
  box.textContent = msg;
}

// Populate available quick coupons
function renderAvailableCoupons() {
  const coupons = getActiveCoupons();
  const container = document.getElementById("availableCouponsContainer");
  const list = document.getElementById("availableCouponChips");
  if (!container || !list) return;

  if (!coupons || coupons.length === 0) {
    container.style.display = "none";
    return;
  }

  container.style.display = "block";
  list.innerHTML = coupons.map((c) => `
    <button type="button" class="coupon-chip-btn" data-apply-coupon="${escapeHtml(c.code)}">
      ${escapeHtml(c.code)} · ${c.percent}%
    </button>
  `).join("");

  list.querySelectorAll("[data-apply-coupon]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const code = btn.dataset.applyCoupon;
      const input = document.getElementById("checkoutCouponInput");
      if (input) input.value = code;
      appliedCoupon = code;
      sessionStorage.setItem("ecodesk_checkout_coupon", code);
      showCouponFeedback(`Áp dụng mã ${code} thành công!`, "success");
      renderOrderSummary();
    });
  });
}

// Setup form listeners and interactions
function setupFormEvents() {
  // Mobile summary accordion toggle
  const mobileToggle = document.getElementById("mobileSummaryToggle");
  const mobileDrawer = document.getElementById("mobileSummaryDrawer");
  if (mobileToggle && mobileDrawer) {
    mobileToggle.addEventListener("click", () => {
      const isExpanded = mobileToggle.getAttribute("aria-expanded") === "true";
      mobileToggle.setAttribute("aria-expanded", String(!isExpanded));
      mobileDrawer.hidden = isExpanded;
    });
  }

  // Coupon apply button
  const applyBtn = document.getElementById("applyCouponBtn");
  const couponInput = document.getElementById("checkoutCouponInput");
  if (applyBtn && couponInput) {
    applyBtn.addEventListener("click", () => {
      const code = couponInput.value.trim();
      if (!code) {
        showCouponFeedback("Vui lòng nhập mã ưu đãi.");
        return;
      }

      const available = getActiveCoupons();
      const valid = available.find((item) => item.code.toLowerCase() === code.toLowerCase());
      if (!valid) {
        showCouponFeedback("Mã ưu đãi không hợp lệ hoặc đã hết hạn.", "error");
        appliedCoupon = "";
        renderOrderSummary();
        return;
      }

      if (valid.campaignId && !calculatedItems.some((item) => item.product.id === valid.productId)) {
        showCouponFeedback("Mã ưu đãi này chỉ áp dụng cho sản phẩm nhất định trong danh mục.", "error");
        appliedCoupon = "";
        renderOrderSummary();
        return;
      }

      appliedCoupon = valid.code;
      sessionStorage.setItem("ecodesk_checkout_coupon", valid.code);
      showCouponFeedback(`Áp dụng thành công: ${valid.label} (-${valid.percent}%).`, "success");
      renderOrderSummary();
    });

    couponInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        applyBtn.click();
      }
    });
  }

  // Shipping Method Selection
  document.querySelectorAll('input[name="shippingMethodRadio"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      selectedShipping = e.target.value;
      document.querySelectorAll(".option-card").forEach((card) => {
        if (card.querySelector('input[name="shippingMethodRadio"]')) {
          card.classList.remove("selected");
        }
      });
      const parentCard = e.target.closest(".option-card");
      if (parentCard) parentCard.classList.add("selected");
      renderOrderSummary();
    });
  });

  // Payment Method Selection
  document.querySelectorAll('input[name="paymentMethodRadio"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      selectedPayment = e.target.value;
      document.querySelectorAll(".option-card").forEach((card) => {
        if (card.querySelector('input[name="paymentMethodRadio"]')) {
          card.classList.remove("selected");
        }
      });
      const parentCard = e.target.closest(".option-card");
      if (parentCard) parentCard.classList.add("selected");

      // Show QR nested details only when QR is selected
      const qrDetails = document.getElementById("qrNestedInfo");
      if (qrDetails) {
        qrDetails.style.display = selectedPayment === "qr_transfer" ? "block" : "none";
      }
    });
  });

  // Billing Address radio toggle
  document.querySelectorAll('input[name="billingAddressRadio"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      selectedBilling = e.target.value;
      const diffFields = document.getElementById("billingDifferentFields");
      if (diffFields) {
        diffFields.style.display = selectedBilling === "different" ? "grid" : "none";
      }
    });
  });

  // Clear validation error on field input
  document.querySelectorAll("#checkoutForm input, #checkoutForm select, #checkoutForm textarea").forEach((field) => {
    field.addEventListener("input", () => {
      field.classList.remove("has-error");
      const err = document.getElementById(`error-${field.id}`);
      if (err) err.textContent = "";
      const globalErr = document.getElementById("checkoutFormGlobalError");
      if (globalErr) globalErr.style.display = "none";
    });
  });

  // Form Submission
  const form = document.getElementById("checkoutForm");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await handleOrderSubmit();
    });
  }
}

// Field validation helper
function validateCheckoutForm() {
  let isValid = true;
  let firstErrorField = null;

  const checkField = (id, condition, message) => {
    const el = document.getElementById(id);
    const err = document.getElementById(`error-${id}`);
    if (!el) return;

    if (!condition(el.value.trim())) {
      isValid = false;
      el.classList.add("has-error");
      if (err) err.textContent = message;
      if (!firstErrorField) firstErrorField = el;
    } else {
      el.classList.remove("has-error");
      if (err) err.textContent = "";
    }
  };

  // 1. Email validation
  checkField(
    "contactEmail",
    (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
    "Vui lòng nhập địa chỉ email hợp lệ (ví dụ: ten@gmail.com)."
  );

  // 2. Phone validation (Vietnamese 10 digits starting with 0)
  checkField(
    "contactPhone",
    (val) => /^(0[3|5|7|8|9])[0-9]{8}$/.test(val) || /^0[0-9]{9}$/.test(val),
    "Vui lòng nhập số điện thoại hợp lệ gồm 10 chữ số (bắt đầu bằng 0)."
  );

  // 3. Full name
  checkField(
    "shippingFullName",
    (val) => val.length >= 2,
    "Họ và tên người nhận không được để trống (tối thiểu 2 ký tự)."
  );

  // 4. Province / City
  checkField(
    "shippingProvince",
    (val) => val !== "",
    "Vui lòng chọn Tỉnh / Thành phố nhận hàng."
  );

  // 5. District
  checkField(
    "shippingDistrict",
    (val) => val.length >= 2,
    "Vui lòng nhập Quận / Huyện nhận hàng."
  );

  // 6. Ward
  checkField(
    "shippingWard",
    (val) => val.length >= 2,
    "Vui lòng nhập Phường / Xã nhận hàng."
  );

  // 7. Specific Address
  checkField(
    "shippingSpecificAddress",
    (val) => val.length >= 5,
    "Vui lòng nhập địa chỉ cụ thể (số nhà, tên đường, tòa nhà...)."
  );

  if (firstErrorField) {
    firstErrorField.focus();
    firstErrorField.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return isValid;
}

// Order Submission Handler
async function handleOrderSubmit() {
  if (isSubmitting) return;

  const globalErr = document.getElementById("checkoutFormGlobalError");
  if (globalErr) globalErr.style.display = "none";

  // Validate form fields
  if (!validateCheckoutForm()) {
    return;
  }

  // Ensure cart is not empty
  if (!cart || cart.length === 0) {
    showToast("Giỏ hàng của bạn đang trống.");
    return;
  }

  const submitBtn = document.getElementById("submitOrderBtn");
  const btnText = submitBtn?.querySelector(".btn-text");
  const btnSpinner = submitBtn?.querySelector(".btn-spinner");

  try {
    isSubmitting = true;
    if (submitBtn) submitBtn.disabled = true;
    if (btnText) btnText.textContent = "Đang xử lý tạo đơn hàng...";
    if (btnSpinner) btnSpinner.style.display = "inline-block";

    // Collect Data
    const contactEmail = document.getElementById("contactEmail").value.trim();
    const contactPhone = document.getElementById("contactPhone").value.trim();
    const fullName = document.getElementById("shippingFullName").value.trim();
    const province = document.getElementById("shippingProvince").value;
    const district = document.getElementById("shippingDistrict").value.trim();
    const ward = document.getElementById("shippingWard").value.trim();
    const specificAddress = document.getElementById("shippingSpecificAddress").value.trim();
    const note = document.getElementById("shippingNote")?.value.trim() || "";

    const fullShippingAddress = `${specificAddress}, ${ward}, ${district}, ${province}`;

    let fullBillingAddress = fullShippingAddress;
    if (selectedBilling === "different") {
      const bName = document.getElementById("billingName")?.value.trim() || fullName;
      const bTax = document.getElementById("billingTaxCode")?.value.trim() || "";
      const bAddr = document.getElementById("billingAddressText")?.value.trim() || "";
      fullBillingAddress = `${bName} - ${bAddr} ${bTax ? `(MST: ${bTax})` : ""}`;
    }

    const shippingMethodLabel = selectedShipping === "express_install"
      ? "Giao hỏa tốc & Hỗ trợ lắp đặt (Nội thành TP.HCM)"
      : "Giao hàng tiêu chuẩn (Toàn quốc)";

    const paymentMethodLabel = selectedPayment === "cod"
      ? "Thanh toán khi nhận hàng (COD)"
      : "Chuyển khoản QR (VietQR / Napas 247)";

    const totals = calculateOrderTotals();

    // Call placeOrder
    const order = await placeOrder({
      items: cart,
      couponCode: appliedCoupon,
      customerInfo: {
        name: fullName,
        phone: contactPhone,
        email: contactEmail,
        address: fullShippingAddress,
        billingAddress: fullBillingAddress,
        note: note,
        paymentMethod: paymentMethodLabel,
        shippingMethod: shippingMethodLabel
      },
      shippingMethod: shippingMethodLabel,
      shippingFee: totals.shippingFee,
      billingAddress: fullBillingAddress
    });

    // Success: clear session coupon & render confirmation view
    sessionStorage.removeItem("ecodesk_checkout_coupon");
    renderOrderSuccessView(order, totals);
    const payInfo = getOrderPaymentStatusInfo(order);
    if (payInfo.isQr && !payInfo.isPaid) {
      showToast(`Đã ghi nhận đơn hàng #${order.id} — Vui lòng quét mã QR để chuyển khoản.`);
    } else {
      showToast(`Đặt hàng thành công! Mã đơn: #${order.id}`);
    }
  } catch (err) {
    console.error("Lỗi tạo đơn hàng:", err);
    if (globalErr) {
      globalErr.style.display = "block";
      globalErr.textContent = `Không thể tạo đơn hàng: ${err.message || "Đã xảy ra sự cố kết nối."}`;
    }
    showToast(err.message || "Đặt hàng thất bại. Vui lòng thử lại.");
  } finally {
    isSubmitting = false;
    if (submitBtn) submitBtn.disabled = false;
    if (btnText) btnText.textContent = "Xác nhận đặt hàng";
    if (btnSpinner) btnSpinner.style.display = "none";
  }
}

// Render Order Success State
function renderOrderSuccessView(order, totals) {
  const layout = document.getElementById("checkoutLayout");
  const mobileBar = document.querySelector(".mobile-summary-bar");
  const successView = document.getElementById("checkoutSuccessView");

  if (layout) layout.style.display = "none";
  if (mobileBar) mobileBar.style.display = "none";
  if (successView) successView.style.display = "block";

  window.scrollTo({ top: 0, behavior: "smooth" });

  // Fill in order fields
  const idEl = document.getElementById("successOrderId");
  const timeEl = document.getElementById("successOrderTime");
  const totalEl = document.getElementById("successOrderTotal");
  const nameEl = document.getElementById("successCustomerName");
  const phoneEl = document.getElementById("successCustomerPhone");
  const emailEl = document.getElementById("successCustomerEmail");
  const addrEl = document.getElementById("successShippingAddress");
  const shipMethodEl = document.getElementById("successShippingMethod");
  const payMethodEl = document.getElementById("successPaymentMethod");
  const noteRow = document.getElementById("successNoteRow");
  const noteText = document.getElementById("successNoteText");

  if (idEl) idEl.textContent = order.id;
  if (timeEl) timeEl.textContent = new Date(order.createdAt).toLocaleString("vi-VN");
  if (totalEl) totalEl.textContent = formatPrice(order.total);
  if (nameEl) nameEl.textContent = order.customerName || "—";
  if (phoneEl) phoneEl.textContent = order.customerPhone || "—";
  if (emailEl) emailEl.textContent = order.customerEmail || "—";
  if (addrEl) addrEl.textContent = order.shippingAddress || "—";
  if (shipMethodEl) shipMethodEl.textContent = order.shippingMethod || "Giao hàng tiêu chuẩn";
  if (payMethodEl) payMethodEl.textContent = order.paymentMethod || "Chuyển khoản QR";

  if (noteRow && noteText) {
    if (order.note) {
      noteRow.style.display = "block";
      noteText.textContent = order.note;
    } else {
      noteRow.style.display = "none";
    }
  }

  // QR Transfer Box (if QR method was selected)
  const qrCard = document.getElementById("successQrCard");
  const qrContentGrid = document.getElementById("successQrContentGrid");
  const qrConfigWarning = document.getElementById("successQrConfigWarning");
  const qrImg = document.getElementById("successQrImage");
  const qrBankName = document.getElementById("successQrBankName");
  const qrAccNum = document.getElementById("successQrAccountNumber");
  const qrAccName = document.getElementById("successQrAccountName");
  const qrAmount = document.getElementById("successQrAmount");
  const qrMemo = document.getElementById("successQrMemo");
  const copyMemoBtn = document.getElementById("copyQrMemoBtn");
  const checkPaymentBtn = document.getElementById("checkPaymentStatusBtn");

  activeSuccessOrder = order;
  updateSuccessPaymentDisplay(order);

  if (isQrPaymentMethod(order.paymentMethod)) {
    if (qrCard) qrCard.style.display = "block";
    if (qrAmount) qrAmount.textContent = formatPrice(order.total);

    const paymentRef = order.paymentReference || "";
    if (qrMemo) qrMemo.textContent = paymentRef || "Chưa có mã tham chiếu (kiểm tra kết nối backend)";
    if (copyMemoBtn) {
      copyMemoBtn.onclick = () => {
        if (!paymentRef) return;
        navigator.clipboard.writeText(paymentRef);
        showToast(`Đã sao chép nội dung chuyển khoản: ${paymentRef}`);
      };
    }

    const cfg = sepayConfig || {};
    if (qrBankName) qrBankName.textContent = cfg.bankName || cfg.bankCode || "Chưa cấu hình (SEPAY_BANK_CODE)";
    if (qrAccNum) qrAccNum.textContent = cfg.accountNumber || "Chưa cấu hình (SEPAY_ACCOUNT_NUMBER)";
    if (qrAccName) qrAccName.textContent = cfg.accountName || "Chưa cấu hình (SEPAY_ACCOUNT_NAME)";

    const qrUrl = buildSepayQrImageUrl({
      accountNumber: cfg.accountNumber,
      bankCode: cfg.bankCode,
      amount: order.total,
      paymentReference: paymentRef
    });

    if (qrUrl && qrImg) {
      if (qrContentGrid) qrContentGrid.style.display = "";
      if (qrConfigWarning) qrConfigWarning.style.display = "none";
      qrImg.src = qrUrl;
    } else {
      if (qrImg) qrImg.removeAttribute("src");
      if (qrConfigWarning) {
        qrConfigWarning.style.display = "block";
        qrConfigWarning.textContent =
          "Backend chưa cấu hình đủ thông tin tài khoản nhận SePay (SEPAY_BANK_CODE, SEPAY_ACCOUNT_NUMBER) hoặc đơn chưa nhận được mã tham chiếu DH từ backend.";
      }
    }

    if (checkPaymentBtn) {
      checkPaymentBtn.onclick = () => handleManualPaymentCheck();
    }

    startCheckoutPaymentPolling(order.id);
  } else {
    if (qrCard) qrCard.style.display = "none";
    stopCheckoutPaymentPolling();
  }

  // Purchased items list
  const itemsList = document.getElementById("successItemsList");
  if (itemsList) {
    let lines = [];
    try {
      lines = typeof order.itemsJson === "string" ? JSON.parse(order.itemsJson) : order.itemsJson || [];
    } catch {
      lines = calculatedItems;
    }

    itemsList.innerHTML = lines.map((item) => `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 13.5px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          ${item.image ? `<img src="${item.image}" alt="${escapeHtml(item.name)}" style="width: 44px; height: 44px; object-fit: cover; border-radius: 4px; border: 1px solid #e2e8f0;">` : ""}
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <div style="color: #64748b; font-size: 12px;">Số lượng: ${item.quantity} × ${formatPrice(item.unitPrice)}</div>
          </div>
        </div>
        <strong style="color: #15803d;">${formatPrice(item.unitPrice * item.quantity)}</strong>
      </div>
    `).join("");
  }

  // Copy order ID button
  const copyBtn = document.getElementById("copyOrderBtn");
  if (copyBtn) {
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(order.id);
      showToast("Đã sao chép mã đơn hàng vào bộ nhớ tạm.");
    };
  }
}

// Populate province dropdown
function populateProvinces() {
  const select = document.getElementById("shippingProvince");
  if (!select) return;
  select.innerHTML = '<option value="">Chọn Tỉnh / Thành phố</option>' +
    PROVINCES.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");
}

// Auto-fill an address object into checkout fields
function applyAddressToForm(addr) {
  if (!addr) return;
  const nameInput = document.getElementById("shippingFullName");
  const phoneInput = document.getElementById("contactPhone");
  const provinceSelect = document.getElementById("shippingProvince");
  const districtInput = document.getElementById("shippingDistrict");
  const wardInput = document.getElementById("shippingWard");
  const specificAddressInput = document.getElementById("shippingSpecificAddress");

  if (nameInput && addr.name) nameInput.value = addr.name;
  if (phoneInput && addr.phone) phoneInput.value = addr.phone;
  if (provinceSelect && addr.province) provinceSelect.value = addr.province;

  if (addr.district && districtInput) districtInput.value = addr.district;
  if (addr.ward && wardInput) wardInput.value = addr.ward;

  if (addr.address) {
    if (specificAddressInput) specificAddressInput.value = addr.address;
    // If district or ward are missing, smartly parse from comma-separated address
    // e.g., "123 Lê Lợi, Phường Bến Nghé, Quận 1"
    const parts = addr.address.split(",").map(p => p.trim()).filter(Boolean);
    if (parts.length >= 3) {
      if (specificAddressInput) specificAddressInput.value = parts.slice(0, parts.length - 2).join(", ");
      if (wardInput) wardInput.value = parts[parts.length - 2];
      if (districtInput) districtInput.value = parts[parts.length - 1];
    } else if (parts.length === 2) {
      if (specificAddressInput) specificAddressInput.value = parts[0];
      if (districtInput) districtInput.value = parts[1];
      if (wardInput && !wardInput.value) wardInput.value = "Phường/Xã";
    }
  }

  // Clear any field errors
  ["shippingFullName", "contactPhone", "shippingProvince", "shippingDistrict", "shippingWard", "shippingSpecificAddress"].forEach(id => {
    const err = document.getElementById(`error-${id}`);
    const input = document.getElementById(id);
    if (err) err.textContent = "";
    if (input) input.classList.remove("invalid");
  });
}

// Main Start
async function start() {
  await initStore();

  // 1. Check authentication
  const currentUser = getCurrentUser();
  if (!currentUser) {
    redirectToLogin({
      next: "./checkout.html",
      notice: "Vui lòng đăng nhập tài khoản để tiến hành đặt hàng.",
      replace: true
    });
    return;
  }

  initCustomerChatWidget();

  // 2. Check cart
  cart = getCart();
  products = getProducts();

  if (!cart || cart.length === 0) {
    const layout = document.getElementById("checkoutLayout");
    const emptyView = document.getElementById("emptyCartView");
    if (layout) layout.style.display = "none";
    if (emptyView) emptyView.style.display = "block";
    return;
  }

  // 3. Pre-fill province list
  populateProvinces();

  // 4. Fill user info & default address from Address Book
  const account = getAccount(currentUser.id) || currentUser || {};
  const addresses = getUserAddresses(currentUser.id) || [];
  const defaultAddress = addresses.find(a => a.isDefault) || addresses[0];

  const nameInput = document.getElementById("shippingFullName");
  const emailInput = document.getElementById("contactEmail");
  const phoneInput = document.getElementById("contactPhone");

  if (emailInput && currentUser.email) emailInput.value = currentUser.email;

  // Setup saved addresses selector
  const savedAddressWrap = document.getElementById("savedAddressSelectorWrap");
  const savedAddressSelect = document.getElementById("savedAddressSelect");

  if (addresses.length > 0) {
    if (savedAddressWrap) savedAddressWrap.style.display = "block";
    if (savedAddressSelect) {
      savedAddressSelect.innerHTML = '<option value="">-- Nhập địa chỉ mới bên dưới --</option>' +
        addresses.map(a => `
          <option value="${a.id}" ${defaultAddress && defaultAddress.id === a.id ? "selected" : ""}>
            ${a.isDefault ? "⭐ [Mặc định] " : ""}${escapeHtml(a.name)} - ${escapeHtml(a.phone)} (${escapeHtml(a.address)}, ${escapeHtml(a.province)})
          </option>
        `).join("");

      savedAddressSelect.addEventListener("change", (e) => {
        const selectedId = e.target.value;
        const chosen = addresses.find(a => a.id === selectedId);
        if (chosen) {
          applyAddressToForm(chosen);
        }
      });
    }

    // Auto-fill the default address immediately!
    if (defaultAddress) {
      applyAddressToForm(defaultAddress);
    }
  } else {
    // If no saved addresses, fall back to basic account name & phone
    if (nameInput && (account.name || currentUser.name)) nameInput.value = account.name || currentUser.name;
    if (phoneInput && (account.phone || currentUser.phone)) phoneInput.value = account.phone || currentUser.phone;
  }

  // Show logged-in badge
  const userCard = document.getElementById("userAuthCard");
  const avatarText = document.getElementById("userAvatarText");
  const authName = document.getElementById("userAuthName");
  const authEmail = document.getElementById("userAuthEmail");

  if (userCard) {
    userCard.style.display = "flex";
    if (avatarText) avatarText.textContent = (currentUser.name || "U")[0].toUpperCase();
    if (authName) authName.textContent = currentUser.name || "Khách hàng EcoDesk";
    if (authEmail) authEmail.textContent = currentUser.email || "";
  }

  // 5. Restore coupon if passed from cart or query param
  const urlParamCoupon = new URLSearchParams(window.location.search).get("coupon");
  const sessionCoupon = sessionStorage.getItem("ecodesk_checkout_coupon");
  appliedCoupon = urlParamCoupon || sessionCoupon || "";

  if (appliedCoupon) {
    const input = document.getElementById("checkoutCouponInput");
    if (input) input.value = appliedCoupon;
  }

  // 6. Setup Form Events & Calculations
  setupFormEvents();
  renderAvailableCoupons();
  renderOrderSummary();
  sepayConfig = await fetchSepayPublicConfig(true);
  applySepayPreviewToCheckout(sepayConfig);
  initIcons();
}

function applySepayPreviewToCheckout(cfg) {
  const bankEl = document.getElementById("previewBankName");
  const accEl = document.getElementById("previewAccountNumber");
  const nameEl = document.getElementById("previewAccountName");
  const memoEl = document.getElementById("previewMemoFormat");
  const noticeEl = document.getElementById("sepayCheckoutNoticeText");

  const prefix = cfg?.paymentPrefix || "DH";
  if (memoEl) {
    memoEl.textContent = `${prefix}... (sinh tự động riêng cho đơn hàng sau khi xác nhận)`;
  }

  if (cfg && cfg.bankCode && cfg.accountNumber) {
    if (bankEl) bankEl.textContent = cfg.bankName ? `${cfg.bankName} (${cfg.bankCode})` : cfg.bankCode;
    if (accEl) accEl.textContent = cfg.accountNumber;
    if (nameEl) nameEl.textContent = cfg.accountName || "Chủ tài khoản EcoDesk";
    if (noticeEl) {
      noticeEl.textContent = `Hệ thống sẽ cấp mã tham chiếu tiền tố ${prefix} cho đơn hàng và tự động kiểm tra giao dịch qua SePay (${cfg.environment === "sandbox" ? "Test Mode" : "Live"}).`;
    }
  } else {
    if (bankEl) bankEl.textContent = "Chưa cấu hình trên máy chủ";
    if (accEl) accEl.textContent = "—";
    if (nameEl) nameEl.textContent = "—";
    if (noticeEl) {
      noticeEl.textContent = "Chưa cấu hình đầy đủ tài khoản nhận/SePay Token trong .env trên backend. Đơn tạo xong vẫn giữ trạng thái Chờ thanh toán cho đến khi SePay xác nhận.";
    }
  }
}

function updateSuccessPaymentDisplay(order) {
  if (!order) return;
  const info = getOrderPaymentStatusInfo(order);
  const iconWrap = document.getElementById("successIconWrap");
  const badgeTop = document.getElementById("successBadgeTop");
  const titleEl = document.getElementById("successTitle");
  const subtitleEl = document.getElementById("successSubtitle");
  const badge = document.getElementById("successPaymentBadge");
  const statusText = document.getElementById("successPaymentStatusText");
  const orderStatusBadge = document.getElementById("successOrderStatusBadge");
  const syncText = document.getElementById("successPaymentSyncText");
  const syncBox = document.getElementById("successPaymentSyncBox");
  const checkBtn = document.getElementById("checkPaymentStatusBtn");

  // 1. Phân loại giao diện kết quả theo phương thức & trạng thái xác thực thanh toán
  if (info.isQr) {
    if (info.isPaid) {
      // TH1: Đã xác minh thanh toán thành công qua SePay
      if (iconWrap) {
        iconWrap.className = "success-icon-wrap success";
        iconWrap.innerHTML = `
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        `;
      }
      if (badgeTop) {
        badgeTop.className = "success-badge-top success";
        badgeTop.textContent = "Thanh toán thành công";
      }
      if (titleEl) {
        titleEl.textContent = "Thanh toán thành công!";
      }
      if (subtitleEl) {
        subtitleEl.textContent = "Hệ thống đã xác nhận thanh toán qua SePay. Đơn hàng đang ở trạng thái Chờ cửa hàng xác nhận để chuẩn bị đơn.";
      }
    } else if (info.code === "NEEDS_REVIEW") {
      // TH2: Giao dịch chuyển khoản QR phát hiện sai lệch (cần đối soát)
      if (iconWrap) {
        iconWrap.className = "success-icon-wrap review";
        iconWrap.innerHTML = `
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"
            stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        `;
      }
      if (badgeTop) {
        badgeTop.className = "success-badge-top review";
        badgeTop.textContent = "Giao dịch cần đối soát";
      }
      if (titleEl) {
        titleEl.textContent = "Đơn hàng đang chờ đối soát thanh toán";
      }
      if (subtitleEl) {
        subtitleEl.textContent = `Hệ thống phát hiện thông tin chuyển khoản cần kiểm tra lại (${escapeHtml(order.paymentReviewReason || "số tiền hoặc nội dung chưa khớp")}). Cửa hàng sẽ hỗ trợ bạn trước khi tiếp tục xử lý đơn.`;
      }
    } else {
      // TH3: Đơn hàng QR chưa thanh toán / Chờ SePay xác minh
      if (iconWrap) {
        iconWrap.className = "success-icon-wrap pending";
        iconWrap.innerHTML = `
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"
            stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        `;
      }
      if (badgeTop) {
        badgeTop.className = "success-badge-top pending";
        badgeTop.textContent = "ĐÃ TẠO ĐƠN — CHỜ THANH TOÁN";
      }
      if (titleEl) {
        titleEl.textContent = "Đơn hàng đã được ghi nhận";
      }
      if (subtitleEl) {
        subtitleEl.textContent = "Đơn hàng chưa được xác nhận thanh toán. Cửa hàng sẽ tiếp tục xử lý sau khi hệ thống xác minh giao dịch thành công.";
      }
    }
  } else {
    // TH4: Đơn hàng COD (hoặc phương thức khác không phải QR)
    if (iconWrap) {
      iconWrap.className = "success-icon-wrap success";
      iconWrap.innerHTML = `
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
          stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      `;
    }
    if (badgeTop) {
      badgeTop.className = "success-badge-top success";
      badgeTop.textContent = "Đặt hàng thành công";
    }
    if (titleEl) {
      titleEl.textContent = "Cảm ơn bạn đã lựa chọn EcoDesk Studio!";
    }
    if (subtitleEl) {
      subtitleEl.textContent = "Đơn hàng của bạn đã được ghi nhận trên hệ thống và đang chờ cửa hàng xác nhận. Quý khách vui lòng chuẩn bị thanh toán khi nhận hàng (COD).";
    }
  }

  // 2. Cập nhật dòng Trạng thái thanh toán
  if (statusText) {
    if (info.isPaid) {
      statusText.textContent = `Đã thanh toán${order.paidAt ? ` (${order.paidAt})` : ""}`;
      statusText.style.fontWeight = "700";
      statusText.style.color = "#15803d";
    } else if (info.code === "NEEDS_REVIEW") {
      statusText.textContent = "Cần đối soát";
      statusText.style.fontWeight = "700";
      statusText.style.color = "#b91c1c";
    } else if (info.isQr) {
      statusText.textContent = "Chờ thanh toán";
      statusText.style.fontWeight = "700";
      statusText.style.color = "#b45309";
    } else {
      statusText.textContent = info.isPaid ? "Đã thanh toán (COD)" : "Thu tiền khi nhận (COD)";
      statusText.style.fontWeight = "700";
      statusText.style.color = info.isPaid ? "#15803d" : "#475569";
    }
  }

  // 3. Cập nhật dòng Trạng thái đơn (luôn giữ trạng thái xử lý thực, không tự nhảy sang Đang xử lý)
  if (orderStatusBadge) {
    const rawStatus = (order.status || "Chờ xác nhận").trim();
    const sLower = rawStatus.toLowerCase();
    if (sLower === "hoàn thành" || sLower === "giao thành công") {
      orderStatusBadge.className = "status-badge completed";
      orderStatusBadge.textContent = `● ${rawStatus}`;
    } else if (sLower === "đang giao") {
      orderStatusBadge.className = "status-badge shipping";
      orderStatusBadge.textContent = `● ${rawStatus}`;
    } else if (sLower === "đã hủy") {
      orderStatusBadge.className = "status-badge cancelled";
      orderStatusBadge.textContent = `● ${rawStatus}`;
    } else if (sLower === "đang xử lý") {
      orderStatusBadge.className = "status-badge processing";
      orderStatusBadge.textContent = `● ${rawStatus}`;
    } else {
      orderStatusBadge.className = "status-badge processing";
      orderStatusBadge.textContent = `● ${rawStatus || "Chờ xác nhận"}`;
    }
  }

  // 4. Badge trạng thái thanh toán trong khối QR
  if (badge) {
    badge.textContent = info.label;
    if (info.isPaid) {
      badge.style.background = "#dcfce7";
      badge.style.color = "#15803d";
      badge.style.borderColor = "#86efac";
    } else if (info.code === "NEEDS_REVIEW") {
      badge.style.background = "#fee2e2";
      badge.style.color = "#b91c1c";
      badge.style.borderColor = "#fca5a5";
    } else {
      badge.style.background = "#fef3c7";
      badge.style.color = "#b45309";
      badge.style.borderColor = "#fde68a";
    }
  }

  // 5. Khối đồng bộ & thông báo SePay
  if (syncBox && syncText) {
    if (info.isPaid) {
      syncBox.style.background = "#f0fdf4";
      syncBox.style.borderColor = "#bbf7d0";
      syncText.innerHTML = `<strong style="color:#15803d;">Đã xác nhận thanh toán thành công từ SePay</strong>${order.paidAt ? ` (${escapeHtml(order.paidAt)})` : ""}. Đơn hàng vẫn giữ quy trình xử lý tiêu chuẩn của cửa hàng.`;
      if (checkBtn) checkBtn.style.display = "none";
    } else if (info.code === "NEEDS_REVIEW") {
      syncBox.style.background = "#fef2f2";
      syncBox.style.borderColor = "#fecaca";
      syncText.innerHTML = `<strong style="color:#b91c1c;">Giao dịch cần đối soát:</strong> ${escapeHtml(order.paymentReviewReason || "Số tiền hoặc thông tin chuyển khoản chưa khớp hoàn toàn.")}`;
      if (checkBtn) checkBtn.style.display = "inline-flex";
    } else {
      syncBox.style.background = "#f8fafc";
      syncBox.style.borderColor = "#e2e8f0";
      syncText.textContent = "Trạng thái hiện tại: Chờ thanh toán. Cửa hàng sẽ tiếp tục xử lý sau khi hệ thống xác minh giao dịch thành công.";
      if (checkBtn) checkBtn.style.display = "inline-flex";
    }
  }
}

async function handleManualPaymentCheck() {
  if (!activeSuccessOrder) return;
  const checkBtn = document.getElementById("checkPaymentStatusBtn");
  const syncText = document.getElementById("successPaymentSyncText");
  if (checkBtn) {
    checkBtn.disabled = true;
    checkBtn.textContent = "Đang kiểm tra...";
  }
  try {
    const syncRes = await triggerSepayBackendSync();
    const latest = await fetchOrderById(activeSuccessOrder.id);
    if (latest) {
      activeSuccessOrder = latest;
      updateSuccessPaymentDisplay(latest);
      if (getOrderPaymentStatusInfo(latest).isPaid) {
        stopCheckoutPaymentPolling();
        showToast("SePay đã xác nhận thanh toán thành công cho đơn hàng!");
        return;
      }
    }
    if (syncText && syncRes?.message) {
      syncText.textContent = syncRes.message;
    }
    if (syncRes?.status === "RATE_LIMITED") {
      showToast(`SePay đang giới hạn tốc độ, vui lòng thử lại sau ${syncRes.retryAfterSeconds || 30} giây.`);
    } else {
      showToast("Chưa ghi nhận giao dịch khớp đơn hàng. Hệ thống vẫn đang tự động theo dõi.");
    }
  } finally {
    if (checkBtn) {
      checkBtn.disabled = false;
      checkBtn.textContent = "Kiểm tra thanh toán ngay";
    }
  }
}

function startCheckoutPaymentPolling(orderId) {
  stopCheckoutPaymentPolling();
  let ticks = 0;
  paymentPollTimer = setInterval(async () => {
    if (!activeSuccessOrder || String(activeSuccessOrder.id) !== String(orderId)) {
      stopCheckoutPaymentPolling();
      return;
    }
    const curInfo = getOrderPaymentStatusInfo(activeSuccessOrder);
    if (curInfo.isPaid || String(activeSuccessOrder.status || "").toLowerCase() === "đã hủy") {
      stopCheckoutPaymentPolling();
      return;
    }
    ticks += 1;
    // Periodically ask backend to sync when not throttled (every 3rd tick = 15s) and always read order state.
    if (ticks % 3 === 1) {
      await triggerSepayBackendSync();
    }
    const latest = await fetchOrderById(orderId);
    if (latest) {
      const prevCode = getOrderPaymentStatusInfo(activeSuccessOrder).code;
      activeSuccessOrder = latest;
      updateSuccessPaymentDisplay(latest);
      const nextInfo = getOrderPaymentStatusInfo(latest);
      if (nextInfo.isPaid && prevCode !== "PAID") {
        stopCheckoutPaymentPolling();
        showToast("Đã nhận thanh toán chuyển khoản QR qua SePay!");
      }
    }
  }, 5000);
}

function stopCheckoutPaymentPolling() {
  if (paymentPollTimer) {
    clearInterval(paymentPollTimer);
    paymentPollTimer = null;
  }
}

window.addEventListener("pagehide", stopCheckoutPaymentPolling);

if (document.getElementById("checkoutLayout") || window.location.pathname.toLowerCase().includes("checkout")) {
  start();
}
