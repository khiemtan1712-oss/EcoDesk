package com.ecodesk.controller;

import com.ecodesk.entity.*;
import com.ecodesk.repository.*;
import com.ecodesk.service.RbacService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.text.Normalizer;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api/finance")
public class FinanceController {

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final SepayTransactionLogRepository sepayTxLogRepository;
    private final FinancialTransactionRepository txRepository;
    private final FinancialAuditLogRepository auditLogRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;
    private final PayrollRecordRepository payrollRepository;
    private final InventoryMovementRepository movementRepository;
    private final RbacService rbacService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @org.springframework.beans.factory.annotation.Autowired
    public FinanceController(
            OrderRepository orderRepository,
            ProductRepository productRepository,
            UserRepository userRepository,
            SepayTransactionLogRepository sepayTxLogRepository,
            FinancialTransactionRepository txRepository,
            FinancialAuditLogRepository auditLogRepository,
            PurchaseOrderRepository purchaseOrderRepository,
            PayrollRecordRepository payrollRepository,
            InventoryMovementRepository movementRepository,
            RbacService rbacService
    ) {
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
        this.userRepository = userRepository;
        this.sepayTxLogRepository = sepayTxLogRepository;
        this.txRepository = txRepository;
        this.auditLogRepository = auditLogRepository;
        this.purchaseOrderRepository = purchaseOrderRepository;
        this.payrollRepository = payrollRepository;
        this.movementRepository = movementRepository;
        this.rbacService = rbacService;
    }

