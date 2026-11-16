package com.ecodesk.repository;

import com.ecodesk.entity.InventoryMovement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InventoryMovementRepository extends JpaRepository<InventoryMovement, String> {
    List<InventoryMovement> findAllByOrderByCreatedAtDesc();
    List<InventoryMovement> findByProductIdOrderByCreatedAtDesc(String productId);
}

