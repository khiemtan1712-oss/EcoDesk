package com.ecodesk.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "sepay_sync_state")
public class SepaySyncState {

    @Id
    @Column(length = 40)
    private String id = "default";

    @Column(name = "last_transaction_id", length = 100)
    private String lastTransactionId;

    @Column(name = "last_transaction_date", length = 40)
    private String lastTransactionDate;

    @Column(name = "last_sync_at", length = 40)
    private String lastSyncAt;

    @Column(name = "last_sync_status", length = 40)
    private String lastSyncStatus;

    @Column(name = "last_sync_message", length = 255)
    private String lastSyncMessage;

    @Column(name = "rate_limited_until_epoch_ms")
    private Long rateLimitedUntilEpochMs;

    public SepaySyncState() {}

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getLastTransactionId() {
        return lastTransactionId;
    }

    public void setLastTransactionId(String lastTransactionId) {
        this.lastTransactionId = lastTransactionId;
    }

    public String getLastTransactionDate() {
        return lastTransactionDate;
    }

    public void setLastTransactionDate(String lastTransactionDate) {
        this.lastTransactionDate = lastTransactionDate;
    }

    public String getLastSyncAt() {
        return lastSyncAt;
    }

    public void setLastSyncAt(String lastSyncAt) {
        this.lastSyncAt = lastSyncAt;
    }

    public String getLastSyncStatus() {
        return lastSyncStatus;
    }

    public void setLastSyncStatus(String lastSyncStatus) {
        this.lastSyncStatus = lastSyncStatus;
    }

    public String getLastSyncMessage() {
        return lastSyncMessage;
    }

    public void setLastSyncMessage(String lastSyncMessage) {
        this.lastSyncMessage = lastSyncMessage;
    }

    public Long getRateLimitedUntilEpochMs() {
        return rateLimitedUntilEpochMs;
    }

    public void setRateLimitedUntilEpochMs(Long rateLimitedUntilEpochMs) {
        this.rateLimitedUntilEpochMs = rateLimitedUntilEpochMs;
    }
}

