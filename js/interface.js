const stylesheet = document.createElement("link");
stylesheet.rel = "stylesheet";
stylesheet.href = new URL("../css/interface.css", import.meta.url).href;
document.head.append(stylesheet);
import "./assistant.js";
import "./scroll-reveal.js";
import "./search-modal.js";
import "./cart-drawer.js";
import { initIcons } from "./icons.js";
import { isAuthPagePath } from "./utils.js";

function refreshIcons() {
  initIcons(document);
}

function decorate(element, icon, compact = false) {
  if (element.querySelector("[data-lucide], .lucide")) return;
  const label = element.textContent.trim();
  const glyph = document.createElement("i");
  glyph.dataset.lucide = icon;
  const text = document.createElement("span");
  text.className = compact ? "control-label" : "";
  text.append(...element.childNodes);
  element.append(glyph, text);
  element.classList.add("with-icon");
  if (!element.title) element.title = label;
  if (!element.getAttribute("aria-label")) element.setAttribute("aria-label", label);
}

const header = document.querySelector(".header-inner");
const nav = header?.querySelector(".nav");
if (header && nav) {
  nav.id = "primary-navigation";
  nav.setAttribute("aria-label", "Điều hướng chính");
  if (!nav.querySelector("[data-drawer-utilities]")) {
    const drawerUtilities = document.createElement("div");
    drawerUtilities.className = "mobile-drawer-utilities";
    drawerUtilities.setAttribute("data-drawer-utilities", "");
    drawerUtilities.innerHTML = isAuthPagePath()
      ? `<div class="drawer-auth-slot" data-drawer-auth></div>`
      : `
      <div class="drawer-quick-links">
        <a class="drawer-utility-btn" href="./account.html#wishlist">
          <i data-lucide="heart"></i>
          <span>Sản phẩm yêu thích</span>
          <span class="drawer-badge" id="drawerWishlistCount" style="display:none;">0</span>
        </a>
        <button type="button" class="drawer-utility-btn" id="drawerNotifBtn">
          <i data-lucide="bell"></i>
          <span>Thông báo đơn hàng</span>
          <span class="drawer-badge" id="drawerNotifCount" style="display:none;">0</span>
        </button>
      </div>
      <div class="drawer-auth-slot" data-drawer-auth></div>
    `;
    nav.append(drawerUtilities);
  }
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "mobile-menu-toggle";
  toggle.setAttribute("aria-controls", nav.id);
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-label", "Mở menu");
  toggle.innerHTML = '<i data-lucide="menu"></i>';
  header.append(toggle);
  function closeMenu() {
    header.classList.remove("menu-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Mở menu");
  }
  toggle.addEventListener("click", () => {
    const open = header.classList.toggle("menu-open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Đóng menu" : "Mở menu");
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    closeMenu();
    const productsTrigger = nav.querySelector(".product-menu-trigger");
    productsTrigger?.parentElement.classList.remove("products-open");
    productsTrigger?.setAttribute("aria-expanded", "false");
  });
  document.addEventListener("click", (event) => { if (!header.contains(event.target)) closeMenu(); });
  const trigger = nav.querySelector(".product-menu-trigger");
  if (trigger) {
    const rawArrow = Array.from(trigger.querySelectorAll("span")).find((el) => el.textContent.trim() === "⌄" || el.classList.contains("menu-arrow"));
    if (rawArrow) {
      rawArrow.className = "menu-arrow";
      rawArrow.setAttribute("aria-hidden", "true");
      rawArrow.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3.5L5 6.5L8 3.5"/></svg>';
    }
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-haspopup", "true");
    const menuItem = trigger.parentElement;
    const setMenuOpen = (open) => {
      menuItem.classList.toggle("products-open", open);
      trigger.setAttribute("aria-expanded", String(open));
    };
    let closeTimer;
    menuItem.addEventListener("mouseenter", () => {
      window.clearTimeout(closeTimer);
      if (!window.matchMedia("(max-width: 1080px)").matches) setMenuOpen(true);
    });
    menuItem.addEventListener("mouseleave", () => {
      if (!window.matchMedia("(max-width: 1080px)").matches) {
        closeTimer = window.setTimeout(() => setMenuOpen(false), 350);
      }
    });
    menuItem.querySelector(".product-mega")?.addEventListener("mouseenter", () => {
      window.clearTimeout(closeTimer);
      setMenuOpen(true);
    });
    menuItem.addEventListener("focusin", () => {
      if (!window.matchMedia("(max-width: 1080px)").matches) setMenuOpen(true);
    });
    menuItem.addEventListener("focusout", (event) => {
      if (!menuItem.contains(event.relatedTarget) && !window.matchMedia("(max-width: 1080px)").matches) setMenuOpen(false);
    });
    trigger.addEventListener("click", (event) => {
      if (!window.matchMedia("(max-width: 1080px)").matches) return;
      event.preventDefault();
      setMenuOpen(!menuItem.classList.contains("products-open"));
    });
    document.addEventListener("click", (event) => {
      if (!menuItem.contains(event.target)) setMenuOpen(false);
    });
    nav.querySelectorAll(".product-mega a").forEach((link) => {
      link.addEventListener("click", () => setMenuOpen(false));
    });
  }
}

