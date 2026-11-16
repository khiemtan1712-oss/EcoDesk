import { initStore, getCategories, getProducts, getCartCount, getBanners } from "./storage.js";
import { $, formatPrice, getCategoryName, renderRatingStars } from "./utils.js";
import { getPricing, isBannerActive, isNewProduct } from "./commerce.js";
import { revealOnScroll } from "./scroll-reveal.js";

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

function renderCategories(categories) {
  const categoryList = $("#categoryList");
  if (!categoryList) return;
  categoryList.innerHTML = categories
    .map((category) => `<a class="category-btn" href="products.html?category=${category.id}">${category.name}</a>`)
    .join("");
}

function renderFeatured(products, categories) {
  const featuredProducts = $("#featuredProducts");
  if (!featuredProducts) return;
  const featured = [...products]
    .filter((p) => !p.isDraft && p.status !== "Bản nháp" && p.status !== "Ngừng kinh doanh")
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 15);
  featuredProducts.innerHTML = featured.map((product) => {
    const pricing = getPricing(product);
    const ratingValue = Number(product.rating || 0);
    const reviewCount = Number(product.reviewCount || 0);

    const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
    let totalStock = 0;
    let availableVariantCount = 0;
    let soldOutVariantCount = 0;

    if (hasVariants) {
      product.variants.forEach((v) => {
        const s = Math.max(0, Number(v.stock) || 0);
        totalStock += s;
        if (s > 0) availableVariantCount++;
        else soldOutVariantCount++;
      });
    } else {
      totalStock = Math.max(0, Number(product.stock) || 0);
    }

    const isOutOfStock = totalStock <= 0 || product.status === "Hết hàng" || product.status === "Tạm hết hàng" || product.status === "Ngừng kinh doanh";
    const hasPartialSoldOut = hasVariants && availableVariantCount > 0 && soldOutVariantCount > 0;
    const isLowStock = !isOutOfStock && totalStock <= 15;

    let stockBadgeHtml = "";
    if (isOutOfStock) {
      stockBadgeHtml = `<span class="product-stock-pill out-of-stock"><span class="stock-dot"></span>Tạm hết hàng</span>`;
    } else if (hasPartialSoldOut) {
      stockBadgeHtml = `<span class="product-stock-pill in-stock"><span class="stock-dot"></span>Còn hàng</span> <span class="product-partial-soldout-hint">Một số mẫu đã hết hàng</span>`;
    } else if (isLowStock) {
      stockBadgeHtml = `<span class="product-stock-pill low-stock"><span class="stock-dot"></span>Sắp hết (${totalStock})</span>`;
    } else {
      stockBadgeHtml = `<span class="product-stock-pill in-stock"><span class="stock-dot"></span>Còn hàng</span>`;
    }

    let priceHtml = `${pricing.percent ? `<del>${formatPrice(pricing.original)}</del> ` : ""}${formatPrice(pricing.price)}`;
    if (hasVariants) {
      const prices = product.variants.map((v) => Number(v.price)).filter((p) => !isNaN(p) && p > 0);
      if (prices.length > 0) {
        const minP = Math.min(...prices);
        const maxP = Math.max(...prices);
        if (minP < maxP) {
          priceHtml = `Từ <strong>${formatPrice(minP)}</strong>`;
        }
      }
    }

    return `
    <article class="featured-card ${isOutOfStock ? "is-out-of-stock" : ""}">
      <a class="featured-image" href="detail.html?id=${product.id}">
        <div class="card-corner-badges">
          ${pricing.percent ? `<span class="badge-sale-pill">${pricing.badgeText || `-${pricing.percent}%`}</span>` : ""}
          ${isNewProduct(product) ? `<span class="badge-new-pill">Mới</span>` : `<span class="badge-top-pill">Bán chạy</span>`}
        </div>
        ${isOutOfStock ? `<div class="card-out-overlay">Tạm hết hàng</div>` : ""}
        <img src="${product.image}" alt="${product.name}" loading="lazy">
      </a>
      <div class="featured-info">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span class="featured-category">${getCategoryName(categories, product.categoryId)}</span>
          ${stockBadgeHtml}
        </div>
        <h3><a href="detail.html?id=${product.id}">${product.name}</a></h3>
        <div class="featured-rating" aria-label="${reviewCount > 0 ? `Đánh giá ${ratingValue.toFixed(1)} trên 5 (${reviewCount} đánh giá), ${product.sold} lượt bán` : `Chưa có đánh giá, ${product.sold} lượt bán`}">
          ${reviewCount > 0
            ? `${renderRatingStars(ratingValue)}<span class="rating-score">${ratingValue.toFixed(1)}</span><span class="rating-count">(${reviewCount}) • ${product.sold} đã bán</span>`
            : `<span class="rating-count">Chưa có đánh giá • ${product.sold} đã bán</span>`
          }
        </div>
        <div class="featured-foot">
          <span class="featured-price">${priceHtml}</span>
          <a class="btn-outline" href="detail.html?id=${product.id}">Xem chi tiết</a>
        </div>
      </div>
    </article>
  `;
  }).join("");
}

function renderNew(products, categories) {
  const root = $("#newProducts");
  if (!root) return;
  const fresh = products
    .filter((product) => !product.isDraft && product.status !== "Bản nháp" && product.status !== "Ngừng kinh doanh" && isNewProduct(product))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6);
  root.innerHTML = fresh.map((product) => {
    const pricing = getPricing(product);
    return `<article class="new-product-card"><a href="detail.html?id=${product.id}" class="new-product-image"><span class="badge badge-new">Mới</span>${pricing.percent ? `<span class="new-sale-badge">${pricing.badgeText || `-${pricing.percent}%`}</span>` : ""}<img src="${product.image}" alt="${product.name}" loading="lazy"></a><div class="new-product-info"><span class="featured-category">${getCategoryName(categories, product.categoryId)}</span><h3><a href="detail.html?id=${product.id}">${product.name}</a></h3><p class="new-product-price">${pricing.percent ? `<del>${formatPrice(pricing.original)}</del>` : ""}<strong>${formatPrice(pricing.price)}</strong></p></div></article>`;
  }).join("");
  $("#newProductsSection")?.classList.toggle("hidden", fresh.length === 0);
}

function renderScheduledBanner() {
  const root = $("#scheduledBanner");
  if (!root) return;
  const banner = getBanners().filter((item) => isBannerActive(item)).sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))[0];
  if (!banner) { root.classList.add("hidden"); return; }
  const link = /^(\.\/|\/|#)/.test(banner.link || "") ? banner.link : "./products.html";
  root.classList.remove("hidden");
  const image = new URL(banner.image || "", window.location.href).href.replace(/["\\\n\r]/g, "");
  root.style.setProperty("--banner-image", `url("${image}")`);
  root.innerHTML = `<div class="container scheduled-banner-content"><p class="eyebrow">${escapeHtml(banner.kicker || "Ưu đãi EcoDesk")}</p><h2>${escapeHtml(banner.title)}</h2><p>${escapeHtml(banner.description || "Khám phá sản phẩm phù hợp với không gian của bạn.")}</p><a class="btn" href="${escapeHtml(link)}">${escapeHtml(banner.button || "Khám phá ngay")}</a></div>`;
}

async function start() {
  await initStore();
  const categories = getCategories();
  const products = getProducts();
  $("#cartCount").textContent = getCartCount();
  renderCategories(categories);
  renderScheduledBanner();
  renderNew(products, categories);
  renderFeatured(products, categories);
  requestAnimationFrame(() => revealOnScroll());
}

start();
