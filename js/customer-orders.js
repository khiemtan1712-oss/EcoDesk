import {
  initStore,
  getCurrentUser,
  fetchUserOrders,
  fetchOrderById,
  getOrdersByUser,
  addToCart,
  requestOrderCancel,
  updateOrderShippingInfo,
  getOrders,
  findProduct
} from "./storage.js";
import { formatCurrency, showToast, escapeHtml, buildAuthUrl } from "./utils.js";
import { renderIcon, initIcons } from "./icons.js";
import { getReviewEligibility } from "./reviews.js";
import {
  fetchSepayPublicConfig,
  triggerSepayBackendSync,
  buildSepayQrImageUrl,
  getOrderPaymentStatusInfo
} from "./sepay.js";

// Quy ước xác định đơn hàng đã hoàn tất / giao thành công
export function isOrderCompleted(status) {
  if (!status) return false;
  const s = String(status).trim().toLowerCase();
  return s === "hoàn thành" || s === "hoàn tất" || s === "đã giao" || s === "giao thành công";
}

await initStore();
let sepayConfig = await fetchSepayPublicConfig().catch(() => null);
let customerPaymentPollTimer = null;
let activeDetailOrderId = null;

const session = getCurrentUser();
const container = document.getElementById("ordersContainer");
const greeting = document.getElementById("userGreeting");
const statTotal = document.getElementById("statTotalOrders");
const statPending = document.getElementById("statPendingOrders");
const statProcessing = document.getElementById("statProcessingOrders");
const statCompleted = document.getElementById("statCompletedOrders");
const filterTabs = document.querySelectorAll(".filter-tab");

// Detail Modal Elements
const detailModal = document.getElementById("orderDetailModal");
const detailModalClose = document.getElementById("closeOrderModalBtn");
const detailModalTitle = document.getElementById("modalOrderCode");
const detailModalContent = document.getElementById("modalOrderContent");

// Support Modal Elements
const supportModal = document.getElementById("supportModal");
const supportModalClose = document.getElementById("closeSupportModalBtn");
const closeSupportModalActionBtn = document.getElementById("closeSupportModalActionBtn");
const supportOrderCode = document.getElementById("supportOrderCode");
const supportOrderStatusBadge = document.getElementById("supportOrderStatusBadge");

// Edit Modal Elements
const editModal = document.getElementById("editOrderModal");
const editModalClose = document.getElementById("closeEditModalBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const editForm = document.getElementById("editOrderForm");
const editOrderId = document.getElementById("editOrderId");
const editCustomerName = document.getElementById("editCustomerName");
const editCustomerPhone = document.getElementById("editCustomerPhone");
const editShippingAddress = document.getElementById("editShippingAddress");
const editNote = document.getElementById("editNote");
const saveEditBtn = document.getElementById("saveEditBtn");

// Cancel Modal Elements
const cancelModal = document.getElementById("cancelOrderModal");
const cancelModalClose = document.getElementById("closeCancelModalBtn");
const abortCancelBtn = document.getElementById("abortCancelBtn");
const confirmCancelBtn = document.getElementById("confirmCancelBtn");
const cancelSummaryContainer = document.getElementById("cancelOrderSummary");
const cancelOtherReasonGroup = document.getElementById("cancelOtherReasonGroup");
const cancelCustomReason = document.getElementById("cancelCustomReason");
const cancelRadios = document.querySelectorAll("input[name='cancelReasonRadio']");

let allUserOrders = [];
let activeFilter = "all";
let currentPendingCancelOrder = null;

// Modal generic helpers
function openModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.add("open");
  modalEl.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeModal(modalEl) {
  if (!modalEl) return;
  if (modalEl === detailModal) {
    stopCustomerPaymentPolling();
  }
  modalEl.classList.remove("open");
  modalEl.setAttribute("aria-hidden", "true");
  if (!document.querySelector(".order-modal.open")) {
    document.body.style.overflow = "";
  }
}

function stopCustomerPaymentPolling() {
  if (customerPaymentPollTimer) {
    clearInterval(customerPaymentPollTimer);
    customerPaymentPollTimer = null;
  }
  activeDetailOrderId = null;
}

window.addEventListener("pagehide", stopCustomerPaymentPolling);

// Close handlers for Detail Modal
if (detailModalClose) {
  detailModalClose.addEventListener("click", () => closeModal(detailModal));
}
if (detailModal) {
  detailModal.addEventListener("click", (e) => {
    if (e.target === detailModal) closeModal(detailModal);
  });
}

// Close handlers for Edit Modal
if (editModalClose) {
  editModalClose.addEventListener("click", () => closeModal(editModal));
}
if (cancelEditBtn) {
  cancelEditBtn.addEventListener("click", () => closeModal(editModal));
}
if (editModal) {
  editModal.addEventListener("click", (e) => {
    if (e.target === editModal) closeModal(editModal);
  });
}

// Close handlers for Cancel Modal
if (cancelModalClose) {
  cancelModalClose.addEventListener("click", () => closeModal(cancelModal));
}
if (abortCancelBtn) {
  abortCancelBtn.addEventListener("click", () => closeModal(cancelModal));
}
if (cancelModal) {
  cancelModal.addEventListener("click", (e) => {
    if (e.target === cancelModal) closeModal(cancelModal);
  });
}

// Close handlers for Support Modal
if (supportModalClose) {
  supportModalClose.addEventListener("click", () => closeModal(supportModal));
}
if (closeSupportModalActionBtn) {
  closeSupportModalActionBtn.addEventListener("click", () => closeModal(supportModal));
}
if (supportModal) {
  supportModal.addEventListener("click", (e) => {
    if (e.target === supportModal) closeModal(supportModal);
  });
}

function openSupportModal(order) {
  if (!supportModal || !order) return;
  if (supportOrderCode) supportOrderCode.textContent = `#${order.id}`;
  if (supportOrderStatusBadge) supportOrderStatusBadge.innerHTML = getStatusBadge(order.status);
  openModal(supportModal);
}

// Escape key to close active modals
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (supportModal && supportModal.classList.contains("open")) {
      closeModal(supportModal);
      return;
    }
    if (cancelModal && cancelModal.classList.contains("open")) {
      closeModal(cancelModal);
      return;
    }
    if (editModal && editModal.classList.contains("open")) {
      closeModal(editModal);
      return;
    }
    if (detailModal && detailModal.classList.contains("open")) {
      closeModal(detailModal);
    }
  }
});

// Toggle "Lý do khác" custom description input
cancelRadios.forEach((radio) => {
  radio.addEventListener("change", () => {
    cancelRadios.forEach((r) => {
      r.closest(".reason-radio-label")?.classList.toggle("selected", r.checked);
    });
    if (radio.value === "Lý do khác" && radio.checked) {
      if (cancelOtherReasonGroup) cancelOtherReasonGroup.style.display = "block";
      if (cancelCustomReason) cancelCustomReason.focus();
    } else {
      if (cancelOtherReasonGroup) cancelOtherReasonGroup.style.display = "none";
    }
  });
});

function getStatusBadge(status) {
  const map = {
    "Chờ xác nhận": { class: "badge-pending", label: "Chờ xác nhận", icon: "clock" },
    "Đang xử lý": { class: "badge-processing", label: "Đang xử lý", icon: "package" },
    "Đang giao": { class: "badge-shipping", label: "Đang giao", icon: "truck" },
    "Hoàn thành": { class: "badge-completed", label: "Hoàn tất", icon: "check-circle-2" },
    "Đã hủy": { class: "badge-cancelled", label: "Đã hủy", icon: "x-circle" }
  };
  const item = map[status] || { class: "badge-pending", label: status || "Chờ xử lý", icon: "clock" };
  const iconSvg = renderIcon(item.icon, { size: 14, strokeWidth: 2, class: "badge-icon" });
  return `<span class="order-badge ${item.class}">${iconSvg} ${item.label}</span>`;
}

