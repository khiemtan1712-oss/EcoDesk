/**
 * EcoDesk Wishlist & Favorites Management
 * Quản lý danh sách sản phẩm yêu thích theo tài khoản người dùng
 */

import { getCurrentUser, getUsers, saveUsers, syncUsersToDisk } from "./storage.js";
import { showToast, redirectToLogin, AUTH_NOTICE_KEY } from "./utils.js";

const PENDING_FAVORITE_KEY = "ecodesk_pending_favorite";
const FAVORITES_EVENT = "ecodesk_favorites_updated";

/**
 * Lấy danh sách ID sản phẩm yêu thích của người dùng hiện tại
 * @param {string} [userId]
 * @returns {string[]}
 */
export function getFavoriteIds(userId = getCurrentUser()?.id) {
  if (!userId) return [];
  const user = getUsers().find((u) => String(u.id) === String(userId));
  if (user && Array.isArray(user.favorites)) {
    return [...user.favorites];
  }
  try {
    const local = JSON.parse(localStorage.getItem(`ecodesk_favorites_${userId}`) || "[]");
    return Array.isArray(local) ? local : [];
  } catch {
    return [];
  }
}

/**
 * Kiểm tra xem sản phẩm có trong danh sách yêu thích hay không
 * @param {string} productId 
 * @param {string} [userId] 
 * @returns {boolean}
 */
export function isFavorite(productId, userId = getCurrentUser()?.id) {
  if (!productId || !userId) return false;
  return getFavoriteIds(userId).includes(String(productId));
}

/**
 * Bật/tắt trạng thái yêu thích của sản phẩm
 * @param {string} productId 
 * @param {string} [userId] 
 * @returns {Promise<{ isFavorite: boolean, count: number, requiresAuth: boolean }>}
 */
export async function toggleFavorite(productId, userId = getCurrentUser()?.id) {
  if (!productId) return { isFavorite: false, count: 0, requiresAuth: false };

  // Chưa đăng nhập -> Lưu lại sản phẩm và yêu cầu đăng nhập
  if (!userId) {
    try {
      sessionStorage.setItem(PENDING_FAVORITE_KEY, String(productId));
    } catch {}
    return { isFavorite: false, count: 0, requiresAuth: true };
  }

  const pId = String(productId);
  let currentList = getFavoriteIds(userId);
  let isNowFav = false;

  if (currentList.includes(pId)) {
    currentList = currentList.filter((id) => id !== pId);
    isNowFav = false;
  } else {
    currentList.push(pId);
    isNowFav = true;
  }

  // Lưu cục bộ theo người dùng
  try {
    localStorage.setItem(`ecodesk_favorites_${userId}`, JSON.stringify(currentList));
  } catch {}

  // Lưu vào hồ sơ người dùng trong danh sách chung và đồng bộ
  const allUsers = getUsers();
  const userIndex = allUsers.findIndex((u) => String(u.id) === String(userId));
  if (userIndex !== -1) {
    allUsers[userIndex] = { ...allUsers[userIndex], favorites: currentList };
    saveUsers(allUsers);
    syncUsersToDisk(allUsers);
  }

  // Phát sự kiện cập nhật
  window.dispatchEvent(new CustomEvent(FAVORITES_EVENT, {
    detail: { userId, productId: pId, isFavorite: isNowFav, count: currentList.length }
  }));

  updateHeaderWishlistBadge(currentList.length);
  return { isFavorite: isNowFav, count: currentList.length, requiresAuth: false };
}

/**
 * Bỏ thích sản phẩm
 * @param {string} productId 
 * @param {string} [userId] 
 */
export async function removeFavorite(productId, userId = getCurrentUser()?.id) {
  if (!productId || !userId) return;
  const pId = String(productId);
  let currentList = getFavoriteIds(userId).filter((id) => id !== pId);

  try {
    localStorage.setItem(`ecodesk_favorites_${userId}`, JSON.stringify(currentList));
  } catch {}

  const allUsers = getUsers();
  const userIndex = allUsers.findIndex((u) => String(u.id) === String(userId));
  if (userIndex !== -1) {
    allUsers[userIndex] = { ...allUsers[userIndex], favorites: currentList };
    saveUsers(allUsers);
    syncUsersToDisk(allUsers);
  }

  window.dispatchEvent(new CustomEvent(FAVORITES_EVENT, {
    detail: { userId, productId: pId, isFavorite: false, count: currentList.length }
  }));

  updateHeaderWishlistBadge(currentList.length);
}

/**
 * Xử lý thêm sản phẩm yêu thích chờ sau khi người dùng đăng nhập thành công
 * @param {string} userId 
 */
