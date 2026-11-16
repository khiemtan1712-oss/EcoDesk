/**
 * EcoDesk Real-time Customer & Staff Support Chat
 * Lưu trữ tập trung qua máy chủ file /api-chat (chat_threads.json)
 * Hỗ trợ chọn đơn hàng liên quan, phân loại trạng thái hội thoại và bảo vệ XSS
 */

import { getCurrentUser, getOrdersByUser } from "./storage.js";
import { showToast, buildAuthUrl, storeAuthRedirectState } from "./utils.js";
import { hasPermission, PERMISSIONS } from "./permissions.js";
import { renderIcon } from "./icons.js";

const CHAT_STORAGE_KEY = "ecodesk_chat_threads";
const CHAT_SYNC_EVENT = "ecodesk_chat_synced";

/**
 * Thoát ký tự HTML chống XSS
 */
export function sanitizeText(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Đọc danh sách hội thoại từ bộ nhớ cục bộ
 * @returns {Array}
 */
export function getLocalChatThreads() {
  try {
    const data = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Lưu danh sách hội thoại vào local & đồng bộ lên file chung máy chủ
 * @param {Array} threads 
 */
export async function saveChatThreads(threads) {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(threads));
    await fetch("/api-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(threads)
    }).catch(() => {});
  } catch {}
}

/**
 * Đồng bộ dữ liệu hội thoại từ máy chủ file
 * @returns {Promise<Array>}
 */
export async function syncChatThreadsFromDisk() {
  try {
    const res = await fetch("/api-chat");
    if (res.ok) {
      const diskData = await res.json();
      if (Array.isArray(diskData)) {
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(diskData));
        window.dispatchEvent(new CustomEvent(CHAT_SYNC_EVENT, { detail: { threads: diskData } }));
        return diskData;
      }
    }
  } catch {}
  return getLocalChatThreads();
}

/**
 * Lấy hoặc tạo mới luồng hội thoại cho khách hàng
 * @param {Object} customerUser 
 * @param {string} [orderId]
 * @returns {Promise<Object>}
 */
export async function getOrCreateCustomerThread(customerUser, orderId = null) {
  if (!customerUser || !customerUser.id) throw new Error("Vui lòng đăng nhập để bắt đầu hội thoại hỗ trợ.");

  const threads = await syncChatThreadsFromDisk();
  let thread = threads.find((t) => String(t.customerId) === String(customerUser.id));

  if (!thread) {
    const nowIso = new Date().toISOString();
    thread = {
      id: `CHAT_${customerUser.id}`,
      customerId: String(customerUser.id),
      customerName: customerUser.name || "Khách hàng",
      customerEmail: customerUser.email || "",
      customerPhone: customerUser.phone || "",
      orderId: orderId || null,
      status: "open", // 'open' | 'in_progress' | 'resolved'
      assignedStaffId: null,
      assignedStaffName: null,
      createdAt: nowIso,
      updatedAt: nowIso,
      unreadCustomerCount: 0,
      unreadStaffCount: 0,
      messages: [
        {
          id: `MSG_INIT_${Date.now()}`,
          senderId: "SYSTEM",
          senderName: "EcoDesk Studio",
          senderRole: "system",
          text: "Xin chào quý khách! Đội ngũ tư vấn EcoDesk luôn sẵn sàng hỗ trợ thông tin sản phẩm, đơn hàng và chính sách bảo hành.",
          createdAt: nowIso,
          isRead: true
        }
      ]
    };
    threads.unshift(thread);
    await saveChatThreads(threads);
  } else if (orderId && !thread.orderId) {
    thread.orderId = orderId;
    await saveChatThreads(threads);
  }

  return thread;
}

/**
 * Gửi tin nhắn trong hội thoại
 * @param {Object} params
 */
