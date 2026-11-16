import {
  createProduct,
  findProduct,
  getCategories,
  initStore,
  updateProduct,
  getCurrentUser,
  normalizeProductTags,
  deduplicateGalleryEntries,
  cleanMojibake
} from "./storage.js";
import { $, getParam, showToast, formatPrice, redirectToLogin } from "./utils.js";
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

const form = $("#productForm");
const productId = getParam("id");
const isEdit = Boolean(productId);
let categories = [];

let formProductState = {
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

function fieldError(name, errors) {
  return `<small class="error-text" data-error="${name}" style="color: #dc2626; font-size: 12px; margin-top: 4px; display: ${errors[name] ? "block" : "none"};">${errors[name] || ""}</small>`;
}

function renderForm(product = {}, errors = {}) {
  const hasVars = Boolean(formProductState.hasVariants);
  const totalVariantStock = formProductState.variants.reduce((sum, v) => sum + Math.max(0, Number(v.stock) || 0), 0);
  const minVariantPrice = formProductState.variants.length > 0
    ? Math.min(...formProductState.variants.map((v) => Number(v.price) || 0).filter((p) => p > 0))
    : (product.price || 0);

  // Tính toán trạng thái xem trước cho Nhãn Mới
  const badgeStatus = getNewBadgeStatus({ newBadge: formProductState.newBadge });
  const previewStartDate = formProductState.newBadge.startDate || getVietnamTodayString();
  const previewEndDate = formProductState.newBadge.mode === "custom"
    ? (formProductState.newBadge.endDate || "—")
    : calculateNewBadgeEndDate(previewStartDate, Number(formProductState.newBadge.months) || 2);

  // Tính toán xem trước cho Khuyến Mãi
  const sampleBasePrice = hasVars && minVariantPrice > 0 ? minVariantPrice : (Number(product.price) || 1000000);
  const discountCalc = calculateDiscountPricing(sampleBasePrice, formProductState.discount);
  const promoStatus = getDiscountPromotionStatus({ discount: formProductState.discount });

  form.innerHTML = `
    <div class="field">
      <label for="name">Tên sản phẩm <span style="color: #dc2626;">*</span></label>
      <input class="input" id="name" name="name" value="${product.name || ""}" placeholder="Ví dụ: Bàn nâng hạ Epione SmartDesk">
      ${fieldError("name", errors)}
    </div>
    <div class="field">
      <label for="categoryId">Danh mục <span style="color: #dc2626;">*</span></label>
      <select class="select" id="categoryId" name="categoryId">
        <option value="">Chọn danh mục</option>
        ${categories.map((category) => `<option value="${category.id}" ${product.categoryId === category.id ? "selected" : ""}>${category.name}</option>`).join("")}
      </select>
      ${fieldError("categoryId", errors)}
    </div>
    <div class="field">
      <label for="price">Giá bán cơ sở (VNĐ) <span style="color: #dc2626;">*</span> ${hasVars ? `<small style="font-weight: normal; color: #15803d;">(Tự lấy giá nhỏ nhất từ biến thể)</small>` : ""}</label>
      <input class="input" id="price" name="price" type="text" inputmode="numeric" autocomplete="off" placeholder="Ví dụ: 3.500.000" value="${hasVars && minVariantPrice > 0 ? String(minVariantPrice).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : (product.price ? String(product.price).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : "")}" ${hasVars ? "readonly style='background: #f8fafc;'" : ""}>
      ${fieldError("price", errors)}
    </div>
    <div class="field">
      <label for="stock">Số lượng tồn kho <span style="color: #dc2626;">*</span> ${hasVars ? `<small style="font-weight: normal; color: #15803d;">(Tổng tồn của ${formProductState.variants.length} biến thể)</small>` : ""}</label>
      <input class="input" id="stock" name="stock" type="number" min="0" value="${hasVars ? totalVariantStock : (product.stock ?? "")}" ${hasVars ? "readonly style='background: #f8fafc; font-weight: bold; color: #15803d;'" : ""}>
      ${fieldError("stock", errors)}
    </div>
    <div class="field full">
      <label for="image">Link ảnh sản phẩm chính <span style="color: #dc2626;">*</span></label>
      <input class="input" id="image" name="image" value="${product.image || ""}" placeholder="./images/... hoặc https://...">
      ${fieldError("image", errors)}
    </div>

    <!-- ==================== KHU VỰC: QUẢN LÝ BỘ SƯU TẬP ẢNH (GALLERY) & LIÊN KẾT BIẾN THỂ ==================== -->
    <div class="field full" style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 18px; background: #ffffff; margin-top: 10px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
        <div>
          <strong style="font-size: 1rem; color: #0f172a; display: flex; align-items: center; gap: 8px;">
            ${renderIcon("image", { size: 18, strokeWidth: 1.8 })} Quản lý bộ sưu tập hình ảnh (Gallery) & Liên kết biến thể
          </strong>
          <p style="font-size: 0.85rem; color: #64748b; margin-top: 4px;">
            Thêm ảnh chụp chi tiết, ảnh phối cảnh không gian. Phân loại <strong>"Ảnh chung"</strong> (không đổi biến thể khi khách bấm) hoặc <strong>"Liên kết thuộc tính / Biến thể"</strong> (tự động chuyển ảnh theo màu sắc / phiên bản và ngược lại).
          </p>
        </div>
        <button type="button" id="addGalleryItemBtn" class="btn" style="padding: 6px 14px; font-size: 0.85rem; background: #1f7a5c; display: inline-flex; align-items: center; gap: 6px;">
          ${renderIcon("plus", { size: 15, strokeWidth: 1.8 })} Thêm ảnh vào gallery
        </button>
      </div>

      <!-- Danh sách ảnh trong gallery -->
      <div id="galleryItemsContainer" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; margin-top: 12px;">
        ${formProductState.gallery.map((gItem, gIdx) => {
          const linkType = gItem.isGeneral ? "general" : (gItem.variantId ? "variant" : (gItem.attributeValue ? "attribute" : "general"));
          return `
            <div class="gallery-card" data-gal-idx="${gIdx}" style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #f8fafc; display: flex; flex-direction: column; gap: 8px; position: relative;">
              <div style="display: flex; gap: 10px; align-items: flex-start;">
                <div style="width: 72px; height: 72px; border-radius: 6px; border: 1px solid #cbd5e1; background: #fff; overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                  <img src="${gItem.url || "./images/ban-nang-ha-mat-go.png"}" alt="Preview" style="width: 100%; height: 100%; object-fit: contain;" onerror="this.src='./images/ban-nang-ha-mat-go.png'">
                </div>
                <div style="flex: 1; min-width: 0;">
                  <input type="text" class="input gal-url" value="${gItem.url || ""}" placeholder="./images/... hoặc URL" style="height: 32px; font-size: 0.82rem; margin-bottom: 6px;" title="Đường dẫn ảnh">
                  <input type="text" class="input gal-caption" value="${gItem.caption || ""}" placeholder="Mô tả / chú thích ảnh" style="height: 32px; font-size: 0.82rem;" title="Mô tả ảnh">
                </div>
              </div>

              <!-- Cấu hình liên kết -->
              <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; font-size: 0.82rem;">
                <label style="display: block; font-weight: 600; color: #334155; margin-bottom: 4px;">Liên kết ảnh:</label>
                <select class="select gal-link-type" style="height: 30px; font-size: 0.82rem; margin-bottom: 6px;">
                  <option value="general" ${linkType === "general" ? "selected" : ""}>Ảnh chung (không đổi lựa chọn)</option>
                  <option value="attribute" ${linkType === "attribute" ? "selected" : ""}>Liên kết thuộc tính (Màu sắc / Kích thước)</option>
                  <option value="variant" ${linkType === "variant" ? "selected" : ""}>Liên kết biến thể cụ thể (SKU / Tổ hợp)</option>
                </select>

                <!-- Panel liên kết thuộc tính -->
                <div class="gal-attr-panel" style="display: ${linkType === "attribute" ? "flex" : "none"}; gap: 6px;">
                  <input type="text" class="input gal-attr-key" value="${gItem.attributeKey || "Màu sắc"}" placeholder="Tên: Màu sắc..." style="height: 28px; font-size: 0.8rem; width: 45%;">
                  <input type="text" class="input gal-attr-val" value="${gItem.attributeValue || ""}" placeholder="Giá trị: Gỗ Sồi..." style="height: 28px; font-size: 0.8rem; flex: 1;">
                </div>

                <!-- Panel liên kết biến thể -->
                <div class="gal-var-panel" style="display: ${linkType === "variant" ? "block" : "none"};">
                  <select class="select gal-variant-id" style="height: 28px; font-size: 0.8rem;">
                    <option value="">-- Chọn biến thể liên kết --</option>
                    ${formProductState.variants.map((v) => `
                      <option value="${v.id}" ${gItem.variantId === v.id ? "selected" : ""}>${cleanMojibake(v.name)} (${v.sku || "No SKU"})</option>
                    `).join("")}
                  </select>
                </div>
              </div>

              <!-- Thao tác ảnh -->
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                <button type="button" class="btn-outline set-main-image-btn" data-url="${gItem.url}" style="padding: 2px 8px; font-size: 0.78rem; height: 26px; display: inline-flex; align-items: center; gap: 4px;">
                  ${renderIcon("star", { size: 12, strokeWidth: 1.8 })} Đặt làm ảnh chính
                </button>
                <button type="button" class="btn-outline remove-gal-btn" data-remove-gal="${gIdx}" style="padding: 2px 8px; font-size: 0.78rem; height: 26px; color: #dc2626; border-color: #fecaca; display: inline-flex; align-items: center; gap: 4px;">
                  ${renderIcon("trash-2", { size: 12, strokeWidth: 1.8 })} Xóa ảnh
                </button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
      ${formProductState.gallery.length === 0 ? `
        <p style="color: #64748b; font-size: 0.88rem; font-style: italic; padding: 12px; background: #f8fafc; border-radius: 6px; margin-top: 8px;">
          Chưa có ảnh gallery nào. Bấm "+ Thêm ảnh vào gallery" để thêm ảnh góc chụp, không gian setup và liên kết biến thể.
        </p>
      ` : ""}
    </div>
    <div class="field full">
      <label for="description">Mô tả sản phẩm <span style="color: #dc2626;">*</span></label>
      <textarea class="textarea" id="description" name="description" placeholder="Nhập ít nhất 15 ký tự mô tả...">${product.description || ""}</textarea>
      ${fieldError("description", errors)}
    </div>
    <div class="field">
      <label for="status">Trạng thái kinh doanh</label>
      <select class="select" id="status" name="status">
        <option ${product.status === "Còn hàng" ? "selected" : ""}>Còn hàng</option>
        <option ${product.status === "Sắp hết" ? "selected" : ""}>Sắp hết</option>
        <option ${product.status === "Hết hàng" ? "selected" : ""}>Hết hàng</option>
        <option ${product.status === "Ngừng kinh doanh" ? "selected" : ""}>Ngừng kinh doanh</option>
        <option ${product.status === "Bản nháp" ? "selected" : ""}>Bản nháp</option>
      </select>
    </div>
    <div class="field">
      <label for="tags">Nhãn sản phẩm</label>
      <input class="input" id="tags" name="tags" placeholder="Eco, Best seller" value="${(product.tags || []).join(", ")}">
    </div>

    <!-- ==================== KHU VỰC 1: CẤU HÌNH NHÃN SẢN PHẨM MỚI ==================== -->
    <div class="field full" style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 18px; background: #ffffff; margin-top: 10px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
        <div>
          <label style="display: inline-flex; align-items: center; gap: 8px; font-weight: 700; font-size: 1rem; cursor: pointer; color: #0f172a;">
            <input type="checkbox" id="newBadgeEnabledCheck" ${formProductState.newBadge.enabled ? "checked" : ""} style="width: 18px; height: 18px; accent-color: #1f7a5c;">
            <span>Hiển thị nhãn "Sản phẩm mới"</span>
          </label>
          <p style="font-size: 0.85rem; color: #64748b; margin-top: 4px; margin-left: 26px;">
            Hiển thị huy hiệu xanh "Mới" ở góc ảnh sản phẩm và trang chi tiết theo lịch hẹn. Tự động ẩn khi hết hạn.
          </p>
        </div>
        ${formProductState.newBadge.enabled ? `
          <div>
            <span style="display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; background: ${badgeStatus.status === 'active' ? '#dcfce7' : badgeStatus.status === 'upcoming' ? '#e0f2fe' : '#fee2e2'}; color: ${badgeStatus.status === 'active' ? '#15803d' : badgeStatus.status === 'upcoming' ? '#0369a1' : '#b91c1c'};">
              ● ${badgeStatus.label}
            </span>
          </div>
        ` : ""}
      </div>

      ${formProductState.newBadge.enabled ? `
        <div id="newBadgeConfigSection" style="margin-top: 12px; border-top: 1px solid #e2e8f0; padding-top: 14px; background: #f8fafc; border-radius: 6px; padding: 14px;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; align-items: start;">
            <div>
              <label for="newBadgeStartDate" style="display: block; font-size: 0.85rem; font-weight: 600; color: #334155; margin-bottom: 4px;">
                Ngày bắt đầu hiển thị <span style="color: #dc2626;">*</span>
              </label>
              <input type="date" class="input" id="newBadgeStartDate" value="${formProductState.newBadge.startDate || getVietnamTodayString()}" style="height: 38px; font-size: 0.88rem;">
              ${fieldError("newBadge_startDate", errors)}
            </div>

            <div>
              <label style="display: block; font-size: 0.85rem; font-weight: 600; color: #334155; margin-bottom: 4px;">
                Hình thức thời hạn
              </label>
              <div style="display: flex; gap: 14px; margin-top: 8px;">
                <label style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.85rem; cursor: pointer;">
                  <input type="radio" name="newBadgeMode" value="months" ${formProductState.newBadge.mode !== "custom" ? "checked" : ""}>
                  Số tháng (đề xuất 2 tháng)
                </label>
                <label style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.85rem; cursor: pointer;">
                  <input type="radio" name="newBadgeMode" value="custom" ${formProductState.newBadge.mode === "custom" ? "checked" : ""}>
                  Ngày kết thúc cụ thể
                </label>
              </div>
            </div>

            ${formProductState.newBadge.mode !== "custom" ? `
              <div>
                <label for="newBadgeMonths" style="display: block; font-size: 0.85rem; font-weight: 600; color: #334155; margin-bottom: 4px;">
                  Thời hạn hiển thị
                </label>
                <select class="select" id="newBadgeMonths" style="height: 38px; font-size: 0.88rem;">
                  <option value="1" ${Number(formProductState.newBadge.months) === 1 ? "selected" : ""}>1 tháng</option>
                  <option value="2" ${Number(formProductState.newBadge.months) === 2 || !formProductState.newBadge.months ? "selected" : ""}>2 tháng (Mặc định)</option>
                  <option value="3" ${Number(formProductState.newBadge.months) === 3 ? "selected" : ""}>3 tháng</option>
                  <option value="6" ${Number(formProductState.newBadge.months) === 6 ? "selected" : ""}>6 tháng</option>
                  <option value="12" ${Number(formProductState.newBadge.months) === 12 ? "selected" : ""}>1 năm (12 tháng)</option>
                </select>
                ${fieldError("newBadge_months", errors)}
              </div>
            ` : `
              <div>
                <label for="newBadgeEndDate" style="display: block; font-size: 0.85rem; font-weight: 600; color: #334155; margin-bottom: 4px;">
                  Ngày kết thúc cụ thể <span style="color: #dc2626;">*</span>
                </label>
                <input type="date" class="input" id="newBadgeEndDate" value="${formProductState.newBadge.endDate || ""}" style="height: 38px; font-size: 0.88rem;">
                ${fieldError("newBadge_endDate", errors)}
              </div>
            `}
          </div>

          <div style="margin-top: 12px; padding: 10px 14px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="display: inline-block; padding: 3px 9px; border-radius: 999px; background: #1f7a5c; color: white; font-size: 11px; font-weight: 800;">Mới</span>
              <span style="font-size: 0.86rem; color: #065f46; font-weight: 500;">
                Nhãn sẽ hiển thị từ ngày <strong>${previewStartDate}</strong> đến hết ngày <strong>${previewEndDate}</strong>.
              </span>
            </div>
            <span style="font-size: 0.8rem; color: #047857; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
              ${renderIcon("clock", { size: 13, strokeWidth: 1.8 })} Múi giờ Việt Nam (GMT+7)
            </span>
          </div>
        </div>
      ` : ""}
    </div>

    <!-- ==================== KHU VỰC 2: CẤU HÌNH KHUYẾN MÃI / GIẢM GIÁ ==================== -->
    <div class="field full" style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 18px; background: #ffffff; margin-top: 10px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
        <div>
          <label style="display: inline-flex; align-items: center; gap: 8px; font-weight: 700; font-size: 1rem; cursor: pointer; color: #0f172a;">
            <input type="checkbox" id="discountEnabledCheck" ${formProductState.discount.enabled ? "checked" : ""} style="width: 18px; height: 18px; accent-color: #dc2626;">
            <span>Chương trình Khuyến mãi / Giảm giá theo lịch</span>
          </label>
          <p style="font-size: 0.85rem; color: #64748b; margin-top: 4px; margin-left: 26px;">
            Lên lịch giảm giá % hoặc số tiền cố định. Đồng bộ giá sau giảm cho từng phiên bản/biến thể và tự động quay về giá thường khi hết hạn.
          </p>
        </div>
        ${formProductState.discount.enabled ? `
          <div>
            <span style="display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; background: ${promoStatus.status === 'active' ? '#fee2e2' : promoStatus.status === 'upcoming' ? '#e0f2fe' : '#f1f5f9'}; color: ${promoStatus.status === 'active' ? '#dc2626' : promoStatus.status === 'upcoming' ? '#0369a1' : '#64748b'};">
              ● ${promoStatus.label}
            </span>
          </div>
        ` : ""}
      </div>

      ${formProductState.discount.enabled ? `
        <div id="discountConfigSection" style="margin-top: 12px; border-top: 1px solid #e2e8f0; padding-top: 14px; background: #fff5f5; border-radius: 6px; padding: 14px; border: 1px solid #fed7d7;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; align-items: start;">
            <div>
              <label style="display: block; font-size: 0.85rem; font-weight: 600; color: #334155; margin-bottom: 4px;">
                Loại giảm giá
              </label>
              <div style="display: flex; gap: 14px; margin-top: 8px;">
                <label style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.85rem; cursor: pointer;">
                  <input type="radio" name="discountType" value="percentage" ${formProductState.discount.type !== "fixed" ? "checked" : ""}>
                  Phần trăm (%)
                </label>
                <label style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.85rem; cursor: pointer;">
                  <input type="radio" name="discountType" value="fixed" ${formProductState.discount.type === "fixed" ? "checked" : ""}>
                  Số tiền cố định (VNĐ)
                </label>
              </div>
            </div>

            <div>
              <label for="discountValue" style="display: block; font-size: 0.85rem; font-weight: 600; color: #334155; margin-bottom: 4px;">
                Mức giảm giá <span style="color: #dc2626;">*</span>
              </label>
              <div style="position: relative;">
                <input type="number" min="1" ${formProductState.discount.type === "fixed" ? "step='1000'" : "max='99' step='1'"} class="input" id="discountValue" value="${formProductState.discount.value || ""}" placeholder="${formProductState.discount.type === "fixed" ? "Ví dụ: 200000" : "Ví dụ: 15"}" style="height: 38px; font-size: 0.88rem; padding-right: 50px;">
                <span style="position: absolute; right: 12px; top: 9px; font-size: 0.85rem; font-weight: 700; color: #64748b;">
                  ${formProductState.discount.type === "fixed" ? "VNĐ" : "%"}
                </span>
              </div>
              ${fieldError("discount_value", errors)}
            </div>

            <div>
              <label for="discountStartAt" style="display: block; font-size: 0.85rem; font-weight: 600; color: #334155; margin-bottom: 4px;">
                Ngày giờ bắt đầu <span style="color: #dc2626;">*</span>
              </label>
              <input type="datetime-local" class="input" id="discountStartAt" value="${formProductState.discount.startAt || ""}" style="height: 38px; font-size: 0.88rem;">
              ${fieldError("discount_startAt", errors)}
            </div>

            <div>
              <label for="discountEndAt" style="display: block; font-size: 0.85rem; font-weight: 600; color: #334155; margin-bottom: 4px;">
                Ngày giờ kết thúc <span style="color: #dc2626;">*</span>
              </label>
              <input type="datetime-local" class="input" id="discountEndAt" value="${formProductState.discount.endAt || ""}" style="height: 38px; font-size: 0.88rem;">
              ${fieldError("discount_endAt", errors)}
            </div>
          </div>

          <div style="margin-top: 14px; padding: 12px 16px; background: #ffffff; border: 1px dashed #f87171; border-radius: 6px;">
            <strong style="font-size: 0.85rem; color: #991b1b; display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
              ${renderIcon("tag", { size: 14, strokeWidth: 1.8 })} Xem trước hiển thị giá khi áp dụng khuyến mãi:
            </strong>
            <div style="display: flex; gap: 18px; align-items: baseline; flex-wrap: wrap;">
              <div>
                <span style="font-size: 0.8rem; color: #64748b;">Giá gốc đối chiếu:</span>
                <del style="font-weight: 600; color: #94a3b8; margin-left: 4px;">${formatPrice(sampleBasePrice)}</del>
              </div>
              <div>
                <span style="font-size: 0.8rem; color: #64748b;">Giá bán sau giảm:</span>
                <strong style="font-size: 1.15rem; color: #dc2626; margin-left: 4px;">${formatPrice(discountCalc.price)}</strong>
              </div>
              <div>
                <span style="display: inline-flex; align-items: center; padding: 3px 8px; border-radius: 999px; background: #e54235; color: #fff; font-size: 0.75rem; font-weight: 800;">
                  ${discountCalc.badgeText || (formProductState.discount.type === "percentage" ? `-${formProductState.discount.value}%` : "Đang giảm giá")}
                </span>
                <span style="font-size: 0.8rem; color: #15803d; font-weight: 600; margin-left: 6px;">
                  (Tiết kiệm ${formatPrice(discountCalc.savings)} · ${discountCalc.percent}%)
                </span>
              </div>
            </div>
            ${!discountCalc.isValid ? `
              <p style="margin-top: 6px; font-size: 0.82rem; color: #dc2626; font-weight: 600; display: flex; align-items: center; gap: 5px;">
                ${renderIcon("alert-triangle", { size: 14, strokeWidth: 1.8 })} Chú ý: Mức giảm làm giá bán nhỏ hơn hoặc bằng 0đ hoặc vượt quá giá gốc. Vui lòng điều chỉnh lại mức giảm.
              </p>
            ` : ""}
          </div>
        </div>
      ` : ""}
    </div>

    <!-- ==================== KHU VỰC 3: QUẢN LÝ BIẾN THỂ (VARIANTS) ==================== -->
    <div class="field full" style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 18px; background: #ffffff; margin-top: 10px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
        <div>
          <label style="display: inline-flex; align-items: center; gap: 8px; font-weight: 700; font-size: 1rem; cursor: pointer; color: #0f172a;">
            <input type="checkbox" id="toggleVariantsCheck" ${hasVars ? "checked" : ""} style="width: 18px; height: 18px; accent-color: #15803d;">
            <span>Sản phẩm có nhiều lựa chọn (Màu sắc, kích thước, phiên bản, cấu hình...)</span>
          </label>
          <p style="font-size: 0.85rem; color: #64748b; margin-top: 4px; margin-left: 26px;">
            Khi bật, bạn có thể thiết lập tồn kho, giá bán và hình ảnh riêng biệt cho từng lựa chọn để đồng bộ thời gian thực ra cửa hàng.
          </p>
        </div>
      </div>

      ${hasVars ? `
        <div id="variantsBuilderSection" style="margin-top: 14px; border-top: 1px solid #e2e8f0; padding-top: 14px;">
          <!-- 1. Cấu hình thuộc tính -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <strong style="font-size: 0.9rem; color: #1e293b;">1. Khai báo thuộc tính sản phẩm</strong>
              <button type="button" id="addAttributeBtn" class="btn-outline" style="padding: 4px 10px; font-size: 0.82rem;">+ Thêm nhóm thuộc tính</button>
            </div>
            <div id="attributesList" style="display: flex; flex-direction: column; gap: 10px;">
              ${formProductState.attributes.map((attr, aIdx) => `
                <div class="attr-group-row" style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;" data-attr-idx="${aIdx}">
                  <input type="text" class="input attr-name-input" value="${attr.name}" placeholder="Tên: Màu sắc, Kích thước..." style="width: 160px; height: 36px; font-size: 0.88rem;">
                  <input type="text" class="input attr-values-input" value="${(attr.values || []).join(", ")}" placeholder="Các giá trị cách nhau bằng dấu phẩy, ví dụ: Đen, Trắng, Xám" style="flex: 1; min-width: 220px; height: 36px; font-size: 0.88rem;">
                  <button type="button" class="btn-outline remove-attr-btn" style="padding: 4px 8px; color: #dc2626; border-color: #fecaca; height: 36px; display: inline-flex; align-items: center; gap: 4px;" data-remove-attr="${aIdx}">
                    ${renderIcon("x", { size: 14, strokeWidth: 1.8 })} Xóa
                  </button>
                </div>
              `).join("")}
            </div>
            <div style="margin-top: 12px; display: flex; gap: 10px;">
              <button type="button" id="generateCombinationsBtn" class="btn" style="padding: 6px 14px; font-size: 0.85rem; background: #0f766e; display: inline-flex; align-items: center; gap: 6px;">
                ${renderIcon("zap", { size: 15, strokeWidth: 1.8 })} Tạo / Cập nhật tổ hợp biến thể từ thuộc tính
              </button>
              <button type="button" id="addSingleVariantBtn" class="btn-outline" style="padding: 6px 14px; font-size: 0.85rem;">
                + Thêm biến thể thủ công
              </button>
            </div>
          </div>

          <!-- 2. Bảng danh sách các biến thể -->
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <strong style="font-size: 0.9rem; color: #1e293b;">
                2. Danh sách tổ hợp biến thể & Tồn kho riêng (${formProductState.variants.length} biến thể)
              </strong>
              <span style="font-size: 0.85rem; font-weight: 600; color: #15803d;">
                Tổng tồn: ${totalVariantStock} chiếc
              </span>
            </div>
            ${fieldError("variants", errors)}

            ${formProductState.variants.length === 0 ? `
              <p style="color: #64748b; font-size: 0.88rem; font-style: italic; padding: 12px; background: #f8fafc; border-radius: 6px;">
                Chưa có biến thể nào được tạo. Hãy nhấn "Tạo tổ hợp biến thể từ thuộc tính" hoặc "+ Thêm biến thể thủ công".
              </p>
            ` : `
              <div style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 6px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.86rem; text-align: left;">
                  <thead style="background: #f1f5f9; color: #475569; font-weight: 700; border-bottom: 1px solid #cbd5e1;">
                    <tr>
                      <th style="padding: 8px 10px; min-width: 180px;">Tên tổ hợp / Lựa chọn</th>
                      <th style="padding: 8px 10px; min-width: 120px;">Mã SKU</th>
                      <th style="padding: 8px 10px; min-width: 120px;">Giá gốc (VNĐ)</th>
                      <th style="padding: 8px 10px; min-width: 120px;">Giá sau giảm (dự kiến)</th>
                      <th style="padding: 8px 10px; min-width: 90px;">Tồn kho</th>
                      <th style="padding: 8px 10px; min-width: 180px;">Link ảnh & Chọn từ Gallery</th>
                      <th style="padding: 8px 10px; min-width: 110px;">Trạng thái</th>
                      <th style="padding: 8px 10px; width: 60px; text-align: center;">Xóa</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${formProductState.variants.map((v, vIdx) => {
                      const vPrice = Number(v.price) || 0;
                      const vCalc = calculateDiscountPricing(vPrice, formProductState.discount);
                      return `
                        <tr style="border-bottom: 1px solid #f1f5f9;" data-variant-idx="${vIdx}">
                          <td style="padding: 8px 10px;">
                            <input type="text" class="input var-name" value="${cleanMojibake(v.name || "")}" placeholder="Tên biến thể" style="height: 32px; font-size: 0.85rem;" required>
                            ${fieldError(`variant_${vIdx}_name`, errors)}
                          </td>
                          <td style="padding: 8px 10px;">
                            <input type="text" class="input var-sku" value="${v.sku || ""}" placeholder="SKU" style="height: 32px; font-size: 0.85rem;">
                          </td>
                          <td style="padding: 8px 10px;">
                            <input type="number" min="1000" step="1000" class="input var-price" value="${v.price || ""}" placeholder="Giá" style="height: 32px; font-size: 0.85rem;" required>
                            ${fieldError(`variant_${vIdx}_price`, errors)}
                          </td>
                          <td style="padding: 8px 10px;">
                            ${formProductState.discount.enabled && vCalc.isValid ? `
                              <strong style="color: #dc2626; font-size: 0.85rem;">${formatPrice(vCalc.price)}</strong>
                              <br><small style="color: #15803d; font-size: 0.75rem;">giảm ${vCalc.label}</small>
                            ` : `<span style="color: #94a3b8; font-size: 0.82rem;">${formatPrice(vPrice)}</span>`}
                          </td>
                          <td style="padding: 8px 10px;">
                            <input type="number" min="0" step="1" class="input var-stock" value="${v.stock ?? 0}" style="height: 32px; font-size: 0.85rem; width: 75px; font-weight: 700; color: ${Number(v.stock) === 0 ? "#dc2626" : Number(v.stock) <= 15 ? "#d97706" : "#15803d"};" required>
                            ${fieldError(`variant_${vIdx}_stock`, errors)}
                          </td>
                          <td style="padding: 8px 10px;">
                            <input type="text" class="input var-image" value="${v.image || ""}" placeholder="./images/... hoặc URL" style="height: 30px; font-size: 0.82rem; margin-bottom: 4px;">
                            ${formProductState.gallery.length > 0 ? `
                              <select class="select quick-gallery-picker" style="height: 26px; font-size: 0.75rem; padding: 0 4px; color: #334155; background: #f8fafc; border-color: #cbd5e1;">
                                <option value="">-- Chọn nhanh ảnh từ Gallery --</option>
                                ${formProductState.gallery.map((g) => `
                                  <option value="${g.url}" ${v.image === g.url ? "selected" : ""}>${g.caption || g.url.split('/').pop()}</option>
                                `).join("")}
                              </select>
                            ` : ""}
                          </td>
                          <td style="padding: 8px 10px;">
                            <select class="select var-status" style="height: 32px; font-size: 0.82rem; padding: 0 6px;">
                              <option value="Còn hàng" ${v.status === "Còn hàng" || (!v.status && Number(v.stock) > 0) ? "selected" : ""}>Còn hàng</option>
                              <option value="Sắp hết" ${v.status === "Sắp hết" ? "selected" : ""}>Sắp hết</option>
                              <option value="Tạm hết hàng" ${v.status === "Tạm hết hàng" || Number(v.stock) === 0 ? "selected" : ""}>Tạm hết hàng</option>
                              <option value="Bản nháp" ${v.status === "Bản nháp" ? "selected" : ""}>Bản nháp</option>
                            </select>
                          </td>
                          <td style="padding: 8px 10px; text-align: center;">
                            <button type="button" class="remove-variant-btn" data-remove-variant="${vIdx}" style="background: none; border: none; color: #dc2626; cursor: pointer; padding: 4px; display: inline-flex; align-items: center; justify-content: center;" title="Xóa biến thể">
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

    <div class="form-row field full" style="margin-top: 14px;">
      <button class="btn" type="submit">${isEdit ? "Lưu thay đổi" : "Thêm sản phẩm"}</button>
      <a class="btn-outline" href="./admin.html">Hủy</a>
    </div>
  `;

  bindInteractiveEvents(product);
  initIcons(form);
}

function syncNewBadgeFromInputs() {
  const enabledCheck = form.querySelector("#newBadgeEnabledCheck");
  const startDateInput = form.querySelector("#newBadgeStartDate");
  const modeRadios = form.querySelectorAll("input[name='newBadgeMode']");
  const monthsSelect = form.querySelector("#newBadgeMonths");
  const endDateInput = form.querySelector("#newBadgeEndDate");

  let mode = formProductState.newBadge?.mode || "months";
  modeRadios.forEach((r) => { if (r.checked) mode = r.value; });

  const startDate = startDateInput ? startDateInput.value : (formProductState.newBadge?.startDate || getVietnamTodayString());
  let months = monthsSelect ? Number(monthsSelect.value) || 2 : (Number(formProductState.newBadge?.months) || 2);
  let endDate = "";

  if (mode === "custom") {
    endDate = endDateInput ? endDateInput.value : (formProductState.newBadge?.endDate || "");
  } else {
    endDate = calculateNewBadgeEndDate(startDate, months);
  }

  formProductState.newBadge = {
    enabled: enabledCheck ? enabledCheck.checked : false,
    mode,
    months,
    startDate,
    endDate
  };
}

function syncDiscountFromInputs() {
  const enabledCheck = form.querySelector("#discountEnabledCheck");
  const typeRadios = form.querySelectorAll("input[name='discountType']");
  const valueInput = form.querySelector("#discountValue");
  const startAtInput = form.querySelector("#discountStartAt");
  const endAtInput = form.querySelector("#discountEndAt");

  let type = "percentage";
  typeRadios.forEach((r) => { if (r.checked) type = r.value; });

  formProductState.discount = {
    enabled: enabledCheck ? enabledCheck.checked : false,
    type,
    value: valueInput ? Number(valueInput.value) || 0 : (formProductState.discount?.value || 0),
    startAt: startAtInput ? startAtInput.value : (formProductState.discount?.startAt || ""),
    endAt: endAtInput ? endAtInput.value : (formProductState.discount?.endAt || "")
  };
}

function syncVariantsFromInputs() {
  const tableRows = form.querySelectorAll("tbody tr[data-variant-idx]");
  const nextVariants = [];

  tableRows.forEach((row, idx) => {
    const nameInput = row.querySelector(".var-name");
    const skuInput = row.querySelector(".var-sku");
    const priceInput = row.querySelector(".var-price");
    const stockInput = row.querySelector(".var-stock");
    const imageInput = row.querySelector(".var-image");
    const statusSelect = row.querySelector(".var-status");

    const existingVar = formProductState.variants[idx] || {};
    nextVariants.push({
      id: existingVar.id || `VAR-${Date.now()}-${idx + 1}`,
      sku: skuInput ? skuInput.value.trim() : (existingVar.sku || ""),
      name: nameInput ? nameInput.value.trim() : (existingVar.name || ""),
      options: existingVar.options || { "Phân loại": nameInput ? nameInput.value.trim() : "" },
      price: priceInput ? Number(priceInput.value) : (existingVar.price || 0),
      stock: stockInput ? Math.max(0, parseInt(stockInput.value) || 0) : (existingVar.stock || 0),
      image: imageInput ? imageInput.value.trim() : (existingVar.image || ""),
      status: statusSelect ? statusSelect.value : (existingVar.status || "Còn hàng")
    });
  });

  formProductState.variants = nextVariants;
}

function syncAttributesFromInputs() {
  const attrRows = form.querySelectorAll(".attr-group-row");
  const nextAttrs = [];
  attrRows.forEach((row) => {
    const nameInput = row.querySelector(".attr-name-input");
    const valsInput = row.querySelector(".attr-values-input");
    if (nameInput && valsInput) {
      const name = nameInput.value.trim();
      const values = valsInput.value.split(",").map((v) => v.trim()).filter(Boolean);
      if (name && values.length > 0) {
        nextAttrs.push({ name, values });
      }
    }
  });
  if (nextAttrs.length > 0) {
    formProductState.attributes = nextAttrs;
  }
}

function syncGalleryFromInputs() {
  const cards = form.querySelectorAll(".gallery-card");
  const nextGallery = [];
  cards.forEach((card, idx) => {
    const urlInput = card.querySelector(".gal-url");
    const captionInput = card.querySelector(".gal-caption");
    const linkTypeSelect = card.querySelector(".gal-link-type");
    const attrKeyInput = card.querySelector(".gal-attr-key");
    const attrValInput = card.querySelector(".gal-attr-val");
    const varSelect = card.querySelector(".gal-variant-id");

    const existing = formProductState.gallery[idx] || {};
    const linkType = linkTypeSelect ? linkTypeSelect.value : "general";
    const url = urlInput ? urlInput.value.trim() : (existing.url || "");
    const caption = captionInput ? captionInput.value.trim() : (existing.caption || "");

    let isGeneral = linkType === "general";
    let attributeKey = "";
    let attributeValue = "";
    let variantId = "";

    if (linkType === "attribute") {
      isGeneral = false;
      attributeKey = attrKeyInput ? attrKeyInput.value.trim() : (existing.attributeKey || "Màu sắc");
      attributeValue = attrValInput ? attrValInput.value.trim() : (existing.attributeValue || "");
    } else if (linkType === "variant") {
      isGeneral = false;
      variantId = varSelect ? varSelect.value : (existing.variantId || "");
      const matchedVar = formProductState.variants.find((v) => v.id === variantId);
      if (matchedVar && matchedVar.options) {
        const firstOpt = Object.entries(matchedVar.options)[0];
        if (firstOpt) {
          attributeKey = firstOpt[0];
          attributeValue = String(firstOpt[1]);
        }
      }
    }

    if (url) {
      nextGallery.push({
        id: existing.id || `gal-${Date.now()}-${idx + 1}`,
        url,
        caption,
        isGeneral,
        attributeKey,
        attributeValue,
        variantId
      });
    }
  });

  if (nextGallery.length > 0 || cards.length === 0) {
    formProductState.gallery = nextGallery;
  }
}

function bindInteractiveEvents(product) {
  // 0. Quản lý Gallery tương tác
  const addGalBtn = form.querySelector("#addGalleryItemBtn");
  if (addGalBtn) {
    addGalBtn.addEventListener("click", () => {
      syncGalleryFromInputs();
      syncVariantsFromInputs();
      syncAttributesFromInputs();
      syncNewBadgeFromInputs();
      syncDiscountFromInputs();
      const mainImgVal = form.querySelector("#image")?.value || "";
      formProductState.gallery.push({
        id: `gal-${Date.now()}-${formProductState.gallery.length + 1}`,
        url: mainImgVal || "./images/ban-nang-ha-mat-go.png",
        caption: "Ảnh góc chụp / chi tiết",
        isGeneral: true,
        attributeKey: "",
        attributeValue: "",
        variantId: ""
      });
      renderForm(getFormProductSnapshot(), {});
    });
  }

  // Xóa ảnh trong gallery
  form.querySelectorAll(".remove-gal-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      syncGalleryFromInputs();
      syncVariantsFromInputs();
      syncAttributesFromInputs();
      syncNewBadgeFromInputs();
      syncDiscountFromInputs();
      const idx = Number(btn.getAttribute("data-remove-gal"));
      formProductState.gallery.splice(idx, 1);
      renderForm(getFormProductSnapshot(), {});
    });
  });

  // Đặt làm ảnh chính
  form.querySelectorAll(".set-main-image-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = btn.getAttribute("data-url");
      const imgInput = form.querySelector("#image");
      if (imgInput && url) {
        imgInput.value = url;
        showToast("Đã đặt làm ảnh chính sản phẩm.");
      }
    });
  });

  // Thay đổi loại liên kết (general, attribute, variant)
  form.querySelectorAll(".gal-link-type").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      const card = sel.closest(".gallery-card");
      if (card) {
        const type = e.target.value;
        const attrPanel = card.querySelector(".gal-attr-panel");
        const varPanel = card.querySelector(".gal-var-panel");
        if (attrPanel) attrPanel.style.display = type === "attribute" ? "flex" : "none";
        if (varPanel) varPanel.style.display = type === "variant" ? "block" : "none";
      }
      syncGalleryFromInputs();
    });
  });

  // Chọn nhanh ảnh từ gallery cho biến thể
  form.querySelectorAll(".quick-gallery-picker").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      const val = e.target.value;
      const row = sel.closest("tr");
      if (row && val) {
        const varImgInput = row.querySelector(".var-image");
        if (varImgInput) {
          varImgInput.value = val;
          syncVariantsFromInputs();
        }
      }
    });
  });

  // 1. Toggle Variants Checkbox
  const toggleCheck = form.querySelector("#toggleVariantsCheck");
  if (toggleCheck) {
    toggleCheck.addEventListener("change", (e) => {
      syncGalleryFromInputs();
      syncVariantsFromInputs();
      syncAttributesFromInputs();
      syncNewBadgeFromInputs();
      syncDiscountFromInputs();
      formProductState.hasVariants = e.target.checked;
      if (formProductState.hasVariants && formProductState.variants.length === 0) {
        generateCombinationsFromAttributes(product);
      }
      renderForm(getFormProductSnapshot(), {});
    });
  }

  // 2. Toggle Nhãn Sản Phẩm Mới
  const newBadgeToggle = form.querySelector("#newBadgeEnabledCheck");
  if (newBadgeToggle) {
    newBadgeToggle.addEventListener("change", (e) => {
      syncGalleryFromInputs();
      syncVariantsFromInputs();
      syncAttributesFromInputs();
      syncDiscountFromInputs();
      formProductState.newBadge.enabled = e.target.checked;
      renderForm(getFormProductSnapshot(), {});
    });
  }

  // 3. Thay đổi chế độ Nhãn Mới (months vs custom)
  form.querySelectorAll("input[name='newBadgeMode']").forEach((radio) => {
    radio.addEventListener("change", (e) => {
      syncGalleryFromInputs();
      syncVariantsFromInputs();
      syncAttributesFromInputs();
      syncNewBadgeFromInputs();
      syncDiscountFromInputs();
      formProductState.newBadge.mode = e.target.value;
      renderForm(getFormProductSnapshot(), {});
    });
  });

  // 4. Nhập ngày bắt đầu hoặc số tháng Nhãn Mới
  const startDateInput = form.querySelector("#newBadgeStartDate");
  const monthsSelect = form.querySelector("#newBadgeMonths");
  const endDateInput = form.querySelector("#newBadgeEndDate");
  [startDateInput, monthsSelect, endDateInput].forEach((el) => {
    if (el) {
      el.addEventListener("change", () => {
        syncGalleryFromInputs();
        syncVariantsFromInputs();
        syncAttributesFromInputs();
        syncNewBadgeFromInputs();
        syncDiscountFromInputs();
        renderForm(getFormProductSnapshot(), {});
      });
    }
  });

  // 5. Toggle Khuyến Mãi
  const discountToggle = form.querySelector("#discountEnabledCheck");
  if (discountToggle) {
    discountToggle.addEventListener("change", (e) => {
      syncGalleryFromInputs();
      syncVariantsFromInputs();
      syncAttributesFromInputs();
      syncNewBadgeFromInputs();
      formProductState.discount.enabled = e.target.checked;
      renderForm(getFormProductSnapshot(), {});
    });
  }

  // 6. Thay đổi loại khuyến mãi (percentage vs fixed)
  form.querySelectorAll("input[name='discountType']").forEach((radio) => {
    radio.addEventListener("change", (e) => {
      syncGalleryFromInputs();
      syncVariantsFromInputs();
      syncAttributesFromInputs();
      syncNewBadgeFromInputs();
      syncDiscountFromInputs();
      formProductState.discount.type = e.target.value;
      renderForm(getFormProductSnapshot(), {});
    });
  });

  // 7. Giá trị và thời gian khuyến mãi
  const discountValInput = form.querySelector("#discountValue");
  const discountStartInput = form.querySelector("#discountStartAt");
  const discountEndInput = form.querySelector("#discountEndAt");
  [discountValInput, discountStartInput, discountEndInput].forEach((el) => {
    if (el) {
      el.addEventListener("input", () => {
        syncDiscountFromInputs();
      });
      el.addEventListener("change", () => {
        syncGalleryFromInputs();
        syncVariantsFromInputs();
        syncAttributesFromInputs();
        syncNewBadgeFromInputs();
        syncDiscountFromInputs();
        renderForm(getFormProductSnapshot(), {});
      });
    }
  });

  // 8. Thêm nhóm thuộc tính
  const addAttrBtn = form.querySelector("#addAttributeBtn");
  if (addAttrBtn) {
    addAttrBtn.addEventListener("click", () => {
      syncGalleryFromInputs();
      syncAttributesFromInputs();
      syncVariantsFromInputs();
      syncNewBadgeFromInputs();
      syncDiscountFromInputs();
      formProductState.attributes.push({ name: `Thuộc tính ${formProductState.attributes.length + 1}`, values: ["Lựa chọn 1"] });
      renderForm(getFormProductSnapshot(), {});
    });
  }

  // 9. Xóa nhóm thuộc tính
  form.querySelectorAll(".remove-attr-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      syncGalleryFromInputs();
      syncAttributesFromInputs();
      syncVariantsFromInputs();
      syncNewBadgeFromInputs();
      syncDiscountFromInputs();
      const idx = Number(btn.getAttribute("data-remove-attr"));
      formProductState.attributes.splice(idx, 1);
      renderForm(getFormProductSnapshot(), {});
    });
  });

  // 10. Tạo tổ hợp biến thể tự động
  const genBtn = form.querySelector("#generateCombinationsBtn");
  if (genBtn) {
    genBtn.addEventListener("click", () => {
      syncGalleryFromInputs();
      syncAttributesFromInputs();
      syncNewBadgeFromInputs();
      syncDiscountFromInputs();
      generateCombinationsFromAttributes(product);
      renderForm(getFormProductSnapshot(), {});
      showToast(`Đã tạo ${formProductState.variants.length} tổ hợp biến thể.`);
    });
  }

  // 11. Thêm biến thể lẻ thủ công
  const addSingleBtn = form.querySelector("#addSingleVariantBtn");
  if (addSingleBtn) {
    addSingleBtn.addEventListener("click", () => {
      syncGalleryFromInputs();
      syncVariantsFromInputs();
      syncNewBadgeFromInputs();
      syncDiscountFromInputs();
      const newIdx = formProductState.variants.length + 1;
      const basePrice = Number(String(form.querySelector("#price")?.value || "").replace(/\D/g, "")) || 100000;
      formProductState.variants.push({
        id: `VAR-${Date.now()}-${newIdx}`,
        sku: `${product.id || "SP"}-VAR-${newIdx}`,
        name: `Lựa chọn mới ${newIdx}`,
        options: { "Lựa chọn": `Mẫu ${newIdx}` },
        price: basePrice,
        stock: 10,
        image: "",
        status: "Còn hàng"
      });
      renderForm(getFormProductSnapshot(), {});
    });
  }

  // 12. Xóa từng biến thể
  form.querySelectorAll(".remove-variant-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      syncGalleryFromInputs();
      syncVariantsFromInputs();
      syncNewBadgeFromInputs();
      syncDiscountFromInputs();
      const idx = Number(btn.getAttribute("data-remove-variant"));
      formProductState.variants.splice(idx, 1);
      renderForm(getFormProductSnapshot(), {});
    });
  });

  // 13. Cập nhật tồn kho hoặc giá trong bảng biến thể
  form.querySelectorAll(".var-stock, .var-price").forEach((input) => {
    input.addEventListener("input", () => {
      syncVariantsFromInputs();
      const totalStk = formProductState.variants.reduce((sum, v) => sum + Math.max(0, Number(v.stock) || 0), 0);
      const stockField = form.querySelector("#stock");
      if (stockField && formProductState.hasVariants) {
        stockField.value = totalStk;
      }
    });
  });

  bindPriceFormatting();
}