function parseOrderItems(order) {
  if (order.itemsJson) {
    try {
      const parsed = JSON.parse(order.itemsJson);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {}
  }
  if (Array.isArray(order.items) && order.items.length > 0) {
    return order.items;
  }
  return [
    {
      name: "Sản phẩm nội thất EcoDesk",
      quantity: 1,
      unitPrice: Number(order.total || 0),
      image: "./images/ban-nang-ha-mat-go.png"
    }
  ];
}

function updateStats(orders) {
  if (statTotal) statTotal.textContent = orders.length;
  if (statPending) {
    statPending.textContent = orders.filter((o) => (o.status || "").trim().toLowerCase() === "chờ xác nhận").length;
  }
  if (statProcessing) {
    statProcessing.textContent = orders.filter((o) => {
      const s = (o.status || "").trim().toLowerCase();
      return s === "đang xử lý" || s === "đang giao";
    }).length;
  }
  if (statCompleted) {
    statCompleted.textContent = orders.filter((o) => isOrderCompleted(o.status)).length;
  }
}

function renderOrders() {
  if (!session) {
    container.innerHTML = `
      <div class="orders-empty">
        <div class="orders-empty-icon" style="display:flex; justify-content:center; margin-bottom:12px; color: #94a3b8;">${renderIcon("lock", { size: 48, strokeWidth: 1.5 })}</div>
        <h3>Vui lòng đăng nhập để xem đơn hàng</h3>
        <p>Bạn cần đăng nhập bằng tài khoản EcoDesk để tra cứu danh sách và trạng thái các đơn hàng đã đặt.</p>
        <a href="${escapeHtml(buildAuthUrl("./login.html", { next: "./customer-orders.html" }))}" class="btn">Đăng nhập tài khoản</a>
      </div>
    `;
    return;
  }

  const filtered = activeFilter === "all"
    ? allUserOrders
    : allUserOrders.filter((o) => {
        if (activeFilter === "Hoàn thành") return isOrderCompleted(o.status);
        return (o.status || "").toLowerCase() === activeFilter.toLowerCase();
      });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="orders-empty">
        <div class="orders-empty-icon" style="display:flex; justify-content:center; margin-bottom:12px; color: #94a3b8;">${renderIcon("package", { size: 48, strokeWidth: 1.5 })}</div>
        <h3>${activeFilter === "all" ? "Bạn chưa có đơn hàng nào" : `Không có đơn hàng nào ở trạng thái "${activeFilter}"`}</h3>
        <p>Hãy trải nghiệm các mẫu bàn nâng hạ, ghế công thái học và phụ kiện setup chuẩn công thái học tại EcoDesk.</p>
        <a href="./products.html" class="btn">Khám phá sản phẩm ngay</a>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered
    .map((order) => {
      const items = parseOrderItems(order);
      const dateStr = order.createdAt
        ? new Date(order.createdAt).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" })
        : "Vừa xong";
      const totalAmount = Number(order.total || 0);
      const isPending = (order.status || "").trim().toLowerCase() === "chờ xác nhận";
      const isCancelled = (order.status || "").trim().toLowerCase() === "đã hủy";
      const isCompleted = isOrderCompleted(order.status);
      const cancelReqStatus = String(order.cancelRequestStatus || "").trim().toUpperCase();
      const isCancelPending = !isCancelled && cancelReqStatus === "PENDING";
      const isCancelRejected = !isCancelled && cancelReqStatus === "REJECTED";
      const refundStatus = String(order.refundStatus || "").trim().toUpperCase();
      const payInfo = getOrderPaymentStatusInfo(order);
      const canPayQr = payInfo.isQr && !payInfo.isPaid && !isCancelled && !isCancelPending;
      const canRequestCancel = !isCompleted && !isCancelled && !isCancelPending;
      const canEdit = isPending && !isCancelPending;

      return `
      <article class="order-card" data-order-id="${order.id}">
        <div class="order-card-header">
          <div class="order-card-id-block">
            <span class="order-card-id">Đơn hàng #${order.id}</span>
            <span class="order-card-date">• ${dateStr}</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:flex-end;">
            <span class="payment-pill ${payInfo.badgeClass}">${escapeHtml(payInfo.shortLabel)}</span>
            ${getStatusBadge(order.status)}
            ${
              isCancelPending
                ? `<span class="payment-pill unpaid" style="background:#fff7ed; color:#c2410c; border-color:#fdba74;">Chờ duyệt hủy</span>`
                : ""
            }
            ${
              isCancelled && refundStatus === "PENDING_REFUND"
                ? `<span class="payment-pill unpaid">Chờ hoàn tiền</span>`
                : isCancelled && refundStatus === "REFUNDED"
                ? `<span class="payment-pill paid">Đã hoàn tiền</span>`
                : ""
            }
          </div>
        </div>

        ${
          isCancelPending
            ? `<div style="margin: 0 18px 10px; padding: 10px 12px; border-radius: 8px; background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; font-size: 13px;">
                <strong>Chờ duyệt hủy:</strong> Đang chờ nhân viên xử lý yêu cầu hủy (${escapeHtml(order.cancelRequestReason || "Theo yêu cầu")}). Trong thời gian này không thể gửi thêm yêu cầu hủy hoặc thanh toán QR.
              </div>`
            : isCancelRejected
            ? `<div style="margin: 0 18px 10px; padding: 10px 12px; border-radius: 8px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; font-size: 13px;">
                <strong>Yêu cầu hủy đã bị từ chối:</strong> ${escapeHtml(order.cancelRejectReason || "Không đủ điều kiện hủy.")} Đơn hàng tiếp tục ở trạng thái <strong>${escapeHtml(order.status)}</strong>.
              </div>`
            : ""
        }

        <div class="order-card-items">
          ${items
            .map(
              (item) => `
            <div class="order-item-row">
              <img src="${item.image || "./images/ban-nang-ha-mat-go.png"}" alt="${item.name}" class="order-item-img" onerror="this.src='./images/ban-nang-ha-mat-go.png'">
              <div class="order-item-info">
                <div class="order-item-name">${item.name}</div>
                ${
                  item.variantName
                    ? `<div class="order-item-variant" style="font-size: 11.5px; color: #15803d; font-weight: 600;">Phân loại: ${item.variantName}</div>`
                    : ""
                }
                <div class="order-item-meta">Số lượng: <strong>x${item.quantity || 1}</strong> · Đơn giá: ${formatCurrency(
                item.unitPrice || item.price || 0
              )}</div>
              </div>
              <div class="order-item-price">${formatCurrency(
                (item.unitPrice || item.price || 0) * (item.quantity || 1)
              )}</div>
            </div>
          `
            )
            .join("")}
        </div>

        <div class="order-card-footer">
          <div class="order-card-summary">
            <span>Tổng thanh toán:</span>
            <strong class="order-card-total">${formatCurrency(totalAmount)}</strong>
          </div>
          <div class="order-card-actions">
            ${
              canPayQr
                ? `<button type="button" class="btn-pay-order" data-action="pay" data-order-id="${order.id}" title="Mở lại mã QR thanh toán cho đơn này">
                    ${renderIcon("qr-code", { size: 14, strokeWidth: 2 })} Thanh toán đơn
                  </button>`
                : ""
            }
            <button type="button" class="btn-detail" data-action="detail" data-order-id="${order.id}">Xem chi tiết</button>
            ${
              canEdit
                ? `
              <button type="button" class="btn-edit-order" data-action="edit" data-order-id="${order.id}" title="Thay đổi thông tin nhận hàng" style="display: inline-flex; align-items: center; gap: 4px;">
                ${renderIcon("edit-2", { size: 13, strokeWidth: 1.8 })} Thay đổi thông tin
              </button>
            `
                : ""
            }
            ${
              canRequestCancel
                ? `
              <button type="button" class="btn-cancel-order" data-action="cancel" data-order-id="${order.id}" title="Gửi yêu cầu hủy đơn hàng này">
                Hủy đơn
              </button>
            `
                : ""
            }
            ${
              isCompleted
                ? `<button type="button" class="btn-reorder" data-action="reorder" data-order-id="${order.id}">Mua lại</button>`
                : ""
            }
          </div>
        </div>
      </article>
    `;
    })
    .join("");

  // Attach event listeners
  container.querySelectorAll("[data-action='pay']").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const orderId = btn.dataset.orderId;
      if (!sepayConfig) {
        sepayConfig = await fetchSepayPublicConfig().catch(() => null);
      }
      const freshOrder = await fetchOrderById(orderId).catch(() => null);
      const order = freshOrder || allUserOrders.find((o) => String(o.id) === String(orderId));
      if (order) showOrderDetail(order, { focusPayment: true });
    });
  });

  container.querySelectorAll("[data-action='detail']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const orderId = btn.dataset.orderId;
      const order = allUserOrders.find((o) => String(o.id) === String(orderId));
      if (order) showOrderDetail(order);
    });
  });

  container.querySelectorAll("[data-action='edit']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const orderId = btn.dataset.orderId;
      const order = allUserOrders.find((o) => String(o.id) === String(orderId));
      if (order) openEditOrderModal(order);
    });
  });

  container.querySelectorAll("[data-action='cancel']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const orderId = btn.dataset.orderId;
      const order = allUserOrders.find((o) => String(o.id) === String(orderId));
      if (order) openCancelOrderModal(order);
    });
  });

  container.querySelectorAll("[data-action='reorder']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const orderId = btn.dataset.orderId;
      const order = allUserOrders.find((o) => String(o.id) === String(orderId));
      if (order) handleReorder(order);
    });
  });

  initIcons();
}

