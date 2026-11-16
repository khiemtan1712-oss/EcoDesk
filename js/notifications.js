/**
 * EcoDesk Order Status Notifications
 * Quản lý và hiển thị thông báo tiến độ đơn hàng cho khách hàng
 */

import { getCurrentUser } from "./storage.js";
import { showToast, redirectToLogin } from "./utils.js";
import { renderIcon } from "./icons.js";

const NOTIF_STORAGE_KEY = "ecodesk_notifications";
const NOTIF_EVENT = "ecodesk_notifications_updated";

/**
 * Đọc toàn bộ danh sách thông báo
 * @returns {Array}
 */
export function getAllNotificationsRaw() {
  try {
    const local = JSON.parse(localStorage.getItem(NOTIF_STORAGE_KEY) || "[]");
    return Array.isArray(local) ? local : [];
  } catch {
    return [];
  }
}

/**
 * Ghi lại danh sách thông báo và đồng bộ
 * @param {Array} list 
 */
export async function saveAllNotifications(list) {
  try {
    localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(list));
    // Đồng bộ lên file máy chủ qua endpoint Vite
    fetch("/api-notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(list)
    }).catch(() => {});
  } catch {}
}

/**
 * Đồng bộ thông báo từ máy chủ khi khởi động
 */
export async function syncNotificationsFromDisk() {
  try {
    const res = await fetch("/api-notifications");
    if (res.ok) {
      const diskData = await res.json();
      if (Array.isArray(diskData) && diskData.length > 0) {
        const local = getAllNotificationsRaw();
        const map = new Map(local.map((n) => [String(n.id), n]));
        diskData.forEach((dn) => {
          if (!map.has(String(dn.id))) map.set(String(dn.id), dn);
        });
        const merged = Array.from(map.values());
        localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(merged));
        return merged;
      }
    }
  } catch {}
  return getAllNotificationsRaw();
}

/**
 * Lấy danh sách thông báo gắn với khách hàng cụ thể
 * @param {string} [userId] 
 * @returns {Array}
 */
