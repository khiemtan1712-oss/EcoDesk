import { initStore, getProducts, getCategories } from "./storage.js";

// Ensure search-modal.css is loaded
if (!document.querySelector('link[href*="search-modal.css"]')) {
  const searchCss = document.createElement("link");
  searchCss.rel = "stylesheet";
  searchCss.href = new URL("../css/search-modal.css", import.meta.url).href;
  document.head.append(searchCss);
}

// Helper for Vietnamese diacritics removal
export function removeVietnameseTones(str) {
  if (!str) return "";
  str = String(str).toLowerCase().trim();
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  str = str.replace(/đ/g, "d");
  str = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return str;
}

// Check if any word starts with query or text contains query cleanly
export function matchesSuggestion(text, normQuery) {
  if (!text || !normQuery) return false;
  const norm = removeVietnameseTones(text);
  if (!norm.includes(normQuery)) return false;
  if (!normQuery.includes(" ") && normQuery.length <= 4) {
    const words = norm.split(/[\s,./\-_()+&]+/);
    return words.some((w) => w.startsWith(normQuery));
  }
  return true;
}

// Accurate Product matching: matches product name or tags by words/phrase, avoiding false positives
export function matchesProduct(product, normQuery) {
  if (!product || !normQuery) return false;
  const normName = removeVietnameseTones(product.name);

  // 1. Name match
  if (normName.includes(normQuery)) {
    if (!normQuery.includes(" ") && normQuery.length <= 4) {
      const words = normName.split(/[\s,./\-_()+&]+/);
      if (words.some((w) => w.startsWith(normQuery))) {
        return true;
      }
    } else {
      return true;
    }
  }

  // 2. Tag match
  const tags = product.tags || [];
  for (const tag of tags) {
    const normTag = removeVietnameseTones(tag);
    if (normTag.includes(normQuery)) {
      if (!normQuery.includes(" ") && normQuery.length <= 4) {
        const words = normTag.split(/[\s,./\-_()+&]+/);
        if (words.some((w) => w.startsWith(normQuery))) return true;
      } else {
        return true;
      }
    }
  }

  return false;
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

let isInitialized = false;
let modalEl = null;
let inputEl = null;
let clearBtn = null;
let dividerEl = null;
let closeBtn = null;
let submitBtn = null;
let dropdownEl = null;
let overlayEl = null;
let previousActiveElement = null;

const POPULAR_KEYWORDS = [
  "Bàn nâng hạ",
  "Ghế công thái học",
  "Đèn & ánh sáng",
  "Combo setup",
  "Phụ kiện setup"
];

const SITE_PAGES = [
  { name: "Chính sách bảo hành", url: "./payment-support.html#faqSection" },
  { name: "Chính sách giao hàng", url: "./payment-support.html#faqSection" },
  { name: "Điều khoản và chính sách chung cho Khách hàng doanh nghiệp (B2B)", url: "./payment-support.html#faqSection" },
  { name: "Hỗ trợ khách hàng", url: "./payment-support.html" },
  { name: "Tất cả sản phẩm", url: "./products.html" }
];

function createModalDOM() {
  if (document.getElementById("ecodeskSearchModal")) return;

  const modal = document.createElement("div");
  modal.id = "ecodeskSearchModal";
  modal.className = "ecodesk-search-backdrop";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", "Tìm kiếm sản phẩm EcoDesk");
  modal.setAttribute("aria-hidden", "true");

  modal.innerHTML = `
    <!-- Top Announcement Bar -->
    <div class="search-top-announcement">Miễn phí vận chuyển và lắp đặt tại Hồ Chí Minh</div>

    <!-- Full-Width White Header Bar -->
    <div class="search-white-header-strip">
      <div class="search-header-container">
        <div class="search-input-box" id="modalSearchBox">
          <label class="search-floating-label" for="modalSearchInput">Tìm kiếm</label>
          <div class="search-input-inner">
            <input 
              type="text" 
              id="modalSearchInput" 
              class="search-input-field" 
              placeholder="" 
              autocomplete="off" 
              spellcheck="false" 
              aria-label="Tìm kiếm sản phẩm hoặc nội dung"
            >
            <button type="button" id="modalSearchClear" class="search-clear-circle-btn" aria-label="Xóa nội dung" title="Xóa" hidden>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <div class="search-input-divider" id="modalSearchDivider" hidden aria-hidden="true"></div>
            <button type="button" id="modalSearchSubmit" class="search-submit-icon-btn" aria-label="Tìm kiếm">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </button>
          </div>
        </div>
        <button type="button" id="modalSearchClose" class="search-modal-close-icon" aria-label="Đóng tìm kiếm" title="Đóng (ESC)">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>

    <!-- Dimmed Lower Area with Search Dropdown -->
    <div class="search-body-overlay" id="modalSearchOverlay">
      <div class="search-dropdown-wrapper">
        <div class="search-dropdown-panel" id="modalSearchDropdown"></div>
      </div>
    </div>
  `;

  document.body.append(modal);

  modalEl = modal;
  overlayEl = modal.querySelector("#modalSearchOverlay");
  inputEl = modal.querySelector("#modalSearchInput");
  clearBtn = modal.querySelector("#modalSearchClear");
  dividerEl = modal.querySelector("#modalSearchDivider");
  closeBtn = modal.querySelector("#modalSearchClose");
  submitBtn = modal.querySelector("#modalSearchSubmit");
  dropdownEl = modal.querySelector("#modalSearchDropdown");

  // Event listeners
  closeBtn.addEventListener("click", closeSearchModal);

  clearBtn.addEventListener("click", () => {
    inputEl.value = "";
    inputEl.focus();
    clearBtn.hidden = true;
    dividerEl.hidden = true;
    renderDefaultView();
  });

  submitBtn.addEventListener("click", () => {
    const query = inputEl.value.trim();
    if (query) {
      window.location.href = `./products.html?search=${encodeURIComponent(query)}`;
    } else {
      inputEl.focus();
    }
  });

  overlayEl.addEventListener("click", (e) => {
    if (!dropdownEl.contains(e.target)) {
      closeSearchModal();
    }
  });

  inputEl.addEventListener("input", handleInputChange);
  inputEl.addEventListener("keydown", handleInputKeydown);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalEl.classList.contains("is-open")) {
      closeSearchModal();
    }
    // Keyboard shortcut: Ctrl+K or Cmd+K
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      openSearchModal();
    }
  });
}