export async function sendChatMessage({ threadId, senderUser, text, orderId = null }) {
  if (!senderUser) throw new Error("Chưa xác thực người gửi tin nhắn.");
  const cleanText = String(text || "").trim();
  if (!cleanText) throw new Error("Nội dung tin nhắn không được để trống.");
  if (cleanText.length > 1000) throw new Error("Tin nhắn quá dài (tối đa 1000 ký tự).");

  // Kiểm tra quyền nhân viên nếu người gửi là staff
  if (senderUser.role === "staff" && !hasPermission(senderUser, PERMISSIONS.CHAT_SUPPORT)) {
    throw new Error("Tài khoản nhân viên của bạn chưa được cấp quyền hỗ trợ Chat.");
  }

  const threads = await syncChatThreadsFromDisk();
  let thread = threads.find((t) => String(t.id) === String(threadId));

  if (!thread && senderUser.role === "customer") {
    thread = await getOrCreateCustomerThread(senderUser, orderId);
  }

  if (!thread) throw new Error("Không tìm thấy cuộc hội thoại.");

  const nowIso = new Date().toISOString();
  const isCustomer = senderUser.role === "customer";

  const newMsg = {
    id: `MSG_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    senderId: String(senderUser.id),
    senderName: senderUser.name || (isCustomer ? "Khách hàng" : "Nhân viên EcoDesk"),
    senderRole: senderUser.role || "customer",
    text: cleanText,
    createdAt: nowIso,
    isRead: false
  };

  thread.messages.push(newMsg);
  thread.updatedAt = nowIso;
  if (orderId) thread.orderId = orderId;

  // Cập nhật số lượng chưa đọc & trạng thái
  if (isCustomer) {
    thread.unreadStaffCount = (thread.unreadStaffCount || 0) + 1;
    if (thread.status === "resolved") thread.status = "open"; // Mở lại hội thoại khi khách nhắn tiếp
  } else {
    thread.unreadCustomerCount = (thread.unreadCustomerCount || 0) + 1;
    if (thread.status === "open") thread.status = "in_progress";
    if (!thread.assignedStaffId) {
      thread.assignedStaffId = String(senderUser.id);
      thread.assignedStaffName = senderUser.name;
    }
  }

  await saveChatThreads(threads);
  window.dispatchEvent(new CustomEvent(CHAT_SYNC_EVENT, { detail: { threadId: thread.id, message: newMsg } }));
  return newMsg;
}

/**
 * Cập nhật trạng thái hội thoại (Dành cho nhân viên / Quản trị viên)
 * @param {string} threadId 
 * @param {string} newStatus ('open' | 'in_progress' | 'resolved')
 * @param {Object} staffUser 
 */
export async function updateChatThreadStatus(threadId, newStatus, staffUser) {
  if (!staffUser || (staffUser.role !== "admin" && !hasPermission(staffUser, PERMISSIONS.CHAT_SUPPORT))) {
    throw new Error("Bạn không có quyền cập nhật trạng thái cuộc hội thoại.");
  }

  const threads = await syncChatThreadsFromDisk();
  const thread = threads.find((t) => String(t.id) === String(threadId));
  if (!thread) throw new Error("Không tìm thấy hội thoại.");

  thread.status = newStatus;
  thread.updatedAt = new Date().toISOString();
  if (staffUser && !thread.assignedStaffId) {
    thread.assignedStaffId = String(staffUser.id);
    thread.assignedStaffName = staffUser.name;
  }

  await saveChatThreads(threads);
  window.dispatchEvent(new CustomEvent(CHAT_SYNC_EVENT, { detail: { threadId: thread.id, status: newStatus } }));
  return thread;
}

/**
 * Đánh dấu tin nhắn trong hội thoại là đã đọc
 * @param {string} threadId 
 * @param {string} readerRole ('customer' | 'staff')
 */
export async function markChatThreadRead(threadId, readerRole = "customer") {
  const threads = await syncChatThreadsFromDisk();
  const thread = threads.find((t) => String(t.id) === String(threadId));
  if (!thread) return;

  if (readerRole === "customer") {
    thread.unreadCustomerCount = 0;
  } else {
    thread.unreadStaffCount = 0;
  }

  thread.messages.forEach((m) => {
    if (readerRole === "customer" && m.senderRole !== "customer") m.isRead = true;
    if (readerRole === "staff" && m.senderRole === "customer") m.isRead = true;
  });

  await saveChatThreads(threads);
}

/**
 * Khởi tạo Widget Chat nổi cho khách hàng trên các trang
 */
export function initCustomerChatWidget() {
  // Chỉ hiển thị trên giao diện người dùng (không hiển thị trong admin)
  if (window.location.pathname.includes("admin.html")) return;

  // Tạo khung widget nếu chưa có
  if (document.getElementById("ecodeskChatWidget")) return;

  const widget = document.createElement("div");
  widget.id = "ecodeskChatWidget";
  widget.className = "chat-widget-root";
  widget.innerHTML = `
    <!-- Nút mở chat tròn nổi -->
    <button type="button" class="chat-launcher-btn" id="chatLauncherBtn" aria-label="Hỏi EcoDesk" title="Hỏi EcoDesk" aria-expanded="false" aria-controls="chatWindowBox" style="display:flex; align-items:center; justify-content:center;">
      ${renderIcon("message-circle", { size: 24, strokeWidth: 2 })}
      <span class="chat-launcher-badge" id="chatLauncherBadge" style="display:none">1</span>
    </button>

    <!-- Hộp thoại chat -->
    <div class="chat-window-box" id="chatWindowBox" hidden>
      <div class="chat-window-header">
        <div class="chat-header-info">
          <div class="chat-header-avatar">E</div>
          <div>
            <div class="chat-header-title">Hỗ trợ trực tuyến EcoDesk</div>
            <div class="chat-header-status"><span class="chat-online-dot"></span> Đang trực tuyến · Phản hồi nhanh</div>
          </div>
        </div>
        <button type="button" class="chat-close-btn" id="chatCloseBtn" aria-label="Đóng cửa sổ chat">${renderIcon("x", { size: 18, strokeWidth: 2 })}</button>
      </div>

      <!-- Chọn đơn hàng cần hỗ trợ (Tùy chọn) -->
      <div class="chat-order-selector-wrap" id="chatOrderSelectorWrap">
        <label for="chatOrderSelect">Hỗ trợ đơn hàng:</label>
        <select id="chatOrderSelect" class="chat-order-select">
          <option value="">-- Tư vấn chung / Chưa có đơn --</option>
        </select>
      </div>

      <!-- Khung hiển thị tin nhắn -->
      <div class="chat-messages-container" id="chatMessagesContainer">
        <!-- Rendered dynamically -->
      </div>

      <!-- Khung nhập tin nhắn -->
      <form class="chat-input-bar" id="chatInputForm">
        <input type="text" id="chatTextInput" class="chat-text-input" placeholder="Nhập câu hỏi của bạn..." maxlength="1000" autocomplete="off" required>
        <button type="submit" class="chat-send-btn" id="chatSendBtn" aria-label="Gửi tin nhắn" style="display:flex; align-items:center; justify-content:center;">
          ${renderIcon("send", { size: 16, strokeWidth: 2 })}
        </button>
      </form>
    </div>
  `;

  document.body.appendChild(widget);

  const launcherBtn = document.getElementById("chatLauncherBtn");
  const windowBox = document.getElementById("chatWindowBox");
  const closeBtn = document.getElementById("chatCloseBtn");
  const inputForm = document.getElementById("chatInputForm");
  const textInput = document.getElementById("chatTextInput");
  const orderSelect = document.getElementById("chatOrderSelect");
  const messagesBox = document.getElementById("chatMessagesContainer");
  const badgeEl = document.getElementById("chatLauncherBadge");

  let activeThread = null;
  let pollInterval = null;

  async function refreshChatMessages() {
    const user = getCurrentUser();
    if (!user) {
      const chatLoginHref = buildAuthUrl("./login.html", {
        next: `${window.location.pathname}${window.location.search}${window.location.hash}`
      });
      messagesBox.innerHTML = `
        <div class="chat-guest-prompt">
          <div style="display:flex; justify-content:center; color:#94a3b8; margin-bottom: 8px;">${renderIcon("message-circle", { size: 36, strokeWidth: 1.5 })}</div>
          <p style="font-weight: 700; color: #1e293b; margin-bottom: 6px;">Chào mừng bạn đến với EcoDesk!</p>
          <p style="font-size: 13px; color: #64748b; margin-bottom: 16px;">Vui lòng đăng nhập để nhân viên hỗ trợ có thể đồng bộ thông tin đơn hàng và phản hồi trực tiếp cho bạn.</p>
          <a href="${sanitizeText(chatLoginHref)}" data-chat-login-link class="btn" style="padding: 8px 18px; font-size: 13px; text-decoration: none;">Đăng nhập để chat</a>
        </div>
      `;
      messagesBox.querySelector("[data-chat-login-link]")?.addEventListener("click", () => {
        storeAuthRedirectState({
          next: `${window.location.pathname}${window.location.search}${window.location.hash}`,
          notice: "Vui lòng đăng nhập để bắt đầu trò chuyện cùng nhân viên hỗ trợ EcoDesk."
        });
      });
      inputForm.style.display = "none";
      return;
    }

    inputForm.style.display = "flex";
    try {
      activeThread = await getOrCreateCustomerThread(user, orderSelect.value || null);
      await markChatThreadRead(activeThread.id, "customer");

      // Cập nhật selector đơn hàng
      const userOrders = getOrdersByUser(user);
      if (userOrders.length > 0 && orderSelect.options.length <= 1) {
        userOrders.forEach((o) => {
          const opt = document.createElement("option");
          opt.value = o.id;
          opt.textContent = `Đơn #${o.id} (${o.status}) - ${new Date(o.createdAt).toLocaleDateString("vi-VN")}`;
          if (activeThread.orderId === o.id) opt.selected = true;
          orderSelect.appendChild(opt);
        });
      }

      // Render tin nhắn
      messagesBox.innerHTML = activeThread.messages.map((m) => {
        const isMe = String(m.senderId) === String(user.id);
        const isSys = m.senderRole === "system";
        const timeStr = m.createdAt ? new Date(m.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "";

        if (isSys) {
          return `
            <div class="chat-msg-system">
              <span>${sanitizeText(m.text)}</span>
            </div>
          `;
        }

        return `
          <div class="chat-msg-row ${isMe ? "outgoing" : "incoming"}">
            <div class="chat-bubble">
              ${!isMe ? `<div class="chat-sender-name">${sanitizeText(m.senderName)}</div>` : ""}
              <div class="chat-bubble-text">${sanitizeText(m.text)}</div>
              <div class="chat-bubble-time">${timeStr}</div>
            </div>
          </div>
        `;
      }).join("");

      messagesBox.scrollTop = messagesBox.scrollHeight;
    } catch (e) {
      console.warn("Lỗi làm mới chat:", e);
    }
  }

  // Mở/Đóng cửa sổ chat
  const closeChatWindow = () => {
    windowBox.setAttribute("hidden", "");
    launcherBtn.setAttribute("aria-expanded", "false");
    clearInterval(pollInterval);
  };

  launcherBtn.addEventListener("click", () => {
    const isHidden = windowBox.hasAttribute("hidden");
    if (isHidden) {
      // Đóng trợ lý AI nếu đang mở để tránh che khuất cửa sổ chat CSKH
      const aiPanel = document.getElementById("assistantPanel");
      const aiLaunch = document.getElementById("assistantLaunchBtn");
      if (aiPanel && !aiPanel.hidden) {
        aiPanel.hidden = true;
        aiLaunch?.setAttribute("aria-expanded", "false");
      }

      windowBox.removeAttribute("hidden");
      launcherBtn.setAttribute("aria-expanded", "true");
      badgeEl.style.display = "none";
      refreshChatMessages();
      clearInterval(pollInterval);
      pollInterval = setInterval(refreshChatMessages, 4000); // Polling 4s
      setTimeout(() => textInput.focus(), 150);
    } else {
      closeChatWindow();
    }
  });

  closeBtn.addEventListener("click", () => {
    closeChatWindow();
    launcherBtn.focus();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !windowBox.hasAttribute("hidden")) {
      closeChatWindow();
      launcherBtn.focus();
    }
  });

  // Gửi tin nhắn
  inputForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = getCurrentUser();
    if (!user) return;

    const text = textInput.value.trim();
    if (!text) return;

    textInput.value = "";
    try {
      await sendChatMessage({
        threadId: activeThread ? activeThread.id : `CHAT_${user.id}`,
        senderUser: user,
        text,
        orderId: orderSelect.value || null
      });
      await refreshChatMessages();
    } catch (err) {
      showToast(err.message || "Gửi tin nhắn thất bại.");
    }
  });

  // Lắng nghe sự kiện đồng bộ
  window.addEventListener(CHAT_SYNC_EVENT, () => {
    if (!windowBox.hasAttribute("hidden")) {
      refreshChatMessages();
    } else {
      const user = getCurrentUser();
      if (user) {
        const threads = getLocalChatThreads();
        const myThread = threads.find((t) => String(t.customerId) === String(user.id));
        if (myThread && myThread.unreadCustomerCount > 0) {
          badgeEl.textContent = String(myThread.unreadCustomerCount);
          badgeEl.style.display = "inline-flex";
        }
      }
    }
  });
}

