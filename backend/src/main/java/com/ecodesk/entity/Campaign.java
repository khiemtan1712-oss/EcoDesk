package com.ecodesk.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "campaigns")
public class Campaign {

    @Id
    @Column(nullable = false, length = 50)
    private String id;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(length = 50)
    private String badge;

    @Column(length = 50)
    private String code;

    @Column(length = 30)
    private String type = "percent";

    @Column(name = "`value`")
    private Double value = 0.0;

    @Column(name = "percent")
    private Double percent = 0.0;

    @Column(name = "product_id", length = 50)
    private String productId;

    @Column(name = "max_discount")
    private Double maxDiscount = 0.0;

    @Column(name = "min_order")
    private Double minOrder = 0.0;

    private Boolean active = true;

    @Column(name = "start_at", length = 40)
    private String startAt;

    @Column(name = "end_at", length = 40)
    private String endAt;

    @Column(columnDefinition = "TEXT")
    private String description;

    public Campaign() {}

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getBadge() {
        return badge;
    }

    public void setBadge(String badge) {
        this.badge = badge;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public Double getValue() {
        return value != null ? value : percent;
    }

    public void setValue(Double value) {
        this.value = value;
        if (this.percent == null || this.percent == 0.0) {
            this.percent = value;
        }
    }

    public Double getPercent() {
        return percent != null ? percent : value;
    }

    public void setPercent(Double percent) {
        this.percent = percent;
        if (this.value == null || this.value == 0.0) {
            this.value = percent;
        }
    }

    public String getProductId() {
        return productId;
    }

    public void setProductId(String productId) {
        this.productId = productId;
    }

    public Double getMaxDiscount() {
        return maxDiscount;
    }

    public void setMaxDiscount(Double maxDiscount) {
        this.maxDiscount = maxDiscount;
    }

    public Double getMinOrder() {
        return minOrder;
    }

    public void setMinOrder(Double minOrder) {
        this.minOrder = minOrder;
    }

    public Boolean getActive() {
        return active;
    }

    public void setActive(Boolean active) {
        this.active = active;
    }

    public String getStartAt() {
        return startAt;
    }

    public void setStartAt(String startAt) {
        this.startAt = startAt;
    }

    public String getEndAt() {
        return endAt;
    }

    public void setEndAt(String endAt) {
        this.endAt = endAt;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }
}
