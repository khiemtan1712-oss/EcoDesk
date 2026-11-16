import {
  getParam,
  showToast,
  formatCurrency,
  escapeHtml,
  renderRatingStars,
  resolveSafeNextUrl,
  buildAuthUrl,
  storeAuthRedirectState,
  PROVINCES
} from "./utils.js";
import { initIcons, renderIcon } from "./icons.js";
import {
  initStore,
  getCurrentUser,
  getUsers,
  getAccount,
  getActiveCoupons,
  getOrdersByUser,
  fetchUserOrders,
  logoutUser,
  updateUserProfile,
  getUserAddresses,
  addUserAddress,
  updateUserAddress,
  deleteUserAddress,
  setDefaultAddress,
  updateUserAvatar,
  updateUserPassword,
  isStrongPassword,
  getProducts,
  addToCart
} from "./storage.js";
import { getFavoriteIds, removeFavorite, updateHeaderWishlistBadge } from "./favorites.js";
import { getUserReviewActivity, getUserReviewableProducts, REVIEWS_EVENT, REVIEWS_STORAGE_KEY } from "./reviews.js";

const guestLoginLinkPre = document.getElementById("guestLoginLink");
const guestRegisterLinkPre = document.getElementById("guestRegisterLink");
const initialSafeNext =
  resolveSafeNextUrl(getParam("next")) ||
  (window.location.hash === "#wishlist" ? "./account.html#wishlist" : "./account.html");
if (guestLoginLinkPre) {
  guestLoginLinkPre.href = buildAuthUrl("./login.html", { next: initialSafeNext });
}
if (guestRegisterLinkPre) {
  guestRegisterLinkPre.href = buildAuthUrl("./register.html");
}

await initStore();

// Notice handler
const notice = sessionStorage.getItem("ecodesk_auth_notice");
if (notice) {
  sessionStorage.removeItem("ecodesk_auth_notice");
  showToast(notice);
}

// Elements
const guestView = document.getElementById("guestView");
const portalView = document.getElementById("authenticatedPortal");
const guestLoginLink = document.getElementById("guestLoginLink");
const guestRegisterLink = document.getElementById("guestRegisterLink");

// Current session
const session = getCurrentUser();
const account = session && (getAccount(session.id) || session);

// Check Authentication
if (!session) {
  if (guestView) guestView.hidden = false;
  if (portalView) portalView.hidden = true;

  const fallbackAccountTarget = window.location.hash === "#wishlist" ? "./account.html#wishlist" : "./account.html";
  const safeNext = resolveSafeNextUrl(getParam("next")) || fallbackAccountTarget;
  const guestAuthNotice = window.location.hash === "#wishlist"
    ? "Bạn cần đăng nhập để thêm sản phẩm vào yêu thích hoặc xem sản phẩm yêu thích."
    : "";
  if (guestLoginLink) {
    guestLoginLink.href = buildAuthUrl("./login.html", { next: safeNext });
    guestLoginLink.addEventListener("click", () => {
      storeAuthRedirectState({ next: safeNext, notice: guestAuthNotice });
    });
  }
  if (guestRegisterLink) {
    guestRegisterLink.href = buildAuthUrl("./register.html");
  }
} else {
  if (guestView) guestView.hidden = true;
  if (portalView) portalView.hidden = false;

  initPortal();
}

function initPortal() {
  setupHeroHeader();
  setupNavigationTabs();
  setupOverviewTab();
  setupProfileTab();
  setupAddressTab();
  setupRewardsTab();
  setupSecurityTab();
  setupAvatarUpload();
  setupChangePasswordForm();
  setupWishlistTab();
  setupReviewsTab();
}

/* ==========================================================================
   1. HERO HEADER
   ========================================================================== */
