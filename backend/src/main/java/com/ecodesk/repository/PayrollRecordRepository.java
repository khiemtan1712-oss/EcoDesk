package com.ecodesk.repository;

import com.ecodesk.entity.PayrollRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PayrollRecordRepository extends JpaRepository<PayrollRecord, String> {
    List<PayrollRecord> findAllByOrderByPeriodMonthDescCreatedAtDesc();
    Optional<PayrollRecord> findByEmployeeUserIdAndPeriodMonth(String employeeUserId, String periodMonth);
}