    public FinanceController(
            OrderRepository orderRepository,
            ProductRepository productRepository,
            UserRepository userRepository,
            SepayTransactionLogRepository sepayTxLogRepository,
            FinancialTransactionRepository txRepository,
            FinancialAuditLogRepository auditLogRepository,
            PurchaseOrderRepository purchaseOrderRepository,
            PayrollRecordRepository payrollRepository,
            RbacService rbacService
    ) {
        this(orderRepository, productRepository, userRepository, sepayTxLogRepository, txRepository, auditLogRepository, purchaseOrderRepository, payrollRepository, null, rbacService);
    }

    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getSummary(
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to
    ) {
        User actor = rbacService.requireAnyPermission(
                actorHeaderId,
                null,
                "Bạn không có quyền xem báo cáo tài chính.",
                RbacService.PERM_FINANCE_VIEW,
                RbacService.PERM_REPORTS_VIEW
        );

        String fromDate = normalizeDateParam(from);
        String toDate = normalizeDateParam(to);

        ensureDefaultPayrollsForActiveStaff();

        List<Order> allOrders = orderRepository.findAllByOrderByCreatedAtDesc();
        List<FinancialTransaction> allTxs = txRepository.findAllByOrderByTxDateDescCreatedAtDesc();
        List<PurchaseOrder> allPurchases = purchaseOrderRepository.findAllByOrderByPurchaseDateDescCreatedAtDesc();
        List<PayrollRecord> allPayrolls = payrollRepository.findAllByOrderByPeriodMonthDescCreatedAtDesc();
        List<Product> allProducts = productRepository.findAll();

        Map<String, Product> productMap = new HashMap<>();
        int missingCostProductsCount = 0;
        for (Product p : allProducts) {
            productMap.put(p.getId(), p);
            if (p.getCostPrice() == null || p.getCostPrice() <= 0) {
                missingCostProductsCount++;
            }
        }

        double completedOrderSales = 0.0;
        int completedOrderCount = 0;
        double collectedFromOrders = 0.0;
        int paidOrderCount = 0;
        double pendingReceivable = 0.0;
        int pendingReceivableCount = 0;
        double processingOrdersAmount = 0.0;
        int processingOrdersCount = 0;
        double refundedActualFromOrders = 0.0;
        double pendingRefundAmount = 0.0;
        int needsReviewOrdersCount = 0;
        Set<String> refundedOrderIds = new HashSet<>();

        double totalCogs = 0.0;
        int missingCostItemsCount = 0;
        int completedItemsCount = 0;

        Map<String, double[]> dailySeries = new TreeMap<>(); // [collected, expense, completedSales]

        List<Map<String, Object>> completedOrdersBreakdown = new ArrayList<>();
        List<Map<String, Object>> paidOrdersBreakdown = new ArrayList<>();
        List<Map<String, Object>> pendingOrdersBreakdown = new ArrayList<>();
        List<Map<String, Object>> processingOrdersBreakdown = new ArrayList<>();
        Map<String, Integer> statusCounts = new LinkedHashMap<>();

        for (Order o : allOrders) {
            // Defensive: Exclude POS / counter sales orders
            if (o.getId() != null && o.getId().startsWith("POS-")) continue;
            if ("POS".equalsIgnoreCase(o.getOrderSource())) continue;

            String status = trim(o.getStatus());
            String payStatus = trim(o.getPaymentStatus()).toUpperCase(Locale.ROOT);
            String refundStatus = trim(o.getRefundStatus()).toUpperCase(Locale.ROOT);
            double total = o.getTotal() != null ? o.getTotal() : 0.0;
            String createdDate = extractDate(o.getCreatedAt());
            String completedDate = getOrderCompletedDate(o);

            statusCounts.put(status, statusCounts.getOrDefault(status, 0) + 1);

            if ("NEEDS_REVIEW".equals(payStatus)) {
                needsReviewOrdersCount++;
            }

            // Payment verification: ONLY count as paid if explicitly marked PAID with verification!
            // Completed delivery status alone DOES NOT imply payment was received.
            boolean isPaid = "PAID".equals(payStatus);

            String paidDate = "";
            if (isPaid) {
                if (o.getPaidAt() != null && !o.getPaidAt().isBlank()) {
                    paidDate = extractDate(o.getPaidAt());
                } else if (o.getCompletedAt() != null && !o.getCompletedAt().isBlank()) {
                    paidDate = extractDate(o.getCompletedAt());
                } else {
                    paidDate = completedDate;
                }
            }

            boolean isCompleted = "Hoàn thành".equalsIgnoreCase(status);
            boolean isCancelled = "Đã hủy".equalsIgnoreCase(status);

            // 1. Completed web order sales: calculated strictly according to completion date!
            if (isCompleted && inRange(completedDate, fromDate, toDate)) {
                completedOrderSales += total;
                completedOrderCount++;
                addSeries(dailySeries, completedDate, 2, total);

                Map<String, Object> compItem = new LinkedHashMap<>();
                compItem.put("id", o.getId());
                compItem.put("userId", o.getUserId());
                compItem.put("customerName", o.getCustomerName());
                compItem.put("total", total);
                compItem.put("completedAt", o.getCompletedAt() != null ? o.getCompletedAt() : completedDate);
                compItem.put("completedBy", o.getCompletedBy() != null ? o.getCompletedBy() : "Hệ thống");
                compItem.put("paymentMethod", o.getPaymentMethod());
                compItem.put("paymentStatus", isPaid ? "PAID" : (payStatus.isEmpty() ? "UNPAID" : payStatus));
                compItem.put("status", status);
                completedOrdersBreakdown.add(compItem);

                if (o.getItemsJson() != null && !o.getItemsJson().isBlank()) {
                    try {
                        JsonNode items = objectMapper.readTree(o.getItemsJson());
                        if (items.isArray()) {
                            for (JsonNode item : items) {
                                completedItemsCount++;
                                int qty = Math.max(1, item.path("quantity").asInt(1));
                                Double unitCost = null;
                                if (item.has("costPrice") && item.get("costPrice").isNumber()) {
                                    unitCost = item.get("costPrice").asDouble();
                                } else {
                                    String pid = item.has("productId") ? item.path("productId").asText("") : item.path("id").asText("");
                                    Product prod = productMap.get(pid);
                                    if (prod != null && prod.getCostPrice() != null && prod.getCostPrice() > 0) {
                                        unitCost = prod.getCostPrice();
                                    }
                                }
                                if (unitCost == null || unitCost <= 0) {
                                    missingCostItemsCount++;
                                } else {
                                    totalCogs += unitCost * qty;
                                }
                            }
                        }
                    } catch (Exception ignored) {
                        missingCostItemsCount++;
                    }
                }
            }

            // 2. Verified collected cash: calculated strictly according to verified payment date!
            if (isPaid && inRange(paidDate, fromDate, toDate)) {
                double paidAmt = o.getPaidAmount() != null && o.getPaidAmount() > 0 ? o.getPaidAmount() : total;
                collectedFromOrders += paidAmt;
                paidOrderCount++;
                addSeries(dailySeries, paidDate, 0, paidAmt);

                Map<String, Object> paidItem = new LinkedHashMap<>();
                paidItem.put("id", o.getId());
                paidItem.put("userId", o.getUserId());
                paidItem.put("customerName", o.getCustomerName());
                paidItem.put("paidAmount", paidAmt);
                paidItem.put("paidAt", o.getPaidAt() != null ? o.getPaidAt() : paidDate);
                paidItem.put("paymentMethod", o.getPaymentMethod());
                paidOrdersBreakdown.add(paidItem);
            }

            // 3. Receivables on delivered orders (Công nợ giao hàng còn phải thu):
            // Orders completed on/before the end of period, but not paid as of end of period (or unverified)
            boolean wasCompletedInOrBeforePeriod = isCompleted && (toDate == null || completedDate.compareTo(toDate) <= 0)
                    && (fromDate == null || completedDate.compareTo(fromDate) >= 0);
            boolean wasUnpaidAsOfPeriodEnd = !isPaid || (toDate != null && !paidDate.isEmpty() && paidDate.compareTo(toDate) > 0);
            boolean isPendingQrInPeriod = isBankTransferOrQr(o.getPaymentMethod()) && !isCancelled && inRange(createdDate, fromDate, toDate);

            if ((wasCompletedInOrBeforePeriod || isPendingQrInPeriod) && wasUnpaidAsOfPeriodEnd) {
                pendingReceivable += total;
                pendingReceivableCount++;

                Map<String, Object> pendItem = new LinkedHashMap<>();
                pendItem.put("id", o.getId());
                pendItem.put("userId", o.getUserId());
                pendItem.put("customerName", o.getCustomerName());
                pendItem.put("total", total);
                pendItem.put("createdAt", o.getCreatedAt());
                pendItem.put("completedAt", o.getCompletedAt() != null ? o.getCompletedAt() : completedDate);
                pendItem.put("paymentMethod", o.getPaymentMethod());
                pendItem.put("paymentStatus", o.getPaymentStatus() != null ? o.getPaymentStatus() : "CHƯA THANH TOÁN");
                pendItem.put("status", status);

                String pendingCategory;
                String pendingCategoryLabel;
                if (isBankTransferOrQr(o.getPaymentMethod())) {
                    pendingCategory = "QR_PENDING_VERIFICATION";
                    pendingCategoryLabel = "Đã hoàn tất giao hàng — Chờ xác minh SePay (Khoản phải thu)";
                } else {
                    pendingCategory = "COD_PENDING_RECONCILIATION";
                    pendingCategoryLabel = "Đơn COD đã giao — Chờ đối soát thu tiền (Khoản phải thu)";
                }
                pendItem.put("pendingCategory", pendingCategory);
                pendItem.put("pendingCategoryLabel", pendingCategoryLabel);
                pendingOrdersBreakdown.add(pendItem);
            }

            // 4. Processing orders awaiting delivery / fulfillment in period (Đơn đang xử lý chờ giao hàng):
            // Created on/before period end, but NOT completed on/before period end, and not cancelled
            boolean wasCreatedInPeriod = inRange(createdDate, fromDate, toDate);
            boolean wasNotCompletedAsOfPeriodEnd = !isCompleted || (toDate != null && completedDate.compareTo(toDate) > 0);

            if (!isCancelled && wasCreatedInPeriod && wasNotCompletedAsOfPeriodEnd) {
                processingOrdersAmount += total;
                processingOrdersCount++;

                Map<String, Object> proc = new LinkedHashMap<>();
                proc.put("id", o.getId());
                proc.put("userId", o.getUserId());
                proc.put("customerName", o.getCustomerName());
                proc.put("customerPhone", o.getCustomerPhone());
                proc.put("status", status);
                proc.put("paymentStatus", o.getPaymentStatus() != null ? o.getPaymentStatus() : "CHƯA THANH TOÁN");
                proc.put("paymentMethod", o.getPaymentMethod());
                proc.put("total", total);
                proc.put("createdAt", o.getCreatedAt());
                proc.put("updatedAt", o.getUpdatedAt() != null ? o.getUpdatedAt() : o.getCreatedAt());

                String procCategory;
                String procCategoryLabel;
                if (isBankTransferOrQr(o.getPaymentMethod())) {
                    procCategory = "QR_PENDING_PAYMENT";
                    procCategoryLabel = "Chờ khách chuyển khoản QR (Đơn đang xử lý)";
                } else {
                    procCategory = "COD_PENDING_DELIVERY";
                    procCategoryLabel = "Chờ giao hàng & thu COD (Đơn đang xử lý)";
                }
                proc.put("pendingCategory", procCategory);
                proc.put("pendingCategoryLabel", procCategoryLabel);
                processingOrdersBreakdown.add(proc);
            }

            // Refunds
            if ("REFUNDED".equals(refundStatus)) {
                if (inRange(createdDate, fromDate, toDate)) {
                    double refAmt = o.getPaidAmount() != null && o.getPaidAmount() > 0 ? o.getPaidAmount() : total;
                    refundedActualFromOrders += refAmt;
                    refundedOrderIds.add(o.getId());
                    addSeries(dailySeries, createdDate, 1, refAmt);
                }
            } else if ("PENDING_REFUND".equals(refundStatus)) {
                if (inRange(createdDate, fromDate, toDate)) {
                    double refAmt = o.getPaidAmount() != null && o.getPaidAmount() > 0 ? o.getPaidAmount() : total;
                    pendingRefundAmount += refAmt;
                }
            }
        }

        double otherIncome = 0.0;
        double operatingExpenses = 0.0;
        double purchaseCashOut = 0.0;
        double payrollPaid = 0.0;
        double manualRefunds = 0.0;

        for (FinancialTransaction tx : allTxs) {
            String d = extractDate(tx.getTxDate());
            if (!inRange(d, fromDate, toDate)) continue;
            double amt = tx.getAmount() != null ? tx.getAmount() : 0.0;
            String t = trim(tx.getTxType()).toUpperCase(Locale.ROOT);
            switch (t) {
                case "INCOME_OTHER" -> {
                    otherIncome += amt;
                    addSeries(dailySeries, d, 0, amt);
                }
                case "EXPENSE_OPERATING" -> {
                    operatingExpenses += amt;
                    addSeries(dailySeries, d, 1, amt);
                }
                case "EXPENSE_PURCHASE" -> {
                    purchaseCashOut += amt;
                    addSeries(dailySeries, d, 1, amt);
                }
                case "EXPENSE_PAYROLL" -> {
                    payrollPaid += amt;
                    addSeries(dailySeries, d, 1, amt);
                }
                case "REFUND_MANUAL" -> {
                    // Prevent double counting if refund is already accounted for on order level
                    if (tx.getOrderId() == null || !refundedOrderIds.contains(tx.getOrderId())) {
                        manualRefunds += amt;
                        addSeries(dailySeries, d, 1, amt);
                    }
                }
                default -> {}
            }
        }

        double payrollPending = 0.0;
        for (PayrollRecord pr : allPayrolls) {
            if (!"PAID".equalsIgnoreCase(trim(pr.getStatus())) && pr.getNetAmount() != null && pr.getNetAmount() > 0) {
                String dueOrPeriodDate = pr.getDueDate() != null && !pr.getDueDate().isBlank()
                        ? pr.getDueDate()
                        : (pr.getPeriodMonth() != null && pr.getPeriodMonth().length() == 7 ? pr.getPeriodMonth() + "-10" : extractDate(pr.getCreatedAt()));
                if (inRange(dueOrPeriodDate, fromDate, toDate)) {
                    payrollPending += pr.getNetAmount();
                }
            }
        }

        double totalPurchaseOrdersAmount = 0.0;
        double supplierDebt = 0.0;
        int receivedPurchaseOrdersCount = 0;
        for (PurchaseOrder po : allPurchases) {
            if ("RECEIVED".equalsIgnoreCase(po.getReceivedStatus())) {
                String poDate = po.getPurchaseDate() != null && !po.getPurchaseDate().isBlank()
                        ? extractDate(po.getPurchaseDate())
                        : extractDate(po.getCreatedAt());
                if (inRange(poDate, fromDate, toDate)) {
                    totalPurchaseOrdersAmount += po.getTotalAmount() != null ? po.getTotalAmount() : 0.0;
                    supplierDebt += po.getDebtAmount() != null ? po.getDebtAmount() : 0.0;
                    receivedPurchaseOrdersCount++;
                }
            }
        }

        double inventoryValuationAtCost = 0.0;
        int valuationItemsCount = 0;
        int missingValuationCount = 0;
        for (Product p : allProducts) {
            int s = p.getStock() != null ? p.getStock() : 0;
            Double c = p.getCostPrice();
            if (s > 0) {
                if (c != null && c > 0) {
                    inventoryValuationAtCost += s * c;
                    valuationItemsCount++;
                } else {
                    missingValuationCount++;
                }
            }
        }

        double collectedCash = collectedFromOrders + otherIncome;
        double refundedActual = refundedActualFromOrders + manualRefunds;
        double totalCashOut = purchaseCashOut + operatingExpenses + payrollPaid + refundedActual;
        double netCashFlow = collectedCash - totalCashOut;

        String grossProfitStatus;
        Double grossProfit = null;
        if (completedOrderCount == 0 || completedItemsCount == 0) {
            grossProfitStatus = "NO_DATA";
        } else if (missingCostItemsCount > 0) {
            grossProfitStatus = "INSUFFICIENT_DATA";
        } else {
            grossProfitStatus = "AVAILABLE";
            grossProfit = completedOrderSales - totalCogs;
        }

        long unreconciledSepayCount = sepayTxLogRepository.findTop50ByOrderByIdDesc().stream()
                .filter(l -> !Boolean.TRUE.equals(l.getResolved()) && !"MATCHED_PAID".equalsIgnoreCase(trim(l.getMatchStatus())))
                .count();

        boolean canViewPayroll = rbacService.isAdmin(actor) || rbacService.hasPermission(actor, RbacService.PERM_FINANCE_PAYROLL_VIEW);

        List<Map<String, Object>> series = new ArrayList<>();
        for (Map.Entry<String, double[]> entry : dailySeries.entrySet()) {
            double[] vals = entry.getValue();
            Map<String, Object> point = new LinkedHashMap<>();
            point.put("date", entry.getKey());
            point.put("collected", vals[0]);
            point.put("expense", vals[1]);
            point.put("completedSales", vals[2]);
            point.put("net", vals[0] - vals[1]);
            series.add(point);
        }

        double totalExpenses = purchaseCashOut + operatingExpenses + (canViewPayroll ? payrollPaid : 0.0);
        Map<String, Object> expensesBreakdown = new LinkedHashMap<>();
        expensesBreakdown.put("purchaseCashOut", purchaseCashOut);
        expensesBreakdown.put("operatingExpenses", operatingExpenses);
        expensesBreakdown.put("payrollPaid", canViewPayroll ? payrollPaid : null);

        double totalDebt = supplierDebt + (canViewPayroll ? payrollPending : 0.0);
        Map<String, Object> debtsBreakdown = new LinkedHashMap<>();
        debtsBreakdown.put("supplierDebt", supplierDebt);
        debtsBreakdown.put("payrollDebt", canViewPayroll ? payrollPending : null);

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("from", fromDate);
        summary.put("to", toDate);
        summary.put("completedOrderSales", completedOrderSales);
        summary.put("completedWebSales", completedOrderSales);
        summary.put("completedOrderCount", completedOrderCount);
        summary.put("completedOrdersBreakdown", completedOrdersBreakdown);
        summary.put("collectedCash", collectedCash);
        summary.put("verifiedCollectedCash", collectedCash);
        summary.put("collectedFromOrders", collectedFromOrders);
        summary.put("otherIncome", otherIncome);
        summary.put("paidOrderCount", paidOrderCount);
        summary.put("paidOrdersBreakdown", paidOrdersBreakdown);
        summary.put("pendingReceivable", pendingReceivable);
        summary.put("receivablesAmount", pendingReceivable);
        summary.put("pendingReceivableCount", pendingReceivableCount);
        summary.put("pendingOrdersBreakdown", pendingOrdersBreakdown);
        summary.put("processingOrdersAmount", processingOrdersAmount);
        summary.put("processingOrdersCount", processingOrdersCount);
        summary.put("processingOrdersBreakdown", processingOrdersBreakdown);
        summary.put("totalPendingPipelineAmount", pendingReceivable + processingOrdersAmount);
        summary.put("totalPendingPipelineCount", pendingReceivableCount + processingOrdersCount);
        summary.put("orderStatusCounts", statusCounts);
        summary.put("refundedActual", refundedActual);
        summary.put("pendingRefundAmount", pendingRefundAmount);
        summary.put("purchaseCashOut", purchaseCashOut);
        summary.put("totalPurchaseOrdersAmount", totalPurchaseOrdersAmount);
        summary.put("supplierDebt", supplierDebt);
        summary.put("purchaseOrdersCount", receivedPurchaseOrdersCount);
        summary.put("allPurchaseOrdersCount", allPurchases.size());
        summary.put("inventoryValuationAtCost", inventoryValuationAtCost);
        summary.put("valuationItemsCount", valuationItemsCount);
        summary.put("missingValuationCount", missingValuationCount);
        summary.put("operatingExpenses", operatingExpenses);
        summary.put("payrollRestricted", !canViewPayroll);
        summary.put("payrollPaid", canViewPayroll ? payrollPaid : null);
        summary.put("payrollPending", canViewPayroll ? payrollPending : null);
        summary.put("totalExpenses", totalExpenses);
        summary.put("expensesBreakdown", expensesBreakdown);
        summary.put("totalDebt", totalDebt);
        summary.put("debtsBreakdown", debtsBreakdown);
        summary.put("totalCashOut", totalCashOut);
        summary.put("netCashFlow", netCashFlow);
        summary.put("grossProfit", grossProfit);
        summary.put("grossProfitStatus", grossProfitStatus);
        summary.put("totalCogs", "AVAILABLE".equals(grossProfitStatus) ? totalCogs : null);
        summary.put("missingCostItemsCount", missingCostItemsCount);
        summary.put("missingCostProductsCount", missingCostProductsCount);
        List<Map<String, Object>> missingCostProductsList = new ArrayList<>();
        for (Product p : allProducts) {
            if (p.getCostPrice() == null || p.getCostPrice() <= 0) {
                Map<String, Object> mp = new LinkedHashMap<>();
                mp.put("id", p.getId());
                mp.put("name", p.getName());
                mp.put("price", p.getPrice());
                mp.put("stock", p.getStock() != null ? p.getStock() : 0);
                missingCostProductsList.add(mp);
            }
        }
        summary.put("missingCostProductsList", missingCostProductsList);
        summary.put("unreconciledSepayCount", unreconciledSepayCount);
        summary.put("needsReviewOrdersCount", needsReviewOrdersCount);
        summary.put("series", series);

        return ResponseEntity.ok(summary);
    }

