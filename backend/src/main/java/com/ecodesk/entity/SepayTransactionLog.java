package com.ecodesk.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "sepay_transactions")
public class SepayTransactionLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sepay_transaction_id", nullable = false, unique = true, length = 100)
    private String sepayTransactionId;

    @Column(name = "transaction_date", length = 40)
    private String transactionDate;

    @Column(name = "account_number", length = 50)
    private String accountNumber;

    @Column(name = "bank_brand_name", length = 80)
    private String bankBrandName;

    @Column(name = "amount_in")
    private Double amountIn = 0.0;

    @Column(name = "reference_number", length = 100)
    private String referenceNumber;

    @Column(name = "extracted_code", length = 40)
    private String extractedCode;

    @Column(name = "transaction_content", length = 500)
    private String transactionContent;

    @Column(name = "matched_order_id", length = 50)
    private String matchedOrderId;

    @Column(name = "match_status", nullable = false, length = 40)
    private String matchStatus;

    @Column(name = "note", length = 255)
    private String note;

    @Column(nullable = false)
    private Boolean resolved = false;

    @Column(name = "created_at", length = 40)
    private String createdAt;

    public SepayTransactionLog() {}

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getSepayTransactionId() {
        return sepayTransactionId;
    }

    public void setSepayTransactionId(String sepayTransactionId) {
        this.sepayTransactionId = sepayTransactionId;
    }

    public String getTransactionDate() {
        return transactionDate;
    }

    public void setTransactionDate(String transactionDate) {
        this.transactionDate = transactionDate;
    }

    public String getAccountNumber() {
        return accountNumber;
    }

    public void setAccountNumber(String accountNumber) {
        this.accountNumber = accountNumber;
    }

    public String getBankBrandName() {
        return bankBrandName;
    }

    public void setBankBrandName(String bankBrandName) {
        this.bankBrandName = bankBrandName;
    }

    public Double getAmountIn() {
        return amountIn;
    }

    public void setAmountIn(Double amountIn) {
        this.amountIn = amountIn;
    }

    public String getReferenceNumber() {
        return referenceNumber;
    }

    public void setReferenceNumber(String referenceNumber) {
        this.referenceNumber = referenceNumber;
    }

    public String getExtractedCode() {
        return extractedCode;
    }

    public void setExtractedCode(String extractedCode) {
        this.extractedCode = extractedCode;
    }

    public String getTransactionContent() {
        return transactionContent;
    }

    public void setTransactionContent(String transactionContent) {
        this.transactionContent = transactionContent;
    }

    public String getMatchedOrderId() {
        return matchedOrderId;
    }

    public void setMatchedOrderId(String matchedOrderId) {
        this.matchedOrderId = matchedOrderId;
    }

    public String getMatchStatus() {
        return matchStatus;
    }

    public void setMatchStatus(String matchStatus) {
        this.matchStatus = matchStatus;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public Boolean getResolved() {
        return resolved;
    }

    public void setResolved(Boolean resolved) {
        this.resolved = resolved;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }
}

