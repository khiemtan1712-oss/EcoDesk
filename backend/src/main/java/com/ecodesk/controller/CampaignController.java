package com.ecodesk.controller;

import com.ecodesk.entity.Campaign;
import com.ecodesk.repository.CampaignRepository;
import com.ecodesk.repository.ProductRepository;
import com.ecodesk.service.RbacService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/campaigns")
public class CampaignController {

    private final CampaignRepository campaignRepository;
    private final ProductRepository productRepository;
    private final RbacService rbacService;

    public CampaignController(CampaignRepository campaignRepository, RbacService rbacService) {
        this(campaignRepository, null, rbacService);
    }

    @Autowired
    public CampaignController(CampaignRepository campaignRepository,
                              ProductRepository productRepository,
                              RbacService rbacService) {
        this.campaignRepository = campaignRepository;
        this.productRepository = productRepository;
        this.rbacService = rbacService;
    }

    public static Instant parseToInstant(String dateStr) {
        if (dateStr == null || dateStr.isBlank()) return null;
        try {
            return Instant.parse(dateStr);
        } catch (Exception e1) {
            try {
                return OffsetDateTime.parse(dateStr).toInstant();
            } catch (Exception e2) {
                try {
                    return LocalDateTime.parse(dateStr).atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toInstant();
                } catch (Exception e3) {
                    return null;
                }
            }
        }
    }

    private void validateCampaign(Campaign campaign, String excludeId) {
        if (campaign.getName() == null || campaign.getName().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tên chương trình khuyến mãi không được để trống.");
        }
        if (campaign.getProductId() != null && !campaign.getProductId().trim().isEmpty()) {
            String prodId = campaign.getProductId().trim();
            if (productRepository != null && !productRepository.existsById(prodId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Sản phẩm áp dụng không tồn tại (ID: " + prodId + ").");
            }
        } else {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vui lòng chọn sản phẩm áp dụng khuyến mãi.");
        }

        double percent = campaign.getPercent() != null ? campaign.getPercent() : (campaign.getValue() != null ? campaign.getValue() : 0.0);
        String type = campaign.getType() != null ? campaign.getType().trim().toLowerCase(Locale.ROOT) : "regular";
        double maxCap = "special".equals(type) ? 90.0 : 50.0;
        if (percent < 1.0 || percent > maxCap) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Mức giảm không hợp lệ. Sự kiện " + ("special".equals(type) ? "đặc biệt tối đa 90%" : "thường tối đa 50%") + " (hiện tại: " + percent + "%).");
        }
        campaign.setPercent(percent);
        campaign.setValue(percent);

        Instant start = parseToInstant(campaign.getStartAt());
        Instant end = parseToInstant(campaign.getEndAt());
        if (start == null || end == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Thời gian bắt đầu và kết thúc không hợp lệ.");
        }
        if (!start.isBefore(end)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Thời gian kết thúc phải sau thời gian bắt đầu.");
        }

        // Overlap check for same product
        String prodId = campaign.getProductId().trim();
        List<Campaign> existingList = campaignRepository.findByProductId(prodId);
        for (Campaign other : existingList) {
            if (excludeId != null && excludeId.equals(other.getId())) continue;
            if (Boolean.FALSE.equals(other.getActive())) continue;
            Instant oStart = parseToInstant(other.getStartAt());
            Instant oEnd = parseToInstant(other.getEndAt());
            if (oStart != null && oEnd != null) {
                // Check overlap: start < oEnd && oStart < end
                if (start.isBefore(oEnd) && oStart.isBefore(end)) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "Sản phẩm đã có lịch sale khác trong khoảng thời gian này (" + other.getName() + " từ " + other.getStartAt() + " đến " + other.getEndAt() + ").");
                }
            }
        }
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
            campaign.setId("C" + System.currentTimeMillis());
        }
        if (campaign.getCode() == null || campaign.getCode().trim().isEmpty()) {
            String shortId = campaign.getId().length() > 6 ? campaign.getId().substring(campaign.getId().length() - 6) : campaign.getId();
            campaign.setCode("ECO-" + (campaign.getProductId() != null ? campaign.getProductId().trim() : "ALL") + "-" + shortId);
        }
        validateCampaign(campaign, null);
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
                    if (update.getName() != null) existing.setName(update.getName().trim());
                    if (update.getBadge() != null) existing.setBadge(update.getBadge().trim());
                    if (update.getCode() != null) existing.setCode(update.getCode().trim());
                    if (update.getType() != null) existing.setType(update.getType().trim());
                    if (update.getProductId() != null) existing.setProductId(update.getProductId().trim());
                    if (update.getPercent() != null) existing.setPercent(update.getPercent());
                    if (update.getValue() != null) existing.setValue(update.getValue());
                    if (update.getMaxDiscount() != null) existing.setMaxDiscount(update.getMaxDiscount());
                    if (update.getMinOrder() != null) existing.setMinOrder(update.getMinOrder());
                    if (update.getActive() != null) existing.setActive(update.getActive());
                    if (update.getStartAt() != null) existing.setStartAt(update.getStartAt().trim());
                    if (update.getEndAt() != null) existing.setEndAt(update.getEndAt().trim());
                    if (update.getDescription() != null) existing.setDescription(update.getDescription());

                    validateCampaign(existing, id);
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
