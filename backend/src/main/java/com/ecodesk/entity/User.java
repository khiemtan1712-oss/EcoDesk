package com.ecodesk.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.*;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "users")
public class User {

    @Id
    @Column(nullable = false, length = 50)
    private String id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, unique = true, length = 100)
    private String email;

    @Column(nullable = false, length = 100)
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String password;

    @Column(nullable = false, length = 30)
    private String role = "customer";

    @Column(length = 20)
    private String phone;

    @Column(name = "created_at", length = 40)
    private String createdAt;

    @Column(name = "spend_total")
    private Double spendTotal = 0.0;

    @Column(length = 50)
    private String tier = "Đồng";

    @Column(length = 255)
    private String note;

    @Column(name = "email_verified")
    private Boolean emailVerified = true;

    @Column(name = "active")
    private Boolean active = true;

    @Column(name = "hidden")
    private Boolean hidden = false;

    @Column(name = "base_salary")
    private Double baseSalary;

    @JsonIgnore
    @Column(name = "permissions_json", columnDefinition = "TEXT")
    private String permissionsJson;

    @Column(name = "permissions_updated_at", length = 40)
    private String permissionsUpdatedAt;

    @Column(name = "permissions_updated_by", length = 100)
    private String permissionsUpdatedBy;

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    public User() {}

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public Double getSpendTotal() {
        return spendTotal;
    }

    public void setSpendTotal(Double spendTotal) {
        this.spendTotal = spendTotal;
    }

    public String getTier() {
        return tier;
    }

    public void setTier(String tier) {
        this.tier = tier;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public Boolean getEmailVerified() {
        return emailVerified;
    }

    public void setEmailVerified(Boolean emailVerified) {
        this.emailVerified = emailVerified;
    }

    public Boolean getActive() {
        return active == null || active;
    }

    public void setActive(Boolean active) {
        this.active = active;
    }

    public Boolean getHidden() {
        return Boolean.TRUE.equals(hidden);
    }

    public void setHidden(Boolean hidden) {
        this.hidden = hidden;
    }

    public Double getBaseSalary() {
        return baseSalary;
    }

    public void setBaseSalary(Double baseSalary) {
        this.baseSalary = baseSalary;
    }

    @JsonIgnore
    public String getPermissionsJson() {
        return permissionsJson;
    }

    public void setPermissionsJson(String permissionsJson) {
        this.permissionsJson = permissionsJson;
    }

    @JsonProperty("permissions")
    @Transient
    public List<String> getPermissions() {
        if (permissionsJson == null || permissionsJson.trim().isEmpty()) {
            return null;
        }
        try {
            return OBJECT_MAPPER.readValue(permissionsJson, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    @JsonProperty("permissions")
    public void setPermissions(List<String> permissions) {
        if (permissions == null) {
            this.permissionsJson = null;
            return;
        }
        try {
            this.permissionsJson = OBJECT_MAPPER.writeValueAsString(permissions);
        } catch (Exception e) {
            this.permissionsJson = "[]";
        }
    }

    public String getPermissionsUpdatedAt() {
        return permissionsUpdatedAt;
    }

    public void setPermissionsUpdatedAt(String permissionsUpdatedAt) {
        this.permissionsUpdatedAt = permissionsUpdatedAt;
    }

    public String getPermissionsUpdatedBy() {
        return permissionsUpdatedBy;
    }

    public void setPermissionsUpdatedBy(String permissionsUpdatedBy) {
        this.permissionsUpdatedBy = permissionsUpdatedBy;
    }
}
