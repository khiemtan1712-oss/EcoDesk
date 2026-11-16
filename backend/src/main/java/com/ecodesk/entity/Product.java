package com.ecodesk.entity;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@Entity
@Table(name = "products")
public class Product {

    @Id
    @Column(nullable = false, length = 50)
    private String id;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(nullable = false)
    private Double price;

    @Column(name = "cost_price")
    private Double costPrice;

    @Column(name = "category_id", nullable = false, length = 50)
    private String categoryId;

    @Column(length = 500)
    private String image;

    @Column(columnDefinition = "TEXT")
    private String description;

    private Integer stock = 0;

    private Double rating = 0.0;

    @Column(name = "review_count")
    private Integer reviewCount = 0;

    private Integer sold = 0;

    @Column(length = 50)
    private String status = "Còn hàng";

    @Column(length = 255)
    private String tagsRaw;

    @Column(name = "created_at", length = 30)
    private String createdAt;

    @Column(name = "variants_json", columnDefinition = "LONGTEXT")
    private String variantsJson;

    @Column(name = "attributes_json", columnDefinition = "LONGTEXT")
    private String attributesJson;

    @Column(name = "new_badge_json", columnDefinition = "LONGTEXT")
    private String newBadgeJson;

    @Column(name = "discount_json", columnDefinition = "LONGTEXT")
    private String discountJson;

    @Column(name = "gallery_json", columnDefinition = "LONGTEXT")
    private String galleryJson;

    @Column(name = "updated_at", length = 35)
    private String updatedAt;

    @Column(name = "updated_by", length = 100)
    private String updatedBy;

    @Transient
    private Object variants;

    @Transient
    private Object attributes;

    @Transient
    private Boolean hasVariants;

    @Transient
    private Object newBadge;

    @Transient
    private Object discount;

    @Transient
    private Object gallery;

    private static final com.fasterxml.jackson.databind.ObjectMapper OBJECT_MAPPER = new com.fasterxml.jackson.databind.ObjectMapper();

    public Product() {}

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

    public Double getPrice() {
        return price;
    }

    public void setPrice(Double price) {
        this.price = price;
    }

    public String getCategoryId() {
        return categoryId;
    }

    public void setCategoryId(String categoryId) {
        this.categoryId = categoryId;
    }

    public String getImage() {
        return image;
    }

