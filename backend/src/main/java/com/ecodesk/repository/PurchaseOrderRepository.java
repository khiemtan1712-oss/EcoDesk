package com.ecodesk.repository;

import com.ecodesk.entity.PurchaseOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, String> {
    List<PurchaseOrder> findAllByOrderByPurchaseDateDescCreatedAtDesc();
}

