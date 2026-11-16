import {
  getOrders,
  getUsers,
  getCurrentUser,
  getProducts,
  saveProducts,
  addAuditLog,
  isOrderCompletedForSales,
  isVerifiedPurchaseReviewRecord
} from "./storage.js";
import { hasPermission, PERMISSIONS } from "./permissions.js";

export const REVIEWS_STORAGE_KEY = "ecodesk_customer_reviews";
export const REVIEWS_EVENT = "ecodesk_reviews_updated";

const MIN_REVIEW_LENGTH = 5;
const MAX_REVIEW_LENGTH = 1000;
const MIN_COMMENT_LENGTH = 2;
const MAX_COMMENT_LENGTH = 600;
const MIN_REPLY_LENGTH = 2;
const MAX_REPLY_LENGTH = 1000;

export function isOrderCompletedStatus(status) {
  return isOrderCompletedForSales(status);
}

export function isOrderCancelledStatus(status) {
  if (!status) return false;
  return String(status).trim().toLowerCase() === "đã hủy";
}

export function parseOrderItems(order) {
  if (!order) return [];
  if (Array.isArray(order.items)) return order.items;
  if (order.itemsJson) {
    try {
      const parsed = JSON.parse(order.itemsJson);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
}

export function orderContainsProduct(order, productId) {
  if (!order || !productId) return false;
  const targetId = String(productId).trim().toLowerCase();
  return parseOrderItems(order).some((item) => {
    const pid = String(item.productId || "").trim().toLowerCase();
    const id = String(item.id || "").trim().toLowerCase();
    const vid = String(item.variantId || "").trim().toLowerCase();
    const sku = String(item.variantSku || "").trim().toLowerCase();
    if (pid === targetId || id === targetId) return true;
    if (id.startsWith(targetId + "-") || id.startsWith(targetId + "_")) return true;
    if (vid.startsWith(targetId + "-") || vid.startsWith(targetId + "_")) return true;
    return false;
  });
}

export function orderBelongsToUser(order, user) {
  if (!order || !user) return false;
  const userId = String(user.id || "").trim();
  if (order.userId && userId) {
    if (String(order.userId).trim().toLowerCase() === userId.toLowerCase()) return true;
  }
  const userEmail = String(user.email || "").trim().toLowerCase();
  const orderEmail = String(order.customerEmail || "").trim().toLowerCase();
  return Boolean(userEmail && orderEmail && userEmail === orderEmail);
}

function normalizeAdminReply(reply) {
  if (!reply || typeof reply !== "object" || !reply.content) return null;
  return {
    id: reply.id || `RPL_${Date.now()}`,
    targetType: reply.targetType || "review",
    targetId: reply.targetId ? String(reply.targetId) : null,
    adminId: reply.adminId ? String(reply.adminId) : null,
    adminName: String(reply.adminName || "Quản trị viên EcoDesk"),
    adminRole: reply.adminRole || "admin",
    content: String(reply.content || "").trim(),
    createdAt: reply.createdAt || new Date().toISOString(),
    updatedAt: reply.updatedAt || null
  };
}

function normalizeComment(comment, productId, reviewId, idx = 0) {
  if (!comment || typeof comment !== "object") return null;
  const content = String(comment.content || comment.text || "").trim();
  if (!content) return null;
  const userId = comment.userId ? String(comment.userId) : null;
  return {
    id: String(comment.id || `CMT_LEGACY_${reviewId}_${idx}`),
    reviewId: String(comment.reviewId || reviewId),
    productId: String(comment.productId || productId),
    parentCommentId: comment.parentCommentId ? String(comment.parentCommentId) : null,
    userId,
    authorName: String(comment.authorName || comment.name || (userId ? "Khách hàng EcoDesk" : "Khách ghé thăm")),
    authorRole: comment.authorRole || (userId ? "customer" : "guest"),
    isGuest: Boolean(comment.isGuest ?? !userId),
    content,
    createdAt: comment.createdAt || (comment.date ? `${comment.date}T00:00:00.000Z` : new Date().toISOString()),
    updatedAt: comment.updatedAt || null,
    isDeleted: Boolean(comment.isDeleted),
    deletedAt: comment.deletedAt || null,
    deletedBy: comment.deletedBy || null,
    deletedReason: comment.deletedReason || null,
    adminReply: normalizeAdminReply(comment.adminReply)
  };
}

function normalizeReview(review, productId, idx = 0) {
  if (!review || typeof review !== "object") return null;
  const commentText = String(review.comment || review.content || "").trim();
  if (!commentText) return null;
  const id = String(review.id || `REV_LEGACY_${productId}_${idx}`);
  const ratingNum = Number(review.rating);
  const rating = Number.isFinite(ratingNum) ? Math.max(1, Math.min(5, Math.round(ratingNum))) : 5;
  const userId = review.userId ? String(review.userId) : null;
  const createdAt = review.createdAt || (review.date ? `${review.date}T09:00:00.000Z` : new Date().toISOString());
  const dateStr = review.date || String(createdAt).slice(0, 10);

  const rawComments = Array.isArray(review.comments) ? review.comments : [];
  const normalizedComments = rawComments
    .map((c, cIdx) => normalizeComment(c, productId, id, cIdx))
    .filter(Boolean);

  return {
    id,
    productId: String(review.productId || productId),
    orderId: review.orderId ? String(review.orderId) : null,
    userId,
    authorName: String(review.authorName || review.name || "Khách hàng EcoDesk"),
    rating,
    comment: commentText,
    date: dateStr,
    createdAt,
    updatedAt: review.updatedAt || null,
    isDeleted: Boolean(review.isDeleted),
    deletedAt: review.deletedAt || null,
    deletedBy: review.deletedBy || null,
    deletedReason: review.deletedReason || null,
    adminReply: normalizeAdminReply(review.adminReply),
    comments: normalizedComments
  };
}

export function getRawReviewsMap() {
  try {
    const parsed = JSON.parse(localStorage.getItem(REVIEWS_STORAGE_KEY) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const normalizedMap = {};
    for (const [prodId, list] of Object.entries(parsed)) {
      if (!Array.isArray(list)) continue;
      normalizedMap[String(prodId)] = list
        .map((r, idx) => normalizeReview(r, prodId, idx))
        .filter(Boolean);
    }
    return normalizedMap;
  } catch {
    return {};
  }
}

export function syncStoredProductRatings(reviewsMap = getRawReviewsMap()) {
  try {
    const products = getProducts();
    if (!Array.isArray(products) || products.length === 0) return;
    const orders = getOrders();
    let changed = false;
    const updated = products.map((p) => {
      const list = (reviewsMap[String(p.id)] || []).filter(
        (r) => !r.isDeleted && isVerifiedPurchaseReview({ ...r, productId: r.productId || p.id }, orders)
      );
      const count = list.length;
      const avg = count > 0
        ? Number((list.reduce((sum, r) => sum + Number(r.rating || 0), 0) / count).toFixed(1))
        : 0;
      if (Number(p.rating) !== avg || Number(p.reviewCount || 0) !== count) {
        changed = true;
        return { ...p, rating: avg, reviewCount: count };
      }
      return p;
    });
    if (changed) {
      saveProducts(updated);
    }
  } catch {}
}

export async function saveAllReviewsMap(map, { syncProducts = true, emit = true } = {}) {
  try {
    localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(map || {}));
    if (syncProducts) {
      syncStoredProductRatings(map);
    }
    if (emit && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(REVIEWS_EVENT, { detail: { map } }));
    }
    await fetch("/api-reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(map || {})
    }).catch(() => {});
  } catch {}
}