const icons = [
  [".nav > a[href*='index.html']", "house"],
  [".product-menu-trigger, .nav > a[href*='products.html']", "armchair"],
  [".nav > a[href*='customer-orders.html']", "package"],
  [".nav > a[href*='contact.html'], .nav > a[href*='payment-support.html']", "headset"],
  [".nav > a[href*='admin.html']", "settings-2"],
  [".header-search", "search", true],
  [".cart-pill", "shopping-bag", true],
  [".auth-link[href*='login.html']", "user-round", true],
  [".auth-link[href*='register.html']", "user-round-plus", true],
  [".auth-link.account-link", "user-round", true],
  ["button.auth-link", "log-out", true],
  [".hero-actions .btn", "arrow-up-right"],
  [".hero-actions .btn-outline", "sparkles"],
  [".section-head > a", "arrow-right"],
  [".category-btn", "layers-2"],
  [".filters button[type='submit'], .search-button", "search"],
  ["#addCartBtn", "shopping-bag"],
  [".featured-foot a, .product-foot a", "arrow-up-right"],
  [".hero-product-strip a", "arrow-up-right"],
  [".cart-continue", "arrow-left"],
  [".checkout-button", "credit-card"],
  ["#authForm[data-mode='login'] button[type='submit'], .form-card button[type='submit']", "log-in"]
];
function syncDrawerBadges() {
  const wishSrc = document.getElementById("wishlistCount");
  const wishDst = document.getElementById("drawerWishlistCount");
  if (wishSrc && wishDst) {
    wishDst.textContent = wishSrc.textContent || "0";
    wishDst.style.display = wishSrc.style.display;
  }
  const notifSrc = document.getElementById("notifCountBadge");
  const notifDst = document.getElementById("drawerNotifCount");
  if (notifSrc && notifDst) {
    notifDst.textContent = notifSrc.textContent || "0";
    notifDst.style.display = notifSrc.style.display;
  }
}

export function resetPasswordToggles(root = document) {
  if (!root || typeof root.querySelectorAll !== "function") return;
  root.querySelectorAll(".password-toggle-btn[data-toggle-password]").forEach((btn) => {
    const input = document.getElementById(btn.dataset.togglePassword);
    if (input) input.type = "password";
    btn.setAttribute("aria-pressed", "false");
    btn.setAttribute("aria-label", btn.dataset.showLabel || "Hiện mật khẩu");
    btn.innerHTML = `<i data-lucide="eye"></i>`;
  });
  refreshIcons();
}

function initPasswordToggles() {
  if (typeof document === "undefined" || document.documentElement.dataset.ecodeskPwdToggleBound === "1") return;
  document.documentElement.dataset.ecodeskPwdToggleBound = "1";
  document.addEventListener("click", (event) => {
    const btn = event.target.closest(".password-toggle-btn[data-toggle-password]");
    if (!btn) return;
    const input = document.getElementById(btn.dataset.togglePassword);
    if (!input) return;
    if (!btn.dataset.showLabel) {
      btn.dataset.showLabel = btn.getAttribute("aria-label") || "Hiện mật khẩu";
    }
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.setAttribute("aria-pressed", show ? "true" : "false");
    btn.setAttribute("aria-label", show ? btn.dataset.showLabel.replace(/^Hiện/, "Ẩn") : btn.dataset.showLabel);
    btn.innerHTML = `<i data-lucide="${show ? "eye-off" : "eye"}"></i>`;
    refreshIcons();
    input.focus({ preventScroll: true });
  });
}

export function updateControls() {
  for (const [selector, icon, compact] of icons) {
    document.querySelectorAll(selector).forEach((element) => decorate(element, icon, compact));
  }
  syncDrawerBadges();
  refreshIcons();
}

initPasswordToggles();

let queued = false;
if (typeof document !== "undefined" && document.body) {
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; updateControls(); });
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["style"] });
}
updateControls();
if (typeof document !== "undefined" && document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => updateControls());
}