    public void setImage(String image) {
        this.image = image;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Integer getStock() {
        return stock;
    }

    public void setStock(Integer stock) {
        this.stock = stock;
    }

    public Double getRating() {
        return rating;
    }

    public void setRating(Double rating) {
        this.rating = rating;
    }

    public Integer getReviewCount() {
        return reviewCount;
    }

    public void setReviewCount(Integer reviewCount) {
        this.reviewCount = reviewCount;
    }

    public Integer getSold() {
        return sold;
    }

    public void setSold(Integer sold) {
        this.sold = sold;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getTagsRaw() {
        return tagsRaw;
    }

    public void setTagsRaw(String tagsRaw) {
        this.tagsRaw = tagsRaw;
    }

    @Transient
    public List<String> getTags() {
        if (tagsRaw == null || tagsRaw.trim().isEmpty()) {
            return new ArrayList<>();
        }
        return Arrays.stream(tagsRaw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    public void setTags(List<String> tags) {
        if (tags == null || tags.isEmpty()) {
            this.tagsRaw = "";
        } else {
            this.tagsRaw = String.join(", ", tags);
        }
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public String getVariantsJson() {
        return variantsJson;
    }

    public void setVariantsJson(String variantsJson) {
        this.variantsJson = variantsJson;
        if (variantsJson != null && !variantsJson.trim().isEmpty()) {
            try {
                this.variants = OBJECT_MAPPER.readValue(variantsJson, Object.class);
            } catch (Exception ignored) {}
        }
    }

    public String getAttributesJson() {
        return attributesJson;
    }

    public void setAttributesJson(String attributesJson) {
        this.attributesJson = attributesJson;
        if (attributesJson != null && !attributesJson.trim().isEmpty()) {
            try {
                this.attributes = OBJECT_MAPPER.readValue(attributesJson, Object.class);
            } catch (Exception ignored) {}
        }
    }

    @Transient
    public Object getVariants() {
        if (variants != null) return variants;
        if (variantsJson != null && !variantsJson.trim().isEmpty()) {
            try {
                return OBJECT_MAPPER.readValue(variantsJson, Object.class);
            } catch (Exception ignored) {}
        }
        return new ArrayList<>();
    }

    public void setVariants(Object variants) {
        this.variants = variants;
        if (variants != null) {
            try {
                this.variantsJson = OBJECT_MAPPER.writeValueAsString(variants);
            } catch (Exception ignored) {}
        }
    }

    @Transient
    public Object getAttributes() {
        if (attributes != null) return attributes;
        if (attributesJson != null && !attributesJson.trim().isEmpty()) {
            try {
                return OBJECT_MAPPER.readValue(attributesJson, Object.class);
            } catch (Exception ignored) {}
        }
        return new ArrayList<>();
    }

    public void setAttributes(Object attributes) {
        this.attributes = attributes;
        if (attributes != null) {
            try {
                this.attributesJson = OBJECT_MAPPER.writeValueAsString(attributes);
            } catch (Exception ignored) {}
        }
    }

    @Transient
    public Boolean getHasVariants() {
        if (hasVariants != null) return hasVariants;
        Object vars = getVariants();
        if (vars instanceof List<?> list) {
            return !list.isEmpty();
        }
        return false;
    }

    public void setHasVariants(Boolean hasVariants) {
        this.hasVariants = hasVariants;
    }

    public String getNewBadgeJson() {
        return newBadgeJson;
    }

    public void setNewBadgeJson(String newBadgeJson) {
        this.newBadgeJson = newBadgeJson;
        if (newBadgeJson != null && !newBadgeJson.trim().isEmpty()) {
            try {
                this.newBadge = OBJECT_MAPPER.readValue(newBadgeJson, Object.class);
            } catch (Exception ignored) {}
        }
    }

    public String getDiscountJson() {
        return discountJson;
    }

    public void setDiscountJson(String discountJson) {
        this.discountJson = discountJson;
        if (discountJson != null && !discountJson.trim().isEmpty()) {
            try {
                this.discount = OBJECT_MAPPER.readValue(discountJson, Object.class);
            } catch (Exception ignored) {}
        }
    }

    @Transient
    public Object getNewBadge() {
        if (newBadge != null) return newBadge;
        if (newBadgeJson != null && !newBadgeJson.trim().isEmpty()) {
            try {
                return OBJECT_MAPPER.readValue(newBadgeJson, Object.class);
            } catch (Exception ignored) {}
        }
        return null;
    }

    public void setNewBadge(Object newBadge) {
        this.newBadge = newBadge;
        if (newBadge != null) {
            try {
                this.newBadgeJson = OBJECT_MAPPER.writeValueAsString(newBadge);
            } catch (Exception ignored) {}
        }
    }

    @Transient
    public Object getDiscount() {
        if (discount != null) return discount;
        if (discountJson != null && !discountJson.trim().isEmpty()) {
            try {
                return OBJECT_MAPPER.readValue(discountJson, Object.class);
            } catch (Exception ignored) {}
        }
        return null;
    }

    public void setDiscount(Object discount) {
        this.discount = discount;
        if (discount != null) {
            try {
                this.discountJson = OBJECT_MAPPER.writeValueAsString(discount);
            } catch (Exception ignored) {}
        }
    }

    public String getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(String updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getGalleryJson() {
        return galleryJson;
    }

    public void setGalleryJson(String galleryJson) {
        this.galleryJson = galleryJson;
        if (galleryJson != null && !galleryJson.trim().isEmpty()) {
            try {
                this.gallery = OBJECT_MAPPER.readValue(galleryJson, Object.class);
            } catch (Exception ignored) {}
        }
    }

    @Transient
    public Object getGallery() {
        if (gallery != null) return gallery;
        if (galleryJson != null && !galleryJson.trim().isEmpty()) {
            try {
                return OBJECT_MAPPER.readValue(galleryJson, Object.class);
            } catch (Exception ignored) {}
        }
        return new ArrayList<>();
    }

    public void setGallery(Object gallery) {
        this.gallery = gallery;
        if (gallery != null) {
            try {
                this.galleryJson = OBJECT_MAPPER.writeValueAsString(gallery);
            } catch (Exception ignored) {}
        }
    }

    public String getUpdatedBy() {
        return updatedBy;
    }

    public void setUpdatedBy(String updatedBy) {
        this.updatedBy = updatedBy;
    }

    public Double getCostPrice() {
        return costPrice;
    }

    public void setCostPrice(Double costPrice) {
        this.costPrice = costPrice;
    }
}