    @GetMapping("/transactions")
    public ResponseEntity<List<FinancialTransaction>> getTransactions(
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String txType,
            @RequestParam(required = false) String paymentMethod,
            @RequestParam(required = false) String createdByUserId,
            @RequestParam(required = false) Boolean reconciled
    ) {
        User actor = rbacService.requireAnyPermission(
                actorHeaderId,
                null,
                "Bạn không có quyền xem sổ giao dịch tài chính.",
                RbacService.PERM_FINANCE_VIEW,
                RbacService.PERM_REPORTS_VIEW
        );
        boolean canViewPayroll = rbacService.isAdmin(actor) || rbacService.hasPermission(actor, RbacService.PERM_FINANCE_PAYROLL_VIEW);
        String fromDate = normalizeDateParam(from);
        String toDate = normalizeDateParam(to);

        List<FinancialTransaction> list = txRepository.findAllByOrderByTxDateDescCreatedAtDesc().stream()
                .filter(tx -> inRange(extractDate(tx.getTxDate()), fromDate, toDate))
                .filter(tx -> txType == null || txType.isBlank() || "all".equalsIgnoreCase(txType) || txType.equalsIgnoreCase(tx.getTxType()))
                .filter(tx -> paymentMethod == null || paymentMethod.isBlank() || "all".equalsIgnoreCase(paymentMethod)
                        || (tx.getPaymentMethod() != null && tx.getPaymentMethod().equalsIgnoreCase(paymentMethod)))
                .filter(tx -> createdByUserId == null || createdByUserId.isBlank() || "all".equalsIgnoreCase(createdByUserId)
                        || createdByUserId.equals(tx.getCreatedByUserId()))
                .filter(tx -> reconciled == null || reconciled.equals(tx.getReconciled()))
                .filter(tx -> canViewPayroll || !"EXPENSE_PAYROLL".equalsIgnoreCase(tx.getTxType()))
                .toList();

        return ResponseEntity.ok(list);
    }

    @GetMapping("/transactions/{id}")
    public ResponseEntity<?> getTransactionById(
            @PathVariable String id,
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId
    ) {
        User actor = rbacService.requireAnyPermission(
                actorHeaderId,
                null,
                "Bạn không có quyền xem chi tiết giao dịch tài chính.",
                RbacService.PERM_FINANCE_VIEW,
                RbacService.PERM_REPORTS_VIEW
        );
        Optional<FinancialTransaction> opt = txRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();

        FinancialTransaction tx = opt.get();
        if ("EXPENSE_PAYROLL".equalsIgnoreCase(tx.getTxType()) && !rbacService.isAdmin(actor)
                && !rbacService.hasPermission(actor, RbacService.PERM_FINANCE_PAYROLL_VIEW)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Bạn không có quyền xem giao dịch chi lương."));
        }

        List<FinancialAuditLog> auditLogs = auditLogRepository.findByEntityTypeAndEntityIdOrderByIdDesc("TRANSACTION", id);
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("transaction", tx);
        res.put("auditLogs", auditLogs);

        if (tx.getOrderId() != null) {
            orderRepository.findById(tx.getOrderId()).ifPresent(o -> res.put("linkedOrder", o));
        }
        if (tx.getPurchaseOrderId() != null) {
            purchaseOrderRepository.findById(tx.getPurchaseOrderId()).ifPresent(po -> res.put("linkedPurchase", po));
        }
        if (tx.getPayrollId() != null) {
            payrollRepository.findById(tx.getPayrollId()).ifPresent(pr -> res.put("linkedPayroll", pr));
        }

        return ResponseEntity.ok(res);
    }

    @PostMapping("/transactions")
    @Transactional
    public ResponseEntity<?> createTransaction(
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId,
            @RequestBody Map<String, Object> body
    ) {
        User actor = rbacService.requireAnyPermission(
                actorHeaderId,
                null,
                "Bạn không có quyền ghi nhận khoản thu/chi tài chính.",
                RbacService.PERM_FINANCE_RECORD_EXPENSE
        );

        String txType = trim(body.get("txType")).toUpperCase(Locale.ROOT);
        String category = trim(body.get("category"));
        String txDate = trim(body.get("txDate"));
        double amount = body.get("amount") instanceof Number n ? n.doubleValue() : parseDouble(body.get("amount"));
        String paymentMethod = trim(body.get("paymentMethod"));
        String note = trim(body.get("note"));
        String attachmentUrl = trimOrNull(body.get("attachmentUrl"));

        if (txType.isEmpty() || category.isEmpty() || amount <= 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Vui lòng nhập đầy đủ loại giao dịch, danh mục và số tiền hợp lệ (> 0)."));
        }
        if ("EXPENSE_PAYROLL".equals(txType) && !rbacService.isAdmin(actor)
                && !rbacService.hasPermission(actor, RbacService.PERM_FINANCE_PAYROLL_VIEW)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Bạn không có quyền ghi nhận chi lương nhân viên."));
        }
        if (txDate.isEmpty()) {
            txDate = LocalDate.now().toString();
        }

        String rawLinked = trim(body.get("linkedRef"));
        String orderId = trimOrNull(body.get("orderId"));
        String purchaseOrderId = trimOrNull(body.get("purchaseOrderId"));
        String payrollId = trimOrNull(body.get("payrollId"));

        if (!rawLinked.isEmpty()) {
            if (rawLinked.startsWith("PO-") || rawLinked.contains("PO")) {
                purchaseOrderId = rawLinked;
            } else if (rawLinked.startsWith("PAY-") || rawLinked.contains("PAY")) {
                payrollId = rawLinked;
            } else {
                orderId = rawLinked;
            }
        }

        // Anti-duplicate protection: avoid recording same transaction twice within 8 seconds
        final String finalTxType = txType;
        final String finalCategory = category;
        final String finalTxDate = txDate;
        boolean isDuplicate = txRepository.findAllByOrderByTxDateDescCreatedAtDesc().stream()
                .filter(t -> t.getCreatedAt() != null)
                .filter(t -> finalTxType.equalsIgnoreCase(t.getTxType())
                        && finalCategory.equalsIgnoreCase(t.getCategory())
                        && Math.abs((t.getAmount() != null ? t.getAmount() : 0.0) - amount) < 0.01
                        && finalTxDate.equals(t.getTxDate()))
                .anyMatch(t -> {
                    try {
                        long diff = Math.abs(Instant.now().toEpochMilli() - Instant.parse(t.getCreatedAt()).toEpochMilli());
                        return diff < 8000;
                    } catch (Exception e) {
                        return false;
                    }
                });
        if (isDuplicate) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Giao dịch tương tự vừa được tạo vài giây trước. Vui lòng kiểm tra sổ thu chi để tránh ghi nhận trùng."));
        }

        FinancialTransaction tx = new FinancialTransaction();
        tx.setId("FIN-" + System.currentTimeMillis());
        tx.setTxType(txType);
        tx.setCategory(category);
        tx.setTxDate(txDate);
        tx.setAmount(amount);
        tx.setPaymentMethod(paymentMethod.isEmpty() ? "Tiền mặt" : paymentMethod);
        tx.setNote(note);
        tx.setAttachmentUrl(attachmentUrl);
        tx.setOrderId(orderId);
        tx.setPurchaseOrderId(purchaseOrderId);
        tx.setPayrollId(payrollId);
        tx.setReconciled(false);
        tx.setCreatedByUserId(actor.getId());
        tx.setCreatedByName(actor.getName());
        tx.setCreatedAt(Instant.now().toString());

        FinancialTransaction saved = txRepository.save(tx);
        writeAuditLog("TRANSACTION", saved.getId(), "CREATE", actor, Map.of(
                "txType", saved.getTxType(),
                "category", saved.getCategory(),
                "amount", saved.getAmount(),
                "txDate", saved.getTxDate(),
                "attachmentUrl", attachmentUrl != null ? attachmentUrl : ""
        ));
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/transactions/{id}")
    @Transactional
    public ResponseEntity<?> updateTransaction(
            @PathVariable String id,
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId,
            @RequestBody Map<String, Object> body
    ) {
        User actor = rbacService.requireAnyPermission(
                actorHeaderId,
                null,
                "Bạn không có quyền chỉnh sửa giao dịch tài chính.",
                RbacService.PERM_FINANCE_RECORD_EXPENSE
        );
        Optional<FinancialTransaction> opt = txRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();

        FinancialTransaction tx = opt.get();
        if (Boolean.TRUE.equals(tx.getReconciled())) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Giao dịch đã được đối soát, không thể sửa hoặc xóa lịch sử tài chính."));
        }

        Map<String, Object> before = new LinkedHashMap<>();
        before.put("category", tx.getCategory());
        before.put("amount", tx.getAmount());
        before.put("txDate", tx.getTxDate());
        before.put("note", trim(tx.getNote()));
        before.put("attachmentUrl", trim(tx.getAttachmentUrl()));

