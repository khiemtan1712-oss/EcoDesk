/**
 * EcoDesk Role-Based Access Control (RBAC) & Granular Staff Permissions
 * Tách biệt vai trò (role) khỏi quyền thao tác chi tiết (permissions)
 */

export const PERMISSIONS = {
  // 1. Quản lý Đơn hàng
  ORDERS_VIEW: "orders:view",
  ORDERS_UPDATE_STATUS: "orders:update_status",
  ORDERS_EDIT_INFO: "orders:edit_info",

  // 2. Quản lý Sản phẩm & Tồn kho
  PRODUCTS_MANAGE: "products:manage",
  PRODUCTS_PRICE_STOCK: "products:price_stock",
  CATEGORIES_MANAGE: "categories:manage",

  // 3. Quản lý Người dùng & Nhân sự
  USERS_VIEW: "users:view",
  USERS_MANAGE_ROLES: "users:manage_roles",

  // 4. Khuyến mãi & Bán hàng
  PROMOTIONS_MANAGE: "promotions:manage",

  // 5. Báo cáo & Xuất dữ liệu
  REPORTS_VIEW: "reports:view",
  DATA_EXPORT: "data:export",

  // 6. Tài chính & Thu ngân
  FINANCE_VIEW: "finance:view",
  FINANCE_RECORD_EXPENSE: "finance:record_expense",
  FINANCE_PAYROLL_VIEW: "finance:payroll_view",
  FINANCE_RECONCILE: "finance:reconcile",

  // 7. Quản lý Nhập hàng & Biến động kho
  INVENTORY_PURCHASE_VIEW: "inventory:purchase_view",
  INVENTORY_PURCHASE_CREATE: "inventory:purchase_create",
  INVENTORY_PURCHASE_RECEIVE: "inventory:purchase_receive",
  INVENTORY_PURCHASE_PAY: "inventory:purchase_pay",
  INVENTORY_ADJUST: "inventory:adjust",

  // 8. Chăm sóc khách hàng & Đánh giá
  CHAT_SUPPORT: "chat:support",
  REVIEWS_MANAGE: "reviews:manage"
};