function setupHeroHeader() {
  const avatar = document.getElementById("userAvatar");
  const nameEl = document.getElementById("userDisplayName");
  const emailEl = document.getElementById("userDisplayEmail");
  const tierBadge = document.getElementById("userTierBadge");
  const adminBtn = document.getElementById("adminAreaBtn");
  const btnRemoveAvatar = document.getElementById("btnRemoveAvatar");

  const name = session.name || "Khách hàng";
  const initial = name.trim().charAt(name.trim().lastIndexOf(" ") + 1) || name.charAt(0) || "U";
  
  const allUsers = getUsers();
  const userRecord = allUsers.find((u) => String(u.id) === String(session.id)) || session;
  const avatarUrl = userRecord.avatar || session.avatar;

  if (avatar) {
    if (avatarUrl) {
      avatar.innerHTML = `<img src="${avatarUrl}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
      if (btnRemoveAvatar) btnRemoveAvatar.style.display = "inline-block";
    } else {
      avatar.textContent = initial.toUpperCase();
      if (btnRemoveAvatar) btnRemoveAvatar.style.display = "none";
    }
  }

  if (nameEl) nameEl.textContent = name;
  if (emailEl) emailEl.textContent = session.email || "";

  // Tier Badge
  const userOrders = getOrdersByUser(session);
  const completedOrders = userOrders.filter(o => o.status === "Hoàn thành");
  const dynamicSpend = completedOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const spend = dynamicSpend > 0 ? dynamicSpend : Number(account?.spendTotal || 0);
  const tier = spend >= 30000000 ? "Kim cương" : spend >= 10000000 ? "Vàng" : spend >= 3000000 ? "Bạc" : (account?.tier || "Đồng");

  if (tierBadge) {
    tierBadge.textContent = `Hạng ${tier}`;
    tierBadge.className = "account-tier-badge";
    if (tier === "Đồng") tierBadge.classList.add("badge-dong");
    else if (tier === "Bạc") tierBadge.classList.add("badge-bac");
    else if (tier === "Vàng") tierBadge.classList.add("badge-vang");
    else if (tier === "Kim cương") tierBadge.classList.add("badge-kimcuong");
  }

  // Admin button (only for staff or admin)
  if (adminBtn) {
    const isStaffOrAdmin = session.role === "admin" || session.role === "staff";
    adminBtn.hidden = !isStaffOrAdmin;
  }
}

/* ==========================================================================
   2. NAVIGATION TABS
   ========================================================================== */
function setupNavigationTabs() {
  const navBtns = document.querySelectorAll(".account-nav-btn[data-tab]");
  const panels = document.querySelectorAll(".account-tab-panel");

  function switchTab(tabId) {
    navBtns.forEach((btn) => {
      const isActive = btn.dataset.tab === tabId;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", String(isActive));
    });

    panels.forEach((panel) => {
      const isActive = panel.id === `panel-${tabId}`;
      panel.classList.toggle("active", isActive);
    });

    initIcons();
    window.scrollTo({ top: 120, behavior: "smooth" });
  }

  navBtns.forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  // Jump tab buttons (e.g., from overview to rewards)
  document.querySelectorAll("[data-jump-tab]").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.jumpTab));
  });

  // Logout Buttons
  const handleLogout = () => {
    logoutUser();
    showToast("Đã đăng xuất khỏi tài khoản.");
    setTimeout(() => {
      window.location.href = "./index.html";
    }, 500);
  };

  const sidebarLogout = document.getElementById("sidebarLogoutBtn");
  const securityLogout = document.getElementById("securityLogoutBtn");
  if (sidebarLogout) sidebarLogout.addEventListener("click", handleLogout);
  if (securityLogout) securityLogout.addEventListener("click", handleLogout);

  if (window.location.hash === "#wishlist") {
    switchTab("wishlist");
  }
}

/* ==========================================================================
   3. TAB TỔNG QUAN (OVERVIEW)
   ========================================================================== */
async function setupOverviewTab() {
  const totalOrdersEl = document.getElementById("overviewTotalOrders");
  const processingOrdersEl = document.getElementById("overviewProcessingOrders");
  const completedOrdersEl = document.getElementById("overviewCompletedOrders");
  const activeCouponsEl = document.getElementById("overviewActiveCoupons");
  const recentOrdersContainer = document.getElementById("recentOrdersContainer");
  const tierBlock = document.getElementById("overviewTierBlock");

  // Fetch latest orders from API and local storage
  await fetchUserOrders(session.id);
  const userOrders = getOrdersByUser(session);
  const activeCoupons = getActiveCoupons(session.id);

  // Update Stats
  if (totalOrdersEl) totalOrdersEl.textContent = userOrders.length;
  if (processingOrdersEl) {
    processingOrdersEl.textContent = userOrders.filter(
      (o) => o.status === "Chờ xác nhận" || o.status === "Đang xử lý" || o.status === "Đang giao"
    ).length;
  }
  if (completedOrdersEl) {
    completedOrdersEl.textContent = userOrders.filter((o) => o.status === "Hoàn thành").length;
  }
  if (activeCouponsEl) activeCouponsEl.textContent = activeCoupons.length;

  // Render Recent Orders
  if (recentOrdersContainer) {
    if (userOrders.length === 0) {
      recentOrdersContainer.innerHTML = `
        <div class="empty-box">
          <p>Bạn chưa có đơn hàng nào tại EcoDesk.</p>
          <a href="./products.html" class="btn" style="margin-top: 10px;">Khám phá sản phẩm ngay</a>
        </div>
      `;
    } else {
      const getStatusBadge = (status) => {
        const map = {
          "Chờ xác nhận": { class: "badge-pending", label: "Chờ xác nhận" },
          "Đang xử lý": { class: "badge-processing", label: "Đang xử lý" },
          "Đang giao": { class: "badge-shipping", label: "Đang giao" },
          "Hoàn thành": { class: "badge-completed", label: "Hoàn tất" },
          "Đã hủy": { class: "badge-cancelled", label: "Đã hủy" }
        };
        const item = map[status] || { class: "badge-pending", label: status || "Chờ xử lý" };
        return `<span class="order-badge ${item.class}">${item.label}</span>`;
      };

      const recent = userOrders.slice(0, 3);
      recentOrdersContainer.innerHTML = recent
        .map(
          (o) => `
        <div class="recent-order-item">
          <div class="recent-order-left">
            <span class="recent-order-id">Đơn hàng #${o.id}</span>
            <span class="recent-order-date">${o.createdAt ? new Date(o.createdAt).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" }) : "Vừa xong"}</span>
          </div>
          <div class="recent-order-right">
            <span class="recent-order-total">${formatCurrency(o.total || 0)}</span>
            ${getStatusBadge(o.status)}
            <a href="./customer-orders.html" class="btn-outline" style="padding: 6px 12px; font-size: 12px;">Xem chi tiết</a>
          </div>
        </div>
      `
        )
        .join("");
    }
  }

  // Render Tier Progress
  if (tierBlock) {
    renderTierProgress(tierBlock);
  }
}

function renderTierProgress(container) {
  const currentAccount = getAccount(session.id) || account || {};
  const userOrders = getOrdersByUser(session);
  const completedOrders = userOrders.filter(o => o.status === "Hoàn thành");
  const dynamicSpend = completedOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const spend = dynamicSpend > 0 ? dynamicSpend : Number(currentAccount.spendTotal || 0);
  const currentTier = spend >= 30000000 ? "Kim cương" : spend >= 10000000 ? "Vàng" : spend >= 3000000 ? "Bạc" : "Đồng";

  const thresholds = { "Đồng": 3000000, "Bạc": 10000000, "Vàng": 30000000, "Kim cương": Infinity };
  const nextTierMap = { "Đồng": "Bạc", "Bạc": "Vàng", "Vàng": "Kim cương", "Kim cương": null };

  const target = thresholds[currentTier];
  const nextTierName = nextTierMap[currentTier];
  const isMaxTier = currentTier === "Kim cương";

  if (isMaxTier) {
    container.innerHTML = `
      <div class="tier-progress-card">
        <div class="tier-progress-head">
          <div class="tier-name-large" style="display: flex; align-items: center; gap: 8px;">
            ${renderIcon("award", { size: 20, strokeWidth: 1.8 })} Hạng Kim cương (Cao nhất)
          </div>
          <div class="tier-spend-num">Đã tích lũy: ${formatCurrency(spend)}</div>
        </div>
        <p style="font-size: 14px; color: var(--co-primary); font-weight: 600; line-height: 1.5; margin-top: 8px; display: flex; align-items: flex-start; gap: 8px;">
          <span style="flex-shrink: 0; margin-top: 2px;">${renderIcon("sparkles", { size: 16, strokeWidth: 1.8 })}</span>
          <span>Xin chúc mừng! Quý khách đã đạt hạng thành viên cao nhất tại EcoDesk Studio. Quý khách được hưởng chiết khấu ưu đãi 10% trọn đời và đặc quyền chăm sóc ưu tiên 24/7!</span>
        </p>
      </div>
    `;
    return;
  }

  const remaining = Math.max(0, target - spend);
  const percent = Math.min(100, Math.round((spend / target) * 100));

  container.innerHTML = `
    <div class="tier-progress-card">
      <div class="tier-progress-head">
        <div class="tier-name-large">Hạng ${currentTier}</div>
        <div class="tier-spend-num">Chi tiêu: <strong>${formatCurrency(spend)}</strong> / ${formatCurrency(target)}</div>
      </div>
      <div class="tier-progress-bar-wrap" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">
        <div class="tier-progress-bar-fill" style="width: ${percent}%;"></div>
      </div>
      <div class="tier-progress-note">
        Còn <strong>${formatCurrency(remaining)}</strong> để nâng hạng thành viên lên <strong>Hạng ${nextTierName}</strong> và mở khóa ưu đãi cao hơn.
      </div>
    </div>
  `;
}

/* ==========================================================================
   4. TAB THÔNG TIN CÁ NHÂN (PROFILE)
   ========================================================================== */
function setupProfileTab() {
  const viewMode = document.getElementById("profileViewMode");
  const editForm = document.getElementById("profileEditForm");
  const toggleBtn = document.getElementById("btnToggleEditProfile");
  const cancelBtn = document.getElementById("btnCancelEditProfile");

  const nameVal = document.getElementById("profileViewName");
  const emailVal = document.getElementById("profileViewEmail").querySelector("span");
  const phoneVal = document.getElementById("profileViewPhone");
  const roleVal = document.getElementById("profileViewRole");

  const editName = document.getElementById("editProfileName");
  const editPhone = document.getElementById("editProfilePhone");
  const editEmail = document.getElementById("editProfileEmail");

  function refreshView() {
    const cur = getAccount(session.id) || getCurrentUser();
    if (nameVal) nameVal.textContent = cur.name || "Khách hàng";
    if (emailVal) emailVal.textContent = cur.email || "";
    if (phoneVal) phoneVal.textContent = cur.phone || "Chưa cập nhật";
    if (roleVal) {
      const roleMap = { admin: "Quản trị viên", staff: "Nhân viên hỗ trợ", customer: "Khách hàng thân thiết" };
      roleVal.textContent = roleMap[cur.role] || "Khách hàng";
    }
  }

  refreshView();

  function showEdit() {
    const cur = getAccount(session.id) || getCurrentUser();
    if (editName) editName.value = cur.name || "";
    if (editPhone) editPhone.value = cur.phone || "";
    if (editEmail) editEmail.value = cur.email || "";

    viewMode.hidden = true;
    editForm.hidden = false;
    toggleBtn.hidden = true;
    editName.focus();
  }

  function hideEdit() {
    viewMode.hidden = false;
    editForm.hidden = true;
    toggleBtn.hidden = false;
  }

  if (toggleBtn) toggleBtn.addEventListener("click", showEdit);
  if (cancelBtn) cancelBtn.addEventListener("click", hideEdit);

  if (editForm) {
    editForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const newName = editName.value.trim();
      const newPhone = editPhone.value.trim();

      if (!newName || newName.length < 2) {
        showToast("Họ và tên phải có ít nhất 2 ký tự.");
        editName.focus();
        return;
      }

      if (newPhone && !/^(0|\+84)[0-9]{9,10}$/.test(newPhone.replace(/\s+/g, ""))) {
        showToast("Số điện thoại không đúng định dạng (Ví dụ: 0901234567).");
        editPhone.focus();
        return;
      }

      const saveBtn = document.getElementById("btnSaveProfile");
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = "Đang lưu...";
      }

      try {
        await updateUserProfile(session.id, {
          name: newName,
          phone: newPhone
        });

        showToast("Đã lưu thông tin cá nhân thành công!");
        setupHeroHeader();
        refreshView();
        hideEdit();
      } catch (err) {
        showToast(err.message || "Lỗi khi lưu thông tin.");
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = "Lưu thay đổi";
        }
      }
    });
  }
}

/* ==========================================================================
   5. TAB SỔ ĐỊA CHỈ (ADDRESS BOOK)
   ========================================================================== */
function setupAddressTab() {
  const container = document.getElementById("addressListContainer");
  const openModalBtn = document.getElementById("btnOpenAddAddressModal");
  const modal = document.getElementById("addressModal");
  const closeModalBtn = document.getElementById("closeAddressModalBtn");
  const cancelModalBtn = document.getElementById("btnCancelAddress");
  const form = document.getElementById("addressForm");
  const modalTitle = document.getElementById("addressModalTitle");
  const editIdInput = document.getElementById("addressEditId");
  const provinceSelect = document.getElementById("addressProvince");

  // Populate province dropdown
  if (provinceSelect && provinceSelect.options.length <= 1) {
    PROVINCES.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      provinceSelect.appendChild(opt);
    });
  }

  function openAddressModal(isEdit = false, addr = null) {
    if (!modal) return;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    if (isEdit && addr) {
      modalTitle.textContent = "Chỉnh sửa địa chỉ giao hàng";
      editIdInput.value = addr.id;
      document.getElementById("addressRecipientName").value = addr.name || "";
      document.getElementById("addressPhone").value = addr.phone || "";
      document.getElementById("addressProvince").value = addr.province || "";
      document.getElementById("addressDetail").value = addr.address || "";
      document.getElementById("addressIsDefault").checked = !!addr.isDefault;
    } else {
      modalTitle.textContent = "Thêm địa chỉ giao hàng mới";
      form.reset();
      editIdInput.value = "";
      const cur = getAccount(session.id) || session;
      document.getElementById("addressRecipientName").value = cur.name || "";
      document.getElementById("addressPhone").value = cur.phone || "";
    }
  }

  function closeAddressModal() {
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    form.reset();
  }

  if (openModalBtn) openModalBtn.addEventListener("click", () => openAddressModal(false));
  if (closeModalBtn) closeModalBtn.addEventListener("click", closeAddressModal);
  if (cancelModalBtn) cancelModalBtn.addEventListener("click", closeAddressModal);
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeAddressModal();
    });
  }

  function renderAddresses() {
    if (!container) return;
    const addresses = getUserAddresses(session.id);

    if (addresses.length === 0) {
      container.innerHTML = `
        <div class="empty-box" style="grid-column: 1 / -1;">
          <p>Bạn chưa lưu địa chỉ nhận hàng nào.</p>
          <button type="button" class="btn" id="btnEmptyAddAddress" style="margin-top: 10px;">Thêm địa chỉ đầu tiên</button>
        </div>
      `;
      const emptyBtn = document.getElementById("btnEmptyAddAddress");
      if (emptyBtn) emptyBtn.addEventListener("click", () => openAddressModal(false));
      return;
    }

    container.innerHTML = addresses
      .map(
        (addr) => `
      <div class="address-card ${addr.isDefault ? "default" : ""}" data-addr-id="${addr.id}">
        <div>
          ${addr.isDefault ? `<span class="address-badge-default">Địa chỉ mặc định</span>` : ""}
          <div class="address-name">${addr.name}</div>
          <div class="address-phone">${addr.phone}</div>
          <div class="address-detail">${addr.address}, ${addr.province}</div>
        </div>
        <div class="address-actions">
          ${!addr.isDefault ? `<button type="button" class="address-btn-link" data-action="set-default" data-id="${addr.id}">Đặt làm mặc định</button>` : ""}
          <button type="button" class="address-btn-link" data-action="edit" data-id="${addr.id}">Chỉnh sửa</button>
          <button type="button" class="address-btn-link danger" data-action="delete" data-id="${addr.id}">Xóa</button>
        </div>
      </div>
    `
      )
      .join("");

    // Attach actions
    container.querySelectorAll("[data-action='set-default']").forEach((btn) => {
      btn.addEventListener("click", () => {
        setDefaultAddress(session.id, btn.dataset.id);
        showToast("Đã đặt địa chỉ mặc định.");
        renderAddresses();
      });
    });

    container.querySelectorAll("[data-action='edit']").forEach((btn) => {
      btn.addEventListener("click", () => {
        const addr = addresses.find((a) => a.id === btn.dataset.id);
        if (addr) openAddressModal(true, addr);
      });
    });

    container.querySelectorAll("[data-action='delete']").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (confirm("Bạn có chắc chắn muốn xóa địa chỉ giao hàng này không?")) {
          deleteUserAddress(session.id, btn.dataset.id);
          showToast("Đã xóa địa chỉ thành công.");
          renderAddresses();
        }
      });
    });
  }

  renderAddresses();

  // Handle Form Submit
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const editId = editIdInput.value;
      const data = {
        name: document.getElementById("addressRecipientName").value,
        phone: document.getElementById("addressPhone").value,
        province: document.getElementById("addressProvince").value,
        address: document.getElementById("addressDetail").value,
        isDefault: document.getElementById("addressIsDefault").checked
      };

      if (!data.name.trim() || !data.phone.trim() || !data.province || !data.address.trim()) {
        showToast("Vui lòng điền đầy đủ các trường bắt buộc.");
        return;
      }

      if (editId) {
        updateUserAddress(session.id, editId, data);
        showToast("Đã cập nhật địa chỉ giao hàng!");
      } else {
        addUserAddress(session.id, data);
        showToast("Đã thêm địa chỉ giao hàng mới!");
      }

      closeAddressModal();
      renderAddresses();
    });
  }
}

/* ==========================================================================
   6. TAB HẠNG THÀNH VIÊN & ƯU ĐÃI (REWARDS)
   ========================================================================== */
function setupRewardsTab() {
  const tierBlock = document.getElementById("rewardsTierFullBlock");
  const couponsContainer = document.getElementById("rewardsCouponsContainer");

  if (tierBlock) {
    renderTierProgress(tierBlock);
  }

  if (couponsContainer) {
    const coupons = getActiveCoupons(session.id);

    if (coupons.length === 0) {
      couponsContainer.innerHTML = `
        <div class="empty-box" style="grid-column: 1 / -1;">
          <p>Hiện tại bạn chưa có mã ưu đãi nào khả dụng.</p>
        </div>
      `;
      return;
    }

    couponsContainer.innerHTML = coupons
      .map(
        (coupon) => `
      <div class="coupon-ticket-card">
        <div class="coupon-ticket-info">
          <strong>${coupon.label} · Giảm ${coupon.percent}%</strong>
          <code>${coupon.code}</code>
          ${coupon.condition ? `<small style="margin-bottom: 4px;">${coupon.condition}</small>` : ""}
          <small>Hạn dùng: ${new Date(coupon.expiresAt).toLocaleDateString("vi-VN")}</small>
        </div>
        <button type="button" class="btn-copy-code" data-code="${coupon.code}">Sao chép mã</button>
      </div>
    `
      )
      .join("");

    couponsContainer.querySelectorAll(".btn-copy-code").forEach((btn) => {
      btn.addEventListener("click", () => {
        const code = btn.dataset.code;
        navigator.clipboard.writeText(code).then(() => {
          showToast(`Đã sao chép mã "${code}" vào bộ nhớ tạm!`);
        });
      });
    });
  }
}

/* ==========================================================================
   7. TAB BẢO MẬT (SECURITY)
   ========================================================================== */
function setupSecurityTab() {
  const emailVal = document.getElementById("securityEmailVal");
  if (emailVal) emailVal.textContent = session.email || "";
}

/* ==========================================================================
   8. XỬ LÝ ẢNH ĐẠI DIỆN (AVATAR)
   ========================================================================== */
function setupAvatarUpload() {
  const fileInput = document.getElementById("avatarFileInput");
  const avatarEl = document.getElementById("userAvatar");
  const btnRemove = document.getElementById("btnRemoveAvatar");

  fileInput?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast("Dung lượng ảnh vượt quá 2MB. Vui lòng chọn ảnh nhỏ hơn.");
      fileInput.value = "";
      return;
    }

    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      showToast("Định dạng ảnh không hợp lệ. Chỉ chấp nhận JPG, PNG hoặc WebP.");
      fileInput.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      try {
        await updateUserAvatar(session.id, dataUrl);
        session.avatar = dataUrl;
        if (avatarEl) {
          avatarEl.innerHTML = `<img src="${dataUrl}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        }
        if (btnRemove) btnRemove.style.display = "inline-block";
        showToast("Đã cập nhật ảnh đại diện thành công!");
      } catch (err) {
        showToast(err.message || "Không thể cập nhật ảnh đại diện.");
      }
    };
    reader.readAsDataURL(file);
  });

  btnRemove?.addEventListener("click", async () => {
    if (!confirm("Bạn có chắc chắn muốn gỡ ảnh đại diện và khôi phục mặc định?")) return;
    try {
      await updateUserAvatar(session.id, null);
      session.avatar = null;
      const initial = (session.name || "U").trim().charAt(0).toUpperCase();
      if (avatarEl) avatarEl.textContent = initial;
      if (btnRemove) btnRemove.style.display = "none";
      if (fileInput) fileInput.value = "";
      showToast("Đã gỡ ảnh đại diện.");
    } catch (err) {
      showToast(err.message || "Không thể gỡ ảnh đại diện.");
    }
  });
}