export function getUserNotifications(userId = getCurrentUser()?.id) {
  if (!userId) return [];
  const all = getAllNotificationsRaw();
  return all
    .filter((n) => String(n.userId) === String(userId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Đếm số lượng thông báo chưa đọc của người dùng
 * @param {string} [userId] 
 * @returns {number}
 */
export function getUnreadNotificationCount(userId = getCurrentUser()?.id) {
  if (!userId) return 0;
  return getUserNotifications(userId).filter((n) => !n.isRead).length;
}

/**
 * Tạo mới thông báo thay đổi trạng thái đơn hàng
 * @param {Object} params
 */
export async function createOrderStatusNotification({ order, oldStatus, newStatus, note = "" }) {
  if (!order || !newStatus || oldStatus === newStatus) return;

  const targetUserId = order.userId || order.customerId;
  if (!targetUserId) return; // Không có thông tin người dùng sở hữu

  const all = getAllNotificationsRaw();

  // Kiểm tra tránh tạo thông báo trùng lặp trong vòng 30 giây cho cùng 1 đơn và cùng 1 trạng thái
  const now = new Date();
  const isDuplicate = all.some((n) =>
    String(n.userId) === String(targetUserId) &&
    String(n.orderId) === String(order.id) &&
    n.newStatus === newStatus &&
    (now.getTime() - new Date(n.createdAt).getTime() < 30000)
  );

  if (isDuplicate) return;

  const notifObj = {
    id: `NOTIF_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    userId: String(targetUserId),
    orderId: String(order.id),
    oldStatus: oldStatus || "Chờ xác nhận",
    newStatus: newStatus,
    title: `Đơn hàng #${order.id} - ${newStatus}`,
    message: `Đơn hàng #${order.id} của bạn đã chuyển sang trạng thái "${newStatus}".${note ? ` Ghi chú: ${note}` : ""}`,
    createdAt: now.toISOString(),
    isRead: false
  };

  all.unshift(notifObj);
  await saveAllNotifications(all);

  window.dispatchEvent(new CustomEvent(NOTIF_EVENT, {
    detail: { userId: targetUserId, notification: notifObj, unreadCount: getUnreadNotificationCount(targetUserId) }
  }));
}

/**
 * Đánh dấu 1 thông báo là đã đọc
 * @param {string} notifId 
 * @param {string} [userId] 
 */
export async function markNotificationAsRead(notifId, userId = getCurrentUser()?.id) {
  if (!notifId || !userId) return;
  const all = getAllNotificationsRaw();
  const target = all.find((n) => String(n.id) === String(notifId) && String(n.userId) === String(userId));
  if (target && !target.isRead) {
    target.isRead = true;
    await saveAllNotifications(all);
    window.dispatchEvent(new CustomEvent(NOTIF_EVENT, {
      detail: { userId, unreadCount: getUnreadNotificationCount(userId) }
    }));
  }
}

/**
 * Đánh dấu toàn bộ thông báo của người dùng là đã đọc
 * @param {string} [userId] 
 */
export async function markAllNotificationsAsRead(userId = getCurrentUser()?.id) {
  if (!userId) return;
  const all = getAllNotificationsRaw();
  let changed = false;
  all.forEach((n) => {
    if (String(n.userId) === String(userId) && !n.isRead) {
      n.isRead = true;
      changed = true;
    }
  });

  if (changed) {
    await saveAllNotifications(all);
    window.dispatchEvent(new CustomEvent(NOTIF_EVENT, {
      detail: { userId, unreadCount: 0 }
    }));
  }
}

/**
 * Cập nhật số lượng thông báo chưa đọc trên Header Bell
 */
export function updateHeaderNotificationBadge() {
  const user = getCurrentUser();
  const count = user ? getUnreadNotificationCount(user.id) : 0;
  const badge = document.getElementById("notifCountBadge");
  if (badge) {
    badge.textContent = String(count);
    badge.style.display = count > 0 ? "inline-flex" : "none";
  }
  const drawerBadge = document.getElementById("drawerNotifCount");
  if (drawerBadge) {
    drawerBadge.textContent = String(count);
    drawerBadge.style.display = count > 0 ? "inline-flex" : "none";
  }
}

/**
 * Khởi tạo giao diện chuông thông báo & dropdown trên Header
 */
export function initNotificationHeader() {
  syncNotificationsFromDisk().then(() => updateHeaderNotificationBadge());

  window.addEventListener(NOTIF_EVENT, (e) => {
    const cur = getCurrentUser();
    if (cur && String(cur.id) === String(e.detail.userId)) {
      updateHeaderNotificationBadge();
    }
  });

  // Listener mở Dropdown thông báo
  document.addEventListener("click", (e) => {
    const bellBtn = e.target.closest("#notifBellBtn, #drawerNotifBtn");
    const dropdown = document.getElementById("notifDropdown");

    if (bellBtn) {
      e.preventDefault();
      e.stopPropagation();
      if (bellBtn.id === "drawerNotifBtn") {
        const headerInner = document.querySelector(".header-inner");
        headerInner?.classList.remove("menu-open");
        const menuToggle = headerInner?.querySelector(".mobile-menu-toggle");
        if (menuToggle) menuToggle.setAttribute("aria-expanded", "false");
      }
      const user = getCurrentUser();
      if (!user) {
        redirectToLogin({
          next: `${window.location.pathname}${window.location.search}${window.location.hash}`,
          notice: "Vui lòng đăng nhập để xem thông báo đơn hàng của bạn."
        });
        return;
      }

      if (dropdown) {
        const isOpen = dropdown.classList.contains("is-open");
        if (isOpen) {
          dropdown.classList.remove("is-open");
        } else {
          renderNotificationsList(dropdown, user.id);
          dropdown.classList.add("is-open");
        }
      }
      return;
    }

    if (dropdown && !e.target.closest("#notifDropdown")) {
      dropdown.classList.remove("is-open");
    }
  });
}

function renderNotificationsList(dropdownEl, userId) {
  const notifs = getUserNotifications(userId);
  const unreadCount = notifs.filter((n) => !n.isRead).length;

  dropdownEl.innerHTML = `
    <div class="notif-dropdown-header">
      <div class="notif-dropdown-title">
        <span>Thông báo đơn hàng</span>
        ${unreadCount > 0 ? `<span class="notif-unread-pill">${unreadCount} mới</span>` : ""}
      </div>
      ${unreadCount > 0 ? `<button type="button" class="notif-mark-all-btn" id="notifMarkAllReadBtn">Đã đọc tất cả</button>` : ""}
    </div>
    <div class="notif-dropdown-body">
      ${notifs.length === 0 ? `
        <div class="notif-empty-state">
          <div style="display: flex; justify-content: center; color: #94a3b8; margin-bottom: 6px;">${renderIcon("bell-off", { size: 36, strokeWidth: 1.5 })}</div>
          <div style="font-weight: 600; color: #475569;">Chưa có thông báo nào</div>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Khi đơn hàng đổi trạng thái, bạn sẽ nhận được thông báo tại đây.</div>
        </div>
      ` : notifs.slice(0, 15).map((n) => `
        <div class="notif-item ${!n.isRead ? "is-unread" : ""}" data-notif-id="${n.id}" data-order-id="${n.orderId}">
          <div class="notif-item-icon" style="display:flex; align-items:center; justify-content:center;">${renderIcon("package", { size: 16, strokeWidth: 2 })}</div>
          <div class="notif-item-content">
            <div class="notif-item-title">${escapeHtml(n.title)}</div>
            <div class="notif-item-msg">${escapeHtml(n.message)}</div>
            <div class="notif-item-time">${formatTimeAgo(n.createdAt)}</div>
          </div>
          ${!n.isRead ? `<span class="notif-item-dot" title="Chưa đọc"></span>` : ""}
        </div>
      `).join("")}
    </div>
    <div class="notif-dropdown-footer">
      <a href="./customer-orders.html" class="notif-view-all-link">Xem tất cả đơn hàng của bạn →</a>
    </div>
  `;

  // Gắn sự kiện đánh dấu đã đọc tất cả
  const markAllBtn = dropdownEl.querySelector("#notifMarkAllReadBtn");
  if (markAllBtn) {
    markAllBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await markAllNotificationsAsRead(userId);
      renderNotificationsList(dropdownEl, userId);
      updateHeaderNotificationBadge();
      showToast("Đã đánh dấu đọc tất cả thông báo.");
    });
  }

  // Gắn sự kiện bấm vào từng thông báo -> chuyển hướng đến chi tiết đơn
  dropdownEl.querySelectorAll(".notif-item").forEach((item) => {
    item.addEventListener("click", async () => {
      const notifId = item.dataset.notifId;
      const orderId = item.dataset.orderId;
      await markNotificationAsRead(notifId, userId);
      dropdownEl.classList.remove("is-open");
      updateHeaderNotificationBadge();
      window.location.href = `./customer-orders.html?orderId=${encodeURIComponent(orderId)}`;
    });
  });
}

function escapeHtml(text = "") {
  return String(text).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m]);
}

function formatTimeAgo(isoDate) {
  if (!isoDate) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000));
  if (diffSec < 60) return "Vừa xong";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`;
  return `${Math.floor(diffSec / 86400)} ngày trước`;
}

