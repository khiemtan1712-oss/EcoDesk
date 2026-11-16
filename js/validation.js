export function validateProduct(formData) {
  const errors = {};
  const validImageUrl = /^(https?:\/\/|\.?\/?images\/|\/).+/i;

  if (!formData.name || !formData.name.trim()) errors.name = "Tên sản phẩm không được bỏ trống.";
  if (!formData.categoryId) errors.categoryId = "Vui lòng chọn danh mục.";

  if (formData.hasVariants) {
    if (!Array.isArray(formData.variants) || formData.variants.length === 0) {
      errors.variants = "Sản phẩm bật chế độ biến thể phải có ít nhất 1 biến thể.";
    } else {
      const seenCombinations = new Set();
      for (let i = 0; i < formData.variants.length; i++) {
        const v = formData.variants[i];
        let combKey = (v.name || "").trim().toLowerCase();
        if (v.options && typeof v.options === "object" && Object.keys(v.options).length > 0) {
          const optString = Object.entries(v.options).sort().map(([k, val]) => `${k}:${val}`).join("|").toLowerCase();
          if (optString) combKey = optString;
        }
        if (!combKey) {
          errors[`variant_${i}_name`] = "Tên tổ hợp biến thể không được để trống.";
        } else if (seenCombinations.has(combKey)) {
          errors[`variant_${i}_name`] = `Tổ hợp "${v.name}" bị trùng lặp thuộc tính. Vui lòng không tạo tổ hợp trùng.`;
          errors.variants = "Phát hiện tổ hợp biến thể bị trùng lặp. Vui lòng kiểm tra lại danh sách biến thể.";
        } else {
          seenCombinations.add(combKey);
        }

        if (!Number.isFinite(Number(v.price)) || Number(v.price) <= 0) {
          errors[`variant_${i}_price`] = "Giá bán biến thể phải là số lớn hơn 0.";
        }
        if (!Number.isInteger(Number(v.stock)) || Number(v.stock) < 0) {
          errors[`variant_${i}_stock`] = "Tồn kho phải là số nguyên không âm (≥ 0).";
        }
      }
    }
  } else {
    if (!Number.isFinite(Number(formData.price)) || Number(formData.price) <= 0) errors.price = "Giá phải là số lớn hơn 0.";
    if (!Number.isInteger(Number(formData.stock)) || Number(formData.stock) < 0) errors.stock = "Số lượng phải là số nguyên không âm.";
  }

  if (!formData.image || !validImageUrl.test(formData.image.trim())) errors.image = "Ảnh phải là đường dẫn hợp lệ (bắt đầu bằng http, https hoặc ./images/).";
  if (!formData.description || formData.description.trim().length < 15) errors.description = "Mô tả nên có ít nhất 15 ký tự.";

  // 1. Kiểm tra cấu hình nhãn "Sản phẩm mới"
  if (formData.newBadge && formData.newBadge.enabled) {
    const nb = formData.newBadge;
    if (!nb.startDate) {
      errors.newBadge_startDate = "Vui lòng chọn ngày bắt đầu hiển thị nhãn Mới.";
    }
    if (nb.mode === "custom") {
      if (!nb.endDate) {
        errors.newBadge_endDate = "Vui lòng chọn ngày kết thúc hiển thị nhãn Mới.";
      } else if (nb.startDate && new Date(nb.endDate) < new Date(nb.startDate)) {
        errors.newBadge_endDate = "Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.";
      }
    } else {
      const months = Number(nb.months);
      if (!Number.isInteger(months) || months < 1) {
        errors.newBadge_months = "Thời hạn hiển thị phải là số tháng nguyên dương (≥ 1).";
      }
    }
  }

  // 2. Kiểm tra cấu hình chương trình "Khuyến mãi"
  if (formData.discount && formData.discount.enabled) {
    const dc = formData.discount;
    if (!dc.startAt) {
      errors.discount_startAt = "Vui lòng chọn ngày giờ bắt đầu khuyến mãi.";
    }
    if (!dc.endAt) {
      errors.discount_endAt = "Vui lòng chọn ngày giờ kết thúc khuyến mãi.";
    }
    if (dc.startAt && dc.endAt && new Date(dc.endAt) <= new Date(dc.startAt)) {
      errors.discount_endAt = "Thời gian kết thúc phải diễn ra sau thời gian bắt đầu.";
    }

    const val = Number(dc.value);
    if (!Number.isFinite(val) || val <= 0) {
      errors.discount_value = "Giá trị giảm phải là số lớn hơn 0.";
    } else if (dc.type === "percentage") {
      if (val >= 100) {
        errors.discount_value = "Phần trăm giảm giá phải nhỏ hơn 100% để giá bán lớn hơn 0đ.";
      }
    } else if (dc.type === "fixed") {
      // So sánh với giá gốc của sản phẩm hoặc biến thể
      let baseMinPrice = Number(formData.price) || 0;
      if (formData.hasVariants && Array.isArray(formData.variants) && formData.variants.length > 0) {
        const prices = formData.variants.map((v) => Number(v.price)).filter((p) => !isNaN(p) && p > 0);
        if (prices.length > 0) baseMinPrice = Math.min(...prices);
      }
      if (baseMinPrice > 0 && val >= baseMinPrice) {
        errors.discount_value = `Số tiền giảm (${val.toLocaleString("vi-VN")}đ) không được lớn hơn hoặc bằng giá bán gốc (${baseMinPrice.toLocaleString("vi-VN")}đ).`;
      }
    }
  }

  return errors;
}

export function validateContact(data) {
  const errors = {};
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phonePattern = /^(0|\+84)[0-9]{9,10}$/;

  if (!data.name.trim()) errors.name = "Vui lòng nhập họ tên.";
  if (!emailPattern.test(data.email)) errors.email = "Email chưa đúng định dạng.";
  if (!phonePattern.test(data.phone)) errors.phone = "Số điện thoại chưa hợp lệ.";
  if (data.message.trim().length < 10) errors.message = "Nội dung cần ít nhất 10 ký tự.";

  return errors;
}
