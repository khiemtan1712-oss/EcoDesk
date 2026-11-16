import { initStore, findProduct, getCategories, getProducts, addToCart, getCartCount, getCurrentUser, normalizeProductTags, normalizeImageUrlKey } from "./storage.js";
import { $, formatPrice, getCategoryName, getParam, showToast, renderRatingStars, escapeHtml, resolveColorSwatch, buildAuthUrl } from "./utils.js";
import { getPricing, isNewProduct } from "./commerce.js";
import { revealOnScroll } from "./scroll-reveal.js";
import { renderIcon, initIcons } from "./icons.js";
import {
  getProductReviews,
  getProductRatingSummary,
  getReviewEligibility,
  submitProductReview,
  submitReviewComment,
  REVIEWS_EVENT,
  REVIEWS_STORAGE_KEY,
  syncReviewsFromDisk
} from "./reviews.js";

function formatReviewDateTime(isoOrDate) {
  if (!isoOrDate) return "";
  const d = new Date(isoOrDate);
  if (isNaN(d.getTime())) return String(isoOrDate);
  if (String(isoOrDate).length <= 10) {
    return d.toLocaleDateString("vi-VN");
  }
  return `${d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} · ${d.toLocaleDateString("vi-VN")}`;
}

function getInitialChar(name = "") {
  const clean = String(name || "K").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  const last = parts[parts.length - 1] || "K";
  return last.charAt(0).toUpperCase();
}