/* ==========================================================================
   9. ĐỔI MẬT KHẨU TÀI KHOẢN (CHANGE PASSWORD)
   ========================================================================== */
function setupChangePasswordForm() {
  const form = document.getElementById("changePasswordForm");
  const currentPwd = document.getElementById("changeCurrentPassword");
  const newPwd = document.getElementById("changeNewPassword");
  const confirmPwd = document.getElementById("changeConfirmPassword");
  const strengthLabel = document.getElementById("changeStrengthLabel");
  const errorEl = document.getElementById("changePasswordError");
  const submitBtn = document.getElementById("btnSubmitChangePassword");

  newPwd?.addEventListener("input", (e) => {
    const pwd = e.target.value;
    if (!strengthLabel) return;
    if (!pwd) {
      strengthLabel.textContent = "Chưa nhập";
      strengthLabel.style.color = "#64748b";
    } else if (isStrongPassword(pwd)) {
      strengthLabel.textContent = "Mạnh (Đạt yêu cầu)";
      strengthLabel.style.color = "#16a34a";
    } else {
      strengthLabel.textContent = "Yếu (Cần >= 8 ký tự, gồm chữ hoa, thường & số)";
      strengthLabel.style.color = "#dc2626";
    }
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (errorEl) errorEl.textContent = "";

    const cur = currentPwd?.value;
    const n = newPwd?.value;
    const c = confirmPwd?.value;

    if (!cur || !n || !c) {
      if (errorEl) errorEl.textContent = "Vui lòng nhập đầy đủ các trường.";
      return;
    }

    if (!isStrongPassword(n)) {
      if (errorEl) errorEl.textContent = "Mật khẩu mới phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường và chữ số.";
      return;
    }

    if (n !== c) {
      if (errorEl) errorEl.textContent = "Mật khẩu xác nhận không khớp.";
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Đang cập nhật...";
    }

    try {
      const res = await updateUserPassword(session.id, cur, n);
      showToast(res.message);
      form.reset();
      if (strengthLabel) {
        strengthLabel.textContent = "Chưa nhập";
        strengthLabel.style.color = "#64748b";
      }
    } catch (err) {
      if (errorEl) errorEl.textContent = err.message;
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Cập nhật mật khẩu";
      }
    }
  });
}

