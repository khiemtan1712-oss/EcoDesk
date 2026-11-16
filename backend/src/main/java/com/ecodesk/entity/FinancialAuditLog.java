package com.ecodesk.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "financial_audit_logs")
public class FinancialAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "entity_type", nullable = false, length = 40)
    private String entityType; // TRANSACTION, PURCHASE, PAYROLL

    @Column(name = "entity_id", nullable = false, length = 60)
    private String entityId;

    @Column(nullable = false, length = 30)
    private String action; // CREATE, UPDATE, RECONCILE, PAY, DELETE

    @Column(name = "actor_user_id", length = 60)
    private String actorUserId;

    @Column(name = "actor_name", length = 100)
    private String actorName;

    @Column(name = "actor_role", length = 30)
    private String actorRole;

    @Column(name = "created_at", nullable = false, length = 40)
    private String createdAt;

    @Column(name = "details_json", columnDefinition = "TEXT")
    private String detailsJson;

    public FinancialAuditLog() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }

    public String getEntityId() { return entityId; }
    public void setEntityId(String entityId) { this.entityId = entityId; }

    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }

    public String getActorUserId() { return actorUserId; }
    public void setActorUserId(String actorUserId) { this.actorUserId = actorUserId; }

    public String getActorName() { return actorName; }
    public void setActorName(String actorName) { this.actorName = actorName; }

    public String getActorRole() { return actorRole; }
    public void setActorRole(String actorRole) { this.actorRole = actorRole; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    public String getDetailsJson() { return detailsJson; }
    public void setDetailsJson(String detailsJson) { this.detailsJson = detailsJson; }
}