// Rút trích và chuẩn hóa danh sách hình ảnh gallery cùng liên kết biến thể
function getGalleryItems(product, productVariants = []) {
  let rawGallery = Array.isArray(product?.gallery) ? product.gallery : [];
  if (rawGallery.length === 0 && product?.galleryJson) {
    try {
      const parsed = typeof product.galleryJson === "string" ? JSON.parse(product.galleryJson) : product.galleryJson;
      if (Array.isArray(parsed) && parsed.length > 0) rawGallery = parsed;
    } catch (_) {}
  }

  const variants = (productVariants && productVariants.length > 0)
    ? productVariants
    : (Array.isArray(product?.variants) ? product.variants : []);

  // Helper tìm biến thể tương ứng với URL ảnh
  const findMatchingVariant = (url) => {
    if (!url) return null;
    const clean = url.replace(/^\.\//, "").toLowerCase();
    return variants.find((v) => {
      const vUrl = (v.image || "").replace(/^\.\//, "").toLowerCase();
      return vUrl === clean || clean.endsWith(vUrl) || vUrl.endsWith(clean);
    });
  };

  // Helper nhận diện nhãn mô tả tính năng/infographic
  const inferImageMeta = (url) => {
    const lower = (url || "").toLowerCase();
    if (/4color|overview|tong-quan|banner/i.test(lower)) {
      return { tag: "Tổng quan", caption: "Tổng quan các màu sắc", isGeneral: true };
    }
    if (/health|suc-khoe|ergonomic|so-sanh/i.test(lower)) {
      return { tag: "Sức khỏe", caption: "Nâng tầm sức khỏe & tư thế chuẩn", isGeneral: true };
    }
    if (/4_4|3_3|1_2|22_8|23_9|tinh-nang|cong-nghe/i.test(lower)) {
      if (/4_4/i.test(lower)) return { tag: "Thoải mái", caption: "Nâng tầm sự thoải mái - Đệm êm", isGeneral: true };
      if (/3_3/i.test(lower)) return { tag: "Lưng lưới", caption: "Lưng lưới thoáng khí cao cấp", isGeneral: true };
      if (/1_2/i.test(lower)) return { tag: "Công thái học", caption: "Ghế công thái học đỉnh cao", isGeneral: true };
      if (/22_8/i.test(lower)) return { tag: "Tay gập 90°", caption: "Tựa tay điều chỉnh linh hoạt", isGeneral: true };
      return { tag: "Tính năng", caption: "Chi tiết tính năng kỹ thuật", isGeneral: true };
    }
    if (/26_12|27_13|setup|lifestyle|goc-lam-viec/i.test(lower)) {
      return { tag: "Setup", caption: "Gợi ý không gian làm việc", isGeneral: true };
    }
    return null;
  };

  // Nếu sản phẩm chưa có gallery, tự tạo từ ảnh chính và ảnh biến thể
  if (rawGallery.length === 0) {
    const list = [];
    if (product?.image) {
      list.push({
        id: "gal-main",
        url: product.image,
        caption: product.name || "Ảnh sản phẩm",
        tag: "Tổng quan",
        isGeneral: true,
        attributeKey: "",
        attributeValue: "",
        variantId: ""
      });
    }

    variants.forEach((v, idx) => {
      if (v?.image && !list.some((item) => item.url === v.image)) {
        let attrKey = "";
        let attrVal = "";
        if (v.options && typeof v.options === "object") {
          for (const [k, val] of Object.entries(v.options)) {
            if (/màu|color/i.test(k)) {
              attrKey = k;
              attrVal = String(val);
              break;
            }
          }
          if (!attrKey) {
            const first = Object.entries(v.options)[0];
            if (first) {
              attrKey = first[0];
              attrVal = String(first[1]);
            }
          }
        }
        const shortTag = attrVal.split("(")[0].trim() || `Lựa chọn ${idx + 1}`;
        list.push({
          id: `gal-var-${idx + 1}`,
          url: v.image,
          caption: v.name || `Lựa chọn ${idx + 1}`,
          tag: shortTag,
          isGeneral: false,
          attributeKey: attrKey,
          attributeValue: attrVal,
          variantId: v.id || ""
        });
      }
    });

    if (list.length > 0) return list;

    return [{
      id: "gal-fallback",
      url: "./images/ban-nang-ha-mat-go.png",
      caption: "EcoDesk Studio",
      tag: "EcoDesk",
      isGeneral: true,
      attributeKey: "",
      attributeValue: "",
      variantId: ""
    }];
  }

  // Chuẩn hóa, khử trùng lặp và làm giàu từng phần tử gallery
  const normalizedGallery = [];
  const seenImageKeys = new Set();

  const pushGalleryEntry = (rawUrl, sourceItem = null, fallbackIdx = 0) => {
    const cleanUrl = String(rawUrl || "").trim();
    if (!cleanUrl) return;
    const key = normalizeImageUrlKey(cleanUrl);
    if (!key || seenImageKeys.has(key)) return;
    seenImageKeys.add(key);

    const matchingVar = findMatchingVariant(cleanUrl);
    const meta = inferImageMeta(cleanUrl);

    let attrKey = "";
    let attrVal = "";
    let variantId = "";
    let tag = "Chung";
    let isGeneral = true;
    let caption = `Ảnh ${fallbackIdx + 1}`;

    if (matchingVar) {
      isGeneral = false;
      variantId = matchingVar.id || "";
      if (matchingVar.options && typeof matchingVar.options === "object") {
        for (const [k, val] of Object.entries(matchingVar.options)) {
          if (/màu|color/i.test(k)) {
            attrKey = k;
            attrVal = String(val);
            break;
          }
        }
        if (!attrKey) {
          const first = Object.entries(matchingVar.options)[0];
          if (first) {
            attrKey = first[0];
            attrVal = String(first[1]);
          }
        }
      }
      tag = attrVal.split("(")[0].trim() || matchingVar.name || "Biến thể";
      caption = matchingVar.name || `Phiên bản ${tag}`;
    } else if (meta) {
      tag = meta.tag;
      caption = meta.caption;
      isGeneral = meta.isGeneral;
    } else if (sourceItem && typeof sourceItem === "object") {
      tag = sourceItem.tag || (sourceItem.attributeValue ? sourceItem.attributeValue.split("(")[0].trim() : "Chung");
      caption = sourceItem.caption || `Ảnh ${fallbackIdx + 1}`;
      isGeneral = sourceItem.isGeneral ?? (!sourceItem.attributeValue && !sourceItem.variantId);
      attrKey = sourceItem.attributeKey || "";
      attrVal = sourceItem.attributeValue || "";
      variantId = sourceItem.variantId || "";
    }

    normalizedGallery.push({
      id: (sourceItem && typeof sourceItem === "object" && sourceItem?.id) || `gal-${normalizedGallery.length + 1}`,
      url: cleanUrl,
      caption,
      tag,
      isGeneral,
      attributeKey: attrKey,
      attributeValue: attrVal,
      variantId
    });
  };

  // Luôn đưa ảnh chính sản phẩm lên đầu gallery (pushGalleryEntry tự khử trùng lặp nếu có trong rawGallery)
  if (product?.image) {
    pushGalleryEntry(product.image, { caption: product.name || "Tổng quan sản phẩm", tag: "Tổng quan", isGeneral: true }, 0);
  }

  rawGallery.forEach((item, idx) => {
    const rawUrl = typeof item === "string" ? item : (item?.url || "");
    pushGalleryEntry(rawUrl, item, idx);
  });

  // Bổ sung ảnh biến thể còn thiếu nếu chưa nằm trong gallery (vẫn khử trùng lặp)
  variants.forEach((v, idx) => {
    if (v?.image) {
      pushGalleryEntry(v.image, null, normalizedGallery.length + idx);
    }
  });

  return normalizedGallery;
}

// Generate technical specifications based on real product data & category
function getProductSpecs(product, categoryName = "Chưa phân loại") {
  const pName = String(product?.name || "").toLowerCase();
  const pDesc = String(product?.description || "").toLowerCase();
  const cat = String(product?.categoryId || "");

  const isMotorizedDesk =
    pName.includes("nâng hạ") ||
    pName.includes("nang ha") ||
    pName.includes("smartdesk") ||
    pDesc.includes("động cơ") ||
    pDesc.includes("nâng hạ điện");
  const isFixedDesk = !isMotorizedDesk && (pName.includes("bàn ") || pName.includes("ban ") || pName.includes("desk"));
  const isChair = pName.includes("ghế") || pName.includes("ghe") || pName.includes("chair");
  const isLight = cat === "lighting" || pName.includes("đèn") || pName.includes("den");

  const rows = [
    { label: "Sản phẩm", value: product.name },
    { label: "Danh mục", value: categoryName }
  ];

  // Đưa các thuộc tính thật từ quản trị / biến thể vào bảng thông số
  const attrs = Array.isArray(product?.attributes) ? product.attributes : [];
  attrs.forEach((a) => {
    if (a?.name && Array.isArray(a.values) && a.values.length > 0) {
      rows.push({ label: a.name, value: a.values.join(" / ") });
    }
  });

  if (isMotorizedDesk) {
    rows.push(
      { label: "Cơ chế vận hành", value: "Bàn nâng hạ chiều cao thông minh điều khiển điện tử" },
      { label: "Chiều cao làm việc", value: "Tùy chỉnh linh hoạt tư thế ngồi & đứng chuẩn công thái học" },
      { label: "Tính năng an toàn", value: "Cảm biến chống va chạm tự động, vận hành êm ái" },
      { label: "Bảo hành", value: "Bảo hành điện tử chính hãng EcoDesk" }
    );
  } else if (isFixedDesk) {
    rows.push(
      { label: "Thiết kế kết cấu", value: "Khung thép sơn tĩnh điện chống gỉ, mặt bàn chống trầy xước & chống ẩm" },
      { label: "Tiện ích đi kèm", value: "Tối ưu cho setup làm việc, học tập và đi dây gọn gàng" },
      { label: "Bảo hành", value: "Bảo hành điện tử chính hãng EcoDesk" }
    );
  } else if (isChair) {
    rows.push(
      { label: "Công thái học", value: "Hỗ trợ nâng đỡ cột sống & thắt lưng, tối ưu cho thời gian ngồi dài" },
      { label: "Piston & Chân đế", value: "Piston thủy lực chịu tải ổn định, bánh xe di chuyển êm nhẹ" },
      { label: "Bảo hành", value: "Bảo hành điện tử chính hãng EcoDesk" }
    );
  } else if (isLight) {
    rows.push(
      { label: "Nguồn sáng", value: "Chip LED bảo vệ thị lực, hạn chế nhấp nháy & ánh sáng xanh" },
      { label: "Nhiệt độ màu", value: "Điều chỉnh đa chế độ ánh sáng phục vụ đọc sách & làm việc" },
      { label: "Nguồn cấp", value: "Kết nối USB Type-C / Adapter tiện lợi" },
      { label: "Bảo hành", value: "Bảo hành điện tử chính hãng EcoDesk" }
    );
  } else {
    rows.push(
      { label: "Phân phối chính hãng", value: "EcoDesk Studio Việt Nam" },
      { label: "Bảo hành", value: "Bảo hành điện tử chính hãng theo số điện thoại đặt hàng" }
    );
  }

  return rows;
}

// Generate product-specific FAQs
function getProductFaqs(product) {
  const pName = String(product?.name || "").toLowerCase();
  const isDesk = pName.includes("ban") || pName.includes("desk");
  const isChair = pName.includes("ghe") || pName.includes("chair");

  if (isDesk) {
    return [
      {
        q: "Bàn nâng hạ EcoDesk có khó lắp đặt tại nhà không?",
        a: "Không hề khó. Sản phẩm đi kèm bản hướng dẫn chi tiết từng bước bằng tiếng Việt và đầy đủ phụ kiện lục giác, ốc vít được đánh số rõ ràng. Thời gian lắp đặt trung bình từ 20 – 30 phút. Tại TP. Hồ Chí Minh, EcoDesk hỗ trợ lắp đặt tận nơi theo yêu cầu."
      },
      {
        q: "Động cơ của bàn có gây tiếng ồn khi tăng giảm độ cao không?",
        a: "Bàn sử dụng động cơ điện thế hệ mới vận hành êm ái với độ ồn dưới 45dB (tương đương tiếng thì thầm trong thư viện), hoàn toàn không làm gián đoạn sự tập trung khi làm việc vào ban đêm."
      },
      {
        q: "Chế độ bảo hành bàn nâng hạ được áp dụng như thế nào?",
        a: "Toàn bộ khung bàn, motor điện và hộp điều khiển được bảo hành chính hãng thông qua hệ thống bảo hành điện tử theo số điện thoại đặt hàng. Khi cần bảo hành, quý khách chỉ cần liên hệ hotline 1900 1234."
      }
    ];
  } else if (isChair) {
    return [
      {
        q: "Ghế công thái học phù hợp cho người có chiều cao và cân nặng thế nào?",
        a: "Ghế được thiết kế tối ưu nhân trắc học cho vóc dáng người Việt (chiều cao từ 1m50 đến 1m85, cân nặng dưới 130kg). Bạn có thể dễ dàng tùy chỉnh độ cao mặt đệm, vị trí tựa đầu và đệm đỡ thắt lưng theo cơ thể."
      },
      {
        q: "Lưới ghế có bị xẹp hay nhão sau thời gian dài sử dụng không?",
        a: "Ghế sử dụng chất liệu lưới dệt kỹ thuật cao cấp có độ đàn hồi cao, chịu lực bền bỉ và thoáng khí, đảm bảo giữ vững phom dáng và nâng đỡ cột sống êm ái suốt nhiều năm sử dụng."
      },
      {
        q: "Bánh xe của ghế có làm trầy xước sàn gỗ không?",
        a: "Bánh xe được bọc lớp PU mềm cao cấp chống trầy xước, di chuyển êm mượt và không gây tiếng ồn trên mọi bề mặt sàn gỗ, sàn gạch men hoặc thảm trải bàn."
      }
    ];
  } else {
    return [
      {
        q: "Sản phẩm có chính sách bảo hành chính hãng không?",
        a: "Mọi sản phẩm tại EcoDesk đều được áp dụng chính sách bảo hành chính hãng điện tử và kiểm định chất lượng kỹ càng trước khi xuất xưởng."
      },
      {
        q: "Thời gian giao hàng tiêu chuẩn là bao lâu?",
        a: "Đơn hàng nội thành TP. Hồ Chí Minh thường được giao trong 24h làm việc. Các tỉnh thành khác trên toàn quốc thời gian giao hàng từ 2 – 4 ngày làm việc."
      },
      {
        q: "Tôi có thể kiểm tra hàng trước khi thanh toán không?",
        a: "Quý khách hoàn toàn được quyền đồng kiểm tra ngoại quan kiện hàng, sản phẩm và phụ kiện đi kèm trước khi nhận hàng."
      }
    ];
  }
}

// Generate what's included in the box based on category
function getBoxContents(product) {
  const pName = String(product?.name || "").toLowerCase();
  const cat = String(product?.categoryId || "");
  const isDesk = pName.includes("ban") || pName.includes("desk");
  const isChair = pName.includes("ghe") || pName.includes("chair");
  const isLight = cat === "lighting" || pName.includes("den");

  if (isDesk) {
    return [
      { name: "Mặt bàn cốt gỗ MDF lõi xanh chống ẩm chuẩn E1", qty: "1 kiện", note: "Bề mặt phủ Melamine cao cấp chống trầy xước" },
      { name: "Khung chân thép nâng hạ sơn tĩnh điện", qty: "1 bộ", note: "Thép carbon chịu tải trọng thực tế 100kg" },
      { name: "Cụm động cơ điện tĩnh âm & Hộp điều khiển", qty: "1 bộ", note: "Vận hành êm dịu < 45dB, nhớ 4 vị trí thông minh" },
      { name: "Khay kẹp dẫn dây gầm bàn & nắp luồn cáp", qty: "1 bộ", note: "Tối ưu hóa giấu dây cho không gian gọn gàng" },
      { name: "Bộ ốc vít, khóa lục giác & Sách HDSD tiếng Việt", qty: "1 túi", note: "Đầy đủ dụng cụ tự lắp đặt nhanh trong 20 phút" }
    ];
  } else if (isChair) {
    return [
      { name: "Thân lưng ghế & đệm ngồi công thái học", qty: "1 kiện", note: "Lưới kỹ thuật thoáng khí cao cấp chống biến dạng" },
      { name: "Piston thủy lực Class 4 chuẩn BIFMA", qty: "1 chiếc", note: "Đảm bảo an toàn tuyệt đối chịu lực đến 130kg" },
      { name: "Chân kim loại 5 cánh & 5 bánh xe PU mềm", qty: "1 bộ", note: "Bánh xe lăn êm, không gây trầy xước sàn gỗ" },
      { name: "Bộ tựa tay 3D đa hướng & gối tựa đầu", qty: "1 bộ", note: "Hỗ trợ đốt sống cổ và giải tỏa áp lực khớp vai" },
      { name: "Bộ vít lục giác chuyên dụng & Sách hướng dẫn", qty: "1 túi", note: "Lắp ráp dễ dàng với hướng dẫn trực quan từng bước" }
    ];
  } else if (isLight) {
    return [
      { name: "Thân đèn LED công nghệ bảo vệ thị lực", qty: "1 chiếc", note: "Chỉ số hoàn màu Ra ≥ 95, không phát xạ ánh sáng xanh" },
      { name: "Ngàm kẹp bàn chống trầy / Chân đế đối trọng", qty: "1 bộ", note: "Đệm silicon chống xước mặt bàn tuyệt đối" },
      { name: "Cáp cấp nguồn Type-C bọc dù cao cấp 1.8m", qty: "1 sợi", note: "Cung cấp nguồn điện ổn định, chống gãy gập" },
      { name: "Sách hướng dẫn sử dụng & Thẻ bảo hành chính hãng", qty: "1 bộ", note: "Kích hoạt bảo hành điện tử chính hãng EcoDesk" }
    ];
  } else {
    return [
      { name: "Chi tiết sản phẩm chính hãng EcoDesk", qty: "1 chiếc", note: "Gia công CNC hợp kim/gỗ nguyên khối tinh xảo" },
      { name: "Bộ đệm cao su silicon chống rung trượt", qty: "1 bộ", note: "Bám dính vững chắc trên mọi bề mặt bàn" },
      { name: "Khóa vặn lục giác & phụ kiện cố định đi kèm", qty: "1 túi", note: "Thao tác gắn kẹp không cần khoan đục mặt bàn" },
      { name: "Thẻ bảo hành & Hướng dẫn sử dụng", qty: "1 chiếc", note: "Hỗ trợ kỹ thuật 24/7 từ chuyên viên EcoDesk" }
    ];
  }
}

// Generate recommended add-ons based on product type
function getRecommendedAddons(product, allProducts = []) {
  const pName = String(product?.name || "").toLowerCase();
  const isDesk = pName.includes("ban") || pName.includes("desk");
  const isChair = pName.includes("ghe") || pName.includes("chair");
  
  let targetIds = [];
  if (isDesk) {
    targetIds = ["P008", "P004"]; // Khay đi dây & Tay nâng HyperWork
  } else if (isChair) {
    targetIds = ["P008", "P014"]; // Khay đi dây & Giá đỡ laptop nhôm
  } else {
    targetIds = ["P008", "P001"]; // Khay đi dây & Đèn AlphaLight
  }

  let addons = (allProducts || []).filter((p) => targetIds.includes(p.id) && p.id !== product?.id);
  if (addons.length === 0) {
    addons = (allProducts || []).filter((p) => p.categoryId === "laptop" && p.id !== product?.id).slice(0, 2);
  }
  return addons.slice(0, 2);
}

function renderDetail(product, categories) {
  const categoryName = getCategoryName(categories, product.categoryId);
  const pricing = getPricing(product);
  const hasSale = pricing.percent > 0;
  const ratingSummary = getProductRatingSummary(product.id);
  const ratingValue = ratingSummary.count > 0 ? ratingSummary.average : 0;
  const reviews = getProductReviews(product.id);
  const specs = getProductSpecs(product, categoryName);
  const faqs = getProductFaqs(product);
  const boxContents = getBoxContents(product);

  // Variant setups based on product
  let productVariants = Array.isArray(product?.variants) ? product.variants : [];
  if (productVariants.length === 0 && product?.variantsJson) {
    try {
      const parsed = typeof product.variantsJson === "string" ? JSON.parse(product.variantsJson) : product.variantsJson;
      if (Array.isArray(parsed)) productVariants = parsed;
    } catch (_) {}
  }
  let productAttributes = Array.isArray(product?.attributes) ? product.attributes : [];
  if (productAttributes.length === 0 && product?.attributesJson) {
    try {
      const parsed = typeof product.attributesJson === "string" ? JSON.parse(product.attributesJson) : product.attributesJson;
      if (Array.isArray(parsed)) productAttributes = parsed;
    } catch (_) {}
  }

  // Làm sạch và chuẩn hóa biến thể
  productVariants = productVariants.map((v, idx) => ({
    id: v?.id || `${product.id}-VAR-${idx + 1}`,
    name: v?.name || `Phiên bản ${idx + 1}`,
    sku: v?.sku || `${product.id}-SKU-${idx + 1}`,
    price: Number(v?.price ?? product?.price ?? 0),
    stock: Math.max(0, Number(v?.stock ?? 0)),
    options: v?.options && typeof v.options === "object" ? v.options : {},
    image: v?.image || product?.image || ""
  }));

  // Chuẩn hóa danh sách gallery với đầy đủ thông tin biến thể và nhãn tính năng
  const galleryItems = getGalleryItems(product, productVariants);

  let attributes = [];
  if (productAttributes.length > 0) {
    attributes = productAttributes.filter((a) => a && a.name && Array.isArray(a.values) && a.values.length > 0);
  }
  if (attributes.length === 0 && productVariants.length > 0) {
    // Tự động rút trích các thuộc tính từ các biến thể
    const attrKeys = Object.keys(productVariants[0]?.options || {});
    attributes = attrKeys.map((key) => {
      const valSet = new Set();
      productVariants.forEach((v) => {
        if (v.options && v.options[key]) valSet.add(v.options[key]);
      });
      return { name: key, values: Array.from(valSet) };
    });
  }

  // Chỉ bật hasVariants nếu cả danh sách biến thể VÀ thuộc tính đều có dữ liệu
  const hasVariants = productVariants.length > 0 && attributes.length > 0;
  let initialVariant = null;
  let hasRequestedVariant = false;
  let selectedOptions = {};

  if (hasVariants) {
    // Ưu tiên ?variant=... trên URL (ví dụ khi chọn swatch từ trang danh sách), nếu không chọn biến thể đầu tiên còn hàng
    const requestedVariantParam = getParam("variant");
    const matchedParamVar = requestedVariantParam
      ? productVariants.find((v) => String(v.id) === String(requestedVariantParam) || String(v.sku) === String(requestedVariantParam))
      : null;
    hasRequestedVariant = Boolean(matchedParamVar);
    initialVariant = matchedParamVar || productVariants.find((v) => Number(v.stock) > 0) || productVariants[0];
    if (initialVariant && initialVariant.options) {
      selectedOptions = { ...initialVariant.options };
    }
    attributes.forEach((attr) => {
      if (!selectedOptions[attr.name] && Array.isArray(attr.values) && attr.values.length > 0) {
        selectedOptions[attr.name] = attr.values[0];
      }
    });
  }

  const initialStock = initialVariant ? Number(initialVariant.stock) : Number(product?.stock || 0);
  const initialBasePrice = initialVariant ? Number(initialVariant.price) : Number(product?.price || 0);
  const initialPricing = getPricing({ ...(product || {}), price: initialBasePrice });
  const inStock = initialStock > 0;
  const allSoldOut = hasVariants
    ? productVariants.every((v) => Number(v.stock) <= 0)
    : Number(product?.stock || 0) <= 0;

  // Related products from same category or overall store
  const allProducts = getProducts();
  const recommendedAddons = getRecommendedAddons(product, allProducts);
  const relatedProducts = allProducts
    .filter((p) => p.id !== product.id)
    .sort((a, b) => (a.categoryId === product.categoryId ? -1 : 1))
    .slice(0, 4);

  const initialMainImg = (hasRequestedVariant && initialVariant?.image) || product.image || (galleryItems[0] && galleryItems[0].url) || (initialVariant && initialVariant.image) || "./images/ban-nang-ha-mat-go.png";
  const initialGalleryItem = galleryItems.find((g) => g.url === initialMainImg) || galleryItems[0] || {};
  const initialGalleryIdx = Math.max(0, galleryItems.findIndex((g) => g.url === initialMainImg));

  $("#detailRoot").innerHTML = `
    <div class="pdp-page">
      <!-- 1. Breadcrumb Navigation -->
      <nav class="pdp-breadcrumb" aria-label="Đường dẫn trang">
        <ol class="pdp-breadcrumb-list">
          <li><a href="./index.html">Trang chủ</a></li>
          <li class="pdp-breadcrumb-sep">/</li>
          <li><a href="./products.html?category=${product.categoryId}">${categoryName}</a></li>
          <li class="pdp-breadcrumb-sep">/</li>
          <li class="pdp-breadcrumb-current" aria-current="page">${product.name}</li>
        </ol>
      </nav>

      <!-- 2. Main Hero Grid -->
      <div class="pdp-hero-grid">
        <!-- Left Column: Gallery & Package Modules -->
        <div class="pdp-gallery-card">
          <div class="pdp-main-image-wrap" id="mainImageWrap" title="Bấm để phóng to ảnh">
            <div class="pdp-badge-stack">
              <span class="pdp-badge pdp-badge-brand">EcoDesk</span>
              ${initialPricing.percent ? `<span class="pdp-badge pdp-badge-sale">${initialPricing.badgeText || `-${initialPricing.percent}%`}</span>` : ""}
              ${isNewProduct(product) ? `<span class="pdp-badge" style="background: #1f7a5c; color: #fff; font-weight: 800;">Mới</span>` : ""}
              ${normalizeProductTags(product.tags).slice(0, 2).map((t) => `<span class="pdp-badge pdp-badge-tag">${escapeHtml(t)}</span>`).join("")}
            </div>

            <!-- Mũi tên Previous ảnh chính (Chuẩn như ảnh mẫu tham khảo) -->
            <button type="button" class="pdp-main-nav-btn prev" id="mainPrevBtn" aria-label="Xem ảnh trước">
              ${renderIcon("chevron-left", { size: 22, strokeWidth: 2.2 })}
            </button>

            <img id="mainDisplayImg" class="pdp-main-image" src="${initialMainImg}" alt="${product.name}">

            <!-- Mũi tên Next ảnh chính (Chuẩn như ảnh mẫu tham khảo) -->
            <button type="button" class="pdp-main-nav-btn next" id="mainNextBtn" aria-label="Xem ảnh kế tiếp">
              ${renderIcon("chevron-right", { size: 22, strokeWidth: 2.2 })}
            </button>

            <button type="button" class="pdp-zoom-btn" id="zoomLightboxBtn" aria-label="Phóng to ảnh">
              ${renderIcon("zoom-in", { size: 18, strokeWidth: 2 })}
            </button>
            <div class="pdp-image-meta-bar">
              <span class="pdp-image-caption" id="pdpImageCaption">${escapeHtml(initialGalleryItem.caption || initialVariant?.name || product.name)}</span>
              <span class="pdp-image-counter" id="pdpImageCounter">${initialGalleryIdx + 1} / ${galleryItems.length}</span>
            </div>
          </div>

          <!-- Thumbnails Strip Carousel with Navigation Arrows (Chuẩn như ảnh mẫu tham khảo) -->
          <div class="pdp-thumb-carousel-wrap">
            <button type="button" class="pdp-thumb-nav-btn prev" id="thumbPrevBtn" aria-label="Cuộn thumbnail sang trái">
              ${renderIcon("chevron-left", { size: 16, strokeWidth: 2.2 })}
            </button>

            <div class="pdp-thumb-list" id="thumbList" role="tablist" aria-label="Hình ảnh sản phẩm">
              ${galleryItems.map((item, idx) => {
                const isActive = idx === initialGalleryIdx;
                return `
                  <button type="button" class="pdp-thumb-btn ${isActive ? "is-active" : ""}"
                    data-idx="${idx}"
                    data-src="${item.url}"
                    data-is-general="${item.isGeneral ? "true" : "false"}"
                    data-attr-key="${escapeHtml(item.attributeKey || "")}"
                    data-attr-val="${escapeHtml(item.attributeValue || "")}"
                    data-variant-id="${escapeHtml(item.variantId || "")}"
                    aria-label="${escapeHtml(item.caption || `Ảnh ${idx + 1}`)}">
                    <img src="${item.url}" alt="${escapeHtml(product.name)} ảnh ${idx + 1}">
                    <span class="pdp-thumb-variant-tag ${item.isGeneral ? "general" : "variant"}">${escapeHtml(item.tag || item.attributeValue || "Chung")}</span>
                  </button>
                `;
              }).join("")}
            </div>

            <button type="button" class="pdp-thumb-nav-btn next" id="thumbNextBtn" aria-label="Cuộn thumbnail sang phải">
              ${renderIcon("chevron-right", { size: 16, strokeWidth: 2.2 })}
            </button>
          </div>

          <!-- 3. What's in the Box / Package Contents -->
          <div class="pdp-box-contents-card">
            <div class="pdp-box-header">
              <div class="pdp-box-title-wrap">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                <span class="pdp-box-title">Trong hộp bao gồm</span>
              </div>
              <span class="pdp-box-badge">Quy cách đóng gói</span>
            </div>
            <ul class="pdp-box-list">
              ${boxContents.map((item) => `
                <li class="pdp-box-item">
                  <div class="pdp-box-item-bullet">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div class="pdp-box-item-body">
                    <div class="pdp-box-item-name">
                      <strong>${item.name}</strong>
                      <span class="pdp-box-qty">${item.qty}</span>
                    </div>
                    <span class="pdp-box-item-note">${item.note}</span>
                  </div>
                </li>
              `).join("")}
            </ul>
            <div class="pdp-box-footer">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span>Đóng gói màng xốp 3 lớp chống sốc, niêm phong kiểm định an toàn vận chuyển toàn quốc.</span>
            </div>
          </div>
        </div>

        <!-- Right Column: Purchasing Info -->
        <section class="pdp-info-panel">
          <div class="pdp-meta-header">
            <a href="./products.html?category=${product.categoryId}" class="pdp-category-link">${categoryName}</a>
            <span class="pdp-sku-text" id="pdpSkuText">Mã SP: ${initialVariant?.sku || product.id}</span>
          </div>

          <h1 class="pdp-product-title">${product.name}</h1>

          <!-- Rating & Sales Bar -->
          <div class="pdp-rating-row" id="pdpTopRatingRow">
            <span class="pdp-stars" id="pdpTopRatingStars" aria-label="${ratingSummary.count > 0 ? `${ratingValue.toFixed(1)} sao` : "Chưa có đánh giá"}" ${ratingSummary.count > 0 ? "" : "hidden"}>
              ${ratingSummary.count > 0 ? renderRatingStars(ratingValue) : ""}
            </span>
            <span class="pdp-rating-score" id="pdpTopRatingScore">${ratingSummary.count > 0 ? `${ratingValue.toFixed(1)} / 5` : "Chưa có đánh giá"}</span>
            <a href="#reviewsSection" class="pdp-rating-count-link" id="jumpToReviewsLink" ${ratingSummary.count > 0 ? "" : "hidden"}>(${ratingSummary.count} đánh giá)</a>
            <span class="pdp-rating-sep">•</span>
            <span class="pdp-sold-text">Đã bán: <strong>${product.sold}</strong></span>
          </div>

          <!-- Price Box -->
          <div class="pdp-price-box">
            <div class="pdp-price-main-row">
              <span class="pdp-current-price" id="displayCurrentPrice">${formatPrice(initialPricing.price)}</span>
              <del class="pdp-original-price" id="displayOriginalPrice" style="${initialPricing.percent ? "" : "display: none;"}">${formatPrice(initialPricing.original)}</del>
              <span class="pdp-price-percent" id="displayPricePercent" style="${initialPricing.percent ? "" : "display: none;"}">Tiết kiệm ${initialPricing.percent}%</span>
            </div>
            <p class="pdp-vat-note">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Giá đã bao gồm thuế VAT • Cam kết 100% sản phẩm chính hãng EcoDesk
            </p>
          </div>

          <!-- Short Description -->
          <p class="pdp-lead-desc">${product.description}</p>

          <!-- Stock Status -->
          <div class="pdp-stock-status ${inStock ? "in-stock" : "out-of-stock"}" id="pdpStockStatusWrap">
            <span class="pdp-pulse-dot"></span>
            <span id="pdpStockStatusText">${inStock ? `Tình trạng: Còn hàng (${initialStock} sản phẩm sẵn sàng giao)` : "Tạm hết hàng"}</span>
          </div>

          <!-- Variants Selection (Hiển thị động theo thuộc tính sản phẩm) -->
          ${hasVariants ? `
            <div class="pdp-variants-wrap" id="pdpVariantsContainer">
              ${attributes.map((attr) => {
                const isColorAttr = /màu|color/i.test(attr.name);
                return `
                  <div class="pdp-variant-group" data-group-attr="${escapeHtml(attr.name)}">
                    <div class="pdp-variant-label">
                      ${escapeHtml(attr.name)}: <span class="pdp-variant-selected-val" id="selectedLabel_${escapeHtml(attr.name)}">${escapeHtml(selectedOptions[attr.name] || "")}</span>
                    </div>
                    <div class="pdp-options-row">
                      ${(attr.values || []).map((val) => {
                        const isSelected = val === selectedOptions[attr.name];
                        const sw = isColorAttr ? resolveColorSwatch(val) : null;
                        return `
                          <button type="button" class="pdp-opt-btn ${isColorAttr ? "pdp-opt-color" : ""} ${isSelected ? "is-selected" : ""}" data-attr="${escapeHtml(attr.name)}" data-val="${escapeHtml(val)}">
                            ${sw ? `<span class="pdp-opt-swatch" style="background:${sw.hex}; border-color:${sw.border};" aria-hidden="true"></span>` : ""}
                            <span class="pdp-opt-text">${escapeHtml(val)}</span>
                          </button>
                        `;
                      }).join("")}
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          ` : ""}

          <!-- Cảnh báo khi sản phẩm / biến thể tạm hết hàng -->
          <div id="variantStockAlert" class="pdp-variant-alert" style="${inStock ? "display: none;" : "display: block;"}">
            <span style="display:inline-flex; vertical-align:-2px; margin-right:4px;">${renderIcon("alert-triangle", { size: 16, strokeWidth: 2 })}</span>
            ${hasVariants 
              ? (allSoldOut ? "Tất cả các phiên bản của sản phẩm này hiện đã tạm hết hàng. Quý khách vui lòng quay lại sau." : `Lựa chọn "${escapeHtml(initialVariant?.name || "")}" hiện đã tạm hết hàng (tồn kho: 0). Quý khách vui lòng chọn màu sắc hoặc phiên bản khác còn hàng.`)
              : "Mẫu này hiện đã hết hàng. Quý khách vui lòng quay lại sau hoặc liên hệ hỗ trợ."}
          </div>

          <!-- Quantity & Purchase Action Buttons -->
          <div class="pdp-purchase-actions">
            <div class="pdp-qty-row">
              <span class="pdp-qty-label">Số lượng:</span>
              <div class="pdp-qty-stepper">
                <button type="button" class="pdp-qty-btn" id="qtyMinusBtn" aria-label="Giảm số lượng">-</button>
                <input type="number" id="qtyInput" class="pdp-qty-input" value="1" min="1" max="${initialStock}" aria-label="Số lượng sản phẩm">
                <button type="button" class="pdp-qty-btn" id="qtyPlusBtn" aria-label="Tăng số lượng">+</button>
              </div>
              <span class="pdp-qty-hint" id="pdpQtyHint" style="font-size: 0.82rem; color: #64748b;">(Tối đa: ${initialStock} chiếc)</span>
            </div>

            <div class="pdp-btn-group" style="display: flex; gap: 10px; align-items: stretch;">
              <button type="button" id="addToCartBtn" class="pdp-btn-add-cart" ${!inStock ? "disabled" : ""} style="flex: 2;">
                ${renderIcon("shopping-bag", { size: 20, strokeWidth: 2 })}
                <span>Thêm vào giỏ hàng</span>
              </button>
              <button type="button" id="buyNowBtn" class="pdp-btn-buy-now" ${!inStock ? "disabled" : ""} style="flex: 1.5;">
                ${renderIcon("zap", { size: 19, strokeWidth: 2 })}
                <span>Mua ngay</span>
              </button>
              <button type="button" class="pdp-btn-wishlist" data-wishlist-btn data-product-id="${product.id}" title="Lưu vào danh sách yêu thích" aria-label="Yêu thích" style="flex: 0 0 48px; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px; cursor: pointer; transition: all 0.2s;">
                <span class="wishlist-icon" style="display: flex; align-items: center; justify-content: center;">${renderIcon("heart", { size: 20, class: "wishlist-heart-svg" })}</span>
              </button>
            </div>
          </div>

          <!-- 3. Peace of Mind / Trust Blocks -->
          <div class="pdp-trust-grid">
            <div class="pdp-trust-card">
              ${renderIcon("truck", { size: 22, strokeWidth: 1.8, class: "pdp-trust-icon" })}
              <div>
                <h4>Giao hàng & Lắp đặt</h4>
                <p>Miễn phí vận chuyển & lắp đặt nội thành TP.HCM. Toàn quốc cho đơn từ 2.000.000đ.</p>
              </div>
            </div>

            <div class="pdp-trust-card">
              ${renderIcon("shield-check", { size: 22, strokeWidth: 1.8, class: "pdp-trust-icon" })}
              <div>
                <h4>Bảo hành chính hãng</h4>
                <p>Bảo hành điện tử tự động kích hoạt theo số điện thoại mua hàng.</p>
              </div>
            </div>

            <div class="pdp-trust-card">
              ${renderIcon("refresh-cw", { size: 22, strokeWidth: 1.8, class: "pdp-trust-icon" })}
              <div>
                <h4>Đổi trả an tâm</h4>
                <p>Hỗ trợ đổi mới linh hoạt nếu phát sinh lỗi kỹ thuật từ nhà sản xuất.</p>
              </div>
            </div>

            <div class="pdp-trust-card">
              ${renderIcon("phone-call", { size: 22, strokeWidth: 1.8, class: "pdp-trust-icon" })}
              <div>
                <h4>Tư vấn chuyên sâu</h4>
                <p>Hotline <strong>1900 1234</strong> (09:00 - 21:00) sẵn sàng giải đáp kỹ thuật.</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- 2.5. Sub-Hero 2-Column Balanced Section -->
      <div class="pdp-subhero-grid">
        <!-- Left: Add-on Accessory Suggestions -->
        ${recommendedAddons.length > 0 ? `
          <div class="pdp-addon-card">
            <div class="pdp-addon-header">
              <div class="pdp-addon-title-wrap">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                <span class="pdp-addon-title">Gợi ý phụ kiện hoàn thiện setup</span>
              </div>
              <span class="pdp-addon-badge">Tương thích 100%</span>
            </div>
            <p class="pdp-addon-subtitle">Thường được chọn mua cùng để tối ưu không gian làm việc gọn gàng:</p>
            <div class="pdp-addon-list">
              ${recommendedAddons.map((addon) => {
                const addonPrice = getPricing(addon);
                const addonHasVariants = Array.isArray(addon.variants) && addon.variants.length > 0;
                const addonStock = addonHasVariants
                  ? addon.variants.reduce((sum, v) => sum + Math.max(0, Number(v.stock) || 0), 0)
                  : Math.max(0, Number(addon.stock) || 0);
                return `
                  <div class="pdp-addon-item">
                    <a href="./detail.html?id=${addon.id}" class="pdp-addon-thumb-link" title="Xem ${escapeHtml(addon.name)}">
                      <img src="${addon.image}" alt="${escapeHtml(addon.name)}" class="pdp-addon-thumb">
                    </a>
                    <div class="pdp-addon-info">
                      <a href="./detail.html?id=${addon.id}" class="pdp-addon-name">${escapeHtml(addon.name)}</a>
                      <div class="pdp-addon-price-row">
                        <span class="pdp-addon-price">${addonHasVariants ? `Từ ${formatPrice(addonPrice.price)}` : formatPrice(addonPrice.price)}</span>
                        ${addonPrice.percent > 0 ? `<span class="pdp-addon-sale">-${addonPrice.percent}%</span>` : ""}
                      </div>
                    </div>
                    ${addonHasVariants
                      ? `<a href="./detail.html?id=${addon.id}" class="pdp-addon-add-btn pdp-addon-select-link" title="Chọn phân loại cho ${escapeHtml(addon.name)}">Chọn loại</a>`
                      : `<button type="button" class="pdp-addon-add-btn" data-id="${addon.id}" data-name="${escapeHtml(addon.name)}" ${addonStock <= 0 ? "disabled" : ""} title="${addonStock <= 0 ? "Tạm hết hàng" : "Thêm phụ kiện này vào giỏ hàng"}">
                          ${addonStock <= 0
                            ? `<span>Hết hàng</span>`
                            : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                               <span>+ Thêm</span>`}
                        </button>`
                    }
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        ` : ""}

        <!-- Right: Showroom & Direct Consultation Banner -->
        <div class="pdp-showroom-card">
          <div class="pdp-showroom-header">
            <div class="pdp-showroom-title-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              <span class="pdp-showroom-title">Trải nghiệm trực tiếp tại Showroom EcoDesk</span>
            </div>
            <span class="pdp-showroom-status"><span class="pdp-dot-live"></span> Đang mở cửa (09:00 - 21:00)</span>
          </div>
          <div class="pdp-showroom-branches">
            <div class="pdp-branch-item">
              <span class="pdp-branch-pin" style="display:inline-flex; align-items:center; color: var(--color-primary);">${renderIcon("map-pin", { size: 16, strokeWidth: 2 })}</span>
              <span class="pdp-branch-text"><strong>Showroom TP.HCM:</strong> 123 Nguyễn Thị Minh Khai, P. Bến Thành, Q.1</span>
            </div>
            <div class="pdp-branch-item">
              <span class="pdp-branch-pin" style="display:inline-flex; align-items:center; color: var(--color-primary);">${renderIcon("map-pin", { size: 16, strokeWidth: 2 })}</span>
              <span class="pdp-branch-text"><strong>Showroom Hà Nội:</strong> 45 Thái Hà, P. Trung Liệt, Q. Đống Đa</span>
            </div>
          </div>
          <div class="pdp-showroom-footer">
            <div class="pdp-showroom-hotline">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              <span>Hotline demo & tư vấn lắp đặt: <strong>1900 1234</strong> (Miễn cước)</span>
            </div>
            <a href="./payment-support.html" class="pdp-showroom-link">Xem hỗ trợ khách hàng →</a>
          </div>
        </div>
      </div>

      <!-- 4. Detailed Product Information Tabs -->
      <section class="pdp-tabs-section" id="detailsSection">
        <div class="pdp-tab-nav" role="tablist">
          <button type="button" class="pdp-tab-btn is-active" data-tab="tab-overview" role="tab" aria-selected="true">Mô tả & Lợi ích</button>
          <button type="button" class="pdp-tab-btn" data-tab="tab-features" role="tab" aria-selected="false">Tính năng nổi bật</button>
          ${specs.length > 0 ? `<button type="button" class="pdp-tab-btn" data-tab="tab-specs" role="tab" aria-selected="false">Thông số kỹ thuật</button>` : ""}
          ${hasVariants ? `<button type="button" class="pdp-tab-btn" data-tab="tab-variants" role="tab" aria-selected="false">Phiên bản & Tồn kho (${productVariants.length})</button>` : ""}
          <button type="button" class="pdp-tab-btn" data-tab="tab-guide" role="tab" aria-selected="false">Hướng dẫn lắp đặt & Sử dụng</button>
          <button type="button" class="pdp-tab-btn" data-tab="tab-policy" role="tab" aria-selected="false">Chính sách & Hậu mãi</button>
        </div>

        <!-- Tab 1: Overview -->
        <div class="pdp-tab-panel is-active" id="tab-overview" role="tabpanel">
          <div class="pdp-overview-content">
            <p><strong>${product.name}</strong> là giải pháp công thái học cao cấp được nghiên cứu và phát triển để tối ưu hóa không gian làm việc cho người Việt. Sản phẩm không chỉ mang lại nét thẩm mỹ hiện đại, tinh giản mà còn chủ động bảo vệ sức khỏe cột sống, phòng ngừa tình trạng đau mỏi cổ vai gáy khi phải ngồi làm việc liên tục trong nhiều giờ.</p>
            <p>${product.description}</p>

            <div class="pdp-benefits-grid">
              <div class="pdp-benefit-box">
                <div class="pdp-benefit-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                </div>
                <h4>Tư thế lành mạnh</h4>
                <p>Thiết kế chuẩn sinh học giúp duy trì đường cong sinh lý tự nhiên, giải tỏa áp lực đĩa đệm và tăng cường lưu thông tuần hoàn máu.</p>
              </div>

              <div class="pdp-benefit-box">
                <div class="pdp-benefit-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                </div>
                <h4>Không gian gọn gàng</h4>
                <p>Tối ưu hóa diện tích mặt bàn, tương thích hoàn hảo với các hệ thống quản lý dây cáp và phụ kiện kẹp bàn EcoDesk.</p>
              </div>

              <div class="pdp-benefit-box">
                <div class="pdp-benefit-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
                </div>
                <h4>Bền bỉ dài lâu</h4>
                <p>Vật liệu tuyển chọn chịu tải cao, đã qua hàng ngàn chu kỳ thử nghiệm áp lực nghiêm ngặt trước khi đến tay người tiêu dùng.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 2: Features -->
        <div class="pdp-tab-panel" id="tab-features" role="tabpanel">
          <div class="pdp-features-grid">
            <div class="pdp-feature-card">
              <div class="pdp-feature-header">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                <h4>Chất liệu hoàn thiện tinh tế</h4>
              </div>
              <p>Từng góc cạnh, khớp nối và bề mặt sơn tĩnh điện được hoàn thiện tỉ mỉ, đem lại cảm giác cầm chạm êm ái, chống trầy xước và bám vân tay.</p>
            </div>

            <div class="pdp-feature-card">
              <div class="pdp-feature-header">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <h4>Độ an toàn và ổn định vượt trội</h4>
              </div>
              <p>Khung gầm và kết cấu chịu lực đạt chuẩn tải trọng cao, không rung lắc khi gõ phím hay nâng hạ ở điểm cao nhất.</p>
            </div>

            <div class="pdp-feature-card">
              <div class="pdp-feature-header">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                <h4>Tùy biến linh hoạt theo vóc dáng</h4>
              </div>
              <p>Mọi cơ chế điều chỉnh đều được tối giản hóa để người dùng thao tác mượt mà chỉ bằng một nút bấm hoặc chạm nhẹ.</p>
            </div>

            <div class="pdp-feature-card">
              <div class="pdp-feature-header">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                <h4>Hệ sinh thái đồng bộ EcoDesk</h4>
              </div>
              <p>Dễ dàng kết hợp cùng tay nâng màn hình, kệ đỡ laptop, khay đi dây và đèn bảo vệ thị lực để tạo nên một góc làm việc hoàn hảo.</p>
            </div>
          </div>
        </div>

        <!-- Tab 3: Technical Specifications -->
        <div class="pdp-tab-panel" id="tab-specs" role="tabpanel">
          <div class="pdp-specs-table-wrap">
            <table class="pdp-specs-table">
              <tbody>
                ${specs.map((row) => `
                  <tr>
                    <td>${escapeHtml(row.label)}</td>
                    <td>${escapeHtml(row.value)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>

        ${hasVariants ? `
          <!-- Tab 3.5: Variant Comparison Matrix -->
          <div class="pdp-tab-panel" id="tab-variants" role="tabpanel">
            <div class="pdp-specs-table-wrap">
              <table class="pdp-specs-table pdp-variant-matrix-table">
                <thead>
                  <tr>
                    <th>Phiên bản / Thuộc tính</th>
                    <th>Mã SKU</th>
                    <th>Giá bán</th>
                    <th>Tồn kho</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  ${productVariants.map((v) => {
                    const vp = getPricing({ ...product, price: v.price }, new Date(), v);
                    const vStock = Math.max(0, Number(v.stock) || 0);
                    return `
                      <tr>
                        <td><strong>${escapeHtml(v.name)}</strong></td>
                        <td><code>${escapeHtml(v.sku)}</code></td>
                        <td>
                          <strong>${formatPrice(vp.price)}</strong>
                          ${vp.percent ? `<del style="margin-left:6px; color:#94a3b8; font-size:0.82rem;">${formatPrice(vp.original)}</del>` : ""}
                        </td>
                        <td>
                          <span class="pdp-matrix-stock ${vStock > 0 ? "in" : "out"}">
                            ${vStock > 0 ? `Còn ${vStock}` : "Tạm hết hàng"}
                          </span>
                        </td>
                        <td style="text-align:right;">
                          <button type="button" class="btn-outline pdp-matrix-pick-btn" data-pick-variant-id="${escapeHtml(v.id)}">
                            Chọn mẫu này
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join("")}
                </tbody>
              </table>
            </div>
          </div>
        ` : ""}

        <!-- Tab 4: Installation Guide -->
        <div class="pdp-tab-panel" id="tab-guide" role="tabpanel">
          <div class="pdp-steps-timeline">
            <div class="pdp-step-item">
              <div class="pdp-step-num">1</div>
              <div class="pdp-step-body">
                <h4>Kiểm tra kiện hàng & Tháo mở bao bì</h4>
                <p>Mở hộp cẩn thận trên mặt phẳng sạch, kiểm tra đầy đủ các linh kiện, ốc vít và phụ kiện lắp đặt theo danh mục hướng dẫn đính kèm.</p>
              </div>
            </div>

            <div class="pdp-step-item">
              <div class="pdp-step-num">2</div>
              <div class="pdp-step-body">
                <h4>Lắp ráp khung đỡ & Cố định kết cấu</h4>
                <p>Sử dụng bộ dụng cụ lục giác được cung cấp để siết chặt các khớp nối theo sơ đồ đánh số thứ tự từ chân đế lên khung chính.</p>
              </div>
            </div>

            <div class="pdp-step-item">
              <div class="pdp-step-num">3</div>
              <div class="pdp-step-body">
                <h4>Cân chỉnh & Thiết lập vị trí làm việc</h4>
                <p>Điều chỉnh chân đế chống bập bênh, cắm nguồn điện (nếu có thiết bị điện tử) và ghi nhớ các nấc vị trí phù hợp với chiều cao cơ thể.</p>
              </div>
            </div>

            <div class="pdp-step-item">
              <div class="pdp-step-num">4</div>
              <div class="pdp-step-body">
                <h4>Bảo quản định kỳ</h4>
                <p>Lau chùi bằng khăn mềm ẩm, tránh đổ trực tiếp dung môi tẩy rửa mạnh lên bề mặt gỗ hoặc các cụm phím điều khiển điện.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 5: Warranty Policy -->
        <div class="pdp-tab-panel" id="tab-policy" role="tabpanel">
          <div class="pdp-overview-content">
            <h4>Chính sách bảo hành chính hãng EcoDesk</h4>
            <p>Mọi sản phẩm của EcoDesk đều được áp dụng hệ thống bảo hành điện tử chính hãng thông qua số điện thoại đặt hàng. Khi có yêu cầu bảo hành hoặc sửa chữa kỹ thuật, bạn không cần giữ hóa đơn giấy tờ phức tạp.</p>
            <ul>
              <li><strong>Thời gian tiếp nhận:</strong> Trong vòng 24h làm việc kể từ khi nhận được thông báo lỗi.</li>
              <li><strong>Điều kiện bảo hành:</strong> Lỗi kỹ thuật hoặc hư hỏng phát sinh do nhà sản xuất trong quá trình sử dụng bình thường.</li>
              <li><strong>Kênh tiếp nhận:</strong> Hotline <strong>1900 1234</strong> hoặc gửi yêu cầu tra soát tại <a href="./payment-support.html" style="color: var(--pdp-primary); font-weight: 700;">Trung tâm hỗ trợ khách hàng EcoDesk</a>.</li>
            </ul>
          </div>
        </div>
      </section>

      <!-- 5. Reviews & FAQs Section -->
      <div class="pdp-reviews-faq-wrap" id="reviewsSection">
        <!-- Customer Reviews Box -->
        <div class="pdp-box-card" id="pdpReviewsCard">
          ${renderReviewsBoxInner(product)}
        </div>

        <!-- FAQs Box -->
        <div class="pdp-box-card">
          <h3 class="pdp-section-title">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Câu hỏi thường gặp
          </h3>

          <div class="pdp-faq-list">
            ${faqs.map((f, idx) => `
              <div class="pdp-faq-item ${idx === 0 ? "is-open" : ""}">
                <button type="button" class="pdp-faq-question">
                  <span>${f.q}</span>
                  <svg class="pdp-faq-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <div class="pdp-faq-answer">
                  <p>${f.a}</p>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>

      <!-- 6. Related Products -->
      <section class="pdp-related-section">
        <h3 class="pdp-section-title" style="margin-bottom: 24px;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          Sản phẩm liên quan & Thường mua cùng
        </h3>

        <div class="pdp-related-grid">
          ${relatedProducts.map((p) => {
            const relPrice = getPricing(p);
            return `
              <article class="product-card">
                <a class="product-image" href="./detail.html?id=${p.id}">
                  <img src="${p.image}" alt="${p.name}" loading="lazy">
                </a>
                <div class="product-body">
                  <div class="badge-row">
                    ${isNewProduct(p) ? `<span class="badge" style="background:#1f7a5c;color:#fff;">Mới</span>` : ""}
                    ${normalizeProductTags(p.tags).slice(0, 1).map((t) => `<span class="badge">${escapeHtml(t)}</span>`).join("")}
                  </div>
                  <h3><a href="./detail.html?id=${p.id}">${p.name}</a></h3>
                  <div class="product-meta">
                    <span class="price">${formatPrice(relPrice.price)}</span>
                    ${relPrice.percent ? `<span class="badge badge-sale">-${relPrice.percent}%</span>` : ""}
                  </div>
                  <div class="product-foot">
                    <button class="btn btn-outline" onclick="window.location.href='./detail.html?id=${p.id}'" type="button">Xem chi tiết</button>
                  </div>
                </div>
              </article>
            `;
          }).join("")}
        </div>
      </section>

      <!-- 7. Lightbox Zoom Modal with Prev/Next Controls -->
      <div class="pdp-lightbox" id="pdpLightbox" role="dialog" aria-modal="true" aria-label="Xem ảnh lớn">
        <button type="button" class="pdp-lightbox-nav prev" id="lightboxPrevBtn" aria-label="Xem ảnh trước">${renderIcon("chevron-left", { size: 28, strokeWidth: 2 })}</button>
        <div class="pdp-lightbox-content">
          <button type="button" class="pdp-lightbox-close" id="lightboxCloseBtn" aria-label="Đóng (ESC)">${renderIcon("x", { size: 24, strokeWidth: 2 })}</button>
          <img id="lightboxImg" src="${initialMainImg}" alt="${product.name}">
          <div class="pdp-lightbox-counter" id="lightboxCounter">1 / ${galleryItems.length}</div>
        </div>
        <button type="button" class="pdp-lightbox-nav next" id="lightboxNextBtn" aria-label="Xem ảnh kế tiếp">${renderIcon("chevron-right", { size: 28, strokeWidth: 2 })}</button>
      </div>

      <!-- 8. Sticky Mobile Buy Bar -->
      <div class="pdp-sticky-bar" id="mobileStickyBar">
        <div class="pdp-sticky-info">
          <img src="${initialMainImg}" alt="${product.name}" class="pdp-sticky-thumb">
          <div class="pdp-sticky-text">
            <span class="pdp-sticky-title">${product.name}</span>
            <span class="pdp-sticky-price">${formatPrice(pricing.price)}</span>
          </div>
        </div>
        <div class="pdp-sticky-actions">
          <button type="button" class="pdp-sticky-btn-cart" id="mobileAddCartBtn" ${!inStock ? "disabled" : ""}>Thêm giỏ</button>
          <button type="button" class="pdp-sticky-btn-buy" id="mobileBuyNowBtn" ${!inStock ? "disabled" : ""}>Mua ngay</button>
        </div>
      </div>
    </div>
  `;

  // --- Attach PDP Interactive Event Handlers ---

  // A. Gallery Carousel & Navigation Handlers
  const mainImg = $("#mainDisplayImg");
  const lightbox = $("#pdpLightbox");
  const lightboxImg = $("#lightboxImg");
  const lightboxClose = $("#lightboxCloseBtn");

  let currentGalleryIdx = 0;
  const initialIdx = galleryItems.findIndex((g) => g.url === initialMainImg);
  if (initialIdx !== -1) currentGalleryIdx = initialIdx;

  const updateActiveGallery = (idx, { syncVariant = true, scrollThumb = true } = {}) => {
    if (!galleryItems || galleryItems.length === 0) return;
    currentGalleryIdx = (idx + galleryItems.length) % galleryItems.length;
    const item = galleryItems[currentGalleryIdx];
    if (!item) return;

    if (mainImg) {
      mainImg.style.opacity = "0.5";
      mainImg.src = item.url;
      setTimeout(() => { if (mainImg) mainImg.style.opacity = "1"; }, 120);
    }
    if (lightboxImg) lightboxImg.src = item.url;

    const counter = $("#pdpImageCounter");
    if (counter) counter.textContent = `${currentGalleryIdx + 1} / ${galleryItems.length}`;
    const capEl = $("#pdpImageCaption");
    if (capEl) capEl.textContent = item.caption || product.name;
    const lbCounter = $("#lightboxCounter");
    if (lbCounter) lbCounter.textContent = `${currentGalleryIdx + 1} / ${galleryItems.length}`;

    const allThumbs = document.querySelectorAll(".pdp-thumb-btn");
    allThumbs.forEach((b, i) => {
      if (i === currentGalleryIdx) {
        b.classList.add("is-active");
        if (scrollThumb) {
          b.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }
      } else {
        b.classList.remove("is-active");
      }
    });

    // Nếu ảnh gắn liền với một thuộc tính/biến thể thì kích hoạt biến thể đó
    if (syncVariant && !item.isGeneral && hasVariants) {
      if (item.variantId) {
        const targetVar = (productVariants || []).find((v) => v.id === item.variantId);
        if (targetVar && targetVar.options) {
          Object.assign(selectedOptions, targetVar.options);
          syncVariantState({ skipImageChange: true });
          return;
        }
      }
      if (item.attributeKey && item.attributeValue) {
        selectedOptions[item.attributeKey] = item.attributeValue;
        syncVariantState({ skipImageChange: true });
      }
    }
  };

  // Click vào thumbnail ảnh
  document.querySelectorAll(".pdp-thumb-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-idx") || 0);
      updateActiveGallery(idx, { syncVariant: true, scrollThumb: true });
    });
  });

  // Nút mũi tên lướt ảnh trên khung ảnh chính (như ảnh tham khảo)
  $("#mainPrevBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    updateActiveGallery(currentGalleryIdx - 1, { syncVariant: true, scrollThumb: true });
  });

  $("#mainNextBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    updateActiveGallery(currentGalleryIdx + 1, { syncVariant: true, scrollThumb: true });
  });

  // Nút mũi tên cuộn thanh thumbnail trái / phải (như ảnh tham khảo)
  $("#thumbPrevBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    $("#thumbList")?.scrollBy({ left: -220, behavior: "smooth" });
  });

  $("#thumbNextBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    $("#thumbList")?.scrollBy({ left: 220, behavior: "smooth" });
  });

  // Nút chuyển ảnh trong Lightbox Modal
  $("#lightboxPrevBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    updateActiveGallery(currentGalleryIdx - 1, { syncVariant: true, scrollThumb: true });
  });

  $("#lightboxNextBtn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    updateActiveGallery(currentGalleryIdx + 1, { syncVariant: true, scrollThumb: true });
  });

  // Điều hướng bằng phím mũi tên bàn phím
  document.addEventListener("keydown", (e) => {
    if (lightbox.classList.contains("is-open")) {
      if (e.key === "ArrowLeft") {
        updateActiveGallery(currentGalleryIdx - 1, { syncVariant: true, scrollThumb: true });
      } else if (e.key === "ArrowRight") {
        updateActiveGallery(currentGalleryIdx + 1, { syncVariant: true, scrollThumb: true });
      }
    }
  });

  const openLightbox = () => {
    lightbox.classList.add("is-open");
    document.body.style.overflow = "hidden";
  };
  const closeLightbox = () => {
    lightbox.classList.remove("is-open");
    document.body.style.overflow = "";
  };

  let didTouchSwipe = false;
  const attachSwipeHandlers = (targetEl, onSwipeLeft, onSwipeRight) => {
    if (!targetEl) return;
    let startX = 0;
    let startY = 0;
    targetEl.addEventListener(
      "touchstart",
      (e) => {
        if (!e.touches || e.touches.length !== 1) return;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        didTouchSwipe = false;
      },
      { passive: true }
    );
    targetEl.addEventListener(
      "touchend",
      (e) => {
        if (!e.changedTouches || e.changedTouches.length !== 1) return;
        const dx = e.changedTouches[0].clientX - startX;
        const dy = e.changedTouches[0].clientY - startY;
        if (Math.abs(dx) >= 42 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          didTouchSwipe = true;
          if (dx < 0) onSwipeLeft();
          else onSwipeRight();
        }
      },
      { passive: true }
    );
  };

  const mainImageWrap = $("#mainImageWrap");
  attachSwipeHandlers(
    mainImageWrap,
    () => updateActiveGallery(currentGalleryIdx + 1, { syncVariant: true, scrollThumb: true }),
    () => updateActiveGallery(currentGalleryIdx - 1, { syncVariant: true, scrollThumb: true })
  );
  attachSwipeHandlers(
    lightbox,
    () => updateActiveGallery(currentGalleryIdx + 1, { syncVariant: true, scrollThumb: true }),
    () => updateActiveGallery(currentGalleryIdx - 1, { syncVariant: true, scrollThumb: true })
  );

  mainImageWrap.addEventListener("click", () => {
    if (didTouchSwipe) {
      didTouchSwipe = false;
      return;
    }
    openLightbox();
  });
  $("#zoomLightboxBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    openLightbox();
  });
  lightboxClose.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && lightbox.classList.contains("is-open")) {
      closeLightbox();
    }
  });

  // B. Variant Selection & Live Stock Synchronization
  let currentVariant = initialVariant;
  const qtyInput = $("#qtyInput");
  const qtyMinus = $("#qtyMinusBtn");
  const qtyPlus = $("#qtyPlusBtn");
  const stockWrap = $("#pdpStockStatusWrap");
  const stockText = $("#pdpStockStatusText");
  const stockAlert = $("#variantStockAlert");
  const skuText = $("#pdpSkuText");
  const curPriceEl = $("#displayCurrentPrice");
  const origPriceEl = $("#displayOriginalPrice");
  const percentEl = $("#displayPricePercent");
  const qtyHint = $("#pdpQtyHint");
  const addCartBtn = $("#addToCartBtn");
  const buyNowBtn = $("#buyNowBtn");
  const mobAddCartBtn = $("#mobileAddCartBtn");
  const mobBuyNowBtn = $("#mobileBuyNowBtn");
  const mobPriceEl = document.querySelector("#mobileStickyBar .pdp-sticky-price");

  const updateQtyButtons = (currentVal, maxLimit) => {
    if (qtyMinus) qtyMinus.disabled = currentVal <= 1 || maxLimit <= 0;
    if (qtyPlus) qtyPlus.disabled = currentVal >= maxLimit || maxLimit <= 0;
  };

  const syncVariantState = (opts = {}) => {
    // Luôn lấy dữ liệu tồn kho mới nhất của sản phẩm từ storage
    const freshProducts = getProducts();
    const currentProd = freshProducts.find((p) => String(p.id) === String(product.id)) || product;

    let availableStock = 0;
    let basePrice = Number(currentProd.price || 0);
    let isInvalidCombo = false;
    let currentVariantName = "";

    if (hasVariants) {
      // Tìm biến thể khớp chính xác với tất cả thuộc tính đã chọn
      currentVariant = (currentProd.variants || []).find((v) => {
        if (!v.options) return false;
        return Object.entries(selectedOptions).every(([k, val]) => v.options[k] === val);
      }) || null;

      if (currentVariant) {
        availableStock = Math.max(0, Number(currentVariant.stock) || 0);
        basePrice = (currentVariant.price != null && !isNaN(currentVariant.price)) ? Number(currentVariant.price) : Number(currentProd.price || 0);
        currentVariantName = currentVariant.name;
      } else {
        // Tổ hợp này không tồn tại trong danh mục biến thể
        isInvalidCombo = true;
        availableStock = 0;
      }
    } else {
      availableStock = Math.max(0, Number(currentProd.stock) || 0);
      currentVariantName = currentProd.name;
    }

    const pricing = getPricing({ ...currentProd, price: basePrice }, new Date(), currentVariant);

    // Cập nhật giá
    if (curPriceEl) curPriceEl.textContent = isInvalidCombo ? "—" : formatPrice(pricing.price);
    if (mobPriceEl) mobPriceEl.textContent = isInvalidCombo ? "—" : formatPrice(pricing.price);
    if (origPriceEl) {
      origPriceEl.textContent = formatPrice(pricing.original);
      origPriceEl.style.display = (!isInvalidCombo && pricing.percent) ? "" : "none";
    }
    if (percentEl) {
      const saveText = pricing.savings ? `Tiết kiệm ${formatPrice(pricing.savings)} (${pricing.percent}%)` : `Tiết kiệm ${pricing.percent}%`;
      percentEl.textContent = saveText;
      percentEl.style.display = (!isInvalidCombo && pricing.percent) ? "" : "none";
    }

    // Cập nhật SKU & Mã SP
    if (skuText) {
      skuText.textContent = `Mã SP: ${currentVariant?.sku || currentProd.id}`;
    }

    // Đồng bộ ảnh chính & highlight thumbnail tương ứng (nếu không phải kích hoạt từ click thumbnail)
    if (!opts?.skipImageChange) {
      let targetImg = currentVariant?.image || "";
      if (!targetImg && currentVariant?.id) {
        const galMatch = galleryItems.find((g) => g.variantId && g.variantId === currentVariant.id);
        if (galMatch) targetImg = galMatch.url;
      }
      if (!targetImg && hasVariants) {
        // Tìm theo thuộc tính đã chọn (ưu tiên Màu sắc)
        for (const [k, val] of Object.entries(selectedOptions)) {
          const galAttrMatch = galleryItems.find((g) => !g.isGeneral && g.attributeKey === k && g.attributeValue === val);
          if (galAttrMatch) {
            targetImg = galAttrMatch.url;
            break;
          }
        }
      }
      if (!targetImg && galleryItems.length > 0) {
        targetImg = galleryItems[0].url;
      }

      if (targetImg) {
        const matchIdx = galleryItems.findIndex((g) => g.url === targetImg);
        if (matchIdx !== -1) {
          updateActiveGallery(matchIdx, { syncVariant: false, scrollThumb: true });
        } else {
          if (mainImg) mainImg.src = targetImg;
          if (lightboxImg) lightboxImg.src = targetImg;
        }
      }
    }

    // Kiểm tra tất cả biến thể hết hàng
    const allVariantsSoldOut = hasVariants
      ? (currentProd.variants || []).every((v) => Number(v.stock) <= 0)
      : availableStock <= 0;

    // Cập nhật trạng thái tồn kho & nút mua
    if (availableStock > 0) {
      if (stockWrap) {
        stockWrap.className = "pdp-stock-status in-stock";
      }
      if (stockText) {
        stockText.textContent = `Tình trạng: Còn hàng (${availableStock} sản phẩm sẵn sàng giao)`;
      }
      if (stockAlert) {
        stockAlert.style.display = "none";
      }
      if (addCartBtn) addCartBtn.disabled = false;
      if (buyNowBtn) buyNowBtn.disabled = false;
      if (mobAddCartBtn) mobAddCartBtn.disabled = false;
      if (mobBuyNowBtn) mobBuyNowBtn.disabled = false;

      if (qtyInput) {
        qtyInput.disabled = false;
        qtyInput.max = availableStock;
        let currentQty = parseInt(qtyInput.value) || 1;
        if (currentQty > availableStock) currentQty = availableStock;
        if (currentQty < 1) currentQty = 1;
        qtyInput.value = currentQty;
        updateQtyButtons(currentQty, availableStock);
      }
      if (qtyHint) {
        qtyHint.textContent = `(Tối đa: ${availableStock} chiếc)`;
      }
    } else {
      if (stockWrap) {
        stockWrap.className = "pdp-stock-status out-of-stock";
      }

      if (addCartBtn) addCartBtn.disabled = true;
      if (buyNowBtn) buyNowBtn.disabled = true;
      if (mobAddCartBtn) mobAddCartBtn.disabled = true;
      if (mobBuyNowBtn) mobBuyNowBtn.disabled = true;

      if (qtyInput) {
        qtyInput.disabled = true;
        qtyInput.value = 1;
        qtyInput.max = 0;
        updateQtyButtons(1, 0);
      }

      if (!hasVariants) {
        // Trường hợp 1: Sản phẩm chỉ có 1 mẫu duy nhất hết hàng
        if (stockText) stockText.textContent = "Tình trạng: Tạm hết hàng (0 sản phẩm sẵn sàng giao)";
        if (qtyHint) qtyHint.textContent = "(Tạm hết hàng)";
        if (stockAlert) {
          stockAlert.style.display = "block";
          stockAlert.innerHTML = `<span style="display:inline-flex; align-items:center; gap:6px; vertical-align:middle; margin-right:4px;">${renderIcon("alert-triangle", { size: 16, strokeWidth: 1.8 })}</span> Mẫu này hiện đã hết hàng. Quý khách vui lòng quay lại sau hoặc liên hệ hỗ trợ.`;
        }
      } else if (allVariantsSoldOut) {
        // Trường hợp 5: Tất cả biến thể đều hết hàng
        if (stockText) stockText.textContent = "Tình trạng: Tạm hết hàng (Tất cả phiên bản hiện đã hết hàng)";
        if (qtyHint) qtyHint.textContent = "(Tạm hết hàng)";
        if (stockAlert) {
          stockAlert.style.display = "block";
          stockAlert.innerHTML = `<span style="display:inline-flex; align-items:center; gap:6px; vertical-align:middle; margin-right:4px;">${renderIcon("alert-triangle", { size: 16, strokeWidth: 1.8 })}</span> Tất cả các phiên bản của sản phẩm này hiện đã tạm hết hàng. Quý khách vui lòng quay lại sau.`;
        }
      } else if (isInvalidCombo) {
        // Trường hợp 4: Tổ hợp không tồn tại
        if (stockText) stockText.textContent = "Tình trạng: Lựa chọn không khả dụng";
        if (qtyHint) qtyHint.textContent = "(Không khả dụng)";
        if (stockAlert) {
          stockAlert.style.display = "block";
          stockAlert.innerHTML = `<span style="display:inline-flex; align-items:center; gap:6px; vertical-align:middle; margin-right:4px;">${renderIcon("alert-triangle", { size: 16, strokeWidth: 1.8 })}</span> Tổ hợp lựa chọn này không tồn tại trong danh mục sản phẩm. Quý khách vui lòng chọn lại thuộc tính khác.`;
        }
      } else {
        // Trường hợp 2 & 3: Biến thể được chọn hết hàng
        if (stockText) stockText.textContent = "Tình trạng: Tạm hết hàng (0 sản phẩm sẵn sàng giao)";
        if (qtyHint) qtyHint.textContent = "(Tạm hết hàng)";
        if (stockAlert) {
          stockAlert.style.display = "block";
          const varLabel = currentVariantName || Object.values(selectedOptions).join(" - ");
          stockAlert.innerHTML = `<span style="display:inline-flex; align-items:center; gap:6px; vertical-align:middle; margin-right:4px;">${renderIcon("alert-triangle", { size: 16, strokeWidth: 1.8 })}</span> Lựa chọn "<strong>${escapeHtml(varLabel)}</strong>" hiện đã tạm hết hàng (tồn kho: 0). Quý khách vui lòng chọn màu sắc hoặc phiên bản khác còn hàng.`;
        }
      }
    }

    // Cập nhật nhãn lựa chọn đang active và kiểm tra độ sẵn sàng của các nút
    if (hasVariants) {
      attributes.forEach((attr) => {
        const valLabel = document.getElementById(`selectedLabel_${attr.name}`);
        if (valLabel) valLabel.textContent = selectedOptions[attr.name] || "";

        document.querySelectorAll(`.pdp-opt-btn[data-attr="${attr.name}"]`).forEach((btn) => {
          const val = btn.getAttribute("data-val");
          const isSelected = val === selectedOptions[attr.name];
          btn.classList.toggle("is-selected", isSelected);

          // Thử kết hợp giá trị này với các lựa chọn hiện tại của các thuộc tính khác
          const testOptions = { ...selectedOptions, [attr.name]: val };
          const testVar = (currentProd.variants || []).find((v) =>
            v.options && Object.entries(testOptions).every(([k, vVal]) => v.options[k] === vVal)
          );

          const exists = Boolean(testVar);
          const isSoldOut = exists ? Number(testVar.stock) <= 0 : false;
          const isInvalid = !exists;

          btn.classList.toggle("is-sold-out", exists && isSoldOut);
          btn.classList.toggle("is-invalid-combo", isInvalid);

          let tag = btn.querySelector(".opt-out-tag");
          let invalidTag = btn.querySelector(".opt-invalid-tag");

          if (exists && isSoldOut) {
            if (invalidTag) invalidTag.remove();
            if (!tag) {
              tag = document.createElement("span");
              tag.className = "opt-out-tag";
              btn.appendChild(tag);
            }
            tag.innerHTML = `<span style="display:inline-flex; align-items:center; gap:3px;">${renderIcon("x", { size: 11, strokeWidth: 2 })} Hết hàng</span>`;
          } else if (isInvalid) {
            if (tag) tag.remove();
            if (!invalidTag) {
              invalidTag = document.createElement("span");
              invalidTag.className = "opt-invalid-tag";
              invalidTag.textContent = "Không có mẫu này";
              btn.appendChild(invalidTag);
            }
          } else {
            if (tag) tag.remove();
            if (invalidTag) invalidTag.remove();
          }
        });
      });
    }
  };

  // Lắng nghe sự kiện click chọn biến thể
  if (hasVariants) {
    document.querySelectorAll(".pdp-opt-btn[data-attr]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const attrName = btn.getAttribute("data-attr");
        const val = btn.getAttribute("data-val");
        if (selectedOptions[attrName] === val) {
          const curSrc = mainImg?.getAttribute("src") || "";
          if (!currentVariant?.image || curSrc === currentVariant.image) return;
        }
        selectedOptions[attrName] = val;
        syncVariantState({ skipImageChange: false });
      });
    });
  }

  // Khởi chạy đồng bộ trạng thái ban đầu (giữ nguyên ảnh trưng bày chính trừ khi URL truyền ?variant=...)
  syncVariantState({ skipImageChange: !hasRequestedVariant });

  // C. Quantity Stepper Handlers
  if (qtyMinus && qtyInput) {
    qtyMinus.addEventListener("click", () => {
      const maxLimit = currentVariant ? Math.max(0, Number(currentVariant.stock) || 0) : Math.max(0, Number(product.stock) || 0);
      let current = parseInt(qtyInput.value) || 1;
      if (current > 1) {
        current -= 1;
        qtyInput.value = current;
        updateQtyButtons(current, maxLimit);
      }
    });
  }

  if (qtyPlus && qtyInput) {
    qtyPlus.addEventListener("click", () => {
      const maxLimit = currentVariant ? Math.max(0, Number(currentVariant.stock) || 0) : Math.max(0, Number(product.stock) || 0);
      let current = parseInt(qtyInput.value) || 1;
      if (current < maxLimit) {
        current += 1;
        qtyInput.value = current;
        updateQtyButtons(current, maxLimit);
      }
    });
  }

  if (qtyInput) {
    qtyInput.addEventListener("change", () => {
      const maxLimit = currentVariant ? Math.max(0, Number(currentVariant.stock) || 0) : Math.max(0, Number(product.stock) || 0);
      let current = parseInt(qtyInput.value) || 1;
      if (current < 1) current = 1;
      if (current > maxLimit && maxLimit > 0) current = maxLimit;
      qtyInput.value = current;
      updateQtyButtons(current, maxLimit);
    });
  }

  // D. Add to Cart & Buy Now Handlers
  const handleAddToCart = (redirect = false) => {
    // Luôn lấy dữ liệu sản phẩm và biến thể mới nhất từ storage để kiểm tra tồn kho thời gian thực
    const freshProducts = getProducts();
    const freshProduct = freshProducts.find((p) => String(p.id) === String(product.id)) || product;

    let targetVariant = null;
    let currentStock = 0;
    let itemDisplayName = freshProduct.name;

    if (hasVariants) {
      targetVariant = (freshProduct.variants || []).find((v) => {
        if (!v.options) return false;
        return Object.entries(selectedOptions).every(([k, val]) => v.options[k] === val);
      }) || null;

      if (!targetVariant) {
        showToast("Tổ hợp lựa chọn này không tồn tại trong hệ thống. Quý khách vui lòng chọn lại.");
        syncVariantState();
        return;
      }

      currentStock = Math.max(0, Number(targetVariant.stock) || 0);
      itemDisplayName = `${freshProduct.name} (${targetVariant.name})`;
    } else {
      currentStock = Math.max(0, Number(freshProduct.stock) || 0);
    }

    if (currentStock <= 0) {
      showToast(`Phiên bản "${itemDisplayName}" hiện đã tạm hết hàng. Quý khách vui lòng chọn phiên bản khác.`);
      syncVariantState();
      return;
    }

    const requestedQty = parseInt(qtyInput?.value) || 1;
    if (requestedQty > currentStock) {
      showToast(`Tồn kho vừa cập nhật: "${itemDisplayName}" chỉ còn ${currentStock} chiếc. Đã điều chỉnh số lượng phù hợp.`);
      if (qtyInput) qtyInput.value = currentStock;
      syncVariantState();
      return;
    }

    try {
      if (hasVariants && targetVariant) {
        addToCart(
          freshProduct.id,
          requestedQty,
          targetVariant.id,
          targetVariant.options,
          targetVariant.name,
          pricing.price,
          targetVariant.image || freshProduct.image
        );
        showToast(`Đã thêm ${requestedQty} sản phẩm "${itemDisplayName}" vào giỏ hàng!`);
      } else {
        addToCart(freshProduct.id, requestedQty);
        showToast(`Đã thêm ${requestedQty} sản phẩm "${freshProduct.name}" vào giỏ hàng!`);
      }

      $("#cartCount").textContent = getCartCount();
      window.dispatchEvent(new CustomEvent("ecodesk-cart-updated"));

      if (redirect) {
        setTimeout(() => {
          window.location.href = "./checkout.html";
        }, 250);
      }
    } catch (err) {
      showToast(err.message || "Không thể thêm vào giỏ hàng.");
      syncVariantState();
    }
  };

  $("#addToCartBtn").addEventListener("click", () => handleAddToCart(false));
  $("#buyNowBtn").addEventListener("click", () => handleAddToCart(true));
  $("#mobileAddCartBtn").addEventListener("click", () => handleAddToCart(false));
  $("#mobileBuyNowBtn").addEventListener("click", () => handleAddToCart(true));

  // Add-on quick add to cart
  document.querySelectorAll(".pdp-addon-add-btn[data-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const addonId = btn.getAttribute("data-id");
      const addonName = btn.getAttribute("data-name");
      try {
        addToCart(addonId, 1);
      } catch (err) {
        showToast(err.message || "Không thể thêm phụ kiện vào giỏ hàng.");
        return;
      }
      $("#cartCount").textContent = getCartCount();
      
      const originalHtml = btn.innerHTML;
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
        <span>Đã thêm</span>
      `;
      btn.classList.add("is-added");
      showToast(`Đã thêm "${addonName}" vào giỏ hàng!`);
      window.dispatchEvent(new CustomEvent("ecodesk-cart-updated"));
      setTimeout(() => {
        btn.innerHTML = originalHtml;
        btn.classList.remove("is-added");
      }, 2000);
    });
  });

  // Pick variant from variant comparison table tab
  if (hasVariants) {
    document.querySelectorAll(".pdp-matrix-pick-btn[data-pick-variant-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const varId = btn.getAttribute("data-pick-variant-id");
        const matchedVar = productVariants.find((v) => String(v.id) === String(varId));
        if (!matchedVar) return;
        if (matchedVar.options && typeof matchedVar.options === "object") {
          Object.assign(selectedOptions, matchedVar.options);
        }
        syncVariantState({ skipImageChange: false });
        $("#pdpVariantsContainer")?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  }

  // E. Product Details Tabs
  document.querySelectorAll(".pdp-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".pdp-tab-btn").forEach((b) => {
        b.classList.remove("is-active");
        b.setAttribute("aria-selected", "false");
      });
      document.querySelectorAll(".pdp-tab-panel").forEach((p) => p.classList.remove("is-active"));

      btn.classList.add("is-active");
      btn.setAttribute("aria-selected", "true");
      const targetTab = btn.getAttribute("data-tab");
      const panel = document.getElementById(targetTab);
      if (panel) panel.classList.add("is-active");
    });
  });

  // F. FAQ Accordion
  document.querySelectorAll(".pdp-faq-question").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".pdp-faq-item");
      const isOpen = item.classList.contains("is-open");
      document.querySelectorAll(".pdp-faq-item").forEach((el) => el.classList.remove("is-open"));
      if (!isOpen) item.classList.add("is-open");
    });
  });

  // G. Customer Review & Comment Interactive Controller
  initReviewsSection(product);
}

function renderAdminReplyBlock(reply) {
  if (!reply || !reply.content) return "";
  const timeText = formatReviewDateTime(reply.updatedAt || reply.createdAt);
  const editedTag = reply.updatedAt ? ` <span class="pdp-reply-edited">(đã chỉnh sửa)</span>` : "";
  return `
    <div class="pdp-admin-reply-box">
      <div class="pdp-admin-reply-head">
        <span class="pdp-admin-reply-badge">
          ${renderIcon("shield-check", { size: 13, strokeWidth: 2.2 })}
          EcoDesk phản hồi
        </span>
        <span class="pdp-admin-reply-meta">${escapeHtml(reply.adminName || "Quản trị viên EcoDesk")} · ${escapeHtml(timeText)}${editedTag}</span>
      </div>
      <p class="pdp-admin-reply-text">${escapeHtml(reply.content)}</p>
    </div>
  `;
}

function renderCommentItem(comment, allComments) {
  const parentComment = comment.parentCommentId
    ? allComments.find((c) => String(c.id) === String(comment.parentCommentId))
    : null;
  const roleBadge = comment.authorRole === "admin" || comment.authorRole === "staff"
    ? `<span class="pdp-role-tag is-staff">EcoDesk</span>`
    : (comment.isGuest ? `<span class="pdp-role-tag is-guest">Khách ghé thăm</span>` : "");

  return `
    <div class="pdp-comment-item ${parentComment ? "is-reply" : ""}" data-comment-id="${escapeHtml(comment.id)}">
      <div class="pdp-comment-top">
        <div class="pdp-comment-author-wrap">
          <span class="pdp-comment-avatar">
            ${comment.authorAvatar
              ? `<img src="${escapeHtml(comment.authorAvatar)}" alt="Avatar">`
              : escapeHtml(getInitialChar(comment.authorName))}
          </span>
          <strong class="pdp-comment-author">${escapeHtml(comment.authorName)}</strong>
          ${roleBadge}
          ${parentComment ? `<span class="pdp-reply-to-tag">trả lời @${escapeHtml(parentComment.authorName)}</span>` : ""}
        </div>
        <div class="pdp-comment-actions-meta">
          <span class="pdp-comment-date">${escapeHtml(formatReviewDateTime(comment.createdAt))}</span>
          <button type="button" class="pdp-comment-reply-btn" data-reply-review="${escapeHtml(comment.reviewId)}" data-reply-comment="${escapeHtml(comment.id)}" data-reply-author="${escapeHtml(comment.authorName)}">Trả lời</button>
        </div>
      </div>
      <p class="pdp-comment-body">${escapeHtml(comment.content)}</p>
      ${renderAdminReplyBlock(comment.adminReply)}
    </div>
  `;
}

function renderReviewFormSection(product, currentUser, eligibility) {
  const loginRedirectUrl = buildAuthUrl("./login.html", {
    next: `${window.location.pathname}${window.location.search}#reviewsSection`
  });

  if (!eligibility.canReview) {
    let actionCta = "";
    if (eligibility.reason === "not_logged_in") {
      actionCta = `<a href="${loginRedirectUrl}" class="pdp-eligibility-btn">Đăng nhập để đánh giá</a>`;
    } else if (eligibility.reason === "order_not_completed") {
      actionCta = `<a href="./customer-orders.html" class="pdp-eligibility-btn is-secondary">Theo dõi đơn hàng của tôi</a>`;
    } else if (eligibility.reason === "already_reviewed") {
      actionCta = `<a href="./account.html" class="pdp-eligibility-btn is-secondary">Xem đánh giá trong Tài khoản</a>`;
    }

    return `
      <div class="pdp-review-eligibility-card is-${escapeHtml(eligibility.reason)}">
        <div class="pdp-eligibility-icon">
          ${renderIcon(eligibility.reason === "already_reviewed" ? "check-circle-2" : "lock", { size: 18, strokeWidth: 2 })}
        </div>
        <div class="pdp-eligibility-body">
          <strong>${eligibility.reason === "already_reviewed" ? "Bạn đã hoàn thành đánh giá cho đơn hàng của mình" : "Chưa đủ điều kiện gửi đánh giá sao"}</strong>
          <p>${escapeHtml(eligibility.message)}</p>
          <p class="pdp-eligibility-subnote">Bạn vẫn có thể trao đổi và bình luận bên dưới các đánh giá hiện có mà không cần mua hàng trước.</p>
          ${actionCta ? `<div class="pdp-eligibility-actions">${actionCta}</div>` : ""}
        </div>
      </div>
    `;
  }

  const orderSelectorHtml = eligibility.unreviewedOrders.length > 1
    ? `
      <label class="pdp-order-select-wrap">
        <span>Chọn đơn hàng hoàn tất:</span>
        <select id="reviewOrderSelect" class="pdp-order-select">
          ${eligibility.unreviewedOrders.map((o) => `<option value="${escapeHtml(o.id)}">#${escapeHtml(o.id)} · ${escapeHtml(formatReviewDateTime(o.createdAt))}</option>`).join("")}
        </select>
      </label>
    `
    : `<span class="pdp-verified-order-pill">${renderIcon("check-circle-2", { size: 13, strokeWidth: 2.2 })} Đơn hàng hoàn tất #${escapeHtml(eligibility.eligibleOrder.id)}</span>`;

  return `
    <form class="pdp-add-review-form" id="newReviewForm" novalidate>
      <div class="pdp-form-header-row">
        <h4 class="pdp-form-title">Viết đánh giá của bạn</h4>
        ${orderSelectorHtml}
      </div>
      <div class="pdp-auto-identity-bar">
        <span class="pdp-identity-avatar">
          ${currentUser?.avatar
            ? `<img src="${escapeHtml(currentUser.avatar)}" alt="Avatar">`
            : escapeHtml(getInitialChar(currentUser?.name || currentUser?.email || "K"))}
        </span>
        <div>
          <span class="pdp-identity-label">Đánh giá tự động bằng tài khoản:</span>
          <strong class="pdp-identity-name">${escapeHtml(currentUser?.name || currentUser?.email || "Khách hàng EcoDesk")}</strong>
        </div>
      </div>
      <div class="pdp-rating-select-group">
        <span style="font-size: 0.88rem; font-weight: 700; color: #334155;">Mức độ hài lòng:</span>
        <div id="starPicker" role="radiogroup" aria-label="Chọn số sao">
          ${[1, 2, 3, 4, 5].map((s) => `
            <button type="button" class="pdp-star-input-btn is-active" data-star="${s}" aria-label="${s} sao">★</button>
          `).join("")}
        </div>
        <span id="starRatingLabel" class="pdp-star-text-label">5/5 - Rất hài lòng</span>
      </div>
      <textarea id="reviewTextInput" class="pdp-textarea" maxlength="1000" placeholder="Chia sẻ trải nghiệm thực tế về chất lượng sản phẩm, độ hoàn thiện và dịch vụ giao hàng của EcoDesk (tối thiểu 5 ký tự)..." required></textarea>
      <div class="pdp-textarea-meta">
        <span class="pdp-char-counter" id="reviewCharCounter">0 / 1000</span>
      </div>
      <div class="pdp-form-feedback" id="reviewFormFeedback" role="alert" hidden></div>
      <div class="pdp-form-actions">
        <button type="submit" class="pdp-submit-review-btn" id="submitReviewBtn">Gửi đánh giá</button>
      </div>
    </form>
  `;
}