function parseStatusHistory(order) {
  if (Array.isArray(order.statusHistory) && order.statusHistory.length > 0) {
    return order.statusHistory;
  }
  if (order.statusHistoryJson) {
    try {
      const parsed = JSON.parse(order.statusHistoryJson);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {}
  }
  return [];
}

function formatHistoryTime(isoString) {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  } catch (e) {
    return "";
  }
}

function renderHistoryLog(history, order) {
  const entries = [...history];
  if (entries.length === 0 && order.createdAt) {
    entries.push({
      status: "Chờ xác nhận",
      timestamp: order.createdAt,
      note: "Đơn hàng đã được đặt thành công",
      by: order.customerName || "Khách hàng"
    });
  }

  if (entries.length === 0) return "";

  return `
    <div class="order-history-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 12.5px; font-weight: 700; color: var(--co-ink); display: inline-flex; align-items: center; gap: 6px;">
          ${renderIcon("history", { size: 15, strokeWidth: 2 })} Lịch sử cập nhật đơn hàng (${entries.length} mốc ghi nhận)
        </span>
      </div>
      <div class="history-timeline-list">
        ${entries
          .map((item) => {
            const isCanc = (item.status || "").trim().toLowerCase() === "đã hủy";
            return `
            <div class="history-timeline-item ${isCanc ? "cancelled" : ""}">
              <span class="history-item-time">${formatHistoryTime(item.timestamp) || "Đang xử lý"}</span>
              <div class="history-item-text">
                <strong>${escapeHtml(item.status || "")}</strong>: ${escapeHtml(item.note || "Cập nhật trạng thái")}
                ${item.by ? `<span class="history-item-by"> · ${escapeHtml(item.by)}</span>` : ""}
              </div>
            </div>
          `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function renderOrderStepper(order) {
  const history = parseStatusHistory(order);
  const currentStatus = (order.status || "Chờ xác nhận").trim();
  const s = currentStatus.toLowerCase();
  const isCancelled = s === "đã hủy";
  const isCompleted = isOrderCompleted(currentStatus);
  const isShipping = s === "đang giao";
  const isProcessing = s === "đang xử lý";
  const isPending = s === "chờ xác nhận";

  // Helper tìm mốc thời gian thực tế đã lưu trong history cho trạng thái
  const findTime = (targetStatus) => {
    if (targetStatus === "Chờ xác nhận") {
      const entry = history.find((h) => (h.status || "").trim().toLowerCase() === "chờ xác nhận");
      const raw = entry?.timestamp || order.createdAt;
      return raw ? formatHistoryTime(raw) : "";
    }
    const entry = history.find((h) => (h.status || "").trim().toLowerCase() === targetStatus.toLowerCase());
    return entry?.timestamp ? formatHistoryTime(entry.timestamp) : "";
  };

  if (isCancelled) {
    const hadProcessing = history.some((h) => (h.status || "").trim().toLowerCase() === "đang xử lý");
    const hadShipping = history.some((h) => (h.status || "").trim().toLowerCase() === "đang giao");

    const time1 = findTime("Chờ xác nhận");
    const time2 = findTime("Đang xử lý");
    const time3 = findTime("Đang giao");
    const cancelTime = order.cancelledAt ? formatHistoryTime(order.cancelledAt) : findTime("Đã hủy");

    return `
      <div class="order-tracker-card">
        <div class="tracker-header">
          <div class="tracker-title">
            <span style="display:inline-flex; align-items:center; gap:6px;">${renderIcon("package", { size: 16, strokeWidth: 2 })} Tiến trình đơn hàng #${order.id}</span>
          </div>
          <span class="tracker-status-chip cancelled" style="display:inline-flex; align-items:center; gap:5px;">${renderIcon("x-circle", { size: 13, strokeWidth: 2 })} Tiến trình đã dừng (Đã hủy)</span>
        </div>

        <div class="order-stepper">
          <!-- Bước 1: Đặt đơn -->
          <div class="stepper-step is-completed">
            <div class="stepper-line"></div>
            <div class="step-node">${renderIcon("check", { size: 14, strokeWidth: 2.5 })}</div>
            <div class="step-body">
              <span class="step-name">1. Chờ xác nhận</span>
              ${time1 ? `<span class="step-time">${time1}</span>` : ""}
              <span class="step-desc">Đơn hàng đã đặt</span>
            </div>
          </div>

          <!-- Bước 2: Đã xác nhận (nếu có trước khi hủy) -->
          ${
            hadProcessing
              ? `
            <div class="stepper-step is-completed">
              <div class="stepper-line"></div>
              <div class="step-node">${renderIcon("check", { size: 14, strokeWidth: 2.5 })}</div>
              <div class="step-body">
                <span class="step-name">2. Đã xác nhận</span>
                ${time2 ? `<span class="step-time">${time2}</span>` : ""}
                <span class="step-desc">Đóng gói hàng</span>
              </div>
            </div>
          `
              : ""
          }

          <!-- Bước 3: Đang giao (nếu có trước khi hủy) -->
          ${
            hadShipping
              ? `
            <div class="stepper-step is-completed">
              <div class="stepper-line"></div>
              <div class="step-node">${renderIcon("check", { size: 14, strokeWidth: 2.5 })}</div>
              <div class="step-body">
                <span class="step-name">3. Đang giao hàng</span>
                ${time3 ? `<span class="step-time">${time3}</span>` : ""}
                <span class="step-desc">Vận chuyển</span>
              </div>
            </div>
          `
              : ""
          }

          <!-- Bước Hủy Đơn -->
          <div class="stepper-step is-cancelled">
            <div class="stepper-line"></div>
            <div class="step-node">${renderIcon("x", { size: 14, strokeWidth: 2.5 })}</div>
            <div class="step-body">
              <span class="step-name">Đã hủy đơn</span>
              ${cancelTime ? `<span class="step-time">${cancelTime}</span>` : ""}
              <span class="step-desc">${escapeHtml(order.cancelledBy ? `Bởi: ${order.cancelledBy}` : "Đã dừng xử lý")}</span>
            </div>
          </div>

          <!-- Bước Hoàn tất dừng lại -->
          <div class="stepper-step is-pending">
            <div class="stepper-line"></div>
            <div class="step-node">—</div>
            <div class="step-body">
              <span class="step-name">Hoàn tất</span>
              <span class="step-desc">Không thực hiện</span>
            </div>
          </div>
        </div>

        ${renderHistoryLog(history, order)}
      </div>
    `;
  }

  // Luồng bình thường (Forward flow)
  let step1State = "is-completed";
  let step2State = "is-pending";
  let step3State = "is-pending";
  let step4State = "is-pending";

  let chipClass = "pending";
  let chipText = "Chờ xác nhận";

  if (isPending) {
    step1State = "is-active";
    step2State = "is-pending";
    step3State = "is-pending";
    step4State = "is-pending";
    chipClass = "pending";
    chipText = `<span style="display:inline-flex; align-items:center; gap:5px;">${renderIcon("clock", { size: 13, strokeWidth: 2 })} Chờ xác nhận</span>`;
  } else if (isProcessing) {
    step1State = "is-completed";
    step2State = "is-active";
    step3State = "is-pending";
    step4State = "is-pending";
    chipClass = "processing";
    chipText = `<span style="display:inline-flex; align-items:center; gap:5px;">${renderIcon("package", { size: 13, strokeWidth: 2 })} Đang xử lý & chuẩn bị hàng</span>`;
  } else if (isShipping) {
    step1State = "is-completed";
    step2State = "is-completed";
    step3State = "is-active";
    step4State = "is-pending";
    chipClass = "shipping";
    chipText = `<span style="display:inline-flex; align-items:center; gap:5px;">${renderIcon("truck", { size: 13, strokeWidth: 2 })} Đang giao hàng</span>`;
  } else if (isCompleted) {
    step1State = "is-completed";
    step2State = "is-completed";
    step3State = "is-completed";
    step4State = "is-completed";
    chipClass = "completed";
    chipText = `<span style="display:inline-flex; align-items:center; gap:5px;">${renderIcon("check-circle-2", { size: 13, strokeWidth: 2 })} Giao hàng thành công</span>`;
  }

  const time1 = findTime("Chờ xác nhận");
  const time2 = findTime("Đang xử lý");
  const time3 = findTime("Đang giao");
  const time4 = findTime("Hoàn thành");

  const checkSvg = renderIcon("check", { size: 14, strokeWidth: 2.5 });

  return `
    <div class="order-tracker-card">
      <div class="tracker-header">
        <div class="tracker-title">
          <span style="display:inline-flex; align-items:center; gap:6px;">${renderIcon("package", { size: 16, strokeWidth: 2 })} Tiến trình đơn hàng #${order.id}</span>
        </div>
        <span class="tracker-status-chip ${chipClass}">${chipText}</span>
      </div>

      <div class="order-stepper">
        <!-- Bước 1: Chờ xác nhận -->
        <div class="stepper-step ${step1State}">
          <div class="stepper-line"></div>
          <div class="step-node">${step1State === "is-completed" ? checkSvg : "1"}</div>
          <div class="step-body">
            <span class="step-name">1. Chờ xác nhận</span>
            ${time1 ? `<span class="step-time">${time1}</span>` : (step1State === "is-active" ? `<span class="step-time">Đang tiếp nhận</span>` : "")}
            <span class="step-desc">Đơn hàng đã đặt</span>
          </div>
        </div>

        <!-- Bước 2: Đã xác nhận & Đang chuẩn bị hàng (Đang xử lý) -->
        <div class="stepper-step ${step2State}">
          <div class="stepper-line"></div>
          <div class="step-node">${step2State === "is-completed" ? checkSvg : "2"}</div>
          <div class="step-body">
            <span class="step-name">2. Đã xác nhận</span>
            ${time2 ? `<span class="step-time">${time2}</span>` : (step2State === "is-active" ? `<span class="step-time">Đang chuẩn bị</span>` : "")}
            <span class="step-desc">Đóng gói hàng</span>
          </div>
        </div>

        <!-- Bước 3: Đang giao hàng (Đang giao) -->
        <div class="stepper-step ${step3State}">
          <div class="stepper-line"></div>
          <div class="step-node">${step3State === "is-completed" ? checkSvg : "3"}</div>
          <div class="step-body">
            <span class="step-name">3. Đang giao hàng</span>
            ${time3 ? `<span class="step-time">${time3}</span>` : (step3State === "is-active" ? `<span class="step-time">Đang vận chuyển</span>` : "")}
            <span class="step-desc">Đã giao bưu tá</span>
          </div>
        </div>

        <!-- Bước 4: Hoàn tất (Giao hàng thành công) -->
        <div class="stepper-step ${step4State}">
          <div class="stepper-line"></div>
          <div class="step-node">${step4State === "is-completed" ? checkSvg : "4"}</div>
          <div class="step-body">
            <span class="step-name">4. Hoàn tất</span>
            ${time4 ? `<span class="step-time">${time4}</span>` : ""}
            <span class="step-desc">Giao thành công</span>
          </div>
        </div>
      </div>

      ${renderHistoryLog(history, order)}
    </div>
  `;
}

function showOrderDetail(order, options = {}) {
  detailModalTitle.textContent = `Chi tiết đơn hàng #${order.id}`;
  const items = parseOrderItems(order);
  const subtotal = Number(order.subtotal || order.total || 0);
  const discount = Number(order.discount || 0);
  const shippingFee = Number(order.shippingFee || 0);
  const total = Number(order.total || 0);
  const dateStr = order.createdAt ? new Date(order.createdAt).toLocaleString("vi-VN") : "Chưa có";

  const isPending = (order.status || "").trim().toLowerCase() === "chờ xác nhận";
  const isCancelled = (order.status || "").trim().toLowerCase() === "đã hủy";
  const isCompleted = isOrderCompleted(order.status);
  const cancelReqStatus = String(order.cancelRequestStatus || "").trim().toUpperCase();
  const isCancelPending = !isCancelled && cancelReqStatus === "PENDING";
  const isCancelRejected = !isCancelled && cancelReqStatus === "REJECTED";
  const refundStatus = String(order.refundStatus || "").trim().toUpperCase();
  const payInfo = getOrderPaymentStatusInfo(order);
  const isPendingQR = !isCancelled && !isCancelPending && payInfo.isQr && !payInfo.isPaid;
  const qrRef = order.paymentReference || "";
  const cfg = sepayConfig || {};
  const qrUrl = buildSepayQrImageUrl({
    accountNumber: cfg.accountNumber,
    bankCode: cfg.bankCode,
    amount: total,
    paymentReference: qrRef
  });

  detailModalContent.innerHTML = `
    <!-- Tiến trình theo dõi đơn hàng từng bước (Order Stepper & Tracking) -->
    ${renderOrderStepper(order)}

    <!-- Banner Trạng Thái / Hủy Đơn / Hỗ Trợ -->
    ${
      isCancelled
        ? `
      <div class="cancellation-banner">
        <div class="cancellation-banner-header" style="display: flex; align-items: center; gap: 6px;">
          <span>${renderIcon("x-circle", { size: 16, strokeWidth: 1.8 })} Đơn hàng đã được hủy</span>
        </div>
        <div class="cancellation-banner-detail">
          <div><strong>Lý do hủy:</strong> ${escapeHtml(order.cancelReason || "Theo yêu cầu của khách hàng")}</div>
          <div><strong>Người thực hiện:</strong> ${escapeHtml(order.cancelledBy || "Khách hàng")}</div>
          ${
            order.cancelledAt
              ? `<div><strong>Thời gian hủy:</strong> ${new Date(order.cancelledAt).toLocaleString("vi-VN", {
                  dateStyle: "medium",
                  timeStyle: "short"
                })}</div>`
              : ""
          }
          ${
            refundStatus === "PENDING_REFUND"
              ? `<div><strong>Trạng thái hoàn tiền:</strong> <span style="color:#b45309; font-weight:700;">Chờ hoàn tiền theo quy trình</span></div>`
              : refundStatus === "REFUNDED"
              ? `<div><strong>Trạng thái hoàn tiền:</strong> <span style="color:#15803d; font-weight:700;">Đã hoàn tiền</span></div>`
              : ""
          }
        </div>
      </div>
    `
        : isCancelPending
        ? `
      <div class="modal-notice-box info" style="margin-bottom: 14px; background: #fff7ed; border-color: #fdba74; color: #9a3412;">
        <span class="notice-icon">${renderIcon("clock", { size: 18, strokeWidth: 2 })}</span>
        <div>
          <strong>Chờ duyệt hủy:</strong> Đang chờ nhân viên xử lý yêu cầu hủy đơn.<br>
          <span>Lý do: <strong>${escapeHtml(order.cancelRequestReason || "Theo yêu cầu")}</strong></span>
          ${order.cancelRequestedAt ? ` · <span>Gửi lúc: ${new Date(order.cancelRequestedAt).toLocaleString("vi-VN")}</span>` : ""}
        </div>
      </div>
    `
        : isCancelRejected
        ? `
      <div class="modal-notice-box danger" style="margin-bottom: 14px;">
        <span class="notice-icon">${renderIcon("alert-circle", { size: 18, strokeWidth: 2 })}</span>
        <div>
          <strong>Yêu cầu hủy đơn đã bị từ chối:</strong> ${escapeHtml(order.cancelRejectReason || "Không đủ điều kiện hủy.")}<br>
          <span>Đơn hàng tiếp tục ở trạng thái <strong>${escapeHtml(order.status)}</strong>. Bạn có thể gửi lại yêu cầu mới nếu cần.</span>
        </div>
      </div>
    `
        : ""
    }

    ${
      isPending
        ? `
      <div style="background: #f0fdf4; border: 1px solid var(--co-primary-border); border-radius: 10px; padding: 12px 16px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <span style="font-size: 13px; color: var(--co-primary); font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
          ${renderIcon("clock", { size: 14, strokeWidth: 2 })} Đơn hàng đang chờ cửa hàng xác nhận. Quý khách có thể thay đổi thông tin nhận hàng hoặc hủy đơn.
        </span>
        <div style="display: flex; gap: 8px;">
          <button type="button" class="btn-edit-order" id="modalDetailEditBtn" style="display:inline-flex; align-items:center; gap:4px;">${renderIcon("edit-2", { size: 13, strokeWidth: 2 })} Đổi thông tin</button>
          <button type="button" class="btn-cancel-order" id="modalDetailCancelBtn">Hủy đơn</button>
        </div>
      </div>
    `
        : ""
    }

    ${
      isCompleted
        ? `
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 12px 16px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <span style="font-size: 13px; color: #15803d; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
          ${renderIcon("check-circle-2", { size: 14, strokeWidth: 2 })} Đơn hàng đã được giao thành công và hoàn tất. Quý khách có thể đặt mua lại các sản phẩm trong đơn này.
        </span>
        <button type="button" class="btn-reorder" id="modalDetailReorderBtn" data-order-id="${order.id}" style="display:inline-flex; align-items:center; gap:4px;">
          ${renderIcon("rotate-ccw", { size: 13, strokeWidth: 2 })} Mua lại
        </button>
      </div>
    `
        : ""
    }

    ${
      !isPending && !isCancelled && !isCompleted
        ? `
      <div class="locked-order-banner">
        <span style="display:inline-flex; align-items:center; color:#0284c7;">${renderIcon("info", { size: 20, strokeWidth: 2 })}</span>
        <div>
          Đơn hàng đang ở trạng thái <strong>${escapeHtml(order.status)}</strong> nên không thể chỉnh sửa hoặc hủy online.
          Nếu cần thay đổi gấp về địa chỉ hoặc giao hàng, vui lòng bấm <strong>Liên hệ hỗ trợ</strong> hoặc gọi <strong>Hotline 1900 1234</strong> (8:00 - 21:00).
        </div>
      </div>
    `
        : ""
    }

    <!-- Thông tin trạng thái & thời gian -->
    <div class="modal-section">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
        <span style="font-size: 13px; color: var(--co-muted);">Ngày tạo đơn: <strong>${dateStr}</strong></span>
        ${getStatusBadge(order.status)}
      </div>
      ${
        order.updatedAt
          ? `<div style="font-size: 12px; color: var(--co-muted); margin-top: 4px; display:inline-flex; align-items:center; gap:4px;">${renderIcon("clock", { size: 13, strokeWidth: 2 })} Cập nhật thông tin nhận hàng lần cuối: <strong>${new Date(
              order.updatedAt
            ).toLocaleString("vi-VN")}</strong></div>`
          : ""
      }
    </div>

    <!-- Thông tin người nhận & giao hàng -->
    <div class="modal-section">
      <h3 class="modal-section-title" style="display:flex; align-items:center; gap:6px;">${renderIcon("map-pin", { size: 16, strokeWidth: 2 })} Thông tin nhận hàng</h3>
      <div class="modal-grid">
        <div class="modal-grid-item">
          <label>Người nhận:</label>
          <div>${escapeHtml(order.customerName || session.name || "Khách hàng EcoDesk")}</div>
        </div>
        <div class="modal-grid-item">
          <label>Số điện thoại:</label>
          <div>${escapeHtml(order.customerPhone || "Chưa có dữ liệu")}</div>
        </div>
        <div class="modal-grid-item" style="grid-column: 1 / -1;">
          <label>Địa chỉ nhận hàng:</label>
          <div>${escapeHtml(order.shippingAddress || "Giao hàng tận nơi")}</div>
        </div>
        <div class="modal-grid-item">
          <label>Phương thức vận chuyển:</label>
          <div>${escapeHtml(order.shippingMethod || "Giao hàng tiêu chuẩn (Toàn quốc)")}</div>
        </div>
        <div class="modal-grid-item">
          <label>Ghi chú đơn hàng:</label>
          <div>${escapeHtml(order.note || "Không có")}</div>
        </div>
      </div>
    </div>

    <!-- Phương thức thanh toán -->
    <div class="modal-section">
      <h3 class="modal-section-title" style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;">
        <span style="display:inline-flex; align-items:center; gap:6px;">${renderIcon("credit-card", { size: 16, strokeWidth: 2 })} Phương thức &amp; Trạng thái thanh toán</span>
        <span class="payment-pill ${payInfo.badgeClass}" id="modalPaymentStatusPill">${escapeHtml(payInfo.label)}</span>
      </h3>
      <div style="font-size: 14px; font-weight: 600; color: var(--co-ink);">
        ${escapeHtml(order.paymentMethod || "Chuyển khoản QR (VietQR / Napas 247)")}
      </div>
      ${
        payInfo.isQr && qrRef
          ? `<div style="margin-top:6px; font-size:13px; color:var(--co-ink-light);">Mã tham chiếu chuyển khoản: <strong style="color:var(--co-primary);">${escapeHtml(qrRef)}</strong></div>`
          : ""
      }

      ${
        payInfo.isQr && payInfo.isPaid
          ? `
        <div style="margin-top:12px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:12px 14px; font-size:13px; color:#15803d;">
          <strong>Đã xác nhận thanh toán thành công qua SePay</strong>
          ${order.paidAt ? `<div style="margin-top:4px; color:#166534;">Thời gian ghi nhận: <strong>${escapeHtml(order.paidAt)}</strong></div>` : ""}
          ${order.paidAmount ? `<div style="margin-top:2px; color:#166534;">Số tiền đã nhận: <strong>${formatCurrency(order.paidAmount)}</strong></div>` : ""}
        </div>
      `
          : ""
      }

      ${
        payInfo.code === "NEEDS_REVIEW"
          ? `
        <div style="margin-top:12px; background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:12px 14px; font-size:13px; color:#991b1b;">
          <strong>Giao dịch cần đối soát:</strong> ${escapeHtml(order.paymentReviewReason || "Số tiền hoặc thông tin chuyển khoản chưa khớp hoàn toàn. Vui lòng liên hệ hỗ trợ EcoDesk.")}
        </div>
      `
          : ""
      }

      ${
        isPendingQR
          ? `
        <div class="modal-payment-card" id="modalSepayQrCard">
          <h4>Thông tin chuyển khoản qua mã QR (SePay)</h4>
          <p style="font-size: 13px; color: var(--co-ink-light); margin-bottom: 8px;">
            Trạng thái hiện tại: <strong>${escapeHtml(payInfo.label)}</strong>. Quý khách vui lòng chuyển đúng số tiền và đúng mã tham chiếu bên dưới để hệ thống tự động xác nhận:
          </p>
          ${
            qrUrl
              ? `
            <div class="modal-qr-box">
              <img src="${qrUrl}"
                   alt="Mã VietQR Thanh toán SePay"
                   class="modal-qr-img"
                   onerror="this.style.display='none'">
              <div class="modal-qr-info">
                <div>Ngân hàng: <strong>${escapeHtml(cfg.bankName || cfg.bankCode || "Chưa cấu hình")}</strong></div>
                <div>Số tài khoản: <strong style="color: var(--co-primary); font-size: 15px;">${escapeHtml(cfg.accountNumber || "—")}</strong></div>
                <div>Chủ tài khoản: <strong>${escapeHtml(cfg.accountName || "—")}</strong></div>
                <div>Số tiền: <strong>${formatCurrency(total)}</strong></div>
                <div>Nội dung CK: <strong style="color: #b45309; background: #fef3c7; padding: 2px 6px; border-radius: 4px;">${escapeHtml(qrRef)}</strong></div>
              </div>
            </div>
          `
              : `
            <div style="padding:10px 12px; background:#fff7ed; border:1px solid #fed7aa; border-radius:8px; font-size:13px; color:#9a3412;">
              Chưa có đủ cấu hình tài khoản ngân hàng hoặc mã tham chiếu DH từ backend để hiển thị mã QR.
            </div>
          `
          }
          <div style="margin-top:12px; display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
            <span id="customerSepaySyncMsg" style="font-size:12.5px; color:var(--co-muted);">Hệ thống tự động đối chiếu giao dịch SePay khi nhận chuyển khoản.</span>
            <button type="button" class="btn-detail" id="customerCheckPaymentBtn" style="font-size:12.5px; padding:6px 12px;">Kiểm tra thanh toán</button>
          </div>
        </div>
      `
          : ""
      }
    </div>

    <!-- Danh sách sản phẩm -->
    <div class="modal-section">
      <h3 class="modal-section-title" style="display:flex; align-items:center; gap:6px;">${renderIcon("shopping-bag", { size: 16, strokeWidth: 2 })} Danh sách sản phẩm</h3>
      <div class="order-card-items" style="padding: 0; border: none;">
        ${items
          .map((item) => {
            const pId = item.productId || item.id;
            let reviewActionHtml = "";
            if (isCompleted && pId) {
              const elig = getReviewEligibility(pId, session);
              const unreviewedForThisOrder = (elig.unreviewedOrders || []).some((uo) => String(uo.id) === String(order.id));
              if (unreviewedForThisOrder) {
                reviewActionHtml = `<a href="./detail.html?id=${encodeURIComponent(pId)}#reviewsSection" style="display:inline-flex; align-items:center; gap:4px; margin-top:4px; padding:4px 10px; border-radius:6px; background:#fef3c7; color:#92400e; font-size:11.5px; font-weight:700; text-decoration:none; border:1px solid #fde68a;">${renderIcon("star", { size: 12, strokeWidth: 2 })} Đánh giá sản phẩm</a>`;
              } else if ((elig.existingReviews || []).length > 0) {
                reviewActionHtml = `<a href="./detail.html?id=${encodeURIComponent(pId)}#reviewsSection" style="display:inline-flex; align-items:center; gap:4px; margin-top:4px; padding:3px 9px; border-radius:6px; background:#ecfdf5; color:#047857; font-size:11.5px; font-weight:700; text-decoration:none; border:1px solid #a7f3d0;">${renderIcon("check-circle-2", { size: 12, strokeWidth: 2 })} Đã đánh giá</a>`;
              }
            }
            return `
          <div class="order-item-row" style="padding: 10px 0; border-bottom: 1px solid var(--co-line);">
            <img src="${item.image || "./images/ban-nang-ha-mat-go.png"}" alt="${escapeHtml(item.name || "")}" class="order-item-img" style="width: 50px; height: 50px;">
            <div class="order-item-info">
              <div class="order-item-name" style="font-size: 13px;">${escapeHtml(item.name || "")}</div>
              ${
                item.variantName
                  ? `<div class="order-item-variant" style="font-size: 11.5px; color: #15803d; font-weight: 600;">Phân loại: ${escapeHtml(item.variantName)}</div>`
                  : ""
              }
              <div class="order-item-meta" style="font-size: 12px;">Số lượng: x${item.quantity || 1} · ${formatCurrency(
              item.unitPrice || item.price || 0
            )}</div>
              ${reviewActionHtml}
            </div>
            <div class="order-item-price" style="font-size: 13px;">${formatCurrency(
              (item.unitPrice || item.price || 0) * (item.quantity || 1)
            )}</div>
          </div>
        `;
          })
          .join("")}
      </div>

      <!-- Bảng tính tiền -->
      <div class="modal-bill-table">
        <div class="modal-bill-row">
          <span>Tạm tính</span>
          <span>${formatCurrency(subtotal)}</span>
        </div>
        ${
          discount > 0
            ? `
          <div class="modal-bill-row" style="color: var(--co-primary);">
            <span>Giảm giá khuyến mãi (${escapeHtml(order.couponCode || "VOUCHER")})</span>
            <span>-${formatCurrency(discount)}</span>
          </div>
        `
            : ""
        }
        <div class="modal-bill-row">
          <span>Phí vận chuyển</span>
          <span>${shippingFee === 0 ? "Miễn phí" : formatCurrency(shippingFee)}</span>
        </div>
        <div class="modal-bill-row total">
          <span>Tổng tiền thanh toán</span>
          <span>${formatCurrency(total)}</span>
        </div>
      </div>
    </div>

    <!-- Thanh thao tác và Liên hệ hỗ trợ -->
    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--co-line); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
      <button type="button" class="btn-support-contact" id="modalSupportContactBtn" style="display:inline-flex; align-items:center; gap:6px;">
        ${renderIcon("phone-call", { size: 14, strokeWidth: 2 })} Liên hệ hỗ trợ đơn hàng
      </button>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        ${
          isPending
            ? `
          <button type="button" class="btn-edit-order" id="modalBottomEditBtn" style="display:inline-flex; align-items:center; gap:4px;">${renderIcon("edit-2", { size: 13, strokeWidth: 2 })} Đổi thông tin</button>
          <button type="button" class="btn-cancel-order" id="modalBottomCancelBtn">Hủy đơn</button>
        `
            : ""
        }
        ${
          isCompleted
            ? `
          <button type="button" class="btn-reorder" id="modalBottomReorderBtn" data-order-id="${order.id}" style="display:inline-flex; align-items:center; gap:4px;">
            ${renderIcon("rotate-ccw", { size: 13, strokeWidth: 2 })} Mua lại đơn hàng
          </button>
        `
            : ""
        }
      </div>
    </div>
  `;

  // Wire buttons inside detail modal
  const supportBtn = document.getElementById("modalSupportContactBtn");
  if (supportBtn) {
    supportBtn.onclick = () => {
      openSupportModal(order);
    };
  }

  const detailEditBtn = document.getElementById("modalDetailEditBtn");
  if (detailEditBtn) {
    detailEditBtn.onclick = () => {
      closeModal(detailModal);
      openEditOrderModal(order);
    };
  }
  const modalBottomEditBtn = document.getElementById("modalBottomEditBtn");
  if (modalBottomEditBtn) {
    modalBottomEditBtn.onclick = () => {
      closeModal(detailModal);
      openEditOrderModal(order);
    };
  }

  const detailCancelBtn = document.getElementById("modalDetailCancelBtn");
  if (detailCancelBtn) {
    detailCancelBtn.onclick = () => {
      closeModal(detailModal);
      openCancelOrderModal(order);
    };
  }
  const modalBottomCancelBtn = document.getElementById("modalBottomCancelBtn");
  if (modalBottomCancelBtn) {
    modalBottomCancelBtn.onclick = () => {
      closeModal(detailModal);
      openCancelOrderModal(order);
    };
  }

  const detailReorderBtn = document.getElementById("modalDetailReorderBtn");
  if (detailReorderBtn) {
    detailReorderBtn.onclick = () => {
      closeModal(detailModal);
      handleReorder(order);
    };
  }
  const modalBottomReorderBtn = document.getElementById("modalBottomReorderBtn");
  if (modalBottomReorderBtn) {
    modalBottomReorderBtn.onclick = () => {
      closeModal(detailModal);
      handleReorder(order);
    };
  }

  const checkPayBtn = document.getElementById("customerCheckPaymentBtn");
  if (checkPayBtn) {
    checkPayBtn.onclick = async () => {
      checkPayBtn.disabled = true;
      checkPayBtn.textContent = "Đang kiểm tra...";
      const msgEl = document.getElementById("customerSepaySyncMsg");
      try {
        const syncRes = await triggerSepayBackendSync();
        const latest = await fetchOrderById(order.id);
        if (latest) {
          allUserOrders = getOrdersByUser(session);
          updateStats(allUserOrders);
          renderOrders();
          if (getOrderPaymentStatusInfo(latest).isPaid) {
            showToast("Đã xác nhận thanh toán thành công qua SePay!");
            showOrderDetail(latest);
            return;
          }
          if (getOrderPaymentStatusInfo(latest).code !== payInfo.code) {
            showOrderDetail(latest);
            return;
          }
        }
        if (msgEl && syncRes?.message) {
          msgEl.textContent = syncRes.message;
        }
        showToast(
          syncRes?.status === "RATE_LIMITED"
            ? `Vui lòng thử lại sau ${syncRes.retryAfterSeconds || 30} giây.`
            : "Chưa ghi nhận giao dịch khớp đơn hàng này."
        );
      } finally {
        checkPayBtn.disabled = false;
        checkPayBtn.textContent = "Kiểm tra thanh toán";
      }
    };
  }

  initIcons(detailModal);
  openModal(detailModal);

  if (options.focusPayment) {
    const qrCard = document.getElementById("modalSepayQrCard");
    if (qrCard) {
      window.setTimeout(() => qrCard.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
    }
  }

  if (isPendingQR) {
    startCustomerPaymentPolling(order.id);
  } else {
    stopCustomerPaymentPolling();
  }
}

function startCustomerPaymentPolling(orderId) {
  stopCustomerPaymentPolling();
  activeDetailOrderId = orderId;
  let ticks = 0;
  customerPaymentPollTimer = setInterval(async () => {
    if (!detailModal || !detailModal.classList.contains("open") || String(activeDetailOrderId) !== String(orderId)) {
      stopCustomerPaymentPolling();
      return;
    }
    ticks += 1;
    if (ticks % 3 === 1) {
      await triggerSepayBackendSync();
    }
    const latest = await fetchOrderById(orderId);
    if (!latest) return;
    allUserOrders = getOrdersByUser(session);
    updateStats(allUserOrders);
    renderOrders();
    const info = getOrderPaymentStatusInfo(latest);
    const latestCancelled = (latest.status || "").trim().toLowerCase() === "đã hủy";
    if (info.isPaid || latestCancelled) {
      stopCustomerPaymentPolling();
      if (info.isPaid) {
        showToast("Đã xác nhận thanh toán chuyển khoản qua SePay!");
      }
      showOrderDetail(latest);
    }
  }, 5000);
}

// ============================================================================
// CHỨC NĂNG THAY ĐỔI THÔNG TIN ĐƠN HÀNG
// ============================================================================
function openEditOrderModal(order) {
  // Fresh status check
  const freshOrders = getOrders();
  const fresh = freshOrders.find((o) => String(o.id) === String(order.id)) || order;
  if (fresh.status !== "Chờ xác nhận") {
    showToast(
      `Đơn hàng #${order.id} hiện ở trạng thái "${fresh.status}", không thể chỉnh sửa thông tin online.`,
      "error"
    );
    return;
  }

  if (editOrderId) editOrderId.value = order.id;
  if (editCustomerName) editCustomerName.value = order.customerName || session.name || "";
  if (editCustomerPhone) editCustomerPhone.value = order.customerPhone || session.phone || "";
  if (editShippingAddress) editShippingAddress.value = order.shippingAddress || session.address || "";
  if (editNote) editNote.value = order.note || "";

  openModal(editModal);
}

if (editForm) {
  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const orderId = editOrderId.value;
    const customerName = editCustomerName.value.trim();
    const customerPhone = editCustomerPhone.value.trim();
    const shippingAddress = editShippingAddress.value.trim();
    const note = editNote.value.trim();

    if (!customerName) {
      alert("Vui lòng nhập họ và tên người nhận hàng.");
      editCustomerName.focus();
      return;
    }

    // Validate Vietnamese Phone number (10 digits starting with 03, 05, 07, 08, 09 or standard)
    const phoneRegex = /^(0|\+84)[3|5|7|8|9][0-9]{8}$/;
    if (!phoneRegex.test(customerPhone.replace(/\s+/g, ""))) {
      alert("Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại di động 10 chữ số (VD: 0901234567).");
      editCustomerPhone.focus();
      return;
    }

    if (shippingAddress.length < 5) {
      alert("Vui lòng nhập địa chỉ nhận hàng chi tiết và đầy đủ.");
      editShippingAddress.focus();
      return;
    }

    // Fresh verification before committing changes
    const freshOrders = getOrders();
    const currentOrder = freshOrders.find((o) => String(o.id) === String(orderId));
    if (!currentOrder || currentOrder.status !== "Chờ xác nhận") {
      alert(
        `Đơn hàng #${orderId} đã được xử lý sang trạng thái "${
          currentOrder ? currentOrder.status : "không khả dụng"
        }", không thể chỉnh sửa trực tuyến. Vui lòng liên hệ Hotline 1900 1234.`
      );
      closeModal(editModal);
      await refreshData();
      return;
    }

    saveEditBtn.disabled = true;
    saveEditBtn.textContent = "Đang lưu...";

    try {
      await updateOrderShippingInfo(orderId, {
        customerName,
        customerPhone,
        shippingAddress,
        note
      });

      closeModal(editModal);
      await refreshData();
      showToast(`Đã cập nhật thông tin nhận hàng đơn #${orderId} thành công!`);
    } catch (err) {
      console.error("Lỗi cập nhật đơn:", err);
      showToast("Có lỗi xảy ra khi lưu thông tin. Vui lòng thử lại.", "error");
    } finally {
      saveEditBtn.disabled = false;
      saveEditBtn.textContent = "Lưu thay đổi";
    }
  });
}

