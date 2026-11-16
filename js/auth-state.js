import { initStore, getCurrentUser, getUsers, getActiveCoupons, logoutUser, getProducts } from "./storage.js";
import { initWishlistInteractions } from "./favorites.js";
import { initNotificationHeader } from "./notifications.js";
import { initCustomerChatWidget } from "./chat.js";
import {
  showToast,
  isAuthPagePath,
  buildAuthUrl,
  redirectToLogin,
  findProductByIdentifier,
  AUTH_NOTICE_KEY,
  AUTH_NOTICE_TYPE_KEY
} from "./utils.js";
import { initIcons } from "./icons.js";
import { updateControls } from "./interface.js";

await initStore();
const authAreas = [...document.querySelectorAll("[data-auth-area]")];
const currentUser = getCurrentUser();
const isAuthPage = isAuthPagePath(window.location.pathname);
const currentPathLower = String(window.location.pathname || "").toLowerCase();
const handlesAuthNoticeLocally =
  isAuthPage ||
  currentPathLower.endsWith("/account.html");

if (!handlesAuthNoticeLocally) {
  const pendingAuthNotice = sessionStorage.getItem(AUTH_NOTICE_KEY);
  if (pendingAuthNotice) {
    const isGuestPrompt = !currentUser && /^(Bạn cần đăng nhập|Vui lòng đăng nhập)/i.test(pendingAuthNotice.trim());
    sessionStorage.removeItem(AUTH_NOTICE_KEY);
    sessionStorage.removeItem(AUTH_NOTICE_TYPE_KEY);
    if (!isGuestPrompt) {
      window.setTimeout(() => showToast(pendingAuthNotice, 5200), 120);
    }
  }
}
if (currentUser) {
  const saleCoupons = getActiveCoupons(currentUser.id).filter((coupon) => coupon.campaignId);
  const seenKey = `ecodesk_notified_sales_${currentUser.id}`;
  const seen = new Set(JSON.parse(sessionStorage.getItem(seenKey) || "[]"));
  const unseen = saleCoupons.filter((coupon) => !seen.has(coupon.code));
  if (unseen.length) {
    unseen.forEach((coupon) => seen.add(coupon.code));
    sessionStorage.setItem(seenKey, JSON.stringify([...seen]));
    window.setTimeout(() => showToast(`Bạn có ${unseen.length} mã sale hôm nay dành riêng cho tài khoản. Xem mã, điều kiện và hạn dùng trong mục Tài khoản.`, 6500), 350);
  }
}

function createLink(className, href, text) {
  const link = document.createElement("a");
  link.className = className;
  link.href = href;
  link.textContent = text;
  return link;
}

function syncDrawerAuth(user) {
  const drawerAuth = document.querySelector("[data-drawer-auth]");
  if (!drawerAuth) return;
  if (!user) {
    const row = document.createElement("div");
    row.className = "drawer-auth-actions";
    row.append(
      createLink("btn-outline drawer-auth-btn", "./login.html", "Đăng nhập"),
      createLink("btn-primary drawer-auth-btn", "./register.html", "Đăng ký")
    );
    drawerAuth.replaceChildren(row);
    return;
  }
  const wrap = document.createElement("div");
  wrap.className = "drawer-user-box";
  const greeting = document.createElement("div");
  greeting.className = "drawer-user-greeting";
  greeting.textContent = `Xin chào, ${user.name || user.email || "Khách hàng"}`;
  const row = document.createElement("div");
  row.className = "drawer-auth-actions";
  row.append(createLink("btn-outline drawer-auth-btn", "./account.html", "Tài khoản"));
  if (user.role === "admin" || user.role === "staff") {
    row.append(createLink("btn-outline drawer-auth-btn", "./admin.html", "Quản lý"));
  }
  const logoutBtn = document.createElement("button");
  logoutBtn.type = "button";
  logoutBtn.className = "btn-outline drawer-auth-btn drawer-logout-btn";
  logoutBtn.textContent = "Đăng xuất";
  logoutBtn.addEventListener("click", () => {
    document.querySelector(".actions [data-auth-area] .logout-btn")?.click();
  });
  row.append(logoutBtn);
  wrap.append(greeting, row);
  drawerAuth.replaceChildren(wrap);
}

