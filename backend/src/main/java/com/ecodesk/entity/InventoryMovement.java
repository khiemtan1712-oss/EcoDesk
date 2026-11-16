package com.ecodesk.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "inventory_movements")
public class InventoryMovement {

    @Id
    @Column(nullable = false, length = 60)
    private String id;

    @Column(name = "product_id", nullable = false, length = 50)
    private String productId;

    @Column(name = "product_name", nullable = false, length = 200)
    private String productName;

    @Column(name = "variant_id", length = 60)
    private String variantId;

    @Column(name = "variant_name", length = 120)
    private String variantName;

    @Column(name = "movement_type", nullable = false, length = 40)
    private String movementType; // PURCHASE_RECEIPT, PURCHASE_RETURN, STOCK_ADJUSTMENT, ORDER_FULFILLMENT, ORDER_RETURN

    @Column(name = "quantity_change", nullable = false)
    private Integer quantityChange; // Dương hoặc âm

    @Column(name = "previous_stock", nullable = false)
    private Integer previousStock;

    @Column(name = "new_stock", nullable = false)
    private Integer newStock;

    @Column(name = "unit_cost")
    private Double unitCost;

    @Column(name = "reference_type", length = 40)
    private String referenceType; // PURCHASE_ORDER, ORDER, ADJUSTMENT

    @Column(name = "reference_id", length = 60)
    private String referenceId;

    @Column(length = 500)
    private String reason;

    @Column(name = "created_by_user_id", length = 60)
    private String createdByUserId;

    @Column(name = "created_by_name", length = 100)
    private String createdByName;

    @Column(name = "created_at", nullable = false, length = 40)
    private String createdAt;

    public InventoryMovement() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getProductId() { return productId; }
    public void setProductId(String productId) { this.productId = productId; }

    public String getProductName() { return productName; }
    public void setProductName(String productName) { this.productName = productName; }

    public String getVariantId() { return variantId; }
    public void setVariantId(String variantId) { this.variantId = variantId; }

    public String getVariantName() { return variantName; }
    public void setVariantName(String variantName) { this.variantName = variantName; }

    public String getMovementType() { return movementType; }
    public void setMovementType(String movementType) { this.movementType = movementType; }

    public Integer getQuantityChange() { return quantityChange; }
    public void setQuantityChange(Integer quantityChange) { this.quantityChange = quantityChange; }

    public Integer getPreviousStock() { return previousStock; }
    public void setPreviousStock(Integer previousStock) { this.previousStock = previousStock; }

    public Integer getNewStock() { return newStock; }
    public void setNewStock(Integer newStock) { this.newStock = newStock; }

    public Double getUnitCost() { return unitCost; }
    public void setUnitCost(Double unitCost) { this.unitCost = unitCost; }

    public String getReferenceType() { return referenceType; }
    public void setReferenceType(String referenceType) { this.referenceType = referenceType; }

    public String getReferenceId() { return referenceId; }
    public void setReferenceId(String referenceId) { this.referenceId = referenceId; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public String getCreatedByUserId() { return createdByUserId; }
    public void setCreatedByUserId(String createdByUserId) { this.createdByUserId = createdByUserId; }

    public String getCreatedByName() { return createdByName; }
    public void setCreatedByName(String createdByName) { this.createdByName = createdByName; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}