function generateCombinationsFromAttributes(product) {
  const attrs = formProductState.attributes.filter((a) => a.name && Array.isArray(a.values) && a.values.length > 0);
  if (attrs.length === 0) return;

  const cartesian = (arrays) => arrays.reduce((acc, curr) => acc.flatMap((c) => curr.map((n) => [...c, n])), [[]]);
  const combinations = cartesian(attrs.map((a) => a.values.map((v) => ({ attr: a.name, val: v }))));

  const basePrice = Number(String(form.querySelector("#price")?.value || "").replace(/\D/g, "")) || (product.price || 1000000);
  const baseImg = form.querySelector("#image")?.value || product.image || "";
  const existingMap = new Map(formProductState.variants.map((v) => [cleanMojibake(v.name), v]));

  formProductState.variants = combinations.map((comb, idx) => {
    const name = comb.map((c) => cleanMojibake(c.val)).join(" / ");
    const options = {};
    comb.forEach((c) => { options[cleanMojibake(c.attr)] = cleanMojibake(c.val); });

    if (existingMap.has(name)) {
      const old = existingMap.get(name);
      return { ...old, options };
    }

    const skuSuffix = comb.map((c) => c.val.slice(0, 3).toUpperCase()).join("-");
    return {
      id: `${product.id || "P"}-VAR-${idx + 1}`,
      sku: `${product.id || "EP"}-${skuSuffix}`,
      name,
      options,
      price: basePrice,
      stock: 10,
      image: baseImg,
      status: "Còn hàng"
    };
  });
}