function renderReviewsBoxInner(product, { successMessage = "" } = {}) {
  const currentUser = getCurrentUser();
  const summary = getProductRatingSummary(product.id);
  const reviews = getProductReviews(product.id);
  const eligibility = getReviewEligibility(product.id, currentUser);
  const loginRedirectUrl = buildAuthUrl("./login.html", {
    next: `${window.location.pathname}${window.location.search}#reviewsSection`
  });

  const commentIdentityNote = currentUser
    ? `Bình luận với tên: <strong>${escapeHtml(currentUser.name || currentUser.email)}</strong>`
    : `Bình luận dưới tên <strong>Khách ghé thăm</strong> · <a href="${loginRedirectUrl}">Đăng nhập</a>`;

  return `
    <h3 class="pdp-section-title">
      ${renderIcon("message-square", { size: 20, strokeWidth: 2 })}
      Đánh giá &amp; Bình luận sản phẩm
    </h3>

    <div class="pdp-rating-overview">
      <div class="pdp-overview-score-col">
        ${summary.count > 0
          ? `
            <div class="pdp-big-score">${summary.average.toFixed(1)}</div>
            <span class="pdp-stars">${renderRatingStars(summary.average)}</span>
            <p class="pdp-score-sub"><strong>${summary.count}</strong> đánh giá · <strong>${product.sold}</strong> đã bán</p>
          `
          : `
            <div class="pdp-big-score pdp-big-score-empty" style="font-size: 1.15rem; font-weight: 800; color: #475569; margin-bottom: 4px;">Chưa có đánh giá</div>
            <p class="pdp-score-sub"><strong>${product.sold}</strong> đã bán</p>
          `
        }
      </div>
      <div class="pdp-rating-bars">
        ${[5, 4, 3, 2, 1].map((star) => {
          const cnt = summary.distribution[star] || 0;
          const pct = summary.count > 0 ? Math.round((cnt / summary.count) * 100) : 0;
          return `
            <div class="pdp-bar-row">
              <span class="pdp-bar-label">${star} ★</span>
              <div class="pdp-bar-track"><div class="pdp-bar-fill" style="width: ${pct}%;"></div></div>
              <span class="pdp-bar-count">${cnt}</span>
            </div>
          `;
        }).join("")}
      </div>
    </div>

    <section class="pdp-review-composer-section" aria-label="Biểu mẫu gửi đánh giá">
      ${renderReviewFormSection(product, currentUser, eligibility)}
      ${successMessage ? `<div class="pdp-form-feedback is-success pdp-review-success-banner" role="status">${escapeHtml(successMessage)}</div>` : ""}
    </section>

    <section class="pdp-reviews-list-section" aria-label="Danh sách đánh giá sản phẩm">
      <div class="pdp-reviews-list" id="reviewsContainer">
      ${
        reviews.length === 0
          ? `
            <div class="pdp-reviews-empty">
              <div class="pdp-reviews-empty-icon">${renderIcon("star", { size: 32, strokeWidth: 1.6 })}</div>
              <h4>Chưa có đánh giá nào cho sản phẩm này</h4>
              <p>Đánh giá đầu tiên từ khách hàng đã nhận hàng thành công sẽ xuất hiện tại đây.</p>
            </div>
          `
          : reviews.map((r) => `
            <article class="pdp-review-card" data-review-id="${escapeHtml(r.id)}">
              <div class="pdp-review-header">
                <div class="pdp-reviewer-meta">
                  <span class="pdp-reviewer-avatar">
                    ${r.authorAvatar
                      ? `<img src="${escapeHtml(r.authorAvatar)}" alt="Avatar">`
                      : escapeHtml(getInitialChar(r.authorName))}
                  </span>
                  <div>
                    <div class="pdp-reviewer-name-row">
                      <span class="pdp-reviewer-name">${escapeHtml(r.authorName)}</span>
                      ${r.verifiedPurchase ? `<span class="pdp-verified-badge">${renderIcon("check-circle-2", { size: 12, strokeWidth: 2.3 })} Đã mua hàng</span>` : ""}
                    </div>
                    <div class="pdp-stars" style="font-size: 0.85rem; margin-top: 2px;">${renderRatingStars(r.rating)}</div>
                  </div>
                </div>
                <span class="pdp-review-date">${escapeHtml(formatReviewDateTime(r.createdAt || r.date))}</span>
              </div>

              <p class="pdp-review-comment">${escapeHtml(r.comment)}</p>

              ${renderAdminReplyBlock(r.adminReply)}

              <div class="pdp-review-comments-wrap">
                <div class="pdp-comments-toolbar">
                  <button type="button" class="pdp-toggle-comments-btn" data-toggle-comment-form="${escapeHtml(r.id)}">
                    ${renderIcon("message-circle", { size: 14, strokeWidth: 2 })}
                    Bình luận (${(r.comments || []).length})
                  </button>
                </div>

                ${
                  (r.comments || []).length > 0
                    ? `<div class="pdp-comments-list">${r.comments.map((c) => renderCommentItem(c, r.comments)).join("")}</div>`
                    : ""
                }

                <form class="pdp-comment-form" data-review-comment-form="${escapeHtml(r.id)}" hidden novalidate>
                  <div class="pdp-comment-identity-hint">${commentIdentityNote}</div>
                  <div class="pdp-comment-reply-target" data-reply-target-banner hidden>
                    <span>Đang trả lời <strong data-reply-target-name></strong></span>
                    <button type="button" class="pdp-clear-reply-target" title="Hủy trả lời">&times;</button>
                  </div>
                  <input type="hidden" name="parentCommentId" value="">
                  <div class="pdp-comment-input-row">
                    <textarea class="pdp-comment-input" name="content" maxlength="600" placeholder="Viết bình luận hoặc câu hỏi về đánh giá này..." required></textarea>
                    <button type="submit" class="pdp-comment-submit-btn">Gửi</button>
                  </div>
                  <div class="pdp-form-feedback" data-comment-feedback role="alert" hidden></div>
                </form>
              </div>
            </article>
          `).join("")
      }
      </div>
    </section>
  `;
}

