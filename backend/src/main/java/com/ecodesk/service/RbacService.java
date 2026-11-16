package com.ecodesk.service;

import com.ecodesk.entity.User;
import com.ecodesk.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@Service
public class RbacService {

    public static final String HEADER_USER_ID = "X-EcoDesk-User-Id";

    public static final String ROLE_ADMIN = "admin";
    public static final String ROLE_STAFF = "staff";
    public static final String ROLE_CASHIER = "cashier";
    public static final String ROLE_CUSTOMER = "customer";

    public static final String PERM_ORDERS_VIEW = "orders:view";
    public static final String PERM_ORDERS_UPDATE_STATUS = "orders:update_status";
    public static final String PERM_ORDERS_EDIT_INFO = "orders:edit_info";
    public static final String PERM_PRODUCTS_MANAGE = "products:manage";
    public static final String PERM_PRODUCTS_PRICE_STOCK = "products:price_stock";
    public static final String PERM_CATEGORIES_MANAGE = "categories:manage";
    public static final String PERM_USERS_VIEW = "users:view";
    public static final String PERM_USERS_MANAGE_ROLES = "users:manage_roles";
    public static final String PERM_PROMOTIONS_MANAGE = "promotions:manage";
    public static final String PERM_REPORTS_VIEW = "reports:view";
    public static final String PERM_DATA_EXPORT = "data:export";
    public static final String PERM_CHAT_SUPPORT = "chat:support";
    public static final String PERM_REVIEWS_MANAGE = "reviews:manage";

    // Financial permissions
    public static final String PERM_FINANCE_VIEW = "finance:view";
    public static final String PERM_FINANCE_RECORD_EXPENSE = "finance:record_expense";
    public static final String PERM_FINANCE_PAYROLL_VIEW = "finance:payroll_view";
    public static final String PERM_FINANCE_RECONCILE = "finance:reconcile";

    // Inventory & Purchase Order permissions
    public static final String PERM_INVENTORY_PURCHASE_VIEW = "inventory:purchase_view";
    public static final String PERM_INVENTORY_PURCHASE_CREATE = "inventory:purchase_create";
    public static final String PERM_INVENTORY_PURCHASE_RECEIVE = "inventory:purchase_receive";
    public static final String PERM_INVENTORY_PURCHASE_PAY = "inventory:purchase_pay";
    public static final String PERM_INVENTORY_ADJUST = "inventory:adjust";

    public static final List<String> DEFAULT_STAFF_PERMISSIONS = List.of(
            PERM_ORDERS_VIEW,
            PERM_CHAT_SUPPORT,
            PERM_INVENTORY_PURCHASE_VIEW
    );

    public static final List<String> DEFAULT_CASHIER_PERMISSIONS = List.of(
            PERM_ORDERS_VIEW,
            PERM_FINANCE_VIEW,
            PERM_FINANCE_RECORD_EXPENSE,
            PERM_FINANCE_RECONCILE
    );

    public static final Set<String> CASHIER_FORBIDDEN_PERMISSIONS = Set.of(
            PERM_USERS_VIEW,
            PERM_USERS_MANAGE_ROLES,
            PERM_PRODUCTS_MANAGE,
            PERM_PRODUCTS_PRICE_STOCK,
            PERM_CATEGORIES_MANAGE,
            PERM_PROMOTIONS_MANAGE,
            PERM_ORDERS_UPDATE_STATUS,
            PERM_ORDERS_EDIT_INFO,
            PERM_INVENTORY_PURCHASE_RECEIVE,
            PERM_INVENTORY_ADJUST,
            PERM_FINANCE_PAYROLL_VIEW,
            PERM_REPORTS_VIEW
    );

    public static final Set<String> VALID_ROLES = Set.of(
            ROLE_ADMIN,
            ROLE_STAFF,
            ROLE_CASHIER,
            ROLE_CUSTOMER
    );

    private final UserRepository userRepository;

    public RbacService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public String normalizeRole(String role) {
        if (role == null || role.trim().isEmpty()) return ROLE_CUSTOMER;
        String r = role.trim().toLowerCase(Locale.ROOT);
        return VALID_ROLES.contains(r) ? r : ROLE_CUSTOMER;
    }

