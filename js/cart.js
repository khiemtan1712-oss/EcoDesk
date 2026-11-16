import { initStore, getCart, getProducts, updateCartItem, getCartCount, getCurrentUser, getActiveCoupons } from "./storage.js";
import { formatPrice, showToast, redirectToLogin } from "./utils.js";
import { getPricing } from "./commerce.js";
import { revealOnScroll } from "./scroll-reveal.js";
import { renderIcon } from "./icons.js";

const list = document.querySelector("#cartItems");
const summary = document.querySelector("#cartSummary");
let couponValue = "";

function quantityButton(label, action, productId, variantId = null, disabled = false) {
  const control = document.createElement("button");
  control.type = "button";
  control.className = "quantity-button";
  control.textContent = label;
  control.setAttribute("aria-label", action === "increase" ? "Tăng số lượng" : action === "decrease" ? "Giảm số lượng" : "Xóa sản phẩm");
  control.disabled = disabled;
  control.addEventListener("click", () => {
    const item = getCart().find((entry) => 
      String(entry.productId) === String(productId) && 
      String(entry.variantId || "") === String(variantId || "")
    );
    if (!item) return;
    try {
      updateCartItem(productId, action === "remove" ? 0 : item.quantity + (action === "increase" ? 1 : -1), variantId);
    } catch (err) {
      showToast(err.message || "Không thể cập nhật số lượng.");
    }
    render();
  });
  return control;
}

