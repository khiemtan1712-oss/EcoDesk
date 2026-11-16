package com.ecodesk.controller;

import com.ecodesk.config.SepayProperties;
import com.ecodesk.entity.SepaySyncState;
import com.ecodesk.entity.SepayTransactionLog;
import com.ecodesk.repository.SepayTransactionLogRepository;
import com.ecodesk.service.RbacService;
import com.ecodesk.service.SepayTransactionSyncService;
import com.ecodesk.service.SepayTransactionSyncService.SyncSummary;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Exposes safe, non-secret SePay configuration, throttled sync triggers,
 * and admin reconciliation logs. Never returns `SEPAY_API_TOKEN`.
 */
@RestController
@RequestMapping("/api/payments/sepay")
public class SepayPaymentController {

    private final SepayProperties sepayProperties;
    private final SepayTransactionSyncService syncService;
    private final SepayTransactionLogRepository txLogRepository;
    private final RbacService rbacService;

    public SepayPaymentController(
            SepayProperties sepayProperties,
            SepayTransactionSyncService syncService,
            SepayTransactionLogRepository txLogRepository,
            RbacService rbacService
    ) {
        this.sepayProperties = sepayProperties;
        this.syncService = syncService;
        this.txLogRepository = txLogRepository;
        this.rbacService = rbacService;
    }

    @GetMapping("/config")
    public ResponseEntity<Map<String, Object>> getPublicConfig() {
        SepaySyncState state = syncService.getCurrentStateSnapshot();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("configured", sepayProperties.isTokenConfigured() && sepayProperties.isReceiverConfigured());
        body.put("tokenConfigured", sepayProperties.isTokenConfigured());
        body.put("receiverConfigured", sepayProperties.isReceiverConfigured());
        body.put("environment", sepayProperties.getEnvironment());
        body.put("apiVersion", sepayProperties.getApiVersion());
        body.put("bankCode", sepayProperties.getBankCode());
        body.put("bankName", sepayProperties.getBankName());
        body.put("accountNumber", sepayProperties.getAccountNumber());
        body.put("accountName", sepayProperties.getAccountName());
        body.put("paymentPrefix", sepayProperties.getPaymentPrefix());
        body.put("syncEnabled", sepayProperties.isSyncEnabled());
        body.put("syncIntervalMs", sepayProperties.getSyncIntervalMs());
        body.put("lastSyncAt", state.getLastSyncAt());
        body.put("lastSyncStatus", state.getLastSyncStatus());
        body.put("rateLimitedUntilEpochMs", state.getRateLimitedUntilEpochMs());
        return ResponseEntity.ok(body);
    }

    @PostMapping("/sync")
    public ResponseEntity<Map<String, Object>> triggerSync() {
        SyncSummary summary = syncService.syncNow(true);
        SepaySyncState state = syncService.getCurrentStateSnapshot();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", summary.status());
        body.put("message", summary.message());
        body.put("fetchedCount", summary.fetchedCount());
        body.put("matchedCount", summary.matchedCount());
        body.put("reviewCount", summary.reviewCount());
        body.put("retryAfterSeconds", summary.retryAfterSeconds());
        body.put("throttled", summary.throttled());
        body.put("lastSyncAt", state.getLastSyncAt());
        body.put("lastSyncStatus", state.getLastSyncStatus());
        body.put("rateLimitedUntilEpochMs", state.getRateLimitedUntilEpochMs());

        if ("RATE_LIMITED".equals(summary.status()) && summary.retryAfterSeconds() > 0) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .header("Retry-After", String.valueOf(summary.retryAfterSeconds()))
                    .body(body);
        }
        return ResponseEntity.ok(body);
    }

    @GetMapping("/admin-transactions")
    public ResponseEntity<Map<String, Object>> getAdminTransactions(
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId
    ) {
        rbacService.requireAnyPermission(
                actorHeaderId,
                null,
                "Bạn không có quyền xem giao dịch đối soát SePay.",
                RbacService.PERM_FINANCE_VIEW,
                RbacService.PERM_FINANCE_RECONCILE,
                RbacService.PERM_REPORTS_VIEW,
                RbacService.PERM_ORDERS_VIEW
        );
        SepaySyncState state = syncService.getCurrentStateSnapshot();
        List<SepayTransactionLog> items = txLogRepository.findTop50ByOrderByIdDesc();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("syncState", state);
        body.put("transactions", items);
        return ResponseEntity.ok(body);
    }

    @PatchMapping("/admin-transactions/{id}/resolve")
    public ResponseEntity<?> resolveTransactionLog(
            @PathVariable Long id,
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId,
            @RequestBody(required = false) Map<String, Object> payload
    ) {
        rbacService.requireAnyPermission(
                actorHeaderId,
                null,
                "Bạn không có quyền đối soát nhật ký giao dịch SePay.",
                RbacService.PERM_FINANCE_RECONCILE,
                RbacService.PERM_ORDERS_UPDATE_STATUS
        );
        return txLogRepository.findById(id)
                .map(entry -> {
                    boolean resolved = payload == null || !Boolean.FALSE.equals(payload.get("resolved"));
                    entry.setResolved(resolved);
                    if (payload != null && payload.get("note") != null) {
                        String customNote = payload.get("note").toString().trim();
                        if (!customNote.isEmpty()) {
                            entry.setNote(customNote.length() <= 255 ? customNote : customNote.substring(0, 255));
                        }
                    }
                    return ResponseEntity.ok(txLogRepository.save(entry));
                })
                .orElse(ResponseEntity.notFound().build());
    }
}