export const PERMISSION_GROUPS = [
  {
    groupName: "Đơn hàng",
    icon: "package",
    permissions: [
      { key: PERMISSIONS.ORDERS_VIEW, label: "Xem danh sách và chi tiết đơn hàng", description: "Cho phép xem danh sách đơn và thông tin khách hàng" },
      { key: PERMISSIONS.ORDERS_UPDATE_STATUS, label: "Cập nhật tiến trình & trạng thái đơn", description: "Xác nhận đơn, chuyển trạng thái giao hàng, hoàn tất hoặc hủy đơn" },
      { key: PERMISSIONS.ORDERS_EDIT_INFO, label: "Chỉnh sửa thông tin giao nhận", description: "Thay đổi tên, số điện thoại, địa chỉ nhận hàng và ghi chú theo yêu cầu khách" }
    ]
  },
  {
    groupName: "Sản phẩm & Danh mục",
    icon: "armchair",
    permissions: [
      { key: PERMISSIONS.PRODUCTS_MANAGE, label: "Quản lý sản phẩm (Thêm/Sửa/Xóa)", description: "Tạo sản phẩm mới, chỉnh sửa thông tin mô tả, ảnh gallery và xóa sản phẩm" },
      { key: PERMISSIONS.PRODUCTS_PRICE_STOCK, label: "Điều chỉnh giá bán & tồn kho", description: "Cập nhật giá niêm yết, thiết lập giảm giá và điều chỉnh số lượng tồn" },
      { key: PERMISSIONS.CATEGORIES_MANAGE, label: "Quản lý danh mục sản phẩm", description: "Thêm mới, sửa tên hoặc xóa các nhóm danh mục nội thất" }
    ]
  },
  {
    groupName: "Tài khoản & Phân quyền",
    icon: "users",
    permissions: [
      { key: PERMISSIONS.USERS_VIEW, label: "Xem danh sách tài khoản", description: "Xem thông tin khách hàng và danh sách nhân viên" },
      { key: PERMISSIONS.USERS_MANAGE_ROLES, label: "Phân quyền & đổi vai trò nhân sự", description: "Cấp hoặc thu hồi quyền thao tác chi tiết cho nhân viên (Quyền nhạy cảm)" }
    ]
  },
  {
    groupName: "Khuyến mãi & Marketing",
    icon: "ticket",
    permissions: [
      { key: PERMISSIONS.PROMOTIONS_MANAGE, label: "Quản lý mã ưu đãi & banner", description: "Tạo mã giảm giá, thiết lập chiến dịch Flash Sale và đổi banner quảng bá" }
    ]
  },
  {
    groupName: "Báo cáo & Dữ liệu",
    icon: "line-chart",
    permissions: [
      { key: PERMISSIONS.REPORTS_VIEW, label: "Xem báo cáo doanh thu & biểu đồ", description: "Truy cập số liệu kinh doanh, tỷ lệ hoàn tất đơn và thống kê doanh thu" },
      { key: PERMISSIONS.DATA_EXPORT, label: "Xuất dữ liệu Excel & PDF", description: "Tải file báo cáo kinh doanh, danh sách đơn hàng ra file Excel hoặc PDF trực tiếp" }
    ]
  },
  {
    groupName: "Tài chính & Thu ngân",
    icon: "wallet",
    permissions: [
      { key: PERMISSIONS.FINANCE_VIEW, label: "Xem báo cáo thu chi & giao dịch", description: "Xem tiền đã thu, chờ thu, hoàn tiền, nhập hàng và dòng tiền ròng" },
      { key: PERMISSIONS.FINANCE_RECORD_EXPENSE, label: "Ghi nhận chi phí vận hành & nhập hàng", description: "Thêm khoản chi vận hành, phiếu nhập kho và chi phí phát sinh" },
      { key: PERMISSIONS.FINANCE_RECONCILE, label: "Đối soát giao dịch tài chính", description: "Đánh dấu đối soát giao dịch SePay và sổ thu chi (không cho sửa/xóa sau đối soát)" },
      { key: PERMISSIONS.FINANCE_PAYROLL_VIEW, label: "Xem & chi lương nhân viên (Nhạy cảm)", description: "Truy cập bảng lương theo nhân viên, kỳ lương và xác nhận chi lương" },
      { key: PERMISSIONS.INVENTORY_PURCHASE_PAY, label: "Thanh toán công nợ phiếu nhập kho", description: "Ghi nhận tiền thực trả cho nhà cung cấp theo từng đợt" }
    ]
  },
  {
    groupName: "Quản lý Kho & Nhập hàng",
    icon: "truck",
    permissions: [
      { key: PERMISSIONS.INVENTORY_PURCHASE_VIEW, label: "Xem phiếu nhập kho & sổ biến động", description: "Theo dõi tình trạng phiếu nhập, lịch sử tăng giảm kho" },
      { key: PERMISSIONS.INVENTORY_PURCHASE_CREATE, label: "Lập phiếu nhập kho", description: "Tạo phiếu nhập hàng từ nhà cung cấp hoặc lưu nháp" },
      { key: PERMISSIONS.INVENTORY_PURCHASE_RECEIVE, label: "Xác nhận nhận hàng vào kho", description: "Duyệt thực nhận hàng, tự động cộng tồn kho và tính giá nhập bình quân" },
      { key: PERMISSIONS.INVENTORY_ADJUST, label: "Điều chỉnh tồn kho kiểm kê", description: "Ghi nhận lệch kiểm kê, hàng hỏng, hàng tặng (không sinh chi phí mua hàng)" }
    ]
  },
  {
    groupName: "Chăm sóc khách hàng",
    icon: "message-circle",
    permissions: [
      { key: PERMISSIONS.CHAT_SUPPORT, label: "Hỗ trợ khách hàng qua Chat", description: "Trực tuyến nhận tin nhắn, tư vấn sản phẩm và giải đáp khiếu nại đơn hàng" },
      { key: PERMISSIONS.REVIEWS_MANAGE, label: "Quản lý đánh giá, bình luận & phản hồi", description: "Phản hồi chính thức dưới tên EcoDesk và xử lý đánh giá hoặc bình luận vi phạm" }
    ]
  }
];

export const PERMISSION_LABELS = PERMISSION_GROUPS.reduce((acc, g) => {
  g.permissions.forEach((p) => {
    acc[p.key] = p.label;
  });
  return acc;
}, {});

// Mặc định nhân viên mới chỉ có quyền cơ bản, không có các quyền nhạy cảm
export const DEFAULT_STAFF_PERMISSIONS = [
  PERMISSIONS.ORDERS_VIEW,
  PERMISSIONS.CHAT_SUPPORT,
  PERMISSIONS.INVENTORY_PURCHASE_VIEW
];

