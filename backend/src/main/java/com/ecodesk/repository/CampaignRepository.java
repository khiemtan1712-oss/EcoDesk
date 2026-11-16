package com.ecodesk.repository;

import com.ecodesk.entity.Campaign;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CampaignRepository extends JpaRepository<Campaign, String> {
    Optional<Campaign> findByCodeIgnoreCase(String code);
    List<Campaign> findByProductId(String productId);
}
