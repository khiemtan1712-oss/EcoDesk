package com.ecodesk.service;

import com.ecodesk.config.SepayProperties;
import com.ecodesk.entity.SepaySyncState;
import com.ecodesk.repository.SepaySyncStateRepository;
import com.ecodesk.service.SepayHttpGateway.SepayHttpResponse;
import com.ecodesk.service.SepayTransactionProcessor.ProcessOutcome;
import com.ecodesk.service.SepayTransactionProcessor.SepayTxRecord;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Periodically (and on throttled demand) synchronizes incoming bank transfers from SePay API Access
 * using persisted cursor tracking (`since_id`) and strict HTTP 429 Retry-After backoff.
 */
@Service
public class SepayTransactionSyncService {

    private static final Logger log = LoggerFactory.getLogger(SepayTransactionSyncService.class);
    private static final String STATE_ID = "default";
    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final int MAX_PAGES_PER_SYNC = 5;
    private static final long MIN_MANUAL_TRIGGER_GAP_MS = 3000L;

    private final SepayProperties properties;
    private final SepayHttpGateway httpGateway;
    private final SepaySyncStateRepository stateRepository;
    private final SepayTransactionProcessor processor;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Object syncLock = new Object();

    private volatile long lastManualAttemptEpochMs = 0L;

    public record SyncSummary(
            String status,
            String message,
            int fetchedCount,
            int matchedCount,
            int reviewCount,
            long retryAfterSeconds,
            boolean throttled
    ) {}

    public SepayTransactionSyncService(
            SepayProperties properties,
            SepayHttpGateway httpGateway,
            SepaySyncStateRepository stateRepository,
            SepayTransactionProcessor processor
    ) {
        this.properties = properties;
        this.httpGateway = httpGateway;
        this.stateRepository = stateRepository;
        this.processor = processor;
    }

    @Scheduled(fixedDelayString = "${ecodesk.sepay.sync-interval-ms:15000}", initialDelay = 8000)
    public void scheduledSync() {
        if (!properties.isSyncEnabled()) {
            return;
        }
        if (!properties.isTokenConfigured()) {
            return;
        }
        syncNow(false);
    }

    public SepaySyncState getCurrentStateSnapshot() {
        return stateRepository.findById(STATE_ID).orElseGet(() -> {
            SepaySyncState s = new SepaySyncState();
            s.setId(STATE_ID);
            s.setLastSyncStatus(properties.isTokenConfigured() ? "IDLE" : "NOT_CONFIGURED");
            s.setLastSyncMessage(properties.isTokenConfigured()
                    ? "San sang dong bo giao dich SePay."
                    : "Chua cau hinh SEPAY_API_TOKEN tren backend.");
            return s;
        });
    }

