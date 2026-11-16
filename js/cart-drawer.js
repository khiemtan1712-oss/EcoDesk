import { getCart, getProducts, updateCartItem, getCartCount } from "./storage.js";
import { formatPrice, escapeHtml, showToast, isAuthPagePath } from "./utils.js";
import { getPricing } from "./commerce.js";
import { renderIcon } from "./icons.js";

// 1. Kiểm tra trang quản trị / xác thực - Tuyệt đối không gắn hoặc tự bật ngăn giỏ hàng ở các trang này
const currentPath = window.location.pathname.toLowerCase();
const isAdminPage =
  currentPath.includes("admin.html") ||
  currentPath.includes("add.html") ||
  currentPath.includes("edit.html");
const isCartDrawerDisabled = isAdminPage || isAuthPagePath(currentPath);

let lastFocusedElement = null;
let savedBodyOverflow = "";
let pendingDeleteId = null;
let closeTransitionTimer = null;
let drawerStylesheetPromise = null;

function ensureDrawerStylesheet() {
  if (!document.getElementById("cartDrawerCriticalGuard")) {
    const guardStyle = document.createElement("style");
    guardStyle.id = "cartDrawerCriticalGuard";
    guardStyle.textContent =
      ".cart-drawer-overlay[hidden],.cart-drawer-overlay:not(.is-open):not(.is-closing){display:none !important;visibility:hidden !important;opacity:0 !important;pointer-events:none !important;}";
    document.head.append(guardStyle);
  }
  if (drawerStylesheetPromise) return drawerStylesheetPromise;
  const existing = document.querySelector('link[href*="cart-drawer.css"]');
  const link = existing || document.createElement("link");
  if (!existing) {
    link.rel = "stylesheet";
    link.href = new URL("../css/cart-drawer.css", import.meta.url).href;
    document.head.append(link);
  }
  drawerStylesheetPromise = new Promise((resolve) => {
    if (link.sheet) {
      resolve();
      return;
    }
    const done = () => resolve();
    link.addEventListener("load", done, { once: true });
    link.addEventListener("error", done, { once: true });
    window.setTimeout(done, 1500);
  });
  return drawerStylesheetPromise;
}

export function resetCartDrawerState() {
  if (closeTransitionTimer) {
    window.clearTimeout(closeTransitionTimer);
    closeTransitionTimer = null;
  }
  const overlay = document.getElementById("cartDrawerOverlay");
  if (overlay) {
    overlay.classList.remove("is-open", "is-closing");
    overlay.setAttribute("aria-hidden", "true");
    overlay.hidden = true;
  }
  if (document.body) {
    document.body.style.overflow = savedBodyOverflow || "";
  }
  pendingDeleteId = null;
}

if (!isCartDrawerDisabled) {
  initCartDrawer();
}