function renderGuest(area) {
  if (isAuthPage) {
    const isLoginScreen = currentPathLower.endsWith("/login.html") || currentPathLower === "/login";
    const switchTarget = isLoginScreen ? "./register.html" : "./login.html";
    const switchLabel = isLoginScreen ? "Đăng ký" : "Đăng nhập";
    area.replaceChildren(
      createLink("btn-outline auth-link", buildAuthUrl(switchTarget), switchLabel)
    );
    syncDrawerAuth(null);
    return;
  }
  area.replaceChildren(createLink("btn-outline auth-link account-link", "./account.html", "Tài khoản"));
  syncDrawerAuth(null);
}

function renderUser(area, user) {
  const accountLink = document.createElement("a");
  accountLink.className = "btn-outline auth-link account-link";
  accountLink.href = "./account.html";
  accountLink.textContent = "Tài khoản";

  const isStaffOrAdmin = user.role === "admin" || user.role === "staff";
  let adminLink = null;
  if (isStaffOrAdmin) {
    adminLink = document.createElement("a");
    adminLink.className = "btn-outline auth-link admin-link";
    adminLink.href = "./admin.html";
    adminLink.textContent = "Quản lý";
  }

  const fullUser = (getUsers() || []).find((u) => String(u.id) === String(user.id)) || user;
  const displayName = String(fullUser.name || user.name || fullUser.email || user.email || "Khách hàng").trim();
  const rawAvatar = fullUser.avatar || user.avatar;
  const avatarSrc = typeof rawAvatar === "string" ? rawAvatar.trim() : "";
  const fullGreeting = `Xin chào, ${displayName}`;

  const userChip = document.createElement("a");
  userChip.className = "user-pill user-greeting-chip";
  userChip.href = "./account.html";
  userChip.title = fullGreeting;
  userChip.setAttribute("aria-label", `${fullGreeting} — Tài khoản`);

  const avatarWrap = document.createElement("span");
  avatarWrap.className = "user-pill-avatar";
  avatarWrap.setAttribute("aria-hidden", "true");

  const renderAvatarFallback = () => {
    avatarWrap.classList.remove("has-photo");
    const icon = document.createElement("i");
    icon.dataset.lucide = "user-round";
    icon.className = "user-pill-avatar-icon";
    avatarWrap.replaceChildren(icon);
    initIcons(avatarWrap);
  };

  if (avatarSrc) {
    avatarWrap.classList.add("has-photo");
    const img = document.createElement("img");
    img.className = "user-pill-avatar-img";
    img.src = avatarSrc;
    img.alt = "";
    img.addEventListener("error", renderAvatarFallback, { once: true });
    avatarWrap.appendChild(img);
  } else {
    renderAvatarFallback();
  }

  const textWrap = document.createElement("span");
  textWrap.className = "user-pill-text";

  const greetingLine = document.createElement("span");
  greetingLine.className = "user-pill-greeting";
  greetingLine.textContent = "Xin chào";

  const nameLine = document.createElement("span");
  nameLine.className = "user-pill-name";
  nameLine.textContent = displayName;

  textWrap.append(greetingLine, nameLine);
  userChip.append(avatarWrap, textWrap);

  const logoutButton = document.createElement("button");
  logoutButton.className = "btn-outline auth-link logout-btn";
  logoutButton.type = "button";
  logoutButton.textContent = "Đăng xuất";
  logoutButton.addEventListener("click", () => {
    logoutUser();
    showToast("Đã đăng xuất.");
    window.setTimeout(() => {
      const current = window.location.pathname;
      if (
        current.includes("admin.html") || 
        current.includes("add.html") || 
        current.includes("edit.html") ||
        current.includes("checkout.html") ||
        current.includes("account.html") ||
        current.includes("customer-orders.html")
      ) {
        window.location.href = "./index.html";
      } else {
        window.location.reload();
      }
    }, 500);
  });

  const children = [accountLink];
  if (adminLink) children.push(adminLink);
  children.push(userChip, logoutButton);
  area.replaceChildren(...children);
  syncDrawerAuth(user);
}

