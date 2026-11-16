package com.ecodesk.controller;

import com.ecodesk.entity.Order;
import com.ecodesk.entity.Product;
import com.ecodesk.entity.Review;
import com.ecodesk.entity.User;
import com.ecodesk.repository.OrderRepository;
import com.ecodesk.repository.ProductRepository;
import com.ecodesk.repository.ReviewRepository;
import com.ecodesk.repository.UserRepository;
import com.ecodesk.service.RbacService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping({"/api/reviews", "/api-reviews"})
public class ReviewController {

    private final ReviewRepository reviewRepository;
    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final RbacService rbacService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ReviewController(ReviewRepository reviewRepository,
                            OrderRepository orderRepository,
                            ProductRepository productRepository,
                            UserRepository userRepository,
                            RbacService rbacService) {
        this.reviewRepository = reviewRepository;
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
        this.userRepository = userRepository;
        this.rbacService = rbacService;
    }

    /**
     * Chuẩn hóa trạng thái đơn hàng hoàn tất/giao thành công
     */
    public static boolean isOrderCompleted(String status) {
        if (status == null) return false;
        String s = status.trim().toLowerCase();
        return s.equals("hoàn thành") || s.equals("hoàn tất") || s.equals("đã giao") || s.equals("giao thành công");
    }

    public static String normalizeEmail(String email) {
        if (email == null) return "";
        return email.trim().toLowerCase();
    }

    /**
     * Kiểm tra đơn hàng có chứa sản phẩm (hỗ trợ cả biến thể, items, itemsJson, productId, id)
     */
    public boolean orderContainsProduct(Order order, String targetProductId) {
        if (order == null || targetProductId == null || targetProductId.isBlank()) return false;
        String target = targetProductId.trim();

        // 1. Kiểm tra itemsJson
        String rawJson = order.getItemsJson();
        if (rawJson != null && !rawJson.isBlank()) {
            try {
                JsonNode arr = objectMapper.readTree(rawJson);
                if (arr.isArray()) {
                    for (JsonNode item : arr) {
                        String pid = item.hasNonNull("productId") ? item.get("productId").asText().trim() : "";
                        String id = item.hasNonNull("id") ? item.get("id").asText().trim() : "";
                        String vid = item.hasNonNull("variantId") ? item.get("variantId").asText().trim() : "";
                        String sku = item.hasNonNull("variantSku") ? item.get("variantSku").asText().trim() : "";

                        if (target.equalsIgnoreCase(pid) || target.equalsIgnoreCase(id)) return true;
                        if (id.startsWith(target + "-") || id.startsWith(target + "_")) return true;
                        if (vid.startsWith(target + "-") || vid.startsWith(target + "_")) return true;
                    }
                }
            } catch (Exception ignored) {}
        }

        return false;
    }

    /**
     * Kiểm tra đơn hàng thuộc về user (ưu tiên userId, fallback email nếu duy nhất)
     */
    public boolean orderBelongsToUser(Order order, User user) {
        if (order == null || user == null) return false;
        if (order.getUserId() != null && !order.getUserId().isBlank()) {
            return order.getUserId().trim().equalsIgnoreCase(user.getId().trim());
        }
        if (order.getCustomerEmail() != null && !order.getCustomerEmail().isBlank() && user.getEmail() != null) {
            return normalizeEmail(order.getCustomerEmail()).equals(normalizeEmail(user.getEmail()));
        }
        return false;
    }

