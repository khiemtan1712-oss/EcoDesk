package com.ecodesk.controller;

import com.ecodesk.entity.User;
import com.ecodesk.repository.UserRepository;
import com.ecodesk.service.DisposableEmailPolicy;
import com.ecodesk.service.PasswordHashService;
import com.ecodesk.service.RbacService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private static final Logger log = LoggerFactory.getLogger(UserController.class);

    private final UserRepository userRepository;
    private final PasswordHashService passwordHashService;
    private final DisposableEmailPolicy emailPolicy;
    private final RbacService rbacService;

    public UserController(
            UserRepository userRepository,
            PasswordHashService passwordHashService,
            DisposableEmailPolicy emailPolicy,
            RbacService rbacService
    ) {
        this.userRepository = userRepository;
        this.passwordHashService = passwordHashService;
        this.emailPolicy = emailPolicy;
        this.rbacService = rbacService;
    }

    @GetMapping
    public List<User> getAll(
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId
    ) {
        rbacService.requireAnyPermission(
                actorHeaderId,
                null,
                "Chỉ Quản trị viên hoặc nhân sự được cấp quyền xem tài khoản mới được truy cập danh sách người dùng.",
                RbacService.PERM_USERS_VIEW
        );
        return userRepository.findAll().stream()
                .filter(u -> !Boolean.TRUE.equals(u.getHidden()) && !"U_ADMIN_01".equals(u.getId()))
                .toList();
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getById(
            @PathVariable String id,
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId
    ) {
        User actor = rbacService.requireActiveActor(actorHeaderId, null);
        if (!actor.getId().equals(id) && !rbacService.hasPermission(actor, RbacService.PERM_USERS_VIEW)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Bạn không có quyền xem thông tin tài khoản này."));
        }
        return userRepository.findById(id)
                .filter(u -> !Boolean.TRUE.equals(u.getHidden()) && !"U_ADMIN_01".equals(u.getId()))
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> credentials) {
        String email = credentials != null ? credentials.get("email") : null;
        String password = credentials != null ? credentials.get("password") : null;

        if (email == null || email.trim().isEmpty() || password == null || password.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "ok", false,
                    "code", "INVALID_CREDENTIALS_INPUT",
                    "error", "Vui lòng nhập đầy đủ email và mật khẩu."
            ));
        }

        String normalizedEmail = emailPolicy.normalize(email);
        Optional<User> userOpt = userRepository.findByEmail(normalizedEmail);
        if (userOpt.isEmpty()) {
            log.warn("Login failed: unknown email={}", maskEmail(normalizedEmail));
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "ok", false,
                    "code", "INVALID_CREDENTIALS",
                    "error", "Email hoặc mật khẩu không chính xác."
            ));
        }

        User user = userOpt.get();
        if (Boolean.TRUE.equals(user.getHidden()) || "U_ADMIN_01".equals(user.getId())) {
            log.warn("Login blocked: duplicate/hidden account userId={}", user.getId());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "ok", false,
                    "code", "INVALID_CREDENTIALS",
                    "error", "Email hoặc mật khẩu không chính xác."
            ));
        }

        if (Boolean.FALSE.equals(user.getActive())) {
            log.warn("Login blocked: disabled account userId={}", user.getId());
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "ok", false,
                    "code", "ACCOUNT_DISABLED",
                    "error", "Tài khoản này đã bị vô hiệu hóa. Vui lòng liên hệ Quản trị viên."
            ));
        }

        if (!passwordHashService.matches(password, user.getPassword())) {
            log.warn("Login failed: wrong password for userId={}", user.getId());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "ok", false,
                    "code", "INVALID_CREDENTIALS",
                    "error", "Email hoặc mật khẩu không chính xác."
            ));
        }

        if (Boolean.FALSE.equals(user.getEmailVerified())) {
            log.warn("Login blocked: unverified email for userId={}", user.getId());
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "ok", false,
                    "code", "EMAIL_NOT_VERIFIED",
                    "error", "Tài khoản chưa được xác minh email. Vui lòng hoàn tất xác minh OTP trước khi đăng nhập."
            ));
        }

        // Transparently upgrade legacy plaintext / SHA-256 passwords to BCrypt on successful sign-in.
        if (!passwordHashService.isBcryptHash(user.getPassword())) {
            user.setPassword(passwordHashService.hash(password));
            userRepository.save(user);
        }

        return ResponseEntity.ok(user);
    }

    private String maskEmail(String email) {
        if (email == null || !email.contains("@")) return "***";
        int at = email.indexOf('@');
        String local = email.substring(0, at);
        String prefix = local.length() <= 2 ? local.substring(0, Math.min(1, local.length())) : local.substring(0, 2);
        return prefix + "***" + email.substring(at);
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> data) {
        String name = data.get("name");
        String email = data.get("email");
        String password = data.get("password");
        String phone = data.get("phone");

        if (name == null || email == null || password == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Họ tên, email và mật khẩu không được để trống."));
        }

        String cleanEmail = emailPolicy.normalize(email);
        if (!emailPolicy.isValidFormat(cleanEmail)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email không đúng định dạng."));
        }
        if (userRepository.existsByEmail(cleanEmail)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "Email này đã được sử dụng."));
        }

        User user = new User();
        user.setId("U_" + System.currentTimeMillis());
        user.setName(name.trim());
        user.setEmail(cleanEmail);
        user.setPassword(passwordHashService.hash(password));
        user.setRole("customer");
        user.setPhone(phone != null ? phone.trim() : "");
        user.setCreatedAt(Instant.now().toString());
        user.setSpendTotal(0.0);
        user.setTier("Đồng");
        user.setEmailVerified(true);

        User saved = userRepository.save(user);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PostMapping
    public ResponseEntity<?> createByAdmin(
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId,
            @RequestBody Map<String, Object> data
    ) {
        User admin = rbacService.requireAdmin(actorHeaderId, null, "Chỉ Quản trị viên mới có quyền tạo tài khoản nội bộ.");
        String name = data.get("name") != null ? data.get("name").toString().trim() : "";
        String email = data.get("email") != null ? emailPolicy.normalize(data.get("email").toString()) : "";
        String password = data.get("password") != null ? data.get("password").toString() : "";
        String phone = data.get("phone") != null ? data.get("phone").toString().trim() : "";
        String role = rbacService.normalizeRole(data.get("role") != null ? data.get("role").toString() : "customer");
        String note = data.get("note") != null ? data.get("note").toString().trim() : "";

        if (name.isEmpty() || email.isEmpty() || password.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Họ tên, email và mật khẩu không được để trống."));
        }
        if (!emailPolicy.isValidFormat(email)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email không đúng định dạng."));
        }
        if (userRepository.existsByEmail(email)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "Email này đã được sử dụng."));
        }

        User user = new User();
        user.setId("U_" + System.currentTimeMillis());
        user.setName(name);
        user.setEmail(email);
        user.setPassword(passwordHashService.hash(password));
        user.setRole(role);
        user.setPhone(phone);
        user.setNote(note);
        user.setCreatedAt(Instant.now().toString());
        user.setSpendTotal(0.0);
        user.setTier("Đồng");
        user.setEmailVerified(true);
        user.setActive(true);
        user.setHidden(false);

        if (RbacService.ROLE_CASHIER.equals(role)) {
            List<String> reqPerms = extractStringList(data.get("permissions"));
            user.setPermissions(reqPerms.isEmpty()
                    ? new ArrayList<>(RbacService.DEFAULT_CASHIER_PERMISSIONS)
                    : rbacService.sanitizePermissionsForRole(role, reqPerms));
            user.setPermissionsUpdatedAt(Instant.now().toString());
            user.setPermissionsUpdatedBy(admin.getName());
        } else if (RbacService.ROLE_STAFF.equals(role)) {
            List<String> reqPerms = extractStringList(data.get("permissions"));
            user.setPermissions(reqPerms.isEmpty()
                    ? new ArrayList<>(RbacService.DEFAULT_STAFF_PERMISSIONS)
                    : rbacService.sanitizePermissionsForRole(role, reqPerms));
            user.setPermissionsUpdatedAt(Instant.now().toString());
            user.setPermissionsUpdatedBy(admin.getName());
        }

        return ResponseEntity.status(HttpStatus.CREATED).body(userRepository.save(user));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(
            @PathVariable String id,
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId,
            @RequestBody Map<String, Object> body
    ) {
        User actor = rbacService.requireActiveActor(actorHeaderId, body.get("actorUserId") != null ? body.get("actorUserId").toString() : null);
        boolean isAdmin = rbacService.isAdmin(actor);
        boolean isSelf = actor.getId().equals(id);

        if (!isAdmin && !isSelf) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Bạn không có quyền chỉnh sửa tài khoản người khác."));
        }

        boolean touchesPrivilegedFields = body.containsKey("role")
                || body.containsKey("permissions")
                || body.containsKey("active")
                || body.containsKey("spendTotal")
                || body.containsKey("tier");
        if (touchesPrivilegedFields && !isAdmin) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Chỉ Quản trị viên mới được phép thay đổi vai trò, quyền hạn hoặc trạng thái tài khoản."));
        }

        return userRepository.findById(id)
                .<ResponseEntity<?>>map(existing -> {
                    if (Boolean.TRUE.equals(existing.getHidden()) || "U_ADMIN_01".equals(existing.getId())) {
                        return ResponseEntity.notFound().build();
                    }

                    if (body.containsKey("name") && body.get("name") != null) {
                        existing.setName(body.get("name").toString().trim());
                    }
                    if (body.containsKey("phone") && body.get("phone") != null) {
                        existing.setPhone(body.get("phone").toString().trim());
                    }
                    if (body.containsKey("password") && body.get("password") != null) {
                        String raw = body.get("password").toString().trim();
                        if (!raw.isEmpty()) {
                            existing.setPassword(passwordHashService.isBcryptHash(raw) ? raw : passwordHashService.hash(raw));
                        }
                    }

                    if (isAdmin) {
                        if (body.containsKey("role") && body.get("role") != null) {
                            String newRole = rbacService.normalizeRole(body.get("role").toString());
                            if ("admin".equalsIgnoreCase(existing.getRole()) && !"admin".equals(newRole) && isLastActiveAdmin(existing.getId())) {
                                return ResponseEntity.status(HttpStatus.CONFLICT)
                                        .body(Map.of("error", "Không thể hạ quyền Quản trị viên cuối cùng của hệ thống."));
                            }
                            existing.setRole(newRole);
                            if (RbacService.ROLE_CASHIER.equals(newRole) && !body.containsKey("permissions")) {
                                existing.setPermissions(new ArrayList<>(RbacService.DEFAULT_CASHIER_PERMISSIONS));
                            } else if (RbacService.ROLE_STAFF.equals(newRole)
                                    && (existing.getPermissions() == null || existing.getPermissions().isEmpty())
                                    && !body.containsKey("permissions")) {
                                existing.setPermissions(new ArrayList<>(RbacService.DEFAULT_STAFF_PERMISSIONS));
                            } else if (RbacService.ROLE_ADMIN.equals(newRole) || RbacService.ROLE_CUSTOMER.equals(newRole)) {
                                existing.setPermissions(List.of());
                            }
                        }
                        if (body.containsKey("permissions")) {
                            List<String> reqPerms = extractStringList(body.get("permissions"));
                            existing.setPermissions(rbacService.sanitizePermissionsForRole(existing.getRole(), reqPerms));
                            existing.setPermissionsUpdatedAt(Instant.now().toString());
                            existing.setPermissionsUpdatedBy(actor.getName());
                        }
                        if (body.containsKey("active") && body.get("active") != null) {
                            boolean newActive = Boolean.parseBoolean(body.get("active").toString());
                            if (!newActive && ("U_ADMIN".equals(existing.getId()) || isLastActiveAdmin(existing.getId()))) {
                                return ResponseEntity.status(HttpStatus.CONFLICT)
                                        .body(Map.of("error", "Không thể vô hiệu hóa tài khoản Quản trị viên chính hoặc Quản trị viên cuối cùng."));
                            }
                            existing.setActive(newActive);
                        }
                        if (body.containsKey("tier") && body.get("tier") != null) {
                            existing.setTier(body.get("tier").toString());
                        }
                        if (body.containsKey("spendTotal") && body.get("spendTotal") instanceof Number n) {
                            existing.setSpendTotal(n.doubleValue());
                        }
                        if (body.containsKey("note") && body.get("note") != null) {
                            existing.setNote(body.get("note").toString());
                        }
                    }

                    return ResponseEntity.ok(userRepository.save(existing));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/permissions")
    public ResponseEntity<?> updatePermissions(
            @PathVariable String id,
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId,
            @RequestBody Map<String, Object> body
    ) {
        User admin = rbacService.requireAdmin(actorHeaderId, null, "Chỉ Quản trị viên mới có quyền phân quyền nhân sự.");
        return userRepository.findById(id)
                .<ResponseEntity<?>>map(existing -> {
                    if (Boolean.TRUE.equals(existing.getHidden()) || "U_ADMIN_01".equals(existing.getId())) {
                        return ResponseEntity.notFound().build();
                    }
                    String role = rbacService.normalizeRole(existing.getRole());
                    if (!RbacService.ROLE_STAFF.equals(role) && !RbacService.ROLE_CASHIER.equals(role)) {
                        return ResponseEntity.badRequest()
                                .body(Map.of("error", "Chỉ có thể cấu hình quyền chi tiết cho tài khoản Nhân viên hoặc Thu ngân."));
                    }
                    List<String> reqPerms = extractStringList(body.get("permissions"));
                    existing.setPermissions(rbacService.sanitizePermissionsForRole(role, reqPerms));
                    existing.setPermissionsUpdatedAt(Instant.now().toString());
                    existing.setPermissionsUpdatedBy(admin.getName());
                    return ResponseEntity.ok(userRepository.save(existing));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<?> updateActiveStatus(
            @PathVariable String id,
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId,
            @RequestBody Map<String, Object> body
    ) {
        rbacService.requireAdmin(actorHeaderId, null, "Chỉ Quản trị viên mới có quyền vô hiệu hóa hoặc kích hoạt tài khoản.");
        if (!body.containsKey("active")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Thiếu trường active."));
        }
        boolean newActive = Boolean.parseBoolean(String.valueOf(body.get("active")));
        return userRepository.findById(id)
                .<ResponseEntity<?>>map(existing -> {
                    if (!newActive && ("U_ADMIN".equals(existing.getId()) || isLastActiveAdmin(existing.getId()))) {
                        return ResponseEntity.status(HttpStatus.CONFLICT)
                                .body(Map.of("error", "Không thể vô hiệu hóa tài khoản Quản trị viên chính hoặc Quản trị viên cuối cùng."));
                    }
                    existing.setActive(newActive);
                    return ResponseEntity.ok(userRepository.save(existing));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/change-password")
    public ResponseEntity<?> changePassword(@PathVariable String id, @RequestBody Map<String, String> body) {
        String currentPassword = body.get("currentPassword");
        String newPassword = body.get("newPassword");
        if (currentPassword == null || newPassword == null) {
            return ResponseEntity.badRequest().body(Map.of("ok", false, "error", "Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới."));
        }
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("ok", false, "error", "Không tìm thấy tài khoản."));
        }
        User user = userOpt.get();
        if (!passwordHashService.matches(currentPassword, user.getPassword())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("ok", false, "error", "Mật khẩu hiện tại không chính xác."));
        }
        if (!passwordHashService.isStrongResetPassword(newPassword)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("ok", false, "error", "Mật khẩu mới cần tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và chữ số."));
        }
        user.setPassword(passwordHashService.hash(newPassword));
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("ok", true, "message", "Đổi mật khẩu thành công."));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(
            @PathVariable String id,
            @RequestHeader(value = RbacService.HEADER_USER_ID, required = false) String actorHeaderId
    ) {
        rbacService.requireAdmin(actorHeaderId, null, "Chỉ Quản trị viên mới có quyền xóa tài khoản.");
        Optional<User> targetOpt = userRepository.findById(id);
        if (targetOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        User target = targetOpt.get();
        if ("U_ADMIN".equals(target.getId()) || isLastActiveAdmin(target.getId())) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "Không thể xóa Quản trị viên chính hoặc Quản trị viên cuối cùng."));
        }
        userRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private boolean isLastActiveAdmin(String targetUserId) {
        List<User> activeAdmins = userRepository.findAll().stream()
                .filter(u -> "admin".equalsIgnoreCase(u.getRole())
                        && Boolean.TRUE.equals(u.getActive())
                        && !Boolean.TRUE.equals(u.getHidden())
                        && !"U_ADMIN_01".equals(u.getId()))
                .toList();
        return activeAdmins.size() <= 1
                && activeAdmins.stream().anyMatch(a -> a.getId().equals(targetUserId));
    }

    private List<String> extractStringList(Object raw) {
        List<String> list = new ArrayList<>();
        if (raw instanceof List<?> items) {
            for (Object item : items) {
                if (item != null && !item.toString().trim().isEmpty()) {
                    list.add(item.toString().trim());
                }
            }
        }
        return list;
    }
}