function render() {
  const products = getProducts();
  const rows = getCart().map((item) => ({ item, product: products.find((entry) => String(entry.id) === String(item.productId)) })).filter(({ product }) => product);
  list.replaceChildren();
  let subtotal = 0;
  for (const { item, product } of rows) {
    let variant = null;
    if (item.variantId && Array.isArray(product.variants)) {
      variant = product.variants.find((v) => String(v.id) === String(item.variantId) || String(v.sku) === String(item.variantId));
    }
    const maxStock = variant ? Number(variant.stock) : Number(product.stock);
    const basePrice = (variant && variant.price != null) ? Number(variant.price) : ((item.price != null) ? Number(item.price) : Number(product.price));
    const pricing = getPricing({ ...product, price: basePrice }, new Date(), variant);

    subtotal += pricing.price * item.quantity;
    const row = document.createElement("article");
    row.className = "cart-item";
    const link = document.createElement("a");
    link.className = "cart-item-image";
    link.href = `./detail.html?id=${encodeURIComponent(product.id)}`;
    const image = document.createElement("img");
    image.src = item.image || (variant && variant.image) || product.image;
    image.alt = product.name;
    link.append(image);

    const info = document.createElement("div");
    info.className = "cart-item-info";
    const name = document.createElement("a");
    name.className = "cart-item-name";
    name.href = link.href;
    name.textContent = product.name;

    const variantTag = document.createElement("div");
    variantTag.className = "cart-variant-tag";
    if (item.variantName || (variant && variant.name)) {
      variantTag.innerHTML = `Phân loại: <strong>${item.variantName || variant.name}</strong>`;
    }

    const price = document.createElement("p");
    price.className = "cart-item-price";
    price.textContent = `${pricing.percent ? `Sale ${pricing.percent}% · ` : ""}${formatPrice(pricing.price)}`;
    
    info.append(name);
    if (item.variantName || (variant && variant.name)) info.append(variantTag);
    info.append(price);

    if (maxStock <= 0) {
      const stockWarn = document.createElement("div");
      stockWarn.style.cssText = "color: #dc2626; font-size: 11.5px; font-weight: 600; margin-top: 4px; display: flex; align-items: center; gap: 4px;";
      stockWarn.innerHTML = `${renderIcon("alert-triangle", { size: 13, strokeWidth: 1.8 })} <span>Mẫu này hiện đã hết hàng trong kho. Vui lòng xóa để tiếp tục đặt.</span>`;
      info.append(stockWarn);
    } else if (item.quantity > maxStock) {
      const stockWarn = document.createElement("div");
      stockWarn.style.cssText = "color: #d97706; font-size: 11.5px; font-weight: 600; margin-top: 4px; display: flex; align-items: center; gap: 4px;";
      stockWarn.innerHTML = `${renderIcon("alert-triangle", { size: 13, strokeWidth: 1.8 })} <span>Chỉ còn ${maxStock} chiếc trong kho (bạn đang chọn ${item.quantity}).</span>`;
      info.append(stockWarn);
    }

    const controls = document.createElement("div");
    controls.className = "quantity-control";
    controls.append(quantityButton("−", "decrease", product.id, item.variantId, item.quantity <= 1));
    const count = document.createElement("span");
    count.textContent = item.quantity;
    count.setAttribute("aria-live", "polite");
    controls.append(count, quantityButton("+", "increase", product.id, item.variantId, item.quantity >= maxStock));
    const remove = quantityButton("Xóa", "remove", product.id, item.variantId);
    remove.classList.add("remove-item");
    row.append(link, info, controls, remove);
    list.append(row);
  }
  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "cart-empty";
    empty.innerHTML = `<div style="display:flex; justify-content:center; margin-bottom:14px; color:#94a3b8;">${renderIcon("shopping-bag", { size: 48, strokeWidth: 1.8 })}</div><h2>Giỏ hàng đang trống</h2><p>Chọn món bạn cần, sản phẩm sẽ xuất hiện tại đây.</p><a class="btn" href="./products.html">Khám phá sản phẩm</a>`;
    list.append(empty);
  }

  document.querySelector("#cartCount").textContent = getCartCount();
  summary.replaceChildren();
  const title = document.createElement("h2");
  title.textContent = "Tóm tắt đơn hàng";
  const line = document.createElement("div");
  line.className = "summary-line";
  line.innerHTML = `<span>Tạm tính (${getCartCount()} sản phẩm)</span><strong>${formatPrice(subtotal)}</strong>`;
  summary.append(title, line);

  if (getCurrentUser()) {
    const available = getActiveCoupons();
    const couponArea = document.createElement("div");
    couponArea.className = "coupon-area";
    const couponLabel = document.createElement("label");
    couponLabel.htmlFor = "couponCode";
    couponLabel.textContent = "Mã ưu đãi của bạn";
    const couponInput = document.createElement("input");
    couponInput.id = "couponCode";
    couponInput.className = "input";
    couponInput.placeholder = available[0]?.code || "Nhập mã ưu đãi";
    couponInput.value = couponValue;
    couponInput.autocomplete = "off";
    couponInput.addEventListener("input", () => { couponValue = couponInput.value; });
    const applyCoupon = document.createElement("button");
    applyCoupon.type = "button";
    applyCoupon.className = "btn-outline";
    applyCoupon.textContent = "Áp dụng mã";
    applyCoupon.addEventListener("click", () => {
      couponValue = couponInput.value.trim();
      const valid = available.find((item) => item.code.toLowerCase() === couponValue.toLowerCase());
      if (!valid && couponValue) { showToast("Mã ưu đãi không hợp lệ hoặc đã hết hạn."); return; }
      if (valid?.campaignId && !rows.some(({ product }) => product.id === valid.productId)) {
        showToast("Mã này chỉ áp dụng khi giỏ hàng có sản phẩm được chỉ định.");
        return;
      }
      render();
      if (valid) showToast(`Đã áp dụng ưu đãi ${valid.percent}%.`);
    });
    couponArea.append(couponLabel, couponInput, applyCoupon);
    if (available.length) {
      const options = document.createElement("div");
      options.className = "coupon-options";
      for (const coupon of available) {
        const use = document.createElement("button");
        use.type = "button";
        use.className = "coupon-chip";
        use.textContent = `${coupon.label} · ${coupon.percent}%`;
        use.addEventListener("click", () => { couponValue = coupon.code; couponInput.value = coupon.code; });
        options.append(use);
      }
      couponArea.append(options);
    }
    summary.append(couponArea);
  } else {
    const hint = document.createElement("p");
    hint.className = "coupon-hint";
    hint.textContent = "Đăng ký để nhận mã giảm 10% cho đơn đầu tiên.";
    summary.append(hint);
  }

  const coupon = getActiveCoupons().find((item) => item.code.toLowerCase() === couponValue.trim().toLowerCase());
  const discount = coupon ? Math.round(subtotal * coupon.percent / 100) : 0;
  if (coupon?.campaignId) {
    const saleLine = document.createElement("div");
    saleLine.className = "summary-line summary-discount";
    saleLine.innerHTML = `<span>Mã sale ${coupon.percent}% đã xác nhận</span><strong>Đã trừ vào giá sản phẩm</strong>`;
    summary.append(saleLine);
  } else if (discount) {
    const discountLine = document.createElement("div");
    discountLine.className = "summary-line summary-discount";
    discountLine.innerHTML = `<span>Ưu đãi ${coupon.percent}%</span><strong>−${formatPrice(discount)}</strong>`;
    summary.append(discountLine);
  }
  const totalLine = document.createElement("div");
  totalLine.className = "summary-line summary-total";
  totalLine.innerHTML = `<strong>Tổng cộng</strong><strong>${formatPrice(subtotal - discount)}</strong>`;
  summary.append(totalLine);
  const checkout = document.createElement("button");
  checkout.className = "btn checkout-button";
  checkout.type = "button";
  checkout.textContent = "Tiến hành đặt hàng";
  checkout.disabled = !rows.length;
  checkout.addEventListener("click", () => {
    if (!rows.length) {
      showToast("Giỏ hàng của bạn đang trống.");
      return;
    }

    // Kiểm tra tồn kho thời gian thực trước khi tiến hành thanh toán
    const freshProducts = getProducts();
    for (const { item } of rows) {
      const freshP = freshProducts.find((p) => String(p.id) === String(item.productId));
      if (!freshP) {
        showToast("Có sản phẩm trong giỏ không còn tồn tại trên hệ thống.");
        return;
      }
      let v = null;
      if (item.variantId && Array.isArray(freshP.variants)) {
        v = freshP.variants.find((vr) => String(vr.id) === String(item.variantId) || String(vr.sku) === String(item.variantId));
      }
      const st = v ? Number(v.stock) : Number(freshP.stock);
      const label = v ? `${freshP.name} (${v.name})` : (item.variantName ? `${freshP.name} (${item.variantName})` : freshP.name);
      if (st <= 0) {
        showToast(`Sản phẩm "${label}" hiện đã tạm hết hàng. Quý khách vui lòng xóa khỏi giỏ để tiếp tục.`);
        return;
      }
      if (item.quantity > st) {
        showToast(`Sản phẩm "${label}" chỉ còn ${st} chiếc trong kho. Vui lòng điều chỉnh số lượng.`);
        return;
      }
    }

    if (!getCurrentUser()) {
      redirectToLogin({
        next: "./checkout.html",
        notice: "Bạn cần đăng nhập tài khoản để tiếp tục thanh toán."
      });
      return;
    }
    if (couponValue) {
      sessionStorage.setItem("ecodesk_checkout_coupon", couponValue.trim());
    } else {
      sessionStorage.removeItem("ecodesk_checkout_coupon");
    }
    window.location.href = "./checkout.html";
  });
  summary.append(checkout);
  requestAnimationFrame(() => revealOnScroll(list));
}

await initStore();
render();
