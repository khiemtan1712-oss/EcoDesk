package com.ecodesk.repository;

import com.ecodesk.entity.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrderRepository extends JpaRepository<Order, String> {
    List<Order> findByUserIdOrderByCreatedAtDesc(String userId);
    List<Order> findAllByOrderByCreatedAtDesc();
    List<Order> findByOrderSourceOrderByCreatedAtDesc(String orderSource);
    List<Order> findByShiftIdOrderByCreatedAtDesc(String shiftId);
    Optional<Order> findByPaymentReferenceIgnoreCase(String paymentReference);
    boolean existsBySepayTransactionId(String sepayTransactionId);
}