function mergeComments(localComments = [], diskComments = []) {
  const byId = new Map();
  [...diskComments, ...localComments].forEach((c) => {
    if (!c || !c.id) return;
    const existing = byId.get(String(c.id));
    if (!existing) {
      byId.set(String(c.id), c);
      return;
    }
    const existingTs = new Date(existing.deletedAt || existing.updatedAt || existing.adminReply?.updatedAt || existing.adminReply?.createdAt || existing.createdAt || 0).getTime();
    const candidateTs = new Date(c.deletedAt || c.updatedAt || c.adminReply?.updatedAt || c.adminReply?.createdAt || c.createdAt || 0).getTime();
    if (candidateTs >= existingTs) {
      byId.set(String(c.id), c);
    }
  });
  return Array.from(byId.values()).sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
}

export async function syncReviewsFromDisk() {
  const localMap = getRawReviewsMap();
  try {
    // 1. Ưu tiên đồng bộ từ Backend API MySQL (/api/reviews)
    const res = await fetch("/api/reviews");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        const backendMap = {};
        for (const r of data) {
          if (!r || r.isDeleted) continue;
          const pid = String(r.productId || "");
          if (!pid) continue;
          if (!backendMap[pid]) backendMap[pid] = [];

          let adminReply = null;
          if (r.adminReply && typeof r.adminReply === "object") {
            adminReply = normalizeAdminReply(r.adminReply);
          } else if (r.adminReplyJson) {
            try {
              adminReply = normalizeAdminReply(JSON.parse(r.adminReplyJson));
            } catch {}
          }

          let comments = [];
          if (Array.isArray(r.comments)) {
            comments = r.comments.map((c, i) => normalizeComment(c, pid, r.id, i)).filter(Boolean);
          } else if (r.commentsJson) {
            try {
              const parsed = JSON.parse(r.commentsJson);
              if (Array.isArray(parsed)) {
                comments = parsed.map((c, i) => normalizeComment(c, pid, r.id, i)).filter(Boolean);
              }
            } catch {}
          }

          backendMap[pid].push({
            id: r.id,
            productId: pid,
            orderId: r.orderId || null,
            userId: r.userId || null,
            userEmail: r.userEmail || null,
            authorName: r.authorName || "Khách hàng EcoDesk",
            authorAvatar: r.authorAvatar || null,
            rating: Number(r.rating) || 5,
            comment: r.comment || "",
            verifiedPurchase: Boolean(r.verifiedPurchase),
            date: (r.createdAt || "").slice(0, 10),
            createdAt: r.createdAt || new Date().toISOString(),
            updatedAt: r.updatedAt || null,
            isDeleted: Boolean(r.isDeleted),
            adminReply,
            comments
          });
        }

        if (data.length > 0) {
          localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(backendMap));
          syncStoredProductRatings(backendMap);
          return backendMap;
        } else if (Object.keys(localMap).length > 0) {
          // Tự động đẩy localMap lên backend nếu backend mới khởi tạo chưa có đánh giá
          await fetch("/api/reviews/batch-sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(localMap)
          }).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.warn("Lỗi đồng bộ reviews từ backend:", err);
  }

  // 2. Dự phòng file tĩnh reviews.json nếu backend chưa phản hồi
  try {
    const res = await fetch("/api-reviews");
    if (res.ok) {
      const diskRaw = await res.json();
      if (diskRaw && typeof diskRaw === "object" && !Array.isArray(diskRaw)) {
        const productIds = new Set([...Object.keys(localMap), ...Object.keys(diskRaw)]);
        const mergedMap = {};
        for (const pid of productIds) {
          const localList = localMap[pid] || [];
          const diskList = Array.isArray(diskRaw[pid])
            ? diskRaw[pid].map((r, idx) => normalizeReview(r, pid, idx)).filter(Boolean)
            : [];

          const byId = new Map();
          diskList.forEach((r) => byId.set(String(r.id), r));
          localList.forEach((lr) => {
            const dr = byId.get(String(lr.id));
            if (!dr) {
              byId.set(String(lr.id), lr);
              return;
            }
            const drTs = new Date(dr.deletedAt || dr.updatedAt || dr.adminReply?.updatedAt || dr.adminReply?.createdAt || dr.createdAt || 0).getTime();
            const lrTs = new Date(lr.deletedAt || lr.updatedAt || lr.adminReply?.updatedAt || lr.adminReply?.createdAt || lr.createdAt || 0).getTime();
            const winner = lrTs >= drTs ? lr : dr;
            byId.set(String(lr.id), {
              ...winner,
              comments: mergeComments(lr.comments, dr.comments)
            });
          });

          mergedMap[pid] = Array.from(byId.values()).sort(
            (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
          );
        }
        localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(mergedMap));
        syncStoredProductRatings(mergedMap);
        return mergedMap;
      }
    }
  } catch {}

  syncStoredProductRatings(localMap);
  return localMap;
}