/* ==========================================================================
   10. TAB SẢN PHẨM YÊU THÍCH (WISHLIST)
   ========================================================================== */
function setupWishlistTab() {
  const container = document.getElementById("wishlistContainer");
  const navBadge = document.getElementById("accountWishlistNavBadge");
  if (!container) return;

  function renderWishlist() {
    const favIds = getFavoriteIds(session.id);
    if (navBadge) {
      navBadge.textContent = String(favIds.length);
      navBadge.style.display = favIds.length > 0 ? "inline-block" : "none";
    }

    if (favIds.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 48px 16px; background: #f8fafc; border-radius: 12px; border: 1px dashed #cbd5e1;">
          <div style="margin-bottom: 12px; display: flex; justify-content: center; color: #94a3b8;">${renderIcon("heart", { size: 48, strokeWidth: 1.5 })}</div>
          <h3 style="font-size: 1.1rem; font-weight: 700; color: #1e293b; margin-bottom: 6px;">Danh sách yêu thích trống</h3>
          <p style="font-size: 14px; color: #64748b; margin-bottom: 20px;">Hãy dạo một vòng cửa hàng và bấm biểu tượng trái tim để lưu lại những sản phẩm ưng ý nhất.</p>
          <a href="./products.html" class="btn">Khám phá sản phẩm ngay</a>
        </div>
      `;
      return;
    }

    const allProducts = getProducts();
    const items = favIds.map((id) => {
      const prod = allProducts.find((p) => String(p.id) === String(id));
      return { id, product: prod };
    });

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px;">
        ${items.map(({ id, product }) => {
          if (!product) {
            return `
              <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; background: #fafafa; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                  <span style="display: inline-block; background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; margin-bottom: 8px;">Ngừng kinh doanh / Đã xóa</span>
                  <div style="font-size: 13px; color: #64748b;">Mã sản phẩm: ${id}</div>
                  <p style="font-size: 13px; color: #475569; margin-top: 6px;">Sản phẩm này hiện không còn trên hệ thống.</p>
                </div>
                <button type="button" class="btn-outline btn-remove-wishlist" data-id="${id}" style="margin-top: 12px; color: #dc2626; border-color: #fca5a5; font-size: 12px;">Xóa khỏi yêu thích</button>
              </div>
            `;
          }

          const isOutOfStock = Number(product.stock || 0) <= 0;
          return `
            <div style="border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; background: #fff; display: flex; flex-direction: column; transition: box-shadow 0.2s;" onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.08)'" onmouseout="this.style.boxShadow='none'">
              <a href="./detail.html?id=${product.id}" style="position: relative; display: block; aspect-ratio: 4/3; background: #f8fafc; overflow: hidden;">
                <img src="${product.image || './images/placeholder.jpg'}" alt="${product.name}" style="width: 100%; height: 100%; object-fit: contain; padding: 8px;">
                ${isOutOfStock ? `<span style="position: absolute; top: 8px; left: 8px; background: rgba(0,0,0,0.7); color: #fff; font-size: 11px; padding: 3px 8px; border-radius: 4px; font-weight: 700;">Hết hàng</span>` : ''}
              </a>
              <div style="padding: 14px; display: flex; flex-direction: column; flex: 1;">
                <a href="./detail.html?id=${product.id}" style="font-weight: 700; font-size: 14px; color: #0f172a; text-decoration: none; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 8px;">
                  ${product.name}
                </a>
                <div style="font-size: 15px; font-weight: 800; color: #e11d48; margin-bottom: 12px;">
                  ${formatCurrency(product.price)}
                </div>
                <div style="margin-top: auto; display: flex; gap: 8px;">
                  <button type="button" class="btn btn-add-cart-wishlist" data-id="${product.id}" ${isOutOfStock ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} style="flex: 2; padding: 7px 10px; font-size: 12px;">
                    ${isOutOfStock ? 'Tạm hết' : 'Thêm giỏ'}
                  </button>
                  <button type="button" class="btn-outline btn-remove-wishlist" data-id="${product.id}" title="Bỏ yêu thích" aria-label="Bỏ yêu thích" style="flex: 1; padding: 7px; color: #dc2626; border-color: #fca5a5; font-size: 14px; display: flex; align-items: center; justify-content: center;">
                    ${renderIcon("trash-2", { size: 16 })}
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    container.querySelectorAll(".btn-remove-wishlist").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        await removeFavorite(id, session.id);
        renderWishlist();
        updateHeaderWishlistBadge();
        showToast("Đã xóa sản phẩm khỏi danh sách yêu thích.");
      });
    });

    container.querySelectorAll(".btn-add-cart-wishlist").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const prod = allProducts.find((p) => String(p.id) === String(id));
        if (prod) {
          addToCart(prod, 1);
          showToast(`Đã thêm "${prod.name}" vào giỏ hàng!`);
        }
      });
    });
    initIcons(container);
  }

  renderWishlist();

  window.addEventListener("ecodesk_favorites_updated", (e) => {
    if (String(e.detail.userId) === String(session.id)) {
      renderWishlist();
    }
  });

  initIcons();
}