// Mặc định Thu ngân: Xem đơn hàng, Xem báo cáo tài chính, Ghi nhận chi phí, Đối soát tài chính
export const DEFAULT_CASHIER_PERMISSIONS = [
  PERMISSIONS.ORDERS_VIEW,
  PERMISSIONS.FINANCE_VIEW,
  PERMISSIONS.FINANCE_RECORD_EXPENSE,
  PERMISSIONS.FINANCE_RECONCILE
];

// Các quyền tuyệt đối không cấp cho Thu ngân (trừ FINANCE_VIEW, FINANCE_RECORD_EXPENSE, FINANCE_RECONCILE)
export const CASHIER_FORBIDDEN_PERMISSIONS = new Set([
  PERMISSIONS.USERS_VIEW,
  PERMISSIONS.USERS_MANAGE_ROLES,
  PERMISSIONS.PRODUCTS_MANAGE,
  PERMISSIONS.PRODUCTS_PRICE_STOCK,
  PERMISSIONS.CATEGORIES_MANAGE,
  PERMISSIONS.PROMOTIONS_MANAGE,
  PERMISSIONS.ORDERS_UPDATE_STATUS,
  PERMISSIONS.ORDERS_EDIT_INFO,
  PERMISSIONS.INVENTORY_PURCHASE_RECEIVE,
  PERMISSIONS.INVENTORY_ADJUST,
  PERMISSIONS.FINANCE_PAYROLL_VIEW,
  PERMISSIONS.REPORTS_VIEW
]);

/**
 * Kiểm tra xem người dùng có quyền cụ thể hay không
 * Sử dụng chung logic hợp nhất từ getUserEffectivePermissions
 * @param {Object} user 
 * @param {string} permissionKey 
 * @returns {boolean}
 */
export function hasPermission(user, permissionKey) {
  if (!user || user.active === false) return false;
  const effective = getUserEffectivePermissions(user);
  return effective.includes(permissionKey);
}

/**
 * Lấy toàn bộ danh sách quyền hiệu lực của người dùng
 * Quy tắc:
 * - Admin: Toàn bộ 22 quyền
 * - Staff: Kế thừa quyền mặc định (DEFAULT_STAFF_PERMISSIONS) + quyền được cấp riêng (user.permissions), loại bỏ trùng lặp và chỉ giữ quyền hợp lệ
 * - Cashier: Kế thừa quyền mặc định (DEFAULT_CASHIER_PERMISSIONS) + quyền được cấp riêng (user.permissions), loại bỏ trùng lặp, trừ đi CASHIER_FORBIDDEN_PERMISSIONS
 * - Customer / khác: Không có quyền
 * @param {Object} user 
 * @returns {string[]}
 */
export function getUserEffectivePermissions(user) {
  if (!user || user.active === false) return [];
  const validKeys = new Set(Object.values(PERMISSIONS));

  if (user.role === "admin") {
    return Array.from(validKeys);
  }

  if (user.role === "cashier") {
    const customPerms = Array.isArray(user.permissions) ? user.permissions : [];
    const combined = new Set([...DEFAULT_CASHIER_PERMISSIONS, ...customPerms]);
    return Array.from(combined).filter(
      (p) => validKeys.has(p) && !CASHIER_FORBIDDEN_PERMISSIONS.has(p)
    );
  }

  if (user.role === "staff") {
    const customPerms = Array.isArray(user.permissions) ? user.permissions : [];
    const combined = new Set([...DEFAULT_STAFF_PERMISSIONS, ...customPerms]);
    return Array.from(combined).filter((p) => validKeys.has(p));
  }

  return [];
}

/**
 * Ném lỗi nếu người dùng không đủ quyền thực hiện hành động
 * @param {Object} user 
 * @param {string} permissionKey 
 * @param {string} actionDescription 
 */
export function checkPermissionOrThrow(user, permissionKey, actionDescription = "") {
  if (!hasPermission(user, permissionKey)) {
    const label = PERMISSION_LABELS[permissionKey] || permissionKey;
    const desc = actionDescription ? ` để "${actionDescription}"` : "";
    throw new Error(`Từ chối truy cập: Tài khoản nhân viên của bạn chưa được cấp quyền "${label}"${desc}. Vui lòng liên hệ Quản trị viên.`);
  }
}

/**
 * Kiểm tra an toàn: Không cho phép hạ quyền hoặc xóa Admin cuối cùng
 * @param {string} targetUserId 
 * @param {Array} allUsers 
 * @returns {boolean} true nếu là admin duy nhất còn lại
 */
export function isLastAdmin(targetUserId, allUsers = []) {
  const admins = allUsers.filter((u) => u.role === "admin");
  return admins.length === 1 && String(admins[0].id) === String(targetUserId);
}

