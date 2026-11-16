package com.ecodesk.repository;

import com.ecodesk.entity.FinancialAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FinancialAuditLogRepository extends JpaRepository<FinancialAuditLog, Long> {
    List<FinancialAuditLog> findTop100ByOrderByIdDesc();
    List<FinancialAuditLog> findTop100ByOrderByCreatedAtDesc();
    List<FinancialAuditLog> findByEntityTypeAndEntityIdOrderByIdDesc(String entityType, String entityId);
}