function handleInputKeydown(e) {
  const query = inputEl.value.trim();
  if (e.key === "Enter") {
    e.preventDefault();
    if (query) {
      window.location.href = `./products.html?search=${encodeURIComponent(query)}`;
    }
  }
}

let debounceTimer = null;
function handleInputChange() {
  const query = inputEl.value;
  const hasText = query.length > 0;

  clearBtn.hidden = !hasText;
  dividerEl.hidden = !hasText;

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (!query.trim()) {
      renderDefaultView();
    } else {
      dropdownEl.hidden = false;
      renderSearchResults(query.trim());
    }
  }, 40);
}

function renderDefaultView() {
  dropdownEl.hidden = false;
  const products = getProducts()
    .filter((p) => !p.isDraft && p.status !== "Bản nháp" && p.status !== "Ngừng kinh doanh")
    .slice(0, 6);

  dropdownEl.innerHTML = `
    <div class="search-content-grid">
      <!-- Left Column: GỢI Ý & TRANG -->
      <div class="search-col-meta">
        <div class="search-section-block">
          <div class="search-section-label">GỢI Ý</div>
          <ul class="search-simple-list">
            ${POPULAR_KEYWORDS.slice(0, 4).map((kw) => `
              <li>
                <button type="button" class="search-text-item" data-fill-search="${escapeHtml(kw)}">
                  ${escapeHtml(kw)}
                </button>
              </li>
            `).join("")}
          </ul>
        </div>

        <div class="search-section-block">
          <div class="search-section-label">TRANG</div>
          <ul class="search-simple-list">
            ${SITE_PAGES.slice(0, 4).map((p) => `
              <li>
                <a href="${p.url}" class="search-page-item">
                  ${escapeHtml(p.name)}
                </a>
              </li>
            `).join("")}
          </ul>
        </div>
      </div>

      <!-- Right Column: SẢN PHẨM -->
      <div class="search-col-products">
        <div class="search-section-label">SẢN PHẨM</div>
        <div class="search-product-items">
          ${products.map((p) => renderProductRow(p)).join("")}
        </div>
      </div>
    </div>

    <!-- Bottom Footer Row -->
    <a href="./products.html" class="search-footer-row">
      <span class="search-footer-query">Xem tất cả sản phẩm EcoDesk</span>
      <span class="search-footer-arrow" aria-hidden="true">→</span>
    </a>
  `;

  bindSuggestionClicks();
}

