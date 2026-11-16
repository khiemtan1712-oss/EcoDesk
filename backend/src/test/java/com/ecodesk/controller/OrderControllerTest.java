package com.ecodesk.controller;

import com.ecodesk.config.SepayProperties;
import com.ecodesk.entity.Order;
import com.ecodesk.entity.Product;
import com.ecodesk.entity.User;
import com.ecodesk.repository.OrderRepository;
import com.ecodesk.repository.ProductRepository;
import com.ecodesk.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.lang.reflect.Proxy;
import java.util.*;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class OrderControllerTest {

    private MockMvc buildMvc(Map<String, Order> orderStore) {
        return buildMvc(orderStore, new LinkedHashMap<>(), new LinkedHashMap<>());
    }

    private MockMvc buildMvc(
            Map<String, Order> orderStore,
            Map<String, Product> productStore,
            Map<String, User> userStore
    ) {
        OrderRepository orderRepo = (OrderRepository) Proxy.newProxyInstance(
                OrderRepository.class.getClassLoader(),
                new Class<?>[]{OrderRepository.class},
                (p, m, args) -> switch (m.getName()) {
                    case "findById" -> Optional.ofNullable(orderStore.get((String) args[0]));
                    case "findByPaymentReferenceIgnoreCase" -> orderStore.values().stream()
                            .filter(o -> o.getPaymentReference() != null
                                    && o.getPaymentReference().equalsIgnoreCase((String) args[0]))
                            .findFirst();
                    case "findByUserIdOrderByCreatedAtDesc" -> orderStore.values().stream()
                            .filter(o -> Objects.equals(o.getUserId(), args[0]))
                            .toList();
                    case "findAllByOrderByCreatedAtDesc" -> new ArrayList<>(orderStore.values());
                    case "save" -> {
                        Order o = (Order) args[0];
                        orderStore.put(o.getId(), o);
                        yield o;
                    }
                    default -> null;
                }
        );

        ProductRepository productRepo = (ProductRepository) Proxy.newProxyInstance(
                ProductRepository.class.getClassLoader(),
                new Class<?>[]{ProductRepository.class},
                (p, m, args) -> switch (m.getName()) {
                    case "findById" -> Optional.ofNullable(productStore.get((String) args[0]));
                    case "save" -> {
                        Product prod = (Product) args[0];
                        productStore.put(prod.getId(), prod);
                        yield prod;
                    }
                    default -> Optional.empty();
                }
        );

        UserRepository userRepo = (UserRepository) Proxy.newProxyInstance(
                UserRepository.class.getClassLoader(),
                new Class<?>[]{UserRepository.class},
                (p, m, args) -> switch (m.getName()) {
                    case "findById" -> Optional.ofNullable(userStore.get((String) args[0]));
                    default -> Optional.empty();
                }
        );

        SepayProperties props = new SepayProperties(
                "", "live", "v2", "", "MB", "MB Bank", "0123456789", "ECODESK", "DH", true, 15000L, 1
        );
        OrderController controller = new OrderController(orderRepo, productRepo, userRepo, props);
        return MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    void qrOrderCreation_forcesUnpaidAndPendingConfirmation() throws Exception {
        Map<String, Order> store = new LinkedHashMap<>();
        MockMvc mvc = buildMvc(store);

        mvc.perform(post("/api/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "id": "ORD-QR-1",
                                  "userId": "U1",
                                  "paymentMethod": "Chuyển khoản QR (VietQR / Napas 247)",
                                  "paymentStatus": "PAID",
                                  "status": "Đang xử lý",
                                  "total": 690000
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("Chờ xác nhận"))
                .andExpect(jsonPath("$.paymentStatus").value("UNPAID"));

        Order saved = store.get("ORD-QR-1");
        assertNotNull(saved.getPaymentReference());
        assertEquals("UNPAID", saved.getPaymentStatus());
        assertEquals("Chờ xác nhận", saved.getStatus());
    }

    @Test
    void unpaidQrOrder_cannotBeConfirmedOrProcessedViaPatchOrPut_butCanBeCancelled() throws Exception {
        Map<String, Order> store = new LinkedHashMap<>();
        Order qrOrder = new Order();
        qrOrder.setId("ORD-QR-2");
        qrOrder.setPaymentMethod("Chuyển khoản QR (VietQR / Napas 247)");
        qrOrder.setPaymentStatus("UNPAID");
        qrOrder.setPaymentReference("DH123456");
        qrOrder.setStatus("Chờ xác nhận");
        qrOrder.setTotal(500000.0);
        store.put(qrOrder.getId(), qrOrder);

        MockMvc mvc = buildMvc(store);

        mvc.perform(patch("/api/orders/ORD-QR-2/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status":"Đang xử lý"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").exists());

        mvc.perform(put("/api/orders/ORD-QR-2")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status":"Đang xử lý"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").exists());

        assertEquals("Chờ xác nhận", store.get("ORD-QR-2").getStatus());

        // Cancelling unpaid QR order remains allowed
        mvc.perform(patch("/api/orders/ORD-QR-2/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status":"Đã hủy","cancelReason":"Khách đổi ý"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("Đã hủy"));
    }

    @Test
    void paidQrOrder_andCodOrder_canBeConfirmedToProcessing() throws Exception {
        Map<String, Order> store = new LinkedHashMap<>();

        Order paidQr = new Order();
        paidQr.setId("ORD-QR-PAID");
        paidQr.setPaymentMethod("Chuyển khoản QR (VietQR / Napas 247)");
        paidQr.setPaymentStatus("PAID");
        paidQr.setPaymentReference("DH998877");
        paidQr.setStatus("Chờ xác nhận");
        paidQr.setTotal(720000.0);
        store.put(paidQr.getId(), paidQr);

        Order cod = new Order();
        cod.setId("ORD-COD-1");
        cod.setPaymentMethod("Thanh toán khi nhận hàng (COD)");
        cod.setPaymentStatus("COD");
        cod.setStatus("Chờ xác nhận");
        cod.setTotal(720000.0);
        store.put(cod.getId(), cod);

        MockMvc mvc = buildMvc(store);

        mvc.perform(patch("/api/orders/ORD-QR-PAID/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status":"Đang xử lý"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("Đang xử lý"));

        mvc.perform(patch("/api/orders/ORD-COD-1/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status":"Đang xử lý"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("Đang xử lý"));
    }

    @Test
    void cancelRequest_preservesStatusAndRejectsInvalidOrUnauthorized() throws Exception {
        Map<String, Order> store = new LinkedHashMap<>();
        Order order = new Order();
        order.setId("ORD-REQ-1");
        order.setUserId("U-OWNER");
        order.setPaymentMethod("Chuyển khoản QR (VietQR / Napas 247)");
        order.setPaymentStatus("UNPAID");
        order.setStatus("Chờ xác nhận");
        order.setTotal(500000.0);
        store.put(order.getId(), order);

        Order doneOrder = new Order();
        doneOrder.setId("ORD-DONE-1");
        doneOrder.setUserId("U-OWNER");
        doneOrder.setStatus("Hoàn thành");
        doneOrder.setTotal(500000.0);
        store.put(doneOrder.getId(), doneOrder);

        MockMvc mvc = buildMvc(store);

        // Non-owner cannot submit cancel request
        mvc.perform(post("/api/orders/ORD-REQ-1/cancel-request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"userId":"U-OTHER","reason":"Đặt nhầm sản phẩm / số lượng"}
                                """))
                .andExpect(status().isForbidden());

        // Owner submits cancel request: keeps original status & paymentStatus
        mvc.perform(post("/api/orders/ORD-REQ-1/cancel-request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"userId":"U-OWNER","reason":"Đặt nhầm sản phẩm / số lượng"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cancelRequestStatus").value("PENDING"))
                .andExpect(jsonPath("$.status").value("Chờ xác nhận"))
                .andExpect(jsonPath("$.paymentStatus").value("UNPAID"))
                .andExpect(jsonPath("$.cancelRequestReason").value("Đặt nhầm sản phẩm / số lượng"));

        // Duplicate while PENDING -> 409
        mvc.perform(post("/api/orders/ORD-REQ-1/cancel-request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"userId":"U-OWNER","reason":"Lý do khác: muốn đổi"}
                                """))
                .andExpect(status().isConflict());

        // Completed order -> 409
        mvc.perform(post("/api/orders/ORD-DONE-1/cancel-request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"userId":"U-OWNER","reason":"Đặt nhầm"}
                                """))
                .andExpect(status().isConflict());
    }

    @Test
    void customerDirectCancel_isBlockedWith403() throws Exception {
        Map<String, Order> store = new LinkedHashMap<>();
        Map<String, User> users = new LinkedHashMap<>();
        User customer = new User();
        customer.setId("U-CUST");
        customer.setName("Khách");
        customer.setRole("customer");
        users.put(customer.getId(), customer);

        Order order = new Order();
        order.setId("ORD-BLK-1");
        order.setUserId("U-CUST");
        order.setStatus("Chờ xác nhận");
        order.setPaymentStatus("COD");
        order.setTotal(300000.0);
        store.put(order.getId(), order);

        MockMvc mvc = buildMvc(store, new LinkedHashMap<>(), users);

        mvc.perform(patch("/api/orders/ORD-BLK-1/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status":"Đã hủy","actorUserId":"U-CUST"}
                                """))
                .andExpect(status().isForbidden());

        mvc.perform(put("/api/orders/ORD-BLK-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status":"Đã hủy","userId":"U-CUST"}
                                """))
                .andExpect(status().isForbidden());

        assertEquals("Chờ xác nhận", store.get("ORD-BLK-1").getStatus());
    }

    @Test
    void cancelReview_rejectAndApproveWithStockRestoreOnceAndPaidRefundPending() throws Exception {
        Map<String, Order> store = new LinkedHashMap<>();
        Map<String, Product> products = new LinkedHashMap<>();
        Map<String, User> users = new LinkedHashMap<>();

        User customer = new User();
        customer.setId("U-CUST");
        customer.setName("Khách");
        customer.setRole("customer");
        users.put(customer.getId(), customer);

        User admin = new User();
        admin.setId("U-ADMIN");
        admin.setName("Quản trị");
        admin.setRole("admin");
        users.put(admin.getId(), admin);

        Product prod = new Product();
        prod.setId("P001");
        prod.setName("Bàn nâng hạ");
        prod.setStock(5);
        prod.setSold(3);
        prod.setStatus("Còn hàng");
        prod.setVariantsJson("[{\"name\":\"Trắng\",\"stock\":5}]");
        products.put(prod.getId(), prod);

        Order order = new Order();
        order.setId("ORD-REV-1");
        order.setUserId("U-CUST");
        order.setStatus("Đang xử lý");
        order.setPaymentMethod("Chuyển khoản QR (VietQR / Napas 247)");
        order.setPaymentStatus("PAID");
        order.setTotal(1200000.0);
        order.setItemsJson("[{\"productId\":\"P001\",\"name\":\"Bàn nâng hạ\",\"variant\":\"Trắng\",\"quantity\":2,\"unitPrice\":600000}]");
        order.setCancelRequestStatus("PENDING");
        order.setCancelRequestReason("Muốn đổi sản phẩm / thông tin nhận hàng");
        store.put(order.getId(), order);

        MockMvc mvc = buildMvc(store, products, users);

        // Non-admin cannot review
        mvc.perform(post("/api/orders/ORD-REV-1/cancel-review")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"actorUserId":"U-CUST","decision":"APPROVE"}
                                """))
                .andExpect(status().isForbidden());

        // Reject keeps prior status and stock untouched
        mvc.perform(post("/api/orders/ORD-REV-1/cancel-review")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"actorUserId":"U-ADMIN","decision":"REJECT","note":"Đơn đang giao rồi"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cancelRequestStatus").value("REJECTED"))
                .andExpect(jsonPath("$.status").value("Đang xử lý"))
                .andExpect(jsonPath("$.cancelRejectReason").value("Đơn đang giao rồi"));
        assertEquals(5, products.get("P001").getStock());

        // Customer re-requests and admin approves -> Đã hủy, PENDING_REFUND, stock restored once
        mvc.perform(post("/api/orders/ORD-REV-1/cancel-request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"userId":"U-CUST","reason":"Lý do khác: không nhận được hàng"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cancelRequestStatus").value("PENDING"));

        mvc.perform(post("/api/orders/ORD-REV-1/cancel-review")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"actorUserId":"U-ADMIN","decision":"APPROVE"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("Đã hủy"))
                .andExpect(jsonPath("$.cancelRequestStatus").value("APPROVED"))
                .andExpect(jsonPath("$.refundStatus").value("PENDING_REFUND"))
                .andExpect(jsonPath("$.stockRestored").value(true));

        assertEquals(7, products.get("P001").getStock());
        assertEquals(1, products.get("P001").getSold());

        // Confirm refund -> REFUNDED
        mvc.perform(post("/api/orders/ORD-REV-1/refund-confirm")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"actorUserId":"U-ADMIN","note":"Đã chuyển khoản hoàn"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.refundStatus").value("REFUNDED"));
    }
}