    public List<String> sanitizePermissionsForRole(String role, List<String> requested) {
        String normalizedRole = normalizeRole(role);
        if (ROLE_ADMIN.equals(normalizedRole) || ROLE_CUSTOMER.equals(normalizedRole)) {
            return List.of();
        }
        List<String> source = requested != null ? requested : List.of();
        LinkedHashSet<String> clean = new LinkedHashSet<>();
        for (String p : source) {
            if (p == null) continue;
            String trimmed = p.trim();
            if (trimmed.isEmpty()) continue;
            if (ROLE_CASHIER.equals(normalizedRole) && CASHIER_FORBIDDEN_PERMISSIONS.contains(trimmed)) {
                continue;
            }
            clean.add(trimmed);
        }
        return new ArrayList<>(clean);
    }

    public User requireActiveActor(String headerUserId, String fallbackActorId) {
        String rawId = (headerUserId != null && !headerUserId.trim().isEmpty())
                ? headerUserId.trim()
                : (fallbackActorId != null ? fallbackActorId.trim() : "");
        if (rawId.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Thiếu thông tin xác thực tài khoản (X-EcoDesk-User-Id)."
            );
        }
        User actor = userRepository.findById(rawId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Tài khoản xác thực không tồn tại."
                ));
        if (Boolean.FALSE.equals(actor.getActive()) || Boolean.TRUE.equals(actor.getHidden())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Tài khoản đã bị vô hiệu hóa hoặc không còn hiệu lực."
            );
        }
        return actor;
    }

    public Optional<User> resolveOptionalActiveActor(String headerUserId, String fallbackActorId) {
        String rawId = (headerUserId != null && !headerUserId.trim().isEmpty())
                ? headerUserId.trim()
                : (fallbackActorId != null ? fallbackActorId.trim() : "");
        if (rawId.isEmpty()) return Optional.empty();
        User actor = userRepository.findById(rawId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Tài khoản xác thực không tồn tại."
                ));
        if (Boolean.FALSE.equals(actor.getActive()) || Boolean.TRUE.equals(actor.getHidden())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Tài khoản đã bị vô hiệu hóa hoặc không còn hiệu lực."
            );
        }
        return Optional.of(actor);
    }

    public boolean isAdmin(User user) {
        return user != null
                && Boolean.TRUE.equals(user.getActive())
                && !Boolean.TRUE.equals(user.getHidden())
                && ROLE_ADMIN.equalsIgnoreCase(normalizeRole(user.getRole()));
    }

    public boolean hasPermission(User user, String permission) {
        if (user == null || permission == null || permission.isBlank()) return false;
        if (Boolean.FALSE.equals(user.getActive()) || Boolean.TRUE.equals(user.getHidden())) return false;

        String role = normalizeRole(user.getRole());
        if (ROLE_ADMIN.equals(role)) return true;
        if (ROLE_CUSTOMER.equals(role)) return false;

        if (ROLE_CASHIER.equals(role)) {
            if (CASHIER_FORBIDDEN_PERMISSIONS.contains(permission)) {
                return false;
            }
            List<String> perms = user.getPermissions();
            List<String> effective = (perms != null && !perms.isEmpty()) ? perms : DEFAULT_CASHIER_PERMISSIONS;
            return effective.contains(permission);
        }

        if (ROLE_STAFF.equals(role)) {
            List<String> perms = user.getPermissions();
            List<String> effective = (perms != null && !perms.isEmpty()) ? perms : DEFAULT_STAFF_PERMISSIONS;
            return effective.contains(permission);
        }

        return false;
    }

    public User requireAdmin(String headerUserId, String fallbackActorId, String message) {
        User actor = requireActiveActor(headerUserId, fallbackActorId);
        if (!isAdmin(actor)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    message != null ? message : "Chỉ Quản trị viên mới có quyền thực hiện thao tác này."
            );
        }
        return actor;
    }

    public User requireAnyPermission(String headerUserId, String fallbackActorId, String message, String... permissions) {
        User actor = requireActiveActor(headerUserId, fallbackActorId);
        if (isAdmin(actor)) return actor;
        for (String perm : permissions) {
            if (hasPermission(actor, perm)) {
                return actor;
            }
        }
        throw new ResponseStatusException(
                HttpStatus.FORBIDDEN,
                message != null ? message : "Bạn không có quyền truy cập chức năng này."
        );
    }
}