        if (body.containsKey("category") && body.get("category") != null) {
            tx.setCategory(body.get("category").toString().trim());
        }
        if (body.containsKey("txDate") && body.get("txDate") != null) {
            tx.setTxDate(body.get("txDate").toString().trim());
        }
        if (body.containsKey("amount")) {
            double amt = body.get("amount") instanceof Number n ? n.doubleValue() : parseDouble(body.get("amount"));
            if (amt <= 0) {
                return ResponseEntity.badRequest().body(Map.of("error", "Số tiền phải lớn hơn 0."));
            }
            tx.setAmount(amt);
        }
        if (body.containsKey("paymentMethod") && body.get("paymentMethod") != null) {
            tx.setPaymentMethod(body.get("paymentMethod").toString().trim());
        }
        if (body.containsKey("note") && body.get("note") != null) {
            tx.setNote(body.get("note").toString().trim());
        }
        if (body.containsKey("attachmentUrl")) {
            tx.setAttachmentUrl(trimOrNull(body.get("attachmentUrl")));
        }
        if (body.containsKey("linkedRef")) {
            String rawLinked = trim(body.get("linkedRef"));
            if (rawLinked.isEmpty()) {
                tx.setOrderId(null);
                tx.setPurchaseOrderId(null);
                tx.setPayrollId(null);
            } else if (rawLinked.startsWith("PO-") || rawLinked.contains("PO")) {
                tx.setPurchaseOrderId(rawLinked);
            } else if (rawLinked.startsWith("PAY-") || rawLinked.contains("PAY")) {
                tx.setPayrollId(rawLinked);
            } else {
                tx.setOrderId(rawLinked);
            }
        }
        if (body.containsKey("orderId")) tx.setOrderId(trimOrNull(body.get("orderId")));
        if (body.containsKey("purchaseOrderId")) tx.setPurchaseOrderId(trimOrNull(body.get("purchaseOrderId")));
        if (body.containsKey("payrollId")) tx.setPayrollId(trimOrNull(body.get("payrollId")));

        tx.setUpdatedByUserId(actor.getId());
        tx.setUpdatedByName(actor.getName());
        tx.setUpdatedAt(Instant.now().toString());
        FinancialTransaction saved = txRepository.save(tx);

        Map<String, Object> after = new LinkedHashMap<>();
        after.put("category", saved.getCategory());
        after.put("amount", saved.getAmount());
        after.put("txDate", saved.getTxDate());
        after.put("note", trim(saved.getNote()));
        after.put("attachmentUrl", trim(saved.getAttachmentUrl()));
        writeAuditLog("TRANSACTION", saved.getId(), "UPDATE", actor, Map.of("before", before, "after", after));
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/transactions/{id}/reconcile")
    @Transactional
    public ResponseEntity<?> reconcileTransaction(
            @PathVariable String id,
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId
    ) {
        User actor = rbacService.requireAnyPermission(
                actorHeaderId,
                null,
                "Bạn không có quyền đối soát giao dịch tài chính.",
                RbacService.PERM_FINANCE_RECONCILE
        );
        Optional<FinancialTransaction> opt = txRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();

        FinancialTransaction tx = opt.get();
        if (Boolean.TRUE.equals(tx.getReconciled())) {
            return ResponseEntity.ok(tx);
        }
        tx.setReconciled(true);
        tx.setReconciledAt(Instant.now().toString());
        tx.setReconciledBy(actor.getName());
        FinancialTransaction saved = txRepository.save(tx);
        writeAuditLog("TRANSACTION", saved.getId(), "RECONCILE", actor, Map.of("reconciled", true));
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/transactions/{id}")
    @Transactional
    public ResponseEntity<?> deleteTransaction(
            @PathVariable String id,
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId
    ) {
        User admin = rbacService.requireAdmin(actorHeaderId, null, "Chỉ Quản trị viên mới có quyền xóa giao dịch tài chính chưa đối soát.");
        Optional<FinancialTransaction> opt = txRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();

        FinancialTransaction tx = opt.get();
        if (Boolean.TRUE.equals(tx.getReconciled())) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Không thể xóa giao dịch tài chính đã đối soát."));
        }
        txRepository.delete(tx);
        writeAuditLog("TRANSACTION", id, "DELETE", admin, Map.of("amount", tx.getAmount(), "category", tx.getCategory()));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/purchases")
    public List<PurchaseOrder> getPurchases(
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId,
            @RequestParam(required = false) String supplier,
            @RequestParam(required = false) String receivedStatus,
            @RequestParam(required = false) String paymentStatus,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to
    ) {
        rbacService.requireAnyPermission(
                actorHeaderId,
                null,
                "Bạn không có quyền xem dữ liệu nhập hàng.",
                RbacService.PERM_INVENTORY_PURCHASE_VIEW,
                RbacService.PERM_FINANCE_VIEW,
                RbacService.PERM_REPORTS_VIEW
        );
        List<PurchaseOrder> list = purchaseOrderRepository.findAllByOrderByPurchaseDateDescCreatedAtDesc();
        String fromDate = normalizeDateParam(from);
        String toDate = normalizeDateParam(to);

        return list.stream().filter(po -> {
            if (supplier != null && !supplier.isBlank() && !po.getSupplierName().toLowerCase().contains(supplier.trim().toLowerCase())) return false;
            if (receivedStatus != null && !receivedStatus.isBlank() && !"all".equalsIgnoreCase(receivedStatus) && !receivedStatus.equalsIgnoreCase(po.getReceivedStatus())) return false;
            if (paymentStatus != null && !paymentStatus.isBlank() && !"all".equalsIgnoreCase(paymentStatus) && !paymentStatus.equalsIgnoreCase(po.getPaymentStatus())) return false;
            String d = extractDate(po.getPurchaseDate() != null ? po.getPurchaseDate() : po.getCreatedAt());
            return inRange(d, fromDate, toDate);
        }).toList();
    }

    @GetMapping("/purchases/{id}")
    public ResponseEntity<?> getPurchaseById(
            @PathVariable String id,
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId
    ) {
        rbacService.requireAnyPermission(
                actorHeaderId,
                null,
                "Bạn không có quyền xem chi tiết phiếu nhập hàng.",
                RbacService.PERM_INVENTORY_PURCHASE_VIEW,
                RbacService.PERM_FINANCE_VIEW,
                RbacService.PERM_REPORTS_VIEW
        );
        Optional<PurchaseOrder> opt = purchaseOrderRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();

        PurchaseOrder po = opt.get();
        List<FinancialTransaction> linkedTxs = txRepository.findAllByOrderByTxDateDescCreatedAtDesc().stream()
                .filter(tx -> id.equals(tx.getPurchaseOrderId()))
                .toList();
        List<FinancialAuditLog> logs = auditLogRepository.findByEntityTypeAndEntityIdOrderByIdDesc("PURCHASE", id);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("purchase", po);
        res.put("transactions", linkedTxs);
        res.put("auditLogs", logs);
        return ResponseEntity.ok(res);
    }

    @PostMapping("/purchases")
    @Transactional
    public ResponseEntity<?> createPurchase(
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId,
            @RequestBody Map<String, Object> body
    ) {
        User actor = rbacService.requireAnyPermission(
                actorHeaderId,
                null,
                "Bạn không có quyền ghi nhận phiếu nhập hàng.",
                RbacService.PERM_INVENTORY_PURCHASE_CREATE,
                RbacService.PERM_FINANCE_RECORD_EXPENSE
        );

        String supplierName = trim(body.get("supplierName"));
        if (supplierName.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Vui lòng nhập tên nhà cung cấp."));
        }

        String purchaseDate = trim(body.get("purchaseDate"));
        if (purchaseDate.isEmpty()) purchaseDate = LocalDate.now().toString();

        String paymentMethod = trim(body.get("paymentMethod"));
        if (paymentMethod.isEmpty()) paymentMethod = "Chuyển khoản ngân hàng";

        String receivedStatus = trim(body.get("receivedStatus")).toUpperCase(Locale.ROOT);
        if (!"DRAFT".equals(receivedStatus)) receivedStatus = "RECEIVED";

        String note = trim(body.get("note"));
        String attachmentUrl = trim(body.get("attachmentUrl"));
        double discountAmount = Math.max(0.0, parseDouble(body.get("discountAmount")));
        double shippingFee = Math.max(0.0, parseDouble(body.get("shippingFee")));
        double initialPaid = Math.max(0.0, parseDouble(body.get("paidAmount")));

        // Parse items (multi-item list or fallback single item)
        List<Map<String, Object>> parsedItems = new ArrayList<>();
        double calculatedSubtotal = 0.0;
        int totalQuantity = 0;

        if (body.get("items") instanceof List<?> rawList && !rawList.isEmpty()) {
            for (Object obj : rawList) {
                if (obj instanceof Map<?, ?> m) {
                    String pid = trim(m.get("productId"));
                    String pname = trim(m.get("productName"));
                    String vid = trim(m.get("variantId"));
                    String vname = trim(m.get("variantName"));
                    int qty = m.get("quantity") instanceof Number n ? n.intValue() : (int) parseDouble(m.get("quantity"));
                    double cost = m.get("unitCost") instanceof Number n ? n.doubleValue() : parseDouble(m.get("unitCost"));
                    double disc = m.get("discount") instanceof Number n ? n.doubleValue() : parseDouble(m.get("discount"));
                    if (pid.isEmpty() || qty <= 0 || cost <= 0) {
                        return ResponseEntity.badRequest().body(Map.of("error", "Mỗi mặt hàng cần có mã sản phẩm, số lượng > 0 và đơn giá nhập > 0."));
                    }
                    Optional<Product> prodOpt = productRepository.findById(pid);
                    if (prodOpt.isEmpty()) {
                        return ResponseEntity.badRequest().body(Map.of("error", "Không tìm thấy sản phẩm có mã: " + pid));
                    }
                    if (pname.isEmpty()) pname = prodOpt.get().getName();
                    double lineSubtotal = Math.max(0.0, (qty * cost) - disc);
                    calculatedSubtotal += lineSubtotal;
                    totalQuantity += qty;

                    Map<String, Object> itemMap = new LinkedHashMap<>();
                    itemMap.put("productId", pid);
                    itemMap.put("productName", pname);
                    itemMap.put("variantId", vid.isEmpty() ? null : vid);
                    itemMap.put("variantName", vname.isEmpty() ? null : vname);
                    itemMap.put("quantity", qty);
                    itemMap.put("unitCost", cost);
                    itemMap.put("discount", disc);
                    itemMap.put("subtotal", lineSubtotal);
                    parsedItems.add(itemMap);
                }
            }
        } else {
            // Legacy single item fields
            String pid = trim(body.get("productId"));
            String vid = trim(body.get("variantId"));
            int qty = body.get("quantity") instanceof Number n ? n.intValue() : (int) parseDouble(body.get("quantity"));
            double cost = body.get("unitCost") instanceof Number n ? n.doubleValue() : parseDouble(body.get("unitCost"));
            if (pid.isEmpty() || qty <= 0 || cost <= 0) {
                return ResponseEntity.badRequest().body(Map.of("error", "Vui lòng nhập đủ sản phẩm, số lượng (> 0) và đơn giá nhập (> 0)."));
            }
            Optional<Product> prodOpt = productRepository.findById(pid);
            if (prodOpt.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Không tìm thấy sản phẩm nhập kho."));
            }
            Product p = prodOpt.get();
            double lineSubtotal = qty * cost;
            calculatedSubtotal += lineSubtotal;
            totalQuantity += qty;

            Map<String, Object> itemMap = new LinkedHashMap<>();
            itemMap.put("productId", pid);
            itemMap.put("productName", p.getName());
            itemMap.put("variantId", vid.isEmpty() ? null : vid);
            itemMap.put("variantName", null);
            itemMap.put("quantity", qty);
            itemMap.put("unitCost", cost);
            itemMap.put("discount", 0.0);
            itemMap.put("subtotal", lineSubtotal);
            parsedItems.add(itemMap);
        }

        double totalAmount = Math.max(0.0, calculatedSubtotal - discountAmount + shippingFee);
        double paidAmount = Math.min(initialPaid, totalAmount);
        double debtAmount = Math.max(0.0, totalAmount - paidAmount);
        String paymentStatus = paidAmount <= 0 ? "UNPAID" : (debtAmount <= 0.01 ? "PAID" : "PARTIALLY_PAID");

        PurchaseOrder po = new PurchaseOrder();
        String poId = "PO-" + System.currentTimeMillis();
        po.setId(poId);
        po.setSupplierName(supplierName);
        po.setPurchaseDate(purchaseDate);
        po.setPaymentMethod(paymentMethod);
        po.setSubtotal(calculatedSubtotal);
        po.setDiscountAmount(discountAmount);
        po.setShippingFee(shippingFee);
        po.setTotalAmount(totalAmount);
        po.setPaidAmount(paidAmount);
        po.setDebtAmount(debtAmount);
        po.setPaymentStatus(paymentStatus);
        po.setReceivedStatus(receivedStatus);
        po.setNote(note);
        po.setAttachmentUrl(attachmentUrl.isEmpty() ? null : attachmentUrl);
        po.setCreatedByUserId(actor.getId());
        po.setCreatedByName(actor.getName());
        po.setCreatedAt(Instant.now().toString());

        // Snapshot primary item & itemsJson
        if (!parsedItems.isEmpty()) {
            Map<String, Object> first = parsedItems.get(0);
            po.setProductId((String) first.get("productId"));
            po.setProductName((String) first.get("productName"));
            po.setVariantId((String) first.get("variantId"));
            po.setVariantName((String) first.get("variantName"));
            po.setQuantity(totalQuantity);
            po.setUnitCost(totalQuantity > 0 ? calculatedSubtotal / totalQuantity : 0.0);
            try {
                po.setItemsJson(objectMapper.writeValueAsString(parsedItems));
            } catch (Exception ignored) {}
        }

        // If RECEIVED: update inventory & calculate weighted average cost
        if ("RECEIVED".equals(receivedStatus)) {
            for (Map<String, Object> it : parsedItems) {
                String pid = (String) it.get("productId");
                String vid = (String) it.get("variantId");
                int q = (int) it.get("quantity");
                double c = (double) it.get("unitCost");
                applyPurchaseItemStockAndCost(supplierName, poId, pid, vid, q, c, actor);
            }
            po.setReceivedAt(Instant.now().toString());
            po.setReceivedByUserId(actor.getId());
            po.setReceivedByName(actor.getName());
        }

        PurchaseOrder savedPo = purchaseOrderRepository.save(po);

        // If paidAmount > 0: record cash out financial transaction
        if (paidAmount > 0) {
            po.setPaymentDate(purchaseDate);
            FinancialTransaction fin = new FinancialTransaction();
            fin.setId("FIN-PO-" + System.currentTimeMillis());
            fin.setTxType("EXPENSE_PURCHASE");
            fin.setCategory("Nhập hàng từ NCC: " + supplierName);
            fin.setTxDate(purchaseDate);
            fin.setAmount(paidAmount);
            fin.setPaymentMethod(paymentMethod);
            fin.setNote("Thanh toán đợt 1 phiếu #" + savedPo.getId() + (note.isEmpty() ? "" : " · " + note));
            fin.setPurchaseOrderId(savedPo.getId());
            fin.setReconciled(false);
            fin.setCreatedByUserId(actor.getId());
            fin.setCreatedByName(actor.getName());
            fin.setCreatedAt(Instant.now().toString());
            txRepository.save(fin);
        }

        writeAuditLog("PURCHASE", savedPo.getId(), "CREATE", actor, Map.of(
                "supplierName", supplierName,
                "totalAmount", savedPo.getTotalAmount(),
                "paidAmount", paidAmount,
                "receivedStatus", receivedStatus,
                "itemsCount", parsedItems.size()
        ));

        return ResponseEntity.status(HttpStatus.CREATED).body(savedPo);
    }

    @PostMapping("/purchases/{id}/receive")
    @Transactional
    public ResponseEntity<?> receivePurchase(
            @PathVariable String id,
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId
    ) {
        User actor = rbacService.requireAnyPermission(
                actorHeaderId,
                null,
                "Bạn không có quyền xác nhận nhận hàng nhập kho.",
                RbacService.PERM_INVENTORY_PURCHASE_RECEIVE,
                RbacService.PERM_PRODUCTS_MANAGE
        );
        Optional<PurchaseOrder> opt = purchaseOrderRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();

        PurchaseOrder po = opt.get();
        if ("RECEIVED".equalsIgnoreCase(po.getReceivedStatus())) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Phiếu nhập hàng này đã được xác nhận nhận hàng trước đó."));
        }
        if ("CANCELLED".equalsIgnoreCase(po.getReceivedStatus())) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Không thể nhận hàng cho phiếu nhập đã bị hủy."));
        }