// ============================================================================
// CHỨC NĂNG HỦY ĐƠN HÀNG
// ============================================================================
function openCancelOrderModal(order) {
  // Fresh status check
  const freshOrders = getOrders();
  const fresh = freshOrders.find((o) => String(o.id) === String(order.id)) || order;
  const freshStatus = String(fresh.status || "").trim();
  const freshCancelReq = String(fresh.cancelRequestStatus || "").trim().toUpperCase();
  if (isOrderCompleted(freshStatus) || freshStatus.toLowerCase() === "đã hủy") {
    showToast(`Đơn hàng #${order.id} hiện ở trạng thái "${freshStatus}", không thể gửi yêu cầu hủy.`, "error");
    return;
  }
  if (freshCancelReq === "PENDING") {
    showToast(`Đơn hàng #${order.id} đang có yêu cầu hủy chờ nhân viên duyệt.`, "info");
    return;
  }

  currentPendingCancelOrder = fresh;
  const items = parseOrderItems(fresh);
  const totalAmount = Number(fresh.total || 0);
  const dateStr = fresh.createdAt
    ? new Date(fresh.createdAt).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" })
    : "Vừa xong";

  if (cancelSummaryContainer) {
    cancelSummaryContainer.innerHTML = `
      <div class="cancel-summary-row">
        <span>Mã đơn hàng:</span>
        <strong>#${fresh.id}</strong>
      </div>
      <div class="cancel-summary-row">
        <span>Thời gian đặt:</span>
        <span>${dateStr}</span>
      </div>
      <div class="cancel-summary-row">
        <span>Tổng số tiền:</span>
        <strong style="color: var(--co-primary); font-size: 15px;">${formatCurrency(totalAmount)}</strong>
      </div>
      <div class="cancel-summary-items">
        <strong>Sản phẩm trong đơn (${items.length}):</strong>
        ${items
          .map((i) => `<div>• ${i.name} (x${i.quantity || 1})${i.variantName ? ` - [${i.variantName}]` : ""}</div>`)
          .join("")}
      </div>
    `;
  }

  // Reset radio choices
  cancelRadios.forEach((r, idx) => {
    r.checked = idx === 0;
    r.closest(".reason-radio-label")?.classList.toggle("selected", idx === 0);
  });
  if (cancelOtherReasonGroup) cancelOtherReasonGroup.style.display = "none";
  if (cancelCustomReason) cancelCustomReason.value = "";

  openModal(cancelModal);
}

