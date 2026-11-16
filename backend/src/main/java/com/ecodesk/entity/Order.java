package com.ecodesk.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "orders")
public class Order {

    @Id
    @Column(nullable = false, length = 50)
    private String id;

    @Column(name = "user_id", length = 50)
    private String userId;

    @Column(name = "customer_name", length = 100)
    private String customerName;

    @Column(name = "customer_phone", length = 30)
    private String customerPhone;

    @Column(name = "customer_email", length = 100)
    private String customerEmail;

    @Column(name = "shipping_address", columnDefinition = "TEXT")
    private String shippingAddress;

    @Column(name = "shipping_method", length = 100)
    private String shippingMethod;

    @Column(name = "billing_address", columnDefinition = "TEXT")
    private String billingAddress;

    @Column(length = 255)
    private String note;

    @Column(name = "payment_method", length = 50)
    private String paymentMethod;

    @Column(name = "payment_status", length = 30)
    private String paymentStatus;

    @Column(name = "payment_reference", length = 40, unique = true)
    private String paymentReference;

    @Column(name = "sepay_transaction_id", length = 100, unique = true)
    private String sepayTransactionId;

    @Column(name = "payment_gateway", length = 80)
    private String paymentGateway;

    @Column(name = "payment_bank_ref", length = 100)
    private String paymentBankRef;

    @Column(name = "paid_amount")
    private Double paidAmount;

    @Column(name = "paid_at", length = 40)
    private String paidAt;

    @Column(name = "payment_review_reason", length = 255)
    private String paymentReviewReason;

    @Column(name = "subtotal")
    private Double subtotal = 0.0;

    @Column(name = "discount")
    private Double discount = 0.0;

    @Column(name = "shipping_fee")
    private Double shippingFee = 0.0;

    @Column(nullable = false)
    private Double total = 0.0;

    @Column(length = 50)
    private String status = "Chờ xác nhận";

    @Column(name = "items_json", columnDefinition = "LONGTEXT")
    private String itemsJson;

    @Column(name = "created_at", length = 40)
    private String createdAt;

    @Column(name = "cancel_reason", length = 255)
    private String cancelReason;

    @Column(name = "cancelled_at", length = 40)
    private String cancelledAt;

    @Column(name = "cancelled_by", length = 50)
    private String cancelledBy;

    @Column(name = "cancel_request_status", length = 20)
    private String cancelRequestStatus;

    @Column(name = "cancel_request_reason", length = 255)
    private String cancelRequestReason;

    @Column(name = "cancel_requested_at", length = 40)
    private String cancelRequestedAt;

    @Column(name = "cancel_requested_by", length = 80)
    private String cancelRequestedBy;

    @Column(name = "cancel_reviewed_at", length = 40)
    private String cancelReviewedAt;

    @Column(name = "cancel_reviewed_by", length = 80)
    private String cancelReviewedBy;

    @Column(name = "cancel_reject_reason", length = 255)
    private String cancelRejectReason;

    @Column(name = "refund_status", length = 30)
    private String refundStatus;

    @Column(name = "stock_restored")
    private Boolean stockRestored = false;

    @Column(name = "updated_at", length = 40)
    private String updatedAt;

    @Column(name = "completed_at", length = 40)
    private String completedAt;

    @Column(name = "completed_by", length = 80)
    private String completedBy;

    @Column(name = "order_source", length = 20)
    private String orderSource;

    @Column(name = "cashier_id", length = 60)
    private String cashierId;

    @Column(name = "cashier_name", length = 100)
    private String cashierName;

    @Column(name = "shift_id", length = 60)
    private String shiftId;

    @Column(name = "cash_given")
    private Double cashGiven;

    @Column(name = "change_returned")
    private Double changeReturned;

    @Column(name = "status_history_json", columnDefinition = "LONGTEXT")
    private String statusHistoryJson;

    public Order() {}

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getCustomerName() {
        return customerName;
    }

    public void setCustomerName(String customerName) {
        this.customerName = customerName;
    }

    public String getCustomerPhone() {
        return customerPhone;
    }

    public void setCustomerPhone(String customerPhone) {
        this.customerPhone = customerPhone;
    }

    public String getCustomerEmail() {
        return customerEmail;
    }

    public void setCustomerEmail(String customerEmail) {
        this.customerEmail = customerEmail;
    }

    public String getShippingAddress() {
        return shippingAddress;
    }

    public void setShippingAddress(String shippingAddress) {
        this.shippingAddress = shippingAddress;
    }

    public String getShippingMethod() {
        return shippingMethod;
    }

    public void setShippingMethod(String shippingMethod) {
        this.shippingMethod = shippingMethod;
    }

    public String getBillingAddress() {
        return billingAddress;
    }