function getFormProductSnapshot() {
  syncNewBadgeFromInputs();
  syncDiscountFromInputs();
  syncGalleryFromInputs();

  const name = form.querySelector("#name")?.value || "";
  const categoryId = form.querySelector("#categoryId")?.value || "";
  const rawPrice = form.querySelector("#price")?.value || "";
  const rawStock = form.querySelector("#stock")?.value || "";
  const image = form.querySelector("#image")?.value || "";
  const description = form.querySelector("#description")?.value || "";
  const status = form.querySelector("#status")?.value || "Còn hàng";
  const tagsRaw = form.querySelector("#tags")?.value || "";

  return {
    name,
    categoryId,
    price: Number(String(rawPrice).replace(/\D/g, "")),
    stock: Number(rawStock),
    image,
    description,
    status,
    tags: normalizeProductTags(tagsRaw),
    hasVariants: formProductState.hasVariants,
    attributes: formProductState.attributes,
    variants: formProductState.variants,
    gallery: deduplicateGalleryEntries(formProductState.gallery),
    galleryJson: JSON.stringify(deduplicateGalleryEntries(formProductState.gallery)),
    newBadge: formProductState.newBadge,
    discount: formProductState.discount
  };
}

function getFormData() {
  syncVariantsFromInputs();
  syncAttributesFromInputs();
  syncNewBadgeFromInputs();
  syncDiscountFromInputs();
  syncGalleryFromInputs();

  const data = getFormProductSnapshot();
  const totalStock = data.hasVariants
    ? formProductState.variants.reduce((sum, v) => sum + Math.max(0, Number(v.stock) || 0), 0)
    : Number(data.stock);

  const minPrice = data.hasVariants && formProductState.variants.length > 0
    ? Math.min(...formProductState.variants.map((v) => Number(v.price) || 0).filter((p) => p > 0))
    : Number(data.price);

  let aggregatedStatus = data.status;
  if (totalStock === 0) aggregatedStatus = "Hết hàng";
  else if (totalStock <= 15) aggregatedStatus = "Sắp hết";
  else aggregatedStatus = "Còn hàng";

  const existingProd = isEdit ? findProduct(productId) : null;

  return {
    ...data,
    price: minPrice,
    stock: totalStock,
    status: aggregatedStatus,
    hasVariants: Boolean(data.hasVariants),
    attributes: data.hasVariants ? formProductState.attributes : [],
    variants: data.hasVariants ? formProductState.variants : [],
    gallery: data.gallery,
    galleryJson: data.galleryJson,
    newBadge: formProductState.newBadge,
    discount: formProductState.discount,
    sold: existingProd ? (Number(existingProd.sold) || 0) : 0,
    rating: existingProd ? (Number(existingProd.rating) || 0) : 0,
    reviewCount: existingProd ? (Number(existingProd.reviewCount) || 0) : 0
  };
}