if (confirmCancelBtn) {
  confirmCancelBtn.addEventListener("click", async () => {
    if (!currentPendingCancelOrder) return;
    const orderId = currentPendingCancelOrder.id;

    // Fresh verification before cancellation request
    const freshOrders = getOrders();
    const fresh = freshOrders.find((o) => String(o.id) === String(orderId));
    const freshStatus = fresh ? String(fresh.status || "").trim() : "";
    const freshCancelReq = fresh ? String(fresh.cancelRequestStatus || "").trim().toUpperCase() : "";
    if (!fresh || isOrderCompleted(freshStatus) || freshStatus.toLowerCase() === "đã hủy" || freshCancelReq === "PENDING") {
      showToast(
        freshCancelReq === "PENDING"
          ? "Đơn hàng này đang có yêu cầu hủy chờ duyệt."
          : `Đơn hàng #${orderId} hiện ở trạng thái "${fresh ? fresh.status : "không khả dụng"}" nên không thể gửi yêu cầu hủy.`,
        "error"
      );
      closeModal(cancelModal);
      await refreshData();
      return;
    }

    const selectedRadio = document.querySelector("input[name='cancelReasonRadio']:checked");
    let reasonText = selectedRadio ? selectedRadio.value : "Không có lý do";

    if (reasonText === "Lý do khác") {
      const customVal = cancelCustomReason ? cancelCustomReason.value.trim() : "";
      if (!customVal) {
        alert("Vui lòng ghi rõ lý do bạn muốn hủy đơn hàng.");
        if (cancelCustomReason) cancelCustomReason.focus();
        return;
      }
      reasonText = `Lý do khác: ${customVal}`;
    }

    confirmCancelBtn.disabled = true;
    confirmCancelBtn.textContent = "Đang gửi...";

    try {
      await requestOrderCancel(orderId, reasonText);
      closeModal(cancelModal);
      await refreshData();
      showToast(`Đã gửi yêu cầu hủy đơn #${orderId}. Đang chờ nhân viên xử lý.`);
    } catch (err) {
      console.error("Lỗi khi gửi yêu cầu hủy đơn:", err);
      showToast(err?.message || "Không thể gửi yêu cầu hủy đơn. Vui lòng thử lại.", "error");
    } finally {
      confirmCancelBtn.disabled = false;
      confirmCancelBtn.textContent = "Gửi yêu cầu hủy";
      currentPendingCancelOrder = null;
    }
  });
}