        // Apply stock & weighted average cost
        List<Map<String, Object>> items = extractPurchaseItems(po);
        for (Map<String, Object> it : items) {
            String pid = (String) it.get("productId");
            String vid = (String) it.get("variantId");
            int q = (int) it.get("quantity");
            double c = (double) it.get("unitCost");
            applyPurchaseItemStockAndCost(po.getSupplierName(), po.getId(), pid, vid, q, c, actor);
        }

        po.setReceivedStatus("RECEIVED");
        po.setReceivedAt(Instant.now().toString());
        po.setReceivedByUserId(actor.getId());
        po.setReceivedByName(actor.getName());
        PurchaseOrder saved = purchaseOrderRepository.save(po);

        writeAuditLog("PURCHASE", saved.getId(), "RECEIVE", actor, Map.of(
                "receivedStatus", "RECEIVED",
                "receivedAt", saved.getReceivedAt()
        ));
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/purchases/{id}/pay")
    @Transactional
    public ResponseEntity<?> payPurchase(
            @PathVariable String id,
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId,
            @RequestBody Map<String, Object> body
    ) {
        User actor = rbacService.requireAnyPermission(
                actorHeaderId,
                null,
                "Bạn không có quyền ghi nhận thanh toán công nợ nhập hàng.",
                RbacService.PERM_INVENTORY_PURCHASE_PAY,
                RbacService.PERM_FINANCE_RECORD_EXPENSE
        );
        Optional<PurchaseOrder> opt = purchaseOrderRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();

        PurchaseOrder po = opt.get();
        double currentDebt = po.getDebtAmount() != null ? po.getDebtAmount() : Math.max(0.0, po.getTotalAmount() - po.getPaidAmount());
        if (currentDebt <= 0.01) {
            return ResponseEntity.badRequest().body(Map.of("error", "Phiếu nhập hàng này đã được thanh toán đầy đủ công nợ."));
        }

        double payAmount = parseDouble(body.get("amount"));
        if (payAmount <= 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Số tiền thanh toán phải lớn hơn 0."));
        }
        if (payAmount > currentDebt + 0.01) {
            return ResponseEntity.badRequest().body(Map.of("error", "Số tiền thanh toán (" + payAmount + " ₫) vượt quá công nợ còn lại (" + currentDebt + " ₫)."));
        }

        String payMethod = trim(body.get("paymentMethod"));
        if (payMethod.isEmpty()) payMethod = "Chuyển khoản ngân hàng";
        String payDate = trim(body.get("paymentDate"));
        if (payDate.isEmpty()) {
            payDate = (po.getPurchaseDate() != null && !po.getPurchaseDate().isBlank()) ? extractDate(po.getPurchaseDate()) : LocalDate.now().toString();
        }
        String note = trim(body.get("note"));

        double newPaid = (po.getPaidAmount() != null ? po.getPaidAmount() : 0.0) + payAmount;
        double newDebt = Math.max(0.0, po.getTotalAmount() - newPaid);
        po.setPaidAmount(newPaid);
        po.setDebtAmount(newDebt);
        po.setPaymentStatus(newDebt <= 0.01 ? "PAID" : "PARTIALLY_PAID");
        po.setPaymentDate(payDate);
        PurchaseOrder savedPo = purchaseOrderRepository.save(po);

        // Record cash outflow
        FinancialTransaction fin = new FinancialTransaction();
        fin.setId("FIN-PO-" + System.currentTimeMillis());
        fin.setTxType("EXPENSE_PURCHASE");
        fin.setCategory("Thanh toán công nợ NCC: " + po.getSupplierName());
        fin.setTxDate(payDate);
        fin.setAmount(payAmount);
        fin.setPaymentMethod(payMethod);
        fin.setNote("Trả nợ phiếu #" + po.getId() + (note.isEmpty() ? "" : " · " + note));
        fin.setPurchaseOrderId(po.getId());
        fin.setReconciled(false);
        fin.setCreatedByUserId(actor.getId());
        fin.setCreatedByName(actor.getName());
        fin.setCreatedAt(Instant.now().toString());
        txRepository.save(fin);

        writeAuditLog("PURCHASE", po.getId(), "PAY", actor, Map.of(
                "paidAmountThisTime", payAmount,
                "totalPaidAmount", newPaid,
                "remainingDebt", newDebt,
                "paymentStatus", po.getPaymentStatus()
        ));

        return ResponseEntity.ok(savedPo);
    }

    @PostMapping("/purchases/{id}/cancel")
    @Transactional
    public ResponseEntity<?> cancelPurchase(
            @PathVariable String id,
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId,
            @RequestBody(required = false) Map<String, Object> body
    ) {
        User actor = rbacService.requireAnyPermission(
                actorHeaderId,
                null,
                "Bạn không có quyền hủy phiếu nhập hàng.",
                RbacService.PERM_INVENTORY_PURCHASE_RECEIVE,
                RbacService.PERM_PRODUCTS_MANAGE
        );
        Optional<PurchaseOrder> opt = purchaseOrderRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();

        PurchaseOrder po = opt.get();
        if ("CANCELLED".equalsIgnoreCase(po.getReceivedStatus())) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Phiếu nhập hàng này đã bị hủy trước đó."));
        }

        String reason = body != null ? trim(body.get("reason")) : "";
        if (reason.isEmpty()) reason = "Hủy phiếu nhập kho theo yêu cầu";