    public void setBillingAddress(String billingAddress) {
        this.billingAddress = billingAddress;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public String getPaymentMethod() {
        return paymentMethod;
    }

    public void setPaymentMethod(String paymentMethod) {
        this.paymentMethod = paymentMethod;
    }

    public Double getSubtotal() {
        return subtotal;
    }

    public void setSubtotal(Double subtotal) {
        this.subtotal = subtotal;
    }

    public Double getDiscount() {
        return discount;
    }

    public void setDiscount(Double discount) {
        this.discount = discount;
    }

    public Double getShippingFee() {
        return shippingFee;
    }

    public void setShippingFee(Double shippingFee) {
        this.shippingFee = shippingFee;
    }

    public Double getTotal() {
        return total;
    }

    public void setTotal(Double total) {
        this.total = total;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getItemsJson() {
        return itemsJson;
    }

    public void setItemsJson(String itemsJson) {
        this.itemsJson = itemsJson;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public String getCancelReason() {
        return cancelReason;
    }

    public void setCancelReason(String cancelReason) {
        this.cancelReason = cancelReason;
    }

    public String getCancelledAt() {
        return cancelledAt;
    }

    public void setCancelledAt(String cancelledAt) {
        this.cancelledAt = cancelledAt;
    }

    public String getCancelledBy() {
        return cancelledBy;
    }

    public void setCancelledBy(String cancelledBy) {
        this.cancelledBy = cancelledBy;
    }

    public String getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(String updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(String completedAt) {
        this.completedAt = completedAt;
    }

    public String getCompletedBy() {
        return completedBy;
    }

    public void setCompletedBy(String completedBy) {
        this.completedBy = completedBy;
    }

    public String getStatusHistoryJson() {
        return statusHistoryJson;
    }

    public void setStatusHistoryJson(String statusHistoryJson) {
        this.statusHistoryJson = statusHistoryJson;
    }

    public String getPaymentStatus() {
        return paymentStatus;
    }

    public void setPaymentStatus(String paymentStatus) {
        this.paymentStatus = paymentStatus;
    }

    public String getPaymentReference() {
        return paymentReference;
    }

    public void setPaymentReference(String paymentReference) {
        this.paymentReference = paymentReference;
    }

    public String getSepayTransactionId() {
        return sepayTransactionId;
    }

    public void setSepayTransactionId(String sepayTransactionId) {
        this.sepayTransactionId = sepayTransactionId;
    }

    public String getPaymentGateway() {
        return paymentGateway;
    }

    public void setPaymentGateway(String paymentGateway) {
        this.paymentGateway = paymentGateway;
    }

    public String getPaymentBankRef() {
        return paymentBankRef;
    }

    public void setPaymentBankRef(String paymentBankRef) {
        this.paymentBankRef = paymentBankRef;
    }

    public Double getPaidAmount() {
        return paidAmount;
    }

    public void setPaidAmount(Double paidAmount) {
        this.paidAmount = paidAmount;
    }

    public String getPaidAt() {
        return paidAt;
    }

    public void setPaidAt(String paidAt) {
        this.paidAt = paidAt;
    }

    public String getPaymentReviewReason() {
        return paymentReviewReason;
    }

    public void setPaymentReviewReason(String paymentReviewReason) {
        this.paymentReviewReason = paymentReviewReason;
    }

    public String getCancelRequestStatus() {
        return cancelRequestStatus;
    }

    public void setCancelRequestStatus(String cancelRequestStatus) {
        this.cancelRequestStatus = cancelRequestStatus;
    }

    public String getCancelRequestReason() {
        return cancelRequestReason;
    }

    public void setCancelRequestReason(String cancelRequestReason) {
        this.cancelRequestReason = cancelRequestReason;
    }

    public String getCancelRequestedAt() {
        return cancelRequestedAt;
    }

    public void setCancelRequestedAt(String cancelRequestedAt) {
        this.cancelRequestedAt = cancelRequestedAt;
    }

    public String getCancelRequestedBy() {
        return cancelRequestedBy;
    }

    public void setCancelRequestedBy(String cancelRequestedBy) {
        this.cancelRequestedBy = cancelRequestedBy;
    }

    public String getCancelReviewedAt() {
        return cancelReviewedAt;
    }

    public void setCancelReviewedAt(String cancelReviewedAt) {
        this.cancelReviewedAt = cancelReviewedAt;
    }

    public String getCancelReviewedBy() {
        return cancelReviewedBy;
    }

    public void setCancelReviewedBy(String cancelReviewedBy) {
        this.cancelReviewedBy = cancelReviewedBy;
    }

    public String getCancelRejectReason() {
        return cancelRejectReason;
    }

    public void setCancelRejectReason(String cancelRejectReason) {
        this.cancelRejectReason = cancelRejectReason;
    }

    public String getRefundStatus() {
        return refundStatus;
    }

    public void setRefundStatus(String refundStatus) {
        this.refundStatus = refundStatus;
    }

    public Boolean getStockRestored() {
        return stockRestored;
    }

    public void setStockRestored(Boolean stockRestored) {
        this.stockRestored = stockRestored;
    }

    public String getOrderSource() {
        return orderSource;
    }

    public void setOrderSource(String orderSource) {
        this.orderSource = orderSource;
    }

    public String getCashierId() {
        return cashierId;
    }

    public void setCashierId(String cashierId) {
        this.cashierId = cashierId;
    }

    public String getCashierName() {
        return cashierName;
    }

    public void setCashierName(String cashierName) {
        this.cashierName = cashierName;
    }

    public String getShiftId() {
        return shiftId;
    }

    public void setShiftId(String shiftId) {
        this.shiftId = shiftId;
    }

    public Double getCashGiven() {
        return cashGiven;
    }

    public void setCashGiven(Double cashGiven) {
        this.cashGiven = cashGiven;
    }

    public Double getChangeReturned() {
        return changeReturned;
    }

    public void setChangeReturned(Double changeReturned) {
        this.changeReturned = changeReturned;
    }
}
