package com.ecodesk.controller;

import com.ecodesk.entity.Banner;
import com.ecodesk.repository.BannerRepository;
import com.ecodesk.service.RbacService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/banners")
public class BannerController {

    private final BannerRepository bannerRepository;
    private final RbacService rbacService;

    public BannerController(BannerRepository bannerRepository, RbacService rbacService) {
        this.bannerRepository = bannerRepository;
        this.rbacService = rbacService;
    }

    @GetMapping
    public List<Banner> getAll() {
        return bannerRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Banner> getById(@PathVariable String id) {
        return bannerRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Banner create(
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId,
            @RequestBody Banner banner
    ) {
        rbacService.requireAnyPermission(actorHeaderId, null, "Bạn không có quyền quản lý banner.", RbacService.PERM_PROMOTIONS_MANAGE);
        if (banner.getId() == null || banner.getId().trim().isEmpty()) {
            banner.setId("b" + System.currentTimeMillis());
        }
        return bannerRepository.save(banner);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Banner> update(
            @PathVariable String id,
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId,
            @RequestBody Banner update
    ) {
        rbacService.requireAnyPermission(actorHeaderId, null, "Bạn không có quyền quản lý banner.", RbacService.PERM_PROMOTIONS_MANAGE);
        return bannerRepository.findById(id)
                .map(existing -> {
                    if (update.getTitle() != null) existing.setTitle(update.getTitle());
                    if (update.getSubtitle() != null) existing.setSubtitle(update.getSubtitle());
                    if (update.getBadge() != null) existing.setBadge(update.getBadge());
                    if (update.getLink() != null) existing.setLink(update.getLink());
                    if (update.getImage() != null) existing.setImage(update.getImage());
                    if (update.getActive() != null) existing.setActive(update.getActive());
                    return ResponseEntity.ok(bannerRepository.save(existing));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @PathVariable String id,
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId
    ) {
        rbacService.requireAnyPermission(actorHeaderId, null, "Bạn không có quyền xóa banner.", RbacService.PERM_PROMOTIONS_MANAGE);
        if (!bannerRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        bannerRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