export function isVerifiedPurchaseReview(review, orders = getOrders()) {
  return isVerifiedPurchaseReviewRecord(review, orders);
}

function enrichReviewForDisplay(review, usersMap, orders) {
  const userRec = review.userId ? usersMap.get(String(review.userId)) : null;
  const authorName = userRec?.name || review.authorName || "Khách hàng EcoDesk";
  const authorAvatar = userRec?.avatar || null;
  const verifiedPurchase = isVerifiedPurchaseReview(review, orders);

  const visibleComments = (review.comments || [])
    .filter((c) => !c.isDeleted)
    .map((c) => {
      const cUser = c.userId ? usersMap.get(String(c.userId)) : null;
      return {
        ...c,
        authorName: cUser?.name || (c.userId ? c.authorName : "Khách ghé thăm"),
        authorAvatar: cUser?.avatar || null,
        authorRole: cUser?.role || c.authorRole || (c.userId ? "customer" : "guest")
      };
    })
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

  return {
    ...review,
    authorName,
    authorAvatar,
    verifiedPurchase,
    needsAdminReview: !verifiedPurchase,
    verificationStatus: verifiedPurchase ? "verified" : "unverified_legacy",
    comments: visibleComments
  };
}

export function getProductReviews(productId, { includeUnverified = false } = {}) {
  if (!productId) return [];
  const map = getRawReviewsMap();
  const rawList = map[String(productId)] || [];
  const users = getUsers();
  const usersMap = new Map(users.map((u) => [String(u.id), u]));
  const orders = getOrders();

  return rawList
    .filter((r) => !r.isDeleted)
    .map((r) => enrichReviewForDisplay(r, usersMap, orders))
    .filter((r) => includeUnverified || r.verifiedPurchase === true)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

export function getAllReviewsList() {
  const map = getRawReviewsMap();
  const users = getUsers();
  const usersMap = new Map(users.map((u) => [String(u.id), u]));
  const orders = getOrders();
  const list = [];

  for (const [productId, reviews] of Object.entries(map)) {
    for (const r of reviews) {
      if (r.isDeleted) continue;
      list.push(enrichReviewForDisplay({ ...r, productId }, usersMap, orders));
    }
  }

  return list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

export function getProductRatingSummary(productId) {
  const reviews = getProductReviews(productId);
  const count = reviews.length;
  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let sum = 0;
  let totalComments = 0;

  reviews.forEach((r) => {
    const star = Math.max(1, Math.min(5, Math.round(Number(r.rating) || 0)));
    sum += star;
    distribution[star] = (distribution[star] || 0) + 1;
    totalComments += (r.comments || []).length;
  });

  return {
    average: count > 0 ? Number((sum / count).toFixed(1)) : 0,
    count,
    totalComments,
    distribution
  };
}

export function getReviewEligibility(productId, user = getCurrentUser()) {
  if (!productId) {
    return {
      canReview: false,
      reason: "invalid_product",
      message: "Không xác định được sản phẩm cần đánh giá."
    };
  }

  if (!user || !user.id) {
    return {
      canReview: false,
      reason: "not_logged_in",
      message: "Vui lòng đăng nhập tài khoản đã mua và nhận hàng thành công để viết đánh giá sản phẩm.",
      completedOrders: [],
      unreviewedOrders: [],
      pendingOrders: [],
      cancelledOrders: [],
      existingReviews: []
    };
  }

  const orders = getOrders().filter(
    (o) => orderBelongsToUser(o, user) && orderContainsProduct(o, productId)
  );
  const completedOrders = orders.filter((o) => isOrderCompletedStatus(o.status));
  const cancelledOrders = orders.filter((o) => isOrderCancelledStatus(o.status));
  const pendingOrders = orders.filter((o) => !isOrderCompletedStatus(o.status) && !isOrderCancelledStatus(o.status));

  const map = getRawReviewsMap();
  const productReviews = (map[String(productId)] || []).filter((r) => !r.isDeleted);
  const existingReviews = productReviews.filter((r) => String(r.userId || "") === String(user.id));

  if (completedOrders.length === 0) {
    let message = "Bạn cần mua và nhận hàng thành công sản phẩm này mới có thể gửi đánh giá sao.";
    if (pendingOrders.length > 0) {
      message = `Đơn hàng #${pendingOrders[0].id} chứa sản phẩm này đang ở trạng thái "${pendingOrders[0].status}". Bạn chỉ có thể đánh giá sau khi đơn hàng được giao thành công / hoàn tất.`;
    } else if (cancelledOrders.length > 0) {
      message = "Đơn hàng chứa sản phẩm này đã bị hủy. Chỉ đơn hàng giao thành công / hoàn tất mới đủ điều kiện đánh giá.";
    }
    return {
      canReview: false,
      reason: pendingOrders.length > 0 ? "order_not_completed" : (cancelledOrders.length > 0 ? "order_cancelled" : "not_purchased"),
      message,
      completedOrders,
      unreviewedOrders: [],
      pendingOrders,
      cancelledOrders,
      existingReviews
    };
  }

  // Mỗi đơn hàng hoàn tất tương ứng tối đa 1 đánh giá (hoặc nếu review cũ chưa có orderId thì tính cho đơn đầu tiên)
  let legacyWithoutOrderUsed = existingReviews.filter((r) => !r.orderId).length;
  const reviewedOrderIds = new Set(existingReviews.filter((r) => r.orderId).map((r) => String(r.orderId)));

  const unreviewedOrders = completedOrders.filter((ord) => {
    if (reviewedOrderIds.has(String(ord.id))) return false;
    if (legacyWithoutOrderUsed > 0) {
      legacyWithoutOrderUsed -= 1;
      return false;
    }
    return true;
  });

  if (unreviewedOrders.length === 0) {
    return {
      canReview: false,
      reason: "already_reviewed",
      message: "Bạn đã gửi đánh giá cho tất cả đơn hàng hoàn tất chứa sản phẩm này.",
      completedOrders,
      unreviewedOrders: [],
      pendingOrders,
      cancelledOrders,
      existingReviews
    };
  }

  return {
    canReview: true,
    reason: "eligible",
    message: `Đủ điều kiện đánh giá từ đơn hàng #${unreviewedOrders[0].id} (Hoàn tất).`,
    eligibleOrder: unreviewedOrders[0],
    unreviewedOrders,
    completedOrders,
    pendingOrders,
    cancelledOrders,
    existingReviews
  };
}

export async function submitProductReview({ productId, rating, comment, orderId = null }) {
  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.id) {
    throw new Error("Vui lòng đăng nhập tài khoản để gửi đánh giá sản phẩm.");
  }

  const targetProductId = String(productId || "").trim();
  if (!targetProductId) {
    throw new Error("Không tìm thấy mã sản phẩm cần đánh giá.");
  }

  const parsedRating = Number(rating);
  if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
    throw new Error("Vui lòng chọn số sao đánh giá hợp lệ từ 1 đến 5.");
  }

  const cleanComment = String(comment || "").trim();
  if (cleanComment.length < MIN_REVIEW_LENGTH) {
    throw new Error(`Nội dung đánh giá cần ít nhất ${MIN_REVIEW_LENGTH} ký tự để chia sẻ trải nghiệm thực tế.`);
  }
  if (cleanComment.length > MAX_REVIEW_LENGTH) {
    throw new Error(`Nội dung đánh giá không được vượt quá ${MAX_REVIEW_LENGTH} ký tự.`);
  }

  const eligibility = getReviewEligibility(targetProductId, currentUser);
  if (!eligibility.canReview) {
    throw new Error(eligibility.message || "Bạn chưa đủ điều kiện đánh giá sản phẩm này.");
  }

  const targetOrder = orderId
    ? eligibility.unreviewedOrders.find((o) => String(o.id) === String(orderId))
    : eligibility.eligibleOrder;

  if (!targetOrder) {
    throw new Error("Đơn hàng được chọn không hợp lệ hoặc đã được đánh giá trước đó.");
  }

  // 1. Gửi lên Spring Boot Backend API
  const payload = {
    productId: targetProductId,
    rating: parsedRating,
    comment: cleanComment,
    orderId: String(targetOrder.id),
    authorAvatar: currentUser.avatar || null
  };

  let serverReview = null;
  try {
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-EcoDesk-User-Id": String(currentUser.id),
        "X-User-Id": String(currentUser.id)
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      let errMsg = "Không thể gửi đánh giá lên máy chủ.";
      try {
        const errJson = await res.json();
        errMsg = errJson.message || errMsg;
      } catch {}
      throw new Error(errMsg);
    }
    serverReview = await res.json();
  } catch (err) {
    if (err.message && err.message !== "Failed to fetch") {
      throw err;
    }
  }

  // 2. Cập nhật đồng bộ cache cục bộ
  const map = getRawReviewsMap();
  if (!Array.isArray(map[targetProductId])) map[targetProductId] = [];
  const nowIso = new Date().toISOString();
  const users = getUsers();
  const userRec = users.find((u) => String(u.id) === String(currentUser.id)) || currentUser;

  const newReview = {
    id: serverReview?.id || `REV_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    productId: targetProductId,
    orderId: String(targetOrder.id),
    userId: String(currentUser.id),
    authorName: String(userRec.name || userRec.email || "Khách hàng EcoDesk"),
    authorAvatar: currentUser.avatar || null,
    rating: parsedRating,
    comment: cleanComment,
    verifiedPurchase: true,
    date: nowIso.slice(0, 10),
    createdAt: nowIso,
    updatedAt: null,
    isDeleted: false,
    adminReply: null,
    comments: []
  };

  map[targetProductId] = map[targetProductId].filter((r) => r.id !== newReview.id);
  map[targetProductId].unshift(newReview);
  await saveAllReviewsMap(map);

  return enrichReviewForDisplay(
    newReview,
    new Map(users.map((u) => [String(u.id), u])),
    getOrders()
  );
}

export async function submitReviewComment({ productId, reviewId, content, parentCommentId = null }) {
  const targetProductId = String(productId || "").trim();
  const targetReviewId = String(reviewId || "").trim();
  if (!targetProductId || !targetReviewId) {
    throw new Error("Thiếu thông tin đánh giá cần bình luận.");
  }

  const cleanContent = String(content || "").trim();
  if (cleanContent.length < MIN_COMMENT_LENGTH) {
    throw new Error(`Bình luận cần tối thiểu ${MIN_COMMENT_LENGTH} ký tự.`);
  }
  if (cleanContent.length > MAX_COMMENT_LENGTH) {
    throw new Error(`Bình luận không được vượt quá ${MAX_COMMENT_LENGTH} ký tự.`);
  }

  const currentUser = getCurrentUser();
  const headers = { "Content-Type": "application/json" };
  if (currentUser && currentUser.id) {
    headers["X-EcoDesk-User-Id"] = String(currentUser.id);
    headers["X-User-Id"] = String(currentUser.id);
  }

  const users = getUsers();
  const userRec = currentUser ? (users.find((u) => String(u.id) === String(currentUser.id)) || currentUser) : null;

  const payload = {
    content: cleanContent,
    parentCommentId: parentCommentId || null,
    authorName: userRec ? (userRec.name || userRec.email || "Khách hàng EcoDesk") : "Khách ghé thăm",
    authorAvatar: userRec?.avatar || null
  };

  try {
    const res = await fetch(`/api/reviews/${encodeURIComponent(targetReviewId)}/comments`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      let errMsg = "Không thể gửi bình luận lên máy chủ.";
      try {
        const errJson = await res.json();
        errMsg = errJson.message || errMsg;
      } catch {}
      throw new Error(errMsg);
    }
  } catch (err) {
    if (err.message && err.message !== "Failed to fetch") {
      throw err;
    }
  }

  // Đồng bộ lại dữ liệu
  await syncReviewsFromDisk();
  const freshMap = getRawReviewsMap();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(REVIEWS_EVENT, { detail: { map: freshMap } }));
  }

  const updatedRev = (freshMap[targetProductId] || []).find((r) => r.id === targetReviewId);
  const comments = updatedRev?.comments || [];
  return comments[comments.length - 1] || null;
}

export function canManageReviews(user = getCurrentUser()) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return hasPermission(user, PERMISSIONS.REVIEWS_MANAGE);
}

export async function saveAdminReply({ productId, reviewId, targetType = "review", targetId = null, content }) {
  const currentUser = getCurrentUser();
  if (!canManageReviews(currentUser)) {
    throw new Error("Bạn không có quyền quản trị để tạo hoặc chỉnh sửa phản hồi.");
  }

  const cleanContent = String(content || "").trim();
  if (cleanContent.length < MIN_REPLY_LENGTH) {
    throw new Error(`Nội dung phản hồi cần ít nhất ${MIN_REPLY_LENGTH} ký tự.`);
  }
  if (cleanContent.length > MAX_REPLY_LENGTH) {
    throw new Error(`Nội dung phản hồi không được vượt quá ${MAX_REPLY_LENGTH} ký tự.`);
  }

  // 1. Gửi lên backend API
  try {
    const res = await fetch(`/api/reviews/${encodeURIComponent(reviewId)}/reply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-EcoDesk-User-Id": String(currentUser.id),
        "X-User-Id": String(currentUser.id)
      },
      body: JSON.stringify({
        targetType,
        targetId: targetId || null,
        content: cleanContent
      })
    });

    if (!res.ok) {
      let errMsg = "Không thể lưu phản hồi từ quản trị viên.";
      try {
        const errJson = await res.json();
        errMsg = errJson.message || errMsg;
      } catch {}
      throw new Error(errMsg);
    }
  } catch (err) {
    if (err.message && err.message !== "Failed to fetch") {
      throw err;
    }
  }

  // 2. Cập nhật local map và thông báo audit log
  await syncReviewsFromDisk();
  const map = getRawReviewsMap();
  const targetReview = (map[String(productId)] || []).find((r) => String(r.id) === String(reviewId) && !r.isDeleted);
  const nowIso = new Date().toISOString();
  const users = getUsers();
  const adminRec = users.find((u) => String(u.id) === String(currentUser.id)) || currentUser;
  const adminName = String(adminRec.name || "Quản trị viên EcoDesk");

  if (targetType === "comment" && targetReview) {
    const targetComment = (targetReview.comments || []).find((c) => String(c.id) === String(targetId) && !c.isDeleted);
    if (targetComment) {
      const existing = targetComment.adminReply;
      targetComment.adminReply = {
        id: existing?.id || `RPL_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        targetType: "comment",
        targetId: String(targetComment.id),
        adminId: String(currentUser.id),
        adminName,
        adminRole: currentUser.role || "admin",
        content: cleanContent,
        createdAt: existing?.createdAt || nowIso,
        updatedAt: existing ? nowIso : null
      };
    }
  } else if (targetReview) {
    const existing = targetReview.adminReply;
    targetReview.adminReply = {
      id: existing?.id || `RPL_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      targetType: "review",
      targetId: String(targetReview.id),
      adminId: String(currentUser.id),
      adminName,
      adminRole: currentUser.role || "admin",
      content: cleanContent,
      createdAt: existing?.createdAt || nowIso,
      updatedAt: existing ? nowIso : null
    };
  }
  await saveAllReviewsMap(map, { syncProducts: false });

  addAuditLog({
    action: targetType === "comment" ? "Phản hồi bình luận khách hàng" : "Phản hồi đánh giá sản phẩm",
    targetId: `${productId}/${targetId || reviewId}`,
    detail: `${adminName}: "${cleanContent.slice(0, 80)}"`
  });

  return targetReview?.adminReply || null;
}

