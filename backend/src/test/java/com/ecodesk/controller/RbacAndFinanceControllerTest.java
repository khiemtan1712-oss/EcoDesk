package com.ecodesk.controller;

import com.ecodesk.config.SepayProperties;
import com.ecodesk.entity.*;
import com.ecodesk.repository.*;
import com.ecodesk.service.*;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class RbacAndFinanceControllerTest {

    private static class TestEnv {
        final Map<String, User> users = new LinkedHashMap<>();
        final Map<String, Order> orders = new LinkedHashMap<>();
        final Map<String, Product> products = new LinkedHashMap<>();
        final Map<String, FinancialTransaction> finTxs = new LinkedHashMap<>();
        final Map<Long, FinancialAuditLog> auditLogs = new LinkedHashMap<>();
        final Map<String, PurchaseOrder> purchases = new LinkedHashMap<>();
        final Map<String, PayrollRecord> payrolls = new LinkedHashMap<>();
        final Map<String, InventoryMovement> movements = new LinkedHashMap<>();
        final Map<Long, SepayTransactionLog> sepayLogs = new LinkedHashMap<>();
        final AtomicLong auditSeq = new AtomicLong(1);
        final AtomicLong sepaySeq = new AtomicLong(1);

        final UserRepository userRepo;
        final OrderRepository orderRepo;
        final ProductRepository productRepo;
        final FinancialTransactionRepository txRepo;
        final FinancialAuditLogRepository auditRepo;
        final PurchaseOrderRepository poRepo;
        final PayrollRecordRepository payrollRepo;
        final InventoryMovementRepository movementRepo;
        final SepayTransactionLogRepository sepayRepo;
        final RbacService rbacService;
        final PasswordHashService hashService = new PasswordHashService();
        final MockMvc mvc;

        TestEnv() {
            userRepo = (UserRepository) Proxy.newProxyInstance(
                    UserRepository.class.getClassLoader(),
                    new Class<?>[]{UserRepository.class},
                    (p, m, args) -> switch (m.getName()) {
                        case "findAll" -> new ArrayList<>(users.values());
                        case "findById" -> Optional.ofNullable(users.get((String) args[0]));
                        case "findByEmail" -> users.values().stream()
                                .filter(u -> u.getEmail() != null && u.getEmail().equalsIgnoreCase((String) args[0]))
                                .findFirst();
                        case "existsByEmail" -> users.values().stream()
                                .anyMatch(u -> u.getEmail() != null && u.getEmail().equalsIgnoreCase((String) args[0]));
                        case "save" -> {
                            User u = (User) args[0];
                            users.put(u.getId(), u);
                            yield u;
                        }
                        default -> null;
                    }
            );
            orderRepo = (OrderRepository) Proxy.newProxyInstance(
                    OrderRepository.class.getClassLoader(),
                    new Class<?>[]{OrderRepository.class},
                    (p, m, args) -> switch (m.getName()) {
                        case "findAll", "findAllByOrderByCreatedAtDesc" -> new ArrayList<>(orders.values());
                        case "findById" -> Optional.ofNullable(orders.get((String) args[0]));
                        case "findByPaymentReferenceIgnoreCase" -> orders.values().stream()
                                .filter(o -> o.getPaymentReference() != null && o.getPaymentReference().equalsIgnoreCase((String) args[0]))
                                .findFirst();
                        case "existsBySepayTransactionId" -> orders.values().stream()
                                .anyMatch(o -> o.getSepayTransactionId() != null && o.getSepayTransactionId().equals(args[0]));
                        case "save" -> {
                            Order o = (Order) args[0];
                            orders.put(o.getId(), o);
                            yield o;
                        }
                        default -> null;
                    }
            );
            productRepo = (ProductRepository) Proxy.newProxyInstance(
                    ProductRepository.class.getClassLoader(),
                    new Class<?>[]{ProductRepository.class},
                    (p, m, args) -> switch (m.getName()) {
                        case "findAll" -> new ArrayList<>(products.values());
                        case "findById" -> Optional.ofNullable(products.get((String) args[0]));
                        case "existsById" -> products.containsKey((String) args[0]);
                        case "save" -> {
                            Product prod = (Product) args[0];
                            products.put(prod.getId(), prod);
                            yield prod;
                        }
                        default -> null;
                    }
            );
            txRepo = (FinancialTransactionRepository) Proxy.newProxyInstance(
                    FinancialTransactionRepository.class.getClassLoader(),
                    new Class<?>[]{FinancialTransactionRepository.class},
                    (p, m, args) -> switch (m.getName()) {
                        case "findAllByOrderByTxDateDescCreatedAtDesc" -> new ArrayList<>(finTxs.values());
                        case "findById" -> Optional.ofNullable(finTxs.get((String) args[0]));
                        case "findByPayrollId" -> finTxs.values().stream()
                                .filter(t -> Objects.equals(t.getPayrollId(), args[0]))
                                .findFirst();
                        case "save" -> {
                            FinancialTransaction t = (FinancialTransaction) args[0];
                            finTxs.put(t.getId(), t);
                            yield t;
                        }
                        default -> null;
                    }
            );
            auditRepo = (FinancialAuditLogRepository) Proxy.newProxyInstance(
                    FinancialAuditLogRepository.class.getClassLoader(),
                    new Class<?>[]{FinancialAuditLogRepository.class},
                    (p, m, args) -> switch (m.getName()) {
                        case "findTop100ByOrderByIdDesc" -> new ArrayList<>(auditLogs.values());
                        case "save" -> {
                            FinancialAuditLog l = (FinancialAuditLog) args[0];
                            if (l.getId() == null) l.setId(auditSeq.getAndIncrement());
                            auditLogs.put(l.getId(), l);
                            yield l;
                        }
                        default -> null;
                    }
            );
            poRepo = (PurchaseOrderRepository) Proxy.newProxyInstance(
                    PurchaseOrderRepository.class.getClassLoader(),
                    new Class<?>[]{PurchaseOrderRepository.class},
                    (p, m, args) -> switch (m.getName()) {
                        case "findAllByOrderByPurchaseDateDescCreatedAtDesc" -> new ArrayList<>(purchases.values());
                        case "findById" -> Optional.ofNullable(purchases.get((String) args[0]));
                        case "save" -> {
                            PurchaseOrder po = (PurchaseOrder) args[0];
                            purchases.put(po.getId(), po);
                            yield po;
                        }
                        default -> null;
                    }
            );
            payrollRepo = (PayrollRecordRepository) Proxy.newProxyInstance(
                    PayrollRecordRepository.class.getClassLoader(),
                    new Class<?>[]{PayrollRecordRepository.class},
                    (p, m, args) -> switch (m.getName()) {
                        case "findAllByOrderByPeriodMonthDescCreatedAtDesc" -> new ArrayList<>(payrolls.values());
                        case "findById" -> Optional.ofNullable(payrolls.get((String) args[0]));
                        case "save" -> {
                            PayrollRecord pr = (PayrollRecord) args[0];
                            payrolls.put(pr.getId(), pr);
                            yield pr;
                        }
                        default -> null;
                    }
            );
            sepayRepo = (SepayTransactionLogRepository) Proxy.newProxyInstance(
                    SepayTransactionLogRepository.class.getClassLoader(),
                    new Class<?>[]{SepayTransactionLogRepository.class},
                    (p, m, args) -> switch (m.getName()) {
                        case "findTop50ByOrderByIdDesc" -> new ArrayList<>(sepayLogs.values());
                        case "existsBySepayTransactionId" -> sepayLogs.values().stream()
                                .anyMatch(l -> Objects.equals(l.getSepayTransactionId(), args[0]));
                        case "save" -> {
                            SepayTransactionLog l = (SepayTransactionLog) args[0];
                            if (l.getId() == null) l.setId(sepaySeq.getAndIncrement());
                            sepayLogs.put(l.getId(), l);
                            yield l;
                        }
                        default -> null;
                    }
            );

            movementRepo = (InventoryMovementRepository) Proxy.newProxyInstance(
                    InventoryMovementRepository.class.getClassLoader(),
                    new Class<?>[]{InventoryMovementRepository.class},
                    (p, m, args) -> switch (m.getName()) {
                        case "findAllByOrderByCreatedAtDesc" -> new ArrayList<>(movements.values());
                        case "findByProductIdOrderByCreatedAtDesc" -> movements.values().stream()
                                .filter(x -> Objects.equals(x.getProductId(), args[0]))
                                .toList();
                        case "save" -> {
                            InventoryMovement mov = (InventoryMovement) args[0];
                            if (mov.getId() == null) mov.setId("MOV-" + System.currentTimeMillis() + "-" + movements.size());
                            movements.put(mov.getId(), mov);
                            yield mov;
                        }
                        default -> null;
                    }
            );

            rbacService = new RbacService(userRepo);
            SepayProperties sepayProps = new SepayProperties("", "live", "v2", "", "MB", "MB Bank", "0123456789", "ECODESK", "DH", true, 15000L, 1);

            UserController userController = new UserController(userRepo, hashService, new DisposableEmailPolicy(), rbacService);
            ProductController productController = new ProductController(productRepo, rbacService);
            OrderController orderController = new OrderController(orderRepo, productRepo, userRepo, sepayProps, rbacService);
            FinanceController financeController = new FinanceController(orderRepo, productRepo, userRepo, sepayRepo, txRepo, auditRepo, poRepo, payrollRepo, movementRepo, rbacService);

            mvc = MockMvcBuilders.standaloneSetup(userController, productController, orderController, financeController).build();
        }
    }

    @Test
    void duplicateAdminHiddenAndDisabledUserBlocked() throws Exception {
        TestEnv env = new TestEnv();

        User primaryAdmin = new User();
        primaryAdmin.setId("U_ADMIN");
        primaryAdmin.setName("Admin Chính");
        primaryAdmin.setEmail("admin@ecodesk.vn");
        primaryAdmin.setPassword(env.hashService.hash("admin"));
        primaryAdmin.setRole("admin");
        primaryAdmin.setActive(true);
        env.users.put(primaryAdmin.getId(), primaryAdmin);

        User dupAdmin = new User();
        dupAdmin.setId("U_ADMIN_01");
        dupAdmin.setName("Admin Trùng");
        dupAdmin.setEmail("dup@ecodesk.vn");
        dupAdmin.setPassword(env.hashService.hash("admin"));
        dupAdmin.setRole("admin");
        dupAdmin.setHidden(true);
        dupAdmin.setActive(false);
        env.users.put(dupAdmin.getId(), dupAdmin);

        User disabledStaff = new User();
        disabledStaff.setId("U_DISABLED");
        disabledStaff.setName("Nhân viên nghỉ việc");
        disabledStaff.setEmail("disabled@ecodesk.vn");
        disabledStaff.setPassword(env.hashService.hash("Secret@123"));
        disabledStaff.setRole("staff");
        disabledStaff.setActive(false);
        env.users.put(disabledStaff.getId(), disabledStaff);

        // GET /api/users omits U_ADMIN_01 and keeps U_ADMIN
        env.mvc.perform(get("/api/users").header(RbacService.HEADER_USER_ID, "U_ADMIN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", hasItem("U_ADMIN")))
                .andExpect(jsonPath("$[*].id", not(hasItem("U_ADMIN_01"))));

        // Disabled user blocked at login and when calling API
        env.mvc.perform(post("/api/users/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"disabled@ecodesk.vn","password":"Secret@123"}
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_DISABLED"));

        env.mvc.perform(get("/api/finance/summary").header(RbacService.HEADER_USER_ID, "U_DISABLED"))
                .andExpect(status().isForbidden());
    }

    @Test
    void customerAndCashierRbacBoundariesEnforcedOnBackend() throws Exception {
        TestEnv env = new TestEnv();

        User admin = new User();
        admin.setId("U_ADMIN");
        admin.setName("Admin");
        admin.setEmail("admin@ecodesk.vn");
        admin.setPassword("x");
        admin.setRole("admin");
        env.users.put(admin.getId(), admin);

        User customer = new User();
        customer.setId("U_CUST");
        customer.setName("Khách");
        customer.setEmail("cust@ecodesk.vn");
        customer.setPassword("x");
        customer.setRole("customer");
        env.users.put(customer.getId(), customer);

        User cashier = new User();
        cashier.setId("U_CASHIER");
        cashier.setName("Thu ngân");
        cashier.setEmail("cashier@ecodesk.vn");
        cashier.setPassword("x");
        cashier.setRole("cashier");
        env.users.put(cashier.getId(), cashier);

        Product prod = new Product();
        prod.setId("P001");
        prod.setName("Bàn EcoDesk");
        prod.setPrice(2000000.0);
        prod.setStock(5);
        env.products.put(prod.getId(), prod);

        Order ord = new Order();
        ord.setId("ORD-1");
        ord.setUserId("U_CUST");
        ord.setStatus("Chờ xác nhận");
        ord.setPaymentStatus("UNPAID");
        ord.setTotal(2000000.0);
        env.orders.put(ord.getId(), ord);

        // Customer blocked from admin/finance/product/users APIs
        env.mvc.perform(get("/api/users").header(RbacService.HEADER_USER_ID, "U_CUST")).andExpect(status().isForbidden());
        env.mvc.perform(get("/api/finance/summary").header(RbacService.HEADER_USER_ID, "U_CUST")).andExpect(status().isForbidden());
        env.mvc.perform(get("/api/orders").header(RbacService.HEADER_USER_ID, "U_CUST")).andExpect(status().isForbidden());
        env.mvc.perform(delete("/api/orders/ORD-1").header(RbacService.HEADER_USER_ID, "U_CUST")).andExpect(status().isForbidden());

        // Cashier can view finance summary & record operating expense, but CANNOT manage roles/products/orders/payrolls
        env.mvc.perform(get("/api/finance/summary").header(RbacService.HEADER_USER_ID, "U_CASHIER"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.payrollRestricted").value(true));

        env.mvc.perform(get("/api/finance/payrolls").header(RbacService.HEADER_USER_ID, "U_CASHIER"))
                .andExpect(status().isForbidden());

        env.mvc.perform(put("/api/users/U_CASHIER")
                        .header(RbacService.HEADER_USER_ID, "U_CASHIER")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"role":"admin"}
                                """))
                .andExpect(status().isForbidden());

        env.mvc.perform(put("/api/products/P001")
                        .header(RbacService.HEADER_USER_ID, "U_CASHIER")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"price":1000}
                                """))
                .andExpect(status().isForbidden());

        env.mvc.perform(patch("/api/orders/ORD-1/status")
                        .header(RbacService.HEADER_USER_ID, "U_CASHIER")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status":"Đang xử lý"}
                                """))
                .andExpect(status().isForbidden());

        env.mvc.perform(delete("/api/orders/ORD-1").header(RbacService.HEADER_USER_ID, "U_CASHIER"))
                .andExpect(status().isForbidden());

        // Cashier creates, edits (logged in audit), reconciles, then cannot edit reconciled tx
        env.mvc.perform(post("/api/finance/transactions")
                        .header(RbacService.HEADER_USER_ID, "U_CASHIER")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"txType":"EXPENSE_OPERATING","category":"Tiền điện","txDate":"2026-11-12","amount":500000,"paymentMethod":"Tiền mặt"}
                                """))
                .andExpect(status().isCreated());

        String txId = env.finTxs.keySet().iterator().next();
        env.mvc.perform(put("/api/finance/transactions/" + txId)
                        .header(RbacService.HEADER_USER_ID, "U_CASHIER")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"amount":550000,"note":"Sửa theo hóa đơn"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.amount").value(550000.0));
        assertTrue(env.auditLogs.values().stream().anyMatch(l -> "UPDATE".equals(l.getAction())));

        env.mvc.perform(post("/api/finance/transactions/" + txId + "/reconcile")
                        .header(RbacService.HEADER_USER_ID, "U_CASHIER"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reconciled").value(true));

        env.mvc.perform(put("/api/finance/transactions/" + txId)
                        .header(RbacService.HEADER_USER_ID, "U_CASHIER")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"amount":999000}
                                """))
                .andExpect(status().isConflict());
    }

    @Test
    void financeSummary_handlesUnpaidQrDuplicateSepayAndMissingCostSafely() throws Exception {
        TestEnv env = new TestEnv();

        User admin = new User();
        admin.setId("U_ADMIN");
        admin.setName("Admin");
        admin.setEmail("admin@ecodesk.vn");
        admin.setPassword("x");
        admin.setRole("admin");
        env.users.put(admin.getId(), admin);

        Product noCostProd = new Product();
        noCostProd.setId("P001");
        noCostProd.setName("Ghế không có giá vốn");
        noCostProd.setPrice(1000000.0);
        noCostProd.setStock(10);
        env.products.put(noCostProd.getId(), noCostProd);

        // Unpaid QR order must NOT count into collectedCash
        Order unpaidQr = new Order();
        unpaidQr.setId("ORD-UNPAID-QR");
        unpaidQr.setStatus("Chờ xác nhận");
        unpaidQr.setPaymentMethod("Chuyển khoản QR");
        unpaidQr.setPaymentStatus("UNPAID");
        unpaidQr.setTotal(1000000.0);
        unpaidQr.setCreatedAt("2026-11-12T08:00:00Z");
        env.orders.put(unpaidQr.getId(), unpaidQr);

        // Completed & PAID order without costPrice -> grossProfitStatus must be INSUFFICIENT_DATA
        Order paidCompleted = new Order();
        paidCompleted.setId("ORD-PAID-1");
        paidCompleted.setStatus("Hoàn thành");
        paidCompleted.setPaymentMethod("Chuyển khoản QR");
        paidCompleted.setPaymentStatus("UNPAID");
        paidCompleted.setPaymentReference("DH111222");
        paidCompleted.setTotal(1000000.0);
        paidCompleted.setCreatedAt("2026-11-12T09:00:00Z");
        paidCompleted.setItemsJson("[{\"productId\":\"P001\",\"name\":\"Ghế\",\"quantity\":1,\"unitPrice\":1000000}]");
        env.orders.put(paidCompleted.getId(), paidCompleted);

        // Simulate duplicate SePay tx delivery -> only counted once
        SepayProperties props = new SepayProperties("tok", "live", "v2", "", "MB", "MB Bank", "0123456789", "ECODESK", "DH", true, 15000L, 1);
        SepayTransactionProcessor processor = new SepayTransactionProcessor(env.orderRepo, env.sepayRepo, props);
        SepayTransactionProcessor.SepayTxRecord tx = new SepayTransactionProcessor.SepayTxRecord(
                "tx-dup-1", "2026-11-12 09:05:00", "0123456789", null, "in",
                new BigDecimal("1000000"), BigDecimal.ZERO, "DH111222", "FT1", null, "MB"
        );
        assertEquals(SepayTransactionProcessor.ProcessOutcome.MATCHED_PAID, processor.process(tx));
        assertEquals(SepayTransactionProcessor.ProcessOutcome.SKIPPED_DUPLICATE, processor.process(tx));

        env.mvc.perform(get("/api/finance/summary")
                        .header(RbacService.HEADER_USER_ID, "U_ADMIN")
                        .param("from", "2026-11-12")
                        .param("to", "2026-11-12"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.collectedCash").value(1000000.0))
                .andExpect(jsonPath("$.pendingReceivable").value(1000000.0))
                .andExpect(jsonPath("$.completedOrderSales").value(1000000.0))
                .andExpect(jsonPath("$.grossProfitStatus").value("INSUFFICIENT_DATA"))
                .andExpect(jsonPath("$.grossProfit").value(nullValue()))
                .andExpect(jsonPath("$.missingCostItemsCount").value(1));
    }

    @Test
    void purchaseOrderLifecycleAndInventorySync() throws Exception {
        TestEnv env = new TestEnv();

        User admin = new User();
        admin.setId("U_ADMIN");
        admin.setName("Admin Hệ Thống");
        admin.setEmail("admin@ecodesk.vn");
        admin.setRole("admin");
        admin.setActive(true);
        env.users.put(admin.getId(), admin);

        User customer = new User();
        customer.setId("U_CUST_01");
        customer.setName("Khách Hàng");
        customer.setEmail("cust@example.com");
        customer.setRole("customer");
        customer.setActive(true);
        env.users.put(customer.getId(), customer);

        Product prod = new Product();
        prod.setId("P_TEST_INV");
        prod.setName("Bàn Làm Việc Thông Minh");
        prod.setPrice(1000000.0);
        prod.setCostPrice(200000.0);
        prod.setStock(10);
        env.products.put(prod.getId(), prod);

        // 1. Customer cannot create purchase or adjust inventory -> 403
        env.mvc.perform(post("/api/finance/purchases")
                        .header(RbacService.HEADER_USER_ID, "U_CUST_01")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"supplierName\":\"NCC A\",\"productId\":\"P_TEST_INV\",\"quantity\":5,\"unitCost\":250000}"))
                .andExpect(status().isForbidden());

        env.mvc.perform(post("/api/finance/inventory/adjust")
                        .header(RbacService.HEADER_USER_ID, "U_CUST_01")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"P_TEST_INV\",\"newStock\":15,\"reason\":\"Kiểm kê\"}"))
                .andExpect(status().isForbidden());

        // 2. Admin creates DRAFT purchase order: 10 units @ 300,000 = 3,000,000. Partial paid 1,000,000.
        String createDraftJson = """
            {
              "supplierName": "Nội Thất Govi",
              "purchaseDate": "2026-11-15",
              "receivedStatus": "DRAFT",
              "paidAmount": 1000000,
              "items": [
                {
                  "productId": "P_TEST_INV",
                  "productName": "Bàn Làm Việc Thông Minh",
                  "quantity": 10,
                  "unitCost": 300000,
                  "discount": 0
                }
              ]
            }
            """;

        String resDraft = env.mvc.perform(post("/api/finance/purchases")
                        .header(RbacService.HEADER_USER_ID, "U_ADMIN")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createDraftJson))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.receivedStatus").value("DRAFT"))
                .andExpect(jsonPath("$.totalAmount").value(3000000.0))
                .andExpect(jsonPath("$.paidAmount").value(1000000.0))
                .andExpect(jsonPath("$.debtAmount").value(2000000.0))
                .andExpect(jsonPath("$.paymentStatus").value("PARTIALLY_PAID"))
                .andReturn().getResponse().getContentAsString();

        String poId = env.purchases.keySet().iterator().next();

        // Draft must NOT change stock or cost price yet
        assertEquals(10, env.products.get("P_TEST_INV").getStock());
        assertEquals(200000.0, env.products.get("P_TEST_INV").getCostPrice());
        assertEquals(0, env.movements.size());
        // Real paid cash outflow must be recorded
        assertEquals(1, env.finTxs.size());
        assertEquals(1000000.0, env.finTxs.values().iterator().next().getAmount());

        // 3. Confirm receipt (DRAFT -> RECEIVED)
        env.mvc.perform(post("/api/finance/purchases/" + poId + "/receive")
                        .header(RbacService.HEADER_USER_ID, "U_ADMIN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.receivedStatus").value("RECEIVED"));

        // Stock updated: 10 + 10 = 20. Weighted Average Cost: (10*200k + 10*300k)/20 = 250,000
        assertEquals(20, env.products.get("P_TEST_INV").getStock());
        assertEquals(250000.0, env.products.get("P_TEST_INV").getCostPrice());
        assertEquals(1, env.movements.size());
        InventoryMovement receiptMov = env.movements.values().iterator().next();
        assertEquals("PURCHASE_RECEIPT", receiptMov.getMovementType());
        assertEquals(10, receiptMov.getQuantityChange());
        assertEquals(20, receiptMov.getNewStock());

        // 4. Idempotency guard: Receive second time must return 409 Conflict
        env.mvc.perform(post("/api/finance/purchases/" + poId + "/receive")
                        .header(RbacService.HEADER_USER_ID, "U_ADMIN"))
                .andExpect(status().isConflict());

        // 5. Pay remaining debt (2,000,000)
        // Overpaying rejected
        env.mvc.perform(post("/api/finance/purchases/" + poId + "/pay")
                        .header(RbacService.HEADER_USER_ID, "U_ADMIN")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":2500000}"))
                .andExpect(status().isBadRequest());

        // Exact debt payment
        env.mvc.perform(post("/api/finance/purchases/" + poId + "/pay")
                        .header(RbacService.HEADER_USER_ID, "U_ADMIN")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"amount\":2000000,\"paymentMethod\":\"Chuyển khoản\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paidAmount").value(3000000.0))
                .andExpect(jsonPath("$.debtAmount").value(0.0))
                .andExpect(jsonPath("$.paymentStatus").value("PAID"));

        assertEquals(2, env.finTxs.size());

        // 6. Adjust inventory (18 units, -2 damaged)
        int txCountBeforeAdjust = env.finTxs.size();
        env.mvc.perform(post("/api/finance/inventory/adjust")
                        .header(RbacService.HEADER_USER_ID, "U_ADMIN")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"P_TEST_INV\",\"newStock\":18,\"reason\":\"Lệch kiểm kê định kỳ\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stock").value(18));

        assertEquals(18, env.products.get("P_TEST_INV").getStock());
        assertEquals(txCountBeforeAdjust, env.finTxs.size()); // MUST NOT create purchase expense!
        assertEquals(2, env.movements.size()); // 1 receipt + 1 adjustment

        // 7. Verify finance summary calculations
        env.mvc.perform(get("/api/finance/summary")
                        .header(RbacService.HEADER_USER_ID, "U_ADMIN")
                        .param("from", "2026-11-15")
                        .param("to", "2026-11-15"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.purchaseCashOut").value(3000000.0))
                .andExpect(jsonPath("$.totalPurchaseOrdersAmount").value(3000000.0))
                .andExpect(jsonPath("$.supplierDebt").value(0.0))
                .andExpect(jsonPath("$.inventoryValuationAtCost").value(4500000.0)); // 18 * 250,000
    }
}