function mountHeaderUtilities() {
  if (isAuthPage) return;
  const actionsEl = document.querySelector(".site-header .actions");
  if (!actionsEl) return;

  // 1. Wishlist Button (Standard Basic Rounded Lineal: Lucide 'heart')
  if (!document.getElementById("headerWishlistBtn")) {
    const wishLink = document.createElement("a");
    wishLink.id = "headerWishlistBtn";
    wishLink.className = "header-action-btn header-wishlist-btn with-icon";
    wishLink.href = "./account.html#wishlist";
    wishLink.title = "Sản phẩm yêu thích";
    wishLink.setAttribute("aria-label", "Sản phẩm yêu thích");
    wishLink.innerHTML = `
      <i data-lucide="heart" class="header-wishlist-icon"></i>
      <span id="wishlistCount" class="header-badge" style="display: none;">0</span>
      <span class="control-label">Yêu thích</span>
    `;
    wishLink.addEventListener("click", (e) => {
      if (!getCurrentUser()) {
        e.preventDefault();
        redirectToLogin({
          next: "./account.html#wishlist",
          notice: "Bạn cần đăng nhập để thêm sản phẩm vào yêu thích hoặc xem sản phẩm yêu thích."
        });
      }
    });
    
    const cartPill = actionsEl.querySelector(".cart-pill");
    if (cartPill) {
      actionsEl.insertBefore(wishLink, cartPill);
    } else {
      actionsEl.insertBefore(wishLink, actionsEl.firstChild);
    }
  }

  // 2. Notification Bell (Standard Basic Rounded Lineal: Lucide 'bell')
  if (!document.getElementById("notifBellBtn")) {
    const notifWrapper = document.createElement("div");
    notifWrapper.className = "header-notif-wrapper";
    notifWrapper.style.cssText = "position: relative; display: inline-flex; align-items: center;";
    notifWrapper.innerHTML = `
      <button type="button" id="notifBellBtn" class="header-action-btn header-notif-btn with-icon" title="Thông báo đơn hàng" aria-label="Thông báo đơn hàng" aria-expanded="false">
        <i data-lucide="bell"></i>
        <span id="notifCountBadge" class="header-badge" style="display: none;">0</span>
      </button>
      <div id="notifDropdown" class="notif-dropdown-popover" style="display: none; background: #ffffff; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.18); border: 1px solid #cbd5e1; z-index: 10000; overflow: hidden;">
      </div>
    `;
    const authArea = actionsEl.querySelector("[data-auth-area]");
    if (authArea) {
      actionsEl.insertBefore(notifWrapper, authArea);
    } else {
      actionsEl.appendChild(notifWrapper);
    }
  }

  initIcons(actionsEl);
}

function syncProductMegaMenuLabels() {
  const menuLinks = document.querySelectorAll('.product-mega a[href*="product="]');
  if (!menuLinks.length) return;
  const visibleProducts = getProducts().filter((p) => p && p.isHidden !== true);
  if (!visibleProducts.length) return;

  menuLinks.forEach((link) => {
    const rawHref = link.getAttribute("href");
    if (!rawHref) return;
    try {
      const parsed = new URL(rawHref, window.location.origin);
      const productId = parsed.searchParams.get("product");
      if (!productId) return;
      const matched = findProductByIdentifier(visibleProducts, productId);
      if (matched?.name) {
        link.textContent = matched.name;
        link.title = matched.name;
      }
    } catch {}
  });
}

mountHeaderUtilities();
syncProductMegaMenuLabels();
initWishlistInteractions();
if (!isAuthPage) {
  initNotificationHeader();
  initCustomerChatWidget();
}

window.addEventListener("storage", (event) => {
  if (!event.key || event.key.includes("ecodesk_products")) {
    syncProductMegaMenuLabels();
  }
});

authAreas.forEach((area) => {
  if (currentUser) {
    renderUser(area, currentUser);
  } else {
    renderGuest(area);
  }
});
updateControls();

if (!isAuthPage) {
  document.addEventListener("click", (event) => {
    const drawerWishLink = event.target.closest("[data-drawer-utilities] a[href*='account.html#wishlist']");
    if (drawerWishLink && !getCurrentUser()) {
      event.preventDefault();
      redirectToLogin({
        next: "./account.html#wishlist",
        notice: "Bạn cần đăng nhập để thêm sản phẩm vào yêu thích hoặc xem sản phẩm yêu thích."
      });
    }
  });
}