export async function deleteAdminReply({ productId, reviewId, targetType = "review", targetId = null }) {
  const currentUser = getCurrentUser();
  if (!canManageReviews(currentUser)) {
    throw new Error("Bạn không có quyền xóa phản hồi quản trị.");
  }

  const map = getRawReviewsMap();
  const targetReview = (map[String(productId)] || []).find((r) => String(r.id) === String(reviewId) && !r.isDeleted);
  if (!targetReview) {
    throw new Error("Không tìm thấy đánh giá tương ứng.");
  }

  if (targetType === "comment") {
    const targetComment = (targetReview.comments || []).find((c) => String(c.id) === String(targetId) && !c.isDeleted);
    if (!targetComment || !targetComment.adminReply) {
      throw new Error("Phản hồi quản trị của bình luận này không còn tồn tại.");
    }
    targetComment.adminReply = null;
    targetComment.updatedAt = new Date().toISOString();
    await saveAllReviewsMap(map, { syncProducts: false });
    addAuditLog({
      action: "Xóa phản hồi bình luận",
      targetId: `${productId}/${targetComment.id}`,
      detail: `Xóa phản hồi EcoDesk bởi ${currentUser.name || currentUser.email}`
    });
    return true;
  }

  if (!targetReview.adminReply) {
    throw new Error("Phản hồi quản trị của đánh giá này không còn tồn tại.");
  }
  targetReview.adminReply = null;
  targetReview.updatedAt = new Date().toISOString();
  await saveAllReviewsMap(map, { syncProducts: false });
  addAuditLog({
    action: "Xóa phản hồi đánh giá",
    targetId: `${productId}/${targetReview.id}`,
    detail: `Xóa phản hồi EcoDesk bởi ${currentUser.name || currentUser.email}`
  });
  return true;
}