    /**
     * Tìm đơn hàng hoàn tất duy nhất và hợp lệ cho 1 user mua sản phẩm
     */
    private Optional<Order> findUniqueCompletedOrderForReview(String userId, String userEmail, String productId, String requestedOrderId) {
        List<Order> allOrders = orderRepository.findAll();

        // Nếu có truyền orderId cụ thể:
        if (requestedOrderId != null && !requestedOrderId.isBlank()) {
            Optional<Order> targetOrderOpt = allOrders.stream()
                    .filter(o -> o.getId().equalsIgnoreCase(requestedOrderId.trim()))
                    .findFirst();

            if (targetOrderOpt.isPresent()) {
                Order order = targetOrderOpt.get();
                if (isOrderCompleted(order.getStatus()) && orderContainsProduct(order, productId)) {
                    // Kiểm tra quyền sở hữu
                    boolean matchesUser = false;
                    if (userId != null && !userId.isBlank() && order.getUserId() != null) {
                        matchesUser = order.getUserId().trim().equalsIgnoreCase(userId.trim());
                    } else if (userEmail != null && !userEmail.isBlank() && order.getCustomerEmail() != null) {
                        matchesUser = normalizeEmail(order.getCustomerEmail()).equals(normalizeEmail(userEmail));
                    }
                    if (matchesUser) return Optional.of(order);
                }
            }
        }

        // Nếu không có orderId hoặc không tìm thấy theo orderId: Tìm tất cả đơn hoàn tất của khách này có sản phẩm
        List<Order> userCompletedOrdersWithProduct = allOrders.stream()
                .filter(o -> isOrderCompleted(o.getStatus()))
                .filter(o -> {
                    boolean userMatch = false;
                    if (userId != null && !userId.isBlank() && o.getUserId() != null) {
                        userMatch = o.getUserId().trim().equalsIgnoreCase(userId.trim());
                    } else if (userEmail != null && !userEmail.isBlank() && o.getCustomerEmail() != null) {
                        userMatch = normalizeEmail(o.getCustomerEmail()).equals(normalizeEmail(userEmail));
                    }
                    return userMatch && orderContainsProduct(o, productId);
                })
                .sorted((a, b) -> {
                    String dateA = a.getCompletedAt() != null ? a.getCompletedAt() : (a.getCreatedAt() != null ? a.getCreatedAt() : "");
                    String dateB = b.getCompletedAt() != null ? b.getCompletedAt() : (b.getCreatedAt() != null ? b.getCreatedAt() : "");
                    return dateB.compareTo(dateA);
                })
                .collect(Collectors.toList());

        if (!userCompletedOrdersWithProduct.isEmpty()) {
            // Trả về đơn hàng mới nhất
            return Optional.of(userCompletedOrdersWithProduct.get(0));
        }

        return Optional.empty();
    }

    /**
     * Tính toán lại rating và reviewCount cho 1 sản phẩm
     */
    private void recalculateProductRating(String productId) {
        if (productId == null || productId.isBlank()) return;
        Product product = productRepository.findById(productId).orElse(null);
        if (product == null) return;

        List<Review> reviews = reviewRepository.findByProductIdAndIsDeletedFalse(productId);
        // Chỉ tính điểm đối với các đánh giá hợp lệ (verifiedPurchase = true hoặc có orderId hợp lệ)
        List<Review> validReviews = reviews.stream()
                .filter(r -> Boolean.TRUE.equals(r.getVerifiedPurchase()))
                .collect(Collectors.toList());

        if (validReviews.isEmpty()) {
            product.setRating(0.0);
            product.setReviewCount(0);
        } else {
            double avg = validReviews.stream().mapToInt(Review::getRating).average().orElse(0.0);
            // Làm tròn 1 chữ số thập phân
            double rounded = Math.round(avg * 10.0) / 10.0;
            product.setRating(rounded);
            product.setReviewCount(validReviews.size());
        }
        productRepository.save(product);
    }

