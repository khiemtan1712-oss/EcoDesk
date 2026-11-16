package com.ecodesk.repository;

import com.ecodesk.entity.FinancialTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FinancialTransactionRepository extends JpaRepository<FinancialTransaction, String> {
    List<FinancialTransaction> findAllByOrderByTxDateDescCreatedAtDesc();
    Optional<FinancialTransaction> findByPayrollId(String payrollId);
    Optional<FinancialTransaction> findByPurchaseOrderId(String purchaseOrderId);
}