export async function deleteReviewByAdmin({ productId, reviewId, reason = "" }) {
  const currentUser = getCurrentUser();
  if (!canManageReviews(currentUser)) {
    throw new Error("Bạn không có quyền xóa đánh giá vi phạm.");
  }

  try {
    const res = await fetch(`/api/reviews/${encodeURIComponent(reviewId)}?reason=${encodeURIComponent(reason)}`, {
      method: "DELETE",
      headers: {
        "X-EcoDesk-User-Id": String(currentUser.id),
        "X-User-Id": String(currentUser.id)
      }
    });
    if (!res.ok) {
      let errMsg = "Không thể xóa đánh giá trên máy chủ.";
      try {
        const errJson = await res.json();
        errMsg = errJson.message || errMsg;
      } catch {}
      throw new Error(errMsg);
    }
  } catch (err) {
    if (err.message && err.message !== "Failed to fetch") {
      throw err;
    }
  }

  const map = getRawReviewsMap();
  const targetReview = (map[String(productId)] || []).find((r) => String(r.id) === String(reviewId) && !r.isDeleted);
  if (targetReview) {
    const nowIso = new Date().toISOString();
    targetReview.isDeleted = true;
    targetReview.deletedAt = nowIso;
    targetReview.deletedBy = String(currentUser.id);
    targetReview.deletedReason = String(reason || "Vi phạm quy định cộng đồng EcoDesk").trim();
    targetReview.updatedAt = nowIso;
    await saveAllReviewsMap(map, { syncProducts: true });
  }

  addAuditLog({
    action: "Xóa đánh giá vi phạm",
    targetId: `${productId}/${reviewId}`,
    detail: `Người gửi: ${targetReview?.authorName || "Ẩn danh"} | Lý do: ${reason}`
  });
  return true;
}