    /**
     * GET /api/reviews
     * Lấy danh sách đánh giá.
     * Query params:
     * - productId: lọc theo sản phẩm
     * - orderId: lọc theo đơn hàng
     * - userId: lọc theo tài khoản khách
     * - status: "all", "verified", "unverified"
     */
    @GetMapping
    public ResponseEntity<?> getReviews(
            @RequestParam(required = false) String productId,
            @RequestParam(required = false) String orderId,
            @RequestParam(required = false) String userId,
            @RequestParam(required = false, defaultValue = "all") String filter
    ) {
        List<Review> list;
        if (productId != null && !productId.isBlank()) {
            list = reviewRepository.findByProductIdAndIsDeletedFalse(productId.trim());
        } else if (orderId != null && !orderId.isBlank()) {
            list = reviewRepository.findByOrderIdAndIsDeletedFalse(orderId.trim());
        } else if (userId != null && !userId.isBlank()) {
            list = reviewRepository.findByUserIdAndIsDeletedFalse(userId.trim());
        } else {
            list = reviewRepository.findByIsDeletedFalse();
        }

        if ("verified".equalsIgnoreCase(filter)) {
            list = list.stream().filter(r -> Boolean.TRUE.equals(r.getVerifiedPurchase())).collect(Collectors.toList());
        } else if ("unverified".equalsIgnoreCase(filter)) {
            list = list.stream().filter(r -> !Boolean.TRUE.equals(r.getVerifiedPurchase())).collect(Collectors.toList());
        }

        // Sắp xếp mới nhất lên đầu
        list.sort((a, b) -> {
            String ca = a.getCreatedAt() != null ? a.getCreatedAt() : "";
            String cb = b.getCreatedAt() != null ? b.getCreatedAt() : "";
            return cb.compareTo(ca);
        });

        return ResponseEntity.ok(list);
    }

    /**
     * GET /api/reviews/check-eligibility
     * Kiểm tra xem user có đủ điều kiện gửi đánh giá cho sản phẩm không
     */
    @GetMapping("/check-eligibility")
    public ResponseEntity<?> checkEligibility(
            @RequestParam String productId,
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorUserId
    ) {
        if (actorUserId == null || actorUserId.isBlank()) {
            return ResponseEntity.ok(Map.of(
                    "canReview", false,
                    "reason", "Vui lòng đăng nhập để gửi đánh giá sản phẩm."
            ));
        }

        User user = userRepository.findById(actorUserId.trim()).orElse(null);
        if (user == null || (user.getActive() != null && !user.getActive())) {
            return ResponseEntity.ok(Map.of(
                    "canReview", false,
                    "reason", "Tài khoản không hợp lệ hoặc đã bị khóa."
            ));
        }

        // Tìm đơn hoàn tất chứa sản phẩm
        Optional<Order> orderOpt = findUniqueCompletedOrderForReview(user.getId(), user.getEmail(), productId, null);
        if (orderOpt.isEmpty()) {
            return ResponseEntity.ok(Map.of(
                    "canReview", false,
                    "reason", "Chỉ khách đã mua và nhận hàng thành công sản phẩm mới được gửi đánh giá sao."
            ));
        }

        Order order = orderOpt.get();

        // Kiểm tra xem đơn này đã từng đánh giá sản phẩm này chưa
        List<Review> userReviews = reviewRepository.findByProductIdAndIsDeletedFalse(productId);
        boolean alreadyReviewed = userReviews.stream().anyMatch(r ->
                user.getId().equalsIgnoreCase(r.getUserId()) &&
                order.getId().equalsIgnoreCase(r.getOrderId())
        );

        if (alreadyReviewed) {
            return ResponseEntity.ok(Map.of(
                    "canReview", false,
                    "alreadyReviewed", true,
                    "orderId", order.getId(),
                    "reason", "Bạn đã đánh giá sản phẩm này cho đơn hàng #" + order.getId() + " rồi."
            ));
        }

        return ResponseEntity.ok(Map.of(
                "canReview", true,
                "orderId", order.getId(),
                "completedAt", order.getCompletedAt() != null ? order.getCompletedAt() : order.getCreatedAt(),
                "authorName", user.getName() != null && !user.getName().isBlank() ? user.getName() : "Khách hàng EcoDesk"
        ));
    }

