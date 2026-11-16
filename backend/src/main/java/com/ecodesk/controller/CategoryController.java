package com.ecodesk.controller;

import com.ecodesk.entity.Category;
import com.ecodesk.repository.CategoryRepository;
import com.ecodesk.service.RbacService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/categories")
public class CategoryController {

    private final CategoryRepository categoryRepository;
    private final RbacService rbacService;

    public CategoryController(CategoryRepository categoryRepository, RbacService rbacService) {
        this.categoryRepository = categoryRepository;
        this.rbacService = rbacService;
    }

    @GetMapping
    public List<Category> getAll() {
        return categoryRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Category> getById(@PathVariable String id) {
        return categoryRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Category create(
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId,
            @RequestBody Category category
    ) {
        rbacService.requireAnyPermission(actorHeaderId, null, "Bạn không có quyền quản lý danh mục.", RbacService.PERM_CATEGORIES_MANAGE);
        return categoryRepository.save(category);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Category> update(
            @PathVariable String id,
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId,
            @RequestBody Category update
    ) {
        rbacService.requireAnyPermission(actorHeaderId, null, "Bạn không có quyền quản lý danh mục.", RbacService.PERM_CATEGORIES_MANAGE);
        return categoryRepository.findById(id)
                .map(existing -> {
                    existing.setName(update.getName());
                    return ResponseEntity.ok(categoryRepository.save(existing));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @PathVariable String id,
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId
    ) {
        rbacService.requireAnyPermission(actorHeaderId, null, "Bạn không có quyền xóa danh mục.", RbacService.PERM_CATEGORIES_MANAGE);
        if (!categoryRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        categoryRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