function bindPriceFormatting() {
  const priceInput = form.querySelector("#price");
  if (!priceInput || formProductState.hasVariants) return;
  priceInput.addEventListener("input", () => {
    const cursor = priceInput.selectionStart;
    const len = priceInput.value.length;
    const raw = priceInput.value.replace(/\D/g, "");
    if (!raw) {
      priceInput.value = "";
      return;
    }
    const formatted = raw.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    priceInput.value = formatted;
    const diff = formatted.length - len;
    try {
      priceInput.setSelectionRange(cursor + diff, cursor + diff);
    } catch (_) {}
  });
}

function bindSubmit(product) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = getFormData();
    const errors = validateProduct(data);

    if (Object.keys(errors).length > 0) {
      renderForm(data, errors);
      showToast("Vui lòng kiểm tra và sửa các trường lỗi trong biểu mẫu.");
      return;
    }

    try {
      if (isEdit) {
        await updateProduct(productId, data);
        showToast("Đã cập nhật sản phẩm, nhãn Mới và khuyến mãi thành công.");
      } else {
        await createProduct(data);
        showToast("Đã thêm sản phẩm mới và thiết lập ưu đãi thành công.");
      }

      window.setTimeout(() => {
        window.location.href = "./admin.html";
      }, 750);
    } catch (err) {
      showToast("Lỗi khi lưu sản phẩm: " + err.message);
    }
  });
}

