package com.ecodesk.service;

import com.ecodesk.config.SepayProperties;
import com.ecodesk.entity.Order;
import com.ecodesk.entity.SepayTransactionLog;
import com.ecodesk.repository.OrderRepository;
import com.ecodesk.repository.SepayTransactionLogRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Processes a single incoming SePay transaction atomically and idempotently.
 * Each processed SePay transaction ID is persisted at most once in `sepay_transactions`,
 * and at most one valid incoming transfer marks an EcoDesk order as `PAID` without
 * modifying fulfillment status (`Chờ xác nhận` / processing / shipping).
 */
@Service
public class SepayTransactionProcessor {

    private static final Logger log = LoggerFactory.getLogger(SepayTransactionProcessor.class);
    private final OrderRepository orderRepository;
    private final SepayTransactionLogRepository txLogRepository;
    private final SepayProperties sepayProperties;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public record SepayTxRecord(
            String id,
            String transactionDate,
            String accountNumber,
            String virtualAccount,
            String transferType,
            BigDecimal amountIn,
            BigDecimal amountOut,
            String transactionContent,
            String referenceNumber,
            String code,
            String bankBrandName
    ) {}

    public enum ProcessOutcome {
        MATCHED_PAID,
        NEEDS_REVIEW,
        IGNORED_OUTGOING,
        IGNORED_ACCOUNT,
        SKIPPED_DUPLICATE
    }

    public SepayTransactionProcessor(
            OrderRepository orderRepository,
            SepayTransactionLogRepository txLogRepository,
            SepayProperties sepayProperties
    ) {
        this.orderRepository = orderRepository;
        this.txLogRepository = txLogRepository;
        this.sepayProperties = sepayProperties;
    }

