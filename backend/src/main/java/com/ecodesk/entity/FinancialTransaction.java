package com.ecodesk.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "financial_transactions")
public class FinancialTransaction {

    @Id
    @Column(nullable = false, length = 60)
    private String id;

    @Column(name = "tx_type", nullable = false, length = 40)
    private String txType; // EXPENSE_OPERATING, EXPENSE_PURCHASE, EXPENSE_PAYROLL, INCOME_OTHER, REFUND_MANUAL

    @Column(nullable = false, length = 100)
    private String category;

    @Column(name = "tx_date", nullable = false, length = 20)
    private String txDate; // YYYY-MM-DD

    @Column(nullable = false)
    private Double amount;

    @Column(name = "payment_method", length = 80)
    private String paymentMethod;

    @Column(length = 500)
    private String note;

    @Column(name = "order_id", length = 60)
    private String orderId;

    @Column(name = "purchase_order_id", length = 60)
    private String purchaseOrderId;

    @Column(name = "payroll_id", length = 60)
    private String payrollId;

    @Column(name = "attachment_url", length = 500)
    private String attachmentUrl;

    @Column(nullable = false)
    private Boolean reconciled = false;

    @Column(name = "reconciled_at", length = 40)
    private String reconciledAt;

    @Column(name = "reconciled_by", length = 100)
    private String reconciledBy;

    @Column(name = "created_by_user_id", length = 60)
    private String createdByUserId;

    @Column(name = "created_by_name", length = 100)
    private String createdByName;

    @Column(name = "created_at", length = 40)
    private String createdAt;

    @Column(name = "updated_by_user_id", length = 60)
    private String updatedByUserId;

    @Column(name = "updated_by_name", length = 100)
    private String updatedByName;

    @Column(name = "updated_at", length = 40)
    private String updatedAt;

    public FinancialTransaction() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTxType() { return txType; }
    public void setTxType(String txType) { this.txType = txType; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getTxDate() { return txDate; }
    public void setTxDate(String txDate) { this.txDate = txDate; }

    public Double getAmount() { return amount; }
    public void setAmount(Double amount) { this.amount = amount; }

    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }

    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }

    public String getPurchaseOrderId() { return purchaseOrderId; }
    public void setPurchaseOrderId(String purchaseOrderId) { this.purchaseOrderId = purchaseOrderId; }

    public String getPayrollId() { return payrollId; }
    public void setPayrollId(String payrollId) { this.payrollId = payrollId; }

    public String getAttachmentUrl() { return attachmentUrl; }
    public void setAttachmentUrl(String attachmentUrl) { this.attachmentUrl = attachmentUrl; }

    public Boolean getReconciled() { return Boolean.TRUE.equals(reconciled); }
    public void setReconciled(Boolean reconciled) { this.reconciled = reconciled; }

    public String getReconciledAt() { return reconciledAt; }
    public void setReconciledAt(String reconciledAt) { this.reconciledAt = reconciledAt; }

    public String getReconciledBy() { return reconciledBy; }
    public void setReconciledBy(String reconciledBy) { this.reconciledBy = reconciledBy; }

    public String getCreatedByUserId() { return createdByUserId; }
    public void setCreatedByUserId(String createdByUserId) { this.createdByUserId = createdByUserId; }

    public String getCreatedByName() { return createdByName; }
    public void setCreatedByName(String createdByName) { this.createdByName = createdByName; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    public String getUpdatedByUserId() { return updatedByUserId; }
    public void setUpdatedByUserId(String updatedByUserId) { this.updatedByUserId = updatedByUserId; }

    public String getUpdatedByName() { return updatedByName; }
    public void setUpdatedByName(String updatedByName) { this.updatedByName = updatedByName; }

    public String getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(String updatedAt) { this.updatedAt = updatedAt; }
}