function updateTopRatingSummary(product) {
  const summary = getProductRatingSummary(product.id);
  const starsEl = document.getElementById("pdpTopRatingStars");
  const scoreEl = document.getElementById("pdpTopRatingScore");
  const countLink = document.getElementById("jumpToReviewsLink");
  if (starsEl) {
    starsEl.hidden = summary.count <= 0;
    starsEl.innerHTML = summary.count > 0 ? renderRatingStars(summary.average) : "";
    starsEl.setAttribute("aria-label", summary.count > 0 ? `${summary.average.toFixed(1)} sao` : "Chưa có đánh giá");
  }
  if (scoreEl) {
    scoreEl.textContent = summary.count > 0 ? `${summary.average.toFixed(1)} / 5` : "Chưa có đánh giá";
  }
  if (countLink) {
    countLink.hidden = summary.count <= 0;
    countLink.textContent = summary.count > 0 ? `(${summary.count} đánh giá)` : "";
  }
}

function initReviewsSection(product) {
  const card = document.getElementById("pdpReviewsCard");
  if (!card) return;

  let isSubmittingReview = false;
  let selectedStar = 5;

  const starTextMap = {
    1: "1/5 - Rất không hài lòng",
    2: "2/5 - Không hài lòng",
    3: "3/5 - Bình thường",
    4: "4/5 - Hài lòng",
    5: "5/5 - Rất hài lòng"
  };

  function bindCardInteractions() {
    initIcons(card);

    // Star Picker
    card.querySelectorAll(".pdp-star-input-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedStar = parseInt(btn.getAttribute("data-star"), 10) || 5;
        card.querySelectorAll(".pdp-star-input-btn").forEach((b) => {
          const s = parseInt(b.getAttribute("data-star"), 10) || 5;
          b.classList.toggle("is-active", s <= selectedStar);
        });
        const labelEl = card.querySelector("#starRatingLabel");
        if (labelEl) labelEl.textContent = starTextMap[selectedStar] || "";
      });
    });

    // Review textarea counter
    const reviewTextarea = card.querySelector("#reviewTextInput");
    const reviewCounter = card.querySelector("#reviewCharCounter");
    if (reviewTextarea && reviewCounter) {
      reviewTextarea.addEventListener("input", () => {
        reviewCounter.textContent = `${reviewTextarea.value.length} / 1000`;
      });
    }

    // Submit Review Form
    const reviewForm = card.querySelector("#newReviewForm");
    if (reviewForm) {
      reviewForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (isSubmittingReview) return;

        const feedbackEl = card.querySelector("#reviewFormFeedback");
        const submitBtn = card.querySelector("#submitReviewBtn");
        const orderSelect = card.querySelector("#reviewOrderSelect");
        const text = reviewTextarea ? reviewTextarea.value.trim() : "";

        const setFeedback = (msg, type = "error") => {
          if (!feedbackEl) return;
          feedbackEl.textContent = msg;
          feedbackEl.className = `pdp-form-feedback is-${type}`;
          feedbackEl.hidden = !msg;
        };

        setFeedback("");
        isSubmittingReview = true;
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "Đang gửi đánh giá...";
        }

        try {
          await submitProductReview({
            productId: product.id,
            rating: selectedStar,
            comment: text,
            orderId: orderSelect ? orderSelect.value : null
          });
          selectedStar = 5;
          rerenderReviewsBox(null, "Cảm ơn bạn! Đánh giá của bạn đã được đăng thành công.");
          showToast("Cảm ơn bạn! Đánh giá của bạn đã được đăng thành công.");
        } catch (err) {
          setFeedback(err.message || "Không thể gửi đánh giá lúc này.", "error");
        } finally {
          isSubmittingReview = false;
          if (submitBtn && submitBtn.isConnected) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Gửi đánh giá";
          }
        }
      });
    }

    // Toggle comment form per review
    card.querySelectorAll("[data-toggle-comment-form]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const revId = btn.getAttribute("data-toggle-comment-form");
        const form = card.querySelector(`[data-review-comment-form="${revId}"]`);
        if (!form) return;
        form.hidden = !form.hidden;
        if (!form.hidden) {
          form.querySelector("textarea")?.focus();
        }
      });
    });

    // Reply to a specific comment
    card.querySelectorAll(".pdp-comment-reply-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const revId = btn.getAttribute("data-reply-review");
        const cmtId = btn.getAttribute("data-reply-comment");
        const author = btn.getAttribute("data-reply-author");
        const form = card.querySelector(`[data-review-comment-form="${revId}"]`);
        if (!form) return;
        form.hidden = false;
        const hiddenParent = form.querySelector('input[name="parentCommentId"]');
        const banner = form.querySelector("[data-reply-target-banner]");
        const nameSpan = form.querySelector("[data-reply-target-name]");
        if (hiddenParent) hiddenParent.value = cmtId || "";
        if (nameSpan) nameSpan.textContent = author || "bình luận";
        if (banner) banner.hidden = false;
        form.querySelector("textarea")?.focus();
      });
    });

    // Clear reply target
    card.querySelectorAll(".pdp-clear-reply-target").forEach((btn) => {
      btn.addEventListener("click", () => {
        const form = btn.closest("[data-review-comment-form]");
        if (!form) return;
        const hiddenParent = form.querySelector('input[name="parentCommentId"]');
        const banner = form.querySelector("[data-reply-target-banner]");
        if (hiddenParent) hiddenParent.value = "";
        if (banner) banner.hidden = true;
      });
    });

    // Submit comment form per review
    card.querySelectorAll("[data-review-comment-form]").forEach((form) => {
      let isSubmittingComment = false;
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (isSubmittingComment) return;

        const reviewId = form.getAttribute("data-review-comment-form");
        const textarea = form.querySelector('textarea[name="content"]');
        const parentInput = form.querySelector('input[name="parentCommentId"]');
        const submitBtn = form.querySelector('button[type="submit"]');
        const feedbackEl = form.querySelector("[data-comment-feedback]");

        const setFeedback = (msg, type = "error") => {
          if (!feedbackEl) return;
          feedbackEl.textContent = msg;
          feedbackEl.className = `pdp-form-feedback is-${type}`;
          feedbackEl.hidden = !msg;
        };

        setFeedback("");
        isSubmittingComment = true;
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "Đang gửi...";
        }

        try {
          await submitReviewComment({
            productId: product.id,
            reviewId,
            content: textarea ? textarea.value : "",
            parentCommentId: parentInput && parentInput.value ? parentInput.value : null
          });
          rerenderReviewsBox(reviewId);
          showToast("Bình luận của bạn đã được hiển thị.");
        } catch (err) {
          setFeedback(err.message || "Không thể gửi bình luận.", "error");
        } finally {
          isSubmittingComment = false;
          if (submitBtn && submitBtn.isConnected) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Gửi";
          }
        }
      });
    });
  }

  function rerenderReviewsBox(openCommentReviewId = null, successMessage = "") {
    card.innerHTML = renderReviewsBoxInner(product, { successMessage });
    updateTopRatingSummary(product);
    bindCardInteractions();
    if (openCommentReviewId) {
      const form = card.querySelector(`[data-review-comment-form="${openCommentReviewId}"]`);
      if (form) form.hidden = false;
    }
  }

  bindCardInteractions();

  if (!window.__ecodeskDetailReviewSyncBound) {
    window.__ecodeskDetailReviewSyncBound = true;
    window.addEventListener("storage", (e) => {
      if (e.key === REVIEWS_STORAGE_KEY || e.key === "ecodesk_orders" || e.key === "ecodesk_current_user") {
        rerenderReviewsBox();
      }
    });
    window.addEventListener(REVIEWS_EVENT, () => {
      updateTopRatingSummary(product);
    });
  }
}