function initCartDrawer() {
  ensureDrawerStylesheet();

  // Khởi tạo khung DOM Drawer với thuộc tính hidden ngay từ đầu để tránh nháy khi CSS đang tải
  if (!document.getElementById("cartDrawerOverlay")) {
    const markup = `
      <div id="cartDrawerOverlay" class="cart-drawer-overlay" aria-hidden="true" hidden>
        <div class="cart-drawer-backdrop" id="cartDrawerBackdrop" tabindex="-1"></div>
        <div class="cart-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="cartDrawerTitle" id="cartDrawerPanel">
          <header class="cart-drawer-header">
            <div class="cart-drawer-title-wrap">
              <h2 class="cart-drawer-title" id="cartDrawerTitle">Giỏ hàng</h2>
              <span class="cart-drawer-badge" id="cartDrawerItemCount">0</span>
            </div>
            <button type="button" class="cart-drawer-close" id="cartDrawerCloseBtn" aria-label="Đóng giỏ hàng">${renderIcon("x", { size: 20, strokeWidth: 2 })}</button>
          </header>
          <div class="cart-drawer-body" id="cartDrawerBody">
            <div class="cart-drawer-loading">
              <div class="cart-drawer-spinner"></div>
              <span>Đang tải thông tin giỏ hàng...</span>
            </div>
          </div>
          <footer class="cart-drawer-footer" id="cartDrawerFooter">
            <div class="cart-drawer-subtotal-row">
              <span class="cart-drawer-subtotal-label">Tạm tính:</span>
              <span class="cart-drawer-subtotal-val" id="cartDrawerSubtotal">0₫</span>
            </div>
            <div class="cart-drawer-note">
              Đã bao gồm VAT nếu có • Phí vận chuyển và mã ưu đãi sẽ được tính tại bước thanh toán.
            </div>
            <div id="cartDrawerErrorAlert" class="cart-drawer-error-alert" style="display: none;"></div>
            <button type="button" class="cart-drawer-checkout-btn" id="cartDrawerCheckoutBtn">
              <span>Tiến hành thanh toán</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </button>
            <a href="./cart.html" class="cart-drawer-view-full" id="cartDrawerViewFullBtn">Xem giỏ hàng đầy đủ</a>
          </footer>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML("beforeend", markup);
  }

  resetCartDrawerState();
  bindDrawerEvents();
  syncAllCartCounts();
}

export async function openCartDrawer() {
  if (isCartDrawerDisabled) return;
  const overlay = document.getElementById("cartDrawerOverlay");
  if (!overlay) return;

  if (closeTransitionTimer) {
    window.clearTimeout(closeTransitionTimer);
    closeTransitionTimer = null;
  }

  await ensureDrawerStylesheet();

  lastFocusedElement = document.activeElement;
  if (!overlay.classList.contains("is-open")) {
    savedBodyOverflow = document.body.style.overflow;
  }
  document.body.style.overflow = "hidden";

  overlay.hidden = false;
  overlay.classList.remove("is-closing");
  // Ép reflow 1 khung để CSS transition mở trượt từ phải hoạt động mượt
  void overlay.offsetWidth;
  overlay.classList.add("is-open");
  overlay.setAttribute("aria-hidden", "false");

  renderCartDrawer();

  // Đặt focus vào nút đóng để hỗ trợ phím bấm / trợ năng
  window.setTimeout(() => {
    const closeBtn = document.getElementById("cartDrawerCloseBtn");
    if (closeBtn) closeBtn.focus();
  }, 100);
}

export function closeCartDrawer() {
  const overlay = document.getElementById("cartDrawerOverlay");
  if (!overlay || (!overlay.classList.contains("is-open") && overlay.hidden)) return;

  if (closeTransitionTimer) {
    window.clearTimeout(closeTransitionTimer);
    closeTransitionTimer = null;
  }

  overlay.classList.remove("is-open");
  overlay.classList.add("is-closing");
  overlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = savedBodyOverflow || "";
  pendingDeleteId = null;

  const finalizeClose = () => {
    if (!overlay.classList.contains("is-open")) {
      overlay.classList.remove("is-closing");
      overlay.hidden = true;
    }
    closeTransitionTimer = null;
  };
  closeTransitionTimer = window.setTimeout(finalizeClose, 340);

  if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
    try {
      lastFocusedElement.focus();
    } catch (_) {}
  }
}

export function syncAllCartCounts() {
  const count = getCartCount();
  const badges = document.querySelectorAll("#cartCount, .cart-pill strong, .cart-pill-count");
  badges.forEach((b) => {
    b.textContent = count;
  });

  // Nếu trong trang có .cart-pill mà chưa có thẻ strong, tự động tạo để hiển thị badge
  document.querySelectorAll(".cart-pill").forEach((pill) => {
    if (!pill.querySelector("#cartCount") && !pill.querySelector("strong")) {
      const strong = document.createElement("strong");
      strong.id = "cartCount";
      strong.textContent = count;
      pill.appendChild(strong);
    }
  });

  const drawerBadge = document.getElementById("cartDrawerItemCount");
  if (drawerBadge) drawerBadge.textContent = count;
}

export function renderCartDrawer() {
  const body = document.getElementById("cartDrawerBody");
  const footer = document.getElementById("cartDrawerFooter");
  const subtotalEl = document.getElementById("cartDrawerSubtotal");
  const checkoutBtn = document.getElementById("cartDrawerCheckoutBtn");
  const errorAlert = document.getElementById("cartDrawerErrorAlert");
  const badgeCountEl = document.getElementById("cartDrawerItemCount");

  if (!body) return;

  const cart = getCart();
  const products = getProducts();
  const totalCount = cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  if (badgeCountEl) badgeCountEl.textContent = totalCount;
  syncAllCartCounts();

  // Trường hợp Giỏ hàng trống
  if (cart.length === 0) {
    body.innerHTML = `
      <div class="cart-drawer-empty">
        <div class="cart-drawer-empty-icon" style="display:flex; justify-content:center; color:#94a3b8; margin-bottom:12px;">${renderIcon("shopping-bag", { size: 48, strokeWidth: 1.5 })}</div>
        <h3 class="cart-drawer-empty-title">Giỏ hàng của bạn đang trống</h3>
        <p class="cart-drawer-empty-desc">
          Hãy khám phá những giải pháp công thái học và phụ kiện setup cao cấp của EcoDesk.
        </p>
        <a href="./products.html" class="cart-drawer-empty-btn" id="cartDrawerContinueShoppingBtn">
          Khám phá sản phẩm
        </a>
      </div>
    `;
    if (footer) footer.style.display = "none";
    return;
  }

  if (footer) footer.style.display = "block";

  let subtotal = 0;
  let hasOutOfStock = false;
  let outOfStockMessages = [];

  const itemRowsHtml = cart.map((item, index) => {
    const product = products.find((p) => String(p.id) === String(item.productId));
    const itemKey = `${item.productId}_${item.variantId || "base"}`;

    if (!product) {
      return `
        <div class="cart-drawer-item">
          <div class="cart-drawer-item-thumb">
            <img src="./images/setup-ban-govi.png" alt="Sản phẩm không tồn tại">
          </div>
          <div class="cart-drawer-item-content">
            <h4 class="cart-drawer-item-title" style="color: #94a3b8;">Sản phẩm không còn kinh doanh</h4>
            <div class="cart-drawer-item-bottom">
              <button type="button" class="cart-drawer-item-remove" data-drawer-remove="${escapeHtml(itemKey)}" title="Xóa khỏi giỏ" style="display:inline-flex; align-items:center; gap:4px;">${renderIcon("trash-2", { size: 13, strokeWidth: 2 })} Xóa</button>
            </div>
          </div>
        </div>
      `;
    }

    let variant = null;
    if (item.variantId && Array.isArray(product.variants)) {
      variant = product.variants.find((v) => String(v.id) === String(item.variantId) || String(v.sku) === String(item.variantId));
    }

    const maxStock = variant ? Number(variant.stock) : Number(product.stock || 0);
    const basePrice = (variant && variant.price != null) ? Number(variant.price) : ((item.price != null && !isNaN(item.price)) ? Number(item.price) : Number(product.price));
    const pricing = getPricing({ ...product, price: basePrice }, new Date(), variant);

    const lineTotal = pricing.price * item.quantity;
    subtotal += lineTotal;

    const itemImg = item.image || (variant && variant.image) || product.image || "./images/setup-ban-govi.png";
    const variantDisplayName = item.variantName || (variant && variant.name) || "";

    const isSoldOut = maxStock <= 0;
    const isExceeded = item.quantity > maxStock && !isSoldOut;

    if (isSoldOut) {
      hasOutOfStock = true;
      outOfStockMessages.push(`"${product.name}${variantDisplayName ? ` (${variantDisplayName})` : ""}" đã hết hàng`);
    }

    const isConfirming = pendingDeleteId === itemKey;

    return `
      <article class="cart-drawer-item" data-item-key="${escapeHtml(itemKey)}">
        <a href="./detail.html?id=${escapeHtml(product.id)}" class="cart-drawer-item-thumb" title="${escapeHtml(product.name)}">
          <img src="${escapeHtml(itemImg)}" alt="${escapeHtml(product.name)}" loading="lazy">
        </a>
        <div class="cart-drawer-item-content">
          <div class="cart-drawer-item-head">
            <a href="./detail.html?id=${escapeHtml(product.id)}" class="cart-drawer-item-title" title="${escapeHtml(product.name)}">
              ${escapeHtml(product.name)}
            </a>
            <button type="button" class="cart-drawer-item-remove" data-drawer-remove-trigger="${escapeHtml(itemKey)}" aria-label="Xóa ${escapeHtml(product.name)}" title="Xóa sản phẩm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
          </div>

          ${variantDisplayName ? `
            <div class="cart-drawer-item-variant">
              ${escapeHtml(variantDisplayName)}
            </div>
          ` : ""}

          <div class="cart-drawer-item-bottom">
            <div class="cart-drawer-qty-wrap" role="group" aria-label="Điều chỉnh số lượng">
              <button type="button" class="cart-drawer-qty-btn minus" data-drawer-action="decrease" data-product-id="${escapeHtml(product.id)}" data-variant-id="${escapeHtml(item.variantId || "")}" ${item.quantity <= 1 ? "disabled" : ""} aria-label="Giảm 1">
                −
              </button>
              <span class="cart-drawer-qty-val" aria-live="polite">${item.quantity}</span>
              <button type="button" class="cart-drawer-qty-btn plus" data-drawer-action="increase" data-product-id="${escapeHtml(product.id)}" data-variant-id="${escapeHtml(item.variantId || "")}" ${item.quantity >= maxStock || isSoldOut ? "disabled" : ""} aria-label="Tăng 1">
                +
              </button>
            </div>

            <div class="cart-drawer-item-pricing">
              ${pricing.percent > 0 ? `
                <del class="cart-drawer-item-orig-price">${formatPrice(pricing.original * item.quantity)}</del>
              ` : ""}
              <span class="cart-drawer-item-price ${pricing.percent > 0 ? "is-sale" : ""}">
                ${formatPrice(lineTotal)}
              </span>
            </div>
          </div>

          ${isSoldOut ? `
            <div class="cart-drawer-item-warn">
              <span style="display:inline-flex; vertical-align:-2px; margin-right:4px;">${renderIcon("alert-triangle", { size: 14, strokeWidth: 2 })}</span> Mẫu này hiện đã hết hàng trong kho. Vui lòng xóa để thanh toán.
            </div>
          ` : isExceeded ? `
            <div class="cart-drawer-item-warn">
              <span style="display:inline-flex; vertical-align:-2px; margin-right:4px;">${renderIcon("alert-triangle", { size: 14, strokeWidth: 2 })}</span> Tồn kho chỉ còn ${maxStock} chiếc. Đã giới hạn số lượng.
            </div>
          ` : ""}

          ${isConfirming ? `
            <div class="cart-drawer-confirm-delete">
              <span>Xóa sản phẩm này khỏi giỏ?</span>
              <div class="cart-drawer-confirm-actions">
                <button type="button" class="cart-drawer-confirm-btn cancel" data-drawer-delete-cancel="${escapeHtml(itemKey)}">Hủy</button>
                <button type="button" class="cart-drawer-confirm-btn confirm" data-drawer-delete-confirm="${escapeHtml(itemKey)}" data-product-id="${escapeHtml(product.id)}" data-variant-id="${escapeHtml(item.variantId || "")}">Xóa</button>
              </div>
            </div>
          ` : ""}
        </div>
      </article>
    `;
  }).join("");

  body.innerHTML = `<div class="cart-drawer-list">${itemRowsHtml}</div>`;

  // Cập nhật tổng tiền
  if (subtotalEl) {
    subtotalEl.textContent = formatPrice(subtotal);
  }

  // Khóa thanh toán nếu có mặt hàng hết hàng
  if (hasOutOfStock) {
    if (checkoutBtn) {
      checkoutBtn.disabled = true;
      checkoutBtn.setAttribute("title", "Vui lòng xóa sản phẩm hết hàng để tiếp tục thanh toán");
    }
    if (errorAlert) {
      errorAlert.style.display = "flex";
      errorAlert.innerHTML = `<span style="display:inline-flex; align-items:center; gap:6px; flex-shrink:0;">${renderIcon("alert-triangle", { size: 16, strokeWidth: 1.8 })}</span> <span>${outOfStockMessages.join(", ")}. Quý khách vui lòng xóa khỏi giỏ để tiến hành thanh toán.</span>`;
    }
  } else {
    if (checkoutBtn) {
      checkoutBtn.disabled = false;
      checkoutBtn.removeAttribute("title");
    }
    if (errorAlert) {
      errorAlert.style.display = "none";
      errorAlert.innerHTML = "";
    }
  }
}

function bindDrawerEvents() {
  const overlay = document.getElementById("cartDrawerOverlay");
  const backdrop = document.getElementById("cartDrawerBackdrop");
  const closeBtn = document.getElementById("cartDrawerCloseBtn");
  const checkoutBtn = document.getElementById("cartDrawerCheckoutBtn");
  const viewFullBtn = document.getElementById("cartDrawerViewFullBtn");

  if (backdrop) backdrop.addEventListener("click", closeCartDrawer);
  if (closeBtn) closeBtn.addEventListener("click", closeCartDrawer);

  // Nhấn ESC để đóng
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay && overlay.classList.contains("is-open")) {
      closeCartDrawer();
    }
  });

  // Mở giỏ hàng khi bấm vào bất kỳ nút .cart-pill nào trên các trang
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest(".cart-pill, [data-open-cart]");
    if (trigger) {
      // Nếu đang ở chính trang cart.html, vẫn cho phép mở nhanh drawer hoặc điều hướng
      e.preventDefault();
      openCartDrawer();
    }
  });

  // Xử lý các thao tác bên trong Body của Drawer
  const body = document.getElementById("cartDrawerBody");
  if (body) {
    body.addEventListener("click", (e) => {
      // 1. Tăng / Giảm số lượng
      const qtyBtn = e.target.closest("[data-drawer-action]");
      if (qtyBtn) {
        const action = qtyBtn.dataset.drawerAction;
        const productId = qtyBtn.dataset.productId;
        const variantId = qtyBtn.dataset.variantId || null;

        const cart = getCart();
        const currentItem = cart.find((i) =>
          String(i.productId) === String(productId) &&
          String(i.variantId || "") === String(variantId || "")
        );

        if (currentItem) {
          const delta = action === "increase" ? 1 : -1;
          const targetQty = currentItem.quantity + delta;
          if (targetQty >= 1) {
            updateCartItem(productId, targetQty, variantId);
            renderCartDrawer();
            window.dispatchEvent(new CustomEvent("ecodesk-cart-updated"));
          }
        }
        return;
      }

      // 2. Bấm nút xóa -> Hiện xác nhận xóa inline (thân thiện, không dùng alert/confirm mặc định)
      const removeTrigger = e.target.closest("[data-drawer-remove-trigger]");
      if (removeTrigger) {
        pendingDeleteId = removeTrigger.dataset.drawerRemoveTrigger;
        renderCartDrawer();
        return;
      }

      // 3. Hủy xóa
      const cancelBtn = e.target.closest("[data-drawer-delete-cancel]");
      if (cancelBtn) {
        pendingDeleteId = null;
        renderCartDrawer();
        return;
      }

      // 4. Xác nhận xóa
      const confirmBtn = e.target.closest("[data-drawer-delete-confirm]");
      if (confirmBtn) {
        const productId = confirmBtn.dataset.productId;
        const variantId = confirmBtn.dataset.variantId || null;
        updateCartItem(productId, 0, variantId);
        pendingDeleteId = null;
        renderCartDrawer();
        showToast("Đã xóa sản phẩm khỏi giỏ hàng.");
        window.dispatchEvent(new CustomEvent("ecodesk-cart-updated"));
        return;
      }

      // 5. Nút tiếp tục mua sắm khi giỏ trống
      const continueBtn = e.target.closest("#cartDrawerContinueShoppingBtn");
      if (continueBtn) {
        closeCartDrawer();
      }
    });
  }

  // Nút Tiến hành thanh toán
  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", () => {
      const cart = getCart();
      const products = getProducts();

      if (cart.length === 0) {
        showToast("Giỏ hàng đang trống, vui lòng chọn sản phẩm.");
        return;
      }

      // Kiểm tra tồn kho trước khi chuyển sang checkout
      for (const item of cart) {
        const product = products.find((p) => String(p.id) === String(item.productId));
        if (!product) {
          showToast("Trong giỏ có sản phẩm không tồn tại. Vui lòng kiểm tra lại.");
          return;
        }
        let variant = null;
        if (item.variantId && Array.isArray(product.variants)) {
          variant = product.variants.find((v) => String(v.id) === String(item.variantId) || String(v.sku) === String(item.variantId));
        }
        const maxStock = variant ? Number(variant.stock) : Number(product.stock || 0);
        if (maxStock <= 0) {
          const name = variant ? `${product.name} (${variant.name})` : product.name;
          showToast(`Sản phẩm "${name}" hiện đã hết hàng. Vui lòng xóa khỏi giỏ để tiếp tục.`);
          renderCartDrawer();
          return;
        }
      }

      closeCartDrawer();
      window.location.href = "./checkout.html";
    });
  }

  // Nút Xem giỏ hàng đầy đủ
  if (viewFullBtn) {
    viewFullBtn.addEventListener("click", () => {
      closeCartDrawer();
    });
  }

  // Lắng nghe sự kiện đồng bộ từ các tab/trang khác hoặc từ thao tác thêm giỏ
  window.addEventListener("ecodesk-cart-updated", () => {
    syncAllCartCounts();
    if (overlay && overlay.classList.contains("is-open")) {
      renderCartDrawer();
    }
  });

  window.addEventListener("storage", (e) => {
    if (e.key && e.key.startsWith("ecodesk_cart")) {
      syncAllCartCounts();
      if (overlay && overlay.classList.contains("is-open")) {
        renderCartDrawer();
      }
    }
  });

  // Đóng và reset trạng thái giỏ hàng khi rời trang hoặc quay lại qua bfcache
  window.addEventListener("pagehide", resetCartDrawerState);
  window.addEventListener("pageshow", () => {
    resetCartDrawerState();
    syncAllCartCounts();
  });
}

// Gắn hàm mở ngăn giỏ vào window để các trang khác (ví dụ: detail.js sau khi thêm vào giỏ) có thể gọi trực tiếp
if (typeof window !== "undefined") {
  window.openEcoDeskCartDrawer = openCartDrawer;
  window.closeEcoDeskCartDrawer = closeCartDrawer;
  window.syncEcoDeskCartCounts = syncAllCartCounts;
}

