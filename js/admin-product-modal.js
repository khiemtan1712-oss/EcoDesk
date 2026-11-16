/**
 * EcoDesk Admin - Product Modal Controller
 * Tích hợp luồng thêm mới & chỉnh sửa sản phẩm dạng modal trực tiếp trên trang admin.
 * Tái sử dụng quy ước giao diện, backdrop, responsive của Modal Tạo phiếu nhập kho.
 */
import {
  createProduct,
  updateProduct,
  findProduct,
  getCategories,
  getProducts,
  normalizeProductTags,
  deduplicateGalleryEntries,
  cleanMojibake
} from "./storage.js";
import { formatPrice, showToast, escapeHtml } from "./utils.js";
import { validateProduct } from "./validation.js";
import { renderIcon, initIcons } from "./icons.js";
import {
  calculateNewBadgeEndDate,
  getVietnamTodayString,
  getVietnamNowDateTimeString,
  getNewBadgeStatus,
  getDiscountPromotionStatus,
  calculateDiscountPricing
} from "./commerce.js";

let modalConfig = {
  onProductSaved: null,
  onOpenCreatePo: null
};

let currentEditingProductId = null;
let lastTriggerElement = null;
let initialSnapshotJson = "";

// Form State
let modalProductState = {
  id: "",
  name: "",
  categoryId: "",
  price: 0,
  costPrice: null,
  stock: 10,
  status: "Còn hàng",
  image: "",
  tags: [],
  description: "",
  hasVariants: false,
  attributes: [
    { name: "Màu sắc", values: ["Gỗ Sồi tự nhiên", "Đen Stealth"] },
    { name: "Kích thước", values: ["120 x 60 cm", "140 x 70 cm"] }
  ],
  variants: [],
  gallery: [],
  newBadge: {
    enabled: false,
    mode: "months",
    months: 2,
    startDate: getVietnamTodayString(),
    endDate: calculateNewBadgeEndDate(getVietnamTodayString(), 2)
  },
  discount: {
    enabled: false,
    type: "percentage",
    value: 15,
    startAt: getVietnamNowDateTimeString(),
    endAt: ""
  }
};