    @Transactional
    public ProcessOutcome process(SepayTxRecord tx) {
        if (tx == null || tx.id() == null || tx.id().isBlank()) {
            return ProcessOutcome.SKIPPED_DUPLICATE;
        }
        String txId = tx.id().trim();

        if (txLogRepository.existsBySepayTransactionId(txId)) {
            return ProcessOutcome.SKIPPED_DUPLICATE;
        }

        // Ignore outgoing transfers strictly; only incoming credits may settle orders.
        boolean isOutgoing = "out".equalsIgnoreCase(trim(tx.transferType()))
                || tx.amountIn() == null
                || tx.amountIn().compareTo(BigDecimal.ZERO) <= 0;
        if (isOutgoing) {
            return ProcessOutcome.IGNORED_OUTGOING;
        }

        String configuredAccount = SepayProperties.normalizeAccountNumber(sepayProperties.getAccountNumber());
        String txAccount = SepayProperties.normalizeAccountNumber(tx.accountNumber());
        String txVa = SepayProperties.normalizeAccountNumber(tx.virtualAccount());

        if (configuredAccount.isEmpty()) {
            saveTxLog(tx, null, null, "MISSING_RECEIVER_CONFIG",
                    "Chua cau hinh SEPAY_ACCOUNT_NUMBER nen khong tu dong xac nhan thanh toan.", false);
            return ProcessOutcome.NEEDS_REVIEW;
        }

        boolean matchesAccount = configuredAccount.equalsIgnoreCase(txAccount)
                || (!txVa.isEmpty() && configuredAccount.equalsIgnoreCase(txVa));
        if (!matchesAccount) {
            saveTxLog(tx, null, null, "IGNORED_ACCOUNT",
                    "Tai khoan nhan giao dich khong trung tai khoan EcoDesk da cau hinh.", true);
            return ProcessOutcome.IGNORED_ACCOUNT;
        }

        String extractedCode = extractPaymentReference(tx.code(), tx.transactionContent());
        if (extractedCode == null) {
            saveTxLog(tx, null, null, "MISSING_REFERENCE",
                    "Giao dich tien vao khong chua ma tham chieu bat dau bang " + sepayProperties.getPaymentPrefix() + ".", false);
            return ProcessOutcome.NEEDS_REVIEW;
        }

        Optional<Order> orderOpt = orderRepository.findByPaymentReferenceIgnoreCase(extractedCode);
        if (orderOpt.isEmpty()) {
            saveTxLog(tx, extractedCode, null, "ORDER_NOT_FOUND",
                    "Khong tim thay don hang EcoDesk voi ma tham chieu " + extractedCode + ".", false);
            return ProcessOutcome.NEEDS_REVIEW;
        }

        Order order = orderOpt.get();

        // Guard against applying another transaction to an already-paid order.
        if ("PAID".equalsIgnoreCase(order.getPaymentStatus())
                || (order.getSepayTransactionId() != null && !order.getSepayTransactionId().isBlank())) {
            saveTxLog(tx, extractedCode, order.getId(), "DUPLICATE_ORDER_PAID",
                    "Don #" + order.getId() + " da duoc thanh toan truoc do; giao dich trung can tra soat.", false);
            return ProcessOutcome.NEEDS_REVIEW;
        }

        if (orderRepository.existsBySepayTransactionId(txId)) {
            return ProcessOutcome.SKIPPED_DUPLICATE;
        }

        if ("Đã hủy".equalsIgnoreCase(trim(order.getStatus()))) {
            order.setPaymentStatus("NEEDS_REVIEW");
            order.setPaymentReviewReason("Nhan " + formatVnd(tx.amountIn()) + " qua SePay cho don da huy.");
            order.setUpdatedAt(Instant.now().toString());
            orderRepository.save(order);
            saveTxLog(tx, extractedCode, order.getId(), "ORDER_CANCELLED_PAID",
                    "Nhan chuyen khoan cho don da bi huy.", false);
            return ProcessOutcome.NEEDS_REVIEW;
        }

        if ("PENDING".equalsIgnoreCase(trim(order.getCancelRequestStatus()))) {
            String reason = "Nhan " + formatVnd(tx.amountIn())
                    + " qua SePay trong luc don dang cho duyet huy (Ma GD: " + txId + ").";
            order.setPaymentStatus("NEEDS_REVIEW");
            order.setPaymentReviewReason(reason);
            order.setUpdatedAt(Instant.now().toString());
            appendPaymentHistory(order, reason);
            orderRepository.save(order);
            saveTxLog(tx, extractedCode, order.getId(), "ORDER_CANCEL_PENDING_PAID",
                    "Nhan chuyen khoan trong luc don dang cho duyet huy; can nhan vien tra soat.", false);
            return ProcessOutcome.NEEDS_REVIEW;
        }

        long expectedVnd = Math.round(order.getTotal() != null ? order.getTotal() : 0.0);
        boolean wholeVnd = tx.amountIn().stripTrailingZeros().scale() <= 0;
        boolean exactAmount = wholeVnd && expectedVnd > 0 && tx.amountIn().longValueExact() == expectedVnd;

        if (!exactAmount) {
            String reason = "So tien chuyen khoan (" + formatVnd(tx.amountIn())
                    + ") khong khop tong don (" + formatVnd(BigDecimal.valueOf(expectedVnd)) + ").";
            order.setPaymentStatus("NEEDS_REVIEW");
            order.setPaymentReviewReason(reason);
            order.setUpdatedAt(Instant.now().toString());
            appendPaymentHistory(order, "Can kiem tra giao dich SePay: " + reason + " (Ma GD: " + txId + ")");
            orderRepository.save(order);
            saveTxLog(tx, extractedCode, order.getId(), "AMOUNT_MISMATCH", reason, false);
            return ProcessOutcome.NEEDS_REVIEW;
        }

        String paidAt = !trim(tx.transactionDate()).isEmpty() ? trim(tx.transactionDate()) : Instant.now().toString();
        String gateway = !trim(tx.bankBrandName()).isEmpty() ? trim(tx.bankBrandName()) : "Bank Transfer";

        order.setPaymentStatus("PAID");
        order.setSepayTransactionId(txId);
        order.setPaymentGateway(gateway);
        order.setPaymentBankRef(trim(tx.referenceNumber()));
        order.setPaidAmount(tx.amountIn().doubleValue());
        order.setPaidAt(paidAt);
        order.setPaymentReviewReason(null);
        order.setUpdatedAt(Instant.now().toString());
        appendPaymentHistory(
                order,
                "SePay xac nhan da nhan du " + formatVnd(BigDecimal.valueOf(expectedVnd))
                        + " qua " + gateway + " (Tham chieu: " + extractedCode + ")"
        );
        orderRepository.save(order);

        saveTxLog(tx, extractedCode, order.getId(), "MATCHED_PAID",
                "Da khop va cap nhat thanh toan thanh cong cho don #" + order.getId() + ".", true);
        log.info("Marked order {} as PAID via SePay txId={}", order.getId(), txId);
        return ProcessOutcome.MATCHED_PAID;
    }