    /**
     * POST /api/reviews
     * Tạo đánh giá sao mới hoặc import batch từ frontend/file
     */
    @PostMapping
    public ResponseEntity<?> createReview(
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorUserId,
            @RequestBody JsonNode body
    ) {
        // Kiểm tra nếu là sync batch dạng Map<productId, List<Review>>:
        if (body.isObject() && !body.has("productId") && !body.has("comment")) {
            return batchSyncReviews(actorUserId, body);
        }

        // Ngược lại, là request tạo 1 đánh giá mới:
        if (actorUserId == null || actorUserId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập tài khoản để gửi đánh giá.");
        }

        User user = userRepository.findById(actorUserId.trim()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Tài khoản không tồn tại trong hệ thống."));

        if (user.getActive() != null && !user.getActive()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Tài khoản của bạn đã bị khóa.");
        }

        String productId = body.hasNonNull("productId") ? body.get("productId").asText().trim() : "";
        if (productId.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Thiếu mã sản phẩm cần đánh giá.");
        }

        int rating = body.hasNonNull("rating") ? body.get("rating").asInt() : 5;
        if (rating < 1 || rating > 5) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Số sao đánh giá phải từ 1 đến 5.");
        }

        String comment = body.hasNonNull("comment") ? body.get("comment").asText().trim() : "";
        if (comment.length() < 5) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nội dung đánh giá cần ít nhất 5 ký tự để chia sẻ trải nghiệm thực tế.");
        }
        if (comment.length() > 1000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nội dung đánh giá không được vượt quá 1000 ký tự.");
        }

        String requestedOrderId = body.hasNonNull("orderId") ? body.get("orderId").asText().trim() : null;

        // Xác minh điều kiện mua hàng từ đơn hoàn tất
        Optional<Order> matchedOrderOpt = findUniqueCompletedOrderForReview(user.getId(), user.getEmail(), productId, requestedOrderId);
        if (matchedOrderOpt.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Bạn chưa có đơn hàng hoàn tất/giao thành công nào chứa sản phẩm này để gửi đánh giá sao.");
        }

        Order matchedOrder = matchedOrderOpt.get();

        // Kiểm tra xem đơn hàng này đã được đánh giá cho sản phẩm này chưa
        List<Review> existing = reviewRepository.findByProductIdAndIsDeletedFalse(productId);
        boolean alreadyReviewed = existing.stream().anyMatch(r ->
                user.getId().equalsIgnoreCase(r.getUserId()) &&
                matchedOrder.getId().equalsIgnoreCase(r.getOrderId())
        );