function formatNumberWithDots(val) {
  if (val === null || val === undefined || val === "") return "";
  const raw = String(val).replace(/\D/g, "");
  if (!raw) return "";
  return raw.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function parseNumberFromDots(val) {
  if (!val) return 0;
  const raw = String(val).replace(/\D/g, "");
  return Number(raw) || 0;
}

function fieldError(name, errors) {
  const msg = errors[name] || "";
  return `<small class="product-field-error ${msg ? "show" : ""}" data-error="${name}">${escapeHtml(msg)}</small>`;
}

function getFormSnapshot() {
  syncModalStateFromInputs();
  return JSON.parse(JSON.stringify(modalProductState));
}

function isFormDirty() {
  const currentSnap = JSON.stringify(getFormSnapshot());
  return currentSnap !== initialSnapshotJson;
}

/**
 * Đồng bộ toàn bộ dữ liệu từ các input DOM vào modalProductState
 */
function syncModalStateFromInputs() {
  const body = document.getElementById("productModalBody");
  if (!body) return;

  const codeInp = body.querySelector("#modalProductCode");
  const nameInp = body.querySelector("#modalProductName");
  const catInp = body.querySelector("#modalProductCategory");
  const priceInp = body.querySelector("#modalProductPrice");
  const costPriceInp = body.querySelector("#modalProductCostPrice");
  const stockInp = body.querySelector("#modalProductStock");
  const statusInp = body.querySelector("#modalProductStatus");
  const imageInp = body.querySelector("#modalProductImage");
  const tagsInp = body.querySelector("#modalProductTags");
  const descInp = body.querySelector("#modalProductDesc");

  if (codeInp) modalProductState.id = codeInp.value.trim();
  if (nameInp) modalProductState.name = nameInp.value.trim();
  if (catInp) modalProductState.categoryId = catInp.value;
  if (priceInp) modalProductState.price = parseNumberFromDots(priceInp.value);
  if (costPriceInp) {
    const cp = parseNumberFromDots(costPriceInp.value);
    modalProductState.costPrice = cp > 0 ? cp : null;
  }
  if (stockInp) modalProductState.stock = Math.max(0, parseInt(stockInp.value, 10) || 0);
  if (statusInp) modalProductState.status = statusInp.value;
  if (imageInp) modalProductState.image = imageInp.value.trim();
  if (tagsInp) modalProductState.tags = normalizeProductTags(tagsInp.value);
  if (descInp) modalProductState.description = descInp.value.trim();

  syncNewBadgeFromInputs();
  syncDiscountFromInputs();
  syncGalleryFromInputs();
  syncAttributesFromInputs();
  syncVariantsFromInputs();
}

function syncNewBadgeFromInputs() {
  const body = document.getElementById("productModalBody");
  if (!body) return;
  const enabledCheck = body.querySelector("#modalNewBadgeEnabled");
  const startDateInput = body.querySelector("#modalNewBadgeStartDate");
  const modeRadios = body.querySelectorAll("input[name='modalNewBadgeMode']");
  const monthsSelect = body.querySelector("#modalNewBadgeMonths");
  const endDateInput = body.querySelector("#modalNewBadgeEndDate");

  if (!modalProductState.newBadge) {
    modalProductState.newBadge = {
      enabled: false,
      mode: "months",
      months: 2,
      startDate: getVietnamTodayString(),
      endDate: calculateNewBadgeEndDate(getVietnamTodayString(), 2)
    };
  }

  if (enabledCheck) modalProductState.newBadge.enabled = enabledCheck.checked;
  let mode = modalProductState.newBadge.mode || "months";
  modeRadios.forEach((r) => { if (r.checked) mode = r.value; });
  modalProductState.newBadge.mode = mode;

  const startDate = startDateInput ? startDateInput.value : (modalProductState.newBadge.startDate || getVietnamTodayString());
  modalProductState.newBadge.startDate = startDate;

  if (mode === "custom") {
    modalProductState.newBadge.endDate = endDateInput ? endDateInput.value : (modalProductState.newBadge.endDate || "");
  } else {
    const months = monthsSelect ? Number(monthsSelect.value) || 2 : (Number(modalProductState.newBadge.months) || 2);
    modalProductState.newBadge.months = months;
    modalProductState.newBadge.endDate = calculateNewBadgeEndDate(startDate, months);
  }
}

function syncDiscountFromInputs() {
  const body = document.getElementById("productModalBody");
  if (!body) return;
  const enabledCheck = body.querySelector("#modalDiscountEnabled");
  const typeRadios = body.querySelectorAll("input[name='modalDiscountType']");
  const valInput = body.querySelector("#modalDiscountValue");
  const startInput = body.querySelector("#modalDiscountStartAt");
  const endInput = body.querySelector("#modalDiscountEndAt");

  if (!modalProductState.discount) {
    modalProductState.discount = {
      enabled: false,
      type: "percentage",
      value: 15,
      startAt: getVietnamNowDateTimeString(),
      endAt: ""
    };
  }

  if (enabledCheck) modalProductState.discount.enabled = enabledCheck.checked;
  let type = modalProductState.discount.type || "percentage";
  typeRadios.forEach((r) => { if (r.checked) type = r.value; });
  modalProductState.discount.type = type;

  if (valInput) modalProductState.discount.value = Number(valInput.value) || 0;
  if (startInput) modalProductState.discount.startAt = startInput.value;
  if (endInput) modalProductState.discount.endAt = endInput.value;
}

function syncGalleryFromInputs() {
  const body = document.getElementById("productModalBody");
  if (!body) return;
  const cards = body.querySelectorAll(".modal-gallery-card");
  const list = [];
  cards.forEach((card, idx) => {
    const url = card.querySelector(".gal-url")?.value.trim() || "";
    const caption = card.querySelector(".gal-caption")?.value.trim() || "";
    const linkType = card.querySelector(".gal-link-type")?.value || "general";
    const attrKey = card.querySelector(".gal-attr-key")?.value.trim() || "";
    const attrVal = card.querySelector(".gal-attr-val")?.value.trim() || "";
    const varId = card.querySelector(".gal-variant-id")?.value || "";

    list.push({
      id: modalProductState.gallery[idx]?.id || `gal-${Date.now()}-${idx + 1}`,
      url,
      caption,
      isGeneral: linkType === "general",
      attributeKey: linkType === "attribute" ? attrKey : "",
      attributeValue: linkType === "attribute" ? attrVal : "",
      variantId: linkType === "variant" ? varId : ""
    });
  });
  modalProductState.gallery = deduplicateGalleryEntries(list);
}

function syncAttributesFromInputs() {
  const body = document.getElementById("productModalBody");
  if (!body) return;
  const rows = body.querySelectorAll(".modal-attr-group-row");
  const attrs = [];
  rows.forEach((row) => {
    const name = row.querySelector(".attr-name-input")?.value.trim() || "";
    const rawVals = row.querySelector(".attr-values-input")?.value || "";
    const values = rawVals
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
    if (name) {
      attrs.push({ name, values });
    }
  });
  modalProductState.attributes = attrs;
}

function syncVariantsFromInputs() {
  const body = document.getElementById("productModalBody");
  if (!body) return;
  const rows = body.querySelectorAll("tr[data-variant-idx]");
  const variants = [];
  rows.forEach((row, idx) => {
    const oldV = modalProductState.variants[idx] || {};
    const name = row.querySelector(".var-name")?.value.trim() || oldV.name || "";
    const sku = row.querySelector(".var-sku")?.value.trim() || oldV.sku || "";
    const price = parseNumberFromDots(row.querySelector(".var-price")?.value);
    const stock = Math.max(0, parseInt(row.querySelector(".var-stock")?.value, 10) || 0);
    const image = row.querySelector(".var-image")?.value.trim() || oldV.image || "";
    const status = row.querySelector(".var-status")?.value || oldV.status || "Còn hàng";

    variants.push({
      ...oldV,
      name,
      sku,
      price,
      stock,
      image,
      status
    });
  });
  if (variants.length > 0) {
    modalProductState.variants = variants;
  }
}

/**
 * Sinh tổ hợp biến thể từ danh sách thuộc tính hiện có (Cartesian product)
 */
function generateCombinationsFromAttributes(product) {
  const attrs = modalProductState.attributes.filter((a) => a.name && Array.isArray(a.values) && a.values.length > 0);
  if (attrs.length === 0) return;

  const cartesian = (arrays) => arrays.reduce((acc, curr) => acc.flatMap((c) => curr.map((n) => [...c, n])), [[]]);
  const combinations = cartesian(attrs.map((a) => a.values.map((v) => ({ attr: a.name, val: v }))));

  const basePrice = modalProductState.price || 1000000;
  const baseImg = modalProductState.image || product.image || "";
  const existingMap = new Map((modalProductState.variants || []).map((v) => [cleanMojibake(v.name), v]));
  const prodId = modalProductState.id || product.id || "P";

  modalProductState.variants = combinations.map((comb, idx) => {
    const name = comb.map((c) => cleanMojibake(c.val)).join(" / ");
    const options = {};
    comb.forEach((c) => { options[cleanMojibake(c.attr)] = cleanMojibake(c.val); });

    if (existingMap.has(name)) {
      const old = existingMap.get(name);
      return { ...old, options };
    }

    const skuSuffix = comb.map((c) => c.val.slice(0, 3).toUpperCase()).join("-");
    return {
      id: `${prodId}-VAR-${idx + 1}`,
      sku: `${prodId}-${skuSuffix}`,
      name,
      options,
      price: basePrice,
      stock: 10,
      image: baseImg,
      status: "Còn hàng"
    };
  });
}

/**
 * Render toàn bộ nội dung HTML bên trong modal
 */
function renderModalForm(product = {}, errors = {}) {
  const body = document.getElementById("productModalBody");
  if (!body) return;

  const categories = getCategories();
  const hasVars = Boolean(modalProductState.hasVariants);
  const totalVariantStock = modalProductState.variants.reduce((sum, v) => sum + Math.max(0, Number(v.stock) || 0), 0);
  const minVariantPrice = modalProductState.variants.length > 0
    ? Math.min(...modalProductState.variants.map((v) => Number(v.price) || 0).filter((p) => p > 0))
    : (modalProductState.price || 0);

  // Nhãn Mới preview
  const badgeStatus = getNewBadgeStatus({ newBadge: modalProductState.newBadge });
  const previewStartDate = modalProductState.newBadge.startDate || getVietnamTodayString();
  const previewEndDate = modalProductState.newBadge.mode === "custom"
    ? (modalProductState.newBadge.endDate || "—")
    : calculateNewBadgeEndDate(previewStartDate, Number(modalProductState.newBadge.months) || 2);

  // Khuyến mãi preview
  const sampleBasePrice = hasVars && minVariantPrice > 0 ? minVariantPrice : (modalProductState.price || 1000000);
  const discountCalc = calculateDiscountPricing(sampleBasePrice, modalProductState.discount);
  const promoStatus = getDiscountPromotionStatus({ discount: modalProductState.discount });

  const isEdit = Boolean(currentEditingProductId);

  body.innerHTML = `
    <!-- NHÓM 1: THÔNG TIN CƠ BẢN (2 CỘT DESKTOP -> 1 CỘT MOBILE) -->
    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
      <h4 style="margin: 0 0 12px; font-size: 14px; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 6px;">
        ${renderIcon("package", { size: 16, strokeWidth: 1.8 })} 1. Thông tin chung &amp; Giá bán
      </h4>
      <div class="product-grid-2">
        <!-- Mã sản phẩm -->
        <div class="product-field-group">
          <label class="product-field-label" for="modalProductCode">
            <span>Mã sản phẩm (ID)</span>
            <small style="color: #64748b; font-weight: normal;">${isEdit ? "(Cố định)" : "(Tự động sinh Pxxx nếu để trống)"}</small>
          </label>
          <input type="text" class="product-field-input ${errors.modalProductCode || errors.id ? "is-invalid" : ""}" id="modalProductCode" value="${escapeHtml(modalProductState.id || "")}" placeholder="Ví dụ: P026" ${isEdit ? "readonly style='background: #f1f5f9; cursor: not-allowed;'" : ""}>
          ${fieldError("modalProductCode", errors)}
          ${fieldError("id", errors)}
        </div>

        <!-- Tên sản phẩm -->
        <div class="product-field-group">
          <label class="product-field-label" for="modalProductName">
            <span>Tên sản phẩm <span style="color: #dc2626;">*</span></span>
          </label>
          <input type="text" class="product-field-input ${errors.name || errors.modalProductName ? "is-invalid" : ""}" id="modalProductName" value="${escapeHtml(modalProductState.name || "")}" placeholder="Ví dụ: Bàn nâng hạ Epione SmartDesk Lite" required>
          ${fieldError("name", errors)}
          ${fieldError("modalProductName", errors)}
        </div>

        <!-- Danh mục -->
        <div class="product-field-group">
          <label class="product-field-label" for="modalProductCategory">
            <span>Danh mục sản phẩm <span style="color: #dc2626;">*</span></span>
          </label>
          <select class="product-field-select ${errors.categoryId || errors.modalProductCategory ? "is-invalid" : ""}" id="modalProductCategory" required>
            <option value="">-- Chọn danh mục --</option>
            ${categories.map((c) => `
              <option value="${escapeHtml(c.id)}" ${modalProductState.categoryId === c.id ? "selected" : ""}>
                ${escapeHtml(c.name)}
              </option>
            `).join("")}
          </select>
          ${fieldError("categoryId", errors)}
          ${fieldError("modalProductCategory", errors)}
        </div>

        <!-- Trạng thái kinh doanh -->
        <div class="product-field-group">
          <label class="product-field-label" for="modalProductStatus">
            <span>Trạng thái kinh doanh</span>
          </label>
          <select class="product-field-select" id="modalProductStatus">
            <option value="Còn hàng" ${modalProductState.status === "Còn hàng" ? "selected" : ""}>Còn hàng</option>
            <option value="Sắp hết" ${modalProductState.status === "Sắp hết" ? "selected" : ""}>Sắp hết</option>
            <option value="Hết hàng" ${modalProductState.status === "Hết hàng" ? "selected" : ""}>Hết hàng</option>
            <option value="Ngừng kinh doanh" ${modalProductState.status === "Ngừng kinh doanh" ? "selected" : ""}>Ngừng kinh doanh</option>
            <option value="Bản nháp" ${modalProductState.status === "Bản nháp" ? "selected" : ""}>Bản nháp</option>
          </select>
        </div>

        <!-- Giá bán cơ sở -->
        <div class="product-field-group">
          <label class="product-field-label" for="modalProductPrice">
            <span>Giá bán niêm yết (VNĐ) <span style="color: #dc2626;">*</span></span>
            ${hasVars ? `<small style="color: #15803d; font-weight: 600;">(Tự lấy giá nhỏ nhất)</small>` : ""}
          </label>
          <input type="text" inputmode="numeric" class="product-field-input ${errors.price || errors.modalProductPrice ? "is-invalid" : ""}" id="modalProductPrice" value="${hasVars && minVariantPrice > 0 ? formatNumberWithDots(minVariantPrice) : formatNumberWithDots(modalProductState.price)}" placeholder="Ví dụ: 3.500.000" ${hasVars ? "readonly style='background: #f8fafc; font-weight: 700; color: #15803d;'" : ""} required>
          ${fieldError("price", errors)}
          ${fieldError("modalProductPrice", errors)}
        </div>

        <!-- Giá nhập bình quân (Cost Price) -->
        <div class="product-field-group">
          <label class="product-field-label" for="modalProductCostPrice">
            <span>Giá nhập tham khảo (VNĐ)</span>
            <small style="color: #64748b; font-weight: normal;">(Giá nhập bình quân để ước tính lãi)</small>
          </label>
          <input type="text" inputmode="numeric" class="product-field-input" id="modalProductCostPrice" value="${formatNumberWithDots(modalProductState.costPrice)}" placeholder="Ví dụ: 1.800.000">
          <small style="font-size: 11px; color: #64748b; margin-top: 2px;">Giá nhập trung bình của các lần nhập hàng. Cần số liệu này để ước tính lãi khi bán.</small>
        </div>

        <!-- Số lượng tồn kho -->
        <div class="product-field-group">
          <label class="product-field-label" for="modalProductStock">
            <span>Số lượng tồn kho <span style="color: #dc2626;">*</span></span>
            ${hasVars ? `<small style="color: #15803d; font-weight: 700;">(Tổng tồn của ${modalProductState.variants.length} biến thể)</small>` : ""}
          </label>
          <input type="number" min="0" step="1" class="product-field-input ${errors.stock || errors.modalProductStock ? "is-invalid" : ""}" id="modalProductStock" value="${hasVars ? totalVariantStock : modalProductState.stock}" ${hasVars ? "readonly style='background: #f8fafc; font-weight: 700; color: #15803d;'" : ""} required>
          ${fieldError("stock", errors)}
          ${fieldError("modalProductStock", errors)}
        </div>

        <!-- Nhãn sản phẩm (Tags) -->
        <div class="product-field-group">
          <label class="product-field-label" for="modalProductTags">
            <span>Nhãn sản phẩm (Tags)</span>
            <small style="color: #64748b; font-weight: normal;">(phân tách bằng dấu phẩy)</small>
          </label>
          <input type="text" class="product-field-input" id="modalProductTags" value="${escapeHtml((modalProductState.tags || []).join(", "))}" placeholder="Eco, Best seller, Ergonomic">
        </div>
      </div>
    </div>

    <!-- NHÓM 2: ẢNH ĐẠI DIỆN CHÍNH -->
    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
      <h4 style="margin: 0 0 12px; font-size: 14px; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 6px;">
        ${renderIcon("image", { size: 16, strokeWidth: 1.8 })} 2. Ảnh sản phẩm chính
      </h4>
      <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 240px;">
          <label class="product-field-label" for="modalProductImage" style="margin-bottom: 5px;">
            <span>Đường dẫn ảnh chính <span style="color: #dc2626;">*</span></span>
            <small style="color: #64748b; font-weight: normal;">(./images/... hoặc URL)</small>
          </label>
          <input type="text" class="product-field-input ${errors.image || errors.modalProductImage ? "is-invalid" : ""}" id="modalProductImage" value="${escapeHtml(modalProductState.image || "")}" placeholder="./images/ban-nang-ha-mat-go.png" required>
          ${fieldError("image", errors)}
          ${fieldError("modalProductImage", errors)}
        </div>
        <div id="modalImagePreviewBox" style="width: 58px; height: 58px; border: 1.5px solid #cbd5e1; border-radius: 8px; overflow: hidden; background: #f8fafc; display: flex; align-items: center; justify-content: center; flex-shrink: 0;" title="Xem trước ảnh chính">
          <img id="modalImagePreviewImg" src="${escapeHtml(modalProductState.image || "")}" alt="Preview" style="width: 100%; height: 100%; object-fit: cover; display: ${modalProductState.image ? "block" : "none"};" onerror="this.style.display='none'; document.getElementById('modalImagePreviewIcon').style.display='flex';">
          <div id="modalImagePreviewIcon" style="display: ${modalProductState.image ? "none" : "flex"}; align-items: center; justify-content: center; color: #94a3b8;">
            <i data-lucide="image" style="width: 22px; height: 22px;"></i>
          </div>
        </div>
      </div>
    </div>

    <!-- NHÓM 3: BỘ SƯU TẬP HÌNH ẢNH (GALLERY) & LIÊN KẾT BIẾN THỂ -->
    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 10px;">
        <div>
          <h4 style="margin: 0; font-size: 14px; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 6px;">
            ${renderIcon("images", { size: 16, strokeWidth: 1.8 })} 3. Bộ sưu tập hình ảnh (Gallery) &amp; Liên kết thuộc tính
          </h4>
          <p style="margin: 3px 0 0; font-size: 12px; color: #64748b;">
            Thêm ảnh chi tiết, không gian bài trí. Ảnh có thể liên kết tự động với Màu sắc hoặc Biến thể khi khách chọn.
          </p>
        </div>
        <button type="button" id="modalAddGalleryItemBtn" class="btn-admin secondary" style="font-size: 12px; padding: 5px 12px; display: inline-flex; align-items: center; gap: 5px;">
          ${renderIcon("plus", { size: 14, strokeWidth: 1.8 })} Thêm ảnh vào gallery
        </button>
      </div>

      <div id="modalGalleryContainer" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; margin-top: 10px;">
        ${modalProductState.gallery.map((gItem, gIdx) => {
          const linkType = gItem.isGeneral ? "general" : (gItem.variantId ? "variant" : (gItem.attributeValue ? "attribute" : "general"));
          return `
            <div class="modal-gallery-card" data-gal-idx="${gIdx}" style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #f8fafc; display: flex; flex-direction: column; gap: 8px;">
              <div style="display: flex; gap: 10px; align-items: flex-start;">
                <div style="width: 64px; height: 64px; border-radius: 6px; border: 1px solid #cbd5e1; background: #fff; overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                  <img src="${escapeHtml(gItem.url || "./images/ban-nang-ha-mat-go.png")}" alt="Gallery" style="width: 100%; height: 100%; object-fit: contain;" onerror="this.src='./images/ban-nang-ha-mat-go.png'">
                </div>
                <div style="flex: 1; min-width: 0;">
                  <input type="text" class="product-field-input gal-url" value="${escapeHtml(gItem.url || "")}" placeholder="./images/... hoặc URL" style="font-size: 12px; padding: 5px 8px; margin-bottom: 5px; height: 30px;" title="Đường dẫn ảnh">
                  <input type="text" class="product-field-input gal-caption" value="${escapeHtml(gItem.caption || "")}" placeholder="Chú thích ảnh..." style="font-size: 12px; padding: 5px 8px; height: 30px;" title="Chú thích">
                </div>
              </div>

              <!-- Cấu hình liên kết -->
              <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; font-size: 12px;">
                <label style="display: block; font-weight: 600; color: #334155; margin-bottom: 4px;">Liên kết ảnh:</label>
                <select class="product-field-select gal-link-type" style="height: 28px; font-size: 11.5px; padding: 2px 6px; margin-bottom: 6px;">
                  <option value="general" ${linkType === "general" ? "selected" : ""}>Ảnh chung (không đổi biến thể)</option>
                  <option value="attribute" ${linkType === "attribute" ? "selected" : ""}>Liên kết thuộc tính (Màu sắc / Kích thước)</option>
                  <option value="variant" ${linkType === "variant" ? "selected" : ""}>Liên kết biến thể cụ thể (SKU)</option>
                </select>

                <div class="gal-attr-panel" style="display: ${linkType === "attribute" ? "flex" : "none"}; gap: 6px;">
                  <input type="text" class="product-field-input gal-attr-key" value="${escapeHtml(gItem.attributeKey || "Màu sắc")}" placeholder="Màu sắc..." style="height: 26px; font-size: 11.5px; width: 45%; padding: 2px 6px;">
                  <input type="text" class="product-field-input gal-attr-val" value="${escapeHtml(gItem.attributeValue || "")}" placeholder="Giá trị..." style="height: 26px; font-size: 11.5px; flex: 1; padding: 2px 6px;">
                </div>

                <div class="gal-var-panel" style="display: ${linkType === "variant" ? "block" : "none"};">
                  <select class="product-field-select gal-variant-id" style="height: 26px; font-size: 11.5px; padding: 2px 6px;">
                    <option value="">-- Chọn biến thể liên kết --</option>
                    ${modalProductState.variants.map((v) => `
                      <option value="${escapeHtml(v.id)}" ${gItem.variantId === v.id ? "selected" : ""}>
                        ${escapeHtml(cleanMojibake(v.name))} (${escapeHtml(v.sku || "No SKU")})
                      </option>
                    `).join("")}
                  </select>
                </div>
              </div>

              <!-- Nút thao tác ảnh -->
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2px;">
                <button type="button" class="btn-admin secondary set-main-image-btn" data-url="${escapeHtml(gItem.url || "")}" style="padding: 2px 8px; font-size: 11px; height: 26px; display: inline-flex; align-items: center; gap: 4px;">
                  ${renderIcon("star", { size: 12, strokeWidth: 1.8 })} Đặt làm ảnh chính
                </button>
                <button type="button" class="btn-admin danger remove-gal-btn" data-remove-gal="${gIdx}" style="padding: 2px 8px; font-size: 11px; height: 26px; display: inline-flex; align-items: center; gap: 4px;">
                  ${renderIcon("trash-2", { size: 12, strokeWidth: 1.8 })} Xóa
                </button>
              </div>
            </div>
          `;
        }).join("")}
      </div>

      ${modalProductState.gallery.length === 0 ? `
        <p style="color: #64748b; font-size: 12.5px; font-style: italic; padding: 12px; background: #f8fafc; border-radius: 6px; margin: 8px 0 0;">
          Chưa có ảnh trong gallery. Bấm "+ Thêm ảnh vào gallery" để bổ sung hình ảnh chi tiết.
        </p>
      ` : ""}
    </div>

    <!-- NHÓM 4: MÔ TẢ SẢN PHẨM -->
    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
      <h4 style="margin: 0 0 10px; font-size: 14px; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 6px;">
        ${renderIcon("file-text", { size: 16, strokeWidth: 1.8 })} 4. Mô tả chi tiết sản phẩm <span style="color: #dc2626;">*</span>
      </h4>
      <textarea class="product-field-textarea ${errors.description || errors.modalProductDesc ? "is-invalid" : ""}" id="modalProductDesc" rows="4" placeholder="Nhập ít nhất 15 ký tự giới thiệu tính năng, chất liệu, kích thước, công thái học..." required>${escapeHtml(modalProductState.description || "")}</textarea>
      ${fieldError("description", errors)}
      ${fieldError("modalProductDesc", errors)}
    </div>

    <!-- NHÓM 5: CẤU HÌNH NHÃN SẢN PHẨM MỚI -->
    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
        <div>
          <label style="display: inline-flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; cursor: pointer; color: #0f172a;">
            <input type="checkbox" id="modalNewBadgeEnabled" ${modalProductState.newBadge.enabled ? "checked" : ""} style="width: 17px; height: 17px; accent-color: #15803d;">
            <span>5. Hiển thị nhãn "Sản phẩm mới"</span>
          </label>
          <p style="font-size: 12px; color: #64748b; margin: 2px 0 0 25px;">
            Huy hiệu xanh "Mới" xuất hiện ở góc ảnh sản phẩm và trang chi tiết. Tự động tắt khi hết hạn.
          </p>
        </div>
        ${modalProductState.newBadge.enabled ? `
          <span style="display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 700; background: ${badgeStatus.status === 'active' ? '#dcfce7' : badgeStatus.status === 'upcoming' ? '#e0f2fe' : '#fee2e2'}; color: ${badgeStatus.status === 'active' ? '#15803d' : badgeStatus.status === 'upcoming' ? '#0369a1' : '#b91c1c'};">
            ● ${badgeStatus.label}
          </span>
        ` : ""}
      </div>

      ${modalProductState.newBadge.enabled ? `
        <div style="margin-top: 10px; border-top: 1px solid #e2e8f0; padding-top: 12px; background: #f8fafc; border-radius: 6px; padding: 12px;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; align-items: start;">
            <div>
              <label for="modalNewBadgeStartDate" style="display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 4px;">
                Ngày bắt đầu hiển thị <span style="color: #dc2626;">*</span>
              </label>
              <input type="date" class="product-field-input" id="modalNewBadgeStartDate" value="${escapeHtml(modalProductState.newBadge.startDate || getVietnamTodayString())}" style="height: 36px;">
              ${fieldError("newBadge_startDate", errors)}
            </div>

            <div>
              <label style="display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 4px;">
                Hình thức thời hạn
              </label>
              <div style="display: flex; gap: 12px; margin-top: 6px;">
                <label style="display: inline-flex; align-items: center; gap: 5px; font-size: 12px; cursor: pointer;">
                  <input type="radio" name="modalNewBadgeMode" value="months" ${modalProductState.newBadge.mode !== "custom" ? "checked" : ""}>
                  Số tháng
                </label>
                <label style="display: inline-flex; align-items: center; gap: 5px; font-size: 12px; cursor: pointer;">
                  <input type="radio" name="modalNewBadgeMode" value="custom" ${modalProductState.newBadge.mode === "custom" ? "checked" : ""}>
                  Ngày kết thúc
                </label>
              </div>
            </div>

            ${modalProductState.newBadge.mode !== "custom" ? `
              <div>
                <label for="modalNewBadgeMonths" style="display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 4px;">
                  Thời hạn hiển thị
                </label>
                <select class="product-field-select" id="modalNewBadgeMonths" style="height: 36px;">
                  <option value="1" ${Number(modalProductState.newBadge.months) === 1 ? "selected" : ""}>1 tháng</option>
                  <option value="2" ${Number(modalProductState.newBadge.months) === 2 || !modalProductState.newBadge.months ? "selected" : ""}>2 tháng (Mặc định)</option>
                  <option value="3" ${Number(modalProductState.newBadge.months) === 3 ? "selected" : ""}>3 tháng</option>
                  <option value="6" ${Number(modalProductState.newBadge.months) === 6 ? "selected" : ""}>6 tháng</option>
                  <option value="12" ${Number(modalProductState.newBadge.months) === 12 ? "selected" : ""}>1 năm (12 tháng)</option>
                </select>
                ${fieldError("newBadge_months", errors)}
              </div>
            ` : `
              <div>
                <label for="modalNewBadgeEndDate" style="display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 4px;">
                  Ngày kết thúc cụ thể <span style="color: #dc2626;">*</span>
                </label>
                <input type="date" class="product-field-input" id="modalNewBadgeEndDate" value="${escapeHtml(modalProductState.newBadge.endDate || "")}" style="height: 36px;">
                ${fieldError("newBadge_endDate", errors)}
              </div>
            `}
          </div>

          <div style="margin-top: 10px; padding: 8px 12px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="display: inline-block; padding: 2px 8px; border-radius: 999px; background: #15803d; color: white; font-size: 11px; font-weight: 800;">Mới</span>
              <span style="font-size: 12px; color: #065f46; font-weight: 500;">
                Nhãn sẽ hiển thị từ ngày <strong>${previewStartDate}</strong> đến hết ngày <strong>${previewEndDate}</strong>.
              </span>
            </div>
            <span style="font-size: 11.5px; color: #047857; font-weight: 600;">GMT+7 (Việt Nam)</span>
          </div>
        </div>
      ` : ""}
    </div>

    <!-- NHÓM 6: CẤU HÌNH KHUYẾN MÃI / GIẢM GIÁ -->
    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
        <div>
          <label style="display: inline-flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; cursor: pointer; color: #0f172a;">
            <input type="checkbox" id="modalDiscountEnabled" ${modalProductState.discount.enabled ? "checked" : ""} style="width: 17px; height: 17px; accent-color: #dc2626;">
            <span>6. Chương trình Khuyến mãi / Giảm giá theo lịch</span>
          </label>
          <p style="font-size: 12px; color: #64748b; margin: 2px 0 0 25px;">
            Lên lịch giảm giá % hoặc số tiền cố định. Đồng bộ giá sau giảm cho từng biến thể và tự động quay về giá thường khi hết hạn.
          </p>
        </div>
        ${modalProductState.discount.enabled ? `
          <span style="display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 700; background: ${promoStatus.status === 'active' ? '#fee2e2' : promoStatus.status === 'upcoming' ? '#e0f2fe' : '#f1f5f9'}; color: ${promoStatus.status === 'active' ? '#dc2626' : promoStatus.status === 'upcoming' ? '#0369a1' : '#64748b'};">
            ● ${promoStatus.label}
          </span>
        ` : ""}
      </div>

      ${modalProductState.discount.enabled ? `
        <div style="margin-top: 10px; border-top: 1px solid #e2e8f0; padding-top: 12px; background: #fff5f5; border-radius: 6px; padding: 12px; border: 1px solid #fed7d7;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; align-items: start;">
            <div>
              <label style="display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 4px;">
                Loại giảm giá
              </label>
              <div style="display: flex; gap: 12px; margin-top: 6px;">
                <label style="display: inline-flex; align-items: center; gap: 5px; font-size: 12px; cursor: pointer;">
                  <input type="radio" name="modalDiscountType" value="percentage" ${modalProductState.discount.type !== "fixed" ? "checked" : ""}>
                  Phần trăm (%)
                </label>
                <label style="display: inline-flex; align-items: center; gap: 5px; font-size: 12px; cursor: pointer;">
                  <input type="radio" name="modalDiscountType" value="fixed" ${modalProductState.discount.type === "fixed" ? "checked" : ""}>
                  Số tiền cố định (VNĐ)
                </label>
              </div>
            </div>

            <div>
              <label for="modalDiscountValue" style="display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 4px;">
                Mức giảm giá <span style="color: #dc2626;">*</span>
              </label>
              <div style="position: relative;">
                <input type="number" min="1" ${modalProductState.discount.type === "fixed" ? "step='1000'" : "max='99' step='1'"} class="product-field-input" id="modalDiscountValue" value="${modalProductState.discount.value || ""}" placeholder="${modalProductState.discount.type === "fixed" ? "Ví dụ: 200000" : "Ví dụ: 15"}" style="height: 36px; padding-right: 48px;">
                <span style="position: absolute; right: 10px; top: 9px; font-size: 12px; font-weight: 700; color: #64748b;">
                  ${modalProductState.discount.type === "fixed" ? "VNĐ" : "%"}
                </span>
              </div>
              ${fieldError("discount_value", errors)}
            </div>

            <div>
              <label for="modalDiscountStartAt" style="display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 4px;">
                Bắt đầu khuyến mãi <span style="color: #dc2626;">*</span>
              </label>
              <input type="datetime-local" class="product-field-input" id="modalDiscountStartAt" value="${escapeHtml(modalProductState.discount.startAt || "")}" style="height: 36px; font-size: 12px;">
              ${fieldError("discount_startAt", errors)}
            </div>

            <div>
              <label for="modalDiscountEndAt" style="display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 4px;">
                Kết thúc khuyến mãi <span style="color: #dc2626;">*</span>
              </label>
              <input type="datetime-local" class="product-field-input" id="modalDiscountEndAt" value="${escapeHtml(modalProductState.discount.endAt || "")}" style="height: 36px; font-size: 12px;">
              ${fieldError("discount_endAt", errors)}
            </div>
          </div>

          <div style="margin-top: 10px; padding: 10px 14px; background: #ffffff; border: 1px dashed #f87171; border-radius: 6px;">
            <strong style="font-size: 12px; color: #991b1b; display: flex; align-items: center; gap: 5px; margin-bottom: 4px;">
              ${renderIcon("tag", { size: 13, strokeWidth: 1.8 })} Xem trước giá bán khuyến mãi:
            </strong>
            <div style="display: flex; gap: 14px; align-items: baseline; flex-wrap: wrap;">
              <div>
                <span style="font-size: 11.5px; color: #64748b;">Giá gốc:</span>
                <del style="font-weight: 600; color: #94a3b8; margin-left: 3px;">${formatPrice(sampleBasePrice)}</del>
              </div>
              <div>
                <span style="font-size: 11.5px; color: #64748b;">Sau giảm:</span>
                <strong style="font-size: 15px; color: #dc2626; margin-left: 3px;">${formatPrice(discountCalc.price)}</strong>
              </div>
              <div>
                <span style="display: inline-flex; align-items: center; padding: 2px 7px; border-radius: 999px; background: #e54235; color: #fff; font-size: 11px; font-weight: 800;">
                  ${discountCalc.badgeText || (modalProductState.discount.type === "percentage" ? `-${modalProductState.discount.value}%` : "Đang giảm giá")}
                </span>
                <span style="font-size: 11.5px; color: #15803d; font-weight: 600; margin-left: 5px;">
                  (Tiết kiệm ${formatPrice(discountCalc.savings)} · ${discountCalc.percent}%)
                </span>
              </div>
            </div>
          </div>
        </div>
      ` : ""}
    </div>

    <!-- NHÓM 7: QUẢN LÝ BIẾN THỂ (VARIANTS) -->
    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
        <div>
          <label style="display: inline-flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; cursor: pointer; color: #0f172a;">
            <input type="checkbox" id="modalHasVariants" ${hasVars ? "checked" : ""} style="width: 17px; height: 17px; accent-color: #15803d;">
            <span>7. Sản phẩm có nhiều lựa chọn (Màu sắc, kích thước, phiên bản...)</span>
          </label>
          <p style="font-size: 12px; color: #64748b; margin: 2px 0 0 25px;">
            Thiết lập tồn kho, giá bán và hình ảnh riêng biệt cho từng biến thể để đồng bộ tức thì ra cửa hàng.
          </p>
        </div>
      </div>

      ${hasVars ? `
        <div style="margin-top: 12px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
          <!-- 1. Thuộc tính sản phẩm -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-bottom: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
              <strong style="font-size: 13px; color: #1e293b;">1. Khai báo thuộc tính sản phẩm</strong>
              <button type="button" id="modalAddAttributeBtn" class="btn-admin secondary" style="font-size: 11.5px; padding: 3px 8px;">
                + Thêm nhóm thuộc tính
              </button>
            </div>
            <div id="modalAttributesList" style="display: flex; flex-direction: column; gap: 8px;">
              ${modalProductState.attributes.map((attr, aIdx) => `
                <div class="modal-attr-group-row" style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;" data-attr-idx="${aIdx}">
                  <input type="text" class="product-field-input attr-name-input" value="${escapeHtml(attr.name)}" placeholder="Tên: Màu sắc..." style="width: 140px; height: 34px; font-size: 12.5px;">
                  <input type="text" class="product-field-input attr-values-input" value="${escapeHtml((attr.values || []).join(", "))}" placeholder="Các giá trị cách nhau bằng dấu phẩy, ví dụ: Đen, Trắng, Xám" style="flex: 1; min-width: 200px; height: 34px; font-size: 12.5px;">
                  <button type="button" class="btn-admin danger remove-attr-btn" style="padding: 2px 8px; height: 34px; font-size: 11.5px; display: inline-flex; align-items: center; gap: 4px;" data-remove-attr="${aIdx}">
                    ${renderIcon("x", { size: 13, strokeWidth: 1.8 })} Xóa
                  </button>
                </div>
              `).join("")}
            </div>
            <div style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap;">
              <button type="button" id="modalGenerateCombinationsBtn" class="btn-admin primary" style="font-size: 12px; padding: 6px 12px; display: inline-flex; align-items: center; gap: 5px; background: #0f766e; border-color: #0f766e;">
                ${renderIcon("zap", { size: 14, strokeWidth: 1.8 })} Tạo tổ hợp biến thể từ thuộc tính
              </button>
              <button type="button" id="modalAddSingleVariantBtn" class="btn-admin secondary" style="font-size: 12px; padding: 6px 12px;">
                + Thêm biến thể thủ công
              </button>
            </div>
          </div>

          <!-- 2. Danh sách biến thể -->
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
              <strong style="font-size: 13px; color: #1e293b;">
                2. Danh sách tổ hợp biến thể &amp; Tồn kho riêng (${modalProductState.variants.length} biến thể)
              </strong>
              <span style="font-size: 12.5px; font-weight: 700; color: #15803d;">
                Tổng tồn: ${totalVariantStock} chiếc
              </span>
            </div>
            ${fieldError("variants", errors)}

            ${modalProductState.variants.length === 0 ? `
              <p style="color: #64748b; font-size: 12px; font-style: italic; padding: 10px; background: #f8fafc; border-radius: 6px; margin: 4px 0 0;">
                Chưa có biến thể nào được tạo. Hãy nhấn "Tạo tổ hợp biến thể từ thuộc tính" hoặc "+ Thêm biến thể thủ công".
              </p>
            ` : `
              <div style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 6px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left; min-width: 720px;">
                  <thead style="background: #f1f5f9; color: #475569; font-weight: 700; border-bottom: 1px solid #cbd5e1;">
                    <tr>
                      <th style="padding: 6px 8px; min-width: 160px;">Tên tổ hợp / Lựa chọn</th>
                      <th style="padding: 6px 8px; min-width: 110px;">Mã SKU</th>
                      <th style="padding: 6px 8px; min-width: 110px;">Giá bán (VNĐ)</th>
                      <th style="padding: 6px 8px; min-width: 100px;">Giá sau giảm</th>
                      <th style="padding: 6px 8px; min-width: 75px;">Tồn kho</th>
                      <th style="padding: 6px 8px; min-width: 160px;">Ảnh / Chọn Gallery</th>
                      <th style="padding: 6px 8px; min-width: 95px;">Trạng thái</th>
                      <th style="padding: 6px 8px; width: 44px; text-align: center;"></th>
                    </tr>
                  </thead>
                  <tbody>
                    ${modalProductState.variants.map((v, vIdx) => {
                      const vPrice = Number(v.price) || 0;
                      const vCalc = calculateDiscountPricing(vPrice, modalProductState.discount);
                      return `
                        <tr style="border-bottom: 1px solid #f1f5f9;" data-variant-idx="${vIdx}">
                          <td style="padding: 6px 8px;">
                            <input type="text" class="product-field-input var-name" value="${escapeHtml(cleanMojibake(v.name || ""))}" placeholder="Tên biến thể" style="height: 30px; font-size: 12px;" required>
                            ${fieldError(`variant_${vIdx}_name`, errors)}
                          </td>
                          <td style="padding: 6px 8px;">
                            <input type="text" class="product-field-input var-sku" value="${escapeHtml(v.sku || "")}" placeholder="SKU" style="height: 30px; font-size: 12px;">
                          </td>
                          <td style="padding: 6px 8px;">
                            <input type="text" inputmode="numeric" class="product-field-input var-price" value="${formatNumberWithDots(v.price)}" placeholder="Giá" style="height: 30px; font-size: 12px;" required>
                            ${fieldError(`variant_${vIdx}_price`, errors)}
                          </td>
                          <td style="padding: 6px 8px;">
                            ${modalProductState.discount.enabled && vCalc.isValid ? `
                              <strong style="color: #dc2626; font-size: 12px;">${formatPrice(vCalc.price)}</strong>
                            ` : `<span style="color: #94a3b8; font-size: 11.5px;">${formatPrice(vPrice)}</span>`}
                          </td>
                          <td style="padding: 6px 8px;">
                            <input type="number" min="0" step="1" class="product-field-input var-stock" value="${v.stock ?? 0}" style="height: 30px; font-size: 12px; width: 68px; font-weight: 700; color: ${Number(v.stock) === 0 ? "#dc2626" : Number(v.stock) <= 15 ? "#d97706" : "#15803d"};" required>
                            ${fieldError(`variant_${vIdx}_stock`, errors)}
                          </td>
                          <td style="padding: 6px 8px;">
                            <input type="text" class="product-field-input var-image" value="${escapeHtml(v.image || "")}" placeholder="./images/... hoặc URL" style="height: 28px; font-size: 11.5px; margin-bottom: 3px;">
                            ${modalProductState.gallery.length > 0 ? `
                              <select class="product-field-select quick-gallery-picker" style="height: 24px; font-size: 11px; padding: 0 4px; color: #334155; background: #f8fafc;">
                                <option value="">-- Chọn ảnh Gallery --</option>
                                ${modalProductState.gallery.map((g) => `
                                  <option value="${escapeHtml(g.url)}" ${v.image === g.url ? "selected" : ""}>
                                    ${escapeHtml(g.caption || g.url.split('/').pop())}
                                  </option>
                                `).join("")}
                              </select>
                            ` : ""}
                          </td>
                          <td style="padding: 6px 8px;">
                            <select class="product-field-select var-status" style="height: 30px; font-size: 11.5px; padding: 0 4px;">
                              <option value="Còn hàng" ${v.status === "Còn hàng" || (!v.status && Number(v.stock) > 0) ? "selected" : ""}>Còn hàng</option>
                              <option value="Sắp hết" ${v.status === "Sắp hết" ? "selected" : ""}>Sắp hết</option>
                              <option value="Tạm hết hàng" ${v.status === "Tạm hết hàng" || Number(v.stock) === 0 ? "selected" : ""}>Tạm hết hàng</option>
                              <option value="Bản nháp" ${v.status === "Bản nháp" ? "selected" : ""}>Bản nháp</option>
                            </select>
                          </td>
                          <td style="padding: 6px 8px; text-align: center;">
                            <button type="button" class="remove-variant-btn" data-remove-variant="${vIdx}" style="background: none; border: none; color: #dc2626; cursor: pointer; padding: 4px;" title="Xóa biến thể">
                              ${renderIcon("trash-2", { size: 15, strokeWidth: 1.8 })}
                            </button>
                          </td>
                        </tr>
                      `;
                    }).join("")}
                  </tbody>
                </table>
              </div>
            `}
          </div>
        </div>
      ` : ""}
    </div>
  `;

  bindModalEvents(product);
  initIcons(body);
}

/**
 * Gắn các sự kiện tương tác bên trong biểu mẫu Modal
 */
function bindModalEvents(product = {}) {
  const body = document.getElementById("productModalBody");
  if (!body) return;

  // 1. Ảnh chính preview live
  const imageInp = body.querySelector("#modalProductImage");
  const previewImg = body.querySelector("#modalImagePreviewImg");
  const previewIcon = body.querySelector("#modalImagePreviewIcon");
  if (imageInp && previewImg && previewIcon) {
    imageInp.addEventListener("input", () => {
      const val = imageInp.value.trim();
      if (val) {
        previewImg.src = val;
        previewImg.style.display = "block";
        previewIcon.style.display = "none";
      } else {
        previewImg.style.display = "none";
        previewIcon.style.display = "flex";
      }
    });
  }

  // 2. Định dạng dấu chấm cho giá bán và giá vốn
  [body.querySelector("#modalProductPrice"), body.querySelector("#modalProductCostPrice")].forEach((inp) => {
    if (!inp) return;
    inp.addEventListener("input", () => {
      const cursor = inp.selectionStart;
      const len = inp.value.length;
      const formatted = formatNumberWithDots(inp.value);
      inp.value = formatted;
      const diff = formatted.length - len;
      try {
        inp.setSelectionRange(cursor + diff, cursor + diff);
      } catch (_) {}
    });
  });

  // 3. Toggle biến thể
  const toggleVars = body.querySelector("#modalHasVariants");
  if (toggleVars) {
    toggleVars.addEventListener("change", (e) => {
      syncModalStateFromInputs();
      modalProductState.hasVariants = e.target.checked;
      if (modalProductState.hasVariants && modalProductState.variants.length === 0) {
        generateCombinationsFromAttributes(product);
      }
      renderModalForm(product, {});
    });
  }

  // 4. Toggle nhãn Mới
  const toggleNewBadge = body.querySelector("#modalNewBadgeEnabled");
  if (toggleNewBadge) {
    toggleNewBadge.addEventListener("change", (e) => {
      syncModalStateFromInputs();
      modalProductState.newBadge.enabled = e.target.checked;
      renderModalForm(product, {});
    });
  }

  // 5. Radios mode nhãn Mới
  body.querySelectorAll("input[name='modalNewBadgeMode']").forEach((radio) => {
    radio.addEventListener("change", (e) => {
      syncModalStateFromInputs();
      modalProductState.newBadge.mode = e.target.value;
      renderModalForm(product, {});
    });
  });

  // 6. Thay đổi ngày / tháng nhãn Mới
  [body.querySelector("#modalNewBadgeStartDate"), body.querySelector("#modalNewBadgeMonths"), body.querySelector("#modalNewBadgeEndDate")].forEach((el) => {
    if (!el) return;
    el.addEventListener("change", () => {
      syncModalStateFromInputs();
      renderModalForm(product, {});
    });
  });

  // 7. Toggle Khuyến mãi
  const toggleDiscount = body.querySelector("#modalDiscountEnabled");
  if (toggleDiscount) {
    toggleDiscount.addEventListener("change", (e) => {
      syncModalStateFromInputs();
      modalProductState.discount.enabled = e.target.checked;
      renderModalForm(product, {});
    });
  }

  // 8. Radios type khuyến mãi
  body.querySelectorAll("input[name='modalDiscountType']").forEach((radio) => {
    radio.addEventListener("change", (e) => {
      syncModalStateFromInputs();
      modalProductState.discount.type = e.target.value;
      renderModalForm(product, {});
    });
  });

  // 9. Input giá trị & thời gian khuyến mãi
  [body.querySelector("#modalDiscountValue"), body.querySelector("#modalDiscountStartAt"), body.querySelector("#modalDiscountEndAt")].forEach((el) => {
    if (!el) return;
    el.addEventListener("change", () => {
      syncModalStateFromInputs();
      renderModalForm(product, {});
    });
  });

  // 10. Thêm ảnh gallery
  const addGalBtn = body.querySelector("#modalAddGalleryItemBtn");
  if (addGalBtn) {
    addGalBtn.addEventListener("click", () => {
      syncModalStateFromInputs();
      modalProductState.gallery.push({
        id: `gal-${Date.now()}-${modalProductState.gallery.length + 1}`,
        url: "",
        caption: "",
        isGeneral: true,
        attributeKey: "Màu sắc",
        attributeValue: "",
        variantId: ""
      });
      renderModalForm(product, {});
    });
  }

  // 11. Xóa ảnh gallery & Đặt làm ảnh chính
  body.querySelectorAll(".remove-gal-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      syncModalStateFromInputs();
      const idx = Number(btn.getAttribute("data-remove-gal"));
      modalProductState.gallery.splice(idx, 1);
      renderModalForm(product, {});
    });
  });

  body.querySelectorAll(".set-main-image-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = btn.getAttribute("data-url");
      if (url) {
        modalProductState.image = url;
        const mainImgInp = body.querySelector("#modalProductImage");
        if (mainImgInp) {
          mainImgInp.value = url;
          mainImgInp.dispatchEvent(new Event("input"));
        }
        showToast("Đã chọn ảnh này làm ảnh đại diện chính của sản phẩm.");
      }
    });
  });

  // 12. Thay đổi link type gallery
  body.querySelectorAll(".gal-link-type").forEach((sel) => {
    sel.addEventListener("change", () => {
      syncModalStateFromInputs();
      renderModalForm(product, {});
    });
  });

  // 13. Thuộc tính: Thêm nhóm, Xóa nhóm
  const addAttrBtn = body.querySelector("#modalAddAttributeBtn");
  if (addAttrBtn) {
    addAttrBtn.addEventListener("click", () => {
      syncModalStateFromInputs();
      modalProductState.attributes.push({
        name: `Thuộc tính ${modalProductState.attributes.length + 1}`,
        values: ["Lựa chọn 1"]
      });
      renderModalForm(product, {});
    });
  }

  body.querySelectorAll(".remove-attr-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      syncModalStateFromInputs();
      const idx = Number(btn.getAttribute("data-remove-attr"));
      modalProductState.attributes.splice(idx, 1);
      renderModalForm(product, {});
    });
  });

  // 14. Sinh tổ hợp biến thể
  const genBtn = body.querySelector("#modalGenerateCombinationsBtn");
  if (genBtn) {
    genBtn.addEventListener("click", () => {
      syncModalStateFromInputs();
      generateCombinationsFromAttributes(product);
      renderModalForm(product, {});
      showToast(`Đã tạo ${modalProductState.variants.length} tổ hợp biến thể.`);
    });
  }

  // 15. Thêm biến thể thủ công lẻ
  const addSingleBtn = body.querySelector("#modalAddSingleVariantBtn");
  if (addSingleBtn) {
    addSingleBtn.addEventListener("click", () => {
      syncModalStateFromInputs();
      const newIdx = modalProductState.variants.length + 1;
      const basePrice = modalProductState.price || 100000;
      const prodId = modalProductState.id || product.id || "P";
      modalProductState.variants.push({
        id: `${prodId}-VAR-${Date.now()}-${newIdx}`,
        sku: `${prodId}-VAR-${newIdx}`,
        name: `Lựa chọn mới ${newIdx}`,
        options: { "Lựa chọn": `Mẫu ${newIdx}` },
        price: basePrice,
        stock: 10,
        image: "",
        status: "Còn hàng"
      });
      renderModalForm(product, {});
    });
  }

  // 16. Xóa biến thể
  body.querySelectorAll(".remove-variant-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      syncModalStateFromInputs();
      const idx = Number(btn.getAttribute("data-remove-variant"));
      modalProductState.variants.splice(idx, 1);
      renderModalForm(product, {});
    });
  });

  // 17. Live sync giá và tồn kho biến thể -> Base price & Total stock
  body.querySelectorAll(".var-stock").forEach((inp) => {
    inp.addEventListener("input", () => {
      syncVariantsFromInputs();
      const totalStk = modalProductState.variants.reduce((sum, v) => sum + Math.max(0, Number(v.stock) || 0), 0);
      const stockField = body.querySelector("#modalProductStock");
      if (stockField && modalProductState.hasVariants) {
        stockField.value = totalStk;
      }
    });
  });

  body.querySelectorAll(".var-price").forEach((inp) => {
    inp.addEventListener("input", () => {
      const cursor = inp.selectionStart;
      const len = inp.value.length;
      const formatted = formatNumberWithDots(inp.value);
      inp.value = formatted;
      const diff = formatted.length - len;
      try { inp.setSelectionRange(cursor + diff, cursor + diff); } catch (_) {}

      syncVariantsFromInputs();
      const minP = modalProductState.variants.length > 0
        ? Math.min(...modalProductState.variants.map((v) => Number(v.price) || 0).filter((p) => p > 0))
        : 0;
      const priceField = body.querySelector("#modalProductPrice");
      if (priceField && modalProductState.hasVariants && minP > 0) {
        priceField.value = formatNumberWithDots(minP);
      }
    });
  });

  // 18. Quick gallery picker cho từng biến thể
  body.querySelectorAll(".quick-gallery-picker").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      const tr = e.target.closest("tr");
      const varImgInp = tr?.querySelector(".var-image");
      if (varImgInp && e.target.value) {
        varImgInp.value = e.target.value;
        syncVariantsFromInputs();
      }
    });
  });
}