async function start() {
  await initStore();
  const currentUser = getCurrentUser();
  if (!currentUser) {
    const currentTarget = window.location.pathname.split("/").pop() + window.location.search;
    redirectToLogin({
      next: `./${currentTarget}`,
      notice: "Vui lòng đăng nhập để thao tác quản trị.",
      replace: true
    });
    return;
  }

  if (currentUser.role === "customer" || (currentUser.role !== "admin" && currentUser.role !== "staff")) {
    sessionStorage.setItem("ecodesk_auth_notice", "Tài khoản khách hàng không có quyền truy cập trang quản trị sản phẩm.");
    window.location.replace("./index.html");
    return;
  }

  categories = getCategories();
  const product = isEdit ? findProduct(productId) : {};

  if (isEdit && !product) {
    form.outerHTML = `<p class="empty">Không tìm thấy sản phẩm cần sửa.</p>`;
    return;
  }

  // Khôi phục cấu hình Nhãn Mới
  if (product && product.newBadge) {
    let nb = product.newBadge;
    if (typeof nb === "string") {
      try { nb = JSON.parse(nb); } catch (_) {}
    }
    formProductState.newBadge = {
      enabled: Boolean(nb.enabled),
      mode: nb.mode || "months",
      months: Number(nb.months) || 2,
      startDate: nb.startDate || getVietnamTodayString(),
      endDate: nb.endDate || calculateNewBadgeEndDate(nb.startDate || getVietnamTodayString(), Number(nb.months) || 2)
    };
  } else {
    formProductState.newBadge = {
      enabled: false,
      mode: "months",
      months: 2,
      startDate: getVietnamTodayString(),
      endDate: calculateNewBadgeEndDate(getVietnamTodayString(), 2)
    };
  }

  // Khôi phục cấu hình Khuyến Mãi
  if (product && product.discount) {
    let dc = product.discount;
    if (typeof dc === "string") {
      try { dc = JSON.parse(dc); } catch (_) {}
    }
    formProductState.discount = {
      enabled: Boolean(dc.enabled),
      type: dc.type || "percentage",
      value: Number(dc.value) || 15,
      startAt: dc.startAt || getVietnamNowDateTimeString(),
      endAt: dc.endAt || ""
    };
  } else {
    formProductState.discount = {
      enabled: false,
      type: "percentage",
      value: 15,
      startAt: getVietnamNowDateTimeString(),
      endAt: ""
    };
  }

  let productVariants = Array.isArray(product.variants) ? product.variants : [];
  if (productVariants.length === 0 && product.variantsJson) {
    try {
      const parsed = typeof product.variantsJson === "string" ? JSON.parse(product.variantsJson) : product.variantsJson;
      if (Array.isArray(parsed)) productVariants = parsed;
    } catch (_) {}
  }
  let productAttributes = Array.isArray(product.attributes) ? product.attributes : [];
  if (productAttributes.length === 0 && product.attributesJson) {
    try {
      const parsed = typeof product.attributesJson === "string" ? JSON.parse(product.attributesJson) : product.attributesJson;
      if (Array.isArray(parsed)) productAttributes = parsed;
    } catch (_) {}
  }

  if (product && (productVariants.length > 0 || product.hasVariants)) {
    formProductState.hasVariants = true;
    if (productAttributes.length > 0) {
      formProductState.attributes = productAttributes;
    } else if (productVariants.length > 0 && productVariants[0].options) {
      const attrKeys = Object.keys(productVariants[0].options);
      formProductState.attributes = attrKeys.map((key) => {
        const valSet = new Set();
        productVariants.forEach((v) => {
          if (v.options && v.options[key]) valSet.add(v.options[key]);
        });
        return { name: key, values: Array.from(valSet) };
      });
    } else {
      formProductState.attributes = [
        { name: "Màu sắc", values: ["Gỗ Sồi tự nhiên", "Đen Stealth"] },
        { name: "Kích thước", values: ["120 x 60 cm", "140 x 70 cm"] }
      ];
    }
    formProductState.variants = productVariants;
  } else {
    formProductState.hasVariants = false;
    formProductState.variants = [];
  }

  // Khôi phục bộ sưu tập ảnh (Gallery)
  let productGallery = Array.isArray(product.gallery) ? product.gallery : [];
  if (productGallery.length === 0 && product.galleryJson) {
    try {
      const parsed = typeof product.galleryJson === "string" ? JSON.parse(product.galleryJson) : product.galleryJson;
      if (Array.isArray(parsed) && parsed.length > 0) productGallery = parsed;
    } catch (_) {}
  }
  if (productGallery.length === 0 && product.image) {
    productGallery = [{
      id: `gal-${Date.now()}-1`,
      url: product.image,
      caption: product.name || "Ảnh chính sản phẩm",
      isGeneral: true,
      attributeKey: "",
      attributeValue: "",
      variantId: ""
    }];
  }
  formProductState.gallery = deduplicateGalleryEntries(productGallery);

  renderForm(product);
  bindSubmit(product);
}

start();