// ============================================================================
// CHỨC NĂNG MUA LẠI
// ============================================================================
function handleReorder(order) {
  // 1. Kiểm tra trạng thái đơn: chỉ cho phép mua lại khi đơn đã hoàn tất / giao thành công
  if (!isOrderCompleted(order.status)) {
    showToast(
      `Đơn hàng #${order.id} đang ở trạng thái "${order.status}". Chức năng Mua lại chỉ áp dụng cho đơn hàng đã hoàn tất thành công.`,
      "warning"
    );
    return;
  }

  const items = parseOrderItems(order);
  if (!items || items.length === 0) {
    showToast("Đơn hàng không có sản phẩm nào để mua lại.", "warning");
    return;
  }

  let addedCount = 0;
  const unavailableList = [];
  const partialList = [];

  for (const item of items) {
    const pId = item.productId || item.id;
    if (!pId) {
      unavailableList.push(item.name || "Sản phẩm không rõ mã");
      continue;
    }

    const product = findProduct(pId);
    if (!product) {
      unavailableList.push(`"${item.name}" (Sản phẩm không còn kinh doanh)`);
      continue;
    }

    if (product.status === "Ngừng kinh doanh") {
      unavailableList.push(`"${item.name}" (Đã ngừng kinh doanh)`);
      continue;
    }

    // A. Nếu đơn cũ có chọn biến thể cụ thể
    if (item.variantId && Array.isArray(product.variants) && product.variants.length > 0) {
      const v = product.variants.find(
        (varItem) => String(varItem.id) === String(item.variantId) || String(varItem.sku) === String(item.variantId)
      );

      if (!v) {
        unavailableList.push(`"${item.name}${item.variantName ? ` - ${item.variantName}` : ""}" (Phiên bản này không còn mở bán)`);
        continue;
      }

      const vStock = Math.max(0, Number(v.stock) || 0);
      if (vStock <= 0 || v.status === "Tạm hết hàng" || v.status === "Hết hàng") {
        unavailableList.push(`"${item.name} (${v.name || item.variantName})": Tạm hết hàng`);
        continue;
      }

      const requestedQty = Math.max(1, Number(item.quantity) || 1);
      const qtyToAdd = Math.min(requestedQty, vStock);

      try {
        addToCart(
          product.id,
          qtyToAdd,
          v.id,
          v.options || null,
          v.name || item.variantName,
          v.price != null ? Number(v.price) : (item.unitPrice || item.price),
          v.image || item.image || product.image
        );
        addedCount++;
        if (qtyToAdd < requestedQty) {
          partialList.push(`"${item.name} (${v.name})": chỉ thêm ${qtyToAdd}/${requestedQty} chiếc do tồn kho có hạn`);
        }
      } catch (err) {
        unavailableList.push(`"${item.name} (${v.name})": ${err.message}`);
      }
    } else {
      // B. Sản phẩm không có biến thể hoặc biến thể chung
      if (Array.isArray(product.variants) && product.variants.length > 0) {
        // Sản phẩm đã được nâng cấp lên có nhiều biến thể sau này: chọn biến thể còn hàng đầu tiên
        const availableVar = product.variants.find((v) => (Number(v.stock) || 0) > 0);
        if (!availableVar) {
          unavailableList.push(`"${item.name}": Tạm hết hàng`);
          continue;
        }

        const requestedQty = Math.max(1, Number(item.quantity) || 1);
        const vStock = Math.max(0, Number(availableVar.stock) || 0);
        const qtyToAdd = Math.min(requestedQty, vStock);

        try {
          addToCart(
            product.id,
            qtyToAdd,
            availableVar.id,
            availableVar.options || null,
            availableVar.name,
            availableVar.price != null ? Number(availableVar.price) : product.price,
            availableVar.image || product.image
          );
          addedCount++;
          if (qtyToAdd < requestedQty) {
            partialList.push(`"${item.name}": chỉ thêm ${qtyToAdd}/${requestedQty} chiếc do tồn kho có hạn`);
          }
        } catch (err) {
          unavailableList.push(`"${item.name}": ${err.message}`);
        }
      } else {
        // Sản phẩm đơn thông thường
        const pStock = Math.max(0, Number(product.stock) || 0);
        if (pStock <= 0 || product.status === "Hết hàng" || product.status === "Tạm hết hàng") {
          unavailableList.push(`"${item.name}": Tạm hết hàng`);
          continue;
        }

        const requestedQty = Math.max(1, Number(item.quantity) || 1);
        const qtyToAdd = Math.min(requestedQty, pStock);

        try {
          addToCart(
            product.id,
            qtyToAdd,
            null,
            null,
            null,
            item.unitPrice || item.price || product.price,
            product.image || item.image
          );
          addedCount++;
          if (qtyToAdd < requestedQty) {
            partialList.push(`"${item.name}": chỉ thêm ${qtyToAdd}/${requestedQty} chiếc do tồn kho có hạn`);
          }
        } catch (err) {
          unavailableList.push(`"${item.name}": ${err.message}`);
        }
      }
    }
  }

  // Thông báo kết quả cho khách hàng
  if (addedCount > 0) {
    if (unavailableList.length === 0 && partialList.length === 0) {
      showToast(`Đã thêm lại toàn bộ ${addedCount} sản phẩm từ đơn #${order.id} vào giỏ hàng!`);
      setTimeout(() => {
        window.location.href = "./cart.html";
      }, 600);
    } else {
      const details = [];
      if (unavailableList.length > 0) {
        details.push(`Không thể mua lại: ${unavailableList.join(", ")}`);
      }
      if (partialList.length > 0) {
        details.push(partialList.join("; "));
      }
      showToast(`Đã thêm ${addedCount} sản phẩm vào giỏ hàng. ${details.join(". ")}`, "warning");
      setTimeout(() => {
        window.location.href = "./cart.html";
      }, 1500);
    }
  } else {
    const reasonText = unavailableList.length > 0 ? unavailableList.join(", ") : "Các sản phẩm trong đơn hiện đã hết hàng hoặc ngừng kinh doanh";
    showToast(`Không thể mua lại đơn #${order.id}: ${reasonText}.`, "error");
  }
}

// Filter Tab events
filterTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    filterTabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    activeFilter = tab.dataset.status;
    renderOrders();
  });
});

// Refresh Data helper
async function refreshData() {
  if (session) {
    await fetchUserOrders(session.id);
    allUserOrders = getOrdersByUser(session);
    updateStats(allUserOrders);
  }
  renderOrders();
}

// Initial Load
async function load() {
  if (session) {
    if (greeting)
      greeting.textContent = `Xin chào ${session.name}, đây là lịch sử các đơn hàng của bạn tại EcoDesk.`;
    await refreshData();
  } else {
    renderOrders();
  }
}

load();