/**
 * Thu thập và chuẩn hóa dữ liệu từ biểu mẫu thành đối tượng Product hoàn chỉnh
 */
function getNormalizedProductPayload() {
  syncModalStateFromInputs();

  const totalStock = modalProductState.hasVariants
    ? modalProductState.variants.reduce((sum, v) => sum + Math.max(0, Number(v.stock) || 0), 0)
    : Number(modalProductState.stock || 0);

  const minPrice = modalProductState.hasVariants && modalProductState.variants.length > 0
    ? Math.min(...modalProductState.variants.map((v) => Number(v.price) || 0).filter((p) => p > 0))
    : Number(modalProductState.price || 0);

  let aggregatedStatus = modalProductState.status || "Còn hàng";
  if (totalStock === 0) aggregatedStatus = "Hết hàng";
  else if (totalStock <= 15) aggregatedStatus = "Sắp hết";

  // Tự sinh mã nếu để trống (chỉ khi thêm mới)
  let finalId = modalProductState.id ? modalProductState.id.trim() : "";
  if (!finalId && !currentEditingProductId) {
    const products = getProducts();
    let maxNum = 0;
    products.forEach((p) => {
      const match = /^P(\d+)$/i.exec(p.id);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    finalId = `P${String(maxNum + 1).padStart(3, "0")}`;
    while (products.some((p) => p.id.toLowerCase() === finalId.toLowerCase())) {
      maxNum++;
      finalId = `P${String(maxNum).padStart(3, "0")}`;
    }
  } else if (!finalId && currentEditingProductId) {
    finalId = currentEditingProductId;
  }

  const existingProd = currentEditingProductId ? findProduct(currentEditingProductId) : null;
  const cleanGallery = deduplicateGalleryEntries(modalProductState.gallery);

  return {
    id: finalId,
    name: modalProductState.name,
    categoryId: modalProductState.categoryId,
    price: minPrice,
    costPrice: modalProductState.costPrice || null,
    stock: totalStock,
    status: aggregatedStatus,
    image: modalProductState.image,
    tags: normalizeProductTags(modalProductState.tags),
    description: modalProductState.description,
    hasVariants: Boolean(modalProductState.hasVariants),
    attributes: modalProductState.hasVariants ? modalProductState.attributes : [],
    variants: modalProductState.hasVariants ? modalProductState.variants : [],
    gallery: cleanGallery,
    galleryJson: JSON.stringify(cleanGallery),
    newBadge: modalProductState.newBadge,
    discount: modalProductState.discount,
    sold: existingProd ? (Number(existingProd.sold) || 0) : 0,
    rating: existingProd ? (Number(existingProd.rating) || 0) : 0,
    reviewCount: existingProd ? (Number(existingProd.reviewCount) || 0) : 0,
    createdAt: existingProd?.createdAt || new Date().toISOString().slice(0, 10)
  };
}

/**
 * Xử lý Submit biểu mẫu Modal
 */
async function submitProductModalForm(createPoAfter = false) {
  const payload = getNormalizedProductPayload();
  const errors = validateProduct(payload);

  // Kiểm tra trùng mã sản phẩm nếu thêm mới
  if (!currentEditingProductId && payload.id) {
    const products = getProducts();
    if (products.some((p) => p.id.toLowerCase() === payload.id.toLowerCase())) {
      errors.id = `Mã sản phẩm "${payload.id}" đã tồn tại. Vui lòng chọn mã khác.`;
    }
  }

  if (Object.keys(errors).length > 0) {
    renderModalForm(payload, errors);
    const firstErr = document.querySelector(".product-field-error.show");
    if (firstErr) {
      firstErr.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    showToast("Vui lòng kiểm tra và sửa các trường lỗi được đánh dấu màu đỏ.", "error");
    return;
  }

  const saveBtn = document.getElementById("productModalSaveBtn");
  const saveAndPoBtn = document.getElementById("productModalSaveAndPoBtn");
  const saveText = document.getElementById("productModalSaveText");

  if (saveBtn) saveBtn.disabled = true;
  if (saveAndPoBtn) saveAndPoBtn.disabled = true;
  if (saveText) saveText.textContent = "Đang lưu...";

  try {
    let saved = null;
    if (currentEditingProductId) {
      saved = await updateProduct(currentEditingProductId, payload);
      showToast(`Đã cập nhật sản phẩm "${payload.name}" (#${payload.id}) thành công!`);
    } else {
      saved = await createProduct(payload);
      showToast(`Đã thêm sản phẩm "${payload.name}" (#${payload.id}) thành công!`);
    }

    // Đóng modal sau khi lưu thành công
    closeProductModal(true);

    // Báo cho controller chính (admin.js) cập nhật giao diện
    if (typeof modalConfig.onProductSaved === "function") {
      modalConfig.onProductSaved(saved || payload, createPoAfter);
    }
  } catch (err) {
    console.error("Lỗi khi lưu sản phẩm:", err);
    showToast("Lỗi khi lưu sản phẩm: " + (err?.message || "Không thể lưu vào cơ sở dữ liệu"), "error");
  } finally {
    if (saveBtn) saveBtn.disabled = false;
    if (saveAndPoBtn) saveAndPoBtn.disabled = false;
    if (saveText) saveText.textContent = currentEditingProductId ? "Lưu thay đổi" : "Lưu sản phẩm";
  }
}

/**
 * Mở modal sản phẩm (Thêm mới hoặc Chỉnh sửa)
 */
export function openProductModal(triggerEl = null, productId = null) {
  const modal = document.getElementById("productModalBackdrop");
  const titleEl = document.getElementById("productModalTitle");
  const modeBadge = document.getElementById("productModalModeBadge");
  const saveText = document.getElementById("productModalSaveText");
  const saveAndPoBtn = document.getElementById("productModalSaveAndPoBtn");

  if (!modal) return;
  lastTriggerElement = triggerEl || document.activeElement;
  currentEditingProductId = productId ? String(productId) : null;

  const isEdit = Boolean(currentEditingProductId);
  let product = {};

  if (isEdit) {
    product = findProduct(currentEditingProductId) || {};
    if (!product || !product.id) {
      showToast(`Không tìm thấy sản phẩm có mã #${currentEditingProductId}`, "error");
      return;
    }
  }

  // Khôi phục form state
  modalProductState = {
    id: product.id || "",
    name: product.name || "",
    categoryId: product.categoryId || "",
    price: Number(product.price) || 0,
    costPrice: product.costPrice !== undefined && product.costPrice !== null ? Number(product.costPrice) : null,
    stock: product.stock !== undefined ? Number(product.stock) : 10,
    status: product.status || "Còn hàng",
    image: product.image || "",
    tags: Array.isArray(product.tags) ? [...product.tags] : normalizeProductTags(product.tagsRaw || ""),
    description: product.description || "",
    hasVariants: Boolean(product.hasVariants || (Array.isArray(product.variants) && product.variants.length > 0)),
    attributes: Array.isArray(product.attributes) && product.attributes.length > 0
      ? JSON.parse(JSON.stringify(product.attributes))
      : [
          { name: "Màu sắc", values: ["Gỗ Sồi tự nhiên", "Đen Stealth"] },
          { name: "Kích thước", values: ["120 x 60 cm", "140 x 70 cm"] }
        ],
    variants: Array.isArray(product.variants) ? JSON.parse(JSON.stringify(product.variants)) : [],
    gallery: Array.isArray(product.gallery) && product.gallery.length > 0
      ? JSON.parse(JSON.stringify(product.gallery))
      : (product.image ? [{ id: `gal-1`, url: product.image, caption: product.name || "", isGeneral: true }] : []),
    newBadge: product.newBadge
      ? (typeof product.newBadge === "string" ? JSON.parse(product.newBadge) : { ...product.newBadge })
      : {
          enabled: false,
          mode: "months",
          months: 2,
          startDate: getVietnamTodayString(),
          endDate: calculateNewBadgeEndDate(getVietnamTodayString(), 2)
        },
    discount: product.discount
      ? (typeof product.discount === "string" ? JSON.parse(product.discount) : { ...product.discount })
      : {
          enabled: false,
          type: "percentage",
          value: 15,
          startAt: getVietnamNowDateTimeString(),
          endAt: ""
        }
  };

  // Cập nhật Header & Button labels
  if (titleEl) {
    titleEl.textContent = isEdit ? `Chỉnh sửa sản phẩm: ${product.name || product.id}` : "Thêm sản phẩm";
  }
  if (modeBadge) {
    modeBadge.textContent = isEdit ? "Chỉnh sửa" : "Thêm mới";
    modeBadge.style.background = isEdit ? "#e0f2fe" : "#dcfce7";
    modeBadge.style.color = isEdit ? "#0369a1" : "#15803d";
    modeBadge.style.borderColor = isEdit ? "#7dd3fc" : "#86efac";
  }
  if (saveText) {
    saveText.textContent = isEdit ? "Lưu thay đổi" : "Lưu sản phẩm";
  }
  if (saveAndPoBtn) {
    saveAndPoBtn.style.display = isEdit ? "none" : "inline-flex";
  }

  // Render Form bên trong Modal Body
  renderModalForm(product, {});

  // Ghi nhận snapshot ban đầu để kiểm tra thay đổi chưa lưu (dirty check)
  initialSnapshotJson = JSON.stringify(getFormSnapshot());

  // Hiển thị modal
  modal.classList.add("show");
  document.body.style.overflow = "hidden";

  // Focus ô đầu tiên
  setTimeout(() => {
    const firstInp = document.getElementById("modalProductName") || document.getElementById("modalProductCode");
    if (firstInp) firstInp.focus();
  }, 80);
}

/**
 * Đóng Modal (có kiểm tra xác nhận nếu người dùng đã nhập liệu)
 */
export function closeProductModal(force = false) {
  const modal = document.getElementById("productModalBackdrop");
  if (!modal) return;

  if (!force && isFormDirty()) {
    const ok = window.confirm("Bạn có dữ liệu chưa lưu trong biểu mẫu. Bạn có chắc chắn muốn hủy bỏ và đóng cửa sổ không?");
    if (!ok) return;
  }

  modal.classList.remove("show");
  document.body.style.overflow = "";

  if (lastTriggerElement && typeof lastTriggerElement.focus === "function") {
    try { lastTriggerElement.focus(); } catch (_) {}
  }
}

/**
 * Khởi tạo Modal Sản phẩm và gắn sự kiện toàn cục
 */
export function initProductModal(config = {}) {
  modalConfig = { ...modalConfig, ...config };

  const modal = document.getElementById("productModalBackdrop");
  const form = document.getElementById("productModalForm");
  const closeBtn = document.getElementById("productModalCloseBtn");
  const cancelBtn = document.getElementById("productModalCancelBtn");
  const saveAndPoBtn = document.getElementById("productModalSaveAndPoBtn");

  if (!modal || !form) return;

  // Đóng modal khi bấm nút Đóng (X) hoặc Hủy
  if (closeBtn) closeBtn.onclick = () => closeProductModal(false);
  if (cancelBtn) cancelBtn.onclick = () => closeProductModal(false);

  // Đóng modal khi bấm ra ngoài lớp nền (Backdrop)
  modal.onclick = (e) => {
    if (e.target === modal) {
      closeProductModal(false);
    }
  };

  // Đóng modal khi nhấn phím Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("show")) {
      closeProductModal(false);
    }
  });

  // Submit Form: Lưu sản phẩm
  form.onsubmit = (e) => {
    e.preventDefault();
    submitProductModalForm(false);
  };

  // Submit Form: Lưu sản phẩm và tạo phiếu nhập đầu tiên
  if (saveAndPoBtn) {
    saveAndPoBtn.onclick = (e) => {
      e.preventDefault();
      submitProductModalForm(true);
    };
  }
}