    String extractPaymentReference(String code, String content) {
        String prefix = sepayProperties.getPaymentPrefix();
        Pattern strictPattern = Pattern.compile("^(" + Pattern.quote(prefix) + "\\d{4,20})$", Pattern.CASE_INSENSITIVE);
        if (code != null && !code.isBlank()) {
            Matcher m = strictPattern.matcher(code.trim());
            if (m.matches()) {
                return m.group(1).toUpperCase(Locale.ROOT);
            }
        }
        if (content != null && !content.isBlank()) {
            Pattern contentPattern = Pattern.compile(
                    "(?<![A-Z0-9])(" + Pattern.quote(prefix) + "\\d{4,20})(?![A-Z0-9])",
                    Pattern.CASE_INSENSITIVE
            );
            Matcher m = contentPattern.matcher(content);
            if (m.find()) {
                return m.group(1).toUpperCase(Locale.ROOT);
            }
        }
        return null;
    }

    private void saveTxLog(
            SepayTxRecord tx,
            String extractedCode,
            String matchedOrderId,
            String matchStatus,
            String note,
            boolean resolved
    ) {
        SepayTransactionLog entry = new SepayTransactionLog();
        entry.setSepayTransactionId(tx.id().trim());
        entry.setTransactionDate(truncate(trim(tx.transactionDate()), 40));
        entry.setAccountNumber(truncate(trim(tx.accountNumber()), 50));
        entry.setBankBrandName(truncate(trim(tx.bankBrandName()), 80));
        entry.setAmountIn(tx.amountIn() != null ? tx.amountIn().doubleValue() : 0.0);
        entry.setReferenceNumber(truncate(trim(tx.referenceNumber()), 100));
        entry.setExtractedCode(truncate(extractedCode, 40));
        entry.setTransactionContent(truncate(trim(tx.transactionContent()), 500));
        entry.setMatchedOrderId(truncate(matchedOrderId, 50));
        entry.setMatchStatus(matchStatus);
        entry.setNote(truncate(note, 255));
        entry.setResolved(resolved);
        entry.setCreatedAt(Instant.now().toString());
        txLogRepository.save(entry);
    }

    private void appendPaymentHistory(Order order, String note) {
        List<Map<String, Object>> history = new ArrayList<>();
        if (order.getStatusHistoryJson() != null && !order.getStatusHistoryJson().isBlank()) {
            try {
                history = objectMapper.readValue(
                        order.getStatusHistoryJson(),
                        new TypeReference<List<Map<String, Object>>>() {}
                );
            } catch (Exception ignored) {
                history = new ArrayList<>();
            }
        }
        Map<String, Object> item = new LinkedHashMap<>();
        // Preserve existing fulfillment status (e.g. "Chờ xác nhận"); payment sync must not complete delivery status.
        item.put("status", order.getStatus() != null ? order.getStatus() : "Chờ xác nhận");
        item.put("timestamp", Instant.now().toString());
        item.put("note", note);
        item.put("by", "SePay API");
        history.add(item);
        try {
            order.setStatusHistoryJson(objectMapper.writeValueAsString(history));
        } catch (Exception ignored) {}
    }

    private static String trim(String s) {
        return s == null ? "" : s.trim();
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }

    private static String formatVnd(BigDecimal amount) {
        if (amount == null) return "0 đ";
        NumberFormat nf = NumberFormat.getNumberInstance(Locale.forLanguageTag("vi-VN"));
        return nf.format(amount.longValue()) + " đ";
    }
}