export async function deleteCommentByAdmin({ productId, reviewId, commentId, reason = "" }) {
  const currentUser = getCurrentUser();
  if (!canManageReviews(currentUser)) {
    throw new Error("Bạn không có quyền xóa bình luận vi phạm.");
  }

  try {
    const res = await fetch(`/api/reviews/${encodeURIComponent(reviewId)}?commentId=${encodeURIComponent(commentId)}&reason=${encodeURIComponent(reason)}`, {
      method: "DELETE",
      headers: {
        "X-EcoDesk-User-Id": String(currentUser.id),
        "X-User-Id": String(currentUser.id)
      }
    });
    if (!res.ok) {
      let errMsg = "Không thể xóa bình luận trên máy chủ.";
      try {
        const errJson = await res.json();
        errMsg = errJson.message || errMsg;
      } catch {}
      throw new Error(errMsg);
    }
  } catch (err) {
    if (err.message && err.message !== "Failed to fetch") {
      throw err;
    }
  }

  const map = getRawReviewsMap();
  const targetReview = (map[String(productId)] || []).find((r) => String(r.id) === String(reviewId) && !r.isDeleted);
  const targetComment = (targetReview?.comments || []).find((c) => String(c.id) === String(commentId) && !c.isDeleted);
  if (targetComment) {
    const nowIso = new Date().toISOString();
    targetComment.isDeleted = true;
    targetComment.deletedAt = nowIso;
    targetComment.deletedBy = String(currentUser.id);
    targetComment.deletedReason = String(reason || "Vi phạm quy định cộng đồng EcoDesk").trim();
    targetComment.updatedAt = nowIso;
    await saveAllReviewsMap(map, { syncProducts: false });
  }

  addAuditLog({
    action: "Xóa bình luận vi phạm",
    targetId: `${productId}/${reviewId}/${commentId}`,
    detail: `Người gửi: ${targetComment?.authorName || "Ẩn danh"} | Lý do: ${reason}`
  });
  return true;
}

