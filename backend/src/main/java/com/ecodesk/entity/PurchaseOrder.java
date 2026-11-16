package com.ecodesk.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "purchase_orders")
public class PurchaseOrder {

    @Id
    @Column(nullable = false, length = 60)
    private String id;

    @Column(name = "supplier_name", nullable = false, length = 150)
    private String supplierName;

    @Column(name = "product_id", length = 50)
    private String productId;

    @Column(name = "product_name", length = 200)
    private String productName;

    @Column(name = "variant_id", length = 60)
    private String variantId;

    @Column(name = "variant_name", length = 120)
    private String variantName;

    @Column(nullable = false)
    private Integer quantity = 1;

    @Column(name = "unit_cost", nullable = false)
    private Double unitCost = 0.0;

    @Column(name = "subtotal")
    private Double subtotal = 0.0;

    @Column(name = "discount_amount")
    private Double discountAmount = 0.0;

    @Column(name = "shipping_fee")
    private Double shippingFee = 0.0;

    @Column(name = "total_amount", nullable = false)
    private Double totalAmount = 0.0;

    @Column(name = "paid_amount")
    private Double paidAmount = 0.0;

    @Column(name = "debt_amount")
    private Double debtAmount = 0.0;

    @Column(name = "purchase_date", nullable = false, length = 20)
    private String purchaseDate;

    @Column(name = "payment_method", length = 80)
    private String paymentMethod;

    @Column(name = "payment_status", length = 30)
    private String paymentStatus = "UNPAID"; // UNPAID, PARTIALLY_PAID, PAID

    @Column(name = "payment_date", length = 30)
    private String paymentDate;

    @Column(name = "received_status", nullable = false, length = 30)
    private String receivedStatus = "RECEIVED"; // DRAFT, RECEIVED, CANCELLED

    @Column(name = "received_at", length = 40)
    private String receivedAt;

    @Column(name = "received_by_user_id", length = 60)
    private String receivedByUserId;

    @Column(name = "received_by_name", length = 100)
    private String receivedByName;

    @Column(name = "items_json", columnDefinition = "LONGTEXT")
    private String itemsJson;

    @Column(name = "attachment_url", columnDefinition = "LONGTEXT")
    private String attachmentUrl;

    @Column(name = "cancellation_reason", length = 500)
    private String cancellationReason;

    @Column(name = "cancelled_at", length = 40)
    private String cancelledAt;

    @Column(name = "cancelled_by_user_id", length = 60)
    private String cancelledByUserId;

    @Column(name = "cancelled_by_name", length = 100)
    private String cancelledByName;

    @Column(length = 500)
    private String note;

    @Column(name = "created_by_user_id", length = 60)
    private String createdByUserId;

    @Column(name = "created_by_name", length = 100)
    private String createdByName;

    @Column(name = "created_at", length = 40)
    private String createdAt;

    public PurchaseOrder() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getSupplierName() { return supplierName; }
    public void setSupplierName(String supplierName) { this.supplierName = supplierName; }

    public String getProductId() { return productId; }
    public void setProductId(String productId) { this.productId = productId; }

    public String getProductName() { return productName; }
    public void setProductName(String productName) { this.productName = productName; }

    public String getVariantId() { return variantId; }
    public void setVariantId(String variantId) { this.variantId = variantId; }

    public String getVariantName() { return variantName; }
    public void setVariantName(String variantName) { this.variantName = variantName; }

    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }

    public Double getUnitCost() { return unitCost; }
    public void setUnitCost(Double unitCost) { this.unitCost = unitCost; }

    public Double getSubtotal() { return subtotal != null ? subtotal : (quantity != null && unitCost != null ? quantity * unitCost : 0.0); }
    public void setSubtotal(Double subtotal) { this.subtotal = subtotal; }

    public Double getDiscountAmount() { return discountAmount != null ? discountAmount : 0.0; }
    public void setDiscountAmount(Double discountAmount) { this.discountAmount = discountAmount; }

    public Double getShippingFee() { return shippingFee != null ? shippingFee : 0.0; }
    public void setShippingFee(Double shippingFee) { this.shippingFee = shippingFee; }

    public Double getTotalAmount() { return totalAmount; }
    public void setTotalAmount(Double totalAmount) { this.totalAmount = totalAmount; }

    public Double getPaidAmount() { return paidAmount != null ? paidAmount : 0.0; }
    public void setPaidAmount(Double paidAmount) { this.paidAmount = paidAmount; }

    public Double getDebtAmount() { return debtAmount != null ? debtAmount : Math.max(0.0, (totalAmount != null ? totalAmount : 0.0) - (paidAmount != null ? paidAmount : 0.0)); }
    public void setDebtAmount(Double debtAmount) { this.debtAmount = debtAmount; }

    public String getPurchaseDate() { return purchaseDate; }
    public void setPurchaseDate(String purchaseDate) { this.purchaseDate = purchaseDate; }

    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }

    public String getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(String paymentStatus) { this.paymentStatus = paymentStatus; }

    public String getPaymentDate() { return paymentDate; }
    public void setPaymentDate(String paymentDate) { this.paymentDate = paymentDate; }

    public String getReceivedStatus() { return receivedStatus != null ? receivedStatus : "RECEIVED"; }
    public void setReceivedStatus(String receivedStatus) { this.receivedStatus = receivedStatus; }

    public String getReceivedAt() { return receivedAt; }
    public void setReceivedAt(String receivedAt) { this.receivedAt = receivedAt; }

    public String getReceivedByUserId() { return receivedByUserId; }
    public void setReceivedByUserId(String receivedByUserId) { this.receivedByUserId = receivedByUserId; }

    public String getReceivedByName() { return receivedByName; }
    public void setReceivedByName(String receivedByName) { this.receivedByName = receivedByName; }

    public String getItemsJson() { return itemsJson; }
    public void setItemsJson(String itemsJson) { this.itemsJson = itemsJson; }

    public String getAttachmentUrl() { return attachmentUrl; }
    public void setAttachmentUrl(String attachmentUrl) { this.attachmentUrl = attachmentUrl; }

    public String getCancellationReason() { return cancellationReason; }
    public void setCancellationReason(String cancellationReason) { this.cancellationReason = cancellationReason; }

    public String getCancelledAt() { return cancelledAt; }
    public void setCancelledAt(String cancelledAt) { this.cancelledAt = cancelledAt; }

    public String getCancelledByUserId() { return cancelledByUserId; }
    public void setCancelledByUserId(String cancelledByUserId) { this.cancelledByUserId = cancelledByUserId; }

    public String getCancelledByName() { return cancelledByName; }
    public void setCancelledByName(String cancelledByName) { this.cancelledByName = cancelledByName; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }

    public String getCreatedByUserId() { return createdByUserId; }
    public void setCreatedByUserId(String createdByUserId) { this.createdByUserId = createdByUserId; }

    public String getCreatedByName() { return createdByName; }
    public void setCreatedByName(String createdByName) { this.createdByName = createdByName; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