async function start() {
  try {
    await initStore();
    try {
      await syncReviewsFromDisk();
    } catch {}
    const id = getParam("id") || "P002"; // Fallback to P002 (Bàn nâng hạ SmartDesk Lite) if no ID
    const product = findProduct(id);
    const cartEl = $("#cartCount");
    if (cartEl) cartEl.textContent = getCartCount();

    if (!product) {
      const root = $("#detailRoot");
      if (root) {
        root.innerHTML = `
          <div class="empty" style="text-align: center; padding: 60px 20px;">
            <h2 style="font-size: 1.4rem; color: #1e293b; margin-bottom: 8px;">Không tìm thấy sản phẩm</h2>
            <p style="color: #64748b; margin-bottom: 20px;">Sản phẩm bạn đang tìm kiếm (mã: <strong>${escapeHtml(id)}</strong>) không tồn tại hoặc đã ngừng kinh doanh.</p>
            <a class="btn" href="./products.html">Xem tất cả sản phẩm EcoDesk</a>
          </div>
        `;
      }
      return;
    }

    // Update page title dynamically
    document.title = `${product.name || "Sản phẩm"} - EcoDesk`;

    renderDetail(product, getCategories());
    requestAnimationFrame(() => revealOnScroll());
  } catch (err) {
    console.error("Lỗi khi dựng trang chi tiết sản phẩm:", err);
    const root = $("#detailRoot");
    if (root) {
      root.innerHTML = `
        <div class="empty" style="text-align: center; padding: 60px 20px;">
          <h2 style="font-size: 1.4rem; color: #dc2626; margin-bottom: 8px;">Đã xảy ra lỗi khi tải dữ liệu</h2>
          <p style="color: #64748b; margin-bottom: 20px;">Hệ thống đang đồng bộ kho hàng. Quý khách vui lòng bấm nút bên dưới để tải lại hoặc xem danh mục sản phẩm.</p>
          <div style="display: flex; gap: 12px; justify-content: center;">
            <button class="btn" onclick="window.location.reload()">Tải lại trang</button>
            <a class="btn btn-outline" href="./products.html">Danh mục sản phẩm</a>
          </div>
        </div>
      `;
    }
  }
}

start();