        if (alreadyReviewed) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Bạn đã gửi đánh giá cho sản phẩm này từ đơn hàng #" + matchedOrder.getId() + " rồi.");
        }

        Review review = new Review();
        review.setId("REV_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 5));
        review.setProductId(productId);
        review.setOrderId(matchedOrder.getId());
        review.setUserId(user.getId());
        review.setUserEmail(user.getEmail());
        review.setAuthorName(user.getName() != null && !user.getName().isBlank() ? user.getName() : "Khách hàng EcoDesk");
        review.setAuthorAvatar(body.hasNonNull("authorAvatar") ? body.get("authorAvatar").asText() : null);
        review.setRating(rating);
        review.setComment(comment);
        review.setVerifiedPurchase(true);
        review.setCreatedAt(Instant.now().toString());
        review.setUpdatedAt(null);
        review.setIsDeleted(false);
        review.setAdminReplyJson(null);
        review.setCommentsJson("[]");

        Review saved = reviewRepository.save(review);
        recalculateProductRating(productId);

        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    /**
     * Batch Sync / Migration từ LocalStorage hoặc file reviews.json vào MySQL
     */
    @PostMapping("/batch-sync")
    public ResponseEntity<?> batchSyncReviews(
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorUserId,
            @RequestBody JsonNode rootMap
    ) {
        int added = 0;
        int updated = 0;
        Set<String> affectedProducts = new HashSet<>();
        List<Order> allOrders = orderRepository.findAll();

        Iterator<Map.Entry<String, JsonNode>> fields = rootMap.fields();
        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> entry = fields.next();
            String productId = entry.getKey();
            JsonNode revList = entry.getValue();
            if (!revList.isArray()) continue;

            affectedProducts.add(productId);

            for (JsonNode node : revList) {
                String id = node.hasNonNull("id") ? node.get("id").asText() : "";
                if (id.isBlank()) continue;

                Review existing = reviewRepository.findById(id).orElse(null);
                Review target = existing != null ? existing : new Review();
                boolean isNew = (existing == null);

                target.setId(id);
                target.setProductId(productId);
                if (node.hasNonNull("orderId")) target.setOrderId(node.get("orderId").asText());
                if (node.hasNonNull("userId")) target.setUserId(node.get("userId").asText());
                if (node.hasNonNull("userEmail")) target.setUserEmail(node.get("userEmail").asText());
                if (node.hasNonNull("authorName")) target.setAuthorName(node.get("authorName").asText());
                if (node.hasNonNull("authorAvatar")) target.setAuthorAvatar(node.get("authorAvatar").asText());
                if (node.hasNonNull("rating")) target.setRating(node.get("rating").asInt());
                if (node.hasNonNull("comment")) target.setComment(node.get("comment").asText());
                if (node.hasNonNull("createdAt")) target.setCreatedAt(node.get("createdAt").asText());
                if (node.hasNonNull("updatedAt")) target.setUpdatedAt(node.get("updatedAt").asText());
                if (node.hasNonNull("isDeleted")) target.setIsDeleted(node.get("isDeleted").asBoolean());
                if (node.hasNonNull("deletedAt")) target.setDeletedAt(node.get("deletedAt").asText());
                if (node.hasNonNull("deletedBy")) target.setDeletedBy(node.get("deletedBy").asText());
                if (node.hasNonNull("deletedReason")) target.setDeletedReason(node.get("deletedReason").asText());

                if (node.hasNonNull("adminReply")) {
                    target.setAdminReplyJson(node.get("adminReply").toString());
                } else if (node.hasNonNull("adminReplyJson")) {
                    target.setAdminReplyJson(node.get("adminReplyJson").asText());
                }

                if (node.hasNonNull("comments")) {
                    target.setCommentsJson(node.get("comments").toString());
                } else if (node.hasNonNull("commentsJson")) {
                    target.setCommentsJson(node.get("commentsJson").asText());
                }

                // Chạy xác minh đơn hàng chặt chẽ:
                Optional<Order> matchedOpt = findUniqueCompletedOrderForReview(target.getUserId(), target.getUserEmail(), productId, target.getOrderId());
                if (matchedOpt.isPresent()) {
                    Order matched = matchedOpt.get();
                    target.setVerifiedPurchase(true);
                    if (target.getOrderId() == null || target.getOrderId().isBlank()) {
                        target.setOrderId(matched.getId());
                    }
                    if (target.getUserId() == null || target.getUserId().isBlank()) {
                        target.setUserId(matched.getUserId());
                    }
                } else {
                    target.setVerifiedPurchase(false);
                }

                reviewRepository.save(target);
                if (isNew) added++;
                else updated++;
            }
        }

        // Tính lại điểm sản phẩm
        for (String pid : affectedProducts) {
            recalculateProductRating(pid);
        }

        return ResponseEntity.ok(Map.of(
                "success", true,
                "added", added,
                "updated", updated,
                "affectedProducts", affectedProducts.size()
        ));
    }

    /**
     * POST /api/reviews/{id}/comments
     * Gửi bình luận thảo luận dưới 1 đánh giá
     */
    @PostMapping("/{id}/comments")
    public ResponseEntity<?> addComment(
            @PathVariable String id,
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorUserId,
            @RequestBody JsonNode body
    ) {
        Review review = reviewRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đánh giá."));

        String content = body.hasNonNull("content") ? body.get("content").asText().trim() : "";
        if (content.length() < 2) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nội dung bình luận cần ít nhất 2 ký tự.");
        }
        if (content.length() > 600) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nội dung bình luận không vượt quá 600 ký tự.");
        }

        User user = null;
        if (actorUserId != null && !actorUserId.isBlank()) {
            user = userRepository.findById(actorUserId.trim()).orElse(null);
        }

        String authorName = body.hasNonNull("authorName") ? body.get("authorName").asText().trim() : "";
        if (user != null) {
            authorName = user.getName() != null && !user.getName().isBlank() ? user.getName() : "Khách hàng EcoDesk";
        } else if (authorName.isBlank()) {
            authorName = "Khách ghé thăm";
        }

        ArrayNode commentsArray;
        try {
            if (review.getCommentsJson() != null && !review.getCommentsJson().isBlank()) {
                commentsArray = (ArrayNode) objectMapper.readTree(review.getCommentsJson());
            } else {
                commentsArray = objectMapper.createArrayNode();
            }
        } catch (Exception e) {
            commentsArray = objectMapper.createArrayNode();
        }

        ObjectNode commentNode = objectMapper.createObjectNode();
        commentNode.put("id", "CMT_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 4));
        commentNode.put("reviewId", review.getId());
        commentNode.put("productId", review.getProductId());
        commentNode.put("parentCommentId", body.hasNonNull("parentCommentId") ? body.get("parentCommentId").asText() : null);
        commentNode.put("userId", user != null ? user.getId() : null);
        commentNode.put("authorName", authorName);
        
        String commentAvatar = (user != null && body.hasNonNull("authorAvatar")) ? body.get("authorAvatar").asText() : null;
        if (commentAvatar != null && !commentAvatar.isBlank()) {
            commentNode.put("authorAvatar", commentAvatar);
        } else {
            commentNode.putNull("authorAvatar");
        }

        commentNode.put("authorRole", user != null ? user.getRole() : "guest");
        commentNode.put("isGuest", user == null);
        commentNode.put("content", content);
        commentNode.put("createdAt", Instant.now().toString());
        commentNode.put("updatedAt", (String) null);
        commentNode.put("isDeleted", false);

        commentsArray.add(commentNode);
        review.setCommentsJson(commentsArray.toString());
        Review saved = reviewRepository.save(review);

        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    /**
     * POST /api/reviews/{id}/reply
     * Admin/nhân viên phản hồi đánh giá hoặc bình luận
     */
    @PostMapping("/{id}/reply")
    public ResponseEntity<?> addAdminReply(
            @PathVariable String id,
            @RequestHeader(value = RbacService.HEADER_USER_ID) String actorUserId,
            @RequestBody JsonNode body
    ) {
        User adminUser = rbacService.requireAnyPermission(actorUserId, null, "Không có quyền quản lý đánh giá.", RbacService.PERM_REVIEWS_MANAGE);

        Review review = reviewRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đánh giá."));

        String content = body.hasNonNull("content") ? body.get("content").asText().trim() : "";
        if (content.length() < 2) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nội dung phản hồi cần ít nhất 2 ký tự.");
        }

        String targetType = body.hasNonNull("targetType") ? body.get("targetType").asText() : "review";
        String targetId = body.hasNonNull("targetId") ? body.get("targetId").asText() : "";
        String nowIso = Instant.now().toString();

        if ("comment".equalsIgnoreCase(targetType) && !targetId.isBlank()) {
            // Phản hồi một bình luận cụ thể bên trong review
            try {
                ArrayNode arr = (ArrayNode) objectMapper.readTree(review.getCommentsJson());
                boolean found = false;
                for (JsonNode c : arr) {
                    if (c.hasNonNull("id") && c.get("id").asText().equalsIgnoreCase(targetId)) {
                        ObjectNode replyNode = objectMapper.createObjectNode();
                        replyNode.put("id", "RPL_" + System.currentTimeMillis());
                        replyNode.put("targetType", "comment");
                        replyNode.put("targetId", targetId);
                        replyNode.put("adminId", adminUser.getId());
                        replyNode.put("adminName", adminUser.getName() != null ? adminUser.getName() : "Quản trị viên EcoDesk");
                        replyNode.put("adminRole", adminUser.getRole());
                        replyNode.put("content", content);
                        replyNode.put("createdAt", nowIso);
                        replyNode.put("updatedAt", nowIso);

                        ((ObjectNode) c).set("adminReply", replyNode);
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy bình luận cần phản hồi.");
                }
                review.setCommentsJson(arr.toString());
            } catch (Exception e) {
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Lỗi cập nhật bình luận: " + e.getMessage());
            }
        } else {
            // Phản hồi trực tiếp đánh giá sao
            ObjectNode replyNode = objectMapper.createObjectNode();
            replyNode.put("id", "RPL_" + System.currentTimeMillis());
            replyNode.put("targetType", "review");
            replyNode.put("targetId", review.getId());
            replyNode.put("adminId", adminUser.getId());
            replyNode.put("adminName", adminUser.getName() != null ? adminUser.getName() : "Quản trị viên EcoDesk");
            replyNode.put("adminRole", adminUser.getRole());
            replyNode.put("content", content);
            replyNode.put("createdAt", nowIso);
            replyNode.put("updatedAt", nowIso);

            review.setAdminReplyJson(replyNode.toString());
            review.setUpdatedAt(nowIso);
        }

        Review saved = reviewRepository.save(review);
        return ResponseEntity.ok(saved);
    }

    /**
     * DELETE /api/reviews/{id}
     * Xóa mềm đánh giá hoặc xóa bình luận
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteReview(
            @PathVariable String id,
            @RequestHeader(value = RbacService.HEADER_USER_ID) String actorUserId,
            @RequestParam(required = false) String commentId,
            @RequestParam(required = false, defaultValue = "Xóa bởi quản trị viên") String reason
    ) {
        User adminUser = rbacService.requireAnyPermission(actorUserId, null, "Không có quyền quản lý đánh giá.", RbacService.PERM_REVIEWS_MANAGE);

        Review review = reviewRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy đánh giá."));

        String nowIso = Instant.now().toString();

        if (commentId != null && !commentId.isBlank()) {
            // Xóa mềm bình luận
            try {
                ArrayNode arr = (ArrayNode) objectMapper.readTree(review.getCommentsJson());
                for (JsonNode c : arr) {
                    if (c.hasNonNull("id") && c.get("id").asText().equalsIgnoreCase(commentId.trim())) {
                        ObjectNode obj = (ObjectNode) c;
                        obj.put("isDeleted", true);
                        obj.put("deletedAt", nowIso);
                        obj.put("deletedBy", adminUser.getId());
                        obj.put("deletedReason", reason);
                        break;
                    }
                }
                review.setCommentsJson(arr.toString());
            } catch (Exception e) {
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Lỗi xóa bình luận: " + e.getMessage());
            }
        } else {
            // Xóa mềm đánh giá
            review.setIsDeleted(true);
            review.setDeletedAt(nowIso);
            review.setDeletedBy(adminUser.getId());
            review.setDeletedReason(reason);
        }

        Review saved = reviewRepository.save(review);
        recalculateProductRating(review.getProductId());

        return ResponseEntity.ok(saved);
    }

    /**
     * POST /api/reviews/recalculate-all
     * Tính toán lại điểm trung bình cho tất cả sản phẩm
     */
    @PostMapping("/recalculate-all")
    public ResponseEntity<?> recalculateAllRatings(
            @RequestHeader(value = RbacService.HEADER_USER_ID) String actorUserId
    ) {
        User adminUser = rbacService.requireAnyPermission(actorUserId, null, "Không có quyền quản lý đánh giá.", RbacService.PERM_REVIEWS_MANAGE);
        List<Product> products = productRepository.findAll();
        for (Product p : products) {
            recalculateProductRating(p.getId());
        }
        return ResponseEntity.ok(Map.of("success", true, "recalculatedProducts", products.size()));
    }
}
