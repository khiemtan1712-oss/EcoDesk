package com.ecodesk.controller;

import com.ecodesk.entity.Product;
import com.ecodesk.repository.ProductRepository;
import com.ecodesk.service.RbacService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductRepository productRepository;
    private final RbacService rbacService;

    public ProductController(ProductRepository productRepository, RbacService rbacService) {
        this.productRepository = productRepository;
        this.rbacService = rbacService;
    }

    @GetMapping
    public List<Product> getAll(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String price,
            @RequestParam(required = false, defaultValue = "newest") String sort
    ) {
        List<Product> list = productRepository.findAll();

        if (category != null && !category.isEmpty() && !"all".equalsIgnoreCase(category)) {
            list = list.stream()
                    .filter(p -> category.equalsIgnoreCase(p.getCategoryId()))
                    .collect(Collectors.toList());
        }

        if (search != null && !search.trim().isEmpty()) {
            String q = search.trim().toLowerCase();
            list = list.stream()
                    .filter(p -> (p.getName() != null && p.getName().toLowerCase().contains(q)) ||
                                 (p.getDescription() != null && p.getDescription().toLowerCase().contains(q)))
                    .collect(Collectors.toList());
        }

        if (price != null && !price.isEmpty() && !"all".equalsIgnoreCase(price)) {
            if ("under300".equalsIgnoreCase(price)) {
                list = list.stream().filter(p -> p.getPrice() != null && p.getPrice() < 300000).collect(Collectors.toList());
            } else if ("300to800".equalsIgnoreCase(price)) {
                list = list.stream().filter(p -> p.getPrice() != null && p.getPrice() >= 300000 && p.getPrice() <= 800000).collect(Collectors.toList());
            } else if ("over800".equalsIgnoreCase(price)) {
                list = list.stream().filter(p -> p.getPrice() != null && p.getPrice() > 800000).collect(Collectors.toList());
            }
        }

        if ("priceAsc".equalsIgnoreCase(sort)) {
            list.sort(Comparator.comparing(Product::getPrice, Comparator.nullsLast(Double::compareTo)));
        } else if ("priceDesc".equalsIgnoreCase(sort)) {
            list.sort(Comparator.comparing(Product::getPrice, Comparator.nullsLast(Double::compareTo)).reversed());
        } else if ("rating".equalsIgnoreCase(sort)) {
            list.sort(Comparator.comparing(Product::getRating, Comparator.nullsLast(Double::compareTo)).reversed());
        } else {
            // newest default
            list.sort((a, b) -> {
                String da = a.getCreatedAt() != null ? a.getCreatedAt() : "";
                String db = b.getCreatedAt() != null ? b.getCreatedAt() : "";
                return db.compareTo(da);
            });
        }

        return list;
    }

    @GetMapping("/{id}")
    public ResponseEntity<Product> getById(@PathVariable String id) {
        return productRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Product create(
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId,
            @RequestBody Product product
    ) {
        rbacService.requireAnyPermission(
                actorHeaderId,
                null,
                "Bạn không có quyền thêm sản phẩm.",
                RbacService.PERM_PRODUCTS_MANAGE
        );
        if (product.getId() == null || product.getId().trim().isEmpty()) {
            product.setId("P" + System.currentTimeMillis());
        }
        if (product.getCreatedAt() == null || product.getCreatedAt().trim().isEmpty()) {
            product.setCreatedAt(LocalDate.now().toString());
        }
        if (product.getRating() == null) {
            product.setRating(5.0);
        }
        if (product.getSold() == null) {
            product.setSold(0);
        }
        if (product.getVariants() != null) {
            product.setVariants(product.getVariants());
        }
        if (product.getAttributes() != null) {
            product.setAttributes(product.getAttributes());
        }
        if (product.getNewBadge() != null) {
            product.setNewBadge(product.getNewBadge());
        }
        if (product.getDiscount() != null) {
            product.setDiscount(product.getDiscount());
        }
        if (product.getGallery() != null) {
            product.setGallery(product.getGallery());
        }
        if (product.getGalleryJson() != null) {
            product.setGalleryJson(product.getGalleryJson());
        }
        return productRepository.save(product);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Product> update(
            @PathVariable String id,
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId,
            @RequestBody Product update
    ) {
        rbacService.requireAnyPermission(
                actorHeaderId,
                null,
                "Bạn không có quyền chỉnh sửa sản phẩm, giá bán hoặc tồn kho.",
                RbacService.PERM_PRODUCTS_MANAGE,
                RbacService.PERM_PRODUCTS_PRICE_STOCK
        );
        return productRepository.findById(id)
                .map(existing -> {
                    if (update.getName() != null) existing.setName(update.getName());
                    if (update.getPrice() != null) existing.setPrice(update.getPrice());
                    if (update.getCostPrice() != null) existing.setCostPrice(update.getCostPrice());
                    if (update.getCategoryId() != null) existing.setCategoryId(update.getCategoryId());
                    if (update.getImage() != null) existing.setImage(update.getImage());
                    if (update.getDescription() != null) existing.setDescription(update.getDescription());
                    if (update.getStock() != null) existing.setStock(update.getStock());
                    if (update.getRating() != null) existing.setRating(update.getRating());
                    if (update.getSold() != null) existing.setSold(update.getSold());
                    if (update.getStatus() != null) existing.setStatus(update.getStatus());
                    if (update.getTagsRaw() != null) existing.setTagsRaw(update.getTagsRaw());
                    if (update.getVariants() != null && !(update.getVariants() instanceof java.util.List && ((java.util.List<?>) update.getVariants()).isEmpty())) {
                        existing.setVariants(update.getVariants());
                    }
                    if (update.getAttributes() != null && !(update.getAttributes() instanceof java.util.List && ((java.util.List<?>) update.getAttributes()).isEmpty())) {
                        existing.setAttributes(update.getAttributes());
                    }
                    if (update.getVariantsJson() != null) existing.setVariantsJson(update.getVariantsJson());
                    if (update.getAttributesJson() != null) existing.setAttributesJson(update.getAttributesJson());
                    if (update.getGallery() != null) {
                        existing.setGallery(update.getGallery());
                    }
                    if (update.getGalleryJson() != null) {
                        existing.setGalleryJson(update.getGalleryJson());
                    }
                    if (update.getNewBadge() != null) existing.setNewBadge(update.getNewBadge());
                    if (update.getDiscount() != null) existing.setDiscount(update.getDiscount());
                    if (update.getNewBadgeJson() != null) existing.setNewBadgeJson(update.getNewBadgeJson());
                    if (update.getDiscountJson() != null) existing.setDiscountJson(update.getDiscountJson());
                    if (update.getUpdatedAt() != null) existing.setUpdatedAt(update.getUpdatedAt());
                    if (update.getUpdatedBy() != null) existing.setUpdatedBy(update.getUpdatedBy());
                    return ResponseEntity.ok(productRepository.save(existing));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @PathVariable String id,
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId
    ) {
        rbacService.requireAnyPermission(
                actorHeaderId,
                null,
                "Bạn không có quyền xóa sản phẩm.",
                RbacService.PERM_PRODUCTS_MANAGE
        );
        if (!productRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        productRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
