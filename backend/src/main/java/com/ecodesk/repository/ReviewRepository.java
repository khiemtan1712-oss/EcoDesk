package com.ecodesk.repository;

import com.ecodesk.entity.Review;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReviewRepository extends JpaRepository<Review, String> {
    List<Review> findByProductId(String productId);
    List<Review> findByProductIdAndIsDeletedFalse(String productId);
    List<Review> findByUserId(String userId);
    List<Review> findByUserIdAndIsDeletedFalse(String userId);
    List<Review> findByOrderId(String orderId);
    List<Review> findByOrderIdAndIsDeletedFalse(String orderId);
    List<Review> findByIsDeletedFalse();
}