/* ==========================================================================
   11. TAB ĐÁNH GIÁ & BÌNH LUẬN CỦA TÔI
   ========================================================================== */
function setupReviewsTab() {
  const container = document.getElementById("accountReviewsContainer");
  const navBadge = document.getElementById("accountReviewsNavBadge");
  if (!container) return;

  function renderMyReviews() {
    const pendingItems = getUserReviewableProducts(session);
    const { reviews, comments } = getUserReviewActivity(session.id);

    if (navBadge) {
      const totalCount = pendingItems.length > 0 ? pendingItems.length : reviews.length;
      navBadge.textContent = String(totalCount);
      navBadge.style.display = totalCount > 0 ? "inline-block" : "none";
      navBadge.style.background = pendingItems.length > 0 ? "#d97706" : "#1f7a5c";
    }

    const fmtDate = (iso) => {
      if (!iso) return "";
      const d = new Date(iso);
      return isNaN(d.getTime()) ? String(iso) : `${d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} · ${d.toLocaleDateString("vi-VN")}`;
    };

    const pendingHtml = pendingItems.length > 0 ? `
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
          ${renderIcon("star", { size: 16, strokeWidth: 2 })} Sản phẩm chờ bạn đánh giá (${pendingItems.length})
        </h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px;">
          ${pendingItems.map((item) => `
            <div style="border: 1px solid #fde68a; background: #fffbeb; border-radius: 10px; padding: 12px; display: flex; gap: 12px; align-items: center;">
              <img src="${escapeHtml(item.productImage)}" alt="${escapeHtml(item.productName)}" style="width: 52px; height: 52px; object-fit: contain; background: #fff; border-radius: 8px; border: 1px solid #f1f5f9; flex-shrink: 0;">
              <div style="min-width: 0; flex: 1;">
                <div style="font-size: 13px; font-weight: 700; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(item.productName)}</div>
                <div style="font-size: 11.5px; color: #64748b; margin-top: 2px;">Đơn hoàn tất #${escapeHtml(item.orderId)}</div>
                <a href="./detail.html?id=${encodeURIComponent(item.productId)}#reviewsSection" style="display:inline-flex; align-items:center; gap:4px; margin-top:6px; padding:4px 10px; border-radius:6px; background:#1f7a5c; color:#fff; font-size:11.5px; font-weight:700; text-decoration:none;">Viết đánh giá ngay</a>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    ` : "";

    const reviewsHtml = `
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 10px;">
          Đánh giá đã gửi (${reviews.length})
        </h3>
        ${reviews.length === 0 ? `
          <div style="text-align: center; padding: 28px 16px; background: #f8fafc; border-radius: 10px; border: 1px dashed #cbd5e1;">
            <p style="margin: 0; font-size: 13.5px; color: #64748b;">Bạn chưa gửi đánh giá sao cho sản phẩm nào.</p>
          </div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${reviews.map((r) => `
              <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; background: #fff;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap;">
                  <div style="display: flex; gap: 10px; align-items: center;">
                    ${r.product?.image ? `<img src="${escapeHtml(r.product.image)}" alt="${escapeHtml(r.product.name)}" style="width: 44px; height: 44px; object-fit: contain; background: #f8fafc; border-radius: 8px;">` : ""}
                    <div>
                      <a href="./detail.html?id=${encodeURIComponent(r.productId)}#reviewsSection" style="font-weight: 700; font-size: 14px; color: #0f172a; text-decoration: none;">${escapeHtml(r.product?.name || `Sản phẩm ${r.productId}`)}</a>
                      <div style="display: flex; align-items: center; gap: 8px; margin-top: 3px; flex-wrap: wrap;">
                        <span>${renderRatingStars(r.rating)}</span>
                        ${r.verifiedPurchase ? `<span style="font-size: 11px; font-weight: 700; color: #047857; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 1px 7px; border-radius: 999px;">Đã mua hàng</span>` : ""}
                      </div>
                    </div>
                  </div>
                  <span style="font-size: 12px; color: #94a3b8;">${escapeHtml(fmtDate(r.createdAt || r.date))}</span>
                </div>
                <p style="margin: 10px 0 0; font-size: 13.5px; color: #334155; line-height: 1.5;">${escapeHtml(r.comment)}</p>
                ${r.adminReply ? `
                  <div style="margin-top: 10px; padding: 10px 12px; border-radius: 8px; background: #f1f7f4; border-left: 3px solid #1f7a5c;">
                    <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; flex-wrap: wrap; gap: 6px;">
                      <strong style="color: #14533e;">EcoDesk phản hồi</strong>
                      <span style="color: #64748b;">${escapeHtml(r.adminReply.adminName)} · ${escapeHtml(fmtDate(r.adminReply.updatedAt || r.adminReply.createdAt))}</span>
                    </div>
                    <p style="margin: 0; font-size: 13px; color: #1e293b;">${escapeHtml(r.adminReply.content)}</p>
                  </div>
                ` : ""}
              </div>
            `).join("")}
          </div>
        `}
      </div>
    `;

    const commentsHtml = `
      <div>
        <h3 style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 10px;">
          Bình luận thảo luận (${comments.length})
        </h3>
        ${comments.length === 0 ? `
          <div style="text-align: center; padding: 24px 16px; background: #f8fafc; border-radius: 10px; border: 1px dashed #cbd5e1;">
            <p style="margin: 0; font-size: 13.5px; color: #64748b;">Bạn chưa gửi bình luận nào dưới các đánh giá sản phẩm.</p>
          </div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${comments.map((c) => `
              <div style="border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; background: #fff;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <a href="./detail.html?id=${encodeURIComponent(c.productId)}#reviewsSection" style="font-weight: 700; font-size: 13.5px; color: #0f172a; text-decoration: none;">${escapeHtml(c.product?.name || `Sản phẩm ${c.productId}`)}</a>
                  <span style="font-size: 11.5px; color: #94a3b8;">${escapeHtml(fmtDate(c.createdAt))}</span>
                </div>
                <div style="font-size: 12px; color: #64748b; margin-top: 3px;">Bình luận dưới đánh giá của <strong>${escapeHtml(c.reviewAuthorName)}</strong></div>
                <p style="margin: 6px 0 0; font-size: 13.5px; color: #334155;">${escapeHtml(c.content)}</p>
                ${c.adminReply ? `
                  <div style="margin-top: 8px; padding: 8px 12px; border-radius: 8px; background: #f1f7f4; border-left: 3px solid #1f7a5c;">
                    <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px;">
                      <strong style="color: #14533e;">EcoDesk phản hồi</strong>
                      <span style="color: #64748b;">${escapeHtml(c.adminReply.adminName)} · ${escapeHtml(fmtDate(c.adminReply.updatedAt || c.adminReply.createdAt))}</span>
                    </div>
                    <p style="margin: 0; font-size: 13px; color: #1e293b;">${escapeHtml(c.adminReply.content)}</p>
                  </div>
                ` : ""}
              </div>
            `).join("")}
          </div>
        `}
      </div>
    `;

    container.innerHTML = pendingHtml + reviewsHtml + commentsHtml;
    initIcons(container);
  }

  renderMyReviews();
  window.addEventListener(REVIEWS_EVENT, renderMyReviews);
  window.addEventListener("storage", (e) => {
    if (e.key === REVIEWS_STORAGE_KEY || e.key === "ecodesk_orders") {
      renderMyReviews();
    }
  });
}
