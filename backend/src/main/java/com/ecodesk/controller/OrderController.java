package com.ecodesk.controller;

import com.ecodesk.config.SepayProperties;
import com.ecodesk.entity.Campaign;
import com.ecodesk.entity.Order;
import com.ecodesk.entity.Product;
import com.ecodesk.entity.User;
import com.ecodesk.repository.CampaignRepository;
import com.ecodesk.repository.OrderRepository;
import com.ecodesk.repository.ProductRepository;
import com.ecodesk.repository.UserRepository;
import com.ecodesk.service.RbacService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;
import java.text.Normalizer;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final SepayProperties sepayProperties;
    private final RbacService rbacService;
    private final CampaignRepository campaignRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final SecureRandom secureRandom = new SecureRandom();

    public OrderController(OrderRepository orderRepository,
                           ProductRepository productRepository,
                           UserRepository userRepository,
                           SepayProperties sepayProperties) {
        this(orderRepository, productRepository, userRepository, sepayProperties, new RbacService(userRepository), null);
    }

    public OrderController(OrderRepository orderRepository,
                           ProductRepository productRepository,
                           UserRepository userRepository,
                           SepayProperties sepayProperties,
                           RbacService rbacService) {
        this(orderRepository, productRepository, userRepository, sepayProperties, rbacService, null);
    }

    @Autowired
    public OrderController(OrderRepository orderRepository,
                           ProductRepository productRepository,
                           UserRepository userRepository,
                           SepayProperties sepayProperties,
                           RbacService rbacService,
                           @Autowired(required = false) CampaignRepository campaignRepository) {
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
        this.userRepository = userRepository;
        this.sepayProperties = sepayProperties;
        this.rbacService = rbacService;
        this.campaignRepository = campaignRepository;
    }

    @GetMapping
    public List<Order> getAll(
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId
    ) {
        Optional<User> actorOpt = rbacService.resolveOptionalActiveActor(actorHeaderId, null);
        if (actorOpt.isPresent()) {
            User actor = actorOpt.get();
            if (!rbacService.isAdmin(actor)) {
                rbacService.requireAnyPermission(
                        actorHeaderId,
                        null,
                        "Bạn không có quyền xem danh sách đơn hàng của hệ thống.",
                        RbacService.PERM_ORDERS_VIEW,
                        RbacService.PERM_FINANCE_VIEW,
                        RbacService.PERM_REPORTS_VIEW
                );
            }
            return orderRepository.findAllByOrderByCreatedAtDesc();
        }
        return orderRepository.findAllByOrderByCreatedAtDesc();
    }

    @GetMapping("/user/{userId}")
    public List<Order> getByUser(
            @PathVariable String userId,
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId
    ) {
        Optional<User> actorOpt = rbacService.resolveOptionalActiveActor(actorHeaderId, null);
        if (actorOpt.isPresent()) {
            User actor = actorOpt.get();
            if (!actor.getId().equals(userId) && !rbacService.hasPermission(actor, RbacService.PERM_ORDERS_VIEW)) {
                throw new org.springframework.web.server.ResponseStatusException(
                        HttpStatus.FORBIDDEN,
                        "Bạn không có quyền xem đơn hàng của tài khoản khác."
                );
            }
        }
        return orderRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Order> getById(@PathVariable String id) {
        return orderRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> createOrder(@RequestBody Order order) {
        if (order.getId() == null || order.getId().trim().isEmpty()) {
            order.setId("ORD-" + System.currentTimeMillis());
        }
        if (order.getCreatedAt() == null || order.getCreatedAt().trim().isEmpty()) {
            order.setCreatedAt(Instant.now().toString());
        }
        if (order.getStatus() == null || order.getStatus().trim().isEmpty()) {
            order.setStatus("Chờ xác nhận");
        }

        boolean isQrOrder = isBankTransferOrQr(order.getPaymentMethod());
        if (isQrOrder) {
            // Đơn chuyển khoản/QR khi mới tạo luôn ở trạng thái chờ thanh toán & chờ xác nhận xử lý.
            order.setStatus("Chờ xác nhận");
            order.setPaymentStatus("UNPAID");
            if (!isValidPaymentReference(order.getPaymentReference())
                    || orderRepository.findByPaymentReferenceIgnoreCase(order.getPaymentReference().trim()).isPresent()) {
                order.setPaymentReference(generateUniquePaymentReference());
            } else {
                order.setPaymentReference(order.getPaymentReference().trim().toUpperCase(Locale.ROOT));
            }
            order.setSepayTransactionId(null);
            order.setPaidAmount(null);
            order.setPaidAt(null);
            order.setPaymentReviewReason(null);
        } else {
            if (order.getPaymentStatus() == null || order.getPaymentStatus().trim().isEmpty()) {
                order.setPaymentStatus("COD");
            }
            order.setPaymentReference(null);
        }

        // Tự động kiểm tra giá bán authoritative, trừ tồn kho, tăng số lượng bán và snapshot giá vốn vào itemsJson
        double calculatedSubtotal = 0.0;
        boolean hasCalculatedItems = false;
        if (order.getItemsJson() != null && !order.getItemsJson().trim().isEmpty()) {
            try {
                JsonNode items = objectMapper.readTree(order.getItemsJson());
                if (items.isArray()) {
                    ArrayNode updatedItems = (ArrayNode) items;
                    Instant orderTime = CampaignController.parseToInstant(order.getCreatedAt());
                    if (orderTime == null) orderTime = Instant.now();
                    for (JsonNode item : updatedItems) {
                        String prodId = item.has("productId") ? item.path("productId").asText() : item.path("id").asText();
                        String variantId = item.has("variantId") && !item.get("variantId").isNull()
                                ? item.path("variantId").asText("").trim() : "";
                        int qty = item.path("quantity").asInt(1);
                        if (!prodId.isEmpty()) {
                            Optional<Product> prodOpt = productRepository.findById(prodId);
                            if (prodOpt.isPresent()) {
                                Product p = prodOpt.get();
                                Double unitCost = p.getCostPrice();
                                if (!variantId.isEmpty() && p.getVariantsJson() != null && !p.getVariantsJson().isBlank()) {
                                    try {
                                        JsonNode vNode = objectMapper.readTree(p.getVariantsJson());
                                        if (vNode.isArray()) {
                                            for (JsonNode v : vNode) {
                                                if (variantId.equals(v.path("id").asText("")) && v.has("costPrice") && v.get("costPrice").isNumber()) {
                                                    unitCost = v.get("costPrice").asDouble();
                                                    break;
                                                }
                                            }
                                        }
                                    } catch (Exception ignored) {}
                                }
                                if (item.isObject()) {
                                    if (unitCost != null && unitCost > 0) {
                                        ((ObjectNode) item).put("costPrice", unitCost);
                                    }
                                    // Authoritative server-side price check
                                    double authPrice = resolveAuthoritativePrice(p, variantId, orderTime);
                                    ((ObjectNode) item).put("price", authPrice);
                                    ((ObjectNode) item).put("unitPrice", authPrice);
                                    double rawBase = p.getPrice() != null ? p.getPrice() : 0.0;
                                    if (!variantId.isEmpty() && p.getVariantsJson() != null && !p.getVariantsJson().isBlank()) {
                                        try {
                                            JsonNode vNode = objectMapper.readTree(p.getVariantsJson());
                                            if (vNode.isArray()) {
                                                for (JsonNode v : vNode) {
                                                    if (variantId.equals(v.path("id").asText("")) && v.has("price") && v.get("price").isNumber()) {
                                                        rawBase = v.get("price").asDouble();
                                                        break;
                                                    }
                                                }
                                            }
                                        } catch (Exception ignored) {}
                                    }
                                    ((ObjectNode) item).put("originalPrice", rawBase);
                                    calculatedSubtotal += authPrice * qty;
                                    hasCalculatedItems = true;
                                }
                                int currentStock = p.getStock() != null ? p.getStock() : 0;
                                int currentSold = p.getSold() != null ? p.getSold() : 0;
                                p.setStock(Math.max(0, currentStock - qty));
                                p.setSold(currentSold + qty);
                                productRepository.save(p);
                            }
                        }
                    }
                    order.setItemsJson(objectMapper.writeValueAsString(updatedItems));
                }
            } catch (Exception ignored) {}
        }

        if (hasCalculatedItems) {
            order.setSubtotal(calculatedSubtotal);
            double disc = order.getDiscount() != null ? order.getDiscount() : 0.0;
            double ship = order.getShippingFee() != null ? order.getShippingFee() : 0.0;
            order.setTotal(Math.max(0.0, calculatedSubtotal - disc + ship));
        }

        Order saved = orderRepository.save(order);
        if (order.getUserId() != null && !order.getUserId().trim().isEmpty()) {
            recalculateUserSpend(order.getUserId());
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    private void recalculateUserSpend(String userId) {
        if (userId == null || userId.trim().isEmpty()) return;
        userRepository.findById(userId).ifPresent(user -> {
            List<Order> userOrders = orderRepository.findByUserIdOrderByCreatedAtDesc(userId);
            double totalCompleted = userOrders.stream()
                    .filter(o -> "Hoàn thành".equalsIgnoreCase(o.getStatus()))
                    .mapToDouble(o -> o.getTotal() != null ? o.getTotal() : 0.0)
                    .sum();
            user.setSpendTotal(totalCompleted);
            if (totalCompleted >= 30000000) user.setTier("Kim cương");
            else if (totalCompleted >= 10000000) user.setTier("Vàng");
            else if (totalCompleted >= 3000000) user.setTier("Bạc");
            else user.setTier("Đồng");
            userRepository.save(user);
        });
    }

    private double resolveAuthoritativePrice(Product p, String variantId, Instant orderTime) {
        double basePrice = p.getPrice() != null ? p.getPrice() : 0.0;
        if (variantId != null && !variantId.isEmpty() && p.getVariantsJson() != null && !p.getVariantsJson().isBlank()) {
            try {
                JsonNode vNode = objectMapper.readTree(p.getVariantsJson());
                if (vNode.isArray()) {
                    for (JsonNode v : vNode) {
                        if (variantId.equals(v.path("id").asText("")) && v.has("price") && v.get("price").isNumber()) {
                            basePrice = v.get("price").asDouble();
                            break;
                        }
                    }
                }
            } catch (Exception ignored) {}
        }

        // Active campaign discount
        double activeDiscountPercent = 0.0;
        if (campaignRepository != null) {
            List<Campaign> campaigns = campaignRepository.findByProductId(p.getId());
            for (Campaign c : campaigns) {
                if (Boolean.FALSE.equals(c.getActive())) continue;
                Instant start = CampaignController.parseToInstant(c.getStartAt());
                Instant end = CampaignController.parseToInstant(c.getEndAt());
                if (start != null && end != null && !orderTime.isBefore(start) && orderTime.isBefore(end)) {
                    double pct = c.getPercent() != null ? c.getPercent() : (c.getValue() != null ? c.getValue() : 0.0);
                    String type = c.getType() != null ? c.getType().trim().toLowerCase(Locale.ROOT) : "regular";
                    double cap = "special".equals(type) ? 90.0 : 50.0;
                    pct = Math.min(cap, Math.max(0.0, pct));
                    if (pct > activeDiscountPercent) {
                        activeDiscountPercent = pct;
                    }
                }
            }
        }

        // Product inline discount if configured
        if (p.getDiscountJson() != null && !p.getDiscountJson().isBlank()) {
            try {
                JsonNode dc = objectMapper.readTree(p.getDiscountJson());
                if (dc.path("enabled").asBoolean(false)) {
                    Instant dStart = CampaignController.parseToInstant(dc.path("startAt").asText(null));
                    Instant dEnd = CampaignController.parseToInstant(dc.path("endAt").asText(null));
                    if (dStart != null && dEnd != null && !orderTime.isBefore(dStart) && orderTime.isBefore(dEnd)) {
                        String dType = dc.path("type").asText("percentage");
                        double val = dc.path("value").asDouble(0.0);
                        if ("percentage".equalsIgnoreCase(dType) && val > activeDiscountPercent) {
                            activeDiscountPercent = Math.min(90.0, val);
                        } else if ("fixed".equalsIgnoreCase(dType) && basePrice > 0) {
                            double fixedPct = (val / basePrice) * 100.0;
                            if (fixedPct > activeDiscountPercent) {
                                activeDiscountPercent = Math.min(90.0, fixedPct);
                            }
                        }
                    }
                }
            } catch (Exception ignored) {}
        }

        if (activeDiscountPercent > 0) {
            return Math.round(basePrice * (100.0 - activeDiscountPercent) / 100.0);
        }
        return basePrice;
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(
            @PathVariable String id,
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId,
            @RequestBody Map<String, Object> body
    ) {
        String bodyActorId = body.get("actorUserId") != null ? body.get("actorUserId").toString() : null;
        Optional<User> actorOpt = rbacService.resolveOptionalActiveActor(actorHeaderId, bodyActorId);
        if (actorOpt.isPresent()) {
            User actor = actorOpt.get();
            if (!rbacService.hasPermission(actor, RbacService.PERM_ORDERS_UPDATE_STATUS)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "Bạn không có quyền thay đổi trạng thái đơn hàng."));
            }
        }
        Object rawStatus = body.get("status");
        String newStatus = rawStatus != null ? rawStatus.toString() : null;
        if (newStatus == null || newStatus.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Trạng thái mới không được để trống."));
        }

        return orderRepository.findById(id)
                .map(order -> {
                    String trimmedStatus = newStatus.trim();
                    if ("Đã hủy".equalsIgnoreCase(trimmedStatus) && isCustomerCancelAttempt(body)) {
                        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                                .body(Map.of("error", "Khách hàng không thể tự chuyển đơn sang Đã hủy. Vui lòng gửi yêu cầu hủy đơn để quản trị viên duyệt."));
                    }
                    String validationError = validateOrderStatusTransition(order, trimmedStatus);
                    if (validationError != null) {
                        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", validationError));
                    }
                    String oldStatus = order.getStatus() != null ? order.getStatus() : "Chờ xác nhận";
                    order.setStatus(trimmedStatus);
                    if (body.containsKey("cancelReason") && body.get("cancelReason") != null) {
                        order.setCancelReason(body.get("cancelReason").toString());
                    }
                    if (body.containsKey("cancelledAt") && body.get("cancelledAt") != null) {
                        order.setCancelledAt(body.get("cancelledAt").toString());
                    }
                    if (body.containsKey("cancelledBy") && body.get("cancelledBy") != null) {
                        order.setCancelledBy(body.get("cancelledBy").toString());
                    }
                    if (body.containsKey("statusHistoryJson") && body.get("statusHistoryJson") != null) {
                        order.setStatusHistoryJson(body.get("statusHistoryJson").toString());
                    } else if (!trimmedStatus.equalsIgnoreCase(oldStatus)) {
                        String actorName = actorOpt.map(User::getName).orElse(body.containsKey("completedBy") && body.get("completedBy") != null ? body.get("completedBy").toString() : "Quản trị viên / Cửa hàng");
                        String note = "Hoàn thành".equalsIgnoreCase(trimmedStatus)
                                ? "Xác nhận giao hàng thành công. Chuyển trạng thái từ '" + oldStatus + "' sang 'Hoàn thành'"
                                : "Chuyển trạng thái đơn hàng từ '" + oldStatus + "' sang '" + trimmedStatus + "'";
                        appendStatusHistory(order, trimmedStatus, note, actorName);
                    }
                    if ("Hoàn thành".equalsIgnoreCase(trimmedStatus) || "Hoàn tất".equalsIgnoreCase(trimmedStatus)) {
                        if (order.getCompletedAt() == null || order.getCompletedAt().isBlank()) {
                            order.setCompletedAt(Instant.now().toString());
                        }
                        String actorName = actorOpt.map(User::getName).orElse(body.containsKey("completedBy") && body.get("completedBy") != null ? body.get("completedBy").toString() : "Quản trị viên");
                        order.setCompletedBy(actorName);
                        if (!"PAID".equalsIgnoreCase(trim(order.getPaymentStatus()))) {
                            order.setPaymentStatus("PAID");
                            if (order.getPaidAmount() == null || order.getPaidAmount() <= 0) {
                                order.setPaidAmount(order.getTotal() != null ? order.getTotal() : 0.0);
                            }
                            if (order.getPaidAt() == null || order.getPaidAt().isBlank()) {
                                order.setPaidAt(Instant.now().toString());
                            }
                        }
                    }
                    if (body.containsKey("completedAt") && body.get("completedAt") != null) {
                        order.setCompletedAt(body.get("completedAt").toString());
                    }
                    if (body.containsKey("completedBy") && body.get("completedBy") != null) {
                        order.setCompletedBy(body.get("completedBy").toString());
                    }
                    if ("Đã hủy".equalsIgnoreCase(trimmedStatus)) {
                        if ("PAID".equalsIgnoreCase(trim(order.getPaymentStatus()))
                                && (order.getRefundStatus() == null || order.getRefundStatus().isBlank())) {
                            order.setRefundStatus("PENDING_REFUND");
                        }
                        restoreStockOnce(order);
                    }
                    order.setUpdatedAt(Instant.now().toString());
                    Order saved = orderRepository.save(order);
                    recalculateUserSpend(saved.getUserId());
                    return ResponseEntity.ok(saved);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateOrder(
            @PathVariable String id,
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId,
            @RequestBody Map<String, Object> body
    ) {
        String bodyActorId = body.get("actorUserId") != null ? body.get("actorUserId").toString()
                : (body.get("userId") != null ? body.get("userId").toString() : null);
        Optional<User> actorOpt = rbacService.resolveOptionalActiveActor(actorHeaderId, bodyActorId);
        return orderRepository.findById(id)
                .map(order -> {
                    if (actorOpt.isPresent()) {
                        User actor = actorOpt.get();
                        boolean isOwner = order.getUserId() != null && order.getUserId().equals(actor.getId());
                        boolean wantsStatusChange = body.containsKey("status") && body.get("status") != null;
                        if (wantsStatusChange && !rbacService.hasPermission(actor, RbacService.PERM_ORDERS_UPDATE_STATUS)) {
                            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                                    .body(Map.of("error", "Bạn không có quyền thay đổi trạng thái đơn hàng."));
                        }
                        if (!wantsStatusChange && !isOwner && !rbacService.hasPermission(actor, RbacService.PERM_ORDERS_EDIT_INFO)) {
                            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                                    .body(Map.of("error", "Bạn không có quyền chỉnh sửa thông tin đơn hàng."));
                        }
                    }
                    if (body.containsKey("customerName") && body.get("customerName") != null) {
                        order.setCustomerName(body.get("customerName").toString().trim());
                    }
                    if (body.containsKey("customerPhone") && body.get("customerPhone") != null) {
                        order.setCustomerPhone(body.get("customerPhone").toString().trim());
                    }
                    if (body.containsKey("shippingAddress") && body.get("shippingAddress") != null) {
                        order.setShippingAddress(body.get("shippingAddress").toString().trim());
                    }
                    if (body.containsKey("note")) {
                        order.setNote(body.get("note") != null ? body.get("note").toString().trim() : "");
                    }
                    if (body.containsKey("status") && body.get("status") != null) {
                        String trimmedStatus = body.get("status").toString().trim();
                        if ("Đã hủy".equalsIgnoreCase(trimmedStatus) && isCustomerCancelAttempt(body)) {
                            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                                    .body(Map.of("error", "Khách hàng không thể tự chuyển đơn sang Đã hủy. Vui lòng gửi yêu cầu hủy đơn."));
                        }
                        String validationError = validateOrderStatusTransition(order, trimmedStatus);
                        if (validationError != null) {
                            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", validationError));
                        }
                        String oldStatus = order.getStatus() != null ? order.getStatus() : "Chờ xác nhận";
                        order.setStatus(trimmedStatus);
                        if (!body.containsKey("statusHistoryJson") && !trimmedStatus.equalsIgnoreCase(oldStatus)) {
                            String actorName = actorOpt.map(User::getName).orElse(body.containsKey("completedBy") && body.get("completedBy") != null ? body.get("completedBy").toString() : "Quản trị viên / Cửa hàng");
                            String note = "Hoàn thành".equalsIgnoreCase(trimmedStatus)
                                    ? "Xác nhận giao hàng thành công. Chuyển trạng thái từ '" + oldStatus + "' sang 'Hoàn thành'"
                                    : "Chuyển trạng thái đơn hàng từ '" + oldStatus + "' sang '" + trimmedStatus + "'";
                            appendStatusHistory(order, trimmedStatus, note, actorName);
                        }
                        if ("Hoàn thành".equalsIgnoreCase(trimmedStatus) || "Hoàn tất".equalsIgnoreCase(trimmedStatus)) {
                        if (order.getCompletedAt() == null || order.getCompletedAt().isBlank()) {
                            order.setCompletedAt(Instant.now().toString());
                        }
                        String actorName = actorOpt.map(User::getName).orElse(body.containsKey("completedBy") && body.get("completedBy") != null ? body.get("completedBy").toString() : "Quản trị viên");
                        order.setCompletedBy(actorName);
                        if (!"PAID".equalsIgnoreCase(trim(order.getPaymentStatus()))) {
                            order.setPaymentStatus("PAID");
                            if (order.getPaidAmount() == null || order.getPaidAmount() <= 0) {
                                order.setPaidAmount(order.getTotal() != null ? order.getTotal() : 0.0);
                            }
                            if (order.getPaidAt() == null || order.getPaidAt().isBlank()) {
                                order.setPaidAt(Instant.now().toString());
                            }
                        }
                    }
                    if (body.containsKey("completedAt") && body.get("completedAt") != null) {
                        order.setCompletedAt(body.get("completedAt").toString());
                    }
                    if (body.containsKey("completedBy") && body.get("completedBy") != null) {
                        order.setCompletedBy(body.get("completedBy").toString());
                    }
                    if ("Đã hủy".equalsIgnoreCase(trimmedStatus)) {
                            restoreStockOnce(order);
                        }
                    }
                    if (body.containsKey("cancelReason") && body.get("cancelReason") != null) {
                        order.setCancelReason(body.get("cancelReason").toString());
                    }
                    if (body.containsKey("cancelledAt") && body.get("cancelledAt") != null) {
                        order.setCancelledAt(body.get("cancelledAt").toString());
                    }
                    if (body.containsKey("cancelledBy") && body.get("cancelledBy") != null) {
                        order.setCancelledBy(body.get("cancelledBy").toString());
                    }
                    if (body.containsKey("statusHistoryJson") && body.get("statusHistoryJson") != null) {
                        order.setStatusHistoryJson(body.get("statusHistoryJson").toString());
                    }
                    if (body.containsKey("paymentStatus") && body.get("paymentStatus") != null) {
                        String reqPayStatus = body.get("paymentStatus").toString().trim().toUpperCase(Locale.ROOT);
                        if ("PAID".equals(reqPayStatus)) {
                            if (isBankTransferOrQr(order.getPaymentMethod())) {
                                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                                        .body(Map.of("error", "Đơn hàng chuyển khoản/QR chỉ được xác nhận tự động sau khi hệ thống SePay đối soát thành công giao dịch ngân hàng."));
                            }
                            if (actorOpt.isPresent() && !rbacService.hasPermission(actorOpt.get(), RbacService.PERM_FINANCE_RECORD_EXPENSE)
                                    && !rbacService.hasPermission(actorOpt.get(), RbacService.PERM_ORDERS_UPDATE_STATUS)) {
                                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                                        .body(Map.of("error", "Bạn không có quyền xác nhận thu tiền cho đơn hàng."));
                            }
                            order.setPaymentStatus("PAID");
                            order.setPaidAmount(order.getTotal() != null ? order.getTotal() : 0.0);
                            order.setPaidAt(Instant.now().toString());
                        }
                    }
                    order.setUpdatedAt(Instant.now().toString());
                    Order saved = orderRepository.save(order);
                    if (saved.getUserId() != null) {
                        recalculateUserSpend(saved.getUserId());
                    }
                    return ResponseEntity.ok(saved);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/cancel-request")
    public ResponseEntity<?> requestCancel(@PathVariable String id, @RequestBody Map<String, Object> body) {
        String userId = body.get("userId") != null ? body.get("userId").toString().trim() : "";
        String reason = body.get("reason") != null ? body.get("reason").toString().trim() : "";
        String requestedBy = body.get("requestedBy") != null ? body.get("requestedBy").toString().trim() : "";

        if (userId.isEmpty()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Bạn cần đăng nhập đúng tài khoản sở hữu đơn hàng để gửi yêu cầu hủy."));
        }
        if (reason.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Vui lòng chọn hoặc nhập lý do yêu cầu hủy đơn."));
        }

        Optional<Order> orderOpt = orderRepository.findById(id);
        if (orderOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Order order = orderOpt.get();

        if (order.getUserId() == null || !order.getUserId().trim().equals(userId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Bạn không có quyền gửi yêu cầu hủy cho đơn hàng này."));
        }

        String currentStatus = trim(order.getStatus());
        if ("Hoàn thành".equalsIgnoreCase(currentStatus) || "Đã hủy".equalsIgnoreCase(currentStatus)) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Đơn hàng đã hoàn tất hoặc đã hủy, không thể gửi yêu cầu hủy mới."));
        }

        if ("PENDING".equalsIgnoreCase(trim(order.getCancelRequestStatus()))) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Đơn hàng đang có yêu cầu hủy chờ nhân viên duyệt."));
        }

        String now = Instant.now().toString();
        String actorLabel = !requestedBy.isEmpty()
                ? requestedBy
                : (!trim(order.getCustomerName()).isEmpty() ? trim(order.getCustomerName()) : "Khách hàng");

        order.setCancelRequestStatus("PENDING");
        order.setCancelRequestReason(reason.length() <= 255 ? reason : reason.substring(0, 255));
        order.setCancelRequestedAt(now);
        order.setCancelRequestedBy(actorLabel);
        order.setCancelReviewedAt(null);
        order.setCancelReviewedBy(null);
        order.setCancelRejectReason(null);
        order.setUpdatedAt(now);
        appendStatusHistory(order, "Yêu cầu hủy đơn", "Khách hàng gửi yêu cầu hủy: " + order.getCancelRequestReason(), actorLabel);

        return ResponseEntity.ok(orderRepository.save(order));
    }

    @PostMapping("/{id}/cancel-review")
    public ResponseEntity<?> reviewCancelRequest(@PathVariable String id, @RequestBody Map<String, Object> body) {
        String actorUserId = body.get("actorUserId") != null ? body.get("actorUserId").toString().trim() : "";
        String decision = body.get("decision") != null ? body.get("decision").toString().trim().toUpperCase(Locale.ROOT) : "";
        String note = body.get("note") != null ? body.get("note").toString().trim() : "";

        Optional<User> actorOpt = findStaffOrAdmin(actorUserId);
        if (actorOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Chỉ quản trị viên hoặc nhân viên có quyền mới được duyệt hoặc từ chối yêu cầu hủy đơn."));
        }
        if (!"APPROVE".equals(decision) && !"REJECT".equals(decision)) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Quyết định duyệt hủy phải là APPROVE hoặc REJECT."));
        }

        Optional<Order> orderOpt = orderRepository.findById(id);
        if (orderOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Order order = orderOpt.get();

        if (!"PENDING".equalsIgnoreCase(trim(order.getCancelRequestStatus()))) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Đơn hàng hiện không có yêu cầu hủy nào đang chờ duyệt."));
        }

        String now = Instant.now().toString();
        User actor = actorOpt.get();
        String actorName = !trim(actor.getName()).isEmpty() ? trim(actor.getName()) : "Quản trị viên";

        if ("APPROVE".equals(decision)) {
            order.setCancelRequestStatus("APPROVED");
            order.setCancelReviewedAt(now);
            order.setCancelReviewedBy(actorName);
            order.setCancelRejectReason(note.isEmpty() ? null : (note.length() <= 255 ? note : note.substring(0, 255)));
            order.setStatus("Đã hủy");
            order.setCancelReason(order.getCancelRequestReason());
            order.setCancelledAt(now);
            order.setCancelledBy(actorName);

            if ("PAID".equalsIgnoreCase(trim(order.getPaymentStatus()))
                    && (order.getRefundStatus() == null || order.getRefundStatus().isBlank())) {
                order.setRefundStatus("PENDING_REFUND");
            }
            restoreStockOnce(order);

            String historyNote = "Duyệt yêu cầu hủy (" + trim(order.getCancelRequestReason()) + ")"
                    + (note.isEmpty() ? "" : " · Ghi chú: " + note);
            appendStatusHistory(order, "Đã hủy", historyNote, actorName);
            order.setUpdatedAt(now);
            Order saved = orderRepository.save(order);
            recalculateUserSpend(saved.getUserId());
            return ResponseEntity.ok(saved);
        }

        String rejectReason = !note.isEmpty()
                ? (note.length() <= 255 ? note : note.substring(0, 255))
                : "Yêu cầu hủy đơn chưa được chấp nhận.";
        order.setCancelRequestStatus("REJECTED");
        order.setCancelReviewedAt(now);
        order.setCancelReviewedBy(actorName);
        order.setCancelRejectReason(rejectReason);
        order.setUpdatedAt(now);
        appendStatusHistory(order, "Từ chối yêu cầu hủy", rejectReason, actorName);
        return ResponseEntity.ok(orderRepository.save(order));
    }

    @PostMapping("/{id}/refund-confirm")
    public ResponseEntity<?> confirmRefund(@PathVariable String id, @RequestBody Map<String, Object> body) {
        String actorUserId = body.get("actorUserId") != null ? body.get("actorUserId").toString().trim() : "";
        String note = body.get("note") != null ? body.get("note").toString().trim() : "";
        Optional<User> actorOpt = findStaffOrAdmin(actorUserId);
        if (actorOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Chỉ quản trị viên hoặc nhân viên mới có quyền xác nhận đã hoàn tiền."));
        }

        Optional<Order> orderOpt = orderRepository.findById(id);
        if (orderOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Order order = orderOpt.get();
        if (!"Đã hủy".equalsIgnoreCase(trim(order.getStatus()))
                || !"PENDING_REFUND".equalsIgnoreCase(trim(order.getRefundStatus()))) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Đơn hàng không ở trạng thái chờ hoàn tiền."));
        }

        String now = Instant.now().toString();
        String actorName = !trim(actorOpt.get().getName()).isEmpty() ? trim(actorOpt.get().getName()) : "Quản trị viên";
        order.setRefundStatus("REFUNDED");
        order.setUpdatedAt(now);
        appendStatusHistory(order, "Đã hoàn tiền",
                note.isEmpty() ? "Đã xác nhận hoàn tiền cho khách hàng." : "Đã xác nhận hoàn tiền: " + note,
                actorName);
        return ResponseEntity.ok(orderRepository.save(order));
    }

    @PostMapping("/{id}/confirm-cod-payment")
    public ResponseEntity<?> confirmCodPayment(
            @PathVariable String id,
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId,
            @RequestBody(required = false) Map<String, Object> body
    ) {
        String actorUserId = body != null && body.get("actorUserId") != null ? body.get("actorUserId").toString().trim() : null;
        User actor = rbacService.requireAnyPermission(
                actorHeaderId,
                actorUserId,
                "Bạn không có quyền xác nhận thu tiền cho đơn hàng.",
                RbacService.PERM_FINANCE_RECORD_EXPENSE,
                RbacService.PERM_ORDERS_UPDATE_STATUS
        );

        Optional<Order> orderOpt = orderRepository.findById(id);
        if (orderOpt.isEmpty()) return ResponseEntity.notFound().build();
        Order order = orderOpt.get();

        if (isBankTransferOrQr(order.getPaymentMethod())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Đơn hàng chuyển khoản/QR chỉ được xác nhận tự động sau khi hệ thống SePay đối soát thành công giao dịch ngân hàng."));
        }

        if ("PAID".equalsIgnoreCase(trim(order.getPaymentStatus()))) {
            return ResponseEntity.ok(order);
        }

        if ("Đã hủy".equalsIgnoreCase(trim(order.getStatus()))) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Không thể ghi nhận thu tiền cho đơn hàng đã bị hủy."));
        }

        String now = Instant.now().toString();
        order.setPaymentStatus("PAID");
        order.setPaidAmount(order.getTotal() != null ? order.getTotal() : 0.0);
        order.setPaidAt(now);
        order.setUpdatedAt(now);
        String amountFormatted = (long) Math.round(order.getTotal() != null ? order.getTotal() : 0.0) + " ₫";
        appendStatusHistory(order, order.getStatus(),
                "Nhân viên " + actor.getName() + " xác nhận đã thu tiền COD (" + amountFormatted + ")",
                actor.getName());

        Order saved = orderRepository.save(order);
        recalculateUserSpend(saved.getUserId());
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(
            @PathVariable String id,
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId
    ) {
        Optional<User> actorOpt = rbacService.resolveOptionalActiveActor(actorHeaderId, null);
        if (actorOpt.isPresent() && !rbacService.isAdmin(actorOpt.get())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Chỉ Quản trị viên mới có quyền xóa đơn hàng."));
        }
        orderRepository.findById(id).ifPresent(o -> {
            String uId = o.getUserId();
            orderRepository.deleteById(id);
            recalculateUserSpend(uId);
        });
        return ResponseEntity.noContent().build();
    }



    private Optional<User> findStaffOrAdmin(String userId) {
        if (userId == null || userId.trim().isEmpty()) return Optional.empty();
        return userRepository.findById(userId.trim())
                .filter(u -> {
                    String role = trim(u.getRole()).toLowerCase(Locale.ROOT);
                    return "admin".equals(role) || "staff".equals(role);
                });
    }

    private boolean isCustomerCancelAttempt(Map<String, Object> body) {
        String actorUserId = body.get("actorUserId") != null ? body.get("actorUserId").toString().trim() : "";
        if (!actorUserId.isEmpty()) {
            return findStaffOrAdmin(actorUserId).isEmpty();
        }
        String cancelledBy = body.get("cancelledBy") != null ? body.get("cancelledBy").toString().trim() : "";
        return "Khách hàng".equalsIgnoreCase(cancelledBy);
    }

    private void restoreStockOnce(Order order) {
        if (Boolean.TRUE.equals(order.getStockRestored())) return;
        if (order.getItemsJson() == null || order.getItemsJson().trim().isEmpty()) {
            order.setStockRestored(true);
            return;
        }
        try {
            JsonNode items = objectMapper.readTree(order.getItemsJson());
            if (items.isArray()) {
                for (JsonNode item : items) {
                    String prodId = item.has("productId") ? item.path("productId").asText() : item.path("id").asText();
                    String variantId = item.has("variantId") && !item.get("variantId").isNull()
                            ? item.path("variantId").asText("").trim() : "";
                    int qty = Math.max(1, item.path("quantity").asInt(1));
                    if (!prodId.isEmpty()) {
                        productRepository.findById(prodId).ifPresent(p -> {
                            int currentSold = p.getSold() != null ? p.getSold() : 0;
                            p.setSold(Math.max(0, currentSold - qty));

                            boolean updatedVariant = false;
                            if (!variantId.isEmpty() && p.getVariantsJson() != null && !p.getVariantsJson().isBlank()) {
                                try {
                                    JsonNode vNode = objectMapper.readTree(p.getVariantsJson());
                                    if (vNode.isArray()) {
                                        ArrayNode arr = (ArrayNode) vNode;
                                        int totalVarStock = 0;
                                        for (JsonNode v : arr) {
                                            if (v.isObject()) {
                                                ObjectNode vo = (ObjectNode) v;
                                                int vs = vo.path("stock").asInt(0);
                                                if (variantId.equals(vo.path("id").asText(""))) {
                                                    vs += qty;
                                                    vo.put("stock", vs);
                                                    vo.put("status", vs == 0 ? "Tạm hết hàng" : (vs <= 15 ? "Sắp hết" : "Còn hàng"));
                                                    updatedVariant = true;
                                                }
                                                totalVarStock += vs;
                                            }
                                        }
                                        if (updatedVariant) {
                                            p.setVariantsJson(objectMapper.writeValueAsString(arr));
                                            p.setStock(totalVarStock);
                                            p.setStatus(totalVarStock == 0 ? "Hết hàng" : (totalVarStock <= 15 ? "Sắp hết" : "Còn hàng"));
                                        }
                                    }
                                } catch (Exception ignored) {}
                            }

                            if (!updatedVariant) {
                                int currentStock = p.getStock() != null ? p.getStock() : 0;
                                int newStock = currentStock + qty;
                                p.setStock(newStock);
                                p.setStatus(newStock == 0 ? "Hết hàng" : (newStock <= 15 ? "Sắp hết" : "Còn hàng"));
                            }
                            productRepository.save(p);
                        });
                    }
                }
            }
        } catch (Exception ignored) {}
        order.setStockRestored(true);
    }

    private void appendStatusHistory(Order order, String status, String note, String by) {
        List<Map<String, Object>> history = new ArrayList<>();
        if (order.getStatusHistoryJson() != null && !order.getStatusHistoryJson().isBlank()) {
            try {
                history = objectMapper.readValue(order.getStatusHistoryJson(), new TypeReference<>() {});
            } catch (Exception ignored) {
                history = new ArrayList<>();
            }
        }
        if (history.isEmpty() && order.getCreatedAt() != null && !order.getCreatedAt().isBlank()) {
            Map<String, Object> init = new LinkedHashMap<>();
            init.put("status", "Chờ xác nhận");
            init.put("timestamp", order.getCreatedAt());
            init.put("note", "Đơn hàng đã được đặt thành công");
            init.put("by", !trim(order.getCustomerName()).isEmpty() ? trim(order.getCustomerName()) : "Khách hàng");
            history.add(init);
        }
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("status", status);
        entry.put("timestamp", Instant.now().toString());
        entry.put("note", note);
        entry.put("by", by);
        history.add(entry);
        try {
            order.setStatusHistoryJson(objectMapper.writeValueAsString(history));
        } catch (Exception ignored) {}
    }

    private static String trim(String value) {
        return value == null ? "" : value.trim();
    }

    private boolean isBankTransferOrQr(String paymentMethod) {
        if (paymentMethod == null || paymentMethod.trim().isEmpty()) return false;
        String normalized = Normalizer.normalize(paymentMethod, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toUpperCase(Locale.ROOT);
        return normalized.contains("QR")
                || normalized.contains("CHUYEN KHOAN")
                || normalized.contains("BANK");
    }

    private boolean isPaymentVerifiedForFulfillment(Order order) {
        if (!isBankTransferOrQr(order.getPaymentMethod())) {
            return true;
        }
        String payStatus = order.getPaymentStatus() != null
                ? order.getPaymentStatus().trim().toUpperCase(Locale.ROOT)
                : "";
        return "PAID".equals(payStatus);
    }

    private String validateOrderStatusTransition(Order order, String newStatus) {
        if (newStatus == null || newStatus.isBlank()) {
            return "Trạng thái mới không được để trống.";
        }
        String currentStatus = order.getStatus() != null ? order.getStatus().trim() : "Chờ xác nhận";
        if (currentStatus.equalsIgnoreCase(newStatus)) {
            return null;
        }
        boolean isFulfillmentAdvance = "Đang xử lý".equalsIgnoreCase(newStatus)
                || "Đang giao".equalsIgnoreCase(newStatus)
                || "Hoàn thành".equalsIgnoreCase(newStatus);
        if (isFulfillmentAdvance && !isPaymentVerifiedForFulfillment(order)) {
            if ("NEEDS_REVIEW".equalsIgnoreCase(order.getPaymentStatus())) {
                return "Đơn chuyển khoản/QR đang cần đối soát giao dịch SePay, chưa thể xác nhận xử lý.";
            }
            return "Đơn chuyển khoản/QR chưa được xác nhận thanh toán qua SePay nên chưa thể xác nhận hoặc xử lý.";
        }
        return null;
    }

    private boolean isValidPaymentReference(String ref) {
        if (ref == null || ref.trim().isEmpty()) return false;
        String prefix = sepayProperties.getPaymentPrefix();
        return Pattern.compile("^" + Pattern.quote(prefix) + "\\d{4,20}$", Pattern.CASE_INSENSITIVE)
                .matcher(ref.trim())
                .matches();
    }

    private String generateUniquePaymentReference() {
        String prefix = sepayProperties.getPaymentPrefix();
        for (int attempt = 0; attempt < 20; attempt++) {
            long timeTail = System.currentTimeMillis() % 1_000_000L;
            int rand = secureRandom.nextInt(90) + 10;
            String candidate = prefix + String.format(Locale.ROOT, "%06d%02d", timeTail, rand);
            if (orderRepository.findByPaymentReferenceIgnoreCase(candidate).isEmpty()) {
                return candidate;
            }
        }
        return prefix + String.valueOf(System.currentTimeMillis());
    }
}