export async function processPendingFavoriteAfterLogin(userId) {
  if (!userId) return;
  try {
    const pendingId = sessionStorage.getItem(PENDING_FAVORITE_KEY);
    if (pendingId) {
      sessionStorage.removeItem(PENDING_FAVORITE_KEY);
      if (isFavorite(pendingId, userId)) {
        updateHeaderWishlistBadge();
        sessionStorage.setItem(AUTH_NOTICE_KEY, "Sản phẩm đã nằm trong danh sách yêu thích của bạn.");
        return;
      }
      const res = await toggleFavorite(pendingId, userId);
      if (res.isFavorite) {
        sessionStorage.setItem(AUTH_NOTICE_KEY, "Đã lưu sản phẩm vào danh sách yêu thích của bạn!");
      }
    }
  } catch {}
}

/**
 * Đồng bộ trạng thái hiển thị của tất cả nút wishlist trên trang
 * @param {HTMLElement|Document} [container]
 */
export function syncWishlistButtons(container = document) {
  const user = getCurrentUser();
  const favIds = user ? getFavoriteIds(user.id) : [];
  container.querySelectorAll("[data-wishlist-btn]").forEach((btn) => {
    const id = btn.dataset.productId;
    const active = favIds.includes(String(id));
    btn.classList.toggle("is-active", active);
    btn.setAttribute("title", active ? "Bỏ yêu thích" : "Thêm vào danh sách yêu thích");
    btn.setAttribute("aria-label", active ? "Đã yêu thích" : "Thêm vào yêu thích");
    const svg = btn.querySelector("svg");
    if (svg) {
      svg.style.fill = active ? "#ef4444" : "none";
      svg.style.stroke = active ? "#ef4444" : "currentColor";
    }
  });
}

/**
 * Cập nhật số lượng trên icon Wishlist ở Header
 * @param {number} [count] 
 */
export function updateHeaderWishlistBadge(count) {
  const user = getCurrentUser();
  const finalCount = count !== undefined ? count : (user ? getFavoriteIds(user.id).length : 0);
  const badge = document.getElementById("wishlistCount");
  if (badge) {
    badge.textContent = String(finalCount);
    badge.style.display = finalCount > 0 ? "inline-flex" : "none";
  }
}

/**
 * Khởi tạo listener cho toàn bộ các nút yêu thích trên trang
 */
export function initWishlistInteractions() {
  updateHeaderWishlistBadge();

  // Lắng nghe click các nút wishlist
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-wishlist-btn]");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();

    const productId = btn.dataset.productId;
    if (!productId) return;

    btn.disabled = true;
    try {
      const user = getCurrentUser();
      const res = await toggleFavorite(productId, user?.id);

      if (res.requiresAuth) {
        redirectToLogin({
          next: `${window.location.pathname}${window.location.search}${window.location.hash}`,
          notice: "Bạn cần đăng nhập để thêm sản phẩm vào yêu thích hoặc xem sản phẩm yêu thích."
        });
        return;
      }

      // Cập nhật giao diện nút
      btn.classList.toggle("is-active", res.isFavorite);
      btn.setAttribute("title", res.isFavorite ? "Bỏ yêu thích" : "Thêm vào danh sách yêu thích");
      btn.setAttribute("aria-label", res.isFavorite ? "Đã yêu thích" : "Thêm vào yêu thích");
      
      const svg = btn.querySelector("svg");
      if (svg) {
        svg.style.fill = res.isFavorite ? "#ef4444" : "none";
        svg.style.stroke = res.isFavorite ? "#ef4444" : "currentColor";
      }

      showToast(res.isFavorite ? "Đã thêm vào danh sách yêu thích!" : "Đã bỏ khỏi danh sách yêu thích.");
    } catch (err) {
      console.error("Lỗi khi cập nhật yêu thích:", err);
      showToast("Không thể cập nhật danh sách yêu thích. Vui lòng thử lại.");
    } finally {
      btn.disabled = false;
    }
  });

  // Đồng bộ trạng thái khi có sự kiện
  window.addEventListener(FAVORITES_EVENT, (e) => {
    const { productId, isFavorite, count } = e.detail;
    updateHeaderWishlistBadge(count);

    document.querySelectorAll(`[data-wishlist-btn][data-product-id="${productId}"]`).forEach((btn) => {
      btn.classList.toggle("is-active", isFavorite);
      btn.setAttribute("title", isFavorite ? "Bỏ yêu thích" : "Thêm vào danh sách yêu thích");
      btn.setAttribute("aria-label", isFavorite ? "Đã yêu thích" : "Thêm vào yêu thích");
      const svg = btn.querySelector("svg");
      if (svg) {
        svg.style.fill = isFavorite ? "#ef4444" : "none";
        svg.style.stroke = isFavorite ? "#ef4444" : "currentColor";
      }
    });
  });

  // Khởi tạo trạng thái ban đầu của tất cả các nút
  syncWishlistButtons();
}

