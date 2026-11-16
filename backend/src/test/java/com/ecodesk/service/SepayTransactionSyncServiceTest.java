package com.ecodesk.service;

import com.ecodesk.config.SepayProperties;
import com.ecodesk.controller.OrderController;
import com.ecodesk.controller.SepayPaymentController;
import com.ecodesk.entity.Order;
import com.ecodesk.entity.SepaySyncState;
import com.ecodesk.entity.SepayTransactionLog;
import com.ecodesk.repository.OrderRepository;
import com.ecodesk.repository.ProductRepository;
import com.ecodesk.repository.SepaySyncStateRepository;
import com.ecodesk.repository.SepayTransactionLogRepository;
import com.ecodesk.repository.UserRepository;
import com.ecodesk.service.SepayHttpGateway.SepayHttpResponse;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.lang.reflect.Proxy;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class SepayTransactionSyncServiceTest {

    @Test
    void sandboxAndLiveEndpointGuard_rejectsMismatchedEnvironment() {
        SepayProperties sandboxV1 = new SepayProperties(
                "tok-test", "sandbox", "v1", "", "MB", "MB Bank", "0123456789", "ECODESK", "DH", true, 15000, 1
        );
        assertThrows(IllegalStateException.class, sandboxV1::resolveTransactionsEndpoint);

        SepayProperties sandboxLiveUrl = new SepayProperties(
                "tok-test", "sandbox", "v2", "https://userapi.sepay.vn/v2/transactions", "MB", "MB Bank", "0123456789", "ECODESK", "DH", true, 15000, 1
        );
        assertThrows(IllegalStateException.class, sandboxLiveUrl::resolveTransactionsEndpoint);

        SepayProperties liveSandboxUrl = new SepayProperties(
                "tok-live", "live", "v2", "https://userapi-sandbox.sepay.vn/v2/transactions", "MB", "MB Bank", "0123456789", "ECODESK", "DH", true, 15000, 1
        );
        assertThrows(IllegalStateException.class, liveSandboxUrl::resolveTransactionsEndpoint);

        SepayProperties validSandbox = new SepayProperties(
                "tok-test", "sandbox", "v2", "", "MB", "MB Bank", "0123456789", "ECODESK", "DH", true, 15000, 1
        );
        assertEquals("https://userapi-sandbox.sepay.vn/v2/transactions", validSandbox.resolveTransactionsEndpoint());

        SepayProperties validLiveV2 = new SepayProperties(
                "tok-live", "live", "v2", "", "MB", "MB Bank", "0123456789", "ECODESK", "DH", true, 15000, 1
        );
        assertEquals("https://userapi.sepay.vn/v2/transactions", validLiveV2.resolveTransactionsEndpoint());

        SepayProperties validLiveV1 = new SepayProperties(
                "tok-live", "live", "v1", "", "MB", "MB Bank", "0123456789", "ECODESK", "DH", true, 15000, 1
        );
        assertEquals("https://my.sepay.vn/userapi/transactions/list", validLiveV1.resolveTransactionsEndpoint());
    }

    @Test
    void syncProcessesIncomingExactMatchIdempotentlyAndHandlesErrorsAnd429() throws Exception {
        String secretToken = "sepay_secret_super_token_do_not_leak";
        SepayProperties props = new SepayProperties(
                secretToken, "live", "v2", "", "MB", "MB Bank", "0123456789", "ECODESK STUDIO", "DH", true, 15000, 1
        );

        Map<String, Order> orderStore = new LinkedHashMap<>();
        Map<String, SepaySyncState> stateStore = new LinkedHashMap<>();
        Map<Long, SepayTransactionLog> txStore = new LinkedHashMap<>();
        AtomicLong txSeq = new AtomicLong(1);

        OrderRepository orderRepo = createOrderRepo(orderStore);
        SepaySyncStateRepository stateRepo = createStateRepo(stateStore);
        SepayTransactionLogRepository txRepo = createTxRepo(txStore, txSeq);
        ProductRepository productRepo = (ProductRepository) Proxy.newProxyInstance(
                ProductRepository.class.getClassLoader(), new Class<?>[]{ProductRepository.class},
                (p, m, a) -> Optional.empty()
        );
        UserRepository userRepo = (UserRepository) Proxy.newProxyInstance(
                UserRepository.class.getClassLoader(), new Class<?>[]{UserRepository.class},
                (p, m, a) -> Optional.empty()
        );

        OrderController orderController = new OrderController(orderRepo, productRepo, userRepo, props);

        Order qrOrderInput = new Order();
        qrOrderInput.setId("ORD-SYNC-QR");
        qrOrderInput.setTotal(2690000.0);
        qrOrderInput.setPaymentMethod("Chuyển khoản QR (VietQR / Napas 247)");
        Order createdQr = (Order) orderController.createOrder(qrOrderInput).getBody();
        assertNotNull(createdQr);
        assertNotNull(createdQr.getPaymentReference());
        assertTrue(createdQr.getPaymentReference().matches("^DH\\d+$"));
        assertEquals("UNPAID", createdQr.getPaymentStatus());
        assertEquals("Chờ xác nhận", createdQr.getStatus());

        Order underpaidOrderInput = new Order();
        underpaidOrderInput.setId("ORD-SYNC-UNDER");
        underpaidOrderInput.setTotal(1000000.0);
        underpaidOrderInput.setPaymentMethod("Chuyển khoản QR (VietQR / Napas 247)");
        Order createdUnderpaid = (Order) orderController.createOrder(underpaidOrderInput).getBody();
        assertNotNull(createdUnderpaid);

        Order codOrderInput = new Order();
        codOrderInput.setId("ORD-SYNC-COD");
        codOrderInput.setTotal(500000.0);
        codOrderInput.setPaymentMethod("Thanh toán khi nhận hàng (COD)");
        Order createdCod = (Order) orderController.createOrder(codOrderInput).getBody();
        assertNotNull(createdCod);
        assertNull(createdCod.getPaymentReference());
        assertEquals("COD", createdCod.getPaymentStatus());

        List<String> requestedUrls = new ArrayList<>();
        List<String> requestedAuthHeaders = new ArrayList<>();
        AtomicReference<SepayHttpResponse> nextResponse = new AtomicReference<>();

        SepayHttpGateway gateway = (url, bearerToken) -> {
            requestedUrls.add(url);
            requestedAuthHeaders.add(bearerToken);
            return nextResponse.get();
        };

        SepayTransactionProcessor processor = new SepayTransactionProcessor(orderRepo, txRepo, props);
        SepayTransactionSyncService syncService = new SepayTransactionSyncService(props, gateway, stateRepo, processor);
        SepayPaymentController paymentController = new SepayPaymentController(props, syncService, txRepo, new RbacService(userRepo));

        MockMvc mvc = MockMvcBuilders.standaloneSetup(paymentController).build();

        // Public config must never expose secret API token.
        mvc.perform(get("/api/payments/sepay/config"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.configured").value(true))
                .andExpect(jsonPath("$.paymentPrefix").value("DH"))
                .andExpect(jsonPath("$.bankCode").value("MB"))
                .andExpect(content().string(not(containsString(secretToken))));

        // First sync returns outgoing tx, wrong account tx, underpaid tx, missing ref tx, and valid match tx.
        nextResponse.set(new SepayHttpResponse(200, """
                {
                  "status": "success",
                  "data": [
                    {
                      "id": "tx-100",
                      "transaction_date": "2026-11-12 10:00:00",
                      "account_number": "0123456789",
                      "transfer_type": "out",
                      "amount_in": 0,
                      "amount_out": 150000,
                      "transaction_content": "Rut tien",
                      "reference_number": "FT00",
                      "code": null,
                      "bank_brand_name": "MBBank"
                    },
                    {
                      "id": "tx-101",
                      "transaction_date": "2026-11-12 10:01:00",
                      "account_number": "9999999999",
                      "transfer_type": "in",
                      "amount_in": 2690000,
                      "transaction_content": "%s",
                      "reference_number": "FT01",
                      "code": "%s",
                      "bank_brand_name": "MBBank"
                    },
                    {
                      "id": "tx-102",
                      "transaction_date": "2026-11-12 10:02:00",
                      "account_number": "0123456789",
                      "transfer_type": "in",
                      "amount_in": 500000,
                      "transaction_content": "Chuyen thieu %s",
                      "reference_number": "FT02",
                      "code": null,
                      "bank_brand_name": "VCB"
                    },
                    {
                      "id": "tx-103",
                      "transaction_date": "2026-11-12 10:03:00",
                      "account_number": "0123456789",
                      "transfer_type": "in",
                      "amount_in": 2690000,
                      "transaction_content": "MBVCB.%s.CT",
                      "reference_number": "FT03",
                      "code": "%s",
                      "bank_brand_name": "MBBank"
                    }
                  ],
                  "meta": { "pagination": { "has_more": false } }
                }
                """.formatted(
                createdQr.getPaymentReference(), createdQr.getPaymentReference(),
                createdUnderpaid.getPaymentReference(),
                createdQr.getPaymentReference(), createdQr.getPaymentReference()
        ), Map.of()));

        SepayTransactionSyncService.SyncSummary first = syncService.syncNow(false);
        assertEquals("OK", first.status());
        assertEquals(4, first.fetchedCount());
        assertEquals(1, first.matchedCount());
        assertEquals(1, first.reviewCount());
        assertEquals(List.of(secretToken), requestedAuthHeaders);
        assertTrue(requestedUrls.get(0).contains("transaction_date_from="));

        // Valid order is PAID, fulfillment status stays "Chờ xác nhận" (NOT completed!).
        Order paidOrder = orderStore.get(createdQr.getId());
        assertEquals("PAID", paidOrder.getPaymentStatus());
        assertEquals("Chờ xác nhận", paidOrder.getStatus());
        assertEquals("tx-103", paidOrder.getSepayTransactionId());
        assertEquals("FT03", paidOrder.getPaymentBankRef());

        // Wrong amount order is marked NEEDS_REVIEW, NOT PAID.
        Order reviewOrder = orderStore.get(createdUnderpaid.getId());
        assertEquals("NEEDS_REVIEW", reviewOrder.getPaymentStatus());
        assertEquals("Chờ xác nhận", reviewOrder.getStatus());

        // Cursor updated to last transaction tx-103.
        assertEquals("tx-103", stateStore.get("default").getLastTransactionId());

        // Duplicate replay + second payment on already-paid order must never overwrite payment or double-count.
        nextResponse.set(new SepayHttpResponse(200, """
                {
                  "status": "success",
                  "data": [
                    {
                      "id": "tx-103",
                      "transaction_date": "2026-11-12 10:03:00",
                      "account_number": "0123456789",
                      "transfer_type": "in",
                      "amount_in": 2690000,
                      "transaction_content": "%s",
                      "reference_number": "FT03",
                      "code": "%s",
                      "bank_brand_name": "MBBank"
                    },
                    {
                      "id": "tx-104",
                      "transaction_date": "2026-11-12 10:05:00",
                      "account_number": "0123456789",
                      "transfer_type": "in",
                      "amount_in": 2690000,
                      "transaction_content": "Chuyen trung %s",
                      "reference_number": "FT04",
                      "code": "%s",
                      "bank_brand_name": "MBBank"
                    }
                  ],
                  "meta": { "pagination": { "has_more": false } }
                }
                """.formatted(
                createdQr.getPaymentReference(), createdQr.getPaymentReference(),
                createdQr.getPaymentReference(), createdQr.getPaymentReference()
        ), Map.of()));

        SepayTransactionSyncService.SyncSummary second = syncService.syncNow(false);
        assertEquals("OK", second.status());
        assertEquals(0, second.matchedCount());
        assertEquals(1, second.reviewCount());
        assertTrue(requestedUrls.get(1).contains("since_id=tx-103"));
        assertEquals("tx-103", orderStore.get(createdQr.getId()).getSepayTransactionId());
        assertTrue(txStore.values().stream().anyMatch(l -> "DUPLICATE_ORDER_PAID".equals(l.getMatchStatus())));

        // HTTP 429 backoff honors Retry-After and stops subsequent calls during cooldown.
        nextResponse.set(new SepayHttpResponse(429, "{\"error\":\"rate_limited\"}", Map.of("Retry-After", "45")));
        mvc.perform(post("/api/payments/sepay/sync"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "45"))
                .andExpect(jsonPath("$.status").value("RATE_LIMITED"));

        int callsBeforeCooldownCheck = requestedUrls.size();
        SepayTransactionSyncService.SyncSummary blocked = syncService.syncNow(false);
        assertTrue(blocked.throttled());
        assertEquals("RATE_LIMITED", blocked.status());
        assertEquals(callsBeforeCooldownCheck, requestedUrls.size());
    }

    @Test
    void pendingCancelOrder_incomingSepayPayment_marksNeedsReviewWithoutMarkingPaid() {
        SepayProperties props = new SepayProperties(
                "tok-live", "live", "v2", "", "MB", "MB Bank", "0123456789", "ECODESK", "DH", true, 15000, 1
        );
        Map<String, Order> orderStore = new LinkedHashMap<>();
        Map<Long, SepayTransactionLog> txStore = new LinkedHashMap<>();
        AtomicLong txSeq = new AtomicLong(1);

        Order pendingCancel = new Order();
        pendingCancel.setId("ORD-PEND-CANCEL");
        pendingCancel.setPaymentMethod("Chuyển khoản QR (VietQR / Napas 247)");
        pendingCancel.setPaymentStatus("UNPAID");
        pendingCancel.setPaymentReference("DH777888");
        pendingCancel.setStatus("Chờ xác nhận");
        pendingCancel.setCancelRequestStatus("PENDING");
        pendingCancel.setTotal(500000.0);
        orderStore.put(pendingCancel.getId(), pendingCancel);

        SepayTransactionProcessor processor = new SepayTransactionProcessor(
                createOrderRepo(orderStore),
                createTxRepo(txStore, txSeq),
                props
        );

        SepayTransactionProcessor.SepayTxRecord tx = new SepayTransactionProcessor.SepayTxRecord(
                "tx-cancel-pending-1",
                "2026-11-12 15:00:00",
                "0123456789",
                null,
                "in",
                new java.math.BigDecimal("500000"),
                java.math.BigDecimal.ZERO,
                "Thanh toan DH777888",
                "FT999",
                null,
                "MB"
        );

        SepayTransactionProcessor.ProcessOutcome outcome = processor.process(tx);
        assertEquals(SepayTransactionProcessor.ProcessOutcome.NEEDS_REVIEW, outcome);
        assertEquals("NEEDS_REVIEW", orderStore.get("ORD-PEND-CANCEL").getPaymentStatus());
        assertEquals("Chờ xác nhận", orderStore.get("ORD-PEND-CANCEL").getStatus());
        assertTrue(txStore.values().stream().anyMatch(l -> "ORDER_CANCEL_PENDING_PAID".equals(l.getMatchStatus())));
    }

    private OrderRepository createOrderRepo(Map<String, Order> store) {
        return (OrderRepository) Proxy.newProxyInstance(
                OrderRepository.class.getClassLoader(),
                new Class<?>[]{OrderRepository.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "save" -> {
                        Order o = (Order) args[0];
                        store.put(o.getId(), o);
                        yield o;
                    }
                    case "findById" -> Optional.ofNullable(store.get((String) args[0]));
                    case "findByPaymentReferenceIgnoreCase" -> store.values().stream()
                            .filter(o -> o.getPaymentReference() != null
                                    && o.getPaymentReference().equalsIgnoreCase((String) args[0]))
                            .findFirst();
                    case "existsBySepayTransactionId" -> store.values().stream()
                            .anyMatch(o -> o.getSepayTransactionId() != null
                                    && o.getSepayTransactionId().equals(args[0]));
                    default -> Optional.empty();
                }
        );
    }

    private SepaySyncStateRepository createStateRepo(Map<String, SepaySyncState> store) {
        return (SepaySyncStateRepository) Proxy.newProxyInstance(
                SepaySyncStateRepository.class.getClassLoader(),
                new Class<?>[]{SepaySyncStateRepository.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "findById" -> Optional.ofNullable(store.get((String) args[0]));
                    case "save" -> {
                        SepaySyncState s = (SepaySyncState) args[0];
                        store.put(s.getId(), s);
                        yield s;
                    }
                    default -> Optional.empty();
                }
        );
    }

    private SepayTransactionLogRepository createTxRepo(Map<Long, SepayTransactionLog> store, AtomicLong seq) {
        return (SepayTransactionLogRepository) Proxy.newProxyInstance(
                SepayTransactionLogRepository.class.getClassLoader(),
                new Class<?>[]{SepayTransactionLogRepository.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "existsBySepayTransactionId" -> store.values().stream()
                            .anyMatch(t -> t.getSepayTransactionId().equals(args[0]));
                    case "save" -> {
                        SepayTransactionLog logEntry = (SepayTransactionLog) args[0];
                        if (logEntry.getId() == null) {
                            logEntry.setId(seq.getAndIncrement());
                        }
                        store.put(logEntry.getId(), logEntry);
                        yield logEntry;
                    }
                    case "findTop50ByOrderByIdDesc" -> store.values().stream()
                            .sorted(Comparator.comparing(SepayTransactionLog::getId).reversed())
                            .limit(50)
                            .toList();
                    default -> null;
                }
        );
    }
}

