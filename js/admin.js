import { initProductModal, openProductModal, closeProductModal } from "./admin-product-modal.js";
import {
  initStore,
  getProducts,
  getCategories,
  getOrders,
  getUsers,
  getCurrentUser,
  logoutUser,
  getCampaigns,
  saveCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  formatDateTimeVN,
  getCampaignScheduleStatus,
  getBanners,
  saveBanners,
  createProduct,
  updateProduct,
  deleteProduct,
  createCategory,
  updateCategory,
  deleteCategory,
  updateUserRole,
  updateOrderStatus,
  reviewOrderCancelRequest,
  confirmOrderRefund,
  fetchAllOrdersFromBackend,
  loadUsersFromDisk,
  addAuditLog,
  updateStaffPermissions,
  updateUserActiveStatus,
  refreshCurrentUserSession,
  getFinanceSummary,
  getFinanceTransactions,
  getFinanceTransactionById,
  createFinanceTransaction,
  updateFinanceTransaction,
  reconcileFinanceTransaction,
  confirmCodPayment,
  getPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  receivePurchaseOrder,
  payPurchaseOrder,
  cancelPurchaseOrder,
  getInventoryMovements,
  adjustInventoryStock,
  refreshProductsFromBackend,
  getPayrollRecords,
  createPayrollRecord,
  updatePayrollRecord,
  payPayrollRecord,
  getFinanceAuditLogs,
  normalizeProductTags,
  isOrderCompletedForSales,
  cleanMojibake
} from "./storage.js";
import { formatPrice, getCategoryName, redirectToLogin } from "./utils.js";
import { getOrderPaymentStatusInfo, triggerSepayBackendSync, fetchSepayPublicConfig } from "./sepay.js";
import { exportToExcel, readExcelFile } from "./excel-helper.js";
import { initIcons, renderIcon } from "./icons.js";
import { getNewBadgeStatus, getDiscountPromotionStatus } from "./commerce.js";
import {
  hasPermission,
  getUserEffectivePermissions,
  PERMISSIONS,
  PERMISSION_GROUPS,
  DEFAULT_STAFF_PERMISSIONS,
  DEFAULT_CASHIER_PERMISSIONS,
  CASHIER_FORBIDDEN_PERMISSIONS
} from "./permissions.js";
import {
  exportReportToPDF,
  exportOrdersListToPDF,
  exportOrderInvoiceToPDF,
  exportFinancialReportToPDF
} from "./pdf-helper.js";
import {
  syncChatThreadsFromDisk,
  getLocalChatThreads,
  sendChatMessage,
  updateChatThreadStatus,
  markChatThreadRead
} from "./chat.js";
import {
  REVIEWS_STORAGE_KEY,
  REVIEWS_EVENT,
  syncReviewsFromDisk,
  getAllReviewsList,
  canManageReviews,
  saveAdminReply,
  deleteAdminReply,
  deleteReviewByAdmin,
  deleteCommentByAdmin
} from "./reviews.js";

// Global State
let products = [];
let categories = [];
let orders = [];
let users = [];

let activeTab = "overview";
let currentTimeFilter = "all";
let orderStatusFilter = "all";
let orderSearchQuery = "";
let orderFilterStartDate = "";
let orderFilterEndDate = "";
let orderPaymentFilter = "all";
let orderSortMode = "priority"; // 'priority' | 'newest' | 'oldest' | 'total_desc' | 'total_asc'
let selectedOrderIds = new Set();
let productCategoryFilter = "all";
let productStockFilter = "all";
let productSearchQuery = "";
let inventorySearchQuery = "";
let customerRoleFilter = "all";
let customerSearchQuery = "";
let chartViewMode = "monthly"; // 'daily' | 'monthly' | 'quarterly' | 'yearly'
let chartCustomStartDate = "";
let chartCustomEndDate = "";
let chartShowCurrentSeries = true;
let chartShowPreviousSeries = true;

const escapeHtml = (val = "") =>
  String(val).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

function showToast(msg) {
  const toast = document.getElementById("adminToast");
  const text = document.getElementById("toastMessage");
  if (!toast || !text) return;
  text.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}

function formatDate(dateStr) {
  if (!dateStr) return "Chưa có dữ liệu";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString("vi-VN");
}

function formatDateTime(dateStr) {
  if (!dateStr) return "Chưa có dữ liệu";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : `${d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} · ${d.toLocaleDateString("vi-VN")}`;
}

function getStatusBadge(status) {
  if (status === "Hoàn thành") return `<span class="status-badge completed" style="display:inline-flex; align-items:center; gap:4px;">${renderIcon("check-circle-2", { size: 12, strokeWidth: 2 })} Hoàn tất</span>`;
  if (status === "Chờ xác nhận") return `<span class="status-badge pending" style="display:inline-flex; align-items:center; gap:4px;">${renderIcon("clock", { size: 12, strokeWidth: 2 })} Chờ xác nhận</span>`;
  if (status === "Đang xử lý") return `<span class="status-badge processing" style="display:inline-flex; align-items:center; gap:4px;">${renderIcon("package", { size: 12, strokeWidth: 2 })} Đang xử lý</span>`;
  if (status === "Đang giao") return `<span class="status-badge shipping" style="display:inline-flex; align-items:center; gap:4px;">${renderIcon("truck", { size: 12, strokeWidth: 2 })} Đang giao</span>`;
  if (status === "Đã hủy") return `<span class="status-badge cancelled" style="display:inline-flex; align-items:center; gap:4px;">${renderIcon("x-circle", { size: 12, strokeWidth: 2 })} Đã hủy</span>`;
  return `<span class="status-badge pending" style="display:inline-flex; align-items:center; gap:4px;">${renderIcon("clock", { size: 12, strokeWidth: 2 })} ${escapeHtml(status || "Chờ xử lý")}</span>`;
}

function getRoleLabel(role) {
  if (role === "admin") return { text: "Quản trị viên", class: "badge-admin" };
  if (role === "cashier") return { text: "Thu ngân", class: "badge-staff" };
  if (role === "staff") return { text: "Nhân viên", class: "badge-staff" };
  return { text: "Khách hàng", class: "badge-customer" };
}

/* ==========================================================================
   NAVIGATION & TABS
   ========================================================================== */
function setupNavigation() {
  document.querySelectorAll(".admin-nav .nav-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const target = link.dataset.tab;
      if (!target) return;

      if (link.id === "customersNavTrigger") {
        const dropdown = document.getElementById("customersNavDropdown");
        if (dropdown) {
          dropdown.classList.toggle("open");
        }
        setCustomerRoleFilter("all");
        switchTab("customers");
        return;
      }
      switchTab(target);
    });
  });

  // Handle Submenu Links under "Khách & Tài khoản"
  document.querySelectorAll(".nav-sublink").forEach((sublink) => {
    sublink.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const subrole = sublink.dataset.subrole || "all";
      switchTab("customers");
      setCustomerRoleFilter(subrole);
    });
  });

  document.addEventListener("click", (e) => {
    const switcher = e.target.closest("[data-switch-tab]");
    if (switcher) {
      e.preventDefault();
      switchTab(switcher.dataset.switchTab);
    }
  });

  const toggleBtn = document.getElementById("sidebarToggleBtn");
  const closeBtn = document.getElementById("sidebarCloseBtn");
  const backdrop = document.getElementById("sidebarBackdrop");

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      if (window.innerWidth <= 1024) {
        document.body.classList.toggle("sidebar-mobile-open");
      } else {
        document.body.classList.toggle("sidebar-collapsed");
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      document.body.classList.remove("sidebar-mobile-open");
    });
  }

  if (backdrop) {
    backdrop.addEventListener("click", () => {
      document.body.classList.remove("sidebar-mobile-open");
    });
  }

  const topbarUserBtn = document.getElementById("topbarUserBtn");
  const topbarDropdown = document.getElementById("topbarDropdown");
  if (topbarUserBtn && topbarDropdown) {
    topbarUserBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      topbarDropdown.classList.toggle("show");
    });

    document.addEventListener("click", () => {
      topbarDropdown.classList.remove("show");
    });
  }

  const logoutBtn = document.getElementById("adminLogoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      logoutUser();
      window.location.replace("./login.html");
    });
  }

  const globalSearch = document.getElementById("adminGlobalSearch");
  if (globalSearch) {
    globalSearch.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const query = globalSearch.value.trim().toLowerCase();
        if (!query) return;

        const matchProduct = products.some((p) => p.name.toLowerCase().includes(query));
        if (matchProduct) {
          switchTab("products");
          const prodInput = document.getElementById("productSearchInput");
          if (prodInput) {
            prodInput.value = query;
            productSearchQuery = query;
            renderProductsTable();
          }
          return;
        }

        const matchOrder = orders.some((o) => (o.id || "").toLowerCase().includes(query) || (o.customer || o.customerName || "").toLowerCase().includes(query));
        if (matchOrder) {
          switchTab("orders");
          const ordInput = document.getElementById("orderSearchInput");
          if (ordInput) {
            ordInput.value = query;
            orderSearchQuery = query;
            renderOrdersTable();
          }
          return;
        }

        switchTab("products");
        const prodInput = document.getElementById("productSearchInput");
        if (prodInput) {
          prodInput.value = query;
          productSearchQuery = query;
          renderProductsTable();
        }
      }
    });
  }

  const notifBtn = document.getElementById("adminNotifBtn");
  if (notifBtn) {
    notifBtn.addEventListener("click", () => {
      const lowStock = products.filter((p) => Number(p.stock) <= 15);
      const pendingOrders = orders.filter((o) => o.status === "Đang xử lý");
      showToast(`Hệ thống: Có ${pendingOrders.length} đơn hàng đang xử lý và ${lowStock.length} sản phẩm sắp hết hàng.`);
    });
  }
}

function switchTab(tabId) {
  activeTab = tabId;

  document.querySelectorAll(".admin-nav .nav-link").forEach((link) => {
    if (link.dataset.tab === tabId) link.classList.add("active");
    else link.classList.remove("active");
  });

  document.querySelectorAll(".admin-tab-pane").forEach((pane) => {
    pane.classList.remove("active");
  });

  const targetPane = document.getElementById(`pane-${tabId}`);
  if (targetPane) {
    targetPane.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (tabId === "reports") {
    const curUser = getCurrentUser();
    const canView = curUser && (curUser.role === "admin" || hasPermission(curUser, PERMISSIONS.REPORTS_VIEW) || hasPermission(curUser, PERMISSIONS.FINANCE_VIEW));
    if (!canView) {
      showToast("Bạn không có quyền truy cập trang Báo cáo & Phân tích chuyên sâu.", "error");
      switchTab("overview");
      return;
    }
    loadAndRenderFinanceReports().catch((err) => console.warn("Lỗi tải báo cáo tài chính:", err));
  }

  document.body.classList.remove("sidebar-mobile-open");
  initIcons();
}

function setCustomerRoleFilter(role = "all") {
  customerRoleFilter = role;

  // Cập nhật active cho các mục trong menu con bên sidebar
  document.querySelectorAll(".nav-sublink").forEach((s) => {
    if (s.dataset.subrole === role) s.classList.add("active");
    else s.classList.remove("active");
  });

  // Cập nhật badge nhãn vai trò đang xem trên bảng tài khoản
  const roleBadge = document.getElementById("currentFilterRoleBadge");
  if (roleBadge) {
    if (role === "admin") {
      roleBadge.textContent = "Quản trị viên (Admin)";
      roleBadge.className = "badge-role badge-admin";
    } else if (role === "cashier") {
      roleBadge.textContent = "Thu ngân (Cashier)";
      roleBadge.className = "badge-role badge-staff";
    } else if (role === "staff") {
      roleBadge.textContent = "Nhân viên (Staff)";
      roleBadge.className = "badge-role badge-staff";
    } else if (role === "customer") {
      roleBadge.textContent = "Khách hàng (User)";
      roleBadge.className = "badge-role badge-customer";
    } else {
      roleBadge.textContent = "Tất cả tài khoản";
      roleBadge.className = "badge-role";
    }
  }

  renderCustomersTable();
}

/* ==========================================================================
   USER PROFILE & ACCESS CONTROL
   ========================================================================== */
function renderUserInfo() {
  const currentUser = getCurrentUser();
  if (!currentUser) return;

  const initials = (currentUser.name || "A").trim()[0].toUpperCase();
  const userName = currentUser.name || "Quản trị viên";
  const userEmail = currentUser.email || "admin@ecodesk.vn";
  const roleInfo = getRoleLabel(currentUser.role);

  const sidebarAvatar = document.getElementById("sidebarUserAvatar");
  const sidebarName = document.getElementById("sidebarUserName");
  const sidebarRole = document.getElementById("sidebarUserRole");
  const topbarAvatar = document.getElementById("topbarAvatar");
  const topbarName = document.getElementById("topbarUserName");
  const dropdownName = document.getElementById("dropdownUserName");
  const dropdownEmail = document.getElementById("dropdownUserEmail");
  const greetingEl = document.getElementById("overviewGreeting");
  const dateEl = document.getElementById("overviewDate");

  if (sidebarAvatar) sidebarAvatar.textContent = initials;
  if (sidebarName) sidebarName.textContent = userName;
  if (sidebarRole) sidebarRole.textContent = roleInfo.text;
  if (topbarAvatar) topbarAvatar.textContent = initials;
  if (topbarName) topbarName.textContent = userName;
  if (dropdownName) dropdownName.textContent = userName;
  if (dropdownEmail) dropdownEmail.textContent = userEmail;

  if (greetingEl) greetingEl.textContent = `Xin chào, ${userName}!`;
  if (dateEl) {
    const now = new Date();
    const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
    dateEl.textContent = `${now.toLocaleDateString("vi-VN", options)} · Bảng điều khiển quản trị EcoDesk Studio`;
  }
}

/* ==========================================================================
   KPIS & REVENUE DASHBOARD (CONSISTENT REAL DATA)
   ========================================================================== */
function getFilteredOrders(timeFilter) {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  return orders.filter((o) => {
    if (!o.createdAt) return timeFilter === "all";
    const d = new Date(o.createdAt);
    if (isNaN(d.getTime())) return timeFilter === "all";

    if (timeFilter === "today") return d.toISOString().split("T")[0] === todayStr;
    if (timeFilter === "7days") return d >= sevenDaysAgo;
    if (timeFilter === "month") return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    return true; // "all"
  });
}

function renderKPIs(timeFilter = currentTimeFilter) {
  currentTimeFilter = timeFilter;
  const scopedOrders = getFilteredOrders(timeFilter);

  // Doanh thu thực nhận CHỈ tính từ các đơn hàng HOÀN TẤT thành công
  // Khử trùng lặp mã đơn và loại trừ đơn hủy, đơn đang xử lý, đơn chờ xác nhận
  const uniqueScopedMap = new Map();
  scopedOrders.forEach((o) => {
    if (o && o.id && !uniqueScopedMap.has(String(o.id).trim())) {
      uniqueScopedMap.set(String(o.id).trim(), o);
    }
  });
  const uniqueScopedOrders = Array.from(uniqueScopedMap.values());

  const validOrders = uniqueScopedOrders.filter((o) => o.status !== "Đã hủy");
  const completedOrders = uniqueScopedOrders.filter((o) => {
    const s = String(o.status || "").trim().toLowerCase();
    return s === "hoàn thành" || s === "hoàn tất" || s === "đã giao" || s === "giao thành công";
  });

  const totalRevenue = completedOrders.reduce((sum, o) => sum + Math.max(0, Number(o.total || 0)), 0);
  const totalOrdersCount = uniqueScopedOrders.length;
  const completionRate = totalOrdersCount > 0 ? Math.round((completedOrders.length / totalOrdersCount) * 100) : 0;
  const aov = completedOrders.length > 0 ? Math.round(totalRevenue / completedOrders.length) : 0;

  const lowStockProducts = products.filter((p) => Number(p.stock) <= 15);
  const outOfStockProducts = products.filter((p) => Number(p.stock) === 0);

  const kpiRevenue = document.getElementById("kpiRevenue");
  const kpiOrders = document.getElementById("kpiOrders");
  const kpiOrdersRate = document.getElementById("kpiOrdersRate");
  const kpiAOV = document.getElementById("kpiAOV");
  const kpiLowStock = document.getElementById("kpiLowStock");

  if (kpiRevenue) kpiRevenue.textContent = formatPrice(totalRevenue);
  if (kpiOrders) kpiOrders.textContent = totalOrdersCount;
  if (kpiOrdersRate) kpiOrdersRate.textContent = totalOrdersCount > 0 ? `${completionRate}%` : "Chưa có dữ liệu";
  if (kpiAOV) kpiAOV.textContent = validOrders.length > 0 ? formatPrice(aov) : "0 đ";
  if (kpiLowStock) kpiLowStock.textContent = lowStockProducts.length;

  const badgeOrders = document.getElementById("badgeOrdersCount");
  const badgeProducts = document.getElementById("badgeProductsCount");
  const badgeLowStock = document.getElementById("badgeLowStockCount");
  const badgeUsers = document.getElementById("badgeUsersCount");

  if (badgeOrders) badgeOrders.textContent = orders.length;
  if (badgeProducts) badgeProducts.textContent = products.length;
  if (badgeLowStock) badgeLowStock.textContent = lowStockProducts.length;
  if (badgeUsers) badgeUsers.textContent = users.length;

  const invTotalStock = document.getElementById("invTotalStock");
  const invLowStockCount = document.getElementById("invLowStockCount");
  const invOutOfStockCount = document.getElementById("invOutOfStockCount");
  const invTotalSold = document.getElementById("invTotalSold");

  const totalStockNum = products.reduce((sum, p) => sum + Number(p.stock || 0), 0);
  const totalSoldNum = products.reduce((sum, p) => sum + Number(p.sold || 0), 0);

  if (invTotalStock) invTotalStock.textContent = totalStockNum;
  if (invLowStockCount) invLowStockCount.textContent = lowStockProducts.length;
  if (invOutOfStockCount) invOutOfStockCount.textContent = outOfStockProducts.length;
  if (invTotalSold) invTotalSold.textContent = totalSoldNum;
}

/* ==========================================================================
   CHARTS (REVENUE & STATUS) - REFINED REALTIME REVENUE ANALYTICS
   ========================================================================== */

// Helper lấy ngày theo múi giờ Việt Nam (GMT+7)
function getVietnamDateParts(dateInput) {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;

  // Sử dụng Intl.DateTimeFormat để tách chính xác ngày giờ GMT+7
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "numeric",
    day: "numeric"
  });
  const parts = formatter.formatToParts(d);
  let year = 0, month = 0, day = 0;
  for (const p of parts) {
    if (p.type === "year") year = parseInt(p.value, 10);
    if (p.type === "month") month = parseInt(p.value, 10); // 1-12
    if (p.type === "day") day = parseInt(p.value, 10);
  }
  const quarter = Math.ceil(month / 3); // 1-4
  const dayStr = String(day).padStart(2, "0");
  const monthStr = String(month).padStart(2, "0");
  const isoDate = `${year}-${monthStr}-${dayStr}`;

  return { year, month, day, quarter, isoDate };
}

// Khử trùng lặp đơn hàng theo ID và chỉ lọc đơn đã hoàn tất / giao thành công
function getCompletedOrdersDeduplicated() {
  const allOrders = Array.isArray(orders) ? orders : [];
  const uniqueMap = new Map();

  for (const order of allOrders) {
    if (!order || !order.id) continue;
    const id = String(order.id).trim();
    if (!uniqueMap.has(id)) {
      uniqueMap.set(id, order);
    }
  }

  // Tiêu chí đơn hoàn tất theo quy ước thực tế hệ thống EcoDesk
  return Array.from(uniqueMap.values()).filter((o) => {
    const s = String(o.status || "").trim().toLowerCase();
    return s === "hoàn thành" || s === "hoàn tất" || s === "đã giao" || s === "giao thành công";
  });
}

// Định dạng tiền tệ cho trục tung và hiển thị ngắn gọn (ví dụ: 0 đ, 5 triệu, 10 triệu)
function formatRevenueAxis(amount) {
  if (amount === 0) return "0 đ";
  if (amount >= 1000000000) {
    const b = (amount / 1000000000).toFixed(1).replace(/\.0$/, "");
    return `${b} tỷ`;
  }
  if (amount >= 1000000) {
    const m = (amount / 1000000).toFixed(1).replace(/\.0$/, "");
    return `${m} triệu`;
  }
  if (amount >= 1000) {
    const k = Math.round(amount / 1000);
    return `${k}k`;
  }
  return `${amount} đ`;
}

function renderRevenueChart() {
  const container = document.getElementById("revenueChartContainer");
  if (!container) return;

  // Lấy toàn bộ đơn hàng hoàn tất từ tất cả các tài khoản khách hàng
  const completedOrders = getCompletedOrdersDeduplicated();

  // Phân bổ đơn hàng theo múi giờ Việt Nam
  const ordersWithMeta = completedOrders.map((o) => {
    const dateField = o.completedAt || o.deliveredAt || o.createdAt;
    const parts = getVietnamDateParts(dateField);
    return {
      order: o,
      parts,
      revenue: Math.max(0, Number(o.total || 0)),
      userId: o.userId || o.customerEmail || o.customerPhone || "anonymous"
    };
  }).filter((x) => x.parts !== null);

  const nowParts = getVietnamDateParts(new Date());
  const curYear = nowParts ? nowParts.year : 2026;
  const curMonth = nowParts ? nowParts.month : 11;
  const curQuarter = nowParts ? nowParts.quarter : 4;

  let periods = [];
  let subtitleText = "";

  // 1. Phân chia kỳ dựa theo Chế độ xem hoặc Khoảng ngày tùy chọn (Custom Date Range)
  if (chartCustomStartDate && chartCustomEndDate) {
    // Trường hợp người dùng chọn ngày bắt đầu & kết thúc cụ thể
    const startD = new Date(chartCustomStartDate);
    const endD = new Date(chartCustomEndDate);
    const startP = getVietnamDateParts(startD);
    const endP = getVietnamDateParts(endD);
    subtitleText = `Từ ${startP.day}/${startP.month}/${startP.year} đến ${endP.day}/${endP.month}/${endP.year}`;

    // Tạo các mốc ngày trong khoảng này
    const diffTime = Math.abs(endD.getTime() - startD.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const maxSlots = Math.min(diffDays, 31);
    const step = Math.max(1, Math.floor(diffDays / maxSlots));

    const dateMap = new Map();
    for (let i = 0; i < diffDays; i += step) {
      const cur = new Date(startD.getTime() + i * 24 * 60 * 60 * 1000);
      const p = getVietnamDateParts(cur);
      if (p) {
        dateMap.set(p.isoDate, {
          key: p.isoDate,
          label: `${String(p.day).padStart(2, "0")}/${String(p.month).padStart(2, "0")}`,
          fullLabel: `Ngày ${p.day}/${p.month}/${p.year}`,
          value: 0,
          ordersCount: 0,
          customers: new Set()
        });
      }
    }

    // Gán dữ liệu cho kỳ hiện tại
    for (const item of ordersWithMeta) {
      if (item.parts.isoDate >= chartCustomStartDate && item.parts.isoDate <= chartCustomEndDate) {
        // Tìm slot gần nhất trong map
        let assigned = dateMap.get(item.parts.isoDate);
        if (!assigned) {
          // Lấy key đầu tiên nhỏ hơn hoặc bằng
          const keys = Array.from(dateMap.keys());
          const foundKey = keys.reverse().find(k => k <= item.parts.isoDate) || keys[0];
          assigned = dateMap.get(foundKey);
        }
        if (assigned) {
          assigned.value += item.revenue;
          assigned.ordersCount++;
          assigned.customers.add(item.userId);
        }
      }
    }

    periods = Array.from(dateMap.values());

    // Tính kỳ liền trước tương đương
    const prevStart = new Date(startD.getTime() - diffDays * 24 * 60 * 60 * 1000);
    const prevEnd = new Date(startD.getTime() - 1000 * 60 * 60 * 24);
    const prevStartStr = getVietnamDateParts(prevStart).isoDate;
    const prevEndStr = getVietnamDateParts(prevEnd).isoDate;

    // Gán giá trị kỳ trước vào periods để vẽ đường so sánh
    periods.forEach((p, idx) => {
      // Tỷ lệ tương đương trong kỳ trước
      p.prevValue = 0;
      p.prevOrdersCount = 0;
    });

    for (const item of ordersWithMeta) {
      if (item.parts.isoDate >= prevStartStr && item.parts.isoDate <= prevEndStr) {
        // Phân bổ đều theo chỉ mục
        const itemD = new Date(item.order.completedAt || item.order.createdAt);
        const ratio = (itemD.getTime() - prevStart.getTime()) / (prevEnd.getTime() - prevStart.getTime());
        const targetIdx = Math.min(periods.length - 1, Math.max(0, Math.floor(ratio * periods.length)));
        if (periods[targetIdx]) {
          periods[targetIdx].prevValue = (periods[targetIdx].prevValue || 0) + item.revenue;
          periods[targetIdx].prevOrdersCount = (periods[targetIdx].prevOrdersCount || 0) + 1;
        }
      }
    }

  } else if (chartViewMode === "daily") {
    // 7 ngày gần nhất
    const daysCount = 7;
    const now = new Date();
    subtitleText = `7 ngày gần nhất (${getVietnamDateParts(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)).isoDate} – ${getVietnamDateParts(now).isoDate})`;

    const dateMap = new Map();
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const p = getVietnamDateParts(d);
      if (p) {
        dateMap.set(p.isoDate, {
          key: p.isoDate,
          label: `${String(p.day).padStart(2, "0")}/${String(p.month).padStart(2, "0")}`,
          fullLabel: `Ngày ${p.day}/${p.month}/${p.year}`,
          value: 0,
          prevValue: 0,
          ordersCount: 0,
          prevOrdersCount: 0,
          customers: new Set()
        });
      }
    }

    const prevStart = new Date(now.getTime() - (daysCount * 2) * 24 * 60 * 60 * 1000);
    const prevEnd = new Date(now.getTime() - daysCount * 24 * 60 * 60 * 1000);

    for (const item of ordersWithMeta) {
      if (dateMap.has(item.parts.isoDate)) {
        const p = dateMap.get(item.parts.isoDate);
        p.value += item.revenue;
        p.ordersCount++;
        p.customers.add(item.userId);
      } else {
        const itemDate = new Date(item.order.completedAt || item.order.createdAt);
        if (itemDate >= prevStart && itemDate < prevEnd) {
          const ratio = (itemDate.getTime() - prevStart.getTime()) / (prevEnd.getTime() - prevStart.getTime());
          const targetIdx = Math.min(dateMap.size - 1, Math.max(0, Math.floor(ratio * dateMap.size)));
          const arr = Array.from(dateMap.values());
          if (arr[targetIdx]) {
            arr[targetIdx].prevValue += item.revenue;
            arr[targetIdx].prevOrdersCount++;
          }
        }
      }
    }

    periods = Array.from(dateMap.values());

  } else if (chartViewMode === "monthly") {
    // 6 tháng gần nhất (hoặc cả năm)
    subtitleText = `Tháng 1 – Tháng 12, ${curYear}`;
    const monthList = [];
    for (let m = 1; m <= 12; m++) {
      monthList.push({ year: curYear, month: m });
    }

    periods = monthList.map((m) => {
      const curMatched = ordersWithMeta.filter(
        (it) => it.parts.year === m.year && it.parts.month === m.month
      );
      const curVal = curMatched.reduce((sum, it) => sum + it.revenue, 0);
      const custSet = new Set(curMatched.map((it) => it.userId));

      // Doanh thu cùng tháng của năm trước (kỳ so sánh)
      const prevMatched = ordersWithMeta.filter(
        (it) => it.parts.year === m.year - 1 && it.parts.month === m.month
      );
      const prevVal = prevMatched.reduce((sum, it) => sum + it.revenue, 0);

      return {
        key: `${m.year}-${m.month}`,
        label: `T${m.month}`,
        fullLabel: `Tháng ${m.month}/${m.year}`,
        value: curVal,
        prevValue: prevVal,
        ordersCount: curMatched.length,
        prevOrdersCount: prevMatched.length,
        customers: custSet
      };
    });

  } else if (chartViewMode === "quarterly") {
    // 4 quý trong năm
    subtitleText = `Quý 1 – Quý 4, ${curYear}`;
    const quarterList = [1, 2, 3, 4];

    periods = quarterList.map((q) => {
      const curMatched = ordersWithMeta.filter(
        (it) => it.parts.year === curYear && it.parts.quarter === q
      );
      const curVal = curMatched.reduce((sum, it) => sum + it.revenue, 0);
      const custSet = new Set(curMatched.map((it) => it.userId));

      const prevMatched = ordersWithMeta.filter(
        (it) => it.parts.year === curYear - 1 && it.parts.quarter === q
      );
      const prevVal = prevMatched.reduce((sum, it) => sum + it.revenue, 0);

      return {
        key: `${curYear}-Q${q}`,
        label: `Q${q}`,
        fullLabel: `Quý ${q} năm ${curYear} (Tháng ${(q - 1) * 3 + 1}–${q * 3})`,
        value: curVal,
        prevValue: prevVal,
        ordersCount: curMatched.length,
        prevOrdersCount: prevMatched.length,
        customers: custSet
      };
    });

  } else if (chartViewMode === "yearly") {
    // 5 năm gần nhất
    subtitleText = `Năm ${curYear - 4} – Năm ${curYear}`;
    const yearList = [];
    for (let i = 4; i >= 0; i--) {
      yearList.push(curYear - i);
    }

    periods = yearList.map((y) => {
      const curMatched = ordersWithMeta.filter((it) => it.parts.year === y);
      const curVal = curMatched.reduce((sum, it) => sum + it.revenue, 0);
      const custSet = new Set(curMatched.map((it) => it.userId));

      const prevMatched = ordersWithMeta.filter((it) => it.parts.year === y - 1);
      const prevVal = prevMatched.reduce((sum, it) => sum + it.revenue, 0);

      return {
        key: String(y),
        label: String(y),
        fullLabel: `Năm ${y}`,
        value: curVal,
        prevValue: prevVal,
        ordersCount: curMatched.length,
        prevOrdersCount: prevMatched.length,
        customers: custSet
      };
    });
  }

  // Cập nhật Dòng phụ tiêu đề
  const subtitleEl = document.getElementById("revenueDateSubtitle");
  if (subtitleEl) subtitleEl.textContent = subtitleText;

  // 2. Tính toán 5 chỉ số tổng hợp bên dưới biểu đồ
  const totalCurrentRevenue = periods.reduce((sum, p) => sum + p.value, 0);
  const totalPrevRevenue = periods.reduce((sum, p) => sum + (p.prevValue || 0), 0);
  const totalCompletedOrders = periods.reduce((sum, p) => sum + p.ordersCount, 0);
  const totalPrevCompletedOrders = periods.reduce((sum, p) => sum + (p.prevOrdersCount || 0), 0);
  
  const allCustomersSet = new Set();
  periods.forEach(p => {
    if (p.customers) p.customers.forEach(c => allCustomersSet.add(c));
  });
  const totalUniqueCustomers = allCustomersSet.size;

  const aov = totalCompletedOrders > 0 ? Math.round(totalCurrentRevenue / totalCompletedOrders) : 0;

  // Cập nhật giá trị vào 5 Card chỉ số
  const heroRevenueVal = document.getElementById("heroRevenueVal");
  const heroRevenueDiff = document.getElementById("heroRevenueDiff");
  const heroOrdersVal = document.getElementById("heroOrdersVal");
  const heroOrdersDiff = document.getElementById("heroOrdersDiff");
  const heroAOVVal = document.getElementById("heroAOVVal");
  const heroAOVDiff = document.getElementById("heroAOVDiff");
  const heroPrevRevenueVal = document.getElementById("heroPrevRevenueVal");
  const heroPrevRevenueNote = document.getElementById("heroPrevRevenueNote");
  const heroCustomersVal = document.getElementById("heroCustomersVal");
  const heroCustomersNote = document.getElementById("heroCustomersNote");

  if (heroRevenueVal) heroRevenueVal.textContent = formatPrice(totalCurrentRevenue);
  if (heroRevenueDiff) {
    if (totalPrevRevenue > 0) {
      const diff = totalCurrentRevenue - totalPrevRevenue;
      const pct = Math.round((diff / totalPrevRevenue) * 100);
      heroRevenueDiff.className = diff >= 0 ? "revenue-metric-sub up" : "revenue-metric-sub down";
      heroRevenueDiff.textContent = `${diff >= 0 ? "▲ +" : "▼ -"}${formatPrice(Math.abs(diff))} (${pct > 0 ? "+" : ""}${pct}%)`;
    } else {
      heroRevenueDiff.className = "revenue-metric-sub";
      heroRevenueDiff.textContent = "Không có số liệu kỳ trước";
    }
  }

  if (heroOrdersVal) heroOrdersVal.textContent = totalCompletedOrders;
  if (heroOrdersDiff) {
    const diffOrd = totalCompletedOrders - totalPrevCompletedOrders;
    heroOrdersDiff.textContent = totalPrevCompletedOrders > 0 
      ? `${diffOrd >= 0 ? "+" : ""}${diffOrd} so với kỳ trước (${totalPrevCompletedOrders} đơn)`
      : `${totalCompletedOrders} đơn hoàn tất`;
  }

  if (heroAOVVal) heroAOVVal.textContent = totalCompletedOrders > 0 ? formatPrice(aov) : "0 đ";
  if (heroAOVDiff) heroAOVDiff.textContent = `Bình quân / đơn hoàn tất`;

  if (heroPrevRevenueVal) heroPrevRevenueVal.textContent = formatPrice(totalPrevRevenue);
  if (heroPrevRevenueNote) heroPrevRevenueNote.textContent = totalPrevRevenue > 0 ? "Kỳ liền kề tương ứng" : "Chưa có đơn hoàn tất";

  if (heroCustomersVal) heroCustomersVal.textContent = totalUniqueCustomers;
  if (heroCustomersNote) heroCustomersNote.textContent = "Khách hàng duy nhất";

  // Cập nhật trạng thái hiển thị của các chuỗi trong chú giải
  const legCur = document.getElementById("legendToggleCurrent");
  const legPrev = document.getElementById("legendTogglePrevious");
  if (legCur) legCur.classList.toggle("muted", !chartShowCurrentSeries);
  if (legPrev) legPrev.classList.toggle("muted", !chartShowPreviousSeries);

  // Trường hợp không có dữ liệu đơn hoàn tất
  if (completedOrders.length === 0) {
    container.innerHTML = `
      <div class="chart-state-box">
        <div class="chart-state-icon">${renderIcon("package", { size: 36, strokeWidth: 1.8 })}</div>
        <div><strong>Chưa có đơn hàng hoàn tất nào trong hệ thống</strong></div>
        <div style="font-size: 12.5px; max-width: 360px; color: #64748b; line-height: 1.5;">Doanh thu được tổng hợp từ tất cả các đơn có trạng thái "Hoàn thành". Hãy chuyển trạng thái đơn hàng trong bảng bên dưới để ghi nhận.</div>
      </div>
    `;
    return;
  }

  // 3. Tọa độ và vẽ biểu đồ đường đôi (Two-Line Chart) với SVG
  const chartW = 920; // Rộng hơn theo phong cách hero chart
  const chartH = 280;
  const paddingLeft = 70;
  const paddingRight = 25;
  const paddingTop = 25;
  const paddingBottom = 40;
  const innerW = chartW - paddingLeft - paddingRight;
  const innerH = chartH - paddingTop - paddingBottom;

  const allVals = [];
  if (chartShowCurrentSeries) periods.forEach(p => allVals.push(p.value));
  if (chartShowPreviousSeries) periods.forEach(p => allVals.push(p.prevValue || 0));
  const maxVal = Math.max(...allVals, 5000000);
  const midVal = Math.round(maxVal / 2);

  // Tính tọa độ điểm kỳ hiện tại (Xanh EcoDesk)
  const coordsCurrent = periods.map((p, idx) => {
    const x = paddingLeft + (idx / Math.max(1, periods.length - 1)) * innerW;
    const y = chartH - paddingBottom - (p.value / maxVal) * innerH;
    return { x, y, ...p, idx, series: "current" };
  });

  // Tính tọa độ điểm kỳ trước (Xanh dương)
  const coordsPrev = periods.map((p, idx) => {
    const x = paddingLeft + (idx / Math.max(1, periods.length - 1)) * innerW;
    const y = chartH - paddingBottom - ((p.prevValue || 0) / maxVal) * innerH;
    return { x, y, value: p.prevValue || 0, ordersCount: p.prevOrdersCount || 0, fullLabel: p.fullLabel, label: p.label, idx, series: "previous" };
  });

  const linePointsCurrent = coordsCurrent.map((c) => `${c.x},${c.y}`).join(" ");
  const areaPathCurrent = `M ${coordsCurrent[0].x},${chartH - paddingBottom} L ${coordsCurrent.map((c) => `${c.x},${c.y}`).join(" L ")} L ${coordsCurrent[coordsCurrent.length - 1].x},${chartH - paddingBottom} Z`;

  const linePointsPrev = coordsPrev.map((c) => `${c.x},${c.y}`).join(" ");

  container.innerHTML = `
    <svg viewBox="0 0 ${chartW} ${chartH}" class="svg-chart-wrap" style="overflow: visible; width: 100%; height: 280px;">
      <defs>
        <linearGradient id="currentAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#15803d" stop-opacity="0.28"/>
          <stop offset="70%" stop-color="#22c55e" stop-opacity="0.08"/>
          <stop offset="100%" stop-color="#22c55e" stop-opacity="0.0"/>
        </linearGradient>
        <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#0f172a" flood-opacity="0.2"/>
        </filter>
      </defs>

      <!-- Đường lưới ngang nét đứt rõ nét -->
      <line x1="${paddingLeft}" y1="${chartH - paddingBottom}" x2="${chartW - paddingRight}" y2="${chartH - paddingBottom}" stroke="#cbd5e1" stroke-width="1.5"/>
      <line x1="${paddingLeft}" y1="${chartH - paddingBottom - innerH * 0.5}" x2="${chartW - paddingRight}" y2="${chartH - paddingBottom - innerH * 0.5}" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="5 4"/>
      <line x1="${paddingLeft}" y1="${paddingTop}" x2="${chartW - paddingRight}" y2="${paddingTop}" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="5 4"/>

      <!-- Nhãn trục tung định dạng tiền tệ -->
      <text x="${paddingLeft - 12}" y="${chartH - paddingBottom + 4}" font-size="11.5" fill="#475569" text-anchor="end" font-weight="600">${formatRevenueAxis(0)}</text>
      <text x="${paddingLeft - 12}" y="${chartH - paddingBottom - innerH * 0.5 + 4}" font-size="11.5" fill="#475569" text-anchor="end" font-weight="600">${formatRevenueAxis(midVal)}</text>
      <text x="${paddingLeft - 12}" y="${paddingTop + 4}" font-size="11.5" fill="#475569" text-anchor="end" font-weight="600">${formatRevenueAxis(maxVal)}</text>

      <!-- Chuỗi kỳ trước (Đường màu xanh dương) -->
      ${chartShowPreviousSeries ? `
        <polyline points="${linePointsPrev}" fill="none" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
        ${coordsPrev.map((c) => `
          <g class="chart-point-group" data-series="prev" data-idx="${c.idx}" style="cursor: pointer;">
            <circle cx="${c.x}" cy="${c.y}" r="8" fill="transparent" />
            <circle cx="${c.x}" cy="${c.y}" r="4" fill="#ffffff" stroke="#0284c7" stroke-width="2.5" />
          </g>
        `).join("")}
      ` : ""}

      <!-- Chuỗi kỳ hiện tại (Đường màu xanh lá EcoDesk + Gradient) -->
      ${chartShowCurrentSeries ? `
        <path d="${areaPathCurrent}" fill="url(#currentAreaGrad)" />
        <polyline points="${linePointsCurrent}" fill="none" stroke="#15803d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" filter="url(#lineGlow)"/>
        ${coordsCurrent.map((c) => `
          <g class="chart-point-group" data-series="cur" data-idx="${c.idx}" style="cursor: pointer;">
            <circle cx="${c.x}" cy="${c.y}" r="9" fill="transparent" />
            <circle cx="${c.x}" cy="${c.y}" r="5" fill="#ffffff" stroke="#15803d" stroke-width="3" />
            <text x="${c.x}" y="${chartH - 12}" font-size="12" fill="#1e293b" text-anchor="middle" font-weight="700">${c.label}</text>
          </g>
        `).join("")}
      ` : ""}
    </svg>
    <div class="chart-tooltip" id="revenueChartTooltip"></div>
  `;

  // Gắn Tooltip tương tác cho cả 2 chuỗi
  const tooltipEl = container.querySelector("#revenueChartTooltip");
  const pointsElements = container.querySelectorAll(".chart-point-group");

  pointsElements.forEach((pt) => {
    const isCur = pt.dataset.series === "cur";
    const idx = parseInt(pt.dataset.idx, 10);
    const item = periods[idx];
    if (!item) return;

    const showTip = (evt) => {
      if (!tooltipEl) return;
      const rect = container.getBoundingClientRect();
      const clientX = evt.clientX || (evt.touches && evt.touches[0].clientX) || rect.left + rect.width / 2;
      const clientY = evt.clientY || (evt.touches && evt.touches[0].clientY) || rect.top + rect.height / 2;
      const posX = clientX - rect.left;
      const posY = clientY - rect.top;

      const title = isCur ? `Kỳ hiện tại · ${item.fullLabel || item.label}` : `Kỳ trước · ${item.fullLabel || item.label}`;
      const rev = isCur ? item.value : (item.prevValue || 0);
      const count = isCur ? item.ordersCount : (item.prevOrdersCount || 0);
      const color = isCur ? "#4ade80" : "#38bdf8";

      tooltipEl.innerHTML = `
        <div class="chart-tooltip-period">${escapeHtml(title)}</div>
        <div class="chart-tooltip-revenue" style="color: ${color};">${formatPrice(rev)}</div>
        <div class="chart-tooltip-orders">Đơn hoàn tất: <strong>${count}</strong></div>
      `;
      tooltipEl.style.left = `${posX}px`;
      tooltipEl.style.top = `${posY}px`;
      tooltipEl.classList.add("visible");
    };

    const hideTip = () => {
      if (tooltipEl) tooltipEl.classList.remove("visible");
    };

    pt.addEventListener("mouseenter", showTip);
    pt.addEventListener("mousemove", showTip);
    pt.addEventListener("mouseleave", hideTip);
    pt.addEventListener("touchstart", showTip, { passive: true });
    pt.addEventListener("touchend", hideTip);
  });
}

function renderOrderStatusChart() {
  const container = document.getElementById("orderStatusChartContainer");
  const legend = document.getElementById("orderStatusLegend");
  if (!container || !legend) return;

  const statusCounts = { "Hoàn thành": 0, "Chờ xác nhận": 0, "Đang xử lý": 0, "Đang giao": 0, "Đã hủy": 0 };
  orders.forEach((o) => {
    const s = o.status || "Chờ xác nhận";
    if (statusCounts[s] !== undefined) statusCounts[s]++;
    else statusCounts["Chờ xác nhận"]++;
  });

  const total = orders.length || 1;
  const statusMeta = [
    { label: "Hoàn tất", count: statusCounts["Hoàn thành"], color: "#15803d" },
    { label: "Chờ xác nhận", count: statusCounts["Chờ xác nhận"], color: "#8b5cf6" },
    { label: "Đang xử lý", count: statusCounts["Đang xử lý"], color: "#f59e0b" },
    { label: "Đang giao", count: statusCounts["Đang giao"], color: "#0284c7" },
    { label: "Đã hủy", count: statusCounts["Đã hủy"], color: "#ef4444" }
  ];

  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  let accumulatedAngle = 0;

  const circles = statusMeta.map((item) => {
    const percent = item.count / total;
    const strokeDasharray = `${percent * circumference} ${circumference}`;
    const strokeDashoffset = -accumulatedAngle;
    accumulatedAngle += percent * circumference;

    return `
      <circle cx="100" cy="100" r="${radius}" fill="none" stroke="${item.color}" stroke-width="20"
        stroke-dasharray="${strokeDasharray}" stroke-dashoffset="${strokeDashoffset}"
        transform="rotate(-90 100 100)">
        <title>${item.label}: ${item.count} đơn (${Math.round(percent * 100)}%)</title>
      </circle>
    `;
  }).join("");

  container.innerHTML = `
    <svg width="200" height="200" viewBox="0 0 200 200">
      <circle cx="100" cy="100" r="${radius}" fill="none" stroke="#f1f5f9" stroke-width="20"/>
      ${circles}
      <text x="100" y="96" font-size="22" font-weight="800" fill="#1e293b" text-anchor="middle">${orders.length}</text>
      <text x="100" y="114" font-size="11" font-weight="600" fill="#64748b" text-anchor="middle">ĐƠN HÀNG</text>
    </svg>
  `;

  legend.innerHTML = statusMeta
    .map((item) => {
      const pct = Math.round((item.count / total) * 100);
      return `
      <div class="legend-item">
        <span class="legend-color" style="background: ${item.color};"></span>
        <span>${item.label}: <strong>${item.count}</strong> (${pct}%)</span>
      </div>
    `;
    })
    .join("");
}

function renderOverviewLists() {
  const bestSellersContainer = document.getElementById("overviewBestSellers");
  if (bestSellersContainer) {
    const sorted = [...products].sort((a, b) => Number(b.sold || 0) - Number(a.sold || 0)).slice(0, 4);
    bestSellersContainer.innerHTML = sorted.map((p, idx) => {
      const rankClass = idx === 0 ? "top-1" : idx === 1 ? "top-2" : idx === 2 ? "top-3" : "";
      return `
        <div class="best-seller-item">
          <div class="best-seller-rank ${rankClass}">${idx + 1}</div>
          <img class="best-seller-img" src="${p.image}" alt="${escapeHtml(p.name)}">
          <div class="best-seller-details">
            <div class="best-seller-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</div>
            <div class="best-seller-meta">${getCategoryName(categories, p.categoryId)} · ${formatPrice(p.price)}</div>
          </div>
          <div class="best-seller-stat">
            <div class="best-seller-sold">${p.sold || 0} đã bán</div>
            <div class="best-seller-rev">Kho: ${p.stock || 0}</div>
          </div>
        </div>
      `;
    }).join("") || `<p style="color: #64748b; font-size: 13px;">Chưa có sản phẩm.</p>`;
  }

  const lowStockContainer = document.getElementById("overviewLowStockList");
  if (lowStockContainer) {
    const sortedLow = [...products].sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0)).slice(0, 4);
    lowStockContainer.innerHTML = sortedLow.map((p) => {
      const isUrgent = Number(p.stock) <= 5;
      return `
        <div class="best-seller-item">
          <img class="best-seller-img" src="${p.image}" alt="${escapeHtml(p.name)}">
          <div class="best-seller-details">
            <div class="best-seller-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</div>
            <div class="best-seller-meta">${getCategoryName(categories, p.categoryId)} · ${formatPrice(p.price)}</div>
          </div>
          <div class="best-seller-stat">
            <span class="status-badge ${isUrgent ? "low-stock" : "processing"}">
              ${Number(p.stock) === 0 ? "Hết hàng" : `Còn ${p.stock} cái`}
            </span>
          </div>
        </div>
      `;
    }).join("") || `<p style="color: #64748b; font-size: 13px;">Tồn kho đều ổn định.</p>`;
  }

  const recentOrdersTbody = document.getElementById("overviewRecentOrdersTable");
  if (recentOrdersTbody) {
    const recent = orders.slice(0, 5);
    if (recent.length === 0) {
      recentOrdersTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b; padding: 20px;">Chưa có đơn hàng nào được tạo.</td></tr>`;
      return;
    }

    recentOrdersTbody.innerHTML = recent.map((o) => {
      const itemsCount = o.items ? `${o.items.length} món hàng` : "Chi tiết đơn";
      return `
        <tr>
          <td><strong style="color: #15803d;">#${escapeHtml(o.id)}</strong></td>
          <td><strong>${escapeHtml(o.customer || o.customerName || "Khách lẻ")}</strong></td>
          <td><small style="color: #64748b;">${formatDate(o.createdAt)}</small></td>
          <td><span>${itemsCount}</span></td>
          <td><strong style="color: #1e293b;">${formatPrice(o.total)}</strong></td>
          <td>${getStatusBadge(o.status)}</td>
          <td>
            <button class="table-action-btn" type="button" data-view-order="${escapeHtml(o.id)}">Xem chi tiết</button>
          </td>
        </tr>
      `;
    }).join("");
  }
}

/* ==========================================================================
   EXCEL IMPORT PREVIEW MODAL HELPER
   ========================================================================== */
function openExcelPreviewModal({ title, summaryText, columns, rows, onConfirm }) {
  const modal = document.getElementById("excelPreviewModalBackdrop");
  const titleEl = document.getElementById("excelPreviewTitle");
  const summaryEl = document.getElementById("excelPreviewSummary");
  const thead = document.getElementById("excelPreviewThead");
  const tbody = document.getElementById("excelPreviewTbody");
  const confirmBtn = document.getElementById("excelPreviewConfirmBtn");
  const cancelBtn = document.getElementById("excelPreviewCancelBtn");
  const closeBtn = document.getElementById("excelPreviewCloseBtn");

  titleEl.textContent = title;
  summaryEl.innerHTML = summaryText;

  thead.innerHTML = `<tr>${columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}<th>Trạng thái kiểm tra</th></tr>`;
  tbody.innerHTML = rows.map((r) => `
    <tr class="${r.isValid ? "preview-row-valid" : "preview-row-error"}">
      ${r.values.map((v) => `<td>${escapeHtml(String(v ?? ""))}</td>`).join("")}
      <td>${r.isValid ? `<span style="color: #15803d; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">${renderIcon("check", { size: 14, strokeWidth: 2 })} Hợp lệ</span>` : `<span style="color: #dc2626; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">${renderIcon("alert-triangle", { size: 14, strokeWidth: 2 })} ${escapeHtml(r.error)}</span>`}</td>
    </tr>
  `).join("");

  const closeModal = () => modal.classList.remove("show");
  closeBtn.onclick = closeModal;
  cancelBtn.onclick = closeModal;

  const validCount = rows.filter((r) => r.isValid).length;
  confirmBtn.disabled = validCount === 0;

  confirmBtn.onclick = async () => {
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Đang lưu...";
    try {
      await onConfirm();
      closeModal();
    } catch (err) {
      alert("Lỗi khi lưu dữ liệu: " + err.message);
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Xác nhận nhập dữ liệu";
    }
  };

  modal.classList.add("show");
}

/* ==========================================================================
   TAB 2: QUẢN LÝ ĐƠN HÀNG (ORDERS) & IN PHIẾU
   ========================================================================== */
function parseOrderItems(order) {
  if (Array.isArray(order.items) && order.items.length > 0) return order.items;
  if (typeof order.itemsJson === "string" && order.itemsJson.trim()) {
    try {
      const parsed = JSON.parse(order.itemsJson);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
}

// ==================== SHOPEE-STYLE ORDERS MANAGEMENT ====================

// Cập nhật số đếm trên từng Tab trạng thái đơn hàng
function updateOrdersTabCounters() {
  const countAll = orders.length;
  const countNeedAction = orders.filter((o) => o.status === "Chờ xác nhận" || o.status === "Đang xử lý").length;
  const countPending = orders.filter((o) => o.status === "Chờ xác nhận").length;
  const countProcessing = orders.filter((o) => o.status === "Đang xử lý").length;
  const countShipping = orders.filter((o) => o.status === "Đang giao").length;
  const countCompleted = orders.filter((o) => o.status === "Hoàn thành").length;
  const countCancelled = orders.filter((o) => o.status === "Đã hủy").length;
  const countCancelRequests = orders.filter(
    (o) => String(o.cancelRequestStatus || "").toUpperCase() === "PENDING" && o.status !== "Đã hủy"
  ).length;

  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setEl("countTabAll", countAll);
  setEl("countTabNeedAction", countNeedAction);
  setEl("countTabCancelRequests", countCancelRequests);
  setEl("countTabPending", countPending);
  setEl("countTabProcessing", countProcessing);
  setEl("countTabShipping", countShipping);
  setEl("countTabCompleted", countCompleted);
  setEl("countTabCancelled", countCancelled);
}

// Kiểm tra ràng buộc: Đơn chuyển khoản/QR chỉ được xác nhận xử lý khi backend đã xác nhận thanh toán qua SePay
function canConfirmOrderPayment(order) {
  const payInfo = getOrderPaymentStatusInfo(order);
  if (!payInfo.isQr || payInfo.isPaid) {
    return { allowed: true, reason: "", payInfo };
  }
  if (payInfo.code === "NEEDS_REVIEW") {
    return {
      allowed: false,
      reason: "Đơn chuyển khoản/QR đang cần đối soát giao dịch SePay, chưa thể xác nhận xử lý.",
      payInfo
    };
  }
  return {
    allowed: false,
    reason: "Đơn chuyển khoản/QR chưa được backend xác nhận thanh toán qua SePay nên chưa thể xác nhận xử lý.",
    payInfo
  };
}

// Lấy nhãn thanh toán riêng biệt từ trạng thái backend (không tự giả định QR là Đã TT)
function getPaymentBadge(order) {
  const info = getOrderPaymentStatusInfo(order);
  const icon = info.isPaid ? "check-circle-2" : (info.code === "NEEDS_REVIEW" ? "alert-triangle" : (info.isQr ? "clock" : "banknote"));
  const refSuffix = info.isQr && order.paymentReference ? ` · ${escapeHtml(order.paymentReference)}` : "";
  return `<span class="payment-badge ${info.badgeClass}" style="display:inline-flex; align-items:center; gap:4px;">${renderIcon(icon, { size: 12, strokeWidth: 2 })} ${escapeHtml(info.shortLabel)}${refSuffix}</span>`;
}

// Lấy nút thao tác tiếp theo thông minh theo vòng đời đơn hàng
function getNextActionBtn(order) {
  const s = order.status || "Chờ xác nhận";
  const cancelReqStatus = String(order.cancelRequestStatus || "").toUpperCase();
  if (cancelReqStatus === "PENDING" && s !== "Đã hủy") {
    return `
      <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
        <div style="display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap;">
          <button class="btn-action-primary" type="button" data-review-cancel="APPROVE" data-order-id="${escapeHtml(oId(order))}" style="background:#dc2626; border-color:#dc2626; display:inline-flex; align-items:center; gap:4px;">
            ${renderIcon("check", { size: 13, strokeWidth: 2.2 })} Duyệt hủy
          </button>
          <button class="table-action-btn" type="button" data-review-cancel="REJECT" data-order-id="${escapeHtml(oId(order))}" style="border-color:#cbd5e1;">
            Từ chối
          </button>
          <button class="table-action-btn" type="button" data-view-order="${escapeHtml(oId(order))}">Xem</button>
        </div>
        <small style="color:#c2410c; font-size:11px; font-weight:600;">Khách yêu cầu hủy</small>
      </div>
    `;
  }
  if (s === "Đã hủy" && String(order.refundStatus || "").toUpperCase() === "PENDING_REFUND") {
    return `
      <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
        <div style="display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap;">
          <button class="btn-action-primary" type="button" data-confirm-refund="${escapeHtml(oId(order))}" style="background:#0284c7; border-color:#0284c7;">
            Xác nhận hoàn tiền
          </button>
          <button class="table-action-btn" type="button" data-view-order="${escapeHtml(oId(order))}">Xem</button>
        </div>
        <small style="color:#b45309; font-size:11px; font-weight:600;">Đơn đã TT · Chờ hoàn tiền</small>
      </div>
    `;
  }
  if (s === "Chờ xác nhận") {
    const guard = canConfirmOrderPayment(order);
    if (!guard.allowed) {
      return `
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
          <div style="display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap;">
            <button class="btn-action-primary" type="button" disabled title="${escapeHtml(guard.reason)}" style="display:inline-flex; align-items:center; gap:4px; opacity:0.48; cursor:not-allowed; background:#94a3b8; border-color:#94a3b8;">
              ${renderIcon("lock", { size: 13, strokeWidth: 2.2 })} Xác nhận đơn
            </button>
            <button class="table-action-btn" type="button" data-view-order="${escapeHtml(oId(order))}">Xem</button>
          </div>
          <small style="color:#b45309; font-size:11px; font-weight:600;">${guard.payInfo.code === "NEEDS_REVIEW" ? "Cần đối soát SePay" : "Chờ thanh toán SePay"}</small>
        </div>
      `;
    }
    return `
      <div style="display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap;">
        <button class="btn-action-primary" type="button" data-quick-action="Đang xử lý" data-order-id="${escapeHtml(oId(order))}" style="display:inline-flex; align-items:center; gap:4px;">
          ${renderIcon("check", { size: 13, strokeWidth: 2.2 })} Xác nhận đơn
        </button>
        <button class="table-action-btn" type="button" data-view-order="${escapeHtml(oId(order))}">Xem</button>
      </div>
    `;
  }
  if (s === "Đang xử lý") {
    return `
      <div style="display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap;">
        <button class="btn-action-primary" type="button" data-quick-action="Đang giao" data-order-id="${escapeHtml(oId(order))}" style="display:inline-flex; align-items:center; gap:4px;">
          ${renderIcon("truck", { size: 13, strokeWidth: 2.2 })} Giao vận chuyển
        </button>
        <button class="table-action-btn" type="button" data-view-order="${escapeHtml(oId(order))}">Xem</button>
      </div>
    `;
  }
  if (s === "Đang giao") {
    return `
      <div style="display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap;">
        <button class="btn-action-primary" style="background: #15803d; border-color: #15803d; display:inline-flex; align-items:center; gap:4px;" type="button" data-quick-action="Hoàn thành" data-order-id="${escapeHtml(oId(order))}">
          ${renderIcon("check-circle-2", { size: 13, strokeWidth: 2.2 })} Đã giao xong
        </button>
        <button class="table-action-btn" type="button" data-view-order="${escapeHtml(oId(order))}">Xem</button>
      </div>
    `;
  }
  if (s === "Hoàn thành") {
    return `
      <div style="display: flex; gap: 6px; justify-content: flex-end;">
        <button class="table-action-btn" type="button" data-view-order="${escapeHtml(oId(order))}">Xem hóa đơn</button>
      </div>
    `;
  }
  return `
    <div style="display: flex; gap: 6px; justify-content: flex-end;">
      <button class="table-action-btn" type="button" data-view-order="${escapeHtml(oId(order))}">Xem chi tiết</button>
    </div>
  `;
}

function oId(order) {
  return String(order.id || "");
}

// Lấy danh sách đơn sau khi áp dụng toàn bộ bộ lọc và sắp xếp
function getFilteredAndSortedOrders() {
  const query = orderSearchQuery.trim().toLowerCase();

  return orders.filter((o) => {
    // 1. Lọc theo Tab trạng thái
    if (orderStatusFilter === "need_action") {
      if (o.status !== "Chờ xác nhận" && o.status !== "Đang xử lý") return false;
    } else if (orderStatusFilter === "cancel_requests") {
      if (String(o.cancelRequestStatus || "").toUpperCase() !== "PENDING" || o.status === "Đã hủy") return false;
    } else if (orderStatusFilter !== "all") {
      if (o.status !== orderStatusFilter) return false;
    }

    // 2. Lọc theo từ khóa tìm kiếm (Mã đơn, Mã tham chiếu DH, Tên khách, SĐT, Sản phẩm)
    if (query) {
      const idMatch = (o.id || "").toLowerCase().includes(query);
      const refMatch = (o.paymentReference || "").toLowerCase().includes(query);
      const custMatch = (o.customer || o.customerName || "").toLowerCase().includes(query);
      const phoneMatch = (o.customerPhone || "").toLowerCase().includes(query);
      const items = parseOrderItems(o);
      const itemsMatch = items.some((i) => (i.name || "").toLowerCase().includes(query) || (i.productId || "").toLowerCase().includes(query));
      if (!idMatch && !refMatch && !custMatch && !phoneMatch && !itemsMatch) return false;
    }

    // 3. Lọc theo khoảng ngày đặt
    if (orderFilterStartDate || orderFilterEndDate) {
      const orderDate = new Date(o.createdAt);
      if (!isNaN(orderDate.getTime())) {
        const p = getVietnamDateParts(orderDate);
        if (p) {
          if (orderFilterStartDate && p.isoDate < orderFilterStartDate) return false;
          if (orderFilterEndDate && p.isoDate > orderFilterEndDate) return false;
        }
      }
    }

    // 4. Lọc theo phương thức & trạng thái thanh toán
    if (orderPaymentFilter !== "all") {
      const payInfo = getOrderPaymentStatusInfo(o);
      if (orderPaymentFilter === "qr" && !payInfo.isQr) return false;
      if (orderPaymentFilter === "cod" && payInfo.isQr) return false;
      if (orderPaymentFilter === "unpaid_qr" && (!payInfo.isQr || payInfo.code !== "UNPAID")) return false;
      if (orderPaymentFilter === "paid_qr" && (!payInfo.isQr || !payInfo.isPaid)) return false;
      if (orderPaymentFilter === "needs_review" && (!payInfo.isQr || payInfo.code !== "NEEDS_REVIEW")) return false;
    }

    return true;
  }).sort((a, b) => {
    // Sắp xếp
    if (orderSortMode === "priority") {
      // Ưu tiên: Chờ xác nhận (1) -> Đang xử lý (2) -> Đang giao (3) -> Hoàn thành (4) -> Đã hủy (5)
      const rank = { "Chờ xác nhận": 1, "Đang xử lý": 2, "Đang giao": 3, "Hoàn thành": 4, "Đã hủy": 5 };
      const rankA = rank[a.status] || 99;
      const rankB = rank[b.status] || 99;
      if (rankA !== rankB) return rankA - rankB;
      // Cùng mức ưu tiên thì đơn mới nhất lên trước
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    }
    if (orderSortMode === "newest") {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    }
    if (orderSortMode === "oldest") {
      return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    }
    if (orderSortMode === "total_desc") {
      return Number(b.total || 0) - Number(a.total || 0);
    }
    if (orderSortMode === "total_asc") {
      return Number(a.total || 0) - Number(b.total || 0);
    }
    return 0;
  });
}

function renderOrdersTable() {
  const tbody = document.getElementById("fullOrdersTable");
  if (!tbody) return;

  updateOrdersTabCounters();

  const filtered = getFilteredAndSortedOrders();

  // Cập nhật thông tin số lượng kết quả lọc
  const summaryText = document.getElementById("orderFilterSummaryText");
  const highValBadge = document.getElementById("orderHighValueBadge");
  if (summaryText) {
    summaryText.innerHTML = `Đang hiển thị <strong>${filtered.length}</strong> / <strong>${orders.length}</strong> đơn hàng toàn hệ thống`;
  }
  if (highValBadge) {
    const hasHighVal = filtered.some((o) => Number(o.total || 0) >= 5000000);
    highValBadge.style.display = hasHighVal ? "inline-block" : "none";
  }

  // Cập nhật Toolbar Batch Actions
  updateOrdersBatchBar(filtered);

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: #64748b; padding: 36px 16px;">
          <div style="display:flex; justify-content:center; color:#94a3b8; margin-bottom: 8px;">${renderIcon("package", { size: 36, strokeWidth: 1.5 })}</div>
          <div><strong>Không tìm thấy đơn hàng nào phù hợp bộ lọc</strong></div>
          <div style="font-size: 12.5px; margin-top: 4px;">Thử đổi tab trạng thái, xóa ngày lọc hoặc bấm "Xóa bộ lọc".</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((o) => {
    const items = parseOrderItems(o);
    const firstItem = items[0] || { name: "Sản phẩm EcoDesk", quantity: 1 };
    const remainingCount = items.length - 1;

    const isChecked = selectedOrderIds.has(String(o.id));
    const paymentGuard = canConfirmOrderPayment(o);
    const lockFulfillment = !paymentGuard.allowed;
    const isCancelPending = String(o.cancelRequestStatus || "").toUpperCase() === "PENDING" && o.status !== "Đã hủy";

    return `
      <tr style="${isChecked ? "background: #f0fdf4;" : (isCancelPending ? "background: #fff7ed;" : "")}">
        <td style="text-align: center;">
          <input type="checkbox" class="order-row-checkbox" data-order-id="${escapeHtml(o.id)}" ${isChecked ? "checked" : ""} />
        </td>
        <td>
          <strong style="color: #15803d; font-family: monospace; font-size: 13.5px;">#${escapeHtml(o.id)}</strong>
          <br><small style="color: #64748b; font-size: 11.5px;">${formatDateTime(o.createdAt)}</small>
          ${isCancelPending ? `<br><span style="display:inline-block; margin-top:3px; padding:2px 6px; border-radius:999px; background:#ffedd5; color:#c2410c; font-size:10.5px; font-weight:700;">Chờ duyệt hủy</span>` : ""}
        </td>
        <td>
          <strong style="color: #1e293b;">${escapeHtml(o.customer || o.customerName || "Khách lẻ")}</strong>
          ${o.customerPhone ? `<br><small style="color: #64748b; font-size: 12px; display:inline-flex; align-items:center; gap:3px;">${renderIcon("phone", { size: 11, strokeWidth: 2 })} ${escapeHtml(o.customerPhone)}</small>` : ""}
        </td>
        <td style="max-width: 250px;">
          <div style="font-size: 13px; font-weight: 600; color: #334155; line-height: 1.3;">
            ${escapeHtml(firstItem.name)} <span style="color: #15803d; font-weight: 700;">(x${firstItem.quantity || 1})</span>
          </div>
          ${firstItem.variantName ? `<span style="display: inline-block; margin-top: 3px; font-size: 11px; background: #e0f2fe; color: #0369a1; padding: 1px 6px; border-radius: 4px; font-weight: 600;">Phân loại: ${escapeHtml(firstItem.variantName)}</span>` : ""}
          ${remainingCount > 0 
            ? `<br><small style="color: #64748b; font-size: 11.5px; cursor: pointer; text-decoration: underline;" data-view-order="${escapeHtml(o.id)}">+ xem thêm ${remainingCount} sản phẩm khác</small>` 
            : `<br><small style="color: #94a3b8; font-size: 11px;">1 sản phẩm</small>`}
        </td>
        <td>
          <strong style="color: #1e293b; font-size: 14.5px;">${formatPrice(o.total)}</strong>
          <br>${getPaymentBadge(o)}
        </td>
        <td>
          <div style="margin-bottom: 4px;">${getStatusBadge(o.status)}</div>
          <select class="time-filter-select" style="height: 28px; font-size: 11.5px; padding: 0 6px; font-weight: 600; width: 115px;" data-update-order-status="${escapeHtml(o.id)}" data-current-status="${escapeHtml(o.status || 'Chờ xác nhận')}" title="${lockFulfillment ? escapeHtml(paymentGuard.reason) : 'Cập nhật trạng thái xử lý đơn'}">
            <option value="Chờ xác nhận" ${o.status === "Chờ xác nhận" ? "selected" : ""}>Chờ xác nhận</option>
            <option value="Đang xử lý" ${o.status === "Đang xử lý" ? "selected" : ""} ${lockFulfillment ? "disabled" : ""}>Đang xử lý${lockFulfillment ? " (chờ TT)" : ""}</option>
            <option value="Đang giao" ${o.status === "Đang giao" ? "selected" : ""} ${lockFulfillment ? "disabled" : ""}>Đang giao</option>
            <option value="Hoàn thành" ${o.status === "Hoàn thành" ? "selected" : ""} ${lockFulfillment ? "disabled" : ""}>Hoàn tất</option>
            <option value="Đã hủy" ${o.status === "Đã hủy" ? "selected" : ""}>Đã hủy</option>
          </select>
        </td>
        <td style="text-align: right;">
          ${getNextActionBtn(o)}
        </td>
      </tr>
    `;
  }).join("");
}

// Cập nhật thanh thao tác hàng loạt
function updateOrdersBatchBar(visibleOrders) {
  const bar = document.getElementById("ordersBatchBar");
  const countEl = document.getElementById("ordersBatchSelectedCount");
  const selectAllCheck = document.getElementById("orderSelectAllCheck");

  if (!bar) return;

  const selectedCount = selectedOrderIds.size;
  if (selectedCount > 0) {
    bar.style.display = "flex";
    if (countEl) countEl.textContent = `Đã chọn ${selectedCount} đơn hàng`;
  } else {
    bar.style.display = "none";
  }

  if (selectAllCheck) {
    const allVisibleSelected = visibleOrders.length > 0 && visibleOrders.every((o) => selectedOrderIds.has(String(o.id)));
    selectAllCheck.checked = allVisibleSelected;
  }
}

// Chuyển trạng thái đơn an toàn với xác nhận thông minh
async function handleSafeOrderStatusUpdate(orderId, newStatus, reason = "") {
  const order = orders.find((o) => String(o.id) === String(orderId));
  if (!order) return false;

  const oldStatus = order.status || "Chờ xác nhận";
  if (oldStatus === newStatus) return true;

  // Quy tắc an toàn: Không cho chuyển đơn Đã hủy sang Hoàn thành / Đang giao nếu không qua bước Đang xử lý
  if (oldStatus === "Đã hủy" && (newStatus === "Hoàn thành" || newStatus === "Đang giao")) {
    showToast("Không thể chuyển trực tiếp đơn đã hủy sang giao hàng/hoàn tất.");
    return false;
  }

  // Ràng buộc thanh toán QR/chuyển khoản: chỉ cho xác nhận xử lý khi backend đã xác nhận PAID qua SePay
  if (["Đang xử lý", "Đang giao", "Hoàn thành"].includes(newStatus)) {
    const guard = canConfirmOrderPayment(order);
    if (!guard.allowed) {
      showToast(guard.reason);
      return false;
    }
  }

  const confirmed = confirm(`Xác nhận chuyển trạng thái đơn hàng #${orderId} từ "${oldStatus}" sang "${newStatus}"?`);
  if (!confirmed) return false;

  try {
    await updateOrderStatus(
      orderId,
      newStatus,
      reason || `Quản trị viên chuyển trạng thái từ ${oldStatus} sang ${newStatus}`
    );
    orders = getOrders();

    renderKPIs();
    renderOrderStatusChart();
    renderRevenueChart();
    renderOverviewLists();
    renderOrdersTable();
    showToast(`Đã chuyển đơn #${orderId} sang "${newStatus}".`);
    return true;
  } catch (err) {
    console.error("Lỗi cập nhật trạng thái đơn:", err);
    showToast(err?.message || "Cập nhật trạng thái thất bại. Vui lòng thử lại.");
    return false;
  }
}

function bindOrdersEvents() {
  const group = document.getElementById("ordersFilterGroup");
  if (group) {
    group.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-order-status]");
      if (!chip) return;
      group.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      orderStatusFilter = chip.dataset.orderStatus;
      renderOrdersTable();
    });
  }

  // Search input
  const searchInput = document.getElementById("orderSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      orderSearchQuery = e.target.value;
      renderOrdersTable();
    });
  }

  // Filter Date Inputs
  const startDateInput = document.getElementById("orderFilterStartDate");
  const endDateInput = document.getElementById("orderFilterEndDate");
  if (startDateInput) {
    startDateInput.addEventListener("change", (e) => {
      orderFilterStartDate = e.target.value;
      renderOrdersTable();
    });
  }
  if (endDateInput) {
    endDateInput.addEventListener("change", (e) => {
      orderFilterEndDate = e.target.value;
      renderOrdersTable();
    });
  }

  // Payment Filter
  const paymentFilterSelect = document.getElementById("orderPaymentFilter");
  if (paymentFilterSelect) {
    paymentFilterSelect.addEventListener("change", (e) => {
      orderPaymentFilter = e.target.value;
      renderOrdersTable();
    });
  }

  // Sort Order Selector
  const sortSelector = document.getElementById("orderSortSelector");
  if (sortSelector) {
    sortSelector.addEventListener("change", (e) => {
      orderSortMode = e.target.value;
      renderOrdersTable();
    });
  }

  // Clear Filter Button
  const clearFilterBtn = document.getElementById("orderClearFilterBtn");
  if (clearFilterBtn) {
    clearFilterBtn.addEventListener("click", () => {
      orderSearchQuery = "";
      orderFilterStartDate = "";
      orderFilterEndDate = "";
      orderPaymentFilter = "all";
      orderSortMode = "priority";
      orderStatusFilter = "all";

      if (searchInput) searchInput.value = "";
      if (startDateInput) startDateInput.value = "";
      if (endDateInput) endDateInput.value = "";
      if (paymentFilterSelect) paymentFilterSelect.value = "all";
      if (sortSelector) sortSelector.value = "priority";

      if (group) {
        group.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("active"));
        const allBtn = group.querySelector('[data-order-status="all"]');
        if (allBtn) allBtn.classList.add("active");
      }

      renderOrdersTable();
      showToast("Đã đặt lại toàn bộ bộ lọc đơn hàng.");
    });
  }

  // Checkbox Select All
  const selectAllCheck = document.getElementById("orderSelectAllCheck");
  if (selectAllCheck) {
    selectAllCheck.addEventListener("change", (e) => {
      const visible = getFilteredAndSortedOrders();
      if (e.target.checked) {
        visible.forEach((o) => selectedOrderIds.add(String(o.id)));
      } else {
        visible.forEach((o) => selectedOrderIds.delete(String(o.id)));
      }
      renderOrdersTable();
    });
  }

  // Row Checkbox change (delegated)
  document.addEventListener("change", (e) => {
    const rowCheck = e.target.closest(".order-row-checkbox");
    if (!rowCheck) return;
    const oId = rowCheck.dataset.orderId;
    if (rowCheck.checked) {
      selectedOrderIds.add(oId);
    } else {
      selectedOrderIds.delete(oId);
    }
    updateOrdersBatchBar(getFilteredAndSortedOrders());
  });

  // Batch actions
  const batchDeselectBtn = document.getElementById("batchDeselectBtn");
  if (batchDeselectBtn) {
    batchDeselectBtn.addEventListener("click", () => {
      selectedOrderIds.clear();
      renderOrdersTable();
    });
  }

  const batchConfirmBtn = document.getElementById("batchConfirmBtn");
  if (batchConfirmBtn) {
    batchConfirmBtn.addEventListener("click", async () => {
      const ids = Array.from(selectedOrderIds);
      const pendingOrders = orders.filter((o) => ids.includes(String(o.id)) && o.status === "Chờ xác nhận");
      if (pendingOrders.length === 0) {
        showToast("Không có đơn nào ở trạng thái 'Chờ xác nhận' trong số đơn đã chọn.");
        return;
      }
      const eligibleOrders = pendingOrders.filter((o) => canConfirmOrderPayment(o).allowed);
      const blockedCount = pendingOrders.length - eligibleOrders.length;
      if (eligibleOrders.length === 0) {
        showToast("Các đơn chuyển khoản/QR đã chọn chưa được xác nhận thanh toán qua SePay nên chưa thể xác nhận.");
        return;
      }
      const confirmMsg = blockedCount > 0
        ? `Xác nhận ${eligibleOrders.length} đơn hợp lệ sang 'Đang xử lý' (bỏ qua ${blockedCount} đơn QR chưa thanh toán)?`
        : `Bạn có chắc muốn xác nhận hàng loạt ${eligibleOrders.length} đơn hàng chuyển sang 'Đang xử lý'?`;
      const ok = confirm(confirmMsg);
      if (!ok) return;

      let confirmedCount = 0;
      for (const ord of eligibleOrders) {
        try {
          await updateOrderStatus(ord.id, "Đang xử lý", "Xác nhận đơn hàng loạt");
          confirmedCount += 1;
        } catch (err) {
          console.warn("Bỏ qua đơn không thể xác nhận:", ord.id, err);
        }
      }
      orders = getOrders();
      selectedOrderIds.clear();
      renderKPIs();
      renderOrderStatusChart();
      renderRevenueChart();
      renderOverviewLists();
      renderOrdersTable();
      showToast(
        blockedCount > 0
          ? `Đã xác nhận ${confirmedCount} đơn hợp lệ (bỏ qua ${blockedCount} đơn QR chưa xác nhận thanh toán).`
          : `Đã xác nhận thành công ${confirmedCount} đơn hàng!`
      );
    });
  }

  const batchProcessBtn = document.getElementById("batchProcessBtn");
  if (batchProcessBtn) {
    batchProcessBtn.addEventListener("click", async () => {
      const ids = Array.from(selectedOrderIds);
      const targetOrders = orders.filter((o) => ids.includes(String(o.id)) && o.status === "Đang xử lý");
      if (targetOrders.length === 0) {
        showToast("Không có đơn nào ở trạng thái 'Đang xử lý' để chuyển sang 'Đang giao'.");
        return;
      }
      const ok = confirm(`Bạn có chắc muốn chuyển hàng loạt ${targetOrders.length} đơn hàng sang 'Đang giao'?`);
      if (!ok) return;

      for (const ord of targetOrders) {
        await updateOrderStatus(ord.id, "Đang giao", "Bắt đầu giao hàng loạt");
      }
      orders = getOrders();
      selectedOrderIds.clear();
      renderKPIs();
      renderOrderStatusChart();
      renderRevenueChart();
      renderOverviewLists();
      renderOrdersTable();
      showToast(`Đã chuyển giao thành công ${targetOrders.length} đơn hàng!`);
    });
  }

  // Quick Action Button on row (✓ Xác nhận đơn / 🚚 Giao vận chuyển / ✓ Đã giao xong)
  document.addEventListener("click", async (e) => {
    const quickBtn = e.target.closest("[data-quick-action]");
    if (!quickBtn) return;
    const targetStatus = quickBtn.dataset.quickAction;
    const orderId = quickBtn.dataset.orderId;
    if (orderId && targetStatus) {
      await handleSafeOrderStatusUpdate(orderId, targetStatus);
    }
  });

  // Select dropdown update order status
  document.addEventListener("change", async (e) => {
    const select = e.target.closest("[data-update-order-status]");
    if (!select) return;

    const orderId = select.dataset.updateOrderStatus;
    const oldStatus = select.dataset.currentStatus || "Chờ xác nhận";
    const newStatus = select.value;

    const success = await handleSafeOrderStatusUpdate(orderId, newStatus);
    if (!success) {
      select.value = oldStatus;
    } else {
      select.dataset.currentStatus = newStatus;
    }
  });

  // View Order Detail Modal
  document.addEventListener("click", (e) => {
    const viewBtn = e.target.closest("[data-view-order]");
    if (!viewBtn) return;
    const orderId = viewBtn.dataset.viewOrder;
    const order = orders.find((o) => String(o.id) === String(orderId));
    if (!order) return;
    openOrderDetailModal(order);
  });

  // Review Customer Cancel Request (Approve / Reject)
  document.addEventListener("click", async (e) => {
    const reviewBtn = e.target.closest("[data-review-cancel]");
    if (!reviewBtn) return;
    const decision = reviewBtn.dataset.reviewCancel;
    const orderId = reviewBtn.dataset.orderId;
    if (!orderId || !decision) return;
    await handleCancelReview(orderId, decision);
  });

  // Confirm Refund for Paid Cancelled Order
  document.addEventListener("click", async (e) => {
    const refundBtn = e.target.closest("[data-confirm-refund]");
    if (!refundBtn) return;
    const orderId = refundBtn.dataset.confirmRefund;
    if (!orderId) return;
    await handleConfirmRefund(orderId);
  });

  // Export orders to Excel (.xlsx) - Xuất theo đúng kết quả bộ lọc hiện tại
  const exportBtn = document.getElementById("exportOrdersBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const filtered = getFilteredAndSortedOrders();
      if (filtered.length === 0) {
        showToast("Không có đơn hàng nào phù hợp bộ lọc để xuất.");
        return;
      }

      const rows = filtered.map((o) => {
        const items = parseOrderItems(o);
        const itemsStr = items.map((i) => `${i.name}${i.variantName ? ` [${i.variantName}]` : ""} (x${i.quantity})`).join(", ");
        return {
          "Mã đơn hàng": o.id,
          "Khách hàng": o.customer || o.customerName || "Chưa có dữ liệu",
          "Số điện thoại": o.customerPhone || "Chưa có dữ liệu",
          "Email": o.customerEmail || "Chưa có dữ liệu",
          "Địa chỉ nhận hàng": o.shippingAddress || "Chưa có dữ liệu",
          "Ngày đặt hàng": formatDate(o.createdAt),
          "Danh sách sản phẩm": itemsStr || "Chưa có dữ liệu",
          "Tạm tính (VNĐ)": Number(o.subtotal || o.total || 0),
          "Giảm giá (VNĐ)": Number(o.discount || 0),
          "Phí vận chuyển (VNĐ)": Number(o.shippingFee || 0),
          "Tổng thanh toán (VNĐ)": Number(o.total || 0),
          "Phương thức thanh toán": o.paymentMethod || "COD",
          "Trạng thái thanh toán": getOrderPaymentStatusInfo(o).label,
          "Mã tham chiếu CK": o.paymentReference || "",
          "Trạng thái": o.status || "Chờ xác nhận",
          "Mã ưu đãi": o.couponCode || ""
        };
      });

      exportToExcel(rows, `ecodesk-don-hang-${orderStatusFilter}`, "Đơn hàng");
      showToast(`Đã xuất ${filtered.length} đơn hàng ra file Excel (.xlsx).`);
    });
  }

  // Export orders to PDF trực tiếp
  const exportPdfBtn = document.getElementById("exportOrdersPdfBtn");
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener("click", () => {
      const filtered = getFilteredAndSortedOrders();
      if (filtered.length === 0) {
        showToast("Không có đơn hàng nào phù hợp bộ lọc để xuất.");
        return;
      }
      exportOrdersListToPDF(filtered, orderStatusFilter || "Tất cả");
      showToast(`Đã xuất ${filtered.length} đơn hàng ra file PDF!`);
    });
  }
}

function openOrderDetailModal(order) {
  const modal = document.getElementById("orderModalBackdrop");
  const title = document.getElementById("modalOrderTitle");
  const body = document.getElementById("modalOrderBody");
  const printBtn = document.getElementById("modalOrderPrintBtn");
  const pdfBtn = document.getElementById("modalOrderPdfBtn");
  const closeBtn = document.getElementById("modalOrderCloseBtn");
  const cancelBtn = document.getElementById("modalOrderCancelBtn");

  if (!modal || !title || !body) return;

  if (pdfBtn) {
    pdfBtn.onclick = () => {
      exportOrderInvoiceToPDF(order);
      showToast(`Đã xuất phiếu giao hàng / hóa đơn PDF cho đơn #${order.id}!`);
    };
  }

  title.textContent = `Phiếu chi tiết đơn hàng #${order.id}`;

  const items = parseOrderItems(order);
  const itemsHtml = items.length > 0
    ? items.map((i, idx) => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9;">
          <div>
            <strong>${idx + 1}. ${escapeHtml(i.name)}</strong>
            ${i.variantName ? `<span style="margin-left: 6px; font-size: 11px; background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-weight: 600;">Phân loại: ${escapeHtml(i.variantName)}</span>` : ""}
            <br><small style="color: #64748b;">Mã SP: ${escapeHtml(i.productId || i.id || "—")}${i.variantSku ? ` · SKU: ${escapeHtml(i.variantSku)}` : ""} · Số lượng: <strong>${i.quantity}</strong></small>
          </div>
          <div style="text-align: right;">
            <strong>${formatPrice((i.unitPrice || i.price || 0) * (i.quantity || 1))}</strong>
            <br><small style="color: #64748b;">(${formatPrice(i.unitPrice || i.price || 0)} / sp)</small>
          </div>
        </div>
      `).join("")
    : `<p style="color: #64748b; padding: 12px 0;">Chưa có dữ liệu chi tiết sản phẩm.</p>`;

  const history = Array.isArray(order.statusHistory) && order.statusHistory.length > 0
    ? order.statusHistory
    : [
        {
          status: order.status || "Đang xử lý",
          timestamp: order.createdAt,
          note: "Khởi tạo đơn hàng từ giỏ mua sắm"
        }
      ];

  const historyHtml = history.map((h) => `
    <div class="timeline-item">
      <strong>${escapeHtml(h.status)}</strong>: <span style="color: #475569;">${escapeHtml(h.note || "")}</span>
      <div class="timeline-time">${formatDateTime(h.timestamp)}</div>
    </div>
  `).join("");

  body.innerHTML = `
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 18px;">
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; font-size: 13.5px;">
        <div><span style="color: #64748b;">Khách hàng:</span> <strong>${escapeHtml(order.customer || order.customerName || "Chưa có dữ liệu")}</strong></div>
        <div><span style="color: #64748b;">Số điện thoại:</span> <strong>${escapeHtml(order.customerPhone || "Chưa có dữ liệu")}</strong></div>
        <div><span style="color: #64748b;">Email:</span> <strong>${escapeHtml(order.customerEmail || "Chưa có dữ liệu")}</strong></div>
        <div><span style="color: #64748b;">Ngày đặt:</span> <strong>${formatDateTime(order.createdAt)}</strong></div>
        <div><span style="color: #64748b;">Địa chỉ giao:</span> <strong>${escapeHtml(order.shippingAddress || "Chưa có dữ liệu")}</strong></div>
        <div><span style="color: #64748b;">Vận chuyển:</span> <strong>${escapeHtml(order.shippingMethod || "Chưa có dữ liệu")}</strong></div>
        <div><span style="color: #64748b;">Địa chỉ thanh toán:</span> <strong>${escapeHtml(order.billingAddress || "Giống địa chỉ giao hàng")}</strong></div>
        <div><span style="color: #64748b;">Phương thức TT:</span> <strong>${escapeHtml(order.paymentMethod || "Chưa có dữ liệu")}</strong></div>
        <div><span style="color: #64748b;">Trạng thái thanh toán:</span> ${getPaymentBadge(order)}</div>
        ${order.paymentReference ? `<div><span style="color: #64748b;">Mã tham chiếu CK:</span> <strong style="color:#15803d; font-family:monospace;">${escapeHtml(order.paymentReference)}</strong></div>` : ""}
        ${order.sepayTransactionId ? `<div><span style="color: #64748b;">Mã GD SePay:</span> <strong style="font-family:monospace;">${escapeHtml(order.sepayTransactionId)}</strong></div>` : ""}
        ${order.paymentBankRef ? `<div><span style="color: #64748b;">Mã tham chiếu NH:</span> <strong>${escapeHtml(order.paymentBankRef)}</strong>${order.paymentGateway ? ` (${escapeHtml(order.paymentGateway)})` : ""}</div>` : ""}
        ${order.paidAt ? `<div><span style="color: #64748b;">Thời gian thanh toán:</span> <strong>${escapeHtml(order.paidAt)}</strong>${order.paidAmount ? ` (${formatPrice(order.paidAmount)})` : ""}</div>` : ""}
        <div><span style="color: #64748b;">Ghi chú đơn:</span> <strong>${escapeHtml(order.note || "Không có")}</strong></div>
        <div><span style="color: #64748b;">Trạng thái xử lý đơn:</span> ${getStatusBadge(order.status)}</div>
        <div><span style="color: #64748b;">Mã ưu đãi:</span> <strong>${escapeHtml(order.couponCode || "Không có")}</strong></div>
        ${!canConfirmOrderPayment(order).allowed && (order.status || "Chờ xác nhận") === "Chờ xác nhận" ? `
          <div style="grid-column: 1 / -1; background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 10px 12px; color: #92400e; font-size: 13px; line-height: 1.5;">
            <strong>Chưa thể xác nhận đơn:</strong> ${escapeHtml(canConfirmOrderPayment(order).reason)}
          </div>
        ` : ""}
        ${((order.paymentMethod || "").toUpperCase().includes("COD")) && order.paymentStatus !== "PAID" && order.status !== "Đã hủy" ? `
          <div style="grid-column: 1 / -1; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px 12px; display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
            <span style="color:#166534; font-size:13px;"><strong>Thu tiền COD:</strong> Đơn hàng COD chưa ghi nhận thanh toán. Bấm để xác nhận đã nhận đủ tiền mặt.</span>
            <button type="button" class="btn-action-primary" data-confirm-cod-payment="${escapeHtml(oId(order))}" style="background:#15803d; border-color:#15803d; font-size:12.5px;">Xác nhận đã thu tiền COD</button>
          </div>
        ` : ""}
        ${String(order.cancelRequestStatus || "").toUpperCase() === "PENDING" && order.status !== "Đã hủy" ? `
          <div style="grid-column: 1 / -1; background: #fff7ed; border: 1px solid #fdba74; border-radius: 8px; padding: 12px 14px; color: #9a3412; font-size: 13px; line-height: 1.5;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:6px;">
              <strong>Khách hàng yêu cầu hủy đơn (Chờ duyệt hủy)</strong>
              <span>${order.cancelRequestedAt ? formatDateTime(order.cancelRequestedAt) : ""}</span>
            </div>
            <div><strong>Lý do khách chọn:</strong> ${escapeHtml(order.cancelRequestReason || "Theo yêu cầu")}</div>
            <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
              <button type="button" class="btn-action-primary" data-review-cancel="APPROVE" data-order-id="${escapeHtml(oId(order))}" style="background:#dc2626; border-color:#dc2626;">Duyệt hủy</button>
              <button type="button" class="table-action-btn" data-review-cancel="REJECT" data-order-id="${escapeHtml(oId(order))}">Từ chối yêu cầu hủy</button>
            </div>
          </div>
        ` : ""}
        ${String(order.cancelRequestStatus || "").toUpperCase() === "REJECTED" && order.status !== "Đã hủy" ? `
          <div style="grid-column: 1 / -1; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 10px 12px; color: #991b1b; font-size: 13px; line-height: 1.5;">
            <strong>Đã từ chối yêu cầu hủy trước đó:</strong> ${escapeHtml(order.cancelRejectReason || "Không đủ điều kiện hủy.")}
            ${order.cancelReviewedBy ? ` · Người xử lý: <strong>${escapeHtml(order.cancelReviewedBy)}</strong>` : ""}
            ${order.cancelReviewedAt ? ` · ${formatDateTime(order.cancelReviewedAt)}` : ""}
          </div>
        ` : ""}
        ${order.status === "Đã hủy" && order.refundStatus ? `
          <div style="grid-column: 1 / -1; background: ${order.refundStatus === "REFUNDED" ? "#f0fdf4" : "#fffbeb"}; border: 1px solid ${order.refundStatus === "REFUNDED" ? "#bbf7d0" : "#fde68a"}; border-radius: 6px; padding: 10px 12px; color: ${order.refundStatus === "REFUNDED" ? "#166534" : "#92400e"}; font-size: 13px; display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
            <span><strong>Trạng thái hoàn tiền:</strong> ${order.refundStatus === "REFUNDED" ? "Đã hoàn tiền cho khách" : "Đang chờ hoàn tiền theo quy trình"}</span>
            ${order.refundStatus === "PENDING_REFUND" ? `<button type="button" class="btn-action-primary" data-confirm-refund="${escapeHtml(oId(order))}" style="background:#0284c7; border-color:#0284c7;">Xác nhận đã hoàn tiền</button>` : ""}
          </div>
        ` : ""}
        ${order.paymentReviewReason ? `
          <div style="grid-column: 1 / -1; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 10px 12px; color: #991b1b; font-size: 13px; line-height: 1.5;">
            <strong>Cần tra soát giao dịch SePay:</strong> ${escapeHtml(order.paymentReviewReason)}
          </div>
        ` : ""}
        ${order.status === "Đã hủy" ? `
          <div style="grid-column: 1 / -1; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 10px 12px; color: #991b1b; font-size: 13px; line-height: 1.5;">
            <strong>Lý do hủy đơn:</strong> ${escapeHtml(order.cancelReason || "Theo yêu cầu của khách hàng")}
            ${order.cancelledBy ? ` · <span>Người thực hiện: <strong>${escapeHtml(order.cancelledBy)}</strong></span>` : ""}
            ${order.cancelledAt ? ` · <span>Thời gian hủy: <strong>${formatDateTime(order.cancelledAt)}</strong></span>` : ""}
          </div>
        ` : ""}
        ${order.updatedAt ? `
          <div style="grid-column: 1 / -1; font-size: 12px; color: #64748b; display: flex; align-items: center; gap: 4px;">
            ${renderIcon("clock", { size: 13, strokeWidth: 1.8 })} Cập nhật thông tin giao hàng lần cuối: <strong>${formatDateTime(order.updatedAt)}</strong>
          </div>
        ` : ""}
      </div>
    </div>

    <h4 style="margin: 0 0 10px; font-size: 14px; font-weight: 700;">Danh sách sản phẩm mua</h4>
    <div style="margin-bottom: 18px;">
      ${itemsHtml}
    </div>

    <div style="background: #f1f5f9; border-radius: 8px; padding: 14px; font-size: 14px; margin-bottom: 18px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
        <span style="color: #64748b;">Tạm tính:</span>
        <span>${formatPrice(order.subtotal || order.total)}</span>
      </div>
      ${order.discount ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #15803d;">
          <span>Giảm giá:</span>
          <span>-${formatPrice(order.discount)}</span>
        </div>
      ` : ""}
      <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #64748b;">
        <span>Phí giao hàng:</span>
        <span>${order.shippingFee ? formatPrice(order.shippingFee) : "Miễn phí"}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 16px; border-top: 1px solid #cbd5e1; padding-top: 8px;">
        <span>Tổng thanh toán:</span>
        <span style="color: #15803d;">${formatPrice(order.total)}</span>
      </div>
    </div>

    <h4 style="margin: 0 0 8px; font-size: 13.5px; font-weight: 700;">Lịch sử thay đổi trạng thái</h4>
    <div class="status-timeline">
      ${historyHtml}
    </div>
  `;

  // Print button click handler
  if (printBtn) {
    printBtn.onclick = () => {
      printOrderSlip(order);
    };
  }

  const closeModal = () => modal.classList.remove("show");
  if (closeBtn) closeBtn.onclick = closeModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;
  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };

  modal.classList.add("show");
}

function printOrderSlip(order) {
  const slipContainer = document.getElementById("printableOrderSlip");
  if (!slipContainer) return;

  const items = parseOrderItems(order);
  const itemsRows = items.map((i, idx) => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${idx + 1}</td>
      <td style="padding: 8px; border: 1px solid #ddd; font-family: monospace;">${escapeHtml(i.productId || i.id || "—")}</td>
      <td style="padding: 8px; border: 1px solid #ddd;"><strong>${escapeHtml(i.name)}</strong></td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatPrice(i.unitPrice || i.price || 0)}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${i.quantity || 1}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: right;"><strong>${formatPrice((i.unitPrice || i.price || 0) * (i.quantity || 1))}</strong></td>
    </tr>
  `).join("");

  slipContainer.innerHTML = `
    <div style="max-width: 800px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #15803d; padding-bottom: 16px; margin-bottom: 20px;">
        <div>
          <h2 style="margin: 0; color: #15803d; font-size: 24px;">EcoDesk Studio</h2>
          <p style="margin: 4px 0 0; font-size: 13px; color: #555;">Nội thất &amp; Setup công thái học hàng đầu Việt Nam</p>
          <p style="margin: 2px 0 0; font-size: 12px; color: #666;">Hotline: 1900 1234 · Website: www.ecodesk.vn</p>
        </div>
        <div style="text-align: right;">
          <h3 style="margin: 0; font-size: 18px; text-transform: uppercase; color: #1e293b;">Phiếu Chi Tiết Đơn Hàng</h3>
          <p style="margin: 4px 0 0; font-family: monospace; font-size: 14px; font-weight: bold; color: #15803d;">#${escapeHtml(order.id)}</p>
          <p style="margin: 2px 0 0; font-size: 12px; color: #555;">Ngày in: ${new Date().toLocaleString("vi-VN")}</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; font-size: 13.5px;">
        <div style="background: #f9fafb; padding: 14px; border: 1px solid #e5e7eb; border-radius: 6px;">
          <h4 style="margin: 0 0 8px; font-size: 14px; color: #111; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">Thông tin khách hàng</h4>
          <p style="margin: 4px 0;"><strong>Họ tên:</strong> ${escapeHtml(order.customer || order.customerName || "Chưa có dữ liệu")}</p>
          <p style="margin: 4px 0;"><strong>Số điện thoại:</strong> ${escapeHtml(order.customerPhone || "Chưa có dữ liệu")}</p>
          <p style="margin: 4px 0;"><strong>Email:</strong> ${escapeHtml(order.customerEmail || "Chưa có dữ liệu")}</p>
        </div>
        <div style="background: #f9fafb; padding: 14px; border: 1px solid #e5e7eb; border-radius: 6px;">
          <h4 style="margin: 0 0 8px; font-size: 14px; color: #111; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">Thông tin giao hàng &amp; Thanh toán</h4>
          <p style="margin: 4px 0;"><strong>Địa chỉ giao:</strong> ${escapeHtml(order.shippingAddress || "Chưa có dữ liệu")}</p>
          <p style="margin: 4px 0;"><strong>Vận chuyển:</strong> ${escapeHtml(order.shippingMethod || "Tiêu chuẩn")}</p>
          <p style="margin: 4px 0;"><strong>Phương thức:</strong> ${escapeHtml(order.paymentMethod || "Chuyển khoản QR")}</p>
          ${order.note ? `<p style="margin: 4px 0;"><strong>Ghi chú:</strong> ${escapeHtml(order.note)}</p>` : ""}
          <p style="margin: 4px 0;"><strong>Trạng thái đơn:</strong> ${escapeHtml(order.status || "Đang xử lý")}</p>
        </div>
      </div>

      <h4 style="margin: 0 0 8px; font-size: 14px;">Chi tiết sản phẩm đặt mua</h4>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
        <thead>
          <tr style="background: #f3f4f6;">
            <th style="padding: 8px; border: 1px solid #ddd; width: 40px;">STT</th>
            <th style="padding: 8px; border: 1px solid #ddd; width: 90px;">Mã SP</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Tên sản phẩm</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: right; width: 110px;">Đơn giá</th>
            <th style="padding: 8px; border: 1px solid #ddd; width: 60px;">SL</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: right; width: 120px;">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows || `<tr><td colspan="6" style="padding: 10px; text-align: center; border: 1px solid #ddd;">Chưa có dữ liệu sản phẩm</td></tr>`}
        </tbody>
      </table>

      <div style="display: flex; justify-content: flex-end; margin-bottom: 30px;">
        <div style="width: 280px; font-size: 14px;">
          <div style="display: flex; justify-content: space-between; padding: 4px 0;">
            <span>Tạm tính:</span>
            <strong>${formatPrice(order.subtotal || order.total)}</strong>
          </div>
          ${order.discount ? `
            <div style="display: flex; justify-content: space-between; padding: 4px 0; color: #15803d;">
              <span>Giảm giá (${escapeHtml(order.couponCode || "Ưu đãi")}):</span>
              <strong>-${formatPrice(order.discount)}</strong>
            </div>
          ` : ""}
          <div style="display: flex; justify-content: space-between; padding: 4px 0;">
            <span>Phí vận chuyển:</span>
            <strong>${order.shippingFee ? formatPrice(order.shippingFee) : "Miễn phí"}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-top: 2px solid #111; margin-top: 4px; font-size: 16px;">
            <strong>TỔNG CỘNG:</strong>
            <strong style="color: #15803d;">${formatPrice(order.total)}</strong>
          </div>
        </div>
      </div>

      <div style="border-top: 1px dashed #ccc; padding-top: 14px; text-align: center; font-size: 12px; color: #555;">
        <p style="margin: 0;">Cảm ơn Quý khách đã tin tưởng và đồng hành cùng EcoDesk Studio!</p>
        <p style="margin: 4px 0 0;">(Đây là phiếu thông tin chi tiết đơn hàng, không thay thế hóa đơn tài chính VAT)</p>
      </div>
    </div>
  `;

  window.print();
}

/* ==========================================================================
   TAB 3: QUẢN LÝ SẢN PHẨM (PRODUCTS) - IMPORT / EXPORT EXCEL
   ========================================================================== */
function fillProductFilters() {
  const catSelect = document.getElementById("productCategoryFilter");
  if (!catSelect) return;
  catSelect.innerHTML = `<option value="all">Tất cả danh mục (${products.length})</option>` +
    categories.map((c) => {
      const count = products.filter((p) => p.categoryId === c.id).length;
      return `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)} (${count})</option>`;
    }).join("");
}

function getVisibleProducts() {
  const query = productSearchQuery.trim().toLowerCase();
  const now = new Date();
  return products.filter((p) => {
    const catMatch = productCategoryFilter === "all" || p.categoryId === productCategoryFilter;
    if (!catMatch) return false;

    if (productStockFilter === "draft") return Boolean(p.isDraft || p.status === "Bản nháp");
    if (productStockFilter === "in_stock" && Number(p.stock) <= 0) return false;
    if (productStockFilter === "low_stock" && (Number(p.stock) <= 0 || Number(p.stock) > 15)) return false;
    if (productStockFilter === "out_stock" && Number(p.stock) > 0) return false;
    if (productStockFilter === "has_new_badge" && !getNewBadgeStatus(p, now).active) return false;
    if (productStockFilter === "has_discount" && !getDiscountPromotionStatus(p, now).active) return false;

    if (!query) return true;
    return (
      (p.name || "").toLowerCase().includes(query) ||
      (p.id || "").toLowerCase().includes(query)
    );
  });
}

function renderProductsTable() {
  const tbody = document.getElementById("fullProductsTable");
  if (!tbody) return;

  const filtered = getVisibleProducts();
  const now = new Date();

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #64748b; padding: 28px;">Không tìm thấy sản phẩm nào phù hợp bộ lọc.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((p) => {
    const hasVars = Array.isArray(p.variants) && p.variants.length > 0;
    const stockNum = hasVars
      ? p.variants.reduce((sum, v) => sum + Math.max(0, Number(v.stock) || 0), 0)
      : Number(p.stock || 0);

    const isDraft = Boolean(p.isDraft || p.status === "Bản nháp");
    const isOutOfStock = !isDraft && stockNum <= 0;
    const isLowStock = !isDraft && !isOutOfStock && stockNum <= 15;
    const stockColor = isDraft ? "#6366f1" : (isOutOfStock ? "#dc2626" : isLowStock ? "#d97706" : "#15803d");
    const statusLabel = isDraft ? "Bản nháp" : (isOutOfStock ? "Tạm hết hàng" : isLowStock ? "Sắp hết" : "Còn hàng");
    const statusBadgeClass = isDraft ? "pending" : (isOutOfStock ? "cancelled" : isLowStock ? "low-stock" : "completed");

    // 1. Phân tích trạng thái Nhãn Mới
    const nbStatus = getNewBadgeStatus(p, now);
    let nbHtml = "";
    if (nbStatus.status === "active") {
      nbHtml = `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-bottom: 2px;">
          <span style="font-size: 11px; padding: 2px 7px; border-radius: 999px; background: #dcfce7; color: #15803d; font-weight: 700; white-space: nowrap; display:inline-flex; align-items:center; gap:3px;">
            ${renderIcon("sparkles", { size: 11, strokeWidth: 2 })} Mới: Đang áp dụng
          </span>
          <button type="button" class="quick-admin-action" data-stop-newbadge="${escapeHtml(p.id)}" style="background: none; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 10px; padding: 1px 5px; cursor: pointer; color: #64748b;" title="Tắt nhãn Mới ngay">Tắt</button>
        </div>
        <div style="font-size: 10px; color: #64748b;">${escapeHtml(nbStatus.expiresAtText)}</div>
      `;
    } else if (nbStatus.status === "upcoming") {
      nbHtml = `
        <span style="font-size: 11px; padding: 2px 7px; border-radius: 999px; background: #e0f2fe; color: #0369a1; font-weight: 600; display: inline-flex; align-items:center; gap:3px;">
          ${renderIcon("clock", { size: 11, strokeWidth: 2 })} Mới: Chưa bắt đầu
        </span>
        <div style="font-size: 10px; color: #64748b; margin-top: 2px;">${escapeHtml(nbStatus.expiresAtText)}</div>
      `;
    } else if (nbStatus.status === "expired") {
      nbHtml = `
        <span style="font-size: 11px; padding: 2px 7px; border-radius: 999px; background: #f1f5f9; color: #94a3b8; font-weight: 600; display: inline-flex; align-items:center; gap:3px;">
          ${renderIcon("check", { size: 11, strokeWidth: 2 })} Mới: Đã kết thúc
        </span>
      `;
    } else {
      nbHtml = `<span style="font-size: 11px; color: #94a3b8;">Nhãn Mới: Đã tắt</span>`;
    }

    // 2. Phân tích trạng thái Khuyến Mãi
    const promoStatus = getDiscountPromotionStatus(p, now);
    let promoHtml = "";
    if (promoStatus.status === "active") {
      const valText = promoStatus.type === "fixed" ? `${Number(promoStatus.value || 0).toLocaleString("vi-VN")}đ` : `${promoStatus.value}%`;
      promoHtml = `
        <div style="margin-top: 5px; padding-top: 5px; border-top: 1px dashed #e2e8f0;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-bottom: 2px;">
            <span style="font-size: 11px; padding: 2px 7px; border-radius: 999px; background: #fee2e2; color: #dc2626; font-weight: 700; white-space: nowrap; display:inline-flex; align-items:center; gap:3px;">
              ${renderIcon("flame", { size: 11, strokeWidth: 2 })} -${valText} (Đang áp dụng)
            </span>
            <button type="button" class="quick-admin-action" data-stop-discount="${escapeHtml(p.id)}" style="background: none; border: 1px solid #fca5a5; border-radius: 4px; font-size: 10px; padding: 1px 5px; cursor: pointer; color: #dc2626;" title="Dừng khuyến mãi sớm">Dừng</button>
          </div>
          <div style="font-size: 10px; color: #64748b;">${escapeHtml(promoStatus.periodText)}</div>
        </div>
      `;
    } else if (promoStatus.status === "upcoming") {
      const valText = promoStatus.type === "fixed" ? `${Number(promoStatus.value || 0).toLocaleString("vi-VN")}đ` : `${promoStatus.value}%`;
      promoHtml = `
        <div style="margin-top: 5px; padding-top: 5px; border-top: 1px dashed #e2e8f0;">
          <span style="font-size: 11px; padding: 2px 7px; border-radius: 999px; background: #e0f2fe; color: #0369a1; font-weight: 600; display: inline-block;">
            ⏳ KM -${valText}: Chưa bắt đầu
          </span>
          <div style="font-size: 10px; color: #64748b; margin-top: 2px;">${escapeHtml(promoStatus.periodText)}</div>
        </div>
      `;
    } else if (promoStatus.status === "expired") {
      promoHtml = `
        <div style="margin-top: 5px; padding-top: 5px; border-top: 1px dashed #e2e8f0;">
          <span style="font-size: 11px; padding: 2px 7px; border-radius: 999px; background: #f1f5f9; color: #94a3b8; font-weight: 600; display: inline-block;">
            ⌛ KM: Đã kết thúc
          </span>
        </div>
      `;
    } else {
      promoHtml = `
        <div style="margin-top: 4px;">
          <span style="font-size: 11px; color: #94a3b8;">Khuyến mãi: Đã tắt</span>
        </div>
      `;
    }

    // 3. Thông tin chỉnh sửa gần nhất
    let auditInfoHtml = "";
    if (p.updatedAt) {
      const dateFormatted = new Date(p.updatedAt).toLocaleDateString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit"
      });
      auditInfoHtml = `<div style="font-size: 10px; color: #94a3b8; margin-top: 3px; display: flex; align-items: center; gap: 3px;">${renderIcon("edit-2", { size: 10, strokeWidth: 1.8 })} Sửa: ${dateFormatted}${p.updatedBy ? ` (${escapeHtml(p.updatedBy)})` : ""}</div>`;
    }

    let variantsSubHtml = "";
    if (hasVars) {
      variantsSubHtml = `
        <tr class="variants-expand-row" id="variants-expand-${escapeHtml(p.id)}" style="display: none; background: #f8fafc;">
          <td colspan="8" style="padding: 12px 18px; border-bottom: 2px solid #e2e8f0;">
            <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
                <strong style="color: #0f172a; font-size: 13px; display: inline-flex; align-items: center; gap: 6px;">${renderIcon("clipboard-list", { size: 14, strokeWidth: 1.8 })} Chi tiết tồn kho từng lựa chọn của "${escapeHtml(p.name)}" (${p.variants.length} biến thể)</strong>
                <button type="button" class="btn-inventory-edit-variant" data-edit-product="${escapeHtml(p.id)}" style="background: none; border: none; padding: 0; font-size: 12px; color: #15803d; font-weight: 600; text-decoration: underline; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">${renderIcon("settings", { size: 13, strokeWidth: 1.8 })} Sửa thông tin &amp; biến thể</button>
              </div>
              <div style="overflow-x: auto;">
                <table style="width: 100%; font-size: 12px; border-collapse: collapse; text-align: left;">
                  <thead style="background: #f1f5f9; color: #475569; font-weight: 700;">
                    <tr>
                      <th style="padding: 6px 8px;">Tổ hợp / Lựa chọn</th>
                      <th style="padding: 6px 8px;">Mã SKU</th>
                      <th style="padding: 6px 8px;">Giá bán</th>
                      <th style="padding: 6px 8px;">Tồn kho</th>
                      <th style="padding: 6px 8px;">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${p.variants.map((v) => {
                      let vName = cleanMojibake(v.name || "");
                      if ((!vName || /Ä|Ã|áº|á»|Báº|XÃ|[\uFFFD□]/.test(vName)) && v.options && typeof v.options === "object") {
                        vName = Object.values(v.options).map(cleanMojibake).filter(Boolean).join(" / ");
                      }
                      if (p.id === "P025") {
                        const p025Map = {
                          "P025-VAR-1": "Đen Stealth / Bản 4 đầu massage",
                          "P025-VAR-2": "Đen Stealth / Bản 6 đầu chuyên sâu",
                          "P025-VAR-3": "Xám Titan / Bản 4 đầu massage",
                          "P025-VAR-4": "Xám Titan / Bản 6 đầu chuyên sâu"
                        };
                        if (p025Map[v.id]) vName = p025Map[v.id];
                      }
                      return `
                      <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 6px 8px;"><strong>${escapeHtml(vName)}</strong></td>
                        <td style="padding: 6px 8px; font-family: monospace; color: #64748b;">${escapeHtml(v.sku || "-")}</td>
                        <td style="padding: 6px 8px; font-weight: 600;">${formatPrice(v.price || p.price)}</td>
                        <td style="padding: 6px 8px;">
                          <strong style="color: ${Number(v.stock) === 0 ? "#dc2626" : Number(v.stock) <= 15 ? "#d97706" : "#15803d"};">
                            ${Number(v.stock) || 0} chiếc
                          </strong>
                        </td>
                        <td style="padding: 6px 8px;">
                          <span class="status-badge ${Number(v.stock) === 0 ? "cancelled" : Number(v.stock) <= 15 ? "low-stock" : "completed"}" style="font-size: 11px;">
                            ${Number(v.stock) === 0 ? "Tạm hết" : Number(v.stock) <= 15 ? "Sắp hết" : "Còn hàng"}
                          </span>
                        </td>
                      </tr>
                    `;
                    }).join("")}
                  </tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>
      `;
    }

    return `
      <tr>
        <td style="width: 60px;">
          <img src="${p.image}" alt="${escapeHtml(p.name)}" style="width: 46px; height: 46px; object-fit: cover; border-radius: 6px; border: 1px solid #e2e8f0; background: #fff;">
        </td>
        <td>
          <strong>${escapeHtml(p.name)}</strong>
          <br><small style="color: #64748b;">Mã: ${escapeHtml(p.id)}</small>
          ${auditInfoHtml}
          ${hasVars ? `
            <div style="margin-top: 4px;">
              <button type="button" class="btn-toggle-subvariants" data-toggle-subvar="${escapeHtml(p.id)}" style="background: none; border: none; padding: 0; color: #0284c7; cursor: pointer; font-size: 11.5px; font-weight: 600; text-decoration: underline; display:inline-flex; align-items:center; gap:4px;">
                ${renderIcon("eye", { size: 12, strokeWidth: 2 })} Xem ${p.variants.length} biến thể
              </button>
            </div>
          ` : ""}
        </td>
        <td>${getCategoryName(categories, p.categoryId)}</td>
        <td><strong>${formatPrice(p.price)}</strong></td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <strong style="color: ${stockColor}; min-width: 20px;">${stockNum}</strong>
            <div style="flex: 1; height: 5px; background: #e2e8f0; border-radius: 3px; max-width: 60px; overflow: hidden;">
              <div style="height: 100%; width: ${Math.min(100, (stockNum / 30) * 100)}%; background: ${stockColor};"></div>
            </div>
          </div>
          <div style="margin-top: 4px;">
            <span class="status-badge ${statusBadgeClass}" style="font-size: 10.5px; padding: 2px 6px;">${statusLabel}</span>
          </div>
        </td>
        <td style="min-width: 170px;">
          ${nbHtml}
          ${promoHtml}
        </td>
        <td>${p.sold || 0}</td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="table-action-btn" type="button" data-edit-product="${escapeHtml(p.id)}">Sửa</button>
            <button class="table-action-btn danger" type="button" data-delete-product="${escapeHtml(p.id)}">Xóa</button>
          </div>
        </td>
      </tr>
      ${variantsSubHtml}
    `;
  }).join("");
}

function bindProductsEvents() {
  const catSelect = document.getElementById("productCategoryFilter");
  if (catSelect) {
    catSelect.addEventListener("change", (e) => {
      productCategoryFilter = e.target.value;
      renderProductsTable();
    });
  }

  const stockSelect = document.getElementById("productStockFilter");
  if (stockSelect) {
    stockSelect.addEventListener("change", (e) => {
      productStockFilter = e.target.value;
      renderProductsTable();
    });
  }

  const searchInput = document.getElementById("productSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      productSearchQuery = e.target.value;
      renderProductsTable();
    });
  }

  // Click mở rộng xem chi tiết biến thể trong bảng sản phẩm
  document.addEventListener("click", (e) => {
    const toggleBtn = e.target.closest("[data-toggle-subvar]");
    if (toggleBtn) {
      const pId = toggleBtn.dataset.toggleSubvar;
      const subRow = document.getElementById(`variants-expand-${pId}`);
      if (subRow) {
        const isVisible = subRow.style.display !== "none";
        subRow.style.display = isVisible ? "none" : "table-row";
        const count = toggleBtn.textContent.replace(/\D/g, "");
        toggleBtn.innerHTML = isVisible ? `${renderIcon("eye", { size: 12, strokeWidth: 2 })} Xem ${count} biến thể` : `${renderIcon("chevron-up", { size: 12, strokeWidth: 2 })} Thu gọn biến thể`;
      }
    }
  });

  // Click thao tác nhanh: Tắt nhãn Mới sớm hoặc Dừng khuyến mãi sớm
  document.addEventListener("click", async (e) => {
    const stopNewBtn = e.target.closest("[data-stop-newbadge]");
    if (stopNewBtn) {
      const pId = stopNewBtn.dataset.stopNewbadge;
      const targetP = products.find((p) => String(p.id) === String(pId));
      if (targetP && targetP.newBadge) {
        const nextBadge = { ...targetP.newBadge, enabled: false };
        await updateProduct(pId, { newBadge: nextBadge });
        products = getProducts();
        renderProductsTable();
        showToast(`Đã tắt hiển thị nhãn "Mới" cho sản phẩm "${targetP.name}".`);
      }
      return;
    }

    const stopPromoBtn = e.target.closest("[data-stop-discount]");
    if (stopPromoBtn) {
      const pId = stopPromoBtn.dataset.stopDiscount;
      const targetP = products.find((p) => String(p.id) === String(pId));
      if (targetP && targetP.discount) {
        const nextDiscount = { ...targetP.discount, enabled: false };
        await updateProduct(pId, { discount: nextDiscount });
        products = getProducts();
        renderProductsTable();
        showToast(`Đã dừng chương trình khuyến mãi của "${targetP.name}". Giá bán đã khôi phục giá thường.`);
      }
      return;
    }
  });

  let savedBodyOverflow = "";
  let savedDocOverflow = "";

  function lockBodyScroll() {
    savedBodyOverflow = document.body.style.overflow;
    savedDocOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
  }

  function unlockBodyScroll() {
    document.body.style.overflow = savedBodyOverflow;
    document.documentElement.style.overflow = savedDocOverflow;
  }

  // ==================== DELETE / ACTION PRODUCT MODAL ====================
  const deleteModal = document.getElementById("deleteProductModalBackdrop");
  const deleteCloseBtn = document.getElementById("deleteProductModalCloseBtn");
  const deleteCancelBtn = document.getElementById("deleteProductModalCancelBtn");
  const deleteConfirmBtn = document.getElementById("deleteProductModalConfirmBtn");
  const deleteConfirmText = document.getElementById("deleteProductModalConfirmText");
  const deleteNameEl = document.getElementById("deleteProductModalName");
  const deleteCodeEl = document.getElementById("deleteProductModalCode");
  const deleteCategoryEl = document.getElementById("deleteProductModalCategory");
  const deletePriceEl = document.getElementById("deleteProductModalPrice");
  const deleteStockEl = document.getElementById("deleteProductModalStock");
  const deleteImgEl = document.getElementById("deleteProductModalImg");
  const deleteOrderWarning = document.getElementById("deleteProductModalOrderWarning");
  const deleteOrderWarningText = document.getElementById("deleteProductModalOrderWarningText");

  const actionCardHide = document.getElementById("actionCardHide");
  const actionCardOutOfStock = document.getElementById("actionCardOutOfStock");
  const actionCardDelete = document.getElementById("actionCardDelete");
  const actionChoiceHide = document.getElementById("actionChoiceHide");
  const actionChoiceOutOfStock = document.getElementById("actionChoiceOutOfStock");
  const actionChoiceDelete = document.getElementById("actionChoiceDelete");

  const deleteReasonSelect = document.getElementById("deleteProductModalReason");
  const deleteReasonError = document.getElementById("deleteProductModalReasonError");
  const deleteCustomReasonWrap = document.getElementById("deleteProductModalCustomReasonWrap");
  const deleteCustomReason = document.getElementById("deleteProductModalCustomReason");
  const deleteCustomReasonError = document.getElementById("deleteProductModalCustomReasonError");
  const deleteErrorEl = document.getElementById("deleteProductModalError");

  let productPendingDelete = null;
  let lastDeleteTriggerBtn = null;
  let isDeletingProduct = false;

  function getProductOrderStats(productId) {
    let ordersCount = 0;
    let totalSoldQuantity = 0;
    const allOrders = getOrders();

    for (const o of allOrders) {
      if (!o || String(o.status || "").trim().toLowerCase() === "đã hủy") continue;
      let items = [];
      if (o.itemsJson) {
        try { items = JSON.parse(o.itemsJson); } catch (e) {}
      } else if (Array.isArray(o.items)) {
        items = o.items;
      }
      const matched = items.filter((it) => String(it.productId || it.id) === String(productId));
      if (matched.length > 0) {
        ordersCount++;
        if (isOrderCompletedForSales(o.status)) {
          totalSoldQuantity += matched.reduce((sum, it) => sum + (Math.max(1, Number(it.quantity) || 1)), 0);
        }
      }
    }
    return { ordersCount, totalSoldQuantity };
  }

  function getSelectedAction() {
    const checked = document.querySelector('input[name="deleteActionChoice"]:checked');
    return checked ? checked.value : "delete";
  }

  function updateActionCardStyles() {
    const currentAction = getSelectedAction();
    [actionCardHide, actionCardOutOfStock, actionCardDelete].forEach((card) => {
      if (!card) return;
      card.classList.remove("active-safe", "active-danger");
    });

    if (currentAction === "hide" && actionCardHide) {
      actionCardHide.classList.add("active-safe");
    } else if (currentAction === "out_of_stock" && actionCardOutOfStock) {
      actionCardOutOfStock.classList.add("active-safe");
    } else if (currentAction === "delete" && actionCardDelete) {
      actionCardDelete.classList.add("active-danger");
    }

    // Cập nhật nhãn và màu sắc nút xác nhận tương ứng
    if (deleteConfirmBtn) {
      deleteConfirmBtn.classList.remove("primary", "danger", "secondary");
      if (currentAction === "hide") {
        deleteConfirmBtn.classList.add("primary");
        if (deleteConfirmText) deleteConfirmText.textContent = "Ẩn khỏi cửa hàng";
      } else if (currentAction === "out_of_stock") {
        deleteConfirmBtn.classList.add("secondary");
        if (deleteConfirmText) deleteConfirmText.textContent = "Đánh dấu hết hàng";
      } else {
        deleteConfirmBtn.classList.add("danger");
        if (deleteConfirmText) deleteConfirmText.textContent = "Xóa sản phẩm";
      }
    }
  }

  function validateDeleteReason() {
    if (!deleteReasonSelect) return false;
    const reason = deleteReasonSelect.value.trim();
    if (deleteReasonError) {
      deleteReasonError.textContent = "";
      deleteReasonError.classList.remove("show");
    }
    if (deleteCustomReasonError) {
      deleteCustomReasonError.textContent = "";
      deleteCustomReasonError.classList.remove("show");
    }

    if (!reason) {
      if (deleteConfirmBtn) deleteConfirmBtn.disabled = true;
      return false;
    }

    if (reason === "Khác") {
      const customVal = deleteCustomReason ? deleteCustomReason.value.trim() : "";
      if (customVal.length < 3) {
        if (deleteConfirmBtn) deleteConfirmBtn.disabled = true;
        return false;
      }
    }

    if (deleteConfirmBtn) deleteConfirmBtn.disabled = false;
    return true;
  }

  if (deleteReasonSelect) {
    deleteReasonSelect.addEventListener("change", () => {
      const isOther = deleteReasonSelect.value === "Khác";
      if (deleteCustomReasonWrap) {
        deleteCustomReasonWrap.style.display = isOther ? "flex" : "none";
      }
      if (isOther && deleteCustomReason) {
        setTimeout(() => deleteCustomReason.focus(), 60);
      }
      validateDeleteReason();
    });
  }

  if (deleteCustomReason) {
    deleteCustomReason.addEventListener("input", () => {
      validateDeleteReason();
    });
  }

  document.querySelectorAll('input[name="deleteActionChoice"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      updateActionCardStyles();
      validateDeleteReason();
    });
  });

  function openDeleteModal(prod, triggerBtn) {
    if (!deleteModal || !prod) return;
    productPendingDelete = prod;
    lastDeleteTriggerBtn = triggerBtn || document.activeElement;
    isDeletingProduct = false;

    // 1. Điền thông tin sản phẩm
    if (deleteNameEl) deleteNameEl.textContent = prod.name;
    if (deleteCodeEl) deleteCodeEl.textContent = prod.id;
    if (deleteCategoryEl) deleteCategoryEl.textContent = getCategoryName(categories, prod.categoryId);
    if (deletePriceEl) deletePriceEl.textContent = formatPrice(prod.price);
    if (deleteStockEl) deleteStockEl.textContent = `${prod.stock || 0} cái`;
    if (deleteImgEl) {
      deleteImgEl.src = prod.image || "./images/combo-minimal-white.png";
      deleteImgEl.alt = prod.name || "Sản phẩm";
    }

    // 2. Kiểm tra nếu sản phẩm có đơn hàng / lượt bán
    const { ordersCount, totalSoldQuantity } = getProductOrderStats(prod.id);
    const hasOrderHistory = ordersCount > 0 || totalSoldQuantity > 0 || Number(prod.sold || 0) > 0;

    if (deleteOrderWarning) {
      if (hasOrderHistory) {
        deleteOrderWarning.style.display = "block";
        if (deleteOrderWarningText) {
          const soldCount = totalSoldQuantity || prod.sold || 0;
          deleteOrderWarningText.innerHTML = `Sản phẩm này đã có <strong>${ordersCount} đơn hàng</strong> (tổng cộng <strong>${soldCount} lượt bán</strong>). Hệ thống ưu tiên đề xuất chọn <strong>“Ẩn khỏi cửa hàng / Ngừng kinh doanh”</strong> thay vì xóa vĩnh viễn để bảo toàn toàn vẹn dữ liệu đơn hàng và doanh thu.`;
        }
        if (actionChoiceHide) actionChoiceHide.checked = true;
      } else {
        deleteOrderWarning.style.display = "none";
        if (actionChoiceDelete) actionChoiceDelete.checked = true;
      }
    }

    // 3. Reset lý do & lỗi
    if (deleteReasonSelect) deleteReasonSelect.value = "";
    if (deleteCustomReasonWrap) deleteCustomReasonWrap.style.display = "none";
    if (deleteCustomReason) deleteCustomReason.value = "";
    if (deleteErrorEl) {
      deleteErrorEl.textContent = "";
      deleteErrorEl.style.display = "none";
    }

    updateActionCardStyles();
    validateDeleteReason();

    // 4. Mở modal & khóa cuộn trang
    deleteModal.classList.add("show");
    lockBodyScroll();

    setTimeout(() => {
      if (deleteReasonSelect && typeof deleteReasonSelect.focus === "function") {
        deleteReasonSelect.focus();
      }
    }, 60);
  }

  function closeDeleteModal() {
    if (!deleteModal || isDeletingProduct) return;
    deleteModal.classList.remove("show");
    unlockBodyScroll();

    if (deleteErrorEl) {
      deleteErrorEl.textContent = "";
      deleteErrorEl.style.display = "none";
    }

    if (lastDeleteTriggerBtn && typeof lastDeleteTriggerBtn.focus === "function" && document.body.contains(lastDeleteTriggerBtn)) {
      lastDeleteTriggerBtn.focus();
    }

    productPendingDelete = null;
    lastDeleteTriggerBtn = null;
    isDeletingProduct = false;
  }

  if (deleteCloseBtn) {
    deleteCloseBtn.addEventListener("click", closeDeleteModal);
  }
  if (deleteCancelBtn) {
    deleteCancelBtn.addEventListener("click", closeDeleteModal);
  }

  if (deleteModal) {
    deleteModal.addEventListener("click", (e) => {
      if (e.target === deleteModal && !isDeletingProduct) {
        closeDeleteModal();
      }
    });

    // Trap focus inside delete modal
    deleteModal.addEventListener("keydown", (e) => {
      if (e.key === "Tab") {
        const focusables = Array.from(deleteModal.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])"));
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && deleteModal && deleteModal.classList.contains("show") && !isDeletingProduct) {
      closeDeleteModal();
    }
  });

  if (deleteConfirmBtn) {
    deleteConfirmBtn.addEventListener("click", async () => {
      if (!productPendingDelete || isDeletingProduct) return;

      const reason = deleteReasonSelect ? deleteReasonSelect.value.trim() : "";
      if (!reason) {
        if (deleteReasonError) {
          deleteReasonError.textContent = "Vui lòng chọn lý do trước khi tiếp tục.";
          deleteReasonError.classList.add("show");
        }
        deleteReasonSelect?.focus();
        return;
      }

      let customReason = "";
      if (reason === "Khác") {
        const customVal = deleteCustomReason ? deleteCustomReason.value.trim() : "";
        if (customVal.length < 3) {
          if (deleteCustomReasonError) {
            deleteCustomReasonError.textContent = "Vui lòng nhập lý do cụ thể (tối thiểu 3 ký tự).";
            deleteCustomReasonError.classList.add("show");
          }
          deleteCustomReason?.focus();
          return;
        }
        customReason = customVal;
      }

      const finalReason = reason === "Khác" ? `Khác: ${customReason}` : reason;
      const selectedAction = getSelectedAction();
      const currentUser = getCurrentUser();
      const operatorName = currentUser ? `${currentUser.name} (${currentUser.email || currentUser.id})` : "Quản trị viên";

      isDeletingProduct = true;
      deleteConfirmBtn.disabled = true;
      if (deleteCancelBtn) deleteCancelBtn.disabled = true;
      if (deleteCloseBtn) deleteCloseBtn.disabled = true;
      if (deleteConfirmText) deleteConfirmText.textContent = "Đang xử lý...";
      if (deleteErrorEl) {
        deleteErrorEl.style.display = "none";
        deleteErrorEl.textContent = "";
      }

      const prodId = productPendingDelete.id;
      const prodName = productPendingDelete.name;

      try {
        if (selectedAction === "delete") {
          // 1. Xóa vĩnh viễn khỏi danh sách quản lý
          await deleteProduct(prodId);
          addAuditLog({
            action: "DELETE_PRODUCT",
            productId: prodId,
            productName: prodName,
            reason: finalReason,
            performedBy: operatorName,
            details: `Xóa vĩnh viễn sản phẩm khỏi hệ thống. Tồn kho lúc xóa: ${productPendingDelete.stock || 0}, Đã bán: ${productPendingDelete.sold || 0}`
          });
          showToast(`Đã xóa vĩnh viễn sản phẩm "${prodName}".`);
        } else if (selectedAction === "hide") {
          // 2. Ẩn khỏi cửa hàng / Ngừng kinh doanh
          await updateProduct(prodId, { ...productPendingDelete, status: "Ngừng kinh doanh" });
          addAuditLog({
            action: "HIDE_PRODUCT",
            productId: prodId,
            productName: prodName,
            reason: finalReason,
            performedBy: operatorName,
            details: `Ngừng kinh doanh & ẩn khỏi cửa hàng. Tồn kho: ${productPendingDelete.stock || 0}, Đã bán: ${productPendingDelete.sold || 0}`
          });
          showToast(`Đã chuyển sản phẩm "${prodName}" sang trạng thái Ngừng kinh doanh.`);
        } else if (selectedAction === "out_of_stock") {
          // 3. Đánh dấu hết hàng
          await updateProduct(prodId, { ...productPendingDelete, stock: 0, status: "Hết hàng" });
          addAuditLog({
            action: "MARK_OUT_OF_STOCK",
            productId: prodId,
            productName: prodName,
            reason: finalReason,
            performedBy: operatorName,
            details: `Đánh dấu hết hàng (tồn kho = 0). Đã bán: ${productPendingDelete.sold || 0}`
          });
          showToast(`Đã cập nhật sản phẩm "${prodName}" thành Hết hàng.`);
        }

        // Cập nhật lại toàn bộ danh sách và giao diện
        products = getProducts();
        categories = getCategories();
        renderKPIs();
        renderOverviewLists();
        fillProductFilters();
        renderProductsTable();
        renderCategoriesTable();
        renderInventoryTable();
        fillProductSelects();

        isDeletingProduct = false;
        deleteModal.classList.remove("show");
        unlockBodyScroll();
        productPendingDelete = null;
        lastDeleteTriggerBtn = null;
      } catch (err) {
        console.error("Lỗi khi xử lý sản phẩm:", err);
        isDeletingProduct = false;
        deleteConfirmBtn.disabled = false;
        if (deleteCancelBtn) deleteCancelBtn.disabled = false;
        if (deleteCloseBtn) deleteCloseBtn.disabled = false;
        updateActionCardStyles();
        if (deleteErrorEl) {
          deleteErrorEl.textContent = "Không thể xử lý sản phẩm: " + (err.message || "Đã xảy ra lỗi, vui lòng thử lại.");
          deleteErrorEl.style.display = "block";
        }
        deleteConfirmBtn.focus();
      }
    });
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-delete-product]");
    if (!btn) return;

    const id = btn.dataset.deleteProduct;
    const prod = products.find((p) => p.id === id);
    if (!prod) return;

    openDeleteModal(prod, btn);
  });

  // Export Products to Excel
  const exportBtn = document.getElementById("exportProductsBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const visible = getVisibleProducts();
      if (visible.length === 0) {
        showToast("Không có sản phẩm nào phù hợp bộ lọc để xuất.");
        return;
      }

      const rows = visible.map((p) => ({
        "Mã sản phẩm": p.id,
        "Tên sản phẩm": p.name,
        "Mã danh mục": p.categoryId,
        "Tên danh mục": getCategoryName(categories, p.categoryId),
        "Giá bán (VNĐ)": Number(p.price || 0),
        "Số lượng tồn kho": Number(p.stock || 0),
        "Đã bán": Number(p.sold || 0),
        "Tình trạng": p.status || "Còn hàng",
        "Mô tả": p.description || "",
        "Link ảnh": p.image || "",
        "Nhãn tags": Array.isArray(p.tags) ? p.tags.join(", ") : (p.tagsRaw || ""),
        "Ngày tạo": p.createdAt || ""
      }));

      exportToExcel(rows, "ecodesk-danh-sach-san-pham", "Sản phẩm");
      showToast(`Đã xuất ${rows.length} sản phẩm ra file Excel.`);
    });
  }

  // Import Products from Excel
  const importBtn = document.getElementById("importProductsBtn");
  const fileInput = document.getElementById("productExcelFileInput");
  if (importBtn && fileInput) {
    importBtn.addEventListener("click", () => {
      fileInput.value = "";
      fileInput.click();
    });

    fileInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const rawRows = await readExcelFile(file);
        if (rawRows.length === 0) {
          showToast("File Excel không có dữ liệu dòng nào.");
          return;
        }

        const validCategories = new Map(categories.map((c) => [c.id.toLowerCase(), c.id]));
        const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
        const existingIds = new Set(products.map((p) => p.id.toLowerCase()));
        const fileIds = new Set();

        const previewRows = rawRows.map((row, idx) => {
          const rowNum = idx + 2;
          const id = String(row["Mã sản phẩm"] || row["Mã SP"] || row["id"] || row["ID"] || "").trim();
          const name = String(row["Tên sản phẩm"] || row["Tên SP"] || row["name"] || row["Name"] || "").trim();
          const rawCat = String(row["Mã danh mục"] || row["Danh mục"] || row["categoryId"] || row["category"] || "").trim();
          const price = Number(row["Giá bán (VNĐ)"] || row["Giá bán"] || row["Giá"] || row["price"] || row["Price"]);
          const stock = Number(row["Số lượng tồn kho"] || row["Tồn kho"] || row["stock"] || row["Stock"]);
          const description = String(row["Mô tả"] || row["description"] || "").trim();
          const image = String(row["Link ảnh"] || row["Ảnh"] || row["image"] || "./images/combo-minimal-white.png").trim();
          const status = String(row["Tình trạng"] || row["Trạng thái"] || row["status"] || "Còn hàng").trim();

          // Resolve Category
          let matchedCatId = validCategories.get(rawCat.toLowerCase()) || categoryByName.get(rawCat.toLowerCase());

          let error = "";
          if (!name) {
            error = "Thiếu tên sản phẩm";
          } else if (isNaN(price) || price <= 0) {
            error = "Giá bán không hợp lệ (phải là số > 0)";
          } else if (isNaN(stock) || stock < 0) {
            error = "Số lượng tồn kho không hợp lệ";
          } else if (!matchedCatId) {
            error = `Danh mục "${rawCat}" không tồn tại`;
          } else if (id && existingIds.has(id.toLowerCase())) {
            error = `Mã "${id}" đã có trong hệ thống`;
          } else if (id && fileIds.has(id.toLowerCase())) {
            error = `Mã "${id}" bị trùng lặp trong file`;
          }

          if (id) fileIds.add(id.toLowerCase());

          return {
            isValid: !error,
            error,
            values: [id || "(Tự sinh)", name, matchedCatId || rawCat, isNaN(price) ? "—" : formatPrice(price), isNaN(stock) ? "—" : stock, status],
            rawProduct: {
              id: id || `P${Date.now()}_${idx}`,
              name,
              categoryId: matchedCatId,
              price: isNaN(price) ? 0 : price,
              stock: isNaN(stock) ? 0 : stock,
              description,
              image,
              status
            }
          };
        });

        const validRows = previewRows.filter((r) => r.isValid);
        const errorRows = previewRows.filter((r) => !r.isValid);

        openExcelPreviewModal({
          title: "Xác nhận nhập sản phẩm từ Excel",
          summaryText: `File: <strong>${escapeHtml(file.name)}</strong> · Tổng số: <strong>${rawRows.length}</strong> dòng · <strong style="color: #15803d;">${validRows.length} hợp lệ</strong> · <strong style="color: #dc2626;">${errorRows.length} lỗi</strong>.`,
          columns: ["Mã SP", "Tên sản phẩm", "Danh mục", "Giá bán", "Tồn kho", "Trạng thái"],
          rows: previewRows,
          onConfirm: async () => {
            for (const r of validRows) {
              await createProduct(r.rawProduct);
            }
            products = getProducts();
            renderKPIs();
            renderOverviewLists();
            renderProductsTable();
            renderInventoryTable();
            fillProductSelects();
            showToast(`Nhập thành công ${validRows.length} sản phẩm mới vào hệ thống!`);
          }
        });
      } catch (err) {
        showToast("Lỗi đọc file: " + err.message);
      }
    });
  }

  // ==================== PRODUCT MODAL (THÊM & SỬA SẢN PHẨM) ====================
  const openAddBtn = document.getElementById("openAddProductModalBtn");
  const overviewAddBtn = document.getElementById("overviewAddProductBtn");
  const navAddBtn = document.getElementById("navAddProductBtn");

  if (openAddBtn) openAddBtn.addEventListener("click", () => openProductModal(openAddBtn, null));
  if (overviewAddBtn) overviewAddBtn.addEventListener("click", () => openProductModal(overviewAddBtn, null));
  if (navAddBtn) navAddBtn.addEventListener("click", () => openProductModal(navAddBtn, null));

  initProductModal({
    onProductSaved: (savedProduct, createPoAfter) => {
      products = getProducts();
      categories = getCategories();
      renderKPIs();
      renderOverviewLists();
      fillProductFilters();
      renderProductsTable();
      renderCategoriesTable();
      renderInventoryTable();
      fillProductSelects();

      if (createPoAfter) {
        switchTab("inventory");
        switchInventorySubtab("purchases");
        openCreatePurchaseModal({
          productId: savedProduct.id,
          productName: savedProduct.name,
          quantity: Math.max(1, savedProduct.stock || 10),
          unitCost: savedProduct.costPrice || 0
        });
        showToast(`Đã lưu sản phẩm "${savedProduct.name}" (#${savedProduct.id}). Mời bạn nhập thông tin phiếu nhập đầu tiên.`);
      } else {
        switchTab("products");
      }
    }
  });

  // Event delegation cho tất cả nút [data-edit-product]
  document.addEventListener("click", (e) => {
    const editBtn = e.target.closest("[data-edit-product]");
    if (!editBtn) return;
    const prodId = editBtn.dataset.editProduct;
    if (prodId) {
      openProductModal(editBtn, prodId);
    }
  });
}

/* ==========================================================================
   TAB 4: QUẢN LÝ DANH MỤC (CATEGORIES) - THÊM, SỬA, XÓA, EXCEL
   ========================================================================== */
function renderCategoriesTable() {
  const tbody = document.getElementById("categoriesTable");
  if (!tbody) return;

  tbody.innerHTML = categories.map((cat) => {
    const catProds = products.filter((p) => p.categoryId === cat.id);
    const catStock = catProds.reduce((sum, p) => sum + Number(p.stock || 0), 0);
    const catSold = catProds.reduce((sum, p) => sum + Number(p.sold || 0), 0);

    return `
      <tr>
        <td><code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-weight: 600;">${escapeHtml(cat.id)}</code></td>
        <td><strong>${escapeHtml(cat.name)}</strong></td>
        <td><strong>${catProds.length}</strong> sản phẩm</td>
        <td>${catStock} trong kho</td>
        <td><strong style="color: #15803d;">${catSold}</strong> đã bán</td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="table-action-btn" type="button" data-edit-category="${escapeHtml(cat.id)}">Sửa</button>
            <button class="table-action-btn danger" type="button" data-delete-category="${escapeHtml(cat.id)}">Xóa</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function bindCategoriesEvents() {
  const addBtn = document.getElementById("addCategoryBtn");
  const modal = document.getElementById("categoryModalBackdrop");
  const form = document.getElementById("categoryModalForm");
  const modeInput = document.getElementById("categoryMode");
  const idInput = document.getElementById("categoryInputId");
  const nameInput = document.getElementById("categoryInputName");
  const title = document.getElementById("categoryModalTitle");
  const closeBtn = document.getElementById("categoryModalCloseBtn");
  const cancelBtn = document.getElementById("categoryModalCancelBtn");

  const closeModal = () => modal.classList.remove("show");
  if (closeBtn) closeBtn.onclick = closeModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;

  if (addBtn) {
    addBtn.addEventListener("click", () => {
      modeInput.value = "create";
      title.textContent = "Thêm danh mục mới";
      idInput.value = "";
      idInput.disabled = false;
      nameInput.value = "";
      modal.classList.add("show");
    });
  }

  // Edit category
  document.addEventListener("click", (e) => {
    const editBtn = e.target.closest("[data-edit-category]");
    if (!editBtn) return;
    const catId = editBtn.dataset.editCategory;
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;

    modeInput.value = "edit";
    title.textContent = `Chỉnh sửa danh mục #${cat.id}`;
    idInput.value = cat.id;
    idInput.disabled = true;
    nameInput.value = cat.name;
    modal.classList.add("show");
  });

  // Save category form
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const mode = modeInput.value;
      const rawId = idInput.value.trim().toLowerCase();
      const name = nameInput.value.trim();

      if (!name) {
        alert("Tên danh mục không được để trống.");
        return;
      }

      if (mode === "create") {
        if (!rawId) {
          alert("Mã danh mục không được để trống.");
          return;
        }
        if (!/^[a-z0-9_-]+$/.test(rawId)) {
          alert("Mã danh mục chỉ được chứa chữ cái thường không dấu, số, dấu gạch ngang hoặc gạch dưới.");
          return;
        }
        if (categories.some((c) => c.id.toLowerCase() === rawId)) {
          alert(`Mã danh mục "${rawId}" đã tồn tại. Vui lòng chọn mã khác.`);
          return;
        }

        await createCategory({ id: rawId, name });
        showToast(`Đã tạo mới danh mục "${name}".`);
      } else {
        const catId = idInput.value;
        await updateCategory(catId, { name });
        showToast(`Đã cập nhật danh mục "${name}".`);
      }

      categories = getCategories();
      closeModal();
      renderCategoriesTable();
      fillProductFilters();
      renderProductsTable();
    });
  }

  // Delete category with child products constraint check
  document.addEventListener("click", async (e) => {
    const delBtn = e.target.closest("[data-delete-category]");
    if (!delBtn) return;
    const catId = delBtn.dataset.deleteCategory;
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;

    const relatedProducts = products.filter((p) => p.categoryId === cat.id);
    if (relatedProducts.length > 0) {
      alert(`CHẶN THAO TÁC: Không thể xóa danh mục "${cat.name}" vì đang có ${relatedProducts.length} sản phẩm thuộc danh mục này! Vui lòng chuyển danh mục hoặc xóa các sản phẩm liên quan trước.`);
      return;
    }

    if (!confirm(`Bạn có chắc chắn muốn xóa danh mục "${cat.name}" không?`)) return;

    await deleteCategory(cat.id);
    categories = getCategories();
    renderCategoriesTable();
    fillProductFilters();
    renderProductsTable();
    showToast(`Đã xóa danh mục "${cat.name}".`);
  });

  // Export categories to Excel
  const exportBtn = document.getElementById("exportCategoriesBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const rows = categories.map((cat) => {
        const catProds = products.filter((p) => p.categoryId === cat.id);
        const catStock = catProds.reduce((sum, p) => sum + Number(p.stock || 0), 0);
        const catSold = catProds.reduce((sum, p) => sum + Number(p.sold || 0), 0);
        return {
          "Mã danh mục": cat.id,
          "Tên danh mục": cat.name,
          "Số lượng sản phẩm": catProds.length,
          "Tổng hàng tồn kho": catStock,
          "Tổng sản phẩm đã bán": catSold
        };
      });

      exportToExcel(rows, "ecodesk-danh-muc-san-pham", "Danh mục");
      showToast("Đã xuất danh mục ra file Excel (.xlsx).");
    });
  }

  // Import categories from Excel
  const importBtn = document.getElementById("importCategoriesBtn");
  const fileInput = document.getElementById("categoryExcelFileInput");
  if (importBtn && fileInput) {
    importBtn.addEventListener("click", () => {
      fileInput.value = "";
      fileInput.click();
    });

    fileInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        const rawRows = await readExcelFile(file);
        if (rawRows.length === 0) {
          showToast("File Excel danh mục không có dữ liệu dòng nào.");
          return;
        }

        const existingIds = new Set(categories.map((c) => c.id.toLowerCase()));
        const fileIds = new Set();

        const previewRows = rawRows.map((row, idx) => {
          const rawId = String(row["Mã danh mục"] || row["Mã"] || row["id"] || row["ID"] || "").trim().toLowerCase();
          const name = String(row["Tên danh mục"] || row["Tên"] || row["name"] || row["Name"] || "").trim();

          let error = "";
          if (!rawId) {
            error = "Thiếu mã danh mục";
          } else if (!/^[a-z0-9_-]+$/.test(rawId)) {
            error = "Mã chứa ký tự không hợp lệ";
          } else if (!name) {
            error = "Thiếu tên danh mục";
          } else if (existingIds.has(rawId)) {
            error = `Mã "${rawId}" đã tồn tại trong hệ thống`;
          } else if (fileIds.has(rawId)) {
            error = `Mã "${rawId}" bị trùng lặp trong file`;
          }

          if (rawId) fileIds.add(rawId);

          return {
            isValid: !error,
            error,
            values: [rawId, name],
            category: { id: rawId, name }
          };
        });

        const validRows = previewRows.filter((r) => r.isValid);
        const errorRows = previewRows.filter((r) => !r.isValid);

        openExcelPreviewModal({
          title: "Xác nhận nhập danh mục từ Excel",
          summaryText: `File: <strong>${escapeHtml(file.name)}</strong> · Tổng số: <strong>${rawRows.length}</strong> dòng · <strong style="color: #15803d;">${validRows.length} hợp lệ</strong> · <strong style="color: #dc2626;">${errorRows.length} lỗi</strong>.`,
          columns: ["Mã danh mục", "Tên danh mục"],
          rows: previewRows,
          onConfirm: async () => {
            for (const r of validRows) {
              await createCategory(r.category);
            }
            categories = getCategories();
            renderCategoriesTable();
            fillProductFilters();
            renderProductsTable();
            showToast(`Nhập thành công ${validRows.length} danh mục mới!`);
          }
        });
      } catch (err) {
        showToast("Lỗi đọc file Excel: " + err.message);
      }
    });
  }
}

/* ==========================================================================
   TAB 5: QUẢN LÝ TỒN KHO & PHIẾU NHẬP HÀNG (INVENTORY & PURCHASES)
   ========================================================================== */
let inventorySubtab = "stock"; // "stock" | "purchases" | "movements"
let inventoryPurchases = [];
let inventoryMovements = [];
let invPoSearchQuery = "";
let invPoFilterReceived = "all";
let invPoFilterPayment = "all";
let invMovementSearchQuery = "";
let invMovementFilterType = "all";
let invActionTarget = null; // { productId, variantId, name }
let invPoItems = []; // [{ id, productId, variantId, quantity, unitCost, discount }]
let currentPoDetail = null;

function switchInventorySubtab(subtab) {
  inventorySubtab = subtab;
  const pills = document.querySelectorAll("#invSubTabs [data-inv-subtab]");
  pills.forEach((p) => {
    p.classList.toggle("active", p.dataset.invSubtab === subtab);
  });

  const stockPane = document.getElementById("invStockPane");
  const poPane = document.getElementById("invPurchasesPane");
  const movPane = document.getElementById("invMovementsPane");

  if (stockPane) stockPane.style.display = subtab === "stock" ? "block" : "none";
  if (poPane) poPane.style.display = subtab === "purchases" ? "block" : "none";
  if (movPane) movPane.style.display = subtab === "movements" ? "block" : "none";

  if (subtab === "purchases") {
    loadAndRenderInventoryPurchases().catch((err) => console.error("Lỗi tải phiếu nhập:", err));
  } else if (subtab === "movements") {
    loadAndRenderInventoryMovements().catch((err) => console.error("Lỗi tải biến động kho:", err));
  } else {
    renderInventoryTable();
  }
}

function renderInventoryTable() {
  const tbody = document.getElementById("inventoryTable");
  if (!tbody) return;

  const query = inventorySearchQuery.trim().toLowerCase();
  const filtered = products.filter((p) => {
    if (!query) return true;
    return (p.name || "").toLowerCase().includes(query) || (p.id || "").toLowerCase().includes(query);
  });

  tbody.innerHTML = filtered.map((p) => {
    const hasVars = Array.isArray(p.variants) && p.variants.length > 0;
    const stock = hasVars
      ? p.variants.reduce((sum, v) => sum + Math.max(0, Number(v.stock) || 0), 0)
      : Number(p.stock || 0);

    const alertBadge = stock === 0
      ? `<span class="status-badge cancelled" style="display:inline-flex; align-items:center; gap:4px;">${renderIcon("alert-octagon", { size: 12, strokeWidth: 2 })} Đã hết hàng</span>`
      : stock <= 15
      ? `<span class="status-badge low-stock" style="display:inline-flex; align-items:center; gap:4px;">${renderIcon("alert-triangle", { size: 12, strokeWidth: 2 })} Sắp hết (${stock})</span>`
      : `<span class="status-badge completed" style="display:inline-flex; align-items:center; gap:4px;">${renderIcon("check", { size: 12, strokeWidth: 2 })} Dồi dào (${stock})</span>`;

    const costPriceDisplay = p.costPrice && p.costPrice > 0
      ? `<div style="display: flex; flex-direction: column; gap: 2px;">
           <strong style="color: #0369a1; font-size: 13.5px;">${formatPrice(p.costPrice)}</strong>
           <small style="color: #64748b; font-size: 11px;" title="Giá nhập trung bình của các lần nhập hàng. Cần số liệu này để ước tính lãi khi bán.">Giá nhập bình quân</small>
         </div>`
      : `<div style="display: flex; flex-direction: column; gap: 4px; max-width: 250px;">
           <span style="color: #b45309; font-size: 12px; font-weight: 600; line-height: 1.35;">Chưa có giá nhập — chưa thể tính lãi chính xác cho sản phẩm này.</span>
           <button type="button" class="btn-action-link" data-open-create-po="${escapeHtml(p.id)}" style="background: none; border: none; padding: 0; text-align: left; color: #0284c7; font-size: 11.5px; font-weight: 700; cursor: pointer; text-decoration: underline; display: inline-flex; align-items: center; gap: 4px;" title="Dùng khi cửa hàng nhận hàng mua mới. Nhập số lượng, giá nhập và tình trạng thanh toán.">
             ${renderIcon("plus-circle", { size: 12, strokeWidth: 2 })} Tạo phiếu nhập hàng
           </button>
         </div>`;

    let varInvSubHtml = "";
    if (hasVars) {
      varInvSubHtml = `
        <tr class="inv-variants-expand-row" id="inv-variants-${escapeHtml(p.id)}" style="display: none; background: #f8fafc;">
          <td colspan="7" style="padding: 12px 18px; border-bottom: 2px solid #e2e8f0;">
            <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">
                <div>
                  <strong style="color: #0f172a; font-size: 13.5px; display: inline-flex; align-items: center; gap: 6px;">
                    ${renderIcon("layers", { size: 15, strokeWidth: 1.8 })} Tồn theo màu/phiên bản: ${escapeHtml(p.name)}
                  </strong>
                  <div style="font-size: 12px; color: #64748b; margin-top: 2px;">
                    Tổng tồn của sản phẩm: <strong style="color: #0f172a;">${stock} chiếc</strong> · Phân bổ chi tiết từng phiên bản bên dưới (tổng tồn không phải số lượng của từng phiên bản):
                  </div>
                </div>
                <div style="display: flex; gap: 6px;">
                  <button type="button" class="btn-action-primary" data-open-create-po="${escapeHtml(p.id)}" style="font-size: 11.5px; padding: 4px 8px; background: #0284c7; border-color: #0284c7; display: inline-flex; align-items: center; gap: 4px;" title="Dùng khi cửa hàng nhận hàng mua mới. Nhập số lượng, giá nhập và tình trạng thanh toán.">
                    ${renderIcon("plus-circle", { size: 12, strokeWidth: 1.8 })} Nhập hàng từ nhà cung cấp
                  </button>
                  <button type="button" class="table-action-btn" data-open-adjust-stock="${escapeHtml(p.id)}" style="font-size: 11.5px; padding: 4px 8px; display: inline-flex; align-items: center; gap: 4px;" title="Dùng khi số lượng thực tế lệch với hệ thống, hoặc khi ghi nhận hàng hỏng/mất. Vui lòng nhập lý do.">
                    ${renderIcon("sliders", { size: 12, strokeWidth: 1.8 })} Điều chỉnh số lượng
                  </button>
                </div>
              </div>
              <div style="display: flex; flex-direction: column; gap: 8px;">
                ${p.variants.map((v) => {
                  const varStock = Number(v.stock ?? 0);
                  const isOutOfStock = varStock === 0;
                  let cleanVarName = cleanMojibake(v.name || "");
                  if ((!cleanVarName || /Ä|Ã|áº|á»|Báº|XÃ|[\uFFFD□]/.test(cleanVarName)) && v.options && typeof v.options === "object") {
                    cleanVarName = Object.values(v.options).map(cleanMojibake).filter(Boolean).join(" / ");
                  }
                  if (p.id === "P025") {
                    const p025Map = {
                      "P025-VAR-1": "Đen Stealth / Bản 4 đầu massage",
                      "P025-VAR-2": "Đen Stealth / Bản 6 đầu chuyên sâu",
                      "P025-VAR-3": "Xám Titan / Bản 4 đầu massage",
                      "P025-VAR-4": "Xám Titan / Bản 6 đầu chuyên sâu"
                    };
                    if (p025Map[v.id]) cleanVarName = p025Map[v.id];
                  }
                  return `
                    <div style="display: flex; align-items: center; justify-content: space-between; background: ${isOutOfStock ? "#fff1f2" : "#f8fafc"}; padding: 8px 12px; border-radius: 6px; border: 1px solid ${isOutOfStock ? "#fecdd3" : "#e2e8f0"}; flex-wrap: wrap; gap: 8px;">
                      <div style="flex: 1; min-width: 180px;">
                        <strong style="color: ${isOutOfStock ? "#9f1239" : "#0f172a"};">${escapeHtml(cleanVarName)}</strong>
                        <span style="font-size: 11.5px; color: #64748b; margin-left: 6px; font-family: monospace;">(${escapeHtml(v.sku || "-")})</span>
                      </div>
                      <div style="font-size: 12.5px; font-weight: 600; min-width: 110px;">${formatPrice(v.price || p.price)}</div>
                      <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="display: inline-flex; align-items: center; gap: 6px;">
                          <span style="font-size: 12.5px; font-weight: 700; color: ${isOutOfStock ? "#dc2626" : varStock <= 15 ? "#d97706" : "#15803d"};">
                            ${varStock} chiếc
                          </span>
                          ${isOutOfStock ? `<span class="status-badge cancelled" style="font-size: 10.5px; padding: 2px 6px; font-weight: 700;">Hết hàng</span>` : ""}
                        </div>
                        <div style="display: flex; gap: 4px;">
                          <button class="table-action-btn" type="button" data-open-create-po="${escapeHtml(p.id)}" data-variant-id="${escapeHtml(v.id)}" style="display: inline-flex; align-items: center; gap: 3px; font-size: 11px; padding: 3px 7px; color: #0284c7; border-color: #7dd3fc;" title="Dùng khi cửa hàng nhận hàng mua mới. Nhập số lượng, giá nhập và tình trạng thanh toán.">
                            ${renderIcon("plus-circle", { size: 11, strokeWidth: 1.8 })} Nhập hàng
                          </button>
                          <button class="table-action-btn" type="button" data-open-adjust-stock="${escapeHtml(p.id)}" data-variant-id="${escapeHtml(v.id)}" style="display: inline-flex; align-items: center; gap: 3px; font-size: 11px; padding: 3px 7px;" title="Dùng khi số lượng thực tế lệch với hệ thống, hoặc khi ghi nhận hàng hỏng/mất. Vui lòng nhập lý do.">
                            ${renderIcon("sliders", { size: 11, strokeWidth: 1.8 })} Điều chỉnh
                          </button>
                        </div>
                      </div>
                    </div>
                  `;
                }).join("")}
              </div>
            </div>
          </td>
        </tr>
      `;
    }

    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="${p.image}" alt="${escapeHtml(p.name)}" style="width: 38px; height: 38px; object-fit: cover; border-radius: 4px; border: 1px solid #e2e8f0; background: #fff;">
            <div>
              <strong>${escapeHtml(p.name)}</strong>
              <br><small style="color: #64748b;">Mã: ${escapeHtml(p.id)}</small>
              ${hasVars ? `<br><small style="color: #0284c7; font-weight: 600;">(Có ${p.variants.length} màu/phiên bản)</small>` : ""}
            </div>
          </div>
        </td>
        <td>${getCategoryName(categories, p.categoryId)}</td>
        <td>${formatPrice(p.price)}</td>
        <td>${costPriceDisplay}</td>
        <td>
          <div>
            <strong>${stock}</strong> chiếc
            ${hasVars ? `<br><small style="color: #64748b; font-weight: normal;">(Tổng tồn toàn bộ phiên bản)</small>` : ""}
          </div>
        </td>
        <td>${alertBadge}</td>
        <td style="text-align: right;">
          ${hasVars ? `
            <div style="display: inline-flex; gap: 6px; align-items: center; justify-content: flex-end; flex-wrap: wrap;">
              <button class="table-action-btn" type="button" data-toggle-inv-vars="${escapeHtml(p.id)}" style="background: #e0f2fe; color: #0369a1; border-color: #bae6fd; display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; padding: 4px 8px;" title="Xem số lượng chi tiết của từng màu sắc/phiên bản">
                ${renderIcon("layers", { size: 12, strokeWidth: 1.8 })} Xem số lượng từng phiên bản (${p.variants.length})
              </button>
              <button class="btn-action-primary" type="button" data-open-create-po="${escapeHtml(p.id)}" style="display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; padding: 4px 8px; background: #0284c7; border-color: #0284c7;" title="Dùng khi cửa hàng nhận hàng mua mới. Nhập số lượng, giá nhập và tình trạng thanh toán.">
                ${renderIcon("plus-circle", { size: 12, strokeWidth: 1.8 })} Nhập hàng từ nhà cung cấp
              </button>
              <button class="table-action-btn" type="button" data-open-adjust-stock="${escapeHtml(p.id)}" style="display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; padding: 4px 8px;" title="Dùng khi số lượng thực tế lệch với hệ thống, hoặc khi ghi nhận hàng hỏng/mất. Vui lòng nhập lý do.">
                ${renderIcon("sliders", { size: 12, strokeWidth: 1.8 })} Điều chỉnh số lượng
              </button>
            </div>
          ` : `
            <div style="display: inline-flex; gap: 6px; align-items: center; justify-content: flex-end; flex-wrap: wrap;">
              <button class="btn-action-primary" type="button" data-open-create-po="${escapeHtml(p.id)}" style="display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; padding: 4px 8px; background: #0284c7; border-color: #0284c7;" title="Dùng khi cửa hàng nhận hàng mua mới. Nhập số lượng, giá nhập và tình trạng thanh toán.">
                ${renderIcon("plus-circle", { size: 12, strokeWidth: 1.8 })} Nhập hàng từ nhà cung cấp
              </button>
              <button class="table-action-btn" type="button" data-open-adjust-stock="${escapeHtml(p.id)}" style="display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; padding: 4px 8px;" title="Dùng khi số lượng thực tế lệch với hệ thống, hoặc khi ghi nhận hàng hỏng/mất. Vui lòng nhập lý do.">
                ${renderIcon("sliders", { size: 12, strokeWidth: 1.8 })} Điều chỉnh số lượng
              </button>
            </div>
          `}
        </td>
      </tr>
      ${varInvSubHtml}
    `;
  }).join("");
}

function getReceivedBadge(status) {
  switch (status) {
    case "RECEIVED":
      return `<span class="status-badge completed" style="font-size: 11px;"><i data-lucide="check-circle-2" style="width:11px; height:11px;"></i> Đã nhận hàng</span>`;
    case "DRAFT":
      return `<span class="status-badge pending" style="background:#fef3c7; color:#92400e; font-size: 11px;"><i data-lucide="clock" style="width:11px; height:11px;"></i> Lưu nháp</span>`;
    case "CANCELLED":
      return `<span class="status-badge cancelled" style="font-size: 11px;"><i data-lucide="x-circle" style="width:11px; height:11px;"></i> Đã hủy</span>`;
    default:
      return `<span class="status-badge">${escapeHtml(status || "—")}</span>`;
  }
}

function getPoPaymentBadge(status) {
  switch (status) {
    case "PAID":
      return `<span class="status-badge completed" style="font-size: 11px;">Đã thanh toán đủ</span>`;
    case "PARTIALLY_PAID":
      return `<span class="status-badge processing" style="font-size: 11px;">Thanh toán một phần</span>`;
    case "UNPAID":
      return `<span class="status-badge cancelled" style="font-size: 11px;">Chưa thanh toán (Nợ)</span>`;
    default:
      return `<span class="status-badge">${escapeHtml(status || "—")}</span>`;
  }
}

async function loadAndRenderInventoryPurchases() {
  const tbody = document.getElementById("invPurchasesTableBody");
  if (!tbody) return;

  try {
    const filters = {};
    if (invPoFilterReceived !== "all") filters.receivedStatus = invPoFilterReceived;
    if (invPoFilterPayment !== "all") filters.paymentStatus = invPoFilterPayment;

    const [pos, summary] = await Promise.all([
      getPurchaseOrders(filters),
      getFinanceSummary().catch(() => null)
    ]);

    inventoryPurchases = Array.isArray(pos) ? pos : [];

    // Cập nhật các thẻ KPI Phiếu nhập kho
    const kpiTotalEl = document.getElementById("invPoKpiTotal");
    const kpiCountEl = document.getElementById("invPoKpiCount");
    const kpiPaidEl = document.getElementById("invPoKpiPaid");
    const kpiDebtEl = document.getElementById("invPoKpiDebt");
    const kpiValuationEl = document.getElementById("invPoKpiValuation");
    const kpiValuationNoteEl = document.getElementById("invPoKpiValuationNote");

    if (summary) {
      if (kpiTotalEl) kpiTotalEl.textContent = formatPrice(summary.totalPurchaseOrdersAmount || 0);
      if (kpiCountEl) kpiCountEl.textContent = `${summary.purchaseOrdersCount || inventoryPurchases.length} phiếu nhập kho`;
      if (kpiPaidEl) kpiPaidEl.textContent = formatPrice(summary.purchaseCashOut || 0);
      if (kpiDebtEl) kpiDebtEl.textContent = formatPrice(summary.supplierDebt || 0);
      if (kpiValuationEl) kpiValuationEl.textContent = formatPrice(summary.inventoryValuationAtCost || 0);
      if (kpiValuationNoteEl) {
        kpiValuationNoteEl.textContent = summary.missingValuationCount > 0
          ? `Có ${summary.missingValuationCount} mặt hàng chưa có giá nhập`
          : "Định giá theo giá nhập bình quân";
      }
    }

    const q = invPoSearchQuery.trim().toLowerCase();
    const filtered = inventoryPurchases.filter((po) => {
      if (!q) return true;
      return (
        (po.id || "").toLowerCase().includes(q) ||
        (po.supplierName || "").toLowerCase().includes(q) ||
        (po.productName || "").toLowerCase().includes(q) ||
        (po.itemsJson || "").toLowerCase().includes(q)
      );
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #64748b; padding: 32px;">Không có phiếu nhập kho nào phù hợp.</td></tr>`;
      return;
    }

    const cur = getCurrentUser();
    const canReceive = cur?.role === "admin" || hasPermission(cur, PERMISSIONS.INVENTORY_PURCHASE_RECEIVE);
    const canPay = cur?.role === "admin" || hasPermission(cur, PERMISSIONS.INVENTORY_PURCHASE_PAY);

    tbody.innerHTML = filtered.map((po) => {
      let itemsSummary = po.productName || "Nhiều mặt hàng";
      if (po.itemsJson) {
        try {
          const parsed = JSON.parse(po.itemsJson);
          if (Array.isArray(parsed) && parsed.length > 0) {
            itemsSummary = `${parsed[0].productName || parsed[0].productId}${parsed[0].variantName ? ` (${parsed[0].variantName})` : ""}`;
            if (parsed.length > 1) {
              itemsSummary += ` <span style="color:#0284c7;font-weight:600;">(+${parsed.length - 1} SP khác)</span>`;
            }
          }
        } catch {}
      }

      return `
        <tr>
          <td>
            <button type="button" class="table-action-btn" data-view-po="${escapeHtml(po.id)}" style="font-family: monospace; font-weight: 700; color: #0284c7; background: #f0f9ff; border-color: #bae6fd;">
              #${escapeHtml(po.id)}
            </button>
          </td>
          <td><small>${escapeHtml(po.purchaseDate || "—")}</small></td>
          <td><strong>${escapeHtml(po.supplierName || "—")}</strong></td>
          <td style="max-width: 200px; white-space: normal;">${itemsSummary}</td>
          <td><strong>${formatPrice(po.totalAmount || 0)}</strong></td>
          <td style="color: #15803d; font-weight: 600;">${formatPrice(po.paidAmount || 0)}</td>
          <td style="color: ${po.debtAmount > 0 ? '#b91c1c' : '#64748b'}; font-weight: 600;">${formatPrice(po.debtAmount || 0)}</td>
          <td>${getReceivedBadge(po.receivedStatus)}</td>
          <td>${getPoPaymentBadge(po.paymentStatus)}</td>
          <td style="text-align: right;">
            <div style="display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap;">
              <button class="table-action-btn" type="button" data-view-po="${escapeHtml(po.id)}">Xem</button>
              ${po.receivedStatus === "DRAFT" && canReceive ? `
                <button class="btn-action-primary" type="button" data-receive-po="${escapeHtml(po.id)}" style="font-size: 11.5px; padding: 2px 7px; background: #15803d; border-color: #15803d;">
                  Nhập kho
                </button>
              ` : ""}
              ${po.debtAmount > 0 && po.receivedStatus !== "CANCELLED" && canPay ? `
                <button class="table-action-btn" type="button" data-pay-po="${escapeHtml(po.id)}" style="color: #0284c7; border-color: #7dd3fc; font-weight: 600;">
                  Trả nợ
                </button>
              ` : ""}
            </div>
          </td>
        </tr>
      `;
    }).join("");
    initIcons();
  } catch (err) {
    console.error("Lỗi tải danh sách phiếu nhập:", err);
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #b91c1c; padding: 24px;">Lỗi tải phiếu nhập: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function getMovementTypeBadge(type) {
  switch (type) {
    case "PURCHASE_RECEIPT":
      return `<span class="status-badge completed" style="font-size: 11px;">Nhập hàng từ NCC</span>`;
    case "PURCHASE_RETURN":
      return `<span class="status-badge cancelled" style="font-size: 11px;">Trả hàng NCC / Hủy</span>`;
    case "STOCK_ADJUSTMENT":
      return `<span class="status-badge processing" style="background:#fef3c7; color:#92400e; font-size: 11px;">Điều chỉnh số lượng</span>`;
    case "ORDER_FULFILLMENT":
      return `<span class="status-badge shipping" style="background:#e0f2fe; color:#0369a1; font-size: 11px;">Xuất bán đơn hàng</span>`;
    case "ORDER_RETURN":
      return `<span class="status-badge pending" style="background:#f3e8ff; color:#6b21a8; font-size: 11px;">Khách trả hàng</span>`;
    default:
      return `<span class="status-badge">${escapeHtml(type || "—")}</span>`;
  }
}

async function loadAndRenderInventoryMovements() {
  const tbody = document.getElementById("invMovementsTableBody");
  if (!tbody) return;

  try {
    const filters = {};
    if (invMovementFilterType !== "all") filters.movementType = invMovementFilterType;
    if (invMovementSearchQuery) filters.q = invMovementSearchQuery;

    const list = await getInventoryMovements(filters);
    inventoryMovements = Array.isArray(list) ? list : [];

    if (inventoryMovements.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #64748b; padding: 32px;">Chưa có nhật ký biến động kho nào phù hợp.</td></tr>`;
      return;
    }

    tbody.innerHTML = inventoryMovements.map((m) => {
      const isPos = m.quantityChange > 0;
      const refLink = m.referenceType === "PURCHASE"
        ? `<button type="button" class="table-action-btn" data-view-po="${escapeHtml(m.referenceId)}" style="font-size:11px; padding:1px 5px; color:#0284c7;">#${escapeHtml(m.referenceId)}</button>`
        : (m.referenceType === "ORDER"
          ? `<button type="button" class="table-action-btn" data-view-order="${escapeHtml(m.referenceId)}" style="font-size:11px; padding:1px 5px;">#${escapeHtml(m.referenceId)}</button>`
          : `<small style="color:#64748b;">${escapeHtml(m.referenceId || "—")}</small>`);

      return `
        <tr>
          <td><small>${m.createdAt ? new Date(m.createdAt).toLocaleString("vi-VN") : "—"}</small></td>
          <td>
            <strong>${escapeHtml(m.productId || "—")}</strong>
            ${m.variantId ? `<br><small style="color: #64748b;">Biến thể: ${escapeHtml(m.variantId)}</small>` : ""}
          </td>
          <td>${getMovementTypeBadge(m.movementType)}</td>
          <td>
            <strong style="color: ${isPos ? '#15803d' : '#b91c1c'};">
              ${isPos ? '+' : ''}${m.quantityChange}
            </strong>
          </td>
          <td><small>${m.previousStock ?? 0} &rarr; <strong>${m.newStock ?? 0}</strong></small></td>
          <td>${m.unitCost ? formatPrice(m.unitCost) : '<small style="color:#94a3b8;">—</small>'}</td>
          <td>${refLink}</td>
          <td>
            <small><strong>${escapeHtml(m.createdByName || "Hệ thống")}</strong></small>
            ${m.reason ? `<br><small style="color:#64748b;">${escapeHtml(m.reason)}</small>` : ""}
          </td>
        </tr>
      `;
    }).join("");
  } catch (err) {
    console.error("Lỗi tải nhật ký biến động kho:", err);
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #b91c1c; padding: 24px;">Lỗi tải dữ liệu: ${escapeHtml(err.message)}</td></tr>`;
  }
}

// Mở modal lựa chọn thao tác cập nhật kho
function openInvActionModal(productId, variantId = "") {
  const p = products.find((item) => String(item.id) === String(productId));
  if (!p) return;

  const v = variantId && Array.isArray(p.variants)
    ? p.variants.find((item) => String(item.id) === String(variantId))
    : null;

  invActionTarget = {
    productId: p.id,
    variantId: v ? v.id : "",
    product: p,
    variant: v,
    name: `${p.name}${v ? ` - ${v.name}` : ""}`
  };

  const nameEl = document.getElementById("invActionProductName");
  if (nameEl) nameEl.textContent = invActionTarget.name;

  const modal = document.getElementById("invActionSelectModalBackdrop");
  if (modal) modal.classList.add("show");
}

// Mở modal Điều chỉnh tồn kho (Kiểm kê / Lệch kho)
function openAdjustInventoryModal(target = null) {
  const modal = document.getElementById("invAdjustModalBackdrop");
  const pSel = document.getElementById("invAdjProductSelect");
  const vWrap = document.getElementById("invAdjVariantWrap");
  const vSel = document.getElementById("invAdjVariantSelect");
  const curStockEl = document.getElementById("invAdjCurrentStockVal");
  const diffEl = document.getElementById("invAdjDiffVal");
  const newStockInp = document.getElementById("invAdjNewStockInput");
  const noteInp = document.getElementById("invAdjNoteInput");

  if (!modal || !pSel) return;

  const cur = getCurrentUser();
  if (cur?.role === "cashier") {
    showToast("Thủ quỹ chỉ phụ trách thu chi tiền, không có quyền điều chỉnh số lượng hàng trong kho.", "error");
    return;
  }

  pSel.innerHTML = products.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(cleanMojibake(p.name))} (#${escapeHtml(p.id)})</option>`).join("");

  const updateAdjustVariantAndStock = () => {
    const selectedP = products.find((p) => String(p.id) === String(pSel.value));
    if (!selectedP) return;

    let currentStock = 0;
    if (Array.isArray(selectedP.variants) && selectedP.variants.length > 0 && vSel && vWrap) {
      vWrap.style.display = "grid";
      vSel.innerHTML = selectedP.variants.map((v) => {
        let vName = cleanMojibake(v.name || "");
        if ((!vName || /Ä|Ã|áº|á»|Báº|XÃ|[\uFFFD□]/.test(vName)) && v.options && typeof v.options === "object") {
          vName = Object.values(v.options).map(cleanMojibake).filter(Boolean).join(" / ");
        }
        if (selectedP.id === "P025") {
          const p025Map = {
            "P025-VAR-1": "Đen Stealth / Bản 4 đầu massage",
            "P025-VAR-2": "Đen Stealth / Bản 6 đầu chuyên sâu",
            "P025-VAR-3": "Xám Titan / Bản 4 đầu massage",
            "P025-VAR-4": "Xám Titan / Bản 6 đầu chuyên sâu"
          };
          if (p025Map[v.id]) vName = p025Map[v.id];
        }
        return `<option value="${escapeHtml(v.id)}">${escapeHtml(vName)} (Tồn: ${v.stock ?? 0})</option>`;
      }).join("");
      const selectedV = selectedP.variants.find((v) => String(v.id) === String(vSel.value)) || selectedP.variants[0];
      currentStock = Number(selectedV?.stock ?? 0);
    } else {
      if (vWrap) vWrap.style.display = "none";
      if (vSel) vSel.innerHTML = "";
      currentStock = Number(selectedP.stock ?? 0);
    }

    if (curStockEl) curStockEl.textContent = `${currentStock} chiếc`;
    if (newStockInp && !newStockInp.value) newStockInp.value = currentStock;
    updateDiff();
  };

  const updateDiff = () => {
    const selectedP = products.find((p) => String(p.id) === String(pSel.value));
    let curStock = 0;
    if (selectedP) {
      if (Array.isArray(selectedP.variants) && selectedP.variants.length > 0 && vSel?.value) {
        const v = selectedP.variants.find((item) => String(item.id) === String(vSel.value));
        curStock = Number(v?.stock ?? 0);
      } else {
        curStock = Number(selectedP.stock ?? 0);
      }
    }
    const newStock = Number(newStockInp?.value ?? curStock);
    const diff = newStock - curStock;
    if (diffEl) {
      diffEl.textContent = `${diff >= 0 ? '+' : ''}${diff} chiếc`;
      diffEl.style.color = diff > 0 ? "#15803d" : (diff < 0 ? "#b91c1c" : "#64748b");
    }
  };

  pSel.onchange = updateAdjustVariantAndStock;
  if (vSel) vSel.onchange = updateAdjustVariantAndStock;
  if (newStockInp) newStockInp.oninput = updateDiff;

  if (target?.productId) {
    pSel.value = target.productId;
    updateAdjustVariantAndStock();
    if (target.variantId && vSel) {
      vSel.value = target.variantId;
      updateAdjustVariantAndStock();
    }
  } else {
    updateAdjustVariantAndStock();
  }

  if (noteInp) noteInp.value = "";
  modal.classList.add("show");
}

// Mở modal tạo phiếu nhập kho đa sản phẩm
function openCreatePurchaseModal(initialItem = null) {
  const modal = document.getElementById("finPurchaseModalBackdrop");
  if (!modal) return;

  const dateInp = document.getElementById("finPoDateInput");
  if (dateInp) dateInp.value = new Date().toISOString().slice(0, 10);

  const supInp = document.getElementById("finPoSupplierInput");
  if (supInp && !initialItem) supInp.value = "";

  const discInp = document.getElementById("finPoDiscountInput");
  if (discInp) discInp.value = 0;
  const shipInp = document.getElementById("finPoShippingInput");
  if (shipInp) shipInp.value = 0;
  const paidInp = document.getElementById("finPoPaidAmountInput");
  if (paidInp) paidInp.value = 0;
  const payStatusSel = document.getElementById("finPoPaymentStatusInput");
  if (payStatusSel) payStatusSel.value = "UNPAID";
  const noteInp = document.getElementById("finPoNoteInput");
  if (noteInp) noteInp.value = "";
  const attachInp = document.getElementById("finPoAttachmentInput");
  if (attachInp) attachInp.value = "";

  // Khởi tạo danh sách sản phẩm
  if (initialItem && initialItem.productId) {
    invPoItems = [
      {
        id: `poi_${Date.now()}_1`,
        productId: initialItem.productId,
        variantId: initialItem.variantId || "",
        quantity: initialItem.quantity || 10,
        unitCost: initialItem.unitCost || 0,
        discount: 0
      }
    ];
  } else if (products.length > 0) {
    const firstP = products[0];
    invPoItems = [
      {
        id: `poi_${Date.now()}_1`,
        productId: firstP.id,
        variantId: firstP.variants && firstP.variants.length > 0 ? firstP.variants[0].id : "",
        quantity: 10,
        unitCost: firstP.costPrice || 0,
        discount: 0
      }
    ];
  } else {
    invPoItems = [];
  }

  renderPoItemsRows();
  recalculatePoTotals();
  modal.classList.add("show");
}

function renderPoItemsRows() {
  const tbody = document.getElementById("finPoItemsTableBody");
  if (!tbody) return;

  if (invPoItems.length === 0) {
    tbody.innerHTML = `<tr class="po-empty-row"><td colspan="7" style="text-align: center; color: #64748b; padding: 18px;">Bấm "+ Thêm sản phẩm" để thêm mặt hàng vào phiếu nhập.</td></tr>`;
    return;
  }

  tbody.innerHTML = invPoItems.map((item, idx) => {
    const selectedProd = products.find((p) => String(p.id) === String(item.productId)) || products[0];
    const hasVars = selectedProd && Array.isArray(selectedProd.variants) && selectedProd.variants.length > 0;

    const prodOptions = products.map((p) => `
      <option value="${escapeHtml(p.id)}" ${String(p.id) === String(item.productId) ? 'selected' : ''}>
        ${escapeHtml(cleanMojibake(p.name))} (#${escapeHtml(p.id)})
      </option>
    `).join("");

    let varOptions = `<option value="">— Không có —</option>`;
    if (hasVars) {
      varOptions = selectedProd.variants.map((v) => {
        let vName = cleanMojibake(v.name || "");
        if ((!vName || /Ä|Ã|áº|á»|Báº|XÃ|[\uFFFD□]/.test(vName)) && v.options && typeof v.options === "object") {
          vName = Object.values(v.options).map(cleanMojibake).filter(Boolean).join(" / ");
        }
        if (selectedProd.id === "P025") {
          const p025Map = {
            "P025-VAR-1": "Đen Stealth / Bản 4 đầu massage",
            "P025-VAR-2": "Đen Stealth / Bản 6 đầu chuyên sâu",
            "P025-VAR-3": "Xám Titan / Bản 4 đầu massage",
            "P025-VAR-4": "Xám Titan / Bản 6 đầu chuyên sâu"
          };
          if (p025Map[v.id]) vName = p025Map[v.id];
        }
        return `
          <option value="${escapeHtml(v.id)}" ${String(v.id) === String(item.variantId) ? 'selected' : ''}>
            ${escapeHtml(vName)}
          </option>
        `;
      }).join("");
    }

    const lineTotal = Math.max(0, (Number(item.quantity) || 0) * (Number(item.unitCost) || 0) - (Number(item.discount) || 0));

    return `
      <tr class="po-item-row" data-po-item-idx="${idx}">
        <td class="po-td-product">
          <span class="po-mobile-cell-label">Sản phẩm:</span>
          <select class="time-filter-select po-item-prod-sel po-input" data-item-idx="${idx}">
            ${prodOptions}
          </select>
        </td>
        <td class="po-td-variant">
          <span class="po-mobile-cell-label">Biến thể:</span>
          <select class="time-filter-select po-item-var-sel po-select" data-item-idx="${idx}" ${!hasVars ? 'disabled' : ''}>
            ${varOptions}
          </select>
        </td>
        <td class="po-td-qty">
          <span class="po-mobile-cell-label">Số lượng:</span>
          <input type="number" class="time-filter-select po-item-qty-inp po-input" data-item-idx="${idx}" min="1" step="1" value="${item.quantity || 1}">
        </td>
        <td class="po-td-cost">
          <span class="po-mobile-cell-label">Đơn giá:</span>
          <input type="number" class="time-filter-select po-item-cost-inp po-input" data-item-idx="${idx}" min="0" step="1000" value="${item.unitCost || 0}">
        </td>
        <td class="po-td-discount">
          <span class="po-mobile-cell-label">Chiết khấu:</span>
          <input type="number" class="time-filter-select po-item-disc-inp po-input" data-item-idx="${idx}" min="0" step="1000" value="${item.discount || 0}">
        </td>
        <td class="po-td-total">
          <span class="po-mobile-cell-label">Thành tiền:</span>
          <span class="po-line-total-val">${formatPrice(lineTotal)}</span>
        </td>
        <td class="po-td-action">
          <button type="button" class="table-action-btn po-item-del-btn" data-item-idx="${idx}" title="Xóa dòng">
            <span class="po-del-icon">&times;</span>
            <span class="po-del-text">Xóa mặt hàng</span>
          </button>
        </td>
      </tr>
    `;
  }).join("");

  bindPoItemEvents();
}

function bindPoItemEvents() {
  const tbody = document.getElementById("finPoItemsTableBody");
  if (!tbody) return;

  tbody.querySelectorAll(".po-item-prod-sel").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      const idx = Number(e.target.dataset.itemIdx);
      if (invPoItems[idx]) {
        invPoItems[idx].productId = e.target.value;
        const p = products.find((item) => String(item.id) === String(e.target.value));
        if (p && Array.isArray(p.variants) && p.variants.length > 0) {
          invPoItems[idx].variantId = p.variants[0].id;
        } else {
          invPoItems[idx].variantId = "";
        }
        if (p && (!invPoItems[idx].unitCost || invPoItems[idx].unitCost === 0)) {
          invPoItems[idx].unitCost = p.costPrice || 0;
        }
        renderPoItemsRows();
        recalculatePoTotals();
      }
    });
  });

  tbody.querySelectorAll(".po-item-var-sel").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      const idx = Number(e.target.dataset.itemIdx);
      if (invPoItems[idx]) {
        invPoItems[idx].variantId = e.target.value;
      }
    });
  });

  tbody.querySelectorAll(".po-item-qty-inp").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const idx = Number(e.target.dataset.itemIdx);
      if (invPoItems[idx]) {
        invPoItems[idx].quantity = Math.max(1, parseInt(e.target.value) || 1);
        recalculatePoTotals();
      }
    });
  });

  tbody.querySelectorAll(".po-item-cost-inp").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const idx = Number(e.target.dataset.itemIdx);
      if (invPoItems[idx]) {
        invPoItems[idx].unitCost = Math.max(0, parseInt(e.target.value) || 0);
        recalculatePoTotals();
      }
    });
  });

  tbody.querySelectorAll(".po-item-disc-inp").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const idx = Number(e.target.dataset.itemIdx);
      if (invPoItems[idx]) {
        invPoItems[idx].discount = Math.max(0, parseInt(e.target.value) || 0);
        recalculatePoTotals();
      }
    });
  });

  tbody.querySelectorAll(".po-item-del-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const idx = Number(e.target.dataset.itemIdx);
      invPoItems.splice(idx, 1);
      renderPoItemsRows();
      recalculatePoTotals();
    });
  });
}

function recalculatePoTotals() {
  const tbody = document.getElementById("finPoItemsTableBody");
  let subtotal = 0;
  invPoItems.forEach((item, idx) => {
    const lineTotal = Math.max(0, (Number(item.quantity) || 0) * (Number(item.unitCost) || 0) - (Number(item.discount) || 0));
    subtotal += lineTotal;
    const rowTotalEl = tbody?.querySelector(`tr[data-po-item-idx="${idx}"] .po-line-total-val`);
    if (rowTotalEl) rowTotalEl.textContent = formatPrice(lineTotal);
  });

  const discVal = Math.max(0, Number(document.getElementById("finPoDiscountInput")?.value) || 0);
  const shipVal = Math.max(0, Number(document.getElementById("finPoShippingInput")?.value) || 0);
  const grandTotal = Math.max(0, subtotal - discVal + shipVal);

  const grandTotalEl = document.getElementById("finPoGrandTotalVal");
  if (grandTotalEl) grandTotalEl.textContent = formatPrice(grandTotal);

  const payStatus = document.getElementById("finPoPaymentStatusInput")?.value || "UNPAID";
  const paidWrap = document.getElementById("finPoPaidAmountWrap");
  const paidInp = document.getElementById("finPoPaidAmountInput");

  let paidAmount = 0;
  if (payStatus === "PAID") {
    if (paidWrap) paidWrap.style.display = "none";
    paidAmount = grandTotal;
  } else if (payStatus === "PARTIALLY_PAID") {
    if (paidWrap) paidWrap.style.display = "flex";
    paidAmount = Math.min(grandTotal, Math.max(0, Number(paidInp?.value) || 0));
  } else {
    if (paidWrap) paidWrap.style.display = "none";
    paidAmount = 0;
  }

  const debtAmount = Math.max(0, grandTotal - paidAmount);
  const debtEl = document.getElementById("finPoDebtCalculatedVal");
  if (debtEl) {
    debtEl.textContent = formatPrice(debtAmount);
    debtEl.style.color = debtAmount > 0 ? "#b45309" : "#15803d";
  }
}

// Mở modal Chi tiết phiếu nhập kho
async function openPurchaseDetailModal(poId) {
  const modal = document.getElementById("purchaseDetailModalBackdrop");
  const titleEl = document.getElementById("poDetailTitle");
  const recBadgeEl = document.getElementById("poDetailReceivedBadge");
  const payBadgeEl = document.getElementById("poDetailPaymentBadge");
  const bodyEl = document.getElementById("poDetailBody");
  const actionBtnsEl = document.getElementById("poDetailActionBtns");

  if (!modal || !bodyEl) return;

  try {
    bodyEl.innerHTML = `<div style="text-align: center; padding: 32px; color: #64748b;">Đang tải thông tin phiếu #${escapeHtml(poId)}...</div>`;
    modal.classList.add("show");

    const po = await getPurchaseOrderById(poId);
    if (!po) {
      bodyEl.innerHTML = `<div style="text-align: center; color: #b91c1c; padding: 24px;">Không tìm thấy thông tin phiếu nhập kho #${escapeHtml(poId)}.</div>`;
      return;
    }
    currentPoDetail = po;

    if (titleEl) titleEl.textContent = `Phiếu nhập kho #${po.id}`;
    if (recBadgeEl) recBadgeEl.innerHTML = getReceivedBadge(po.receivedStatus);
    if (payBadgeEl) payBadgeEl.innerHTML = getPoPaymentBadge(po.paymentStatus);

    let items = [];
    if (po.itemsJson) {
      try { items = JSON.parse(po.itemsJson); } catch {}
    }
    if (!items || items.length === 0) {
      items = [
        {
          productId: po.productId,
          productName: po.productName,
          variantId: po.variantId,
          variantName: po.variantName,
          quantity: po.quantity,
          unitCost: po.unitCost,
          lineTotal: po.totalAmount
        }
      ];
    }

    const itemsHtml = items.map((it) => `
      <tr>
        <td>
          <strong>${escapeHtml(it.productName || it.productId || "—")}</strong>
          <br><small style="color:#64748b; font-family:monospace;">Mã: ${escapeHtml(it.productId || "—")}</small>
        </td>
        <td>${escapeHtml(it.variantName || it.variantId || "Mặc định")}</td>
        <td style="text-align: center;"><strong>${it.quantity || 0}</strong> chiếc</td>
        <td style="text-align: right;">${formatPrice(it.unitCost || 0)}</td>
        <td style="text-align: right;">${it.discount ? `-${formatPrice(it.discount)}` : "—"}</td>
        <td style="text-align: right;"><strong>${formatPrice(it.lineTotal || (it.quantity * it.unitCost) || 0)}</strong></td>
      </tr>
    `).join("");

    const txsHtml = Array.isArray(po.relatedTransactions) && po.relatedTransactions.length > 0
      ? po.relatedTransactions.map((tx) => `
          <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 12.5px;">
            <div>
              <strong style="color: #0369a1;">#${escapeHtml(tx.id)}</strong> · ${escapeHtml(tx.category || "Tiền nhập hàng")}
              <br><small style="color: #64748b;">${escapeHtml(tx.txDate)} · ${escapeHtml(tx.paymentMethod || "")} · Người ghi: ${escapeHtml(tx.createdByName || "")}</small>
            </div>
            <strong style="color: #b91c1c;">-${formatPrice(tx.amount || 0)}</strong>
          </div>
        `).join("")
      : `<div style="font-size: 12.5px; color: #64748b; font-style: italic;">Chưa phát sinh giao dịch chi tiền mặt hoặc chuyển khoản nào liên kết với phiếu này.</div>`;

    bodyEl.innerHTML = `
      <div style="display: grid; gap: 16px;">
        <!-- Header Info Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; background: #f8fafc; padding: 12px 14px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 13px;">
          <div><span style="color:#64748b;">Nhà cung cấp:</span> <strong>${escapeHtml(po.supplierName || "—")}</strong></div>
          <div><span style="color:#64748b;">Ngày tạo phiếu:</span> <strong>${escapeHtml(po.purchaseDate || "—")}</strong></div>
          <div><span style="color:#64748b;">Người tạo:</span> <strong>${escapeHtml(po.createdByName || "—")}</strong></div>
          <div><span style="color:#64748b;">Thời điểm nhận hàng:</span> <strong>${po.receivedAt ? new Date(po.receivedAt).toLocaleString("vi-VN") : "Chưa nhận"}</strong></div>
          ${po.receivedByName ? `<div><span style="color:#64748b;">Người xác nhận nhận:</span> <strong>${escapeHtml(po.receivedByName)}</strong></div>` : ""}
          ${po.attachmentUrl ? `<div style="grid-column: 1 / -1;"><span style="color:#64748b;">Chứng từ đính kèm:</span> <a href="${escapeHtml(po.attachmentUrl)}" target="_blank" style="color:#0284c7; text-decoration:underline; font-weight:600;">Xem hóa đơn / chứng từ</a></div>` : ""}
          ${po.note ? `<div style="grid-column: 1 / -1;"><span style="color:#64748b;">Ghi chú:</span> <em>${escapeHtml(po.note)}</em></div>` : ""}
        </div>

        <!-- Items Table -->
        <div>
          <h4 style="margin: 0 0 8px; font-size: 13.5px; font-weight: 700;">Danh sách mặt hàng nhập kho</h4>
          <div style="border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
            <table class="admin-data-table" style="margin: 0; font-size: 12.5px;">
              <thead>
                <tr style="background: #f8fafc;">
                  <th>Sản phẩm</th>
                  <th>Biến thể</th>
                  <th style="text-align: center;">Số lượng</th>
                  <th style="text-align: right;">Đơn giá nhập</th>
                  <th style="text-align: right;">Chiết khấu</th>
                  <th style="text-align: right;">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Financial Breakdown -->
        <div style="background: #f1f5f9; border-radius: 8px; padding: 12px 16px; font-size: 13px; display: grid; gap: 6px;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color:#64748b;">Tiền hàng tạm tính:</span>
            <span>${formatPrice(po.subtotal || po.totalAmount || 0)}</span>
          </div>
          ${po.discountAmount ? `
            <div style="display: flex; justify-content: space-between; color: #15803d;">
              <span>Chiết khấu toàn phiếu:</span>
              <span>-${formatPrice(po.discountAmount)}</span>
            </div>
          ` : ""}
          ${po.shippingFee ? `
            <div style="display: flex; justify-content: space-between;">
              <span style="color:#64748b;">Chi phí phát sinh / Vận chuyển:</span>
              <span>+${formatPrice(po.shippingFee)}</span>
            </div>
          ` : ""}
          <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 15px; border-top: 1px solid #cbd5e1; padding-top: 6px;">
            <span>Tổng tiền phiếu nhập:</span>
            <span style="color: #0f172a;">${formatPrice(po.totalAmount || 0)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 13px; margin-top: 4px;">
            <span style="color:#15803d; font-weight:600;">Đã thanh toán (Dòng tiền thực chi):</span>
            <strong style="color:#15803d;">${formatPrice(po.paidAmount || 0)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 13px;">
            <span style="color:#b45309; font-weight:600;">Công nợ NCC còn lại:</span>
            <strong style="color:${po.debtAmount > 0 ? '#b91c1c' : '#15803d'};">${formatPrice(po.debtAmount || 0)}</strong>
          </div>
        </div>

        <!-- Related Cash Out Transactions -->
        <div>
          <h4 style="margin: 0 0 8px; font-size: 13.5px; font-weight: 700;">Khoản chi liên quan trong Sổ thu chi</h4>
          <div style="display: grid; gap: 6px;">
            ${txsHtml}
          </div>
        </div>
      </div>
    `;

    // Action buttons in modal footer
    const cur = getCurrentUser();
    const canReceive = cur?.role === "admin" || hasPermission(cur, PERMISSIONS.INVENTORY_PURCHASE_RECEIVE);
    const canPay = cur?.role === "admin" || hasPermission(cur, PERMISSIONS.INVENTORY_PURCHASE_PAY);
    const canCreate = cur?.role === "admin" || hasPermission(cur, PERMISSIONS.INVENTORY_PURCHASE_CREATE);

    let btns = "";
    if (po.receivedStatus === "DRAFT" && canReceive) {
      btns += `
        <button type="button" class="btn-admin primary" id="poDetailReceiveBtn" style="background:#15803d; border-color:#15803d;">
          Xác nhận nhận hàng (Nhập kho &amp; Tính MAC)
        </button>
      `;
    }
    if (po.debtAmount > 0 && po.receivedStatus !== "CANCELLED" && canPay) {
      btns += `
        <button type="button" class="btn-admin primary" id="poDetailPayDebtBtn" style="background:#0284c7; border-color:#0284c7;">
          Ghi nhận thanh toán công nợ (${formatPrice(po.debtAmount)})
        </button>
      `;
    }
    if (po.receivedStatus !== "CANCELLED" && canCreate) {
      btns += `
        <button type="button" class="btn-admin secondary" id="poDetailCancelBtn" style="color:#dc2626; border-color:#fecaca;">
          Hủy phiếu nhập này
        </button>
      `;
    }

    if (actionBtnsEl) {
      actionBtnsEl.innerHTML = btns;

      document.getElementById("poDetailReceiveBtn")?.addEventListener("click", async () => {
        const ok = confirm(`Xác nhận nhận hàng cho phiếu #${po.id}? Tồn kho sẽ được cập nhật và giá nhập bình quân sẽ được tính lại.`);
        if (!ok) return;
        try {
          await receivePurchaseOrder(po.id);
          products = getProducts();
          renderInventoryTable();
          await openPurchaseDetailModal(po.id);
          await loadAndRenderInventoryPurchases();
          await loadAndRenderFinanceReports();
          showToast(`Phiếu #${po.id} đã chuyển sang Đã nhận hàng. Đã cập nhật tồn kho & giá nhập bình quân!`);
        } catch (err) {
          showToast(err.message || "Lỗi khi nhận hàng.", "error");
        }
      });

      document.getElementById("poDetailPayDebtBtn")?.addEventListener("click", () => {
        openPayDebtModal(po);
      });

      document.getElementById("poDetailCancelBtn")?.addEventListener("click", () => {
        openCancelPoModal(po);
      });
    }

    initIcons();
  } catch (err) {
    console.error("Lỗi xem chi tiết phiếu nhập:", err);
    bodyEl.innerHTML = `<div style="text-align: center; color: #b91c1c; padding: 24px;">Lỗi tải dữ liệu: ${escapeHtml(err.message)}</div>`;
  }
}

// Mở modal trả nợ phiếu nhập kho
function openPayDebtModal(po) {
  const modal = document.getElementById("purchasePayDebtModalBackdrop");
  if (!modal) return;

  document.getElementById("poPayDebtPoId").value = po.id;
  document.getElementById("poPayDebtCodeLabel").textContent = `#${po.id} - ${po.supplierName || ""}`;
  document.getElementById("poPayDebtMaxLabel").textContent = formatPrice(po.debtAmount || 0);

  const amountInp = document.getElementById("poPayDebtAmountInput");
  if (amountInp) {
    amountInp.value = po.debtAmount || 0;
    amountInp.max = po.debtAmount || 0;
  }
  const noteInp = document.getElementById("poPayDebtNoteInput");
  if (noteInp) noteInp.value = `Thanh toán công nợ phiếu nhập #${po.id}`;

  modal.classList.add("show");
}

// Mở modal hủy phiếu nhập kho
function openCancelPoModal(po) {
  const modal = document.getElementById("purchaseCancelModalBackdrop");
  if (!modal) return;

  document.getElementById("poCancelTargetId").value = po.id;
  const warnEl = document.getElementById("poCancelWarningBox");
  if (warnEl) {
    if (po.receivedStatus === "RECEIVED") {
      warnEl.innerHTML = `<strong>Lưu ý quan trọng:</strong> Phiếu nhập #${escapeHtml(po.id)} đã được nhập kho. Khi hủy, hệ thống sẽ tự động <strong>trừ lại số lượng tồn kho</strong> tương ứng và ghi nhận nhật ký <em>Trả hàng NCC</em>.`;
    } else {
      warnEl.innerHTML = `Phiếu nhập #${escapeHtml(po.id)} đang ở trạng thái <em>Lưu nháp</em>. Hủy phiếu sẽ không ảnh hưởng đến số lượng tồn kho.`;
    }
  }

  const noteInp = document.getElementById("poCancelNoteInput");
  if (noteInp) noteInp.value = "";

  modal.classList.add("show");
}

function bindInventoryEvents() {
  const searchInput = document.getElementById("inventorySearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      inventorySearchQuery = e.target.value;
      renderInventoryTable();
    });
  }

  // Chuyển đổi các subtabs tồn kho
  document.querySelectorAll("#invSubTabs [data-inv-subtab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchInventorySubtab(btn.dataset.invSubtab);
    });
  });

  // Nút top bar
  document.getElementById("invOpenCreatePoTopBtn")?.addEventListener("click", () => openCreatePurchaseModal(null));
  document.getElementById("invCreatePoBtn")?.addEventListener("click", () => openCreatePurchaseModal(null));
  document.getElementById("invOpenAdjustTopBtn")?.addEventListener("click", () => openAdjustInventoryModal(null));

  // Bộ lọc phiếu nhập kho
  document.getElementById("invPoSearchInput")?.addEventListener("input", (e) => {
    invPoSearchQuery = e.target.value;
    loadAndRenderInventoryPurchases();
  });
  document.getElementById("invPoFilterReceived")?.addEventListener("change", (e) => {
    invPoFilterReceived = e.target.value;
    loadAndRenderInventoryPurchases();
  });
  document.getElementById("invPoFilterPayment")?.addEventListener("change", (e) => {
    invPoFilterPayment = e.target.value;
    loadAndRenderInventoryPurchases();
  });
  document.getElementById("invPoRefreshBtn")?.addEventListener("click", () => {
    loadAndRenderInventoryPurchases();
  });

  // Bộ lọc nhật ký biến động kho
  document.getElementById("invMovementSearchInput")?.addEventListener("input", (e) => {
    invMovementSearchQuery = e.target.value;
    loadAndRenderInventoryMovements();
  });
  document.getElementById("invMovementFilterType")?.addEventListener("change", (e) => {
    invMovementFilterType = e.target.value;
    loadAndRenderInventoryMovements();
  });
  document.getElementById("invMovementRefreshBtn")?.addEventListener("click", () => {
    loadAndRenderInventoryMovements();
  });

  // Toggle bảng chỉnh sửa biến thể trong kho
  document.addEventListener("click", (e) => {
    const toggleInvBtn = e.target.closest("[data-toggle-inv-vars]");
    if (toggleInvBtn) {
      const pId = toggleInvBtn.dataset.toggleInvVars;
      const subRow = document.getElementById(`inv-variants-${pId}`);
      if (subRow) {
        const isVisible = subRow.style.display !== "none";
        subRow.style.display = isVisible ? "none" : "table-row";
      }
    }
  });

  // Mở trực tiếp Nhập hàng từ nhà cung cấp
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-open-create-po]");
    if (btn) {
      const pId = btn.dataset.openCreatePo;
      const vId = btn.dataset.variantId || "";
      const p = products.find((item) => String(item.id) === String(pId));
      if (p) {
        const v = vId && Array.isArray(p.variants) ? p.variants.find((item) => String(item.id) === String(vId)) : null;
        openCreatePurchaseModal({
          productId: p.id,
          variantId: v ? v.id : (p.variants && p.variants.length > 0 ? p.variants[0].id : ""),
          quantity: 10,
          unitCost: p.costPrice || 0
        });
      } else {
        openCreatePurchaseModal();
      }
    }
  });

  // Mở trực tiếp Điều chỉnh số lượng
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-open-adjust-stock]");
    if (btn) {
      const pId = btn.dataset.openAdjustStock;
      const vId = btn.dataset.variantId || "";
      openAdjustInventoryModal({ productId: pId, variantId: vId });
    }
  });

  // Mở tạo phiếu nhập hàng từ modal chi tiết thiếu giá nhập
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-drilldown-create-po]");
    if (btn) {
      const pId = btn.dataset.drilldownCreatePo;
      document.getElementById("finKpiDrilldownModalBackdrop")?.classList.remove("show");
      openCreatePurchaseModal({ productId: pId, quantity: 10, unitCost: 0 });
    }
  });

  // Mở modal lựa chọn thao tác cập nhật kho từ bảng
  document.addEventListener("click", (e) => {
    const actBtn = e.target.closest("[data-open-inv-action]");
    if (actBtn) {
      const pId = actBtn.dataset.openInvAction;
      const vId = actBtn.dataset.variantId || "";
      openInvActionModal(pId, vId);
    }
  });

  // Lựa chọn thao tác trong Modal
  const actionModal = document.getElementById("invActionSelectModalBackdrop");
  document.getElementById("invActionSelectCloseBtn")?.addEventListener("click", () => actionModal?.classList.remove("show"));
  document.getElementById("invActionSelectCancelBtn")?.addEventListener("click", () => actionModal?.classList.remove("show"));

  document.getElementById("invActionChoosePoBtn")?.addEventListener("click", () => {
    actionModal?.classList.remove("show");
    openCreatePurchaseModal(invActionTarget);
  });

  document.getElementById("invActionChooseAdjustBtn")?.addEventListener("click", () => {
    actionModal?.classList.remove("show");
    openAdjustInventoryModal(invActionTarget);
  });

  // Modal Điều chỉnh tồn kho Form Submit
  const adjModal = document.getElementById("invAdjustModalBackdrop");
  const adjForm = document.getElementById("invAdjustForm");
  document.getElementById("invAdjustCloseBtn")?.addEventListener("click", () => adjModal?.classList.remove("show"));
  document.getElementById("invAdjustCancelBtn")?.addEventListener("click", () => adjModal?.classList.remove("show"));

  if (adjForm) {
    adjForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const pId = document.getElementById("invAdjProductSelect").value;
      const vWrap = document.getElementById("invAdjVariantWrap");
      const vId = vWrap?.style.display !== "none" ? document.getElementById("invAdjVariantSelect").value : "";
      const newStock = Number(document.getElementById("invAdjNewStockInput").value);
      const reason = document.getElementById("invAdjReasonSelect").value;
      const note = document.getElementById("invAdjNoteInput").value.trim();

      const ok = confirm(`Xác nhận điều chỉnh số lượng tồn thực tế của sản phẩm thành ${newStock} chiếc? (Lý do: ${reason})`);
      if (!ok) return;

      const subBtn = document.getElementById("invAdjustSubmitBtn");
      if (subBtn) subBtn.disabled = true;

      try {
        await adjustInventoryStock({
          productId: pId,
          variantId: vId,
          newStock,
          reason,
          note
        });
        products = getProducts();
        adjModal.classList.remove("show");
        renderInventoryTable();
        loadAndRenderInventoryMovements();
        showToast("Đã điều chỉnh tồn kho thành công và ghi nhận vào Sổ biến động!");
      } catch (err) {
        showToast(err.message || "Lỗi khi điều chỉnh tồn kho.", "error");
      } finally {
        if (subBtn) subBtn.disabled = false;
      }
    });
  }

  // Modal Tạo phiếu nhập kho Form
  const poModal = document.getElementById("finPurchaseModalBackdrop");
  const poForm = document.getElementById("finPurchaseForm");
  document.getElementById("finPurchaseModalCloseBtn")?.addEventListener("click", () => poModal?.classList.remove("show"));
  document.getElementById("finPurchaseCancelBtn")?.addEventListener("click", () => poModal?.classList.remove("show"));

  document.getElementById("finPoAddItemBtn")?.addEventListener("click", () => {
    if (products.length === 0) {
      showToast("Chưa có danh mục sản phẩm để nhập hàng.", "error");
      return;
    }
    const firstP = products[0];
    invPoItems.push({
      id: `poi_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      productId: firstP.id,
      variantId: firstP.variants && firstP.variants.length > 0 ? firstP.variants[0].id : "",
      quantity: 5,
      unitCost: firstP.costPrice || 0,
      discount: 0
    });
    renderPoItemsRows();
    recalculatePoTotals();
  });

  document.getElementById("finPoDiscountInput")?.addEventListener("input", recalculatePoTotals);
  document.getElementById("finPoShippingInput")?.addEventListener("input", recalculatePoTotals);
  document.getElementById("finPoPaymentStatusInput")?.addEventListener("change", recalculatePoTotals);
  document.getElementById("finPoPaidAmountInput")?.addEventListener("input", recalculatePoTotals);

  if (poForm) {
    poForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (invPoItems.length === 0) {
        showToast("Vui lòng thêm ít nhất 1 mặt hàng vào phiếu nhập kho.", "error");
        return;
      }

      const supplierName = document.getElementById("finPoSupplierInput").value.trim();
      const purchaseDate = document.getElementById("finPoDateInput").value;
      const receivedStatus = document.getElementById("finPoReceivedStatusInput").value;
      const paymentStatus = document.getElementById("finPoPaymentStatusInput").value;
      const paymentMethod = document.getElementById("finPoPaymentMethodInput").value;
      const discountAmount = Math.max(0, Number(document.getElementById("finPoDiscountInput").value) || 0);
      const shippingFee = Math.max(0, Number(document.getElementById("finPoShippingInput").value) || 0);
      const paidAmount = paymentStatus === "PAID"
        ? undefined
        : (paymentStatus === "PARTIALLY_PAID" ? Math.max(0, Number(document.getElementById("finPoPaidAmountInput").value) || 0) : 0);
      const attachmentUrl = document.getElementById("finPoAttachmentInput").value.trim();
      const note = document.getElementById("finPoNoteInput").value.trim();

      const payload = {
        supplierName,
        purchaseDate,
        receivedStatus,
        paymentStatus,
        paymentMethod,
        discountAmount,
        shippingFee,
        paidAmount,
        attachmentUrl,
        note,
        items: invPoItems.map((it) => {
          const p = products.find((item) => String(item.id) === String(it.productId));
          const v = it.variantId && p?.variants ? p.variants.find((item) => String(item.id) === String(it.variantId)) : null;
          return {
            productId: it.productId,
            productName: p ? p.name : it.productId,
            variantId: it.variantId || "",
            variantName: v ? v.name : "",
            quantity: Number(it.quantity) || 1,
            unitCost: Number(it.unitCost) || 0,
            discount: Number(it.discount) || 0
          };
        })
      };

      const ok = confirm(`Xác nhận tạo phiếu nhập kho từ "${supplierName}" với ${payload.items.length} mặt hàng?`);
      if (!ok) return;

      const subBtn = document.getElementById("finPurchaseSubmitBtn");
      if (subBtn) subBtn.disabled = true;

      try {
        const created = await createPurchaseOrder(payload);
        products = getProducts();
        poModal.classList.remove("show");
        renderInventoryTable();
        await loadAndRenderInventoryPurchases();
        await loadAndRenderInventoryMovements();
        await loadAndRenderFinanceReports();
        showToast(`Đã tạo thành công phiếu nhập kho #${created.id}!`);
      } catch (err) {
        showToast(err.message || "Lỗi khi tạo phiếu nhập kho.", "error");
      } finally {
        if (subBtn) subBtn.disabled = false;
      }
    });
  }

  // Xem chi tiết phiếu nhập (Ủy quyền toàn cục click vào mã phiếu)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-view-po]");
    if (btn) {
      const poId = btn.dataset.viewPo;
      openPurchaseDetailModal(poId);
    }
  });

  const poDetailModal = document.getElementById("purchaseDetailModalBackdrop");
  document.getElementById("poDetailCloseBtn")?.addEventListener("click", () => poDetailModal?.classList.remove("show"));
  document.getElementById("poDetailDismissBtn")?.addEventListener("click", () => poDetailModal?.classList.remove("show"));

  // Trực tiếp nhận hàng từ bảng
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-receive-po]");
    if (btn) {
      const poId = btn.dataset.receivePo;
      const ok = confirm(`Xác nhận nhận hàng cho phiếu #${poId}? Tồn kho sẽ được cập nhật và giá nhập bình quân sẽ được tính lại.`);
      if (!ok) return;
      try {
        await receivePurchaseOrder(poId);
        products = getProducts();
        renderInventoryTable();
        await loadAndRenderInventoryPurchases();
        await loadAndRenderInventoryMovements();
        await loadAndRenderFinanceReports();
        showToast(`Phiếu #${poId} đã được nhận hàng và nhập kho thành công!`);
      } catch (err) {
        showToast(err.message || "Lỗi nhận hàng.", "error");
      }
    }
  });

  // Trực tiếp trả nợ từ bảng
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-pay-po]");
    if (btn) {
      const poId = btn.dataset.payPo;
      const po = inventoryPurchases.find((item) => String(item.id) === String(poId)) || { id: poId, debtAmount: 0 };
      openPayDebtModal(po);
    }
  });

  // Modal Trả nợ Submit
  const payDebtModal = document.getElementById("purchasePayDebtModalBackdrop");
  const payDebtForm = document.getElementById("purchasePayDebtForm");
  document.getElementById("poPayDebtCloseBtn")?.addEventListener("click", () => payDebtModal?.classList.remove("show"));
  document.getElementById("poPayDebtCancelBtn")?.addEventListener("click", () => payDebtModal?.classList.remove("show"));

  if (payDebtForm) {
    payDebtForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const poId = document.getElementById("poPayDebtPoId").value;
      const amount = Number(document.getElementById("poPayDebtAmountInput").value);
      const paymentMethod = document.getElementById("poPayDebtMethodSelect").value;
      const note = document.getElementById("poPayDebtNoteInput").value.trim();

      const ok = confirm(`Xác nhận thanh toán ${formatPrice(amount)} cho phiếu nhập #${poId}?`);
      if (!ok) return;

      const subBtn = document.getElementById("poPayDebtSubmitBtn");
      if (subBtn) subBtn.disabled = true;

      try {
        await payPurchaseOrder(poId, { amount, paymentMethod, note });
        payDebtModal.classList.remove("show");
        if (currentPoDetail && String(currentPoDetail.id) === String(poId)) {
          await openPurchaseDetailModal(poId);
        }
        await loadAndRenderInventoryPurchases();
        await loadAndRenderFinanceReports();
        showToast(`Đã ghi nhận thanh toán ${formatPrice(amount)} cho phiếu #${poId}!`);
      } catch (err) {
        showToast(err.message || "Lỗi khi ghi nhận thanh toán.", "error");
      } finally {
        if (subBtn) subBtn.disabled = false;
      }
    });
  }

  // Modal Hủy phiếu Submit
  const cancelModal = document.getElementById("purchaseCancelModalBackdrop");
  const cancelForm = document.getElementById("purchaseCancelForm");
  document.getElementById("poCancelCloseBtn")?.addEventListener("click", () => cancelModal?.classList.remove("show"));
  document.getElementById("poCancelDismissBtn")?.addEventListener("click", () => cancelModal?.classList.remove("show"));

  if (cancelForm) {
    cancelForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const poId = document.getElementById("poCancelTargetId").value;
      const reasonType = document.getElementById("poCancelReasonSelect").value;
      const note = document.getElementById("poCancelNoteInput").value.trim();
      const fullReason = `${reasonType}: ${note}`;

      const ok = confirm(`Bạn có chắc chắn muốn HỦY phiếu nhập kho #${poId}?`);
      if (!ok) return;

      const subBtn = document.getElementById("poCancelConfirmBtn");
      if (subBtn) subBtn.disabled = true;

      try {
        await cancelPurchaseOrder(poId, fullReason);
        products = getProducts();
        cancelModal.classList.remove("show");
        if (currentPoDetail && String(currentPoDetail.id) === String(poId)) {
          await openPurchaseDetailModal(poId);
        }
        renderInventoryTable();
        await loadAndRenderInventoryPurchases();
        await loadAndRenderInventoryMovements();
        await loadAndRenderFinanceReports();
        showToast(`Đã hủy phiếu nhập #${poId} thành công!`);
      } catch (err) {
        showToast(err.message || "Lỗi khi hủy phiếu nhập.", "error");
      } finally {
        if (subBtn) subBtn.disabled = false;
      }
    });
  }
}

/* ==========================================================================
   TAB 6: QUẢN LÝ TÀI KHOẢN & PHÂN QUYỀN (ROLE MANAGEMENT & PRIVACY)
   ========================================================================== */
function renderCustomersTable() {
  users = getUsers().filter((u) => u && String(u.id) !== "U_ADMIN_01" && !u.hidden);
  const currentUser = getCurrentUser();
  const isAdmin = currentUser && currentUser.role === "admin";

  const totalCount = users.length;
  const adminCount = users.filter((u) => u.role === "admin").length;
  const staffCount = users.filter((u) => u.role === "staff").length;
  const cashierCount = users.filter((u) => u.role === "cashier").length;
  const custCount = users.filter((u) => u.role === "customer" || (!u.role || (u.role !== "admin" && u.role !== "staff" && u.role !== "cashier"))).length;

  const countAll = document.getElementById("custCountAll");
  const countAdmin = document.getElementById("custCountAdmin");
  const countStaff = document.getElementById("custCountStaff");
  const countCashier = document.getElementById("custCountCashier");
  const countCust = document.getElementById("custCountCust");

  if (countAll) countAll.textContent = totalCount;
  if (countAdmin) countAdmin.textContent = adminCount;
  if (countStaff) countStaff.textContent = staffCount;
  if (countCashier) countCashier.textContent = cashierCount;
  if (countCust) countCust.textContent = custCount;

  const query = customerSearchQuery.trim().toLowerCase();
  const filtered = users.filter((u) => {
    const roleMatch =
      customerRoleFilter === "all" ||
      (customerRoleFilter === "customer"
        ? u.role === "customer" || !u.role || (u.role !== "admin" && u.role !== "staff" && u.role !== "cashier")
        : u.role === customerRoleFilter);
    if (!roleMatch) return false;
    if (!query) return true;
    return (
      (u.name || "").toLowerCase().includes(query) ||
      (u.email || "").toLowerCase().includes(query) ||
      (u.phone || "").toLowerCase().includes(query) ||
      (u.note || "").toLowerCase().includes(query) ||
      (u.tier || "").toLowerCase().includes(query)
    );
  });

  const tbody = document.getElementById("customersTable");
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b; padding: 24px;">Không tìm thấy tài khoản phù hợp bộ lọc.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((u) => {
    const roleInfo = getRoleLabel(u.role);
    const isStaffOrAdmin = u.role === "admin" || u.role === "staff" || u.role === "cashier";
    const isGranularRole = u.role === "staff" || u.role === "cashier";
    const isDisabled = u.active === false;
    const dateFormatted = u.createdAt ? new Date(u.createdAt).toLocaleDateString("vi-VN") : "—";
    const avatarHtml = u.avatar
      ? `<img src="${u.avatar}" alt="Avatar" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;">`
      : `<span style="display: inline-flex; width: 32px; height: 32px; border-radius: 50%; background: #e3ece6; color: #1e3a29; align-items: center; justify-content: center; font-weight: 700; font-size: 13px;">${escapeHtml((u.name || "U")[0].toUpperCase())}</span>`;

    const totalPermKeys = Object.keys(PERMISSIONS).length;
    const effectivePermsCount = getUserEffectivePermissions(u).length;
    const staffPermsBadge = isGranularRole
      ? `<br><span style="display: inline-block; margin-top: 4px; background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;">${effectivePermsCount}/${totalPermKeys} quyền</span>`
      : "";
    const statusBadge = isDisabled
      ? `<br><span style="display: inline-block; margin-top: 4px; background: #fee2e2; color: #b91c1c; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;">Đã vô hiệu hóa</span>`
      : "";
    const canToggleStatus = isAdmin && String(u.id) !== "U_ADMIN" && !(u.role === "admin" && adminCount <= 1);

    return `
      <tr style="${isDisabled ? "opacity: 0.65; background: #fef2f2;" : ""}">
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${avatarHtml}
            <div>
              <strong>${escapeHtml(u.name || "Chưa đặt tên")}</strong>
              <br><small style="color: #64748b;">ID: ${escapeHtml(u.id || "")}</small>
            </div>
          </div>
        </td>
        <td>
          <code style="background: #f1f5f2; padding: 2px 6px; border-radius: 4px; font-size: 13px;">${escapeHtml(u.email)}</code>
        </td>
        <td>
          <span class="badge-role ${roleInfo.class}">${roleInfo.text}</span>
          ${staffPermsBadge}
          ${statusBadge}
        </td>
        <td>${escapeHtml(u.phone || "—")}</td>
        <td>
          ${isStaffOrAdmin
            ? `<span style="color: #64748b; font-size: 12.5px;">— (Tài khoản nội bộ)</span>`
            : `<strong>Hạng: ${escapeHtml(u.tier || "Đồng")}</strong>`}
          ${u.note ? `<br><small style="color: #64748b;">${escapeHtml(u.note)}</small>` : ""}
        </td>
        <td><small style="color: #64748b;">${dateFormatted}</small></td>
        <td>
          ${isAdmin
            ? `<div style="display: flex; gap: 6px; flex-wrap: wrap;">
                <button class="table-action-btn" type="button" data-change-role="${escapeHtml(u.id)}">${isGranularRole ? "Phân quyền" : "Đổi vai trò"}</button>
                ${canToggleStatus ? `<button class="table-action-btn" type="button" data-toggle-user-active="${escapeHtml(u.id)}" data-next-active="${isDisabled ? "true" : "false"}" style="color: ${isDisabled ? "#15803d" : "#b91c1c"};">${isDisabled ? "Kích hoạt" : "Vô hiệu hóa"}</button>` : ""}
              </div>`
            : `<small style="color: #94a3b8;">Chỉ Admin</small>`}
        </td>
      </tr>
    `;
  }).join("");
}

function bindCustomersEvents() {
  const searchInput = document.getElementById("customerSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      customerSearchQuery = e.target.value;
      renderCustomersTable();
    });
  }

  const roleModal = document.getElementById("roleModalBackdrop");
  const roleForm = document.getElementById("roleModalForm");
  const roleUserId = document.getElementById("roleUserId");
  const roleUserTargetText = document.getElementById("roleUserTargetText");
  const roleSelect = document.getElementById("roleSelect");
  const roleNoteInput = document.getElementById("roleNoteInput");
  const roleCloseBtn = document.getElementById("roleModalCloseBtn");
  const roleCancelBtn = document.getElementById("roleModalCancelBtn");
  const permsContainer = document.getElementById("staffPermissionsContainer");
  const permsList = document.getElementById("staffPermissionsList");
  const selectAllBtn = document.getElementById("btnSelectAllPerms");
  const clearAllBtn = document.getElementById("btnClearAllPerms");

  const closeRoleModal = () => roleModal.classList.remove("show");
  if (roleCloseBtn) roleCloseBtn.onclick = closeRoleModal;
  if (roleCancelBtn) roleCancelBtn.onclick = closeRoleModal;

  // Click change role button
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-change-role]");
    if (!btn) return;

    const uId = btn.dataset.changeRole;
    const targetUser = users.find((u) => String(u.id) === String(uId));
    if (!targetUser) return;

    const currentRole = targetUser.role || "customer";
    const roleInfo = getRoleLabel(currentRole);

    roleUserId.value = targetUser.id;
    roleUserTargetText.innerHTML = `
      Tài khoản: <strong>${escapeHtml(targetUser.name)}</strong> (${escapeHtml(targetUser.email)})<br>
      Vai trò hiện tại: <span class="badge-role ${roleInfo.class}">${roleInfo.text}</span>
    `;
    roleSelect.value = currentRole;
    roleNoteInput.value = targetUser.note || "";

    function renderPermsCheckboxes() {
      if (!permsList) return;
      const selectedRole = roleSelect.value;
      const isCashier = selectedRole === "cashier";
      // Tính danh sách quyền hiệu lực dựa trên vai trò đang chọn và quyền đã cấp cho tài khoản
      const tempUser = { ...targetUser, role: selectedRole };
      const effectivePerms = new Set(getUserEffectivePermissions(tempUser));
      permsList.innerHTML = PERMISSION_GROUPS.map((g) => `
        <div style="background: #ffffff; padding: 8px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
          <div style="font-weight: 700; font-size: 12.5px; color: #0f172a; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
            ${renderIcon(g.icon, { size: 14, strokeWidth: 2 })} ${g.groupName}
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
            ${g.permissions.map((p) => {
              const forbiddenForCashier = isCashier && CASHIER_FORBIDDEN_PERMISSIONS.has(p.key);
              const checked = !forbiddenForCashier && effectivePerms.has(p.key);
              return `
              <label style="display: flex; align-items: flex-start; gap: 6px; font-size: 11.5px; cursor: ${forbiddenForCashier ? "not-allowed" : "pointer"}; color: ${forbiddenForCashier ? "#94a3b8" : "#334155"};" title="${forbiddenForCashier ? "Thu ngân không được phép sử dụng quyền này" : ""}">
                <input type="checkbox" name="staff_perm" value="${p.key}" ${checked ? "checked" : ""} ${forbiddenForCashier ? "disabled" : ""} style="margin-top: 2px;">
                <span>${p.label}${forbiddenForCashier ? " (Khóa với Thu ngân)" : ""}</span>
              </label>
            `;
            }).join("")}
          </div>
        </div>
      `).join("");
    }

    if (permsContainer) {
      const showPerms = roleSelect.value === "staff" || roleSelect.value === "cashier";
      permsContainer.style.display = showPerms ? "block" : "none";
      renderPermsCheckboxes();
    }

    roleSelect.onchange = () => {
      if (permsContainer) {
        const showPerms = roleSelect.value === "staff" || roleSelect.value === "cashier";
        permsContainer.style.display = showPerms ? "block" : "none";
        renderPermsCheckboxes();
      }
    };

    if (selectAllBtn) {
      selectAllBtn.onclick = () => {
        permsList?.querySelectorAll('input[type="checkbox"]:not(:disabled)').forEach((cb) => (cb.checked = true));
      };
    }
    if (clearAllBtn) {
      clearAllBtn.onclick = () => {
        permsList?.querySelectorAll('input[type="checkbox"]:not(:disabled)').forEach((cb) => (cb.checked = false));
      };
    }

    roleModal.classList.add("show");
  });

  // Toggle user active/disabled status
  document.addEventListener("click", async (e) => {
    const toggleBtn = e.target.closest("[data-toggle-user-active]");
    if (!toggleBtn) return;
    const uId = toggleBtn.dataset.toggleUserActive;
    const nextActive = toggleBtn.dataset.nextActive === "true";
    const targetUser = users.find((u) => String(u.id) === String(uId));
    if (!targetUser) return;
    const ok = confirm(`${nextActive ? "Kích hoạt lại" : "Vô hiệu hóa"} tài khoản "${targetUser.name}" (${targetUser.email})?`);
    if (!ok) return;
    try {
      await updateUserActiveStatus(uId, nextActive);
      users = getUsers();
      renderCustomersTable();
      showToast(nextActive ? `Đã kích hoạt tài khoản ${targetUser.name}.` : `Đã vô hiệu hóa tài khoản ${targetUser.name}.`);
    } catch (err) {
      showToast(err?.message || "Không thể cập nhật trạng thái tài khoản.", "error");
    }
  });

  // Submit role change with Last-Admin protection & Granular Permissions
  if (roleForm) {
    roleForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const uId = roleUserId.value;
      const newRole = roleSelect.value;
      const note = roleNoteInput.value.trim();

      const targetUser = users.find((u) => String(u.id) === String(uId));
      if (!targetUser) return;

      const adminUsers = users.filter((u) => u.role === "admin" && u.active !== false);
      // Quy tắc bảo vệ Admin cuối cùng: Không được hạ quyền nếu chỉ còn 1 Admin!
      if (targetUser.role === "admin" && newRole !== "admin" && adminUsers.length <= 1) {
        alert("CHẶN THAO TÁC: Không thể hạ quyền Quản trị viên cuối cùng của hệ thống! Hệ thống phải luôn duy trì ít nhất 1 tài khoản Quản trị viên.");
        return;
      }

      const roleInfo = getRoleLabel(newRole);
      const confirmed = confirm(`Xác nhận lưu cập nhật vai trò / phân quyền cho tài khoản "${targetUser.name}"?`);
      if (!confirmed) return;

      try {
        await updateUserRole(targetUser.id, newRole, note);

        // Nếu vai trò là staff hoặc cashier, lưu các quyền đã chọn xuống backend
        if (newRole === "staff" || newRole === "cashier") {
          const checkedBoxes = roleForm.querySelectorAll('input[name="staff_perm"]:checked:not(:disabled)');
          const selectedPerms = Array.from(checkedBoxes).map((cb) => cb.value);
          await updateStaffPermissions(targetUser.id, selectedPerms, getCurrentUser());
        }

        users = getUsers();

        // Nếu admin tự đổi vai trò của chính mình, cập nhật lại phiên đăng nhập
        const currentUser = getCurrentUser();
        if (currentUser && String(currentUser.id) === String(targetUser.id)) {
          currentUser.role = newRole;
          localStorage.setItem("ecodesk_current_user", JSON.stringify(currentUser));
          renderUserInfo();
          applyRBACPermissions(currentUser);
        }

        closeRoleModal();
        renderCustomersTable();
        showToast(`Đã lưu vai trò "${roleInfo.text}" và cập nhật phân quyền cho tài khoản ${targetUser.name}.`);
      } catch (err) {
        showToast(err?.message || "Không thể cập nhật phân quyền.", "error");
      }
    });
  }

  // Download users (without passwords for privacy)
  const downloadBtn = document.getElementById("downloadUsersBtn");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", () => {
      const sanitizedUsers = users.map((u) => ({
        "Mã tài khoản": u.id,
        "Họ và tên": u.name,
        "Email": u.email,
        "Vai trò": getRoleLabel(u.role).text,
        "Số điện thoại": u.phone || "—",
        "Hạng thành viên": (u.role === "admin" || u.role === "staff") ? "—" : (u.tier || "Đồng"),
        "Tổng chi tiêu (VNĐ)": u.spendTotal || 0,
        "Ghi chú": u.note || "",
        "Ngày tạo": formatDate(u.createdAt)
      }));

      exportToExcel(sanitizedUsers, "ecodesk-danh-sach-tai-khoan", "Tài khoản");
      showToast("Đã xuất danh sách tài khoản ra file Excel an toàn (đã ẩn mật khẩu).");
    });
  }

  const reloadBtn = document.getElementById("reloadUsersBtn");
  if (reloadBtn) {
    reloadBtn.addEventListener("click", async () => {
      reloadBtn.disabled = true;
      reloadBtn.textContent = "Đang đọc...";
      try {
        const diskUsers = await loadUsersFromDisk();
        if (diskUsers && diskUsers.length > 0) {
          localStorage.setItem("ecodesk_users", JSON.stringify(diskUsers));
          users = getUsers();
          renderCustomersTable();
          showToast(`Đã đồng bộ thành công ${diskUsers.length} tài khoản từ file users.json!`);
        } else {
          showToast("Không tìm thấy dữ liệu trong users.json hoặc file trống.");
        }
      } catch (err) {
        showToast("Lỗi khi đọc file users.json: " + err.message);
      } finally {
        reloadBtn.disabled = false;
        reloadBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:6px;">${renderIcon("refresh-cw", { size: 14, strokeWidth: 1.8 })} Đồng bộ từ file</span>`;
      }
    });
  }
}

/* ==========================================================================
   CAMPAIGNS & BANNERS
   ========================================================================== */
function fillProductSelects() {
  const options = products
    .map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`)
    .join("");

  const campaignSelect = document.getElementById("campaignProduct");
  const bannerSelect = document.getElementById("bannerProduct");

  if (campaignSelect) campaignSelect.innerHTML = `<option value="">Chọn sản phẩm</option>${options}`;
  if (bannerSelect) bannerSelect.innerHTML = `<option value="">Chọn ảnh theo sản phẩm</option>${options}`;
}

function renderSchedules() {
  const campaignList = document.getElementById("campaignList");
  if (campaignList) {
    const list = getCampaigns();
    const now = new Date();
    campaignList.innerHTML = list
      .map((c) => {
        const p = products.find((item) => String(item.id) === String(c.productId));
        const sched = getCampaignScheduleStatus(c, now);
        let badgeColor = "#64748b";
        let badgeBg = "#f1f5f9";
        let badgeBorder = "#cbd5e1";
        if (sched.status === "active") {
          badgeColor = "#15803d";
          badgeBg = "#dcfce7";
          badgeBorder = "#86efac";
        } else if (sched.status === "upcoming") {
          badgeColor = "#b45309";
          badgeBg = "#fef3c7";
          badgeBorder = "#fcd34d";
        }

        const typeLabel = c.type === "special" ? "Dịp đặc biệt (tối đa 90%)" : "Sự kiện thường (tối đa 50%)";

        return `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border: 1px solid #e2e8f0; border-radius: 10px; background: #fff; gap: 16px; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 240px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">
                <strong style="font-size: 15px; color: #0f172a;">${escapeHtml(c.name)}</strong>
                <span style="font-size: 12px; font-weight: 700; color: #059669; background: #ecfdf5; padding: 2px 8px; border-radius: 9999px;">-${c.percent || c.value}%</span>
                <span style="font-size: 12px; font-weight: 600; color: ${badgeColor}; background: ${badgeBg}; border: 1px solid ${badgeBorder}; padding: 2px 8px; border-radius: 9999px;">${escapeHtml(sched.label)}</span>
              </div>
              <div style="font-size: 13px; color: #475569; margin-bottom: 2px;">
                <strong>Sản phẩm:</strong> ${escapeHtml(p?.name || "ID: " + (c.productId || "Chưa gắn"))} · <code style="font-size: 12px; background: #f8fafc; padding: 1px 4px; border-radius: 4px;">Mã: ${escapeHtml(c.code)}</code>
              </div>
              <div style="font-size: 12px; color: #64748b;">
                <strong>Thời gian:</strong> ${formatDateTimeVN(c.startAt)} – ${formatDateTimeVN(c.endAt)} · <em>${escapeHtml(typeLabel)}</em>
              </div>
            </div>
            <button class="table-action-btn danger" type="button" data-remove-campaign="${escapeHtml(c.id)}" style="flex-shrink: 0;">Xóa lịch</button>
          </div>
        `;
      })
      .join("") || `<p style="color: #64748b; font-size: 13px;">Chưa có lịch sale nào đang được lưu.</p>`;
  }

  const bannerList = document.getElementById("bannerList");
  if (bannerList) {
    bannerList.innerHTML = getBanners()
      .map((b) => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <img src="${escapeHtml(b.image)}" alt="" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px;">
            <div>
              <strong>${escapeHtml(b.title)}</strong>
              <br><small style="color: #64748b;">Lặp lại: ${escapeHtml(b.frequency || "daily")}</small>
            </div>
          </div>
          <button class="table-action-btn danger" type="button" data-remove-banner="${escapeHtml(b.id)}">Xóa</button>
        </div>
      `)
      .join("") || `<p style="color: #64748b; font-size: 13px;">Chưa có banner nào được lên lịch.</p>`;
  }
}

function bindSchedulesEvents() {
  const campaignForm = document.getElementById("campaignForm");
  if (campaignForm) {
    campaignForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = new FormData(campaignForm);
      const cap = data.get("type") === "special" ? 90 : 50;
      const amount = Number(data.get("percent"));
      const startAt = new Date(data.get("startAt"));
      const endAt = new Date(data.get("endAt"));
      const prodId = document.getElementById("campaignProduct").value;

      if (!products.some((item) => item.id === prodId) || amount < 1 || amount > cap || endAt <= startAt) {
        showToast("Vui lòng kiểm tra lại sản phẩm, mức giảm và thời gian khuyến mãi.", "error");
        return;
      }

      // Kiểm tra trùng lịch trước khi gửi
      const overlap = getCampaigns().find((c) => {
        if (!c.active || String(c.productId) !== String(prodId)) return false;
        const oStart = new Date(c.startAt).getTime();
        const oEnd = new Date(c.endAt).getTime();
        return startAt.getTime() < oEnd && oStart < endAt.getTime();
      });
      if (overlap) {
        showToast(`Trùng lịch sale với chương trình "${overlap.name}" (${formatDateTimeVN(overlap.startAt)} – ${formatDateTimeVN(overlap.endAt)})!`, "error");
        return;
      }

      const submitBtn = campaignForm.querySelector("button[type='submit']");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Đang lưu...";
      }

      try {
        const id = `C${Date.now()}`;
        const code = `ECO-${prodId}-${id.slice(-6)}`;
        await createCampaign({
          id,
          productId: prodId,
          name: data.get("name").trim(),
          type: data.get("type"),
          percent: amount,
          code,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          active: true
        });

        campaignForm.reset();
        renderSchedules();
        showToast(`Đã lưu lịch sale thành công! Mã khuyến mãi: ${code}`);
      } catch (err) {
        console.error("Lỗi khi tạo lịch sale:", err);
        showToast(err.message || "Không thể lưu lịch sale vào máy chủ.", "error");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Tạo lịch sale";
        }
      }
    });
  }

  const bannerForm = document.getElementById("bannerForm");
  if (bannerForm) {
    bannerForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(bannerForm);
      const startAt = new Date(data.get("startAt"));
      const endAt = new Date(data.get("endAt"));
      const prodId = document.getElementById("bannerProduct").value;
      const product = products.find((item) => item.id === prodId);

      if (!product || endAt <= startAt) {
        showToast("Vui lòng chọn ảnh sản phẩm và khoảng thời gian hợp lệ.");
        return;
      }

      saveBanners([
        {
          id: `B${Date.now()}`,
          title: data.get("title").trim(),
          description: data.get("description").trim(),
          kicker: "EcoDesk · Nội thất công thái học",
          button: "Khám phá ngay",
          image: product.image,
          link: data.get("link").trim() || "./products.html",
          productId: product.id,
          frequency: data.get("frequency"),
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          active: true,
          priority: Date.now()
        },
        ...getBanners()
      ]);

      bannerForm.reset();
      renderSchedules();
      showToast("Đã lưu banner trang chủ thành công.");
    });
  }

  document.addEventListener("click", async (e) => {
    const removeCamp = e.target.closest("[data-remove-campaign]");
    if (removeCamp) {
      const campId = removeCamp.dataset.removeCampaign;
      if (!confirm("Bạn có chắc chắn muốn xóa lịch sale này không?")) return;
      removeCamp.disabled = true;
      try {
        await deleteCampaign(campId);
        renderSchedules();
        showToast("Đã xóa lịch sale khỏi hệ thống.");
      } catch (err) {
        console.error("Lỗi khi xóa lịch sale:", err);
        showToast(err.message || "Không thể xóa lịch sale trên máy chủ.", "error");
        removeCamp.disabled = false;
      }
    }

    const removeBan = e.target.closest("[data-remove-banner]");
    if (removeBan) {
      saveBanners(getBanners().filter((b) => b.id !== removeBan.dataset.removeBanner));
      renderSchedules();
      showToast("Đã xóa lịch banner.");
    }
  });
}

let adminOrdersPollTimer = null;

async function refreshAdminSepayStatusAndLogs(includeTxTable = false) {
  const statusEl = document.getElementById("adminSepayStatusText");
  const txBody = document.getElementById("adminSepayTxBody");
  const cfg = await fetchSepayPublicConfig(true).catch(() => null);
  if (statusEl) {
    if (!cfg) {
      statusEl.textContent = "Không kết nối được backend.";
    } else if (!cfg.tokenConfigured || !cfg.receiverConfigured) {
      statusEl.innerHTML = `<span style="color:#b45309;">Chưa cấu hình đủ SEPAY_API_TOKEN / tài khoản nhận trong .env backend</span>`;
    } else {
      const timeLabel = cfg.lastSyncAt ? formatDateTime(cfg.lastSyncAt) : "Chưa chạy";
      statusEl.innerHTML = `<span style="color:#15803d; font-weight:600;">${escapeHtml(cfg.environment || "live").toUpperCase()} (${escapeHtml(cfg.apiVersion || "v2")})</span> · Trạng thái: <strong>${escapeHtml(cfg.lastSyncStatus || "IDLE")}</strong> · Lần cuối: ${escapeHtml(timeLabel)}`;
    }
  }

  if (!includeTxTable || !txBody) return;
  try {
    const res = await fetch("/api/payments/sepay/admin-transactions", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    const list = Array.isArray(data?.transactions) ? data.transactions : [];
    if (list.length === 0) {
      txBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#64748b; padding:16px;">Chưa có giao dịch SePay nào được ghi nhận.</td></tr>`;
      return;
    }
    txBody.innerHTML = list.map((t) => {
      const needsAction = !t.resolved;
      return `
        <tr>
          <td style="font-family:monospace;">${escapeHtml(t.sepayTransactionId || "")}</td>
          <td>${escapeHtml(t.transactionDate || "")}</td>
          <td><strong>${formatPrice(t.amountIn || 0)}</strong></td>
          <td style="font-family:monospace;">${escapeHtml(t.extractedCode || "—")}</td>
          <td><span class="payment-badge ${t.matchStatus === "MATCHED_PAID" ? "paid" : (needsAction ? "review" : "cod")}">${escapeHtml(t.matchStatus || "")}</span></td>
          <td>${t.matchedOrderId ? `<strong>#${escapeHtml(t.matchedOrderId)}</strong> · ` : ""}${escapeHtml(t.note || "")}</td>
          <td>
            ${needsAction
              ? `<button type="button" class="table-action-btn" data-resolve-sepay-tx="${t.id}">Đã xử lý</button>`
              : `<span style="color:#15803d; font-size:11.5px;">Đã đối soát</span>`}
          </td>
        </tr>
      `;
    }).join("");
  } catch {}
}

function bindAdminSepayPanel() {
  const syncBtn = document.getElementById("adminSepaySyncBtn");
  const toggleBtn = document.getElementById("adminSepayTxToggleBtn");
  const txPanel = document.getElementById("adminSepayTxPanel");
  const txBody = document.getElementById("adminSepayTxBody");

  refreshAdminSepayStatusAndLogs(false);

  if (syncBtn) {
    syncBtn.addEventListener("click", async () => {
      syncBtn.disabled = true;
      syncBtn.textContent = "Đang đồng bộ...";
      try {
        const res = await triggerSepayBackendSync();
        const freshOrders = await fetchAllOrdersFromBackend();
        if (Array.isArray(freshOrders)) {
          orders = freshOrders;
          renderKPIs(currentTimeFilter);
          renderOrderStatusChart();
          renderOverviewLists();
          renderOrdersTable();
        }
        await refreshAdminSepayStatusAndLogs(txPanel && txPanel.style.display !== "none");
        showToast(res?.message || "Đã kiểm tra đồng bộ giao dịch SePay.");
      } finally {
        syncBtn.disabled = false;
        syncBtn.textContent = "Đồng bộ SePay ngay";
      }
    });
  }

  if (toggleBtn && txPanel) {
    toggleBtn.addEventListener("click", async () => {
      const opening = txPanel.style.display === "none";
      txPanel.style.display = opening ? "block" : "none";
      if (opening) {
        await refreshAdminSepayStatusAndLogs(true);
      }
    });
  }

  if (txBody) {
    txBody.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-resolve-sepay-tx]");
      if (!btn) return;
      const logId = btn.dataset.resolveSepayTx;
      btn.disabled = true;
      try {
        const res = await fetch(`/api/payments/sepay/admin-transactions/${encodeURIComponent(logId)}/resolve`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resolved: true })
        });
        if (res.ok) {
          showToast("Đã đánh dấu giao dịch đối soát xong.");
          await refreshAdminSepayStatusAndLogs(true);
        }
      } finally {
        btn.disabled = false;
      }
    });
  }

  if (adminOrdersPollTimer) clearInterval(adminOrdersPollTimer);
  adminOrdersPollTimer = setInterval(async () => {
    if (document.hidden) return;
    const freshOrders = await fetchAllOrdersFromBackend();
    if (Array.isArray(freshOrders)) {
      orders = freshOrders;
      renderKPIs(currentTimeFilter);
      renderOrderStatusChart();
      renderOverviewLists();
      renderOrdersTable();
      await refreshAdminSepayStatusAndLogs(txPanel && txPanel.style.display !== "none");
    }
  }, 15000);
}

window.addEventListener("pagehide", () => {
  if (adminOrdersPollTimer) {
    clearInterval(adminOrdersPollTimer);
    adminOrdersPollTimer = null;
  }
});

/* ==========================================================================
   DASHBOARD REPORT EXPORT & FINANCE ANALYTICS (REAL BACKEND DATA)
   ========================================================================== */
let financeState = {
  from: "",
  to: "",
  preset: "month",
  subtab: "transactions",
  chartGranularity: "day",
  summary: null,
  transactions: [],
  purchases: [],
  payrolls: [],
  auditLogs: []
};

function getPresetDates(preset) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (preset === "all") {
    return { from: "", to: "" };
  }
  if (preset === "today") {
    const today = fmt(now);
    return { from: today, to: today };
  }
  if (preset === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: fmt(start), to: fmt(now) };
  }
  if (preset === "last_month") {
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: fmt(firstDay), to: fmt(lastDay) };
  }
  if (preset === "quarter") {
    const qMonth = Math.floor(now.getMonth() / 3) * 3;
    const start = new Date(now.getFullYear(), qMonth, 1);
    return { from: fmt(start), to: fmt(now) };
  }
  if (preset === "year") {
    const start = new Date(now.getFullYear(), 0, 1);
    return { from: fmt(start), to: fmt(now) };
  }
  return { from: "", to: "" };
}

function getFinTxTypeLabel(t) {
  switch ((t || "").toUpperCase()) {
    case "EXPENSE_OPERATING": return { label: "Chi vận hành", badge: "background:#fee2e2;color:#b91c1c;" };
    case "EXPENSE_PURCHASE": return { label: "Nhập hàng kho", badge: "background:#ffedd5;color:#c2410c;" };
    case "EXPENSE_PAYROLL": return { label: "Chi lương NV", badge: "background:#ede9fe;color:#6d28d9;" };
    case "INCOME_OTHER": return { label: "Thu khác", badge: "background:#dcfce7;color:#15803d;" };
    case "REFUND_MANUAL": return { label: "Hoàn tiền", badge: "background:#fef3c7;color:#b45309;" };
    default: return { label: t || "Khác", badge: "background:#f1f5f9;color:#475569;" };
  }
}

async function loadAndRenderFinanceReports() {
  const curUser = getCurrentUser();
  if (!curUser) return;
  const canViewFinance = curUser.role === "admin" || hasPermission(curUser, PERMISSIONS.FINANCE_VIEW) || hasPermission(curUser, PERMISSIONS.REPORTS_VIEW);
  if (!canViewFinance) return;

  const kpiGrid = document.getElementById("finKpiGrid");
  const chartContainer = document.getElementById("financeCashflowChart");

  if (kpiGrid && !financeState.summary) {
    kpiGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 36px 16px; color: #64748b; font-size: 13.5px;">
        <span class="spinner-border spinner-border-sm text-primary" role="status" style="margin-right:8px;"></span>Đang tổng hợp dữ liệu tài chính &amp; đơn hàng từ cơ sở dữ liệu...
      </div>`;
  }
  if (chartContainer && !financeState.summary) {
    chartContainer.innerHTML = `
      <div style="text-align: center; padding: 48px 16px; color: #64748b; font-size: 13.5px;">
        <span class="spinner-border spinner-border-sm text-primary" role="status" style="margin-right:8px;"></span>Đang tải biểu đồ và phân tích dòng tiền...
      </div>`;
  }

  const canViewPayroll = curUser.role === "admin" || hasPermission(curUser, PERMISSIONS.FINANCE_PAYROLL_VIEW);
  const txType = document.getElementById("finFilterType")?.value || "all";
  const reconciledVal = document.getElementById("finFilterReconciled")?.value || "all";
  const paymentMethod = document.getElementById("finFilterMethod")?.value || "all";
  const creator = document.getElementById("finFilterCreator")?.value || "all";

  try {
    const [summary, txs, purchases, payrolls, auditLogs] = await Promise.all([
      getFinanceSummary({ from: financeState.from, to: financeState.to }),
      getFinanceTransactions({
        from: financeState.from,
        to: financeState.to,
        txType,
        reconciled: reconciledVal === "all" ? undefined : reconciledVal,
        paymentMethod,
        createdByUserId: creator
      }),
      getPurchaseOrders(),
      canViewPayroll ? getPayrollRecords().catch(() => []) : Promise.resolve([]),
      getFinanceAuditLogs().catch(() => [])
    ]);

    financeState.summary = summary || null;
    financeState.transactions = Array.isArray(txs) ? txs : [];
    financeState.purchases = Array.isArray(purchases) ? purchases : [];
    financeState.payrolls = Array.isArray(payrolls) ? payrolls : [];
    financeState.auditLogs = Array.isArray(auditLogs) ? auditLogs : [];

    const updatedEl = document.getElementById("finLastUpdatedNote");
    if (updatedEl) {
      updatedEl.textContent = `Cập nhật: ${new Date().toLocaleTimeString("vi-VN")}`;
    }

    // Populate creator filter options from transactions
    const creatorSelect = document.getElementById("finFilterCreator");
    if (creatorSelect) {
      const prev = creatorSelect.value;
      const creators = new Map();
      financeState.transactions.forEach((t) => {
        if (t.createdByUserId) creators.set(t.createdByUserId, t.createdByName || t.createdByUserId);
      });
      creatorSelect.innerHTML = `<option value="all">Tất cả nhân viên tạo</option>` +
        Array.from(creators.entries()).map(([id, name]) => `<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`).join("");
      if (prev && (prev === "all" || creators.has(prev))) creatorSelect.value = prev;
    }

    renderFinanceAlerts(summary);
    renderFinanceKPIs(summary);
    renderFinanceSecondaryIndicators(summary);
    renderProcessingOrdersReviewSection(summary);
    renderFinanceChart(summary?.series || []);
    renderFinanceSubtabContent();
  } catch (err) {
    console.error("Lỗi khi tải báo cáo tài chính:", err);
    if (kpiGrid) {
      kpiGrid.innerHTML = `
        <div style="grid-column: 1/-1; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 10px; padding: 20px; text-align: center; color: #be123c;">
          <div style="font-weight: 700; font-size: 14px; margin-bottom: 6px;">Không thể tải dữ liệu báo cáo tài chính</div>
          <div style="font-size: 13px; margin-bottom: 14px; color: #881337;">${escapeHtml(err?.message || "Lỗi kết nối máy chủ hoặc cơ sở dữ liệu.")}</div>
          <button type="button" class="btn btn-outline-danger" id="finRetryBtn" style="font-size: 12.5px; padding: 6px 18px;">Thử lại</button>
        </div>
      `;
      document.getElementById("finRetryBtn")?.addEventListener("click", () => loadAndRenderFinanceReports());
    }
  }
}

function renderFinanceAlerts(summary) {
  const banner = document.getElementById("finAlertsBanner");
  if (!banner || !summary) return;

  const warnings = [];
  if (summary.missingCostProductsCount > 0 || summary.missingCostItemsCount > 0) {
    warnings.push(
      `<strong>Chưa có giá nhập (${summary.missingCostProductsCount} sản phẩm / ${summary.missingCostItemsCount} dòng đơn hoàn tất):</strong> Chưa thể tính lãi chính xác cho các sản phẩm này. Vui lòng tạo phiếu nhập hàng từ nhà cung cấp để cập nhật giá nhập.`
    );
  }
  if (summary.unreconciledSepayCount > 0 || summary.needsReviewOrdersCount > 0) {
    warnings.push(
      `<strong>Cần đối soát thanh toán:</strong> Có ${summary.unreconciledSepayCount || 0} giao dịch SePay chưa xử lý/đối soát và ${summary.needsReviewOrdersCount || 0} đơn hàng đang ở trạng thái cần kiểm tra (NEEDS_REVIEW).`
    );
  }

  if (warnings.length === 0) {
    banner.style.display = "none";
    banner.innerHTML = "";
    return;
  }

  banner.style.display = "block";
  banner.innerHTML = `
    <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 10px; padding: 12px 16px; color: #92400e; font-size: 13px; display: grid; gap: 6px;">
      ${warnings.map((w) => `<div>• ${w}</div>`).join("")}
    </div>
  `;
}

function renderFinanceKPIs(s) {
  const grid = document.getElementById("finKpiGrid");
  if (!grid || !s) return;

  const periodLabel = s.from || s.to ? `${s.from || "Đầu"} → ${s.to || "Hiện tại"}` : "Tất cả thời gian";

  const totalExpenseVal = typeof s.totalExpenses === "number"
    ? s.totalExpenses
    : ((s.purchaseCashOut || 0) + (s.operatingExpenses || 0) + (s.payrollPaid || 0));

  const totalDebtVal = typeof s.totalDebt === "number"
    ? s.totalDebt
    : ((s.supplierDebt || 0) + (s.payrollPending || 0));

  const cards = [
    {
      kpiKey: "completed_orders",
      title: "Giá trị đơn đã giao",
      helpText: "Tổng tiền của các đơn đã giao thành công trong kỳ. Đơn đã giao không đồng nghĩa với tiền đã nhận.",
      value: formatPrice(s.completedOrderSales || 0),
      countBadge: `${s.completedOrderCount || 0} đơn đã giao`,
      sub: "Tổng tiền của các đơn đã giao thành công trong kỳ.",
      note: "Đơn đã giao không đồng nghĩa với tiền đã nhận.",
      actionText: "Xem đơn đã giao",
      color: "#0f172a",
      bgHeader: "#f8fafc",
      borderColor: "#cbd5e1"
    },
    {
      kpiKey: "paid_orders",
      title: "Tiền khách đã trả",
      helpText: "Chỉ tính khoản thanh toán đã được xác nhận (tiền đã về tài khoản ngân hàng hoặc quỹ tiền mặt).",
      value: formatPrice(s.collectedCash || 0),
      countBadge: `${s.paidOrderCount || 0} giao dịch đã nhận`,
      sub: "Chỉ tính khoản thanh toán đã được xác nhận.",
      note: "",
      actionText: "Xem giao dịch đã nhận",
      color: "#15803d",
      bgHeader: "#f0fdf4",
      borderColor: "#86efac"
    },
    {
      kpiKey: "pending_orders",
      title: "Khách còn chưa trả",
      helpText: "Tiền của đơn chưa được xác nhận thanh toán (bao gồm đơn COD đã giao chờ đối soát và chuyển khoản chờ xác nhận).",
      value: formatPrice(s.pendingReceivable || 0),
      countBadge: `${s.pendingReceivableCount || 0} đơn chưa trả`,
      sub: "Tiền của đơn chưa được xác nhận thanh toán.",
      note: (s.processingOrdersCount > 0)
        ? `Đã giao: ${formatPrice(s.pendingReceivable || 0)} (${s.pendingReceivableCount || 0} đơn) · Chờ giao: ${formatPrice(s.processingOrdersAmount || 0)} (${s.processingOrdersCount || 0} đơn)`
        : "",
      actionText: "Xem đơn còn phải thu",
      color: "#0369a1",
      bgHeader: "#f0f9ff",
      borderColor: "#7dd3fc"
    },
    {
      kpiKey: "expenses",
      title: "Cửa hàng đã chi",
      helpText: "Tiền đã thanh toán cho nhập hàng, vận hành và lương trong kỳ.",
      value: formatPrice(totalExpenseVal),
      countBadge: "Đã thanh toán",
      sub: "Tiền đã thanh toán cho nhập hàng, vận hành và lương trong kỳ.",
      note: "",
      actionText: "Xem các khoản đã chi",
      color: "#b91c1c",
      bgHeader: "#fef2f2",
      borderColor: "#fca5a5"
    },
    {
      kpiKey: "debts",
      title: "Cửa hàng còn phải trả",
      helpText: "Khoản còn nợ nhà cung cấp và lương chưa thanh toán.",
      value: formatPrice(totalDebtVal),
      countBadge: "Còn nợ",
      sub: "Khoản còn nợ nhà cung cấp và lương chưa thanh toán.",
      note: "",
      actionText: "Xem khoản chưa trả",
      color: "#b45309",
      bgHeader: "#fffbeb",
      borderColor: "#fde68a"
    },
    {
      kpiKey: "cashflow",
      title: "Thu trừ chi",
      helpText: "Tiền khách đã trả trừ tiền cửa hàng đã chi trong kỳ.",
      value: formatPrice(s.netCashFlow || 0),
      countBadge: (s.netCashFlow || 0) >= 0 ? "Thu nhiều hơn chi" : "Chi nhiều hơn thu",
      sub: "Tiền khách đã trả trừ tiền cửa hàng đã chi trong kỳ.",
      note: "",
      actionText: "Xem thu và chi",
      color: (s.netCashFlow || 0) >= 0 ? "#15803d" : "#b91c1c",
      bgHeader: (s.netCashFlow || 0) >= 0 ? "#f0fdf4" : "#fef2f2",
      borderColor: (s.netCashFlow || 0) >= 0 ? "#86efac" : "#fca5a5"
    }
  ];

  grid.innerHTML = cards.map((c) => `
    <div class="admin-card" style="padding: 16px 18px; border: 1.5px solid ${c.borderColor}; border-radius: 10px; display: flex; flex-direction: column; justify-content: space-between; gap: 10px; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.04); min-width: 0;">
      <div>
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 5px;">
            <span style="font-size: 13.5px; font-weight: 700; color: #1e293b; white-space: nowrap;">${c.title}</span>
            <span title="${escapeHtml(c.helpText)}" style="cursor: help; color: #94a3b8; font-size: 13px; line-height: 1; user-select: none;">ⓘ</span>
          </div>
          <span style="font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 999px; background: ${c.bgHeader}; color: ${c.color}; border: 1px solid ${c.borderColor}; white-space: nowrap;">
            ${c.countBadge}
          </span>
        </div>
        <div style="font-size: 24px; font-weight: 800; color: ${c.color}; line-height: 1.2; margin: 4px 0; word-break: break-word;">${c.value}</div>
        <div style="font-size: 12.5px; color: #64748b; line-height: 1.4;">${c.sub}</div>
        ${c.note ? `<div style="font-size: 11.5px; color: #b45309; margin-top: 5px; font-weight: 600; line-height: 1.3;">⚠️ ${c.note}</div>` : ""}
      </div>
      <div style="border-top: 1px dashed #e2e8f0; padding-top: 8px; margin-top: 4px;">
        <button type="button" class="btn-kpi-drilldown" data-kpi-drill="${c.kpiKey}" style="background: none; border: none; padding: 0; font-size: 12px; font-weight: 700; color: #0284c7; cursor: pointer; display: flex; align-items: center; gap: 4px;">
          ${c.actionText} ➔
        </button>
      </div>
    </div>
  `).join("");
}

function renderFinanceSecondaryIndicators(s) {
  const wrap = document.getElementById("finSecondaryIndicatorsWrap");
  if (!wrap || !s) return;

  let grossProfitDisplay = "Chưa có giá nhập";
  let grossSub = "Chưa có giá nhập cho các sản phẩm đã giao";
  let grossBadge = "background:#fef3c7; color:#b45309; border: 1px solid #fde68a;";
  if (s.grossProfitStatus === "AVAILABLE" && typeof s.grossProfit === "number") {
    grossProfitDisplay = formatPrice(s.grossProfit);
    grossSub = `Tiền vốn hàng đã giao: ${formatPrice(s.totalCogs || 0)}`;
    grossBadge = s.grossProfit >= 0
      ? "background:#dcfce7; color:#15803d; border: 1px solid #86efac;"
      : "background:#fee2e2; color:#b91c1c; border: 1px solid #fca5a5;";
  } else if (s.grossProfitStatus === "NO_DATA") {
    grossProfitDisplay = "Chưa có dữ liệu";
    grossSub = "Chưa có đơn hoàn tất trong kỳ lọc";
    grossBadge = "background:#f1f5f9; color:#64748b; border: 1px solid #e2e8f0;";
  } else {
    grossProfitDisplay = "Chưa có giá nhập";
    grossSub = `Chưa có giá nhập ở ${s.missingCostProductsCount || 0} sản phẩm / ${s.missingCostItemsCount || 0} dòng đơn đã giao`;
    grossBadge = "background:#fffbeb; color:#b45309; border: 1px solid #fcd34d;";
  }

  const counts = s.orderStatusCounts || {};
  const totalOrdersCount = Object.values(counts).reduce((a, b) => a + b, 0);

  wrap.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; margin-bottom: 12px;">
      <!-- Hoàn tiền thực tế -->
      <div class="admin-card" style="padding: 12px 16px; border: 1px solid #e2e8f0; background: #fafaf9;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="font-size: 12px; font-weight: 700; color: #44403c;">Hoàn tiền thực tế</span>
          <span style="font-size: 11px; padding: 2px 6px; border-radius: 4px; background: #f5f5f4; color: #78716c;">Thẻ phụ</span>
        </div>
        <div style="font-size: 18px; font-weight: 800; color: #b45309;">${formatPrice(s.refundedActual || 0)}</div>
        <div style="font-size: 11.5px; color: #78716c; margin-top: 2px;">
          Chờ hoàn tiền khách: <strong>${formatPrice(s.pendingRefundAmount || 0)}</strong> · Trừ vào thu trừ chi
        </div>
      </div>

      <!-- Giá trị tồn kho theo giá nhập bình quân -->
      <div class="admin-card" style="padding: 12px 16px; border: 1px solid #e2e8f0; background: #fafaf9;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="font-size: 12px; font-weight: 700; color: #44403c;" title="Giá nhập trung bình của các lần nhập hàng. Cần số liệu này để ước tính lãi khi bán.">Giá trị tồn kho theo giá nhập bình quân</span>
          <span style="font-size: 11px; padding: 2px 6px; border-radius: 4px; background: #f5f5f4; color: #78716c;">Tồn kho</span>
        </div>
        <div style="font-size: 18px; font-weight: 800; color: #0284c7;">${formatPrice(s.inventoryValuationAtCost || 0)}</div>
        <div style="font-size: 11.5px; color: #78716c; margin-top: 2px;">
          ${s.valuationItemsCount || 0} SP có giá nhập ${s.missingValuationCount > 0 ? `· <span style="color:#b45309;">(${s.missingValuationCount} SP chưa có giá nhập)</span>` : ""}
        </div>
      </div>

      <!-- Lợi nhuận gộp / ước tính -->
      <div class="admin-card" data-kpi-drill="missing_cost" style="padding: 12px 16px; border: 1px solid #e2e8f0; background: #fafaf9; cursor: pointer;" title="Nhấn để xem danh sách sản phẩm chưa có giá nhập">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="font-size: 12px; font-weight: 700; color: #44403c;">Lợi nhuận gộp / ước tính</span>
          <span style="font-size: 11px; padding: 2px 6px; border-radius: 4px; ${grossBadge}">
            ${s.grossProfitStatus === "AVAILABLE" ? "Đã tính lãi" : "Chưa có giá nhập"}
          </span>
        </div>
        <div style="font-size: 18px; font-weight: 800; color: #0f172a;">${grossProfitDisplay}</div>
        <div style="font-size: 11.5px; color: #78716c; margin-top: 2px;">${grossSub} <span style="color:#0284c7;font-weight:600;">(Bấm xem chi tiết)</span></div>
      </div>
    </div>

    <!-- Thanh đối chiếu số lượng đơn hàng toàn hệ thống -->
    <div class="admin-card" style="padding: 10px 16px; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; flex-wrap: wrap; align-items: center; gap: 10px;">
      <span style="font-size: 12px; font-weight: 700; color: #334155; display: flex; align-items: center; gap: 6px;">
        <i data-lucide="layers" style="width:14px; height:14px; color:#0284c7;"></i>
        Đối chiếu trạng thái đơn hàng (Toàn bộ ${totalOrdersCount} đơn từ tất cả tài khoản):
      </span>
      <div style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">
        <span style="font-size: 11.5px; padding: 2px 8px; border-radius: 4px; background: #dcfce7; color: #15803d; font-weight: 600;">
          Hoàn thành: ${counts["Hoàn thành"] || s.completedOrderCount || 0}
        </span>
        <span style="font-size: 11.5px; padding: 2px 8px; border-radius: 4px; background: #e0f2fe; color: #0369a1; font-weight: 600;">
          Đang giao: ${counts["Đang giao"] || 0}
        </span>
        <span style="font-size: 11.5px; padding: 2px 8px; border-radius: 4px; background: #ffedd5; color: #c2410c; font-weight: 600;">
          Đang xử lý: ${counts["Đang xử lý"] || 0}
        </span>
        <span style="font-size: 11.5px; padding: 2px 8px; border-radius: 4px; background: #fef9c3; color: #854d0e; font-weight: 600;">
          Chờ xác nhận: ${counts["Chờ xác nhận"] || 0}
        </span>
        <span style="font-size: 11.5px; padding: 2px 8px; border-radius: 4px; background: #f1f5f9; color: #475569; font-weight: 600;">
          Đã hủy: ${counts["Đã hủy"] || 0}
        </span>
      </div>
      <button type="button" data-switch-to-orders class="table-action-btn" style="margin-left: auto; font-size: 11.5px; color: #0284c7; background: #f0f9ff; border-color: #bae6fd; font-weight: 600; cursor: pointer;">
        Xem chi tiết tại trang Quản lý đơn hàng ➔
      </button>
    </div>
  `;
}

function renderProcessingOrdersReviewSection(s) {
  const section = document.getElementById("finProcessingOrdersSection");
  if (!section) return;

  const list = s.processingOrdersBreakdown || [];

  if (list.length === 0) {
    section.innerHTML = `
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 18px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #10b981;"></span>
          <h3 class="card-title" style="margin: 0; font-size: 14px;">Rà soát đơn hàng đang xử lý (0 đơn cần kiểm tra)</h3>
        </div>
      </div>
      <div class="card-body" style="padding: 12px 18px; color: #64748b; font-size: 12.5px;">
        Hiện không có đơn hàng nào đang ở trạng thái xử lý/giao hàng cần rà soát. Mọi đơn đã hoàn tất hoặc ở đúng nhóm trạng thái.
      </div>
    `;
    return;
  }

  section.innerHTML = `
    <div class="card-header" style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; padding: 12px 18px; background: #f0f9ff; border-bottom: 1px solid #bae6fd;">
      <div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #0284c7;"></span>
          <h3 class="card-title" style="margin: 0; font-size: 14.5px; color: #0369a1;">
            Rà soát đơn hàng đang xử lý (${list.length} đơn cần người quản trị xác nhận giao hàng)
          </h3>
        </div>
        <p style="margin: 3px 0 0; font-size: 12px; color: #0284c7;">
          Chỉ chuyển sang <strong>Hoàn thành</strong> khi có căn cứ giao hàng thực tế. Hệ thống không tự suy đoán hoàn tất và không cộng tiền các đơn QR chưa thanh toán vào tiền thực thu.
        </p>
      </div>
    </div>
    <div class="card-body" style="padding: 0;">
      <table class="admin-data-table" style="margin: 0;">
        <thead>
          <tr>
            <th>Mã đơn hàng</th>
            <th>Tài khoản & Khách hàng</th>
            <th>Phương thức TT</th>
            <th>Trạng thái thanh toán</th>
            <th>Trạng thái giao</th>
            <th>Tổng tiền</th>
            <th>Cập nhật lần cuối</th>
            <th style="text-align: right;">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${list.map((proc) => {
            const isPaid = (proc.paymentStatus || "").toUpperCase() === "PAID";
            return `
              <tr>
                <td>
                  <span style="font-family: monospace; font-weight: 700; color: #0f172a;">#${escapeHtml(proc.id)}</span>
                </td>
                <td>
                  <strong>${escapeHtml(proc.customerName || "—")}</strong>
                  <br><small style="color: #64748b;">${escapeHtml(proc.customerPhone || "")} · TK: ${escapeHtml(proc.userId || "")}</small>
                </td>
                <td><small>${escapeHtml(proc.paymentMethod || "—")}</small></td>
                <td>
                  ${isPaid
                    ? `<span style="background:#dcfce7;color:#15803d;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:700;">ĐÃ THANH TOÁN</span>`
                    : `<span style="background:#fee2e2;color:#b91c1c;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:700;">CHƯA THANH TOÁN</span>`}
                </td>
                <td>
                  <span style="background:#ffedd5;color:#c2410c;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:700;">${escapeHtml(proc.status)}</span>
                </td>
                <td><strong>${formatPrice(proc.total || 0)}</strong></td>
                <td><small style="color: #64748b;">${proc.updatedAt ? new Date(proc.updatedAt).toLocaleString("vi-VN") : "—"}</small></td>
                <td style="text-align: right;">
                  <button type="button" class="btn-admin primary" data-confirm-delivery="${escapeHtml(proc.id)}" data-pay-method="${escapeHtml(proc.paymentMethod || '')}" data-pay-status="${escapeHtml(proc.paymentStatus || '')}" data-amount="${proc.total || 0}" style="padding: 5px 12px; font-size: 12px; background: #15803d; border-color: #15803d; cursor: pointer;">
                    ✓ Xác nhận đã giao thành công
                  </button>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function openKpiDrilldown(type) {
  const modal = document.getElementById("finKpiDrilldownModalBackdrop");
  const titleEl = document.getElementById("finKpiDrilldownTitle");
  const descEl = document.getElementById("finKpiDrilldownDesc");
  const bodyEl = document.getElementById("finKpiDrilldownBody");
  if (!modal || !bodyEl || !financeState.summary) return;

  const s = financeState.summary;

  if (type === "completed_orders") {
    titleEl.textContent = "Giá trị đơn đã giao";
    descEl.textContent = `Tổng tiền của các đơn đã giao thành công trong kỳ. Đơn đã giao không đồng nghĩa với tiền đã nhận. (${s.completedOrderCount || 0} đơn, tổng ${formatPrice(s.completedOrderSales || 0)}).`;
    const list = s.completedOrdersBreakdown || [];
    if (list.length === 0) {
      bodyEl.innerHTML = `<div style="text-align:center;padding:28px;color:#64748b;">Không có đơn hàng nào hoàn tất trong kỳ lọc này.</div>`;
    } else {
      bodyEl.innerHTML = `
        <table class="admin-data-table">
          <thead>
            <tr>
              <th>Mã đơn</th>
              <th>Khách hàng</th>
              <th>Phương thức TT</th>
              <th>Trạng thái TT</th>
              <th>Ngày hoàn tất</th>
              <th>Người xác nhận</th>
              <th style="text-align:right;">Tổng tiền</th>
            </tr>
          </thead>
          <tbody>
            ${list.map((o) => `
              <tr>
                <td><span style="font-family:monospace;font-weight:700;">#${escapeHtml(o.id)}</span></td>
                <td><strong>${escapeHtml(o.customerName || "—")}</strong><br><small style="color:#64748b;">TK: ${escapeHtml(o.userId || "")}</small></td>
                <td><small>${escapeHtml(o.paymentMethod || "—")}</small></td>
                <td>${o.paymentStatus === "PAID" ? '<span style="color:#15803d;font-weight:600;">Đã thanh toán</span>' : '<span style="color:#b45309;font-weight:600;">Chưa thanh toán</span>'}</td>
                <td><small>${escapeHtml(o.completedAt || "—")}</small></td>
                <td><small style="color:#475569;">${escapeHtml(o.completedBy || "Hệ thống")}</small></td>
                <td style="text-align:right;"><strong>${formatPrice(o.total || 0)}</strong></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    }
  } else if (type === "paid_orders") {
    titleEl.textContent = "Tiền khách đã trả";
    descEl.textContent = `Chỉ tính khoản thanh toán đã được xác nhận (${s.paidOrderCount || 0} giao dịch đơn hàng, tổng ${formatPrice(s.collectedCash || 0)}).`;
    const list = s.paidOrdersBreakdown || [];
    bodyEl.innerHTML = `
      <table class="admin-data-table">
        <thead>
          <tr>
            <th>Mã đơn / Giao dịch</th>
            <th>Khách hàng / Nguồn thu</th>
            <th>Phương thức</th>
            <th>Thời điểm xác minh</th>
            <th style="text-align:right;">Số tiền thực thu</th>
          </tr>
        </thead>
        <tbody>
          ${list.map((o) => `
            <tr>
              <td><span style="font-family:monospace;font-weight:700;">#${escapeHtml(o.id)}</span></td>
              <td><strong>${escapeHtml(o.customerName || "—")}</strong><br><small style="color:#64748b;">TK: ${escapeHtml(o.userId || "")}</small></td>
              <td><small>${escapeHtml(o.paymentMethod || "—")}</small></td>
              <td><small>${o.paidAt ? new Date(o.paidAt).toLocaleString("vi-VN") : "—"}</small></td>
              <td style="text-align:right;color:#15803d;font-weight:700;">+${formatPrice(o.paidAmount || 0)}</td>
            </tr>
          `).join("")}
          ${s.otherIncome > 0 ? `
            <tr style="background:#f8fafc;">
              <td><span style="font-family:monospace;font-weight:700;">#THU-KHAC</span></td>
              <td><strong>Các khoản thu khác ngoài đơn hàng</strong></td>
              <td><small>Sổ thu chi</small></td>
              <td><small>Trong kỳ lọc</small></td>
              <td style="text-align:right;color:#15803d;font-weight:700;">+${formatPrice(s.otherIncome)}</td>
            </tr>
          ` : ""}
        </tbody>
      </table>
    `;
  } else if (type === "pending_orders") {
    titleEl.textContent = "Khách còn chưa trả";
    const totalPipeline = (s.pendingReceivable || 0) + (s.processingOrdersAmount || 0);
    const totalPipelineCount = (s.pendingReceivableCount || 0) + (s.processingOrdersCount || 0);
    descEl.textContent = `Tiền của đơn chưa được xác nhận thanh toán (${s.pendingReceivableCount || 0} đơn đã giao chờ thu: ${formatPrice(s.pendingReceivable || 0)}${s.processingOrdersCount > 0 ? ` · ${s.processingOrdersCount} đơn đang xử lý chờ giao: ${formatPrice(s.processingOrdersAmount || 0)}` : ""}).`;
    const list = s.pendingOrdersBreakdown || [];
    const procList = s.processingOrdersBreakdown || [];
    bodyEl.innerHTML = `
      <div style="display:grid;gap:18px;">
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <h4 style="margin:0;font-size:14px;color:#0f172a;font-weight:700;">
              1. Khoản phải thu từ đơn đã giao hàng (${formatPrice(s.pendingReceivable || 0)} · ${list.length} đơn)
            </h4>
            <span style="font-size:12px;color:#0369a1;background:#f0f9ff;border:1px solid #bae6fd;padding:2px 8px;border-radius:4px;font-weight:600;">
              Hàng đã xuất giao thành công — Chờ đối soát tiền
            </span>
          </div>
          <table class="admin-data-table">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Khách hàng</th>
                <th>Phương thức</th>
                <th>Phân loại chờ thu</th>
                <th>Trạng thái giao</th>
                <th>Trạng thái TT</th>
                <th>Ngày hoàn tất</th>
                <th style="text-align:right;">Số tiền cần thu</th>
                <th style="text-align:right;">Thao tác đối soát</th>
              </tr>
            </thead>
            <tbody>
              ${list.length === 0 ? `<tr><td colspan="9" style="text-align:center;color:#64748b;">Không có khoản phải thu từ đơn đã giao.</td></tr>` : list.map((o) => {
                const isCompletedCod = o.status === "Hoàn thành" && !((o.paymentMethod || "").toLowerCase().includes("qr"));
                const catBadge = isCompletedCod
                  ? '<span style="background:#fef3c7;color:#92400e;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:700;">ĐÃ GIAO — CHỜ THU TIỀN COD</span>'
                  : '<span style="background:#fee2e2;color:#b91c1c;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:700;">ĐÃ GIAO — CHỜ XÁC MINH SEPAY</span>';
                return `
                <tr>
                  <td><span style="font-family:monospace;font-weight:700;">#${escapeHtml(o.id)}</span></td>
                  <td><strong>${escapeHtml(o.customerName || "—")}</strong><br><small style="color:#64748b;">TK: ${escapeHtml(o.userId || "")}</small></td>
                  <td><small>${escapeHtml(o.paymentMethod || "—")}</small></td>
                  <td>${catBadge}</td>
                  <td><span style="padding:2px 6px;border-radius:4px;background:#f1f5f9;font-size:11px;font-weight:600;">${escapeHtml(o.status || "—")}</span></td>
                  <td><span style="color:#b45309;font-weight:600;">${escapeHtml(o.paymentStatus || "CHƯA THANH TOÁN")}</span></td>
                  <td><small>${o.completedAt || o.createdAt ? new Date(o.completedAt || o.createdAt).toLocaleDateString("vi-VN") : "—"}</small></td>
                  <td style="text-align:right;color:#0369a1;font-weight:700;">${formatPrice(o.total || 0)}</td>
                  <td style="text-align:right;">
                    ${isCompletedCod ? `
                      <button type="button" class="btn-admin primary" data-collect-cod="${escapeHtml(o.id)}" data-amount="${o.total || 0}" style="padding:3px 8px;font-size:11px;background:#15803d;border-color:#15803d;cursor:pointer;">
                        ✓ Xác nhận đã thu COD
                      </button>
                    ` : '<small style="color:#94a3b8;">Chờ webhook SePay</small>'}
                  </td>
                </tr>
              `}).join("")}
            </tbody>
          </table>
        </div>

        ${procList.length > 0 ? `
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <h4 style="margin:0;font-size:14px;color:#475569;font-weight:700;">
              2. Đơn hàng đang xử lý / Chờ giao hàng trong kỳ (${formatPrice(s.processingOrdersAmount || 0)} · ${procList.length} đơn)
            </h4>
            <span style="font-size:12px;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;padding:2px 8px;border-radius:4px;font-weight:500;">
              Chưa phát sinh doanh số hoàn tất hoặc công nợ giao hàng
            </span>
          </div>
          <table class="admin-data-table">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Khách hàng</th>
                <th>Phương thức</th>
                <th>Phân loại</th>
                <th>Trạng thái giao</th>
                <th>Ngày đặt</th>
                <th style="text-align:right;">Giá trị đơn</th>
              </tr>
            </thead>
            <tbody>
              ${procList.map((p) => `
                <tr>
                  <td><span style="font-family:monospace;font-weight:700;">#${escapeHtml(p.id)}</span></td>
                  <td><strong>${escapeHtml(p.customerName || "—")}</strong><br><small style="color:#64748b;">TK: ${escapeHtml(p.userId || "")}</small></td>
                  <td><small>${escapeHtml(p.paymentMethod || "—")}</small></td>
                  <td><span style="font-size:11px;padding:2px 6px;border-radius:4px;background:#f1f5f9;color:#475569;font-weight:600;">${escapeHtml(p.pendingCategoryLabel || "Đang xử lý")}</span></td>
                  <td><span style="font-size:11px;padding:2px 6px;border-radius:4px;background:#e0f2fe;color:#0369a1;font-weight:600;">${escapeHtml(p.status || "—")}</span></td>
                  <td><small>${p.createdAt ? new Date(p.createdAt).toLocaleDateString("vi-VN") : "—"}</small></td>
                  <td style="text-align:right;font-weight:600;color:#0f172a;">${formatPrice(p.total || 0)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
        ` : ""}
      </div>
    `;
  } else if (type === "missing_cost" || type === "cogs") {
    titleEl.textContent = "Danh sách sản phẩm chưa có giá nhập";
    descEl.textContent = `Hệ thống ghi nhận ${s.missingCostProductsCount || 0} sản phẩm chưa có giá nhập. Cần tạo phiếu nhập hàng từ nhà cung cấp để cập nhật giá nhập và tính lãi chính xác khi bán.`;
    const list = s.missingCostProductsList || [];
    bodyEl.innerHTML = `
      <table class="admin-data-table">
        <thead>
          <tr>
            <th>Mã SP</th>
            <th>Tên sản phẩm</th>
            <th style="text-align:right;">Tồn kho thực tế</th>
            <th style="text-align:right;">Giá bán niêm yết</th>
            <th style="text-align:center;">Trạng thái giá nhập</th>
            <th style="text-align:right;">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${list.length === 0 ? `<tr><td colspan="6" style="text-align:center;color:#64748b;">Không có sản phẩm nào thiếu giá nhập.</td></tr>` : list.map((p) => `
            <tr>
              <td><span style="font-family:monospace;font-weight:700;">#${escapeHtml(p.id)}</span></td>
              <td><strong>${escapeHtml(p.name || "—")}</strong></td>
              <td style="text-align:right;font-weight:600;">${p.stock}</td>
              <td style="text-align:right;color:#0f172a;font-weight:600;">${formatPrice(p.price || 0)}</td>
              <td style="text-align:center;">
                <span style="background:#fef3c7;color:#b45309;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:700;">Chưa có giá nhập</span>
              </td>
              <td style="text-align:right;">
                <button type="button" class="btn-action-primary" data-drilldown-create-po="${escapeHtml(p.id)}" style="font-size: 11px; padding: 3px 8px; background: #0284c7; border-color: #0284c7; display: inline-flex; align-items: center; gap: 3px;" title="Dùng khi cửa hàng nhận hàng mua mới. Nhập số lượng, giá nhập và tình trạng thanh toán.">
                  ${renderIcon("plus-circle", { size: 11, strokeWidth: 1.8 })} Tạo phiếu nhập hàng
                </button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  } else if (type === "expenses") {
    titleEl.textContent = "Cửa hàng đã chi";
    descEl.textContent = `Tiền đã thanh toán cho nhập hàng, vận hành và lương trong kỳ (Tổng cộng: ${formatPrice(s.totalExpenses || 0)}. Nhập hàng ${formatPrice(s.purchaseCashOut || 0)} · Vận hành ${formatPrice(s.operatingExpenses || 0)} · Lương ${s.payrollRestricted ? "Bảo mật" : formatPrice(s.payrollPaid || 0)}).`;
    const txs = financeState.transactions.filter((t) => (t.txType || "").startsWith("EXPENSE_"));
    bodyEl.innerHTML = `
      <table class="admin-data-table">
        <thead>
          <tr>
            <th>Mã GD</th>
            <th>Loại chi</th>
            <th>Khoản mục</th>
            <th>Ngày chi</th>
            <th>Phương thức</th>
            <th>Đối soát</th>
            <th style="text-align:right;">Số tiền chi</th>
          </tr>
        </thead>
        <tbody>
          ${txs.map((t) => {
            const badge = getFinTxTypeLabel(t.txType);
            return `
              <tr>
                <td><span style="font-family:monospace;font-weight:700;">#${escapeHtml(t.id)}</span></td>
                <td><span style="font-size:11px;padding:2px 6px;border-radius:4px;${badge.badge}">${badge.label}</span></td>
                <td><strong>${escapeHtml(t.category || "—")}</strong><br><small style="color:#64748b;">${escapeHtml(t.note || "")}</small></td>
                <td><small>${escapeHtml(t.txDate || "—")}</small></td>
                <td><small>${escapeHtml(t.paymentMethod || "—")}</small></td>
                <td>${t.reconciled ? '<span style="color:#15803d;font-size:11px;">✓ Đã đối soát</span>' : '<span style="color:#64748b;font-size:11px;">Chưa</span>'}</td>
                <td style="text-align:right;color:#b91c1c;font-weight:700;">-${formatPrice(t.amount || 0)}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;
  } else if (type === "debts") {
    titleEl.textContent = "Cửa hàng còn phải trả";
    descEl.textContent = `Khoản còn nợ nhà cung cấp và lương chưa thanh toán (Tổng nợ: ${formatPrice(s.totalDebt || 0)}. Nợ NCC ${formatPrice(s.supplierDebt || 0)} · Nợ lương ${s.payrollRestricted ? "Bảo mật" : formatPrice(s.payrollPending || 0)}).`;
    const unpaidPurchases = financeState.purchases.filter((p) => p.debtAmount && p.debtAmount > 0);
    const unpaidPayrolls = financeState.payrolls.filter((pr) => pr.status !== "PAID" && pr.netAmount > 0);
    bodyEl.innerHTML = `
      <div style="display:grid;gap:16px;">
        <div>
          <h4 style="margin:0 0 8px;font-size:13.5px;color:#0f172a;">1. Công nợ nhà cung cấp (${formatPrice(s.supplierDebt || 0)}):</h4>
          ${unpaidPurchases.length === 0 ? '<div style="color:#64748b;font-size:12.5px;">Không có nợ nhà cung cấp.</div>' : `
            <table class="admin-data-table">
              <thead>
                <tr>
                  <th>Mã phiếu</th>
                  <th>Nhà cung cấp</th>
                  <th>Ngày nhập</th>
                  <th>Tổng tiền phiếu</th>
                  <th>Đã trả</th>
                  <th style="text-align:right;">Còn nợ</th>
                </tr>
              </thead>
              <tbody>
                ${unpaidPurchases.map((p) => `
                  <tr>
                    <td><span style="font-family:monospace;font-weight:700;">#${escapeHtml(p.id)}</span></td>
                    <td><strong>${escapeHtml(p.supplierName || "")}</strong></td>
                    <td><small>${escapeHtml(p.purchaseDate || "")}</small></td>
                    <td>${formatPrice(p.totalAmount || 0)}</td>
                    <td style="color:#15803d;">${formatPrice(p.paidAmount || 0)}</td>
                    <td style="text-align:right;color:#b91c1c;font-weight:700;">${formatPrice(p.debtAmount || 0)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          `}
        </div>

        <div>
          <h4 style="margin:0 0 8px;font-size:13.5px;color:#0f172a;">2. Công nợ lương nhân viên đến hạn (${formatPrice(s.payrollPending || 0)}):</h4>
          ${unpaidPayrolls.length === 0 ? '<div style="color:#64748b;font-size:12.5px;">Không có công nợ lương chưa chi.</div>' : `
            <table class="admin-data-table">
              <thead>
                <tr>
                  <th>Kỳ lương</th>
                  <th>Nhân viên</th>
                  <th>Ngày đến hạn</th>
                  <th>Trạng thái</th>
                  <th style="text-align:right;">Thực lĩnh còn nợ</th>
                </tr>
              </thead>
              <tbody>
                ${unpaidPayrolls.map((pr) => `
                  <tr>
                    <td><strong>${escapeHtml(pr.periodMonth || "")}</strong></td>
                    <td>${escapeHtml(pr.employeeName || "")}</td>
                    <td><small style="color:#b45309;font-weight:600;">${escapeHtml(pr.dueDate || "—")}</small></td>
                    <td>${pr.status === "DUE" ? '<span style="color:#b45309;font-weight:700;">Đến hạn</span>' : '<span style="color:#64748b;">Chưa trả</span>'}</td>
                    <td style="text-align:right;color:#b91c1c;font-weight:700;">${formatPrice(pr.netAmount || 0)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;
  } else if (type === "cashflow") {
    titleEl.textContent = "Thu trừ chi theo thời gian";
    descEl.textContent = `Tiền khách đã trả trừ tiền cửa hàng đã chi trong kỳ theo từng mốc thời gian.`;
    const series = s.series || [];
    bodyEl.innerHTML = `
      <table class="admin-data-table">
        <thead>
          <tr>
            <th>Thời điểm</th>
            <th style="text-align:right;">Tiền thực thu (+)</th>
            <th style="text-align:right;">Tổng thực chi (-)</th>
            <th style="text-align:right;">Thu trừ chi</th>
            <th style="text-align:right;">Doanh số giao thành công</th>
          </tr>
        </thead>
        <tbody>
          ${series.map((p) => `
            <tr>
              <td><strong>${escapeHtml(p.date || "")}</strong></td>
              <td style="text-align:right;color:#15803d;font-weight:600;">+${formatPrice(p.collected || 0)}</td>
              <td style="text-align:right;color:#b91c1c;font-weight:600;">-${formatPrice(p.expense || 0)}</td>
              <td style="text-align:right;font-weight:700;color:${(p.net || 0) >= 0 ? '#15803d':'#b91c1c'};">${formatPrice(p.net || 0)}</td>
              <td style="text-align:right;color:#0f172a;font-weight:600;">${formatPrice(p.completedSales || 0)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  modal.classList.add("show");
}

function aggregateSeries(series, granularity = "day") {
  if (!Array.isArray(series) || series.length === 0) return [];
  if (granularity === "day") {
    return series.map((p) => ({
      key: p.date,
      label: p.date,
      collected: p.collected || 0,
      expense: p.expense || 0,
      completedSales: p.completedSales || 0
    }));
  }

  const map = new Map();
  series.forEach((p) => {
    if (!p.date) return;
    const parts = p.date.split("-");
    const y = parts[0];
    const m = parts[1] || "01";
    let key = p.date;
    let label = p.date;

    if (granularity === "month") {
      key = `${y}-${m}`;
      label = `Tháng ${parseInt(m, 10)}/${y}`;
    } else if (granularity === "quarter") {
      const q = Math.floor((parseInt(m, 10) - 1) / 3) + 1;
      key = `${y}-Q${q}`;
      label = `Quý ${q}/${y}`;
    } else if (granularity === "year") {
      key = `${y}`;
      label = `Năm ${y}`;
    }

    if (!map.has(key)) {
      map.set(key, { key, label, collected: 0, expense: 0, completedSales: 0 });
    }
    const item = map.get(key);
    item.collected += Number(p.collected || 0);
    item.expense += Number(p.expense || 0);
    item.completedSales += Number(p.completedSales || 0);
  });

  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
}

function renderFinanceChart(series) {
  const container = document.getElementById("financeCashflowChart");
  const tableWrap = document.getElementById("finDetailedBreakdownTableWrap");
  if (!container) return;

  const granularity = financeState.chartGranularity || "day";
  const aggregated = aggregateSeries(series, granularity);

  // Update button active state in #finChartGranularityGroup
  document.querySelectorAll("#finChartGranularityGroup [data-granularity]").forEach((btn) => {
    if (btn.dataset.granularity === granularity) {
      btn.className = "btn btn-sm btn-primary";
    } else {
      btn.className = "btn btn-sm btn-outline-secondary";
    }
  });

  if (!Array.isArray(aggregated) || aggregated.length === 0) {
    const fromStr = financeState.from || "đầu kỳ";
    const toStr = financeState.to || "hiện tại";
    container.innerHTML = `<div style="text-align: center; padding: 48px 16px; color: #64748b; font-size: 13.5px;">Không có giao dịch thu/chi hoặc đơn hàng nào trong khoảng thời gian đã chọn (từ ${escapeHtml(fromStr)} đến ${escapeHtml(toStr)}).</div>`;
    if (tableWrap) {
      tableWrap.innerHTML = `<div style="text-align:center; padding: 20px; color: #94a3b8; font-size: 13px;">Chưa có dữ liệu chi tiết cho khoảng thời gian này.</div>`;
    }
    return;
  }

  const maxVal = Math.max(1, ...aggregated.flatMap((p) => [p.collected || 0, p.expense || 0, p.completedSales || 0]));
  const itemWidth = granularity === "day" ? 64 : (granularity === "month" ? 96 : 116);
  const width = Math.max(container.clientWidth || 640, aggregated.length * itemWidth + 60);
  const height = 230;
  const padLeft = 24;
  const padBottom = 32;
  const chartH = height - padBottom - 20;

  const bars = aggregated.map((p, idx) => {
    const x = padLeft + idx * itemWidth;
    const hCol = Math.round(((p.collected || 0) / maxVal) * chartH);
    const hExp = Math.round(((p.expense || 0) / maxVal) * chartH);
    const hSales = Math.round(((p.completedSales || 0) / maxVal) * chartH);
    const net = (p.collected || 0) - (p.expense || 0);

    const tooltip = `${p.label}
• Tiền thực thu: ${formatPrice(p.collected || 0)}
• Tiền thực chi & hoàn: ${formatPrice(p.expense || 0)}
• Thu trừ chi: ${(net >= 0 ? "+" : "")}${formatPrice(net)}
• Doanh số hoàn tất: ${formatPrice(p.completedSales || 0)}`;

    return `
      <g class="chart-col-group" style="cursor: pointer;">
        <title>${escapeHtml(tooltip)}</title>
        <!-- Bar 1: Tiền thu -->
        <rect x="${x}" y="${20 + chartH - hCol}" width="14" height="${Math.max(2, hCol)}" fill="#16a34a" rx="3">
          <title>${p.label} · Tiền thu: ${formatPrice(p.collected || 0)}</title>
        </rect>
        <!-- Bar 2: Tiền chi & hoàn -->
        <rect x="${x + 16}" y="${20 + chartH - hExp}" width="14" height="${Math.max(2, hExp)}" fill="#dc2626" rx="3">
          <title>${p.label} · Tiền chi & hoàn: ${formatPrice(p.expense || 0)}</title>
        </rect>
        <!-- Bar 3: Doanh số hoàn tất -->
        <rect x="${x + 32}" y="${20 + chartH - hSales}" width="14" height="${Math.max(2, hSales)}" fill="#2563eb" rx="3">
          <title>${p.label} · Doanh số hoàn tất: ${formatPrice(p.completedSales || 0)}</title>
        </rect>
        <!-- Label -->
        <text x="${x + 23}" y="${height - 8}" text-anchor="middle" font-size="11" font-weight="500" fill="#64748b">${escapeHtml(p.label)}</text>
      </g>
    `;
  }).join("");

  container.innerHTML = `
    <div style="display: flex; gap: 20px; align-items: center; margin-bottom: 12px; font-size: 12.5px; color: #334155; flex-wrap: wrap;">
      <span style="display:inline-flex;align-items:center;gap:6px;">
        <span style="width:12px;height:12px;background:#16a34a;border-radius:3px;display:inline-block;"></span>
        <strong>Tiền thực thu</strong>
      </span>
      <span style="display:inline-flex;align-items:center;gap:6px;">
        <span style="width:12px;height:12px;background:#dc2626;border-radius:3px;display:inline-block;"></span>
        <strong>Tiền thực chi &amp; hoàn</strong>
      </span>
      <span style="display:inline-flex;align-items:center;gap:6px;">
        <span style="width:12px;height:12px;background:#2563eb;border-radius:3px;display:inline-block;"></span>
        <strong>Doanh số đơn hoàn tất</strong>
      </span>
    </div>
    <div style="overflow-x: auto; padding-bottom: 8px;">
      <svg width="${width}" height="${height}" style="display:block; min-width: 100%;">
        <line x1="0" y1="${20 + chartH}" x2="${width}" y2="${20 + chartH}" stroke="#cbd5e1" stroke-width="1.5" />
        ${bars}
      </svg>
    </div>
  `;

  renderFinanceBreakdownTable(aggregated);
}

function renderFinanceBreakdownTable(aggregated) {
  const tableWrap = document.getElementById("finDetailedBreakdownTableWrap");
  if (!tableWrap) return;

  if (!Array.isArray(aggregated) || aggregated.length === 0) {
    tableWrap.innerHTML = "";
    return;
  }

  let totalCollected = 0;
  let totalExpense = 0;
  let totalSales = 0;

  const rowsHtml = aggregated.map((p) => {
    totalCollected += Number(p.collected || 0);
    totalExpense += Number(p.expense || 0);
    totalSales += Number(p.completedSales || 0);
    const net = (p.collected || 0) - (p.expense || 0);
    const netColor = net >= 0 ? "#15803d" : "#b91c1c";

    return `
      <tr>
        <td style="font-weight: 600;">${escapeHtml(p.label)}</td>
        <td style="text-align: right; color: #15803d; font-weight: 600;">+${formatPrice(p.collected || 0)}</td>
        <td style="text-align: right; color: #b91c1c; font-weight: 600;">-${formatPrice(p.expense || 0)}</td>
        <td style="text-align: right; color: ${netColor}; font-weight: 700;">${net >= 0 ? "+" : ""}${formatPrice(net)}</td>
        <td style="text-align: right; color: #2563eb; font-weight: 600;">${formatPrice(p.completedSales || 0)}</td>
      </tr>
    `;
  }).join("");

  const totalNet = totalCollected - totalExpense;
  const totalNetColor = totalNet >= 0 ? "#15803d" : "#b91c1c";

  tableWrap.innerHTML = `
    <div style="margin-top: 18px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
      <h4 style="font-size: 13.5px; font-weight: 700; color: #1e293b; margin-bottom: 10px;">Bảng tổng hợp chi tiết theo mốc thời gian</h4>
      <div style="overflow-x: auto;">
        <table class="admin-data-table" style="font-size: 12.5px; width: 100%;">
          <thead>
            <tr>
              <th>Mốc thời gian</th>
              <th style="text-align: right;">Tiền thực thu</th>
              <th style="text-align: right;">Tiền thực chi &amp; hoàn</th>
              <th style="text-align: right;">Thu trừ chi</th>
              <th style="text-align: right;">Doanh số hoàn tất</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr style="background: #f8fafc; font-weight: 700; border-top: 2px solid #cbd5e1;">
              <td>Tổng cộng kỳ lọc</td>
              <td style="text-align: right; color: #15803d;">+${formatPrice(totalCollected)}</td>
              <td style="text-align: right; color: #b91c1c;">-${formatPrice(totalExpense)}</td>
              <td style="text-align: right; color: ${totalNetColor};">${totalNet >= 0 ? "+" : ""}${formatPrice(totalNet)}</td>
              <td style="text-align: right; color: #2563eb;">${formatPrice(totalSales)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;
}

function renderFinanceSubtabContent() {
  const wrap = document.getElementById("finSubContent");
  const filtersBar = document.getElementById("finTxFiltersBar");
  const auditFiltersBar = document.getElementById("finAuditFiltersBar");
  const addPayrollBtn = document.getElementById("finAddPayrollBtn");
  if (!wrap) return;

  const curUser = getCurrentUser();
  const canEditExpense = curUser && (curUser.role === "admin" || hasPermission(curUser, PERMISSIONS.FINANCE_RECORD_EXPENSE));
  const canReconcile = curUser && (curUser.role === "admin" || hasPermission(curUser, PERMISSIONS.FINANCE_RECONCILE));
  const canPayroll = curUser && (curUser.role === "admin" || hasPermission(curUser, PERMISSIONS.FINANCE_PAYROLL_VIEW));

  if (filtersBar) filtersBar.style.display = financeState.subtab === "transactions" ? "flex" : "none";
  if (auditFiltersBar) auditFiltersBar.style.display = financeState.subtab === "audit" ? "flex" : "none";
  if (addPayrollBtn) addPayrollBtn.style.display = (financeState.subtab === "payrolls" && canPayroll) ? "" : "none";

  if (financeState.subtab === "transactions") {
    let list = financeState.transactions;
    const searchVal = (document.getElementById("finTxSearchInput")?.value || "").toLowerCase().trim();
    if (searchVal) {
      list = list.filter((tx) => {
        const cat = (tx.category || "").toLowerCase();
        const note = (tx.note || "").toLowerCase();
        const id = String(tx.id || "").toLowerCase();
        const creator = (tx.createdByName || "").toLowerCase();
        const linked = String(tx.linkedRef || tx.orderId || tx.purchaseOrderId || tx.payrollId || "").toLowerCase();
        return cat.includes(searchVal) || note.includes(searchVal) || id.includes(searchVal) || creator.includes(searchVal) || linked.includes(searchVal);
      });
    }

    if (list.length === 0) {
      wrap.innerHTML = `<div style="text-align:center;color:#64748b;padding:28px;">Chưa có giao dịch thu chi nào phù hợp bộ lọc.</div>`;
      return;
    }
    wrap.innerHTML = `
      <table class="admin-data-table">
        <thead>
          <tr>
            <th>Mã GD</th>
            <th>Ngày</th>
            <th>Loại</th>
            <th>Danh mục &amp; Ghi chú</th>
            <th>Số tiền</th>
            <th>Phương thức</th>
            <th>Người tạo</th>
            <th>Đối soát</th>
            <th style="text-align: right;">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${list.map((tx) => {
            const info = getFinTxTypeLabel(tx.txType);
            const isIncome = tx.txType === "INCOME_OTHER";
            return `
              <tr>
                <td><strong style="font-family: monospace; color: #0284c7;">#${escapeHtml(tx.id)}</strong></td>
                <td>${escapeHtml(tx.txDate || "—")}</td>
                <td><span style="padding:2px 8px;border-radius:999px;font-size:11.5px;font-weight:600;${info.badge}">${info.label}</span></td>
                <td>
                  <strong>${escapeHtml(tx.category || "")}</strong>
                  ${tx.note ? `<br><small style="color:#64748b;">${escapeHtml(tx.note)}</small>` : ""}
                  ${tx.attachmentUrl ? `<br><a href="${escapeHtml(tx.attachmentUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex; align-items:center; gap:3px; margin-top:3px; font-size:11.5px; color:#0284c7; text-decoration:underline;">📎 Chứng từ</a>` : ""}
                  ${tx.purchaseOrderId ? `<br><small style="color:#0369a1;">Liên kết NK: <button type="button" class="table-action-btn" data-view-po="${escapeHtml(tx.purchaseOrderId)}" style="padding:1px 5px; font-size:11px; font-weight:700; color:#0284c7; background:#f0f9ff; border-color:#bae6fd;">#${escapeHtml(tx.purchaseOrderId)}</button></small>` : ""}
                  ${tx.orderId ? `<br><small style="color:#15803d;">Đơn hàng: #${escapeHtml(tx.orderId)}</small>` : ""}
                  ${tx.payrollId ? `<br><small style="color:#6d28d9;">Bảng lương: #${escapeHtml(tx.payrollId)}</small>` : ""}
                  ${tx.linkedRef && !tx.orderId && !tx.purchaseOrderId && !tx.payrollId ? `<br><small style="color:#475569;">Tham chiếu: ${escapeHtml(tx.linkedRef)}</small>` : ""}
                </td>
                <td><strong style="color:${isIncome ? "#15803d" : "#b91c1c"};">${isIncome ? "+" : "-"}${formatPrice(tx.amount || 0)}</strong></td>
                <td>${escapeHtml(tx.paymentMethod || "—")}</td>
                <td><small>${escapeHtml(tx.createdByName || "—")}</small></td>
                <td>
                  ${tx.reconciled
                    ? `<span style="color:#15803d;font-weight:600;font-size:12px;">Đã đối soát</span><br><small style="color:#64748b;">${escapeHtml(tx.reconciledBy || "")}</small>`
                    : `<span style="color:#b45309;font-size:12px;">Chưa đối soát</span>`}
                </td>
                <td style="text-align: right;">
                  <div style="display:inline-flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;">
                    <button type="button" class="table-action-btn" data-view-fintx="${escapeHtml(tx.id)}" title="Xem chi tiết giao dịch">Xem</button>
                    ${!tx.reconciled && canEditExpense ? `<button type="button" class="table-action-btn" data-edit-fintx="${escapeHtml(tx.id)}">Sửa</button>` : ""}
                    ${!tx.reconciled && canReconcile ? `<button type="button" class="table-action-btn" data-reconcile-fintx="${escapeHtml(tx.id)}" style="color:#15803d;">Đối soát</button>` : ""}
                    ${tx.reconciled ? `<small style="color:#94a3b8; align-self:center;">Đã khóa</small>` : ""}
                  </div>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;
    return;
  }

  if (financeState.subtab === "purchases") {
    const list = financeState.purchases;
    if (list.length === 0) {
      wrap.innerHTML = `<div style="text-align:center;color:#64748b;padding:28px;">Chưa có phiếu nhập hàng nào. Bấm "Nhập hàng từ nhà cung cấp" để ghi nhận đơn hàng và giá nhập thực tế.</div>`;
      return;
    }
    wrap.innerHTML = `
      <table class="admin-data-table">
        <thead>
          <tr>
            <th>Mã phiếu</th>
            <th>Ngày nhập</th>
            <th>Nhà cung cấp</th>
            <th>Sản phẩm / Biến thể</th>
            <th>Tổng tiền</th>
            <th>Đã thanh toán</th>
            <th>Còn nợ</th>
            <th>Nhận hàng</th>
            <th>Thanh toán</th>
            <th style="text-align: right;">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${list.map((po) => `
            <tr>
              <td>
                <button type="button" class="table-action-btn" data-view-po="${escapeHtml(po.id)}" style="font-family:monospace; font-weight:700; color:#0284c7; background:#f0f9ff; border-color:#bae6fd;">
                  #${escapeHtml(po.id)}
                </button>
              </td>
              <td><small>${escapeHtml(po.purchaseDate || "—")}</small></td>
              <td><strong>${escapeHtml(po.supplierName || "")}</strong></td>
              <td>${escapeHtml(po.productName || "Nhiều mặt hàng")}${po.variantName ? `<br><small style="color:#64748b;">${escapeHtml(po.variantName)}</small>` : ""}</td>
              <td><strong>${formatPrice(po.totalAmount || 0)}</strong></td>
              <td style="color:#15803d; font-weight:600;">${formatPrice(po.paidAmount || 0)}</td>
              <td style="color:${po.debtAmount > 0 ? '#b91c1c' : '#64748b'}; font-weight:600;">${formatPrice(po.debtAmount || 0)}</td>
              <td>${getReceivedBadge(po.receivedStatus)}</td>
              <td>${getPoPaymentBadge(po.paymentStatus)}</td>
              <td style="text-align: right;">
                <button type="button" class="table-action-btn" data-view-po="${escapeHtml(po.id)}">Chi tiết</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
    return;
  }

  if (financeState.subtab === "payrolls") {
    if (!canPayroll) {
      wrap.innerHTML = `<div style="text-align:center;color:#b91c1c;padding:28px;">Bạn chưa được cấp quyền xem dữ liệu lương nhân viên.</div>`;
      return;
    }
    const list = financeState.payrolls;
    if (list.length === 0) {
      wrap.innerHTML = `<div style="text-align:center;color:#64748b;padding:28px;">Chưa có bảng lương nào. Bấm "+ Tạo bảng lương" để lập kỳ lương nhân viên.</div>`;
      return;
    }
    wrap.innerHTML = `
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px 16px; margin-bottom:14px; font-size:12.5px; color:#475569; display:flex; align-items:center; justify-content:space-between;">
        <div>
          ℹ️ <strong>Quy tắc chi trả lương EcoDesk:</strong> Chốt lương định kỳ vào <strong>ngày 10 hàng tháng</strong>. Sau ngày 10 nếu chưa chi trả, hệ thống tự động ghi nhận trạng thái <strong>Đến hạn / Chưa thanh toán</strong> và tính vào công nợ lương.
        </div>
      </div>
      <table class="admin-data-table">
        <thead>
          <tr>
            <th>Kỳ lương</th>
            <th>Nhân viên</th>
            <th>Lương cơ bản</th>
            <th>Thưởng / Phụ cấp</th>
            <th>Thực lĩnh</th>
            <th>Ngày đến hạn (ngày 10)</th>
            <th>Trạng thái</th>
            <th>Người ghi nhận</th>
            <th style="text-align: right;">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${list.map((pr) => {
            let statusBadge = "";
            let actionHtml = "";
            const isMissingSalary = pr.status === "MISSING_SALARY" || !pr.baseSalary || pr.baseSalary <= 0;
            if (pr.status === "PAID") {
              statusBadge = `<span style="background:#dcfce7;color:#15803d;padding:3px 8px;border-radius:4px;font-weight:700;font-size:11.5px;">✓ ĐÃ TRẢ</span>`;
              actionHtml = `<small style="color:#64748b;">${pr.paidAt ? new Date(pr.paidAt).toLocaleDateString("vi-VN") : "Hoàn tất"}</small>`;
            } else if (isMissingSalary) {
              statusBadge = `<span style="background:#fee2e2;color:#b91c1c;padding:3px 8px;border-radius:4px;font-weight:700;font-size:11.5px;">⚠️ THIẾU MỨC LƯƠNG</span>`;
              actionHtml = `<button type="button" class="btn-admin primary" data-edit-payroll="${escapeHtml(pr.id)}" style="padding:4px 10px;font-size:12px;cursor:pointer;">+ Nhập lương</button>`;
            } else if (pr.status === "DUE") {
              statusBadge = `<span style="background:#fef3c7;color:#b45309;padding:3px 8px;border-radius:4px;font-weight:700;font-size:11.5px;">⏰ ĐẾN HẠN THANH TOÁN</span>`;
              actionHtml = `
                <button type="button" class="table-action-btn" data-edit-payroll="${escapeHtml(pr.id)}" style="margin-right:6px;cursor:pointer;">Sửa</button>
                <button type="button" class="btn-admin primary" data-pay-payroll="${escapeHtml(pr.id)}" style="background:#15803d;border-color:#15803d;padding:4px 10px;font-size:12px;cursor:pointer;">Xác nhận đã trả</button>
              `;
            } else {
              statusBadge = `<span style="background:#f1f5f9;color:#475569;padding:3px 8px;border-radius:4px;font-weight:600;font-size:11.5px;">Chưa thanh toán</span>`;
              actionHtml = `
                <button type="button" class="table-action-btn" data-edit-payroll="${escapeHtml(pr.id)}" style="margin-right:6px;cursor:pointer;">Sửa</button>
                <button type="button" class="table-action-btn" data-pay-payroll="${escapeHtml(pr.id)}" style="color:#15803d;font-weight:600;cursor:pointer;">Chi trả</button>
              `;
            }

            return `
              <tr>
                <td><strong>${escapeHtml(pr.periodMonth || "")}</strong></td>
                <td>
                  <strong>${escapeHtml(pr.employeeName || "")}</strong>
                  <br><small style="color:#64748b;">Mã NV: ${escapeHtml(pr.employeeUserId || "")}</small>
                </td>
                <td>${isMissingSalary ? '<span style="color:#dc2626;font-weight:700;font-size:12px;">Chưa có mức lương</span>' : formatPrice(pr.baseSalary || 0)}</td>
                <td>
                  <small style="color:#15803d;">+${formatPrice(pr.bonus || 0)}</small> /
                  <small style="color:#b91c1c;">-${formatPrice(pr.deduction || 0)}</small>
                </td>
                <td><strong>${isMissingSalary ? "—" : formatPrice(pr.netAmount || 0)}</strong></td>
                <td>
                  <small style="color:#b45309;font-weight:600;">${escapeHtml(pr.dueDate || (pr.periodMonth ? pr.periodMonth + "-10" : "—"))}</small>
                </td>
                <td>${statusBadge}</td>
                <td><small>${escapeHtml(pr.createdByName || "Hệ thống")}</small></td>
                <td style="text-align: right;">${actionHtml}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;
    return;
  }

  // Audit logs tab
  let logs = financeState.auditLogs;
  const auditSearch = (document.getElementById("finAuditSearchInput")?.value || "").toLowerCase().trim();
  const auditType = document.getElementById("finAuditTypeFilter")?.value || "all";
  const auditAction = document.getElementById("finAuditActionFilter")?.value || "all";

  if (auditSearch) {
    logs = logs.filter((l) => {
      const actor = (l.actorName || l.actorRole || "").toLowerCase();
      const entity = (l.entityType || l.entityId || "").toLowerCase();
      const details = (l.detailsJson || "").toLowerCase();
      return actor.includes(auditSearch) || entity.includes(auditSearch) || details.includes(auditSearch);
    });
  }
  if (auditType !== "all") {
    logs = logs.filter((l) => (l.entityType || "").toUpperCase() === auditType.toUpperCase());
  }
  if (auditAction !== "all") {
    logs = logs.filter((l) => (l.action || "").toUpperCase().includes(auditAction.toUpperCase()));
  }

  if (logs.length === 0) {
    wrap.innerHTML = `<div style="text-align:center;color:#64748b;padding:28px;">Chưa có nhật ký thay đổi tài chính nào phù hợp bộ lọc.</div>`;
    return;
  }
  wrap.innerHTML = `
    <table class="admin-data-table">
      <thead>
        <tr>
          <th>Thời điểm</th>
          <th>Người thực hiện</th>
          <th>Hành động</th>
          <th>Đối tượng</th>
          <th>Chi tiết thay đổi</th>
        </tr>
      </thead>
      <tbody>
        ${logs.map((l) => `
          <tr>
            <td><small>${l.createdAt ? new Date(l.createdAt).toLocaleString("vi-VN") : "—"}</small></td>
            <td><strong>${escapeHtml(l.actorName || "—")}</strong> <small style="color:#64748b;">(${escapeHtml(l.actorRole || "")})</small></td>
            <td><code style="background:#f1f5f9; padding:2px 6px; border-radius:4px;">${escapeHtml(l.action || "")}</code></td>
            <td><small style="font-weight:600;">${escapeHtml(l.entityType || "")} · #${escapeHtml(l.entityId || "")}</small></td>
            <td><code style="font-size:11px; word-break:break-all; color:#334155;">${escapeHtml(l.detailsJson || "")}</code></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

async function openTxDetailModal(txId) {
  const modal = document.getElementById("finTxDetailModalBackdrop");
  const body = document.getElementById("finTxDetailModalBody");
  if (!modal || !body) return;

  body.innerHTML = `<div style="text-align:center; padding: 36px; color: #64748b;"><span class="spinner-border spinner-border-sm text-primary" role="status" style="margin-right:8px;"></span>Đang tải chi tiết giao dịch #${escapeHtml(txId)}...</div>`;
  modal.classList.add("show");

  try {
    const detail = await getFinanceTransactionById(txId);
    if (!detail) throw new Error("Không tìm thấy thông tin giao dịch.");

    const tx = detail.transaction || detail;
    const info = getFinTxTypeLabel(tx.txType);
    const isIncome = tx.txType === "INCOME_OTHER";
    const auditLogs = detail.auditLogs || [];

    let linkedHtml = `<span style="color:#94a3b8;">Không có liên kết nghiệp vụ</span>`;
    if (detail.linkedOrder) {
      linkedHtml = `<strong>Đơn hàng #${escapeHtml(detail.linkedOrder.id)}</strong> (Khách: ${escapeHtml(detail.linkedOrder.customerName || "")} · ${formatPrice(detail.linkedOrder.total || 0)})`;
    } else if (detail.linkedPurchase) {
      linkedHtml = `<strong>Phiếu nhập #${escapeHtml(detail.linkedPurchase.id)}</strong> (NCC: ${escapeHtml(detail.linkedPurchase.supplierName || "")} · ${formatPrice(detail.linkedPurchase.totalAmount || 0)})`;
    } else if (detail.linkedPayroll) {
      linkedHtml = `<strong>Kỳ lương ${escapeHtml(detail.linkedPayroll.periodMonth || "")}</strong> (NV: ${escapeHtml(detail.linkedPayroll.employeeName || "")} · ${formatPrice(detail.linkedPayroll.netAmount || 0)})`;
    } else if (tx.linkedRef) {
      linkedHtml = `<strong>${escapeHtml(tx.linkedRef)}</strong>`;
    }

    body.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 20px;">
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
          <div style="font-size: 11.5px; color: #64748b; font-weight: 600;">Mã giao dịch</div>
          <div style="font-size: 16px; font-weight: 700; color: #0f172a; font-family: monospace;">#${escapeHtml(tx.id)}</div>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
          <div style="font-size: 11.5px; color: #64748b; font-weight: 600;">Phân loại</div>
          <div style="margin-top: 2px;"><span style="padding:2px 8px;border-radius:999px;font-size:11.5px;font-weight:600;${info.badge}">${info.label}</span></div>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
          <div style="font-size: 11.5px; color: #64748b; font-weight: 600;">Số tiền</div>
          <div style="font-size: 17px; font-weight: 800; color: ${isIncome ? "#15803d" : "#b91c1c"};">${isIncome ? "+" : "-"}${formatPrice(tx.amount || 0)}</div>
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
          <div style="font-size: 11.5px; color: #64748b; font-weight: 600;">Ngày phát sinh</div>
          <div style="font-size: 14px; font-weight: 600; color: #1e293b;">${escapeHtml(tx.txDate || "—")}</div>
        </div>
      </div>

      <div style="display: grid; gap: 10px; font-size: 13px; margin-bottom: 20px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px;">
        <div><span style="color:#64748b;">Danh mục:</span> <strong>${escapeHtml(tx.category || "—")}</strong></div>
        <div><span style="color:#64748b;">Phương thức thanh toán:</span> <strong>${escapeHtml(tx.paymentMethod || "—")}</strong></div>
        <div><span style="color:#64748b;">Ghi chú nội dung:</span> <strong>${escapeHtml(tx.note || "Không có")}</strong></div>
        <div><span style="color:#64748b;">Người tạo:</span> <strong>${escapeHtml(tx.createdByName || tx.createdByUserId || "—")}</strong> <small style="color:#64748b;">(${tx.createdAt ? new Date(tx.createdAt).toLocaleString("vi-VN") : ""})</small></div>
        <div><span style="color:#64748b;">Đối soát:</span> ${tx.reconciled ? `<span style="color:#15803d; font-weight:600;">Đã đối soát bởi ${escapeHtml(tx.reconciledBy || "")} lúc ${tx.reconciledAt ? new Date(tx.reconciledAt).toLocaleString("vi-VN") : ""}</span>` : `<span style="color:#b45309; font-weight:600;">Chưa đối soát (có thể chỉnh sửa nếu chưa đối soát)</span>`}</div>
        <div><span style="color:#64748b;">Liên kết nghiệp vụ:</span> ${linkedHtml}</div>
        <div><span style="color:#64748b;">Chứng từ đính kèm:</span> ${tx.attachmentUrl ? `<a href="${escapeHtml(tx.attachmentUrl)}" target="_blank" rel="noopener noreferrer" style="color:#0284c7; font-weight:600; text-decoration:underline;">Mở xem chứng từ / hóa đơn ↗</a>` : `<span style="color:#94a3b8;">Không có</span>`}</div>
      </div>

      <div style="border-top: 1px solid #e2e8f0; padding-top: 14px;">
        <h5 style="font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 8px;">Nhật ký thay đổi (Audit History của riêng giao dịch này)</h5>
        ${auditLogs.length === 0 ? `<div style="color:#94a3b8; font-size: 12px;">Chưa có lịch sử thay đổi nào sau khi tạo.</div>` : `
          <div style="max-height: 180px; overflow-y: auto;">
            <table class="admin-data-table" style="font-size: 11.5px;">
              <thead>
                <tr>
                  <th>Thời điểm</th>
                  <th>Người thực hiện</th>
                  <th>Hành động</th>
                  <th>Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                ${auditLogs.map((log) => `
                  <tr>
                    <td><small>${log.createdAt ? new Date(log.createdAt).toLocaleString("vi-VN") : "—"}</small></td>
                    <td>${escapeHtml(log.actorName || log.actorRole || "—")}</td>
                    <td><code>${escapeHtml(log.action || "")}</code></td>
                    <td><code style="word-break:break-all;">${escapeHtml(log.detailsJson || "")}</code></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
  } catch (err) {
    body.innerHTML = `<div style="text-align:center; padding: 24px; color: #b91c1c;">Lỗi: ${escapeHtml(err.message || "Không thể tải chi tiết giao dịch")}</div>`;
  }
}

function bindFinanceReports() {
  const presetEl = document.getElementById("finPeriodPreset");
  const fromEl = document.getElementById("finFromDate");
  const toEl = document.getElementById("finToDate");
  const applyBtn = document.getElementById("finApplyFilterBtn");

  const initialDates = getPresetDates("month");
  financeState.from = initialDates.from;
  financeState.to = initialDates.to;
  if (fromEl) fromEl.value = initialDates.from;
  if (toEl) toEl.value = initialDates.to;

  if (presetEl) {
    presetEl.addEventListener("change", () => {
      financeState.preset = presetEl.value;
      if (presetEl.value !== "custom") {
        const d = getPresetDates(presetEl.value);
        financeState.from = d.from;
        financeState.to = d.to;
        if (fromEl) fromEl.value = d.from;
        if (toEl) toEl.value = d.to;
        loadAndRenderFinanceReports().catch((err) => showToast(err.message, "error"));
      }
    });
  }

  if (applyBtn) {
    applyBtn.addEventListener("click", () => {
      const f = fromEl?.value || "";
      const t = toEl?.value || "";
      if (f && t && f > t) {
        showToast("Ngày bắt đầu không được lớn hơn ngày kết thúc.", "error");
        return;
      }
      financeState.from = f;
      financeState.to = t;
      if (presetEl) presetEl.value = "custom";
      loadAndRenderFinanceReports().catch((err) => showToast(err.message, "error"));
    });
  }

  // Granularity selector buttons (Theo ngày, tháng, quý, năm)
  document.querySelectorAll("#finChartGranularityGroup [data-granularity]").forEach((btn) => {
    btn.addEventListener("click", () => {
      financeState.chartGranularity = btn.dataset.granularity;
      renderFinanceChart(financeState.summary?.series || []);
    });
  });

  // Search in transactions tab
  document.getElementById("finTxSearchInput")?.addEventListener("input", () => {
    renderFinanceSubtabContent();
  });

  // Audit filters
  ["finAuditSearchInput", "finAuditTypeFilter", "finAuditActionFilter"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", () => renderFinanceSubtabContent());
      el.addEventListener("change", () => renderFinanceSubtabContent());
    }
  });

  ["finFilterType", "finFilterReconciled", "finFilterMethod", "finFilterCreator"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", () => loadAndRenderFinanceReports().catch(() => {}));
  });

  document.querySelectorAll("#finSubTabs [data-fin-subtab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#finSubTabs [data-fin-subtab]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      financeState.subtab = btn.dataset.finSubtab;
      renderFinanceSubtabContent();
    });
  });

  // Modal Ghi nhận / Sửa Thu Chi
  const txModal = document.getElementById("finTxModalBackdrop");
  const txForm = document.getElementById("finTxForm");
  const openTxModal = (editTx = null) => {
    if (!txModal) return;
    document.getElementById("finTxEditId").value = editTx ? editTx.id : "";
    document.getElementById("finTxModalTitle").textContent = editTx ? `Sửa giao dịch #${editTx.id}` : "Ghi nhận khoản thu / chi";
    const typeSel = document.getElementById("finTxTypeInput");
    typeSel.value = editTx ? editTx.txType : "EXPENSE_OPERATING";
    typeSel.disabled = Boolean(editTx);
    document.getElementById("finTxCategoryInput").value = editTx ? editTx.category : "";
    document.getElementById("finTxDateInput").value = editTx ? editTx.txDate : new Date().toISOString().slice(0, 10);
    document.getElementById("finTxAmountInput").value = editTx ? editTx.amount : "";
    document.getElementById("finTxMethodInput").value = editTx ? (editTx.paymentMethod || "Chuyển khoản ngân hàng") : "Chuyển khoản ngân hàng";
    document.getElementById("finTxNoteInput").value = editTx ? (editTx.note || "") : "";
    const attachEl = document.getElementById("finTxAttachmentInput");
    if (attachEl) attachEl.value = editTx ? (editTx.attachmentUrl || "") : "";
    const refEl = document.getElementById("finTxLinkedRefInput");
    if (refEl) refEl.value = editTx ? (editTx.linkedRef || editTx.orderId || editTx.purchaseOrderId || editTx.payrollId || "") : "";
    txModal.classList.add("show");
  };
  document.getElementById("finAddTxBtn")?.addEventListener("click", () => openTxModal(null));
  document.getElementById("finTxModalCloseBtn")?.addEventListener("click", () => txModal?.classList.remove("show"));
  document.getElementById("finTxCancelBtn")?.addEventListener("click", () => txModal?.classList.remove("show"));

  // Transaction Detail Modal close
  const txDetailModal = document.getElementById("finTxDetailModalBackdrop");
  document.getElementById("finTxDetailModalCloseBtn")?.addEventListener("click", () => txDetailModal?.classList.remove("show"));
  document.getElementById("finTxDetailModalCloseBtn2")?.addEventListener("click", () => txDetailModal?.classList.remove("show"));

  if (txForm) {
    txForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const editId = document.getElementById("finTxEditId").value;
      const payload = {
        txType: document.getElementById("finTxTypeInput").value,
        category: document.getElementById("finTxCategoryInput").value.trim(),
        txDate: document.getElementById("finTxDateInput").value,
        amount: Number(document.getElementById("finTxAmountInput").value),
        paymentMethod: document.getElementById("finTxMethodInput").value,
        note: document.getElementById("finTxNoteInput").value.trim(),
        attachmentUrl: document.getElementById("finTxAttachmentInput")?.value.trim() || null,
        linkedRef: document.getElementById("finTxLinkedRefInput")?.value.trim() || null
      };
      const ok = confirm(`Xác nhận ${editId ? "cập nhật" : "lưu"} khoản ${payload.category} (${formatPrice(payload.amount)})?`);
      if (!ok) return;
      try {
        if (editId) await updateFinanceTransaction(editId, payload);
        else await createFinanceTransaction(payload);
        txModal.classList.remove("show");
        await loadAndRenderFinanceReports();
        showToast(editId ? "Đã cập nhật giao dịch và ghi nhật ký." : "Đã ghi nhận khoản thu/chi mới.");
      } catch (err) {
        showToast(err?.message || "Không thể lưu giao dịch.", "error");
      }
    });
  }

  document.getElementById("finAddPurchaseBtn")?.addEventListener("click", () => {
    openCreatePurchaseModal(null);
  });

  // Modal Tạo bảng lương
  const payModal = document.getElementById("finPayrollModalBackdrop");
  const payForm = document.getElementById("finPayrollForm");
  document.getElementById("finAddPayrollBtn")?.addEventListener("click", () => {
    const empSel = document.getElementById("finPayEmployeeSelect");
    if (empSel) {
      const staffList = getUsers().filter((u) => u && u.active !== false && !u.hidden && (u.role === "admin" || u.role === "staff" || u.role === "cashier"));
      empSel.innerHTML = staffList.map((u) => `<option value="${escapeHtml(u.id)}">${escapeHtml(u.name)} (${getRoleLabel(u.role).text})</option>`).join("");
    }
    const periodEl = document.getElementById("finPayPeriodInput");
    if (periodEl && !periodEl.value) periodEl.value = new Date().toISOString().slice(0, 7);
    payModal?.classList.add("show");
  });
  document.getElementById("finPayrollModalCloseBtn")?.addEventListener("click", () => payModal?.classList.remove("show"));
  document.getElementById("finPayrollCancelBtn")?.addEventListener("click", () => payModal?.classList.remove("show"));

  if (payForm) {
    payForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        employeeUserId: document.getElementById("finPayEmployeeSelect").value,
        periodMonth: document.getElementById("finPayPeriodInput").value,
        baseSalary: Number(document.getElementById("finPayBaseInput").value || 0),
        bonus: Number(document.getElementById("finPayBonusInput").value || 0),
        deduction: Number(document.getElementById("finPayDeductInput").value || 0),
        note: document.getElementById("finPayNoteInput").value.trim()
      };
      try {
        await createPayrollRecord(payload);
        payModal.classList.remove("show");
        await loadAndRenderFinanceReports();
        showToast("Đã tạo bảng lương nhân viên.");
      } catch (err) {
        showToast(err?.message || "Không thể tạo bảng lương.", "error");
      }
    });
  }

  // Modal Nhập / Chỉnh sửa mức lương nhân viên
  const payEditModal = document.getElementById("finPayrollEditModalBackdrop");
  const payEditForm = document.getElementById("finPayrollEditForm");

  const openPayrollEditModal = (pr) => {
    if (!payEditModal || !pr) return;
    document.getElementById("finPayrollEditId").value = pr.id;
    document.getElementById("finPayrollEditEmpName").textContent = pr.employeeName || "";
    document.getElementById("finPayrollEditPeriod").textContent = pr.periodMonth || "";
    document.getElementById("finPayrollEditDueDate").textContent = pr.dueDate || (pr.periodMonth + "-10");
    const statusBadge = document.getElementById("finPayrollEditStatusBadge");
    if (statusBadge) {
      statusBadge.innerHTML = pr.status === "MISSING_SALARY" || !pr.baseSalary
        ? '<span style="background:#fee2e2;color:#b91c1c;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:700;">Thiếu mức lương</span>'
        : (pr.status === "DUE"
          ? '<span style="background:#fef3c7;color:#b45309;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:700;">Đến hạn</span>'
          : '<span style="background:#f1f5f9;color:#475569;padding:2px 6px;border-radius:4px;font-size:11px;">Chưa thanh toán</span>');
    }
    const baseInput = document.getElementById("finPayrollEditBaseSalary");
    const bonusInput = document.getElementById("finPayrollEditBonus");
    const deductInput = document.getElementById("finPayrollEditDeduction");
    const noteInput = document.getElementById("finPayrollEditNote");
    const estimateEl = document.getElementById("finPayrollEditNetEstimate");

    baseInput.value = pr.baseSalary && pr.baseSalary > 0 ? pr.baseSalary : "";
    bonusInput.value = pr.bonus || 0;
    deductInput.value = pr.deduction || 0;
    noteInput.value = pr.note || "";

    const updateEstimate = () => {
      const b = Number(baseInput.value || 0);
      const bo = Number(bonusInput.value || 0);
      const d = Number(deductInput.value || 0);
      estimateEl.textContent = formatPrice(Math.max(0, b + bo - d));
    };
    baseInput.oninput = updateEstimate;
    bonusInput.oninput = updateEstimate;
    deductInput.oninput = updateEstimate;
    updateEstimate();

    payEditModal.classList.add("show");
  };

  document.getElementById("finPayrollEditModalCloseBtn")?.addEventListener("click", () => payEditModal?.classList.remove("show"));
  document.getElementById("finPayrollEditCancelBtn")?.addEventListener("click", () => payEditModal?.classList.remove("show"));

  if (payEditForm) {
    payEditForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = document.getElementById("finPayrollEditId").value;
      const baseSalary = Number(document.getElementById("finPayrollEditBaseSalary").value);
      if (isNaN(baseSalary) || baseSalary <= 0) {
        showToast("Vui lòng nhập mức lương cơ bản hợp lệ (> 0 VNĐ).", "error");
        return;
      }
      const payload = {
        baseSalary,
        bonus: Number(document.getElementById("finPayrollEditBonus").value || 0),
        deduction: Number(document.getElementById("finPayrollEditDeduction").value || 0),
        note: document.getElementById("finPayrollEditNote").value.trim(),
        saveToProfile: document.getElementById("finPayrollEditSaveProfile")?.checked ?? true
      };
      try {
        await updatePayrollRecord(id, payload);
        payEditModal.classList.remove("show");
        await loadAndRenderFinanceReports();
        showToast("Đã lưu mức lương và cập nhật bảng lương thành công!");
      } catch (err) {
        showToast(err?.message || "Không thể cập nhật mức lương.", "error");
      }
    });
  }

  // Drilldown modal close
  const drillModal = document.getElementById("finKpiDrilldownModalBackdrop");
  document.getElementById("finKpiDrilldownCloseBtn")?.addEventListener("click", () => drillModal?.classList.remove("show"));
  document.getElementById("finKpiDrilldownDismissBtn")?.addEventListener("click", () => drillModal?.classList.remove("show"));

  // Row action delegation for finance tables and COD payments
  document.addEventListener("click", async (e) => {
    // KPI Drilldown button
    const drillBtn = e.target.closest("[data-kpi-drill]");
    if (drillBtn) {
      const kpiKey = drillBtn.dataset.kpiDrill;
      openKpiDrilldown(kpiKey);
      return;
    }

    // Switch to orders tab
    const switchOrdersBtn = e.target.closest("[data-switch-to-orders]");
    if (switchOrdersBtn) {
      e.preventDefault();
      const ordersTab = document.querySelector('[data-tab="orders"]');
      if (ordersTab) ordersTab.click();
      return;
    }

    // Confirm delivery from review table
    const deliveryBtn = e.target.closest("[data-confirm-delivery]");
    if (deliveryBtn) {
      const oId = deliveryBtn.dataset.confirmDelivery;
      const payMethod = deliveryBtn.dataset.payMethod || "";
      const payStatus = (deliveryBtn.dataset.payStatus || "").toUpperCase();
      const isQR = payMethod.toLowerCase().includes("qr") || payMethod.toLowerCase().includes("chuyển khoản");

      if (isQR && payStatus !== "PAID") {
        alert("Đơn hàng chuyển khoản QR chưa được hệ thống SePay xác nhận thanh toán. Quy tắc bảo vệ doanh thu: Không thể chuyển sang 'Hoàn thành' khi giao dịch chưa được xác nhận nhận tiền.");
        return;
      }

      const ok = confirm(`Xác nhận đơn hàng #${oId} đã được giao thành công đến khách hàng? Trạng thái sẽ được cập nhật đồng bộ sang 'Hoàn thành' ở cả tài khoản khách, quản trị và báo cáo doanh thu.`);
      if (!ok) return;

      try {
        const curUser = getCurrentUser();
        await apiFetch(`/api/orders/${encodeURIComponent(oId)}/status`, {
          method: "PATCH",
          body: JSON.stringify({
            status: "Hoàn thành",
            completedBy: curUser?.name || "Quản trị viên"
          })
        });

        if (!isQR && payStatus !== "PAID") {
          const collectNow = confirm(`Đơn hàng #${oId} đã được thu tiền mặt COD (${formatPrice(deliveryBtn.dataset.amount || 0)}) và nộp vào quỹ cửa hàng chưa?\n\n- Nhấn OK nếu ĐÃ THU TIỀN VÀO QUỸ (ghi nhận Tiền thực thu)\n- Nhấn Cancel nếu TIỀN CÒN ĐANG CHỜ ĐỐI SOÁT (chưa nộp quỹ, phân loại vào danh sách đối soát COD)`);
          if (collectNow) {
            try {
              await confirmCodPayment(oId);
            } catch (_) {}
          }
        }

        showToast(`Đã xác nhận đơn hàng #${oId} giao thành công!`);
        await loadAndRenderFinanceReports();
        const freshOrders = await fetchAllOrdersFromBackend();
        if (Array.isArray(freshOrders)) {
          orders = freshOrders;
          renderOrdersTable();
        }
      } catch (err) {
        showToast(err?.message || "Không thể cập nhật trạng thái đơn hàng.", "error");
      }
      return;
    }

    // Collect COD button inside pending drilldown modal
    const collectCodBtn = e.target.closest("[data-collect-cod]");
    if (collectCodBtn) {
      const oId = collectCodBtn.dataset.collectCod;
      const amount = Number(collectCodBtn.dataset.amount || 0);
      const ok = confirm(`Xác nhận đã nhận đủ tiền mặt COD (${formatPrice(amount)}) cho đơn hàng #${oId} và nộp vào quỹ?`);
      if (!ok) return;
      try {
        await confirmCodPayment(oId);
        showToast(`Đã xác nhận thu tiền COD cho đơn hàng #${oId}!`);
        await loadAndRenderFinanceReports();
        openKpiDrilldown("pending_orders");
        const freshOrders = await fetchAllOrdersFromBackend();
        if (Array.isArray(freshOrders)) {
          orders = freshOrders;
          renderOrdersTable();
        }
      } catch (err) {
        showToast(err?.message || "Không thể xác nhận thu tiền COD.", "error");
      }
      return;
    }

    // Edit payroll button
    const editPayBtn = e.target.closest("[data-edit-payroll]");
    if (editPayBtn) {
      const id = editPayBtn.dataset.editPayroll;
      const pr = financeState.payrolls.find((p) => p.id === id);
      if (pr) openPayrollEditModal(pr);
      return;
    }

    const viewTxBtn = e.target.closest("[data-view-fintx]");
    if (viewTxBtn) {
      const id = viewTxBtn.dataset.viewFintx;
      openTxDetailModal(id);
      return;
    }
    const editBtn = e.target.closest("[data-edit-fintx]");
    if (editBtn) {
      const tx = financeState.transactions.find((t) => String(t.id) === String(editBtn.dataset.editFintx));
      if (tx) openTxModal(tx);
      return;
    }
    const recBtn = e.target.closest("[data-reconcile-fintx]");
    if (recBtn) {
      const id = recBtn.dataset.reconcileFintx;
      if (!confirm(`Xác nhận đối soát giao dịch #${id}? Sau khi đối soát sẽ không thể sửa hoặc xóa.`)) return;
      try {
        await reconcileFinanceTransaction(id);
        await loadAndRenderFinanceReports();
        showToast(`Đã đối soát giao dịch #${id}.`);
      } catch (err) {
        showToast(err?.message || "Không thể đối soát giao dịch.", "error");
      }
      return;
    }
    const payBtn = e.target.closest("[data-pay-payroll]");
    if (payBtn) {
      const id = payBtn.dataset.payPayroll;
      const pr = financeState.payrolls.find((p) => p.id === id);
      if (pr && (pr.status === "MISSING_SALARY" || !pr.baseSalary || pr.baseSalary <= 0)) {
        alert("Nhân viên chưa có mức lương trong bảng lương. Vui lòng bấm '+ Nhập lương' trước khi xác nhận chi trả.");
        return;
      }
      if (!confirm(`Xác nhận đã chi lương cho bảng lương #${id}?`)) return;
      try {
        await payPayrollRecord(id, "Chuyển khoản ngân hàng");
        await loadAndRenderFinanceReports();
        showToast("Đã xác nhận chi lương và ghi nhận vào sổ chi.");
      } catch (err) {
        showToast(err?.message || "Không thể xác nhận chi lương.", "error");
      }
      return;
    }
    const confirmCodBtn = e.target.closest("[data-confirm-cod-payment]");
    if (confirmCodBtn) {
      const oId = confirmCodBtn.dataset.confirmCodPayment;
      if (!confirm(`Xác nhận đã thu tiền mặt COD cho đơn #${oId}? Giao dịch sẽ được ghi nhận vào tiền thực thu hệ thống.`)) return;
      try {
        await confirmCodPayment(oId);
        showToast(`Đã xác nhận thu tiền COD cho đơn #${oId}!`);
        await loadAndRenderFinanceReports();
        const freshOrders = await fetchAllOrdersFromBackend();
        if (Array.isArray(freshOrders)) {
          orders = freshOrders;
          renderOrdersTable();
          openOrderDetail(oId);
        }
      } catch (err) {
        showToast(err?.message || "Không thể xác nhận thanh toán COD", "error");
      }
    }
  });
}

function bindDashboardReport() {
  const reportBtn = document.getElementById("exportReportBtn");
  if (reportBtn) {
    reportBtn.addEventListener("click", () => {
      const s = financeState.summary;
      if (!s) {
        showToast("Vui lòng đợi dữ liệu báo cáo tải xong.", "error");
        return;
      }
      const kpiRows = [
        { "Mục": "=== TỔNG HỢP CHỈ SỐ KPI TÀI CHÍNH ===", "Giá trị": "", "Đơn vị": "" },
        { "Mục": "Kỳ báo cáo", "Giá trị": `${s.from || "Đầu kỳ"} -> ${s.to || "Hiện tại"}`, "Đơn vị": "Thời gian" },
        { "Mục": "Giá trị đơn đã giao", "Giá trị": s.completedOrderSales || 0, "Đơn vị": "VNĐ" },
        { "Mục": "Tiền khách đã trả", "Giá trị": s.collectedCash || 0, "Đơn vị": "VNĐ" },
        { "Mục": "Khách còn chưa trả", "Giá trị": s.pendingReceivable || 0, "Đơn vị": "VNĐ" },
        { "Mục": "Cửa hàng đã chi", "Giá trị": typeof s.totalExpenses === "number" ? s.totalExpenses : ((s.purchaseCashOut || 0) + (s.operatingExpenses || 0) + (s.payrollPaid || 0)), "Đơn vị": "VNĐ" },
        { "Mục": "   - Tiền nhập hàng đã trả NCC", "Giá trị": s.purchaseCashOut || 0, "Đơn vị": "VNĐ" },
        { "Mục": "   - Chi phí vận hành", "Giá trị": s.operatingExpenses || 0, "Đơn vị": "VNĐ" },
        { "Mục": "   - Chi lương nhân viên đã trả", "Giá trị": s.payrollRestricted ? "Ẩn theo phân quyền" : (s.payrollPaid || 0), "Đơn vị": "VNĐ" },
        { "Mục": "Cửa hàng còn phải trả", "Giá trị": typeof s.totalDebt === "number" ? s.totalDebt : ((s.supplierDebt || 0) + (s.payrollPending || 0)), "Đơn vị": "VNĐ" },
        { "Mục": "   - Công nợ nhà cung cấp còn nợ", "Giá trị": s.supplierDebt || 0, "Đơn vị": "VNĐ" },
        { "Mục": "   - Công nợ lương đến hạn chưa trả", "Giá trị": s.payrollRestricted ? "Ẩn theo phân quyền" : (s.payrollPending || 0), "Đơn vị": "VNĐ" },
        { "Mục": "Thu trừ chi", "Giá trị": s.netCashFlow || 0, "Đơn vị": "VNĐ" },
        { "Mục": "Hoàn tiền thực tế", "Giá trị": s.refundedActual || 0, "Đơn vị": "VNĐ" },
        { "Mục": "Giá trị tồn kho theo giá nhập bình quân", "Giá trị": s.inventoryValuationAtCost || 0, "Đơn vị": "VNĐ" },
        { "Mục": "Lợi nhuận gộp / ước tính", "Giá trị": s.grossProfitStatus === "AVAILABLE" ? (s.grossProfit || 0) : (s.grossProfitStatus === "NO_DATA" ? "Chưa có đơn hoàn tất" : "Chưa có giá nhập"), "Đơn vị": "VNĐ" },
        { "Mục": "", "Giá trị": "", "Đơn vị": "" },
        { "Mục": "=== DANH SÁCH CHI TIẾT GIAO DỊCH THU / CHI TRONG KỲ ===", "Giá trị": "", "Đơn vị": "" }
      ];

      const txRows = (financeState.transactions || []).map((t) => ({
        "Mục": `#${t.id} - ${t.txDate || ""}`,
        "Giá trị": `${t.txType === "INCOME_OTHER" ? "+" : "-"}${t.amount || 0}`,
        "Đơn vị": `${t.category || ""} | ${t.paymentMethod || ""} | ${t.note || ""} | ${t.reconciled ? "Đã đối soát" : "Chưa đối soát"}`
      }));

      exportToExcel([...kpiRows, ...txRows], `ecodesk-bao-cao-tai-chinh-${s.from || "all"}-${s.to || "now"}`, "Báo cáo tài chính");
      showToast("Đã xuất báo cáo tài chính ra file Excel theo bộ lọc hiện tại.");
    });
  }

  const reportPdfBtn = document.getElementById("exportReportPdfBtn");
  if (reportPdfBtn) {
    reportPdfBtn.addEventListener("click", () => {
      const s = financeState.summary;
      if (!s) {
        showToast("Vui lòng đợi dữ liệu báo cáo tải xong.", "error");
        return;
      }
      const curUser = getCurrentUser();
      exportFinancialReportToPDF({
        summary: s,
        transactions: financeState.transactions || [],
        from: financeState.from,
        to: financeState.to,
        authorName: curUser?.name || "Quản trị viên"
      });
      showToast("Đã tải xuống báo cáo tài chính & dòng tiền PDF!");
    });
  }
}

/* ==========================================================================
   ROLE-BASED ACCESS CONTROL (RBAC) ENFORCEMENT IN ADMIN
   ========================================================================== */
function applyRBACPermissions(currentUser) {
  if (!currentUser) return;
  const isSysAdmin = currentUser.role === "admin";

  const tabPermMap = {
    orders: PERMISSIONS.ORDERS_VIEW,
    products: PERMISSIONS.PRODUCTS_MANAGE,
    categories: PERMISSIONS.CATEGORIES_MANAGE,
    inventory: PERMISSIONS.PRODUCTS_PRICE_STOCK,
    customers: PERMISSIONS.USERS_VIEW,
    campaigns: PERMISSIONS.PROMOTIONS_MANAGE,
    reviews: PERMISSIONS.REVIEWS_MANAGE,
    reports: PERMISSIONS.REPORTS_VIEW,
    chat: PERMISSIONS.CHAT_SUPPORT
  };

  document.querySelectorAll(".admin-nav .nav-link").forEach((link) => {
    const tab = link.dataset.tab;
    if (tab && tabPermMap[tab]) {
      const allowed = isSysAdmin
        || hasPermission(currentUser, tabPermMap[tab])
        || (tab === "reports" && hasPermission(currentUser, PERMISSIONS.FINANCE_VIEW));
      const li = link.closest("li");
      if (li) li.style.display = allowed ? "" : "none";
    }
  });

  const canExport = isSysAdmin || hasPermission(currentUser, PERMISSIONS.DATA_EXPORT);
  ["exportOrdersBtn", "exportOrdersPdfBtn", "exportReportBtn", "exportReportPdfBtn", "exportProductsBtn", "exportCategoriesBtn"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = canExport ? "" : "none";
  });

  const canRecordExpense = isSysAdmin || hasPermission(currentUser, PERMISSIONS.FINANCE_RECORD_EXPENSE);
  ["finAddTxBtn", "finAddPurchaseBtn"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = canRecordExpense ? "" : "none";
  });

  const canPayroll = isSysAdmin || hasPermission(currentUser, PERMISSIONS.FINANCE_PAYROLL_VIEW);
  const payrollTabBtn = document.getElementById("finSubtabPayrollBtn");
  if (payrollTabBtn) payrollTabBtn.style.display = canPayroll ? "" : "none";
  const addPayrollBtn = document.getElementById("finAddPayrollBtn");
  if (addPayrollBtn && !canPayroll) addPayrollBtn.style.display = "none";

  const canManageProducts = isSysAdmin || hasPermission(currentUser, PERMISSIONS.PRODUCTS_MANAGE);
  ["overviewAddProductBtn"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = canManageProducts ? "" : "none";
  });

  const activeLink = document.querySelector(`.admin-nav .nav-link[data-tab="${activeTab}"]`);
  if (activeLink && activeLink.closest("li")?.style.display === "none") {
    switchTab("overview");
  }
}

/* ==========================================================================
   HỖ TRỢ KHÁCH HÀNG / TIN NHẮN (ADMIN CHAT)
   ========================================================================== */
let currentActiveChatThreadId = null;

async function bindAdminChat() {
  const threadListEl = document.getElementById("adminChatThreadList");
  const msgContainer = document.getElementById("adminChatMessagesContainer");
  const chatInput = document.getElementById("adminChatMessageInput");
  const sendBtn = document.getElementById("adminChatSendBtn");
  const statusSelect = document.getElementById("adminChatStatusSelect");
  const activeTitle = document.getElementById("adminChatActiveTitle");
  const activeSubtitle = document.getElementById("adminChatActiveSubtitle");
  const staffTag = document.getElementById("chatStaffCurrentName");
  const searchInput = document.getElementById("adminChatSearch");

  const curUser = getCurrentUser();
  if (staffTag && curUser) staffTag.textContent = curUser.name || "Nhân viên";

  let filterStatus = "all";
  let searchQuery = "";

  async function renderThreadList() {
    const threads = await syncChatThreadsFromDisk();

    const unreadStaffCount = threads.reduce((acc, t) => acc + (t.unreadStaffCount || 0), 0);
    const chatBadge = document.getElementById("badgeChatCount");
    if (chatBadge) {
      chatBadge.textContent = String(unreadStaffCount);
      chatBadge.style.display = unreadStaffCount > 0 ? "inline-block" : "none";
    }

    let filtered = threads;
    if (filterStatus !== "all") {
      filtered = filtered.filter((t) => t.status === filterStatus);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((t) =>
        (t.customerName && t.customerName.toLowerCase().includes(q)) ||
        (t.customerEmail && t.customerEmail.toLowerCase().includes(q)) ||
        (t.orderId && t.orderId.toLowerCase().includes(q))
      );
    }

    if (!threadListEl) return;

    if (filtered.length === 0) {
      threadListEl.innerHTML = `<div style="text-align: center; color: #94a3b8; font-size: 13px; padding: 24px;">Không có cuộc hội thoại nào phù hợp.</div>`;
      return;
    }

    threadListEl.innerHTML = filtered.map((t) => {
      const isSelected = t.id === currentActiveChatThreadId;
      const lastMsg = t.messages && t.messages.length > 0 ? t.messages[t.messages.length - 1] : null;
      const timeStr = lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' }) : '';
      const statusBadge = t.status === 'open'
        ? `<span style="background: #fee2e2; color: #dc2626; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;">Mới</span>`
        : (t.status === 'in_progress'
          ? `<span style="background: #fef3c7; color: #d97706; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;">Đang xử lý</span>`
          : `<span style="background: #dcfce7; color: #16a34a; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;">Đã xong</span>`);

      return `
        <div class="admin-chat-thread-item" data-thread-id="${t.id}" style="padding: 10px 12px; border-radius: 8px; margin-bottom: 6px; cursor: pointer; background: ${isSelected ? '#e0f2fe' : '#ffffff'}; border: 1px solid ${isSelected ? '#38bdf8' : '#e2e8f0'};">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <strong style="font-size: 13px; color: #0f172a;">${escapeHtml(t.customerName || "Khách hàng")}</strong>
            <span style="font-size: 11px; color: #94a3b8;">${timeStr}</span>
          </div>
          <div style="font-size: 12px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px;">
            ${lastMsg ? (lastMsg.senderRole === 'staff' ? '<strong>Bạn:</strong> ' : '') + escapeHtml(lastMsg.text) : 'Bắt đầu cuộc trò chuyện'}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; gap: 4px; align-items: center;">
              ${statusBadge}
              ${t.orderId ? `<span style="background: #f1f5f9; color: #475569; padding: 2px 6px; border-radius: 4px; font-size: 10px;">#${t.orderId}</span>` : ''}
            </div>
            ${t.unreadStaffCount > 0 ? `<span style="background: #ef4444; color: #fff; border-radius: 10px; font-size: 10px; font-weight: 700; padding: 1px 6px;">${t.unreadStaffCount}</span>` : ''}
          </div>
        </div>
      `;
    }).join("");

    threadListEl.querySelectorAll(".admin-chat-thread-item").forEach((item) => {
      item.addEventListener("click", () => {
        selectThread(item.dataset.threadId);
      });
    });
  }

  async function selectThread(threadId) {
    currentActiveChatThreadId = threadId;
    const threads = getLocalChatThreads();
    const thread = threads.find((t) => t.id === threadId);
    if (!thread) return;

    await markChatThreadRead(threadId, "staff");

    activeTitle.textContent = `${thread.customerName || "Khách hàng"} (${thread.customerEmail || ""})`;
    activeSubtitle.textContent = thread.orderId ? `Liên quan đến Đơn hàng #${thread.orderId}` : `Khách vãng lai / Tư vấn chung`;
    statusSelect.disabled = false;
    statusSelect.value = thread.status || "open";
    chatInput.disabled = false;
    sendBtn.disabled = false;
    chatInput.focus();

    renderMessages(thread);
    renderThreadList();
  }

  function renderMessages(thread) {
    if (!msgContainer) return;
    const msgs = thread.messages || [];
    if (msgs.length === 0) {
      msgContainer.innerHTML = `<div style="text-align: center; color: #94a3b8; font-size: 13px; margin: auto;">Chưa có tin nhắn nào trong cuộc trò chuyện này.</div>`;
      return;
    }

    msgContainer.innerHTML = msgs.map((m) => {
      const isStaff = m.senderRole === "staff";
      const timeStr = new Date(m.timestamp).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' });

      return `
        <div style="display: flex; flex-direction: column; align-items: ${isStaff ? 'flex-end' : 'flex-start'};">
          <div style="font-size: 11px; color: #94a3b8; margin-bottom: 2px; padding: 0 4px;">
            ${isStaff ? `Nhân viên (${escapeHtml(m.senderName || "EcoDesk")})` : escapeHtml(m.senderName || "Khách")} · ${timeStr}
          </div>
          <div style="max-width: 75%; padding: 10px 14px; border-radius: 12px; font-size: 13.5px; line-height: 1.45; word-break: break-word; background: ${isStaff ? '#0284c7' : '#f1f5f9'}; color: ${isStaff ? '#ffffff' : '#0f172a'}; border-bottom-${isStaff ? 'right' : 'left'}-radius: 2px;">
            ${escapeHtml(m.text)}
          </div>
        </div>
      `;
    }).join("");

    msgContainer.scrollTop = msgContainer.scrollHeight;
  }

  async function handleSend() {
    const text = chatInput?.value.trim();
    if (!text || !currentActiveChatThreadId) return;

    chatInput.value = "";
    const updatedThread = await sendChatMessage(currentActiveChatThreadId, curUser, text);
    if (updatedThread) {
      renderMessages(updatedThread);
      renderThreadList();
    }
  }

  sendBtn?.addEventListener("click", handleSend);
  chatInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  statusSelect?.addEventListener("change", async (e) => {
    if (!currentActiveChatThreadId) return;
    const newStatus = e.target.value;
    const updated = await updateChatThreadStatus(currentActiveChatThreadId, newStatus, curUser);
    if (updated) {
      renderThreadList();
      showToast(`Đã chuyển trạng thái cuộc hội thoại sang: ${newStatus}`);
    }
  });

  searchInput?.addEventListener("input", (e) => {
    searchQuery = e.target.value.trim();
    renderThreadList();
  });

  document.querySelectorAll(".chat-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".chat-filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      filterStatus = btn.dataset.chatFilter;
      renderThreadList();
    });
  });

  renderThreadList();
  window.setInterval(() => {
    if (activeTab === "chat") {
      renderThreadList();
      if (currentActiveChatThreadId) {
        const thread = getLocalChatThreads().find((t) => t.id === currentActiveChatThreadId);
        if (thread) renderMessages(thread);
      }
    }
  }, 3000);
}

/* ==========================================================================
   REVIEWS & COMMENTS MODERATION (TAB 9)
   ========================================================================== */
let reviewFilterQuery = "";
let reviewFilterProduct = "all";
let reviewFilterStar = "all";
let reviewFilterReply = "all";
let activeReviewReplyTarget = null; // { productId, reviewId, targetType: "review"|"comment", targetId }
let pendingReviewDeleteAction = null;

function getReviewAuthorInitials(name = "K") {
  const parts = String(name || "K").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "K";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function renderReviewStarIcons(rating) {
  const safe = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  let html = "";
  for (let i = 1; i <= 5; i += 1) {
    const isFilled = i <= safe;
    html += `<span style="color:${isFilled ? "#f59e0b" : "#cbd5e1"}; display: inline-flex; align-items: center;">${renderIcon("star", {
      size: 15,
      strokeWidth: 1.5,
      fill: isFilled ? "#f59e0b" : "#e2e8f0",
      stroke: isFilled ? "#d97706" : "#cbd5e1",
      className: isFilled ? "star-filled-icon" : "star-empty-icon"
    })}</span>`;
  }
  return html;
}

function renderAdminReplyBlock(reply, { productId, reviewId, targetType, targetId = "" }) {
  if (!reply || !reply.content) return "";
  const timeText = reply.updatedAt ? formatDateTime(reply.updatedAt) : formatDateTime(reply.createdAt);
  const editedTag = reply.updatedAt && reply.updatedAt !== reply.createdAt ? " · Đã chỉnh sửa" : "";
  return `
    <div class="admin-ecodesk-reply-box">
      <div class="admin-ecodesk-reply-head">
        <span class="admin-ecodesk-reply-badge">
          ${renderIcon("shield-check", { size: 14, strokeWidth: 2 })}
          EcoDesk phản hồi (${escapeHtml(reply.responderName || "Quản trị viên")})
        </span>
        <span class="admin-ecodesk-reply-time">${escapeHtml(timeText + editedTag)}</span>
      </div>
      <p class="admin-ecodesk-reply-text">${escapeHtml(reply.content)}</p>
      <div class="admin-review-actions" style="margin-top: 8px;">
        <button type="button" class="btn-admin secondary btn-sm"
          data-rev-action="open-reply"
          data-product-id="${escapeHtml(productId)}"
          data-review-id="${escapeHtml(reviewId)}"
          data-target-type="${escapeHtml(targetType)}"
          data-target-id="${escapeHtml(targetId || "")}">
          Sửa phản hồi
        </button>
        <button type="button" class="btn-admin danger btn-sm"
          data-rev-action="ask-delete-reply"
          data-product-id="${escapeHtml(productId)}"
          data-review-id="${escapeHtml(reviewId)}"
          data-target-type="${escapeHtml(targetType)}"
          data-target-id="${escapeHtml(targetId || "")}">
          Xóa phản hồi
        </button>
      </div>
    </div>
  `;
}

function renderInlineReplyForm({ productId, reviewId, targetType, targetId = "", existingContent = "", label = "" }) {
  return `
    <form class="admin-reply-inline-form"
      data-rev-reply-form="1"
      data-product-id="${escapeHtml(productId)}"
      data-review-id="${escapeHtml(reviewId)}"
      data-target-type="${escapeHtml(targetType)}"
      data-target-id="${escapeHtml(targetId || "")}">
      <div style="font-size: 12.5px; font-weight: 700; color: #166534;">
        ${escapeHtml(label || (existingContent ? "Chỉnh sửa EcoDesk phản hồi" : "Gửi EcoDesk phản hồi"))}
      </div>
      <textarea required maxlength="1200" placeholder="Nhập nội dung phản hồi chính thức từ EcoDesk...">${escapeHtml(existingContent || "")}</textarea>
      <div class="admin-reply-inline-actions">
        <button type="button" class="btn-admin secondary btn-sm" data-rev-action="cancel-reply">Hủy</button>
        <button type="submit" class="btn-admin primary btn-sm" data-rev-submit-btn="1">Lưu phản hồi</button>
      </div>
    </form>
  `;
}

function syncReviewProductFilterOptions(allReviews) {
  const select = document.getElementById("revProductFilter");
  if (!select) return;
  const prev = select.value || reviewFilterProduct || "all";
  const prodMap = new Map(products.map((p) => [p.id, p.name]));
  const idsInReviews = Array.from(new Set(allReviews.map((r) => r.productId).filter(Boolean)));
  const optionsHtml = ['<option value="all">Tất cả sản phẩm</option>']
    .concat(
      idsInReviews.map((pid) => {
        const label = prodMap.get(pid) ? `${prodMap.get(pid)} (${pid})` : pid;
        return `<option value="${escapeHtml(pid)}">${escapeHtml(label)}</option>`;
      })
    )
    .join("");
  select.innerHTML = optionsHtml;
  if (idsInReviews.includes(prev) || prev === "all") {
    select.value = prev;
  } else {
    select.value = "all";
    reviewFilterProduct = "all";
  }
}

function renderAdminReviews() {
  const listEl = document.getElementById("adminReviewsList");
  if (!listEl) return;

  const currentUser = getCurrentUser();
  const hasManagePerm = canManageReviews(currentUser);
  const allReviews = getAllReviewsList();

  syncReviewProductFilterOptions(allReviews);

  const verifiedReviews = allReviews.filter((r) => r.verifiedPurchase);
  const unverifiedCount = allReviews.length - verifiedReviews.length;
  const totalReviews = verifiedReviews.length;
  const avgStars = totalReviews
    ? (verifiedReviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / totalReviews).toFixed(1)
    : "0.0";
  const unrepliedCount = allReviews.filter((r) => !r.adminReply).length;
  const totalComments = allReviews.reduce((sum, r) => sum + (Array.isArray(r.comments) ? r.comments.length : 0), 0);
  const verifiedCount = verifiedReviews.length;

  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  setText("revKpiTotal", String(totalReviews));
  setText("revKpiAvg", totalReviews > 0 ? `Trung bình xác minh: ${avgStars} / 5 sao` : "Chưa có đánh giá hợp lệ");
  setText("revKpiUnreplied", String(unrepliedCount));
  setText("revKpiComments", String(totalComments));
  setText("revKpiVerified", `${verifiedCount}${unverifiedCount > 0 ? ` (${unverifiedCount} chờ rà soát)` : ""}`);

  const badgeEl = document.getElementById("badgeReviewsUnreplied");
  if (badgeEl) {
    if (unrepliedCount > 0) {
      badgeEl.textContent = String(unrepliedCount);
      badgeEl.style.display = "inline-flex";
    } else {
      badgeEl.style.display = "none";
    }
  }

  if (!hasManagePerm) {
    listEl.innerHTML = `
      <div class="admin-reviews-empty">
        <p style="margin:0; font-weight:700; color:#dc2626;">Tài khoản hiện tại không có quyền quản lý đánh giá &amp; bình luận.</p>
      </div>
    `;
    return;
  }

  const productMap = new Map(products.map((p) => [p.id, p]));
  const query = reviewFilterQuery.trim().toLowerCase();

  const filtered = allReviews.filter((r) => {
    if (reviewFilterProduct !== "all" && r.productId !== reviewFilterProduct) return false;
    if (reviewFilterStar !== "all" && Number(r.rating) !== Number(reviewFilterStar)) return false;
    if (reviewFilterReply === "unreplied" && Boolean(r.adminReply)) return false;
    if (reviewFilterReply === "replied" && !r.adminReply) return false;
    if (reviewFilterReply === "unverified" && r.verifiedPurchase) return false;
    if (query) {
      const prod = productMap.get(r.productId);
      const commentTexts = (r.comments || []).map((c) => `${c.authorName || ""} ${c.content || ""}`).join(" ");
      const haystack = [
        r.authorName,
        r.userId,
        r.orderId,
        r.productId,
        prod ? prod.name : "",
        r.comment,
        commentTexts
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="admin-reviews-empty">
        <div style="margin-bottom: 10px; color: #94a3b8;">${renderIcon("message-square-off", { size: 36, strokeWidth: 1.8 })}</div>
        <h3 style="margin: 0 0 6px; font-size: 16px; color: #1e293b;">Chưa có đánh giá phù hợp</h3>
        <p style="margin: 0; font-size: 13.5px;">
          ${totalReviews === 0
            ? "Hệ thống chỉ hiển thị đánh giá thật từ khách hàng đã mua hàng thành công."
            : "Không có đánh giá hoặc bình luận nào khớp với bộ lọc hiện tại."}
        </p>
      </div>
    `;
    initIcons();
    return;
  }

  listEl.innerHTML = filtered
    .map((rev) => {
      const prod = productMap.get(rev.productId);
      const prodName = prod ? prod.name : `Sản phẩm ${rev.productId}`;
      const isReplyingReview =
        activeReviewReplyTarget &&
        activeReviewReplyTarget.productId === rev.productId &&
        activeReviewReplyTarget.reviewId === rev.id &&
        activeReviewReplyTarget.targetType === "review";

      const comments = Array.isArray(rev.comments) ? rev.comments : [];
      const commentsHtml = comments.length
        ? `
          <div class="admin-comments-thread">
            <div style="font-size: 12.5px; font-weight: 700; color: #475569;">
              Bình luận thảo luận (${comments.length})
            </div>
            ${comments
              .map((cmt) => {
                const isReplyingCmt =
                  activeReviewReplyTarget &&
                  activeReviewReplyTarget.productId === rev.productId &&
                  activeReviewReplyTarget.reviewId === rev.id &&
                  activeReviewReplyTarget.targetType === "comment" &&
                  activeReviewReplyTarget.targetId === cmt.id;
                const roleTag = cmt.isGuest
                  ? `<span class="admin-review-badge-order">Khách chưa đăng nhập</span>`
                  : `<span class="admin-review-badge-order">Tài khoản: ${escapeHtml(cmt.userId || "")}</span>`;
                return `
                  <div class="admin-comment-item">
                    <div class="admin-comment-item-head">
                      <div>
                        <strong>${escapeHtml(cmt.authorName || "Khách ghé thăm")}</strong>
                        ${roleTag}
                      </div>
                      <span style="color: #64748b;">${escapeHtml(formatDateTime(cmt.createdAt || cmt.date))}</span>
                    </div>
                    <p class="admin-comment-item-body">${escapeHtml(cmt.content)}</p>
                    <div class="admin-review-actions" style="margin-top: 8px;">
                      <button type="button" class="btn-admin secondary btn-sm"
                        data-rev-action="open-reply"
                        data-product-id="${escapeHtml(rev.productId)}"
                        data-review-id="${escapeHtml(rev.id)}"
                        data-target-type="comment"
                        data-target-id="${escapeHtml(cmt.id)}">
                        ${cmt.adminReply ? "Sửa EcoDesk phản hồi" : "Phản hồi bình luận"}
                      </button>
                      <button type="button" class="btn-admin danger btn-sm"
                        data-rev-action="ask-delete-comment"
                        data-product-id="${escapeHtml(rev.productId)}"
                        data-review-id="${escapeHtml(rev.id)}"
                        data-target-id="${escapeHtml(cmt.id)}">
                        Xóa bình luận
                      </button>
                    </div>
                    ${renderAdminReplyBlock(cmt.adminReply, {
                      productId: rev.productId,
                      reviewId: rev.id,
                      targetType: "comment",
                      targetId: cmt.id
                    })}
                    ${
                      isReplyingCmt
                        ? renderInlineReplyForm({
                            productId: rev.productId,
                            reviewId: rev.id,
                            targetType: "comment",
                            targetId: cmt.id,
                            existingContent: cmt.adminReply?.content || "",
                            label: `Phản hồi bình luận của ${cmt.authorName || "Khách"}`
                          })
                        : ""
                    }
                  </div>
                `;
              })
              .join("")}
          </div>
        `
        : "";

      const avatarMarkup = rev.authorAvatar
        ? `<img src="${escapeHtml(rev.authorAvatar)}" alt="${escapeHtml(rev.authorName)}" class="admin-review-avatar">`
        : `<span class="admin-review-avatar-fallback">${escapeHtml(getReviewAuthorInitials(rev.authorName))}</span>`;

      return `
        <article class="admin-review-card" data-review-id="${escapeHtml(rev.id)}">
          <div class="admin-review-top">
            <div class="admin-review-author-wrap">
              ${avatarMarkup}
              <div>
                <div class="admin-review-author-line">
                  <strong style="font-size: 14.5px; color: #0f172a;">${escapeHtml(rev.authorName || "Khách hàng")}</strong>
                  ${
                    rev.verifiedPurchase
                      ? `<span class="admin-review-badge-verified">${renderIcon("badge-check", { size: 12, strokeWidth: 2.2 })} Đã mua hàng</span>`
                      : `<span class="admin-review-badge-unverified" style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:#fef3c7;color:#b45309;border:1px solid #fcd34d;">${renderIcon("alert-triangle", { size: 12, strokeWidth: 2.2 })} Cần rà soát: Chưa khớp đơn hoàn tất (Đang ẩn khỏi điểm SP)</span>`
                  }
                  ${
                    rev.orderId
                      ? `<span class="admin-review-badge-order">Đơn: ${escapeHtml(rev.orderId)}</span>`
                      : ""
                  }
                  ${
                    rev.userId
                      ? `<span class="admin-review-badge-order">UID: ${escapeHtml(rev.userId)}</span>`
                      : ""
                  }
                </div>
                <div class="admin-review-meta">Gửi lúc ${escapeHtml(formatDateTime(rev.createdAt || rev.date))}</div>
              </div>
            </div>
            <a href="./detail.html?id=${encodeURIComponent(rev.productId)}#reviewsSection" target="_blank" rel="noopener" class="admin-review-product-chip">
              ${renderIcon("package", { size: 14, strokeWidth: 2 })}
              <span>${escapeHtml(prodName)}</span>
            </a>
          </div>

          <div class="admin-review-stars">
            ${renderReviewStarIcons(rev.rating)}
            <span style="margin-left: 6px; color: #475569; font-size: 12.5px;">${Number(rev.rating) || 0}/5 sao</span>
          </div>

          <p class="admin-review-body">${escapeHtml(rev.comment)}</p>

          <div class="admin-review-actions">
            <button type="button" class="btn-admin primary btn-sm"
              data-rev-action="open-reply"
              data-product-id="${escapeHtml(rev.productId)}"
              data-review-id="${escapeHtml(rev.id)}"
              data-target-type="review"
              data-target-id="">
              ${rev.adminReply ? "Sửa EcoDesk phản hồi" : "Phản hồi đánh giá"}
            </button>
            <button type="button" class="btn-admin danger btn-sm"
              data-rev-action="ask-delete-review"
              data-product-id="${escapeHtml(rev.productId)}"
              data-review-id="${escapeHtml(rev.id)}">
              Xóa đánh giá
            </button>
          </div>

          ${renderAdminReplyBlock(rev.adminReply, {
            productId: rev.productId,
            reviewId: rev.id,
            targetType: "review",
            targetId: ""
          })}

          ${
            isReplyingReview
              ? renderInlineReplyForm({
                  productId: rev.productId,
                  reviewId: rev.id,
                  targetType: "review",
                  targetId: "",
                  existingContent: rev.adminReply?.content || "",
                  label: `EcoDesk phản hồi đánh giá của ${rev.authorName || "Khách hàng"}`
                })
              : ""
          }

          ${commentsHtml}
        </article>
      `;
    })
    .join("");

  initIcons();
}

function openReviewDeleteModal({ actionType, productId, reviewId, targetType = "", targetId = "", title, message, preview, showReason = true }) {
  const backdrop = document.getElementById("reviewDeleteConfirmBackdrop");
  const titleEl = document.getElementById("reviewDeleteConfirmTitle");
  const msgEl = document.getElementById("reviewDeleteConfirmMessage");
  const prevEl = document.getElementById("reviewDeleteTargetPreview");
  const reasonWrap = document.getElementById("reviewDeleteReasonWrap");
  const reasonInput = document.getElementById("reviewDeleteReasonInput");
  if (!backdrop) return;

  pendingReviewDeleteAction = { actionType, productId, reviewId, targetType, targetId };
  if (titleEl) titleEl.textContent = title || "Xác nhận xóa";
  if (msgEl) msgEl.textContent = message || "Bạn có chắc muốn thực hiện thao tác này?";
  if (prevEl) prevEl.textContent = preview || "";
  if (reasonWrap) reasonWrap.style.display = showReason ? "grid" : "none";
  if (reasonInput) reasonInput.value = "";
  backdrop.classList.add("show");
}

function closeReviewDeleteModal() {
  const backdrop = document.getElementById("reviewDeleteConfirmBackdrop");
  if (backdrop) backdrop.classList.remove("show");
  pendingReviewDeleteAction = null;
}

function bindAdminReviews() {
  const searchInput = document.getElementById("revSearchInput");
  const prodSelect = document.getElementById("revProductFilter");
  const starSelect = document.getElementById("revStarFilter");
  const replySelect = document.getElementById("revReplyFilter");
  const refreshBtn = document.getElementById("btnRefreshReviews");
  const listEl = document.getElementById("adminReviewsList");

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      reviewFilterQuery = searchInput.value;
      renderAdminReviews();
    });
  }
  if (prodSelect) {
    prodSelect.addEventListener("change", () => {
      reviewFilterProduct = prodSelect.value;
      renderAdminReviews();
    });
  }
  if (starSelect) {
    starSelect.addEventListener("change", () => {
      reviewFilterStar = starSelect.value;
      renderAdminReviews();
    });
  }
  if (replySelect) {
    replySelect.addEventListener("change", () => {
      reviewFilterReply = replySelect.value;
      renderAdminReviews();
    });
  }
  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      refreshBtn.disabled = true;
      try {
        await syncReviewsFromDisk();
        products = getProducts();
        renderAdminReviews();
        renderProductsTable();
        showToast("Đã đồng bộ dữ liệu đánh giá & bình luận mới nhất.");
      } finally {
        refreshBtn.disabled = false;
      }
    });
  }

  if (listEl) {
    listEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-rev-action]");
      if (!btn) return;
      const action = btn.dataset.revAction;
      const productId = btn.dataset.productId || "";
      const reviewId = btn.dataset.reviewId || "";
      const targetType = btn.dataset.targetType || "review";
      const targetId = btn.dataset.targetId || "";

      if (action === "open-reply") {
        activeReviewReplyTarget = { productId, reviewId, targetType, targetId };
        renderAdminReviews();
        const form = listEl.querySelector("[data-rev-reply-form] textarea");
        if (form) form.focus();
        return;
      }

      if (action === "cancel-reply") {
        activeReviewReplyTarget = null;
        renderAdminReviews();
        return;
      }

      const rev = getAllReviewsList().find((item) => item.productId === productId && item.id === reviewId);

      if (action === "ask-delete-reply") {
        const replyText =
          targetType === "comment"
            ? rev?.comments?.find((c) => c.id === targetId)?.adminReply?.content || ""
            : rev?.adminReply?.content || "";
        openReviewDeleteModal({
          actionType: "delete-reply",
          productId,
          reviewId,
          targetType,
          targetId,
          title: "Xác nhận xóa phản hồi của EcoDesk",
          message: "Phản hồi chính thức này sẽ bị gỡ khỏi trang sản phẩm và cổng khách hàng.",
          preview: replyText || "Nội dung phản hồi",
          showReason: false
        });
        return;
      }

      if (action === "ask-delete-comment") {
        const cmt = rev?.comments?.find((c) => c.id === targetId);
        openReviewDeleteModal({
          actionType: "delete-comment",
          productId,
          reviewId,
          targetType: "comment",
          targetId,
          title: "Xác nhận xóa bình luận",
          message: "Bình luận này sẽ bị xóa vĩnh viễn khỏi luồng hiển thị sau khi xác nhận.",
          preview: cmt ? `${cmt.authorName}: "${cmt.content}"` : "Bình luận đã chọn",
          showReason: true
        });
        return;
      }

      if (action === "ask-delete-review") {
        openReviewDeleteModal({
          actionType: "delete-review",
          productId,
          reviewId,
          title: "Xác nhận xóa đánh giá sản phẩm",
          message: "Xóa đánh giá sẽ cập nhật lại điểm sao trung bình và số lượt đánh giá thực tế của sản phẩm.",
          preview: rev ? `${rev.authorName} (${rev.rating} sao): "${rev.comment}"` : "Đánh giá đã chọn",
          showReason: true
        });
      }
    });

    listEl.addEventListener("submit", async (e) => {
      const form = e.target.closest("[data-rev-reply-form]");
      if (!form) return;
      e.preventDefault();

      const submitBtn = form.querySelector("[data-rev-submit-btn]");
      const textarea = form.querySelector("textarea");
      const content = textarea ? textarea.value.trim() : "";
      if (!content) {
        showToast("Vui lòng nhập nội dung phản hồi.");
        return;
      }

      const productId = form.dataset.productId || "";
      const reviewId = form.dataset.reviewId || "";
      const targetType = form.dataset.targetType || "review";
      const targetId = form.dataset.targetId || "";

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Đang lưu...";
      }

      try {
        await saveAdminReply({
          productId,
          reviewId,
          targetType,
          targetId: targetId || null,
          content
        });
        activeReviewReplyTarget = null;
        renderAdminReviews();
        showToast("Đã lưu EcoDesk phản hồi.");
      } catch (err) {
        showToast(err?.message || "Không thể lưu phản hồi.");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Lưu phản hồi";
        }
      }
    });
  }

  const closeBtn = document.getElementById("reviewDeleteConfirmCloseBtn");
  const cancelBtn = document.getElementById("reviewDeleteConfirmCancelBtn");
  const confirmForm = document.getElementById("reviewDeleteConfirmForm");
  const confirmSubmitBtn = document.getElementById("reviewDeleteConfirmSubmitBtn");
  const backdrop = document.getElementById("reviewDeleteConfirmBackdrop");

  if (closeBtn) closeBtn.addEventListener("click", closeReviewDeleteModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeReviewDeleteModal);
  if (backdrop) {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeReviewDeleteModal();
    });
  }

  if (confirmForm) {
    confirmForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!pendingReviewDeleteAction) return;
      const reasonInput = document.getElementById("reviewDeleteReasonInput");
      const reason = reasonInput ? reasonInput.value.trim() : "";
      const action = pendingReviewDeleteAction;

      if (confirmSubmitBtn) {
        confirmSubmitBtn.disabled = true;
        confirmSubmitBtn.textContent = "Đang xóa...";
      }

      try {
        if (action.actionType === "delete-reply") {
          await deleteAdminReply({
            productId: action.productId,
            reviewId: action.reviewId,
            targetType: action.targetType,
            targetId: action.targetId || null
          });
          showToast("Đã xóa phản hồi của EcoDesk.");
        } else if (action.actionType === "delete-comment") {
          await deleteCommentByAdmin({
            productId: action.productId,
            reviewId: action.reviewId,
            commentId: action.targetId,
            reason
          });
          showToast("Đã xóa bình luận vi phạm.");
        } else if (action.actionType === "delete-review") {
          await deleteReviewByAdmin({
            productId: action.productId,
            reviewId: action.reviewId,
            reason
          });
          products = getProducts();
          renderProductsTable();
          showToast("Đã xóa đánh giá và cập nhật lại xếp hạng sao.");
        }
        closeReviewDeleteModal();
        renderAdminReviews();
      } catch (err) {
        showToast(err?.message || "Không thể xóa nội dung này.");
      } finally {
        if (confirmSubmitBtn) {
          confirmSubmitBtn.disabled = false;
          confirmSubmitBtn.textContent = "Xác nhận xóa";
        }
      }
    });
  }
}

async function start() {
  await initStore();
  try {
    await syncReviewsFromDisk();
  } catch {}

  const currentUser = await refreshCurrentUserSession() || getCurrentUser();
  if (!currentUser) {
    redirectToLogin({
      next: "./admin.html",
      notice: "Vui lòng đăng nhập để truy cập trang quản trị.",
      replace: true
    });
    return;
  }

  // Khách hàng thông thường hoặc tài khoản bị vô hiệu hóa không được phép truy cập trang quản trị
  if (
    currentUser.active === false ||
    currentUser.role === "customer" ||
    (currentUser.role !== "admin" && currentUser.role !== "staff" && currentUser.role !== "cashier")
  ) {
    sessionStorage.setItem(
      "ecodesk_auth_notice",
      currentUser.active === false
        ? "Tài khoản của bạn đã bị vô hiệu hóa."
        : "Tài khoản khách hàng không có quyền truy cập trang quản trị."
    );
    window.location.replace("./index.html");
    return;
  }

  products = getProducts();
  categories = getCategories();
  orders = getOrders();
  users = getUsers();

  try {
    const freshOrders = await fetchAllOrdersFromBackend();
    if (Array.isArray(freshOrders)) {
      orders = freshOrders;
    }
  } catch (e) {
    console.warn("Could not fetch fresh orders from backend:", e);
  }

  // Setup UI components
  setupNavigation();
  renderUserInfo();
  renderKPIs(currentTimeFilter);
  renderRevenueChart();
  renderOrderStatusChart();
  renderOverviewLists();

  // Populate tables & bind events
  renderOrdersTable();
  bindOrdersEvents();
  bindAdminSepayPanel();

  fillProductFilters();
  renderProductsTable();
  bindProductsEvents();

  renderCategoriesTable();
  bindCategoriesEvents();

  renderInventoryTable();
  bindInventoryEvents();

  renderCustomersTable();
  bindCustomersEvents();

  fillProductSelects();
  renderSchedules();
  bindSchedulesEvents();

  renderAdminReviews();
  bindAdminReviews();

  bindDashboardReport();
  bindFinanceReports();
  bindAdminChat();
  applyRBACPermissions(currentUser);

  if (window.location.hash === "#reviews" && canManageReviews(currentUser)) {
    switchTab("reviews");
  }

  // Chart filter toggles: Theo ngày, Theo tháng, Theo quý, Theo năm
  const dailyBtn = document.getElementById("chartFilterDaily");
  const monthlyBtn = document.getElementById("chartFilterMonthly");
  const quarterlyBtn = document.getElementById("chartFilterQuarterly");
  const yearlyBtn = document.getElementById("chartFilterYearly");
  const startDateInput = document.getElementById("revenueStartDate");
  const endDateInput = document.getElementById("revenueEndDate");
  const applyDateBtn = document.getElementById("revenueApplyDateBtn");
  const legToggleCur = document.getElementById("legendToggleCurrent");
  const legTogglePrev = document.getElementById("legendTogglePrevious");

  const setChartMode = (mode, activeBtn) => {
    chartViewMode = mode;
    chartCustomStartDate = "";
    chartCustomEndDate = "";
    if (startDateInput) startDateInput.value = "";
    if (endDateInput) endDateInput.value = "";
    [dailyBtn, monthlyBtn, quarterlyBtn, yearlyBtn].forEach((btn) => {
      if (btn) btn.classList.remove("active");
    });
    if (activeBtn) activeBtn.classList.add("active");
    renderRevenueChart();
  };

  if (dailyBtn) dailyBtn.addEventListener("click", () => setChartMode("daily", dailyBtn));
  if (monthlyBtn) monthlyBtn.addEventListener("click", () => setChartMode("monthly", monthlyBtn));
  if (quarterlyBtn) quarterlyBtn.addEventListener("click", () => setChartMode("quarterly", quarterlyBtn));
  if (yearlyBtn) yearlyBtn.addEventListener("click", () => setChartMode("yearly", yearlyBtn));

  if (applyDateBtn) {
    applyDateBtn.addEventListener("click", () => {
      const startVal = startDateInput ? startDateInput.value : "";
      const endVal = endDateInput ? endDateInput.value : "";
      if (!startVal || !endVal) {
        showToast("Vui lòng chọn đầy đủ ngày bắt đầu và kết thúc.");
        return;
      }
      if (startVal > endVal) {
        showToast("Ngày bắt đầu không được lớn hơn ngày kết thúc.");
        return;
      }
      chartCustomStartDate = startVal;
      chartCustomEndDate = endVal;
      [dailyBtn, monthlyBtn, quarterlyBtn, yearlyBtn].forEach((btn) => {
        if (btn) btn.classList.remove("active");
      });
      renderRevenueChart();
      showToast(`Đã lọc doanh thu từ ${startVal} đến ${endVal}.`);
    });
  }

  // Tương tác bật/tắt hiển thị từng chuỗi trên biểu đồ (Click legend)
  if (legToggleCur) {
    legToggleCur.addEventListener("click", () => {
      chartShowCurrentSeries = !chartShowCurrentSeries;
      renderRevenueChart();
    });
  }

  if (legTogglePrev) {
    legTogglePrev.addEventListener("click", () => {
      chartShowPreviousSeries = !chartShowPreviousSeries;
      renderRevenueChart();
    });
  }

  // Overview Time Filter dropdown
  const timeFilterSelect = document.getElementById("overviewTimeFilter");
  if (timeFilterSelect) {
    timeFilterSelect.addEventListener("change", (e) => {
      currentTimeFilter = e.target.value;
      renderKPIs(currentTimeFilter);
      renderRevenueChart();
    });
  }

  // Tự động đồng bộ thời gian thực khi có bất kỳ tài khoản khách hàng nào đặt đơn mới hoặc đánh giá mới
  window.addEventListener("storage", (e) => {
    if (
      e.key === "ecodesk_orders" ||
      e.key === "ecodesk_products" ||
      e.key === "ecodesk_users" ||
      e.key === REVIEWS_STORAGE_KEY
    ) {
      orders = getOrders();
      products = getProducts();
      users = getUsers();
      renderKPIs(currentTimeFilter);
      renderRevenueChart();
      renderOrderStatusChart();
      renderOverviewLists();
      renderOrdersTable();
      renderProductsTable();
      renderInventoryTable();
      renderCustomersTable();
      renderAdminReviews();
      initIcons();
    }
  });

  window.addEventListener(REVIEWS_EVENT, () => {
    products = getProducts();
    renderProductsTable();
    renderAdminReviews();
  });

  initIcons();

  // Xử lý action từ URL (action=add-product hoặc action=edit-product&id=...)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get("action");
    const editId = urlParams.get("id");
    if (action === "add-product") {
      switchTab("products");
      setTimeout(() => openProductModal(null, null), 150);
    } else if (action === "edit-product" && editId) {
      switchTab("products");
      setTimeout(() => openProductModal(null, editId), 150);
    }
  } catch (_) {}
}

start();