    public SyncSummary syncNow(boolean manualTrigger) {
        synchronized (syncLock) {
            long now = System.currentTimeMillis();
            SepaySyncState state = stateRepository.findById(STATE_ID).orElseGet(() -> {
                SepaySyncState s = new SepaySyncState();
                s.setId(STATE_ID);
                return s;
            });

            if (!properties.isTokenConfigured()) {
                state.setLastSyncAt(Instant.now().toString());
                state.setLastSyncStatus("NOT_CONFIGURED");
                state.setLastSyncMessage("Chua cau hinh SEPAY_API_TOKEN tren backend.");
                stateRepository.save(state);
                return new SyncSummary("NOT_CONFIGURED", state.getLastSyncMessage(), 0, 0, 0, 0, false);
            }

            if (state.getRateLimitedUntilEpochMs() != null && state.getRateLimitedUntilEpochMs() > now) {
                long remainingSec = Math.max(1L, (state.getRateLimitedUntilEpochMs() - now + 999L) / 1000L);
                return new SyncSummary(
                        "RATE_LIMITED",
                        "SePay dang yeu cau cho " + remainingSec + " giay (HTTP 429 Retry-After).",
                        0, 0, 0, remainingSec, true
                );
            }

            if (manualTrigger && (now - lastManualAttemptEpochMs) < MIN_MANUAL_TRIGGER_GAP_MS) {
                long waitSec = Math.max(1L, (MIN_MANUAL_TRIGGER_GAP_MS - (now - lastManualAttemptEpochMs) + 999L) / 1000L);
                return new SyncSummary(
                        state.getLastSyncStatus() != null ? state.getLastSyncStatus() : "OK",
                        "Vua dong bo gan day; vui long cho " + waitSec + " giay truoc khi goi lai.",
                        0, 0, 0, waitSec, true
                );
            }

            String endpoint;
            try {
                endpoint = properties.resolveTransactionsEndpoint();
            } catch (IllegalStateException cfgErr) {
                state.setLastSyncAt(Instant.now().toString());
                state.setLastSyncStatus("CONFIG_ERROR");
                state.setLastSyncMessage(truncate(cfgErr.getMessage(), 250));
                stateRepository.save(state);
                log.warn("SePay configuration mismatch: {}", cfgErr.getMessage());
                return new SyncSummary("CONFIG_ERROR", state.getLastSyncMessage(), 0, 0, 0, 0, false);
            }

            if (manualTrigger) {
                lastManualAttemptEpochMs = now;
            }
            int totalFetched = 0;
            int matchedCount = 0;
            int reviewCount = 0;
            List<SepayTxRecord> collected = new ArrayList<>();

            try {
                String sinceId = state.getLastTransactionId();
                boolean hasMore = true;
                int page = 1;

                while (hasMore && page <= MAX_PAGES_PER_SYNC) {
                    String url = buildTransactionsUrl(endpoint, sinceId, page);
                    SepayHttpResponse response = httpGateway.get(url, properties.getApiToken());

                    if (response.statusCode() == 429) {
                        long waitSec = parseRetryAfterSeconds(response);
                        state.setRateLimitedUntilEpochMs(System.currentTimeMillis() + waitSec * 1000L);
                        state.setLastSyncAt(Instant.now().toString());
                        state.setLastSyncStatus("RATE_LIMITED");
                        state.setLastSyncMessage("SePay gioi han tan suat (HTTP 429). Tam dung " + waitSec + " giay.");
                        stateRepository.save(state);
                        log.warn("SePay HTTP 429 rate limited; backing off for {}s", waitSec);
                        return new SyncSummary("RATE_LIMITED", state.getLastSyncMessage(), totalFetched, matchedCount, reviewCount, waitSec, true);
                    }

                    if (response.statusCode() == 401 || response.statusCode() == 403) {
                        long authCooldownSec = 60L;
                        state.setRateLimitedUntilEpochMs(System.currentTimeMillis() + authCooldownSec * 1000L);
                        state.setLastSyncAt(Instant.now().toString());
                        state.setLastSyncStatus("AUTH_ERROR");
                        state.setLastSyncMessage("SePay tu choi xac thuc (HTTP " + response.statusCode()
                                + "). Kiem tra SEPAY_API_TOKEN va moi truong live/sandbox.");
                        stateRepository.save(state);
                        log.warn("SePay HTTP {} authorization failure for env={}", response.statusCode(), properties.getEnvironment());
                        return new SyncSummary("AUTH_ERROR", state.getLastSyncMessage(), 0, 0, 0, authCooldownSec, false);
                    }

                    if (response.statusCode() < 200 || response.statusCode() >= 300) {
                        state.setLastSyncAt(Instant.now().toString());
                        state.setLastSyncStatus("ERROR");
                        state.setLastSyncMessage("SePay API tra ve HTTP " + response.statusCode() + ".");
                        stateRepository.save(state);
                        log.warn("SePay API error status={}", response.statusCode());
                        return new SyncSummary("ERROR", state.getLastSyncMessage(), totalFetched, matchedCount, reviewCount, 0, false);
                    }

                    ParsedPage parsedPage = parseResponsePage(response.body());
                    collected.addAll(parsedPage.transactions());
                    totalFetched += parsedPage.transactions().size();
                    hasMore = parsedPage.hasMore();
                    page++;
                }

                // Sort chronologically ascending so cursor advances reliably past the newest transaction.
                collected.sort(Comparator
                        .comparing((SepayTxRecord t) -> t.transactionDate() == null ? "" : t.transactionDate())
                        .thenComparing(t -> t.id() == null ? "" : t.id()));

                SepayTxRecord lastProcessed = null;
                for (SepayTxRecord tx : collected) {
                    try {
                        ProcessOutcome outcome = processor.process(tx);
                        if (outcome == ProcessOutcome.MATCHED_PAID) {
                            matchedCount++;
                        } else if (outcome == ProcessOutcome.NEEDS_REVIEW) {
                            reviewCount++;
                        }
                        lastProcessed = tx;
                    } catch (DataIntegrityViolationException dupEx) {
                        // Safe guard against concurrent DB unique constraint collisions.
                        lastProcessed = tx;
                    }
                }

                if (lastProcessed != null && lastProcessed.id() != null && !lastProcessed.id().isBlank()) {
                    state.setLastTransactionId(lastProcessed.id().trim());
                    if (lastProcessed.transactionDate() != null && !lastProcessed.transactionDate().isBlank()) {
                        state.setLastTransactionDate(lastProcessed.transactionDate().trim());
                    }
                }

                state.setRateLimitedUntilEpochMs(null);
                state.setLastSyncAt(Instant.now().toString());
                state.setLastSyncStatus("OK");
                state.setLastSyncMessage(buildSuccessMessage(totalFetched, matchedCount, reviewCount));
                stateRepository.save(state);

                return new SyncSummary("OK", state.getLastSyncMessage(), totalFetched, matchedCount, reviewCount, 0, false);
            } catch (Exception ex) {
                state.setLastSyncAt(Instant.now().toString());
                state.setLastSyncStatus("ERROR");
                state.setLastSyncMessage(truncate("Loi dong bo SePay: " + ex.getMessage(), 250));
                stateRepository.save(state);
                log.warn("SePay sync error: {}", ex.getMessage());
                return new SyncSummary("ERROR", state.getLastSyncMessage(), totalFetched, matchedCount, reviewCount, 0, false);
            }
        }
    }

