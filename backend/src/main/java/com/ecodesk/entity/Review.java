package com.ecodesk.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "reviews", indexes = {
    @Index(name = "idx_product_id", columnList = "product_id"),
    @Index(name = "idx_order_id", columnList = "order_id"),
    @Index(name = "idx_user_id", columnList = "user_id")
})
public class Review {

    @Id
    @Column(length = 64)
    private String id;

    @Column(name = "product_id", length = 64, nullable = false)
    private String productId;

    @Column(name = "order_id", length = 64)
    private String orderId;

    @Column(name = "user_id", length = 64)
    private String userId;

    @Column(name = "user_email", length = 255)
    private String userEmail;

    @Column(name = "author_name", length = 255)
    private String authorName;

    @Column(name = "author_avatar", columnDefinition = "TEXT")
    private String authorAvatar;

    @Column(nullable = false)
    private Integer rating = 5;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String comment;

    @Column(name = "verified_purchase")
    private Boolean verifiedPurchase = false;

    @Column(name = "created_at", length = 64)
    private String createdAt;

    @Column(name = "updated_at", length = 64)
    private String updatedAt;

    @Column(name = "is_deleted")
    private Boolean isDeleted = false;

    @Column(name = "deleted_at", length = 64)
    private String deletedAt;

    @Column(name = "deleted_by", length = 64)
    private String deletedBy;

    @Column(name = "deleted_reason", length = 255)
    private String deletedReason;

    @Column(name = "admin_reply_json", columnDefinition = "TEXT")
    private String adminReplyJson;

    @Column(name = "comments_json", columnDefinition = "LONGTEXT")
    private String commentsJson = "[]";

    public Review() {}

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getProductId() {
        return productId;
    }

    public void setProductId(String productId) {
        this.productId = productId;
    }

    public String getOrderId() {
        return orderId;
    }

    public void setOrderId(String orderId) {
        this.orderId = orderId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getUserEmail() {
        return userEmail;
    }

    public void setUserEmail(String userEmail) {
        this.userEmail = userEmail;
    }

    public String getAuthorName() {
        return authorName;
    }

    public void setAuthorName(String authorName) {
        this.authorName = authorName;
    }

    public String getAuthorAvatar() {
        return authorAvatar;
    }

    public void setAuthorAvatar(String authorAvatar) {
        this.authorAvatar = authorAvatar;
    }

    public Integer getRating() {
        return rating;
    }

    public void setRating(Integer rating) {
        this.rating = rating;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public Boolean getVerifiedPurchase() {
        return verifiedPurchase;
    }

    public void setVerifiedPurchase(Boolean verifiedPurchase) {
        this.verifiedPurchase = verifiedPurchase;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public String getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(String updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Boolean getIsDeleted() {
        return isDeleted != null && isDeleted;
    }

    public void setIsDeleted(Boolean deleted) {
        this.isDeleted = deleted;
    }

    public String getDeletedAt() {
        return deletedAt;
    }

    public void setDeletedAt(String deletedAt) {
        this.deletedAt = deletedAt;
    }

    public String getDeletedBy() {
        return deletedBy;
    }

    public void setDeletedBy(String deletedBy) {
        this.deletedBy = deletedBy;
    }

    public String getDeletedReason() {
        return deletedReason;
    }

    public void setDeletedReason(String deletedReason) {
        this.deletedReason = deletedReason;
    }

    public String getAdminReplyJson() {
        return adminReplyJson;
    }

    public void setAdminReplyJson(String adminReplyJson) {
        this.adminReplyJson = adminReplyJson;
    }

    public String getCommentsJson() {
        return commentsJson;
    }

    public void setCommentsJson(String commentsJson) {
        this.commentsJson = commentsJson;
    }
}