        // If was RECEIVED, revert stock
        if ("RECEIVED".equalsIgnoreCase(po.getReceivedStatus())) {
            List<Map<String, Object>> items = extractPurchaseItems(po);
            for (Map<String, Object> it : items) {
                String pid = (String) it.get("productId");
                String vid = (String) it.get("variantId");
                int q = (int) it.get("quantity");
                revertPurchaseItemStock(po.getId(), pid, vid, q, reason, actor);
            }
        }

        po.setReceivedStatus("CANCELLED");
        po.setCancellationReason(reason);
        po.setCancelledAt(Instant.now().toString());
        po.setCancelledByUserId(actor.getId());
        po.setCancelledByName(actor.getName());
        PurchaseOrder savedPo = purchaseOrderRepository.save(po);

        writeAuditLog("PURCHASE", po.getId(), "CANCEL", actor, Map.of(
                "reason", reason,
                "previousReceivedStatus", po.getReceivedStatus()
        ));

        return ResponseEntity.ok(savedPo);
    }

    @GetMapping("/inventory/movements")
    public List<InventoryMovement> getInventoryMovements(
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId,
            @RequestParam(required = false) String productId,
            @RequestParam(required = false) String movementType,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to
    ) {
        rbacService.requireAnyPermission(
                actorHeaderId,
                null,
                "Bạn không có quyền xem sổ biến động kho.",
                RbacService.PERM_INVENTORY_PURCHASE_VIEW,
                RbacService.PERM_PRODUCTS_PRICE_STOCK,
                RbacService.PERM_PRODUCTS_MANAGE
        );
        if (movementRepository == null) return Collections.emptyList();

        List<InventoryMovement> list = movementRepository.findAllByOrderByCreatedAtDesc();
        String fromDate = normalizeDateParam(from);
        String toDate = normalizeDateParam(to);

        return list.stream().filter(m -> {
            if (productId != null && !productId.isBlank() && !productId.equals(m.getProductId())) return false;
            if (movementType != null && !movementType.isBlank() && !"all".equalsIgnoreCase(movementType) && !movementType.equalsIgnoreCase(m.getMovementType())) return false;
            String d = extractDate(m.getCreatedAt());
            return inRange(d, fromDate, toDate);
        }).toList();
    }

    @PostMapping("/inventory/adjust")
    @Transactional
    public ResponseEntity<?> adjustInventoryStock(
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId,
            @RequestBody Map<String, Object> body
    ) {
        User actor = rbacService.requireAnyPermission(
                actorHeaderId,
                null,
                "Bạn không có quyền điều chỉnh tồn kho kiểm kê.",
                RbacService.PERM_INVENTORY_ADJUST,
                RbacService.PERM_PRODUCTS_PRICE_STOCK,
                RbacService.PERM_PRODUCTS_MANAGE
        );

        String productId = trim(body.get("productId"));
        String variantId = trim(body.get("variantId"));
        String reason = trim(body.get("reason"));
        String note = trim(body.get("note"));

        if (productId.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Vui lòng chọn sản phẩm cần điều chỉnh tồn kho."));
        }
        if (reason.isEmpty()) {
            reason = "Điều chỉnh kiểm kê định kỳ";
        }

        Optional<Product> prodOpt = productRepository.findById(productId);
        if (prodOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Không tìm thấy sản phẩm."));
        }
        Product product = prodOpt.get();

        int prevTotalStock = product.getStock() != null ? product.getStock() : 0;
        int prevTargetStock = prevTotalStock;
        int newTargetStock;
        int quantityChange;
        String variantName = null;
        boolean updatedVariant = false;

        if (body.containsKey("newStock")) {
            newTargetStock = Math.max(0, body.get("newStock") instanceof Number n ? n.intValue() : (int) parseDouble(body.get("newStock")));
        } else if (body.containsKey("quantityChange")) {
            int change = body.get("quantityChange") instanceof Number n ? n.intValue() : (int) parseDouble(body.get("quantityChange"));
            newTargetStock = Math.max(0, prevTargetStock + change);
        } else {
            return ResponseEntity.badRequest().body(Map.of("error", "Vui lòng cung cấp newStock hoặc quantityChange."));
        }

        if (!variantId.isEmpty() && product.getVariantsJson() != null && !product.getVariantsJson().isBlank()) {
            try {
                JsonNode vNode = objectMapper.readTree(product.getVariantsJson());
                if (vNode.isArray()) {
                    ArrayNode arr = (ArrayNode) vNode;
                    int newTotalVarStock = 0;
                    for (JsonNode v : arr) {
                        if (v.isObject()) {
                            ObjectNode vo = (ObjectNode) v;
                            int vs = vo.path("stock").asInt(0);
                            String vid = vo.path("id").asText("");
                            if (variantId.equals(vid)) {
                                prevTargetStock = vs;
                                vs = newTargetStock;
                                vo.put("stock", vs);
                                vo.put("status", vs == 0 ? "Tạm hết hàng" : (vs <= 15 ? "Sắp hết" : "Còn hàng"));
                                variantName = vo.path("name").asText(variantId);
                                updatedVariant = true;
                            }
                            newTotalVarStock += vs;
                        }
                    }
                    if (updatedVariant) {
                        product.setVariantsJson(objectMapper.writeValueAsString(arr));
                        product.setStock(newTotalVarStock);
                        product.setStatus(newTotalVarStock == 0 ? "Hết hàng" : (newTotalVarStock <= 15 ? "Sắp hết" : "Còn hàng"));
                    }
                }
            } catch (Exception ignored) {}
        }

        quantityChange = newTargetStock - prevTargetStock;

        if (!updatedVariant) {
            product.setStock(newTargetStock);
            product.setStatus(newTargetStock == 0 ? "Hết hàng" : (newTargetStock <= 15 ? "Sắp hết" : "Còn hàng"));
        }

        product.setUpdatedAt(Instant.now().toString());
        product.setUpdatedBy(actor.getName());
        Product savedProduct = productRepository.save(product);

        // Record InventoryMovement (strictly NO financial cash out!)
        if (movementRepository != null) {
            InventoryMovement mov = new InventoryMovement();
            mov.setId("MOV-" + System.currentTimeMillis() + "-" + Math.abs(productId.hashCode() % 1000));
            mov.setProductId(product.getId());
            mov.setProductName(product.getName());
            mov.setVariantId(variantId.isEmpty() ? null : variantId);
            mov.setVariantName(variantName);
            mov.setMovementType("STOCK_ADJUSTMENT");
            mov.setQuantityChange(quantityChange);
            mov.setPreviousStock(prevTargetStock);
            mov.setNewStock(newTargetStock);
            mov.setUnitCost(product.getCostPrice());
            mov.setReferenceType("MANUAL_ADJUSTMENT");
            mov.setReferenceId("ADJ-" + System.currentTimeMillis());
            mov.setReason(reason + (note.isEmpty() ? "" : " · " + note));
            mov.setCreatedByUserId(actor.getId());
            mov.setCreatedByName(actor.getName());
            mov.setCreatedAt(Instant.now().toString());
            movementRepository.save(mov);
        }

        writeAuditLog("INVENTORY", product.getId(), "ADJUST", actor, Map.of(
                "variantId", variantId,
                "previousStock", prevTargetStock,
                "newStock", newTargetStock,
                "quantityChange", quantityChange,
                "reason", reason
        ));

        return ResponseEntity.ok(savedProduct);
    }

    private List<Map<String, Object>> extractPurchaseItems(PurchaseOrder po) {
        List<Map<String, Object>> res = new ArrayList<>();
        if (po.getItemsJson() != null && !po.getItemsJson().isBlank()) {
            try {
                JsonNode arr = objectMapper.readTree(po.getItemsJson());
                if (arr.isArray()) {
                    for (JsonNode it : arr) {
                        Map<String, Object> m = new LinkedHashMap<>();
                        m.put("productId", it.path("productId").asText(""));
                        m.put("productName", it.path("productName").asText(""));
                        m.put("variantId", it.has("variantId") && !it.get("variantId").isNull() ? it.get("variantId").asText("") : null);
                        m.put("variantName", it.has("variantName") && !it.get("variantName").isNull() ? it.get("variantName").asText("") : null);
                        m.put("quantity", it.path("quantity").asInt(1));
                        m.put("unitCost", it.path("unitCost").asDouble(0.0));
                        m.put("discount", it.path("discount").asDouble(0.0));
                        m.put("subtotal", it.path("subtotal").asDouble(0.0));
                        res.add(m);
                    }
                }
            } catch (Exception ignored) {}
        }
        if (res.isEmpty() && po.getProductId() != null && !po.getProductId().isBlank()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("productId", po.getProductId());
            m.put("productName", po.getProductName() != null ? po.getProductName() : "");
            m.put("variantId", po.getVariantId());
            m.put("variantName", po.getVariantName());
            m.put("quantity", po.getQuantity() != null ? po.getQuantity() : 1);
            m.put("unitCost", po.getUnitCost() != null ? po.getUnitCost() : 0.0);
            m.put("discount", 0.0);
            m.put("subtotal", po.getTotalAmount() != null ? po.getTotalAmount() : 0.0);
            res.add(m);
        }
        return res;
    }

    private void applyPurchaseItemStockAndCost(String supplierName, String poId, String productId, String variantId, int quantity, double unitCost, User actor) {
        if (productId == null || productId.isBlank() || quantity <= 0) return;
        Optional<Product> prodOpt = productRepository.findById(productId);
        if (prodOpt.isEmpty()) return;
        Product product = prodOpt.get();

        int prevTotalStock = product.getStock() != null ? product.getStock() : 0;
        int prevTargetStock = prevTotalStock;
        Double prevCost = product.getCostPrice();
        String variantName = null;
        boolean updatedVariant = false;

        if (variantId != null && !variantId.isBlank() && product.getVariantsJson() != null && !product.getVariantsJson().isBlank()) {
            try {
                JsonNode vNode = objectMapper.readTree(product.getVariantsJson());
                if (vNode.isArray()) {
                    ArrayNode arr = (ArrayNode) vNode;
                    int newTotalVarStock = 0;
                    for (JsonNode v : arr) {
                        if (v.isObject()) {
                            ObjectNode vo = (ObjectNode) v;
                            int vs = vo.path("stock").asInt(0);
                            String vid = vo.path("id").asText("");
                            if (variantId.equals(vid)) {
                                prevTargetStock = vs;
                                Double oldVarCost = vo.has("costPrice") && vo.get("costPrice").isNumber() ? vo.get("costPrice").asDouble() : prevCost;
                                Double newVarCost;
                                if (vs <= 0 || oldVarCost == null || oldVarCost <= 0) {
                                    newVarCost = unitCost;
                                } else {
                                    newVarCost = ((vs * oldVarCost) + (quantity * unitCost)) / (vs + quantity);
                                }
                                vs += quantity;
                                vo.put("stock", vs);
                                vo.put("costPrice", Math.round(newVarCost * 100.0) / 100.0);
                                vo.put("status", vs == 0 ? "Tạm hết hàng" : (vs <= 15 ? "Sắp hết" : "Còn hàng"));
                                variantName = vo.path("name").asText(variantId);
                                updatedVariant = true;
                            }
                            newTotalVarStock += vs;
                        }
                    }
                    if (updatedVariant) {
                        product.setVariantsJson(objectMapper.writeValueAsString(arr));
                        product.setStock(newTotalVarStock);
                        product.setStatus(newTotalVarStock == 0 ? "Hết hàng" : (newTotalVarStock <= 15 ? "Sắp hết" : "Còn hàng"));
                    }
                }
            } catch (Exception ignored) {}
        }

        if (!updatedVariant) {
            int newTotal = prevTotalStock + quantity;
            product.setStock(newTotal);
            product.setStatus(newTotal == 0 ? "Hết hàng" : (newTotal <= 15 ? "Sắp hết" : "Còn hàng"));
        }

        // Weighted Average Cost for product
        Double newProductCost;
        if (prevTotalStock <= 0 || prevCost == null || prevCost <= 0) {
            newProductCost = unitCost;
        } else {
            newProductCost = ((prevTotalStock * prevCost) + (quantity * unitCost)) / (prevTotalStock + quantity);
        }
        product.setCostPrice(Math.round(newProductCost * 100.0) / 100.0);
        product.setUpdatedAt(Instant.now().toString());
        product.setUpdatedBy(actor.getName());
        productRepository.save(product);

        // Record InventoryMovement
        if (movementRepository != null) {
            InventoryMovement mov = new InventoryMovement();
            mov.setId("MOV-" + System.currentTimeMillis() + "-" + Math.abs(productId.hashCode() % 1000));
            mov.setProductId(product.getId());
            mov.setProductName(product.getName());
            mov.setVariantId(variantId != null && !variantId.isBlank() ? variantId : null);
            mov.setVariantName(variantName);
            mov.setMovementType("PURCHASE_RECEIPT");
            mov.setQuantityChange(quantity);
            mov.setPreviousStock(prevTargetStock);
            mov.setNewStock(prevTargetStock + quantity);
            mov.setUnitCost(unitCost);
            mov.setReferenceType("PURCHASE_ORDER");
            mov.setReferenceId(poId);
            mov.setReason("Nhập hàng từ NCC: " + supplierName);
            mov.setCreatedByUserId(actor.getId());
            mov.setCreatedByName(actor.getName());
            mov.setCreatedAt(Instant.now().toString());
            movementRepository.save(mov);
        }
    }

    private void revertPurchaseItemStock(String poId, String productId, String variantId, int quantity, String reason, User actor) {
        if (productId == null || productId.isBlank() || quantity <= 0) return;
        Optional<Product> prodOpt = productRepository.findById(productId);
        if (prodOpt.isEmpty()) return;
        Product product = prodOpt.get();

        int prevTotalStock = product.getStock() != null ? product.getStock() : 0;
        int prevTargetStock = prevTotalStock;
        String variantName = null;
        boolean updatedVariant = false;

        if (variantId != null && !variantId.isBlank() && product.getVariantsJson() != null && !product.getVariantsJson().isBlank()) {
            try {
                JsonNode vNode = objectMapper.readTree(product.getVariantsJson());
                if (vNode.isArray()) {
                    ArrayNode arr = (ArrayNode) vNode;
                    int newTotalVarStock = 0;
                    for (JsonNode v : arr) {
                        if (v.isObject()) {
                            ObjectNode vo = (ObjectNode) v;
                            int vs = vo.path("stock").asInt(0);
                            String vid = vo.path("id").asText("");
                            if (variantId.equals(vid)) {
                                prevTargetStock = vs;
                                vs = Math.max(0, vs - quantity);
                                vo.put("stock", vs);
                                vo.put("status", vs == 0 ? "Tạm hết hàng" : (vs <= 15 ? "Sắp hết" : "Còn hàng"));
                                variantName = vo.path("name").asText(variantId);
                                updatedVariant = true;
                            }
                            newTotalVarStock += vs;
                        }
                    }
                    if (updatedVariant) {
                        product.setVariantsJson(objectMapper.writeValueAsString(arr));
                        product.setStock(newTotalVarStock);
                        product.setStatus(newTotalVarStock == 0 ? "Hết hàng" : (newTotalVarStock <= 15 ? "Sắp hết" : "Còn hàng"));
                    }
                }
            } catch (Exception ignored) {}
        }

        if (!updatedVariant) {
            int newTotal = Math.max(0, prevTotalStock - quantity);
            product.setStock(newTotal);
            product.setStatus(newTotal == 0 ? "Hết hàng" : (newTotal <= 15 ? "Sắp hết" : "Còn hàng"));
        }

        product.setUpdatedAt(Instant.now().toString());
        product.setUpdatedBy(actor.getName());
        productRepository.save(product);

        if (movementRepository != null) {
            InventoryMovement mov = new InventoryMovement();
            mov.setId("MOV-" + System.currentTimeMillis() + "-" + Math.abs(productId.hashCode() % 1000));
            mov.setProductId(product.getId());
            mov.setProductName(product.getName());
            mov.setVariantId(variantId != null && !variantId.isBlank() ? variantId : null);
            mov.setVariantName(variantName);
            mov.setMovementType("PURCHASE_RETURN");
            mov.setQuantityChange(-quantity);
            mov.setPreviousStock(prevTargetStock);
            mov.setNewStock(Math.max(0, prevTargetStock - quantity));
            mov.setUnitCost(product.getCostPrice());
            mov.setReferenceType("PURCHASE_ORDER");
            mov.setReferenceId(poId);
            mov.setReason("Hủy phiếu nhập: " + reason);
            mov.setCreatedByUserId(actor.getId());
            mov.setCreatedByName(actor.getName());
            mov.setCreatedAt(Instant.now().toString());
            movementRepository.save(mov);
        }
    }

    @GetMapping("/payrolls")
    public List<PayrollRecord> getPayrolls(
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId
    ) {
        rbacService.requireAnyPermission(
                actorHeaderId,
                null,
                "Bạn không có quyền truy cập dữ liệu lương nhân viên.",
                RbacService.PERM_FINANCE_PAYROLL_VIEW
        );
        return payrollRepository.findAllByOrderByPeriodMonthDescCreatedAtDesc();
    }

    @PostMapping("/payrolls")
    @Transactional
    public ResponseEntity<?> createPayroll(
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId,
            @RequestBody Map<String, Object> body
    ) {
        User actor = rbacService.requireAnyPermission(
                actorHeaderId,
                null,
                "Bạn không có quyền tạo bảng lương nhân viên.",
                RbacService.PERM_FINANCE_PAYROLL_VIEW
        );
        String employeeUserId = trim(body.get("employeeUserId"));
        String periodMonth = trim(body.get("periodMonth"));
        double baseSalary = body.get("baseSalary") instanceof Number n ? n.doubleValue() : parseDouble(body.get("baseSalary"));
        double bonus = body.get("bonus") instanceof Number n ? n.doubleValue() : parseDouble(body.get("bonus"));
        double deduction = body.get("deduction") instanceof Number n ? n.doubleValue() : parseDouble(body.get("deduction"));
        String note = trim(body.get("note"));

        if (employeeUserId.isEmpty() || periodMonth.isEmpty() || baseSalary < 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Vui lòng chọn nhân viên, kỳ lương và mức lương hợp lệ."));
        }
        Optional<User> empOpt = userRepository.findById(employeeUserId);
        if (empOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Không tìm thấy nhân viên."));
        }
        User emp = empOpt.get();
        double netAmount = Math.max(0.0, baseSalary + bonus - deduction);

        PayrollRecord pr = new PayrollRecord();
        pr.setId("PAY-" + System.currentTimeMillis());
        pr.setEmployeeUserId(emp.getId());
        pr.setEmployeeName(emp.getName());
        pr.setPeriodMonth(periodMonth);
        pr.setBaseSalary(baseSalary);
        pr.setBonus(bonus);
        pr.setDeduction(deduction);
        pr.setNetAmount(netAmount);
        pr.setStatus("UNPAID");
        pr.setNote(note);
        pr.setCreatedByUserId(actor.getId());
        pr.setCreatedByName(actor.getName());
        pr.setCreatedAt(Instant.now().toString());
        PayrollRecord saved = payrollRepository.save(pr);

        writeAuditLog("PAYROLL", saved.getId(), "CREATE", actor, Map.of(
                "employeeUserId", emp.getId(),
                "periodMonth", periodMonth,
                "netAmount", netAmount
        ));
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/payrolls/{id}")
    @Transactional
    public ResponseEntity<?> updatePayroll(
            @PathVariable String id,
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId,
            @RequestBody Map<String, Object> body
    ) {
        User actor = rbacService.requireAnyPermission(
                actorHeaderId,
                null,
                "Bạn không có quyền chỉnh sửa bảng lương nhân viên.",
                RbacService.PERM_FINANCE_PAYROLL_VIEW
        );
        Optional<PayrollRecord> opt = payrollRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();
        PayrollRecord pr = opt.get();
        if ("PAID".equalsIgnoreCase(pr.getStatus())) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "Bảng lương đã thanh toán, không thể chỉnh sửa."));
        }

        if (body.containsKey("baseSalary") && body.get("baseSalary") != null) {
            double base = parseDouble(body.get("baseSalary"));
            if (base < 0) {
                return ResponseEntity.badRequest().body(Map.of("error", "Mức lương cơ bản không thể âm."));
            }
            pr.setBaseSalary(base);
            Optional<User> empOpt = userRepository.findById(pr.getEmployeeUserId());
            if (empOpt.isPresent() && (empOpt.get().getBaseSalary() == null || empOpt.get().getBaseSalary() <= 0 || Boolean.TRUE.equals(body.get("saveToProfile")))) {
                User emp = empOpt.get();
                emp.setBaseSalary(base);
                userRepository.save(emp);
            }
        }
        if (body.containsKey("bonus") && body.get("bonus") != null) {
            pr.setBonus(Math.max(0.0, parseDouble(body.get("bonus"))));
        }
        if (body.containsKey("deduction") && body.get("deduction") != null) {
            pr.setDeduction(Math.max(0.0, parseDouble(body.get("deduction"))));
        }
        if (body.containsKey("dueDate") && body.get("dueDate") != null) {
            pr.setDueDate(body.get("dueDate").toString().trim());
        }
        if (body.containsKey("note")) {
            pr.setNote(body.get("note") != null ? body.get("note").toString().trim() : "");
        }

        double base = pr.getBaseSalary() != null ? pr.getBaseSalary() : 0.0;
        double bonus = pr.getBonus() != null ? pr.getBonus() : 0.0;
        double deduction = pr.getDeduction() != null ? pr.getDeduction() : 0.0;
        double net = Math.max(0.0, base + bonus - deduction);
        pr.setNetAmount(net);

        String today = LocalDate.now().toString();
        if (base <= 0) {
            pr.setStatus("MISSING_SALARY");
        } else {
            String due = pr.getDueDate() != null && !pr.getDueDate().isBlank() ? pr.getDueDate() : "2026-11-10";
            pr.setStatus(today.compareTo(due) >= 0 ? "DUE" : "UNPAID");
        }
        pr.setUpdatedAt(Instant.now().toString());
        PayrollRecord saved = payrollRepository.save(pr);

        writeAuditLog("PAYROLL", saved.getId(), "UPDATE_SALARY", actor, Map.of(
                "employeeUserId", saved.getEmployeeUserId(),
                "baseSalary", saved.getBaseSalary(),
                "bonus", bonus,
                "deduction", deduction,
                "netAmount", net,
                "status", saved.getStatus()
        ));
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/payrolls/{id}/pay")
    @Transactional
    public ResponseEntity<?> markPayrollPaid(
            @PathVariable String id,
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId,
            @RequestBody(required = false) Map<String, Object> body
    ) {
        User actor = rbacService.requireAnyPermission(
                actorHeaderId,
                null,
                "Bạn không có quyền xác nhận chi lương nhân viên.",
                RbacService.PERM_FINANCE_PAYROLL_VIEW
        );
        Optional<PayrollRecord> opt = payrollRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();

        PayrollRecord pr = opt.get();
        if ("PAID".equalsIgnoreCase(pr.getStatus())) {
            return ResponseEntity.ok(pr);
        }
        if (pr.getBaseSalary() == null || pr.getBaseSalary() <= 0 || "MISSING_SALARY".equalsIgnoreCase(pr.getStatus())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Nhân viên chưa có mức lương hợp lệ trong bảng lương. Vui lòng nhập mức lương trước khi xác nhận chi trả."));
        }
        String paymentMethod = body != null && body.get("paymentMethod") != null
                ? body.get("paymentMethod").toString().trim()
                : "Chuyển khoản ngân hàng";

        pr.setStatus("PAID");
        pr.setPaidAt(Instant.now().toString());
        pr.setPaymentMethod(paymentMethod);
        pr.setUpdatedAt(Instant.now().toString());
        PayrollRecord saved = payrollRepository.save(pr);

        // Idempotent financial transaction link
        if (txRepository.findByPayrollId(saved.getId()).isEmpty()) {
            FinancialTransaction fin = new FinancialTransaction();
            fin.setId("FIN-PAY-" + System.currentTimeMillis());
            fin.setTxType("EXPENSE_PAYROLL");
            fin.setCategory("Chi lương kỳ " + saved.getPeriodMonth() + ": " + saved.getEmployeeName());
            fin.setTxDate(LocalDate.now().toString());
            fin.setAmount(saved.getNetAmount());
            fin.setPaymentMethod(paymentMethod);
            fin.setNote(saved.getNote());
            fin.setPayrollId(saved.getId());
            fin.setReconciled(false);
            fin.setCreatedByUserId(actor.getId());
            fin.setCreatedByName(actor.getName());
            fin.setCreatedAt(Instant.now().toString());
            txRepository.save(fin);
        }

        writeAuditLog("PAYROLL", saved.getId(), "PAY", actor, Map.of(
                "netAmount", saved.getNetAmount(),
                "paymentMethod", paymentMethod
        ));
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/audit-logs")
    public List<FinancialAuditLog> getAuditLogs(
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId
    ) {
        rbacService.requireAnyPermission(
                actorHeaderId,
                null,
                "Bạn không có quyền xem nhật ký kiểm toán tài chính.",
                RbacService.PERM_FINANCE_VIEW,
                RbacService.PERM_REPORTS_VIEW
        );
        return auditLogRepository.findTop100ByOrderByIdDesc();
    }

    private void writeAuditLog(String entityType, String entityId, String action, User actor, Map<String, Object> details) {
        FinancialAuditLog logEntry = new FinancialAuditLog();
        logEntry.setEntityType(entityType);
        logEntry.setEntityId(entityId);
        logEntry.setAction(action);
        logEntry.setActorUserId(actor.getId());
        logEntry.setActorName(actor.getName());
        logEntry.setActorRole(actor.getRole());
        logEntry.setCreatedAt(Instant.now().toString());
        try {
            logEntry.setDetailsJson(objectMapper.writeValueAsString(details));
        } catch (Exception e) {
            logEntry.setDetailsJson("{}");
        }
        auditLogRepository.save(logEntry);
    }

    private void addSeries(Map<String, double[]> map, String date, int index, double value) {
        if (date == null || date.isEmpty()) return;
        double[] vals = map.computeIfAbsent(date, k -> new double[3]);
        vals[index] += value;
    }

    private String normalizeDateParam(String s) {
        if (s == null || s.trim().isEmpty()) return null;
        String t = s.trim();
        return t.length() >= 10 ? t.substring(0, 10) : t;
    }

    private String extractDate(String raw) {
        if (raw == null || raw.trim().isEmpty()) return "";
        String t = raw.trim();
        return t.length() >= 10 ? t.substring(0, 10) : t;
    }

    private boolean inRange(String date, String from, String to) {
        if (date == null || date.isEmpty()) return from == null && to == null;
        if (from != null && date.compareTo(from) < 0) return false;
        if (to != null && date.compareTo(to) > 0) return false;
        return true;
    }

    private double parseDouble(Object val) {
        if (val == null) return 0.0;
        try {
            return Double.parseDouble(val.toString().trim());
        } catch (Exception e) {
            return 0.0;
        }
    }

    private String trim(Object s) {
        return s == null ? "" : s.toString().trim();
    }

    private void ensureDefaultPayrollsForActiveStaff() {
        try {
            LocalDate now = LocalDate.now();
            String currentMonth = String.format("%04d-%02d", now.getYear(), now.getMonthValue());
            LocalDate prevDate = now.minusMonths(1);
            String prevMonth = String.format("%04d-%02d", prevDate.getYear(), prevDate.getMonthValue());

            String[] periods = new String[]{prevMonth, currentMonth};

            List<User> activeStaff = userRepository.findAll().stream()
                    .filter(u -> Boolean.TRUE.equals(u.getActive()))
                    .filter(u -> {
                        String r = u.getRole() != null ? u.getRole().toLowerCase(Locale.ROOT) : "";
                        return "admin".equals(r) || "staff".equals(r) || "manager".equals(r);
                    })
                    .toList();

            String todayStr = now.toString();

            for (User staff : activeStaff) {
                for (String period : periods) {
                    String dueDate;
                    try {
                        String[] parts = period.split("-");
                        int y = Integer.parseInt(parts[0]);
                        int m = Integer.parseInt(parts[1]);
                        LocalDate pDate = LocalDate.of(y, m, 1);
                        LocalDate dueLocalDate = pDate.plusMonths(1).withDayOfMonth(10);
                        dueDate = dueLocalDate.toString();
                    } catch (Exception e) {
                        dueDate = period + "-10";
                    }

                    Optional<PayrollRecord> existing = payrollRepository.findByEmployeeUserIdAndPeriodMonth(staff.getId(), period);
                    if (existing.isEmpty()) {
                        PayrollRecord pr = new PayrollRecord();
                        pr.setId("PAY-" + period.replace("-", "") + "-" + staff.getId());
                        pr.setEmployeeUserId(staff.getId());
                        pr.setEmployeeName(staff.getName());
                        pr.setPeriodMonth(period);
                        pr.setDueDate(dueDate);
                        pr.setBonus(0.0);
                        pr.setDeduction(0.0);
                        pr.setCreatedAt(Instant.now().toString());

                        if (staff.getBaseSalary() != null && staff.getBaseSalary() > 0) {
                            pr.setBaseSalary(staff.getBaseSalary());
                            pr.setNetAmount(staff.getBaseSalary());
                            pr.setStatus(todayStr.compareTo(dueDate) >= 0 ? "DUE" : "UNPAID");
                        } else {
                            pr.setBaseSalary(0.0);
                            pr.setNetAmount(0.0);
                            pr.setStatus("MISSING_SALARY");
                        }
                        payrollRepository.save(pr);
                    } else {
                        PayrollRecord pr = existing.get();
                        if (pr.getDueDate() == null || pr.getDueDate().isBlank()) {
                            pr.setDueDate(dueDate);
                            payrollRepository.save(pr);
                        }
                        if (!"PAID".equalsIgnoreCase(pr.getStatus())) {
                            if ((pr.getBaseSalary() == null || pr.getBaseSalary() <= 0) && staff.getBaseSalary() != null && staff.getBaseSalary() > 0) {
                                pr.setBaseSalary(staff.getBaseSalary());
                                double net = staff.getBaseSalary() + (pr.getBonus() != null ? pr.getBonus() : 0.0) - (pr.getDeduction() != null ? pr.getDeduction() : 0.0);
                                pr.setNetAmount(net);
                            }
                            if (pr.getBaseSalary() == null || pr.getBaseSalary() <= 0) {
                                if (!"MISSING_SALARY".equalsIgnoreCase(pr.getStatus())) {
                                    pr.setStatus("MISSING_SALARY");
                                    payrollRepository.save(pr);
                                }
                            } else {
                                String expectedStatus = todayStr.compareTo(pr.getDueDate()) >= 0 ? "DUE" : "UNPAID";
                                if (!expectedStatus.equalsIgnoreCase(pr.getStatus())) {
                                    pr.setStatus(expectedStatus);
                                    payrollRepository.save(pr);
                                }
                            }
                        }
                    }
                }
            }
        } catch (Exception ignored) {}
    }

    private String getOrderCompletedDate(Order o) {
        if (o.getCompletedAt() != null && !o.getCompletedAt().isBlank()) {
            return extractDate(o.getCompletedAt());
        }
        if (o.getStatusHistoryJson() != null && !o.getStatusHistoryJson().isBlank()) {
            try {
                JsonNode arr = objectMapper.readTree(o.getStatusHistoryJson());
                if (arr.isArray()) {
                    for (int i = arr.size() - 1; i >= 0; i--) {
                        JsonNode item = arr.get(i);
                        String by = item.path("by").asText("");
                        if ("SePay API".equalsIgnoreCase(by)) continue;
                        String st = item.path("status").asText("");
                        if ("Hoàn thành".equalsIgnoreCase(st) || "HOAN_THANH".equalsIgnoreCase(st)) {
                            String t = item.path("timestamp").asText("");
                            if (t.isBlank()) t = item.path("time").asText("");
                            if (t.isBlank()) t = item.path("date").asText("");
                            if (!t.isBlank()) return extractDate(t);
                        }
                    }
                }
            } catch (Exception ignored) {}
        }
        if (o.getCreatedAt() != null && !o.getCreatedAt().isBlank()) {
            return extractDate(o.getCreatedAt());
        }
        if (o.getUpdatedAt() != null && !o.getUpdatedAt().isBlank()) {
            return extractDate(o.getUpdatedAt());
        }
        return "";
    }

    private String trimOrNull(Object s) {
        String t = trim(s);
        return t.isEmpty() ? null : t;
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
}

