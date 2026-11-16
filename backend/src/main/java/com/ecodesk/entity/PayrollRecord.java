package com.ecodesk.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "payroll_records")
public class PayrollRecord {

    @Id
    @Column(nullable = false, length = 60)
    private String id;

    @Column(name = "employee_user_id", nullable = false, length = 60)
    private String employeeUserId;

    @Column(name = "employee_name", nullable = false, length = 120)
    private String employeeName;

    @Column(name = "period_month", nullable = false, length = 20)
    private String periodMonth; // YYYY-MM

    @Column(name = "base_salary", nullable = false)
    private Double baseSalary = 0.0;

    @Column(nullable = false)
    private Double bonus = 0.0;

    @Column(nullable = false)
    private Double deduction = 0.0;

    @Column(name = "net_amount", nullable = false)
    private Double netAmount = 0.0;

    @Column(nullable = false, length = 20)
    private String status = "UNPAID"; // UNPAID, PAID, DUE, MISSING_SALARY

    @Column(name = "due_date", length = 30)
    private String dueDate;

    @Column(name = "paid_at", length = 40)
    private String paidAt;

    @Column(name = "payment_method", length = 80)
    private String paymentMethod;

    @Column(length = 300)
    private String note;

    @Column(name = "created_by_user_id", length = 60)
    private String createdByUserId;

    @Column(name = "created_by_name", length = 100)
    private String createdByName;

    @Column(name = "created_at", length = 40)
    private String createdAt;

    @Column(name = "updated_at", length = 40)
    private String updatedAt;

    public PayrollRecord() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getEmployeeUserId() { return employeeUserId; }
    public void setEmployeeUserId(String employeeUserId) { this.employeeUserId = employeeUserId; }

    public String getEmployeeName() { return employeeName; }
    public void setEmployeeName(String employeeName) { this.employeeName = employeeName; }

    public String getPeriodMonth() { return periodMonth; }
    public void setPeriodMonth(String periodMonth) { this.periodMonth = periodMonth; }

    public Double getBaseSalary() { return baseSalary; }
    public void setBaseSalary(Double baseSalary) { this.baseSalary = baseSalary; }

    public Double getBonus() { return bonus; }
    public void setBonus(Double bonus) { this.bonus = bonus; }

    public Double getDeduction() { return deduction; }
    public void setDeduction(Double deduction) { this.deduction = deduction; }

    public Double getNetAmount() { return netAmount; }
    public void setNetAmount(Double netAmount) { this.netAmount = netAmount; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getDueDate() { return dueDate; }
    public void setDueDate(String dueDate) { this.dueDate = dueDate; }

    public String getPaidAt() { return paidAt; }
    public void setPaidAt(String paidAt) { this.paidAt = paidAt; }

    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }

    public String getCreatedByUserId() { return createdByUserId; }
    public void setCreatedByUserId(String createdByUserId) { this.createdByUserId = createdByUserId; }

    public String getCreatedByName() { return createdByName; }
    public void setCreatedByName(String createdByName) { this.createdByName = createdByName; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    public String getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(String updatedAt) { this.updatedAt = updatedAt; }
}

