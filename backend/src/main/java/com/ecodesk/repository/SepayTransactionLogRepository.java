package com.ecodesk.repository;

import com.ecodesk.entity.SepayTransactionLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SepayTransactionLogRepository extends JpaRepository<SepayTransactionLog, Long> {
    boolean existsBySepayTransactionId(String sepayTransactionId);
    List<SepayTransactionLog> findTop50ByOrderByIdDesc();
}

