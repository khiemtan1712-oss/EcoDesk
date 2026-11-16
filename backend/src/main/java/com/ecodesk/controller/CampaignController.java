package com.ecodesk.controller;

import com.ecodesk.entity.Campaign;
import com.ecodesk.repository.CampaignRepository;
import com.ecodesk.service.RbacService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/campaigns")
public class CampaignController {

    private final CampaignRepository campaignRepository;
    private final RbacService rbacService;

    public CampaignController(CampaignRepository campaignRepository, RbacService rbacService) {
        this.campaignRepository = campaignRepository;
        this.rbacService = rbacService;
    }

    @GetMapping
    public List<Campaign> getAll() {
        return campaignRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Campaign> getById(@PathVariable String id) {
        return campaignRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/validate")
    public ResponseEntity<?> validateCode(@RequestParam String code, @RequestParam(defaultValue = "0") Double amount) {
        Optional<Campaign> opt = campaignRepository.findByCodeIgnoreCase(code.trim());
        if (opt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("valid", false, "message", "Mã giảm giá không tồn tại."));
        }
        Campaign c = opt.get();
        if (Boolean.FALSE.equals(c.getActive())) {
            return ResponseEntity.badRequest().body(Map.of("valid", false, "message", "Mã giảm giá đã hết hiệu lực."));
        }
        if (c.getMinOrder() != null && amount < c.getMinOrder()) {
            return ResponseEntity.badRequest().body(Map.of("valid", false, "message", "Đơn hàng chưa đạt mức tối thiểu " + c.getMinOrder().longValue() + "đ."));
        }

        double discount = 0.0;
        if ("percent".equalsIgnoreCase(c.getType())) {
            discount = amount * (c.getValue() / 100.0);
            if (c.getMaxDiscount() != null && c.getMaxDiscount() > 0) {
                discount = Math.min(discount, c.getMaxDiscount());
            }
        } else {
            discount = c.getValue() != null ? c.getValue() : 0.0;
        }

        return ResponseEntity.ok(Map.of(
                "valid", true,
                "code", c.getCode(),
                "discount", discount,
                "campaign", c
        ));
    }

    @PostMapping
    public Campaign create(
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId,
            @RequestBody Campaign campaign
    ) {
        rbacService.requireAnyPermission(actorHeaderId, null, "Bạn không có quyền quản lý khuyến mãi.", RbacService.PERM_PROMOTIONS_MANAGE);
        if (campaign.getId() == null || campaign.getId().trim().isEmpty()) {
            campaign.setId("c" + System.currentTimeMillis());
        }
        return campaignRepository.save(campaign);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Campaign> update(
            @PathVariable String id,
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId,
            @RequestBody Campaign update
    ) {
        rbacService.requireAnyPermission(actorHeaderId, null, "Bạn không có quyền quản lý khuyến mãi.", RbacService.PERM_PROMOTIONS_MANAGE);
        return campaignRepository.findById(id)
                .map(existing -> {
                    if (update.getName() != null) existing.setName(update.getName());
                    if (update.getBadge() != null) existing.setBadge(update.getBadge());
                    if (update.getCode() != null) existing.setCode(update.getCode());
                    if (update.getType() != null) existing.setType(update.getType());
                    if (update.getValue() != null) existing.setValue(update.getValue());
                    if (update.getMaxDiscount() != null) existing.setMaxDiscount(update.getMaxDiscount());
                    if (update.getMinOrder() != null) existing.setMinOrder(update.getMinOrder());
                    if (update.getActive() != null) existing.setActive(update.getActive());
                    if (update.getStartAt() != null) existing.setStartAt(update.getStartAt());
                    if (update.getEndAt() != null) existing.setEndAt(update.getEndAt());
                    if (update.getDescription() != null) existing.setDescription(update.getDescription());
                    return ResponseEntity.ok(campaignRepository.save(existing));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @PathVariable String id,
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId
    ) {
        rbacService.requireAnyPermission(actorHeaderId, null, "Bạn không có quyền xóa khuyến mãi.", RbacService.PERM_PROMOTIONS_MANAGE);
        if (!campaignRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        campaignRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