    String buildTransactionsUrl(String endpoint, String sinceId, int page) {
        StringBuilder sb = new StringBuilder(endpoint);
        List<String> params = new ArrayList<>();

        String accountNumber = SepayProperties.normalizeAccountNumber(properties.getAccountNumber());
        if (!accountNumber.isEmpty()) {
            params.add("account_number=" + encode(accountNumber));
        }

        boolean isV1 = "v1".equalsIgnoreCase(properties.getApiVersion()) && !properties.isSandbox();
        if (sinceId != null && !sinceId.isBlank()) {
            params.add("since_id=" + encode(sinceId.trim()));
        } else {
            String fromDate = LocalDate.now(VN_ZONE).minusDays(properties.getLookbackDays()).toString();
            params.add((isV1 ? "transaction_date_min=" : "transaction_date_from=") + encode(fromDate));
        }

        if (isV1) {
            params.add("limit=100");
        } else {
            params.add("transaction_date_sort=asc");
            params.add("per_page=100");
            params.add("page=" + page);
        }

        if (!params.isEmpty()) {
            sb.append(endpoint.contains("?") ? "&" : "?");
            sb.append(String.join("&", params));
        }
        return sb.toString();
    }

    ParsedPage parseResponsePage(String body) throws Exception {
        if (body == null || body.isBlank()) {
            return new ParsedPage(List.of(), false);
        }
        JsonNode root = objectMapper.readTree(body);
        JsonNode itemsNode = null;
        if (root.has("data") && root.get("data").isArray()) {
            itemsNode = root.get("data");
        } else if (root.has("transactions") && root.get("transactions").isArray()) {
            itemsNode = root.get("transactions");
        }

        List<SepayTxRecord> records = new ArrayList<>();
        if (itemsNode != null) {
            for (JsonNode item : itemsNode) {
                String id = firstText(item, "id", "transaction_id");
                String txDate = firstText(item, "transaction_date", "transactionDate");
                String acct = firstText(item, "account_number", "accountNumber");
                String va = firstText(item, "va", "sub_account", "subAccount");
                String transferType = firstText(item, "transfer_type", "transferType");
                BigDecimal amountIn = parseAmount(item.get("amount_in"));
                BigDecimal amountOut = parseAmount(item.get("amount_out"));
                if (amountIn == null && "in".equalsIgnoreCase(transferType)) {
                    amountIn = parseAmount(item.get("transferAmount"));
                }
                String content = firstText(item, "transaction_content", "content", "description");
                String refNumber = firstText(item, "reference_number", "referenceCode", "reference_code");
                String code = firstText(item, "code");
                String bankBrand = firstText(item, "bank_brand_name", "gateway");

                records.add(new SepayTxRecord(
                        id, txDate, acct, va, transferType, amountIn, amountOut, content, refNumber, code, bankBrand
                ));
            }
        }

        boolean hasMore = root.path("meta").path("pagination").path("has_more").asBoolean(false);
        return new ParsedPage(records, hasMore);
    }

    long parseRetryAfterSeconds(SepayHttpResponse response) {
        String raw = response.headerIgnoreCase("Retry-After");
        if (raw == null || raw.isBlank()) {
            raw = response.headerIgnoreCase("x-sepay-userapi-retry-after");
        }
        if (raw == null || raw.isBlank()) {
            raw = response.headerIgnoreCase("X-RateLimit-Reset");
        }
        if (raw == null || raw.isBlank()) {
            return 60L;
        }
        try {
            long parsed = Long.parseLong(raw.trim());
            // Handle Unix epoch timestamp headers cleanly if returned instead of relative seconds.
            if (parsed > 1_000_000_000L) {
                parsed = parsed - Instant.now().getEpochSecond();
            }
            return Math.max(5L, Math.min(3600L, parsed));
        } catch (NumberFormatException ignored) {
            return 60L;
        }
    }

    record ParsedPage(List<SepayTxRecord> transactions, boolean hasMore) {}

    private static String firstText(JsonNode node, String... keys) {
        for (String key : keys) {
            JsonNode val = node.get(key);
            if (val != null && !val.isNull()) {
                String text = val.asText();
                if (text != null && !text.isBlank()) {
                    return text;
                }
            }
        }
        return null;
    }

    private static BigDecimal parseAmount(JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (node.isNumber()) {
            return node.decimalValue();
        }
        String raw = node.asText("").trim();
        if (raw.isEmpty()) return null;
        try {
            return new BigDecimal(raw);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static String encode(String val) {
        return URLEncoder.encode(val, StandardCharsets.UTF_8);
    }

    private static String buildSuccessMessage(int fetched, int matched, int review) {
        if (fetched == 0) {
            return "Khong co giao dich moi.";
        }
        return "Da quet " + fetched + " giao dich: khop " + matched + " don, can tra soat " + review + " giao dich.";
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }
}