export function getUserReviewActivity(userId) {
  if (!userId) return { reviews: [], comments: [] };
  const uid = String(userId);
  const allReviews = getAllReviewsList();
  const productsMap = new Map(getProducts().map((p) => [String(p.id), p]));

  const reviews = allReviews
    .filter((r) => String(r.userId || "") === uid)
    .map((r) => ({
      ...r,
      product: productsMap.get(String(r.productId)) || null
    }));

  const comments = [];
  allReviews.forEach((r) => {
    const product = productsMap.get(String(r.productId)) || null;
    (r.comments || []).forEach((c) => {
      if (String(c.userId || "") === uid) {
        comments.push({
          ...c,
          reviewAuthorName: r.authorName,
          reviewRating: r.rating,
          reviewSnippet: r.comment,
          product
        });
      }
    });
  });

  comments.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return { reviews, comments };
}

export function getUserReviewableProducts(user = getCurrentUser()) {
  if (!user || !user.id) return [];
  const orders = getOrders().filter((o) => orderBelongsToUser(o, user) && isOrderCompletedStatus(o.status));
  const productsMap = new Map(getProducts().map((p) => [String(p.id), p]));
  const seenKey = new Set();
  const pendingReviewItems = [];

  orders
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .forEach((order) => {
      parseOrderItems(order).forEach((item) => {
        const productId = String(item.productId || item.id || "");
        if (!productId) return;
        const pairKey = `${order.id}::${productId}`;
        if (seenKey.has(pairKey)) return;
        seenKey.add(pairKey);

        const eligibility = getReviewEligibility(productId, user);
        if (
          eligibility.canReview &&
          eligibility.unreviewedOrders.some((uo) => String(uo.id) === String(order.id))
        ) {
          pendingReviewItems.push({
            orderId: order.id,
            orderCreatedAt: order.createdAt,
            productId,
            productName: item.name || productsMap.get(productId)?.name || `Sản phẩm ${productId}`,
            productImage: item.image || productsMap.get(productId)?.image || "./images/ban-nang-ha-mat-go.png",
            variantName: item.variantName || null
          });
        }
      });
    });

  return pendingReviewItems;
}