function renderSearchResults(query) {
  const normQuery = removeVietnameseTones(query);
  const categories = getCategories();
  const allProducts = getProducts();

  // Match suggestions where word or text starts with query
  const matchedSuggestions = [];
  POPULAR_KEYWORDS.forEach((kw) => {
    if (matchesSuggestion(kw, normQuery) && !matchedSuggestions.includes(kw)) {
      matchedSuggestions.push(kw);
    }
  });

  categories.forEach((c) => {
    if (matchesSuggestion(c.name, normQuery) && !matchedSuggestions.includes(c.name)) {
      matchedSuggestions.push(c.name);
    }
  });

  // Filter matching pages
  const matchedPages = SITE_PAGES.filter((p) => {
    return matchesSuggestion(p.name, normQuery);
  });

  // Filter matching products with strict accurate logic
  const matchedProducts = allProducts.filter((product) => {
    if (product.isDraft || product.status === "Bản nháp" || product.status === "Ngừng kinh doanh") return false;
    return matchesProduct(product, normQuery);
  });

  const totalMatches = matchedProducts.length;

  if (totalMatches === 0 && matchedSuggestions.length === 0 && matchedPages.length === 0) {
    // No results view
    dropdownEl.innerHTML = `
      <div class="search-empty-state">
        <div class="search-empty-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="11" y1="8" x2="11" y2="12"></line>
            <line x1="11" y1="16" x2="11.01" y2="16"></line>
          </svg>
        </div>
        <h4 class="search-empty-title">Không tìm thấy kết quả nào cho "${escapeHtml(query)}"</h4>
        <p class="search-empty-desc">Vui lòng kiểm tra lại chính tả hoặc chọn các danh mục gợi ý bên dưới.</p>
        <div class="search-empty-chips">
          ${POPULAR_KEYWORDS.slice(0, 4).map((kw) => `
            <button type="button" class="search-chip-btn" data-fill-search="${escapeHtml(kw)}">${escapeHtml(kw)}</button>
          `).join("")}
        </div>
      </div>
    `;
    bindSuggestionClicks();
    return;
  }

  // Two column layout exactly matching reference screenshot
  dropdownEl.innerHTML = `
    <div class="search-content-grid">
      <!-- Left Column: GỢI Ý & TRANG -->
      <div class="search-col-meta">
        ${matchedSuggestions.length > 0 ? `
          <div class="search-section-block">
            <div class="search-section-label">GỢI Ý</div>
            <ul class="search-simple-list">
              ${matchedSuggestions.map((kw) => `
                <li>
                  <button type="button" class="search-text-item" data-fill-search="${escapeHtml(kw)}">
                    ${escapeHtml(kw)}
                  </button>
                </li>
              `).join("")}
            </ul>
          </div>
        ` : ""}

        ${matchedPages.length > 0 ? `
          <div class="search-section-block">
            <div class="search-section-label">TRANG</div>
            <ul class="search-simple-list">
              ${matchedPages.map((p) => `
                <li>
                  <a href="${p.url}" class="search-page-item">
                    ${escapeHtml(p.name)}
                  </a>
                </li>
              `).join("")}
            </ul>
          </div>
        ` : ""}
      </div>

      <!-- Right Column: SẢN PHẨM -->
      <div class="search-col-products">
        <div class="search-section-label">SẢN PHẨM</div>
        <div class="search-product-items">
          ${matchedProducts.length > 0 ? (
            matchedProducts.slice(0, 6).map((p) => renderProductRow(p)).join("")
          ) : `
            <div class="search-no-products">
              Không có sản phẩm nào khớp với từ khóa này.
            </div>
          `}
        </div>
      </div>
    </div>

    <!-- Bottom Footer Row: Tìm kiếm "[query]" -->
    <a href="./products.html?search=${encodeURIComponent(query)}" class="search-footer-row">
      <span class="search-footer-query">Tìm kiếm "${escapeHtml(query)}"</span>
      <span class="search-footer-arrow" aria-hidden="true">→</span>
    </a>
  `;

  bindSuggestionClicks();
}

function renderProductRow(product) {
  return `
    <a href="./detail.html?id=${product.id}" class="search-product-row" data-product-id="${product.id}">
      <div class="search-product-thumb">
        <img src="${product.image}" alt="${escapeHtml(product.name)}" loading="lazy">
      </div>
      <span class="search-product-title">${escapeHtml(product.name)}</span>
    </a>
  `;
}

function bindSuggestionClicks() {
  dropdownEl.querySelectorAll("[data-fill-search]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const text = btn.getAttribute("data-fill-search");
      inputEl.value = text;
      clearBtn.hidden = false;
      dividerEl.hidden = false;
      dropdownEl.hidden = false;
      inputEl.focus();
      renderSearchResults(text);
    });
  });
}

export function openSearchModal() {
  if (!modalEl) createModalDOM();

  previousActiveElement = document.activeElement;
  modalEl.classList.add("is-open");
  modalEl.setAttribute("aria-hidden", "false");
  document.body.classList.add("search-modal-open");

  if (inputEl.value.trim()) {
    dropdownEl.hidden = false;
    clearBtn.hidden = false;
    dividerEl.hidden = false;
    renderSearchResults(inputEl.value.trim());
  } else {
    clearBtn.hidden = true;
    dividerEl.hidden = true;
    renderDefaultView();
  }

  setTimeout(() => {
    inputEl.focus();
    inputEl.select();
  }, 40);
}

export function closeSearchModal() {
  if (!modalEl) return;
  modalEl.classList.remove("is-open");
  modalEl.setAttribute("aria-hidden", "true");
  document.body.classList.remove("search-modal-open");

  if (previousActiveElement && typeof previousActiveElement.focus === "function") {
    previousActiveElement.focus();
  }
}

export async function initSearchModal() {
  if (isInitialized) return;
  isInitialized = true;

  await initStore();
  createModalDOM();

  // Attach click handler to any header search buttons on the page
  document.querySelectorAll(".header-search, [data-open-search]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      openSearchModal();
    });
  });
}

// Auto initialize on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSearchModal);
} else {
  initSearchModal();
}
