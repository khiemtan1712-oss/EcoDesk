package com.ecodesk.service;

import com.ecodesk.entity.OtpChallenge;
import com.ecodesk.entity.OtpPurpose;
import com.ecodesk.entity.User;
import com.ecodesk.repository.OtpChallengeRepository;
import com.ecodesk.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Coordinates registration OTP verification and password-reset OTP verification
 * backed by persisted MySQL challenges and real server-side SMTP email delivery.
 */
@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    public static final int OTP_EXPIRY_MINUTES = 15;
    public static final long OTP_EXPIRY_SECONDS = OTP_EXPIRY_MINUTES * 60L;
    public static final long RESEND_COOLDOWN_SECONDS = 60L;
    public static final int MAX_FAILED_ATTEMPTS = 5;
    public static final long RATE_WINDOW_SECONDS = 3600L;
    public static final int MAX_REQUESTS_PER_WINDOW = 8;

    private final UserRepository userRepository;
    private final OtpChallengeRepository otpChallengeRepository;
    private final PasswordHashService passwordHashService;
    private final DisposableEmailPolicy emailPolicy;
    private final EmailOtpService emailOtpService;

    public AuthService(
            UserRepository userRepository,
            OtpChallengeRepository otpChallengeRepository,
            PasswordHashService passwordHashService,
            DisposableEmailPolicy emailPolicy,
            EmailOtpService emailOtpService
    ) {
        this.userRepository = userRepository;
        this.otpChallengeRepository = otpChallengeRepository;
        this.passwordHashService = passwordHashService;
        this.emailPolicy = emailPolicy;
        this.emailOtpService = emailOtpService;
    }

    @Transactional
    public AuthOutcome requestRegistrationOtp(String rawName, String rawEmail, String rawPassword, String rawPhone) {
        String name = rawName == null ? "" : rawName.trim();
        String email = emailPolicy.normalize(rawEmail);
        String password = rawPassword == null ? "" : rawPassword;
        String phone = rawPhone == null ? "" : rawPhone.trim();

        if (name.length() < 2) {
            return AuthOutcome.error(HttpStatus.BAD_REQUEST, "Họ tên cần có ít nhất 2 ký tự.");
        }
        if (!emailPolicy.isValidFormat(email)) {
            return AuthOutcome.error(HttpStatus.BAD_REQUEST, "Email không đúng định dạng hợp lệ.");
        }
        if (emailPolicy.isDisposableDomain(email)) {
            return AuthOutcome.error(HttpStatus.BAD_REQUEST, "Không chấp nhận địa chỉ email tạm thời hoặc email dùng một lần. Vui lòng sử dụng email thật.");
        }
        if (!passwordHashService.isStrongRegisterPassword(password)) {
            return AuthOutcome.error(HttpStatus.BAD_REQUEST, "Mật khẩu cần tối thiểu 10 ký tự, gồm chữ thường, chữ hoa, chữ số và ký tự đặc biệt.");
        }
        if (userRepository.existsByEmail(email)) {
            return AuthOutcome.error(HttpStatus.CONFLICT, "Email này đã được sử dụng. Vui lòng đăng nhập hoặc đặt lại mật khẩu.");
        }

        if (!emailOtpService.isMailConfigured()) {
            return mailConfigErrorOutcome();
        }

        Instant now = Instant.now();
        Optional<AuthOutcome> limitError = checkSendLimits(email, OtpPurpose.REGISTER, now);
        if (limitError.isPresent()) {
            return limitError.get();
        }

        invalidateOpenChallenges(email, OtpPurpose.REGISTER);

        String otpCode = emailOtpService.generateSixDigitOtp();
        String saltHex = emailOtpService.generateSaltHex();
        String otpHash = emailOtpService.hashOtp(OtpPurpose.REGISTER, email, saltHex, otpCode);
        String passwordHash = passwordHashService.hash(password);

        OtpChallenge challenge = new OtpChallenge();
        challenge.setId(UUID.randomUUID().toString());
        challenge.setPurpose(OtpPurpose.REGISTER);
        challenge.setEmail(email);
        challenge.setOtpHash(otpHash);
        challenge.setChallengeSalt(saltHex);
        challenge.setPendingName(name);
        challenge.setPendingPasswordHash(passwordHash);
        challenge.setPendingPhone(phone);
        challenge.setCreatedAt(now);
        challenge.setLastSentAt(now);
        challenge.setExpiresAt(now.plusSeconds(OTP_EXPIRY_SECONDS));
        challenge.setUsed(false);
        challenge.setInvalidated(false);
        challenge.setFailedAttempts(0);

        otpChallengeRepository.save(challenge);
        emailOtpService.sendOtpEmail(email, OtpPurpose.REGISTER, otpCode, OTP_EXPIRY_MINUTES, name);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("ok", true);
        body.put("email", email);
        body.put("expiresInSeconds", OTP_EXPIRY_SECONDS);
        body.put("resendCooldownSeconds", RESEND_COOLDOWN_SECONDS);
        body.put("message", "Mã xác thực OTP 6 chữ số đã được gửi tới " + email + ". Vui lòng kiểm tra hộp thư (kể cả mục Spam/Quảng cáo).");
        return AuthOutcome.ok(HttpStatus.OK, body);
    }

    @Transactional(noRollbackFor = Exception.class)
    public AuthOutcome verifyRegistrationOtp(String rawEmail, String rawOtp) {
        String email = emailPolicy.normalize(rawEmail);
        String otp = rawOtp == null ? "" : rawOtp.trim();

        if (!emailPolicy.isValidFormat(email)) {
            return AuthOutcome.error(HttpStatus.BAD_REQUEST, "Email không hợp lệ.");
        }
        if (!otp.matches("^\\d{6}$")) {
            return AuthOutcome.error(HttpStatus.BAD_REQUEST, "Mã OTP phải gồm đúng 6 chữ số.");
        }
        if (userRepository.existsByEmail(email)) {
            return AuthOutcome.error(HttpStatus.CONFLICT, "Tài khoản với email này đã tồn tại.");
        }

        Optional<OtpChallenge> challengeOpt = otpChallengeRepository
                .findTopByEmailAndPurposeAndUsedFalseAndInvalidatedFalseOrderByCreatedAtDesc(email, OtpPurpose.REGISTER);
        if (challengeOpt.isEmpty()) {
            return AuthOutcome.error(HttpStatus.BAD_REQUEST, "Mã xác thực không tồn tại, đã được sử dụng hoặc đã bị thay thế bởi mã mới.");
        }

        OtpChallenge challenge = challengeOpt.get();
        Instant now = Instant.now();
        if (now.isAfter(challenge.getExpiresAt())) {
            challenge.setInvalidated(true);
            otpChallengeRepository.save(challenge);
            return AuthOutcome.error(HttpStatus.BAD_REQUEST, "Mã xác thực đã hết hạn sau 15 phút. Vui lòng bấm gửi lại mã mới.");
        }

        if (!emailOtpService.verifyOtpHash(OtpPurpose.REGISTER, email, challenge.getChallengeSalt(), otp, challenge.getOtpHash())) {
            return recordFailedAttempt(challenge);
        }

        challenge.setUsed(true);
        otpChallengeRepository.save(challenge);
        invalidateOpenChallenges(email, OtpPurpose.REGISTER);

        User user = new User();
        user.setId("U_" + System.currentTimeMillis());
        user.setName(challenge.getPendingName());
        user.setEmail(email);
        user.setPassword(challenge.getPendingPasswordHash());
        user.setRole("customer");
        user.setPhone(challenge.getPendingPhone() != null ? challenge.getPendingPhone() : "");
        user.setCreatedAt(now.toString());
        user.setSpendTotal(0.0);
        user.setTier("Đồng");
        user.setEmailVerified(true);

        User saved = userRepository.save(user);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("ok", true);
        body.put("user", saved);
        body.put("message", "Xác thực email thành công! Tài khoản EcoDesk của bạn đã được kích hoạt.");
        return AuthOutcome.ok(HttpStatus.CREATED, body);
    }

    @Transactional
    public AuthOutcome requestPasswordResetOtp(String rawEmail) {
        String email = emailPolicy.normalize(rawEmail);
        if (!emailPolicy.isValidFormat(email)) {
            return AuthOutcome.error(HttpStatus.BAD_REQUEST, "Email không đúng định dạng.");
        }
        if (!emailOtpService.isMailConfigured()) {
            return mailConfigErrorOutcome();
        }

        Instant now = Instant.now();
        Optional<AuthOutcome> limitError = checkSendLimits(email, OtpPurpose.RESET_PASSWORD, now);
        if (limitError.isPresent()) {
            return limitError.get();
        }

        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isPresent()) {
            invalidateOpenChallenges(email, OtpPurpose.RESET_PASSWORD);

            User user = userOpt.get();
            String otpCode = emailOtpService.generateSixDigitOtp();
            String saltHex = emailOtpService.generateSaltHex();
            String otpHash = emailOtpService.hashOtp(OtpPurpose.RESET_PASSWORD, email, saltHex, otpCode);

            OtpChallenge challenge = new OtpChallenge();
            challenge.setId(UUID.randomUUID().toString());
            challenge.setPurpose(OtpPurpose.RESET_PASSWORD);
            challenge.setEmail(email);
            challenge.setOtpHash(otpHash);
            challenge.setChallengeSalt(saltHex);
            challenge.setCreatedAt(now);
            challenge.setLastSentAt(now);
            challenge.setExpiresAt(now.plusSeconds(OTP_EXPIRY_SECONDS));
            challenge.setUsed(false);
            challenge.setInvalidated(false);
            challenge.setFailedAttempts(0);

            otpChallengeRepository.save(challenge);
            emailOtpService.sendOtpEmail(email, OtpPurpose.RESET_PASSWORD, otpCode, OTP_EXPIRY_MINUTES, user.getName());
        }

        // Generic response avoids enumerating whether the email address exists.
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("ok", true);
        body.put("expiresInSeconds", OTP_EXPIRY_SECONDS);
        body.put("resendCooldownSeconds", RESEND_COOLDOWN_SECONDS);
        body.put("message", "Nếu email tồn tại trong hệ thống EcoDesk, mã xác thực OTP 6 chữ số sẽ được gửi tới hộp thư của bạn.");
        return AuthOutcome.ok(HttpStatus.OK, body);
    }

    @Transactional(noRollbackFor = Exception.class)
    public AuthOutcome verifyAndResetPassword(String rawEmail, String rawOtp, String newPassword) {
        String email = emailPolicy.normalize(rawEmail);
        String otp = rawOtp == null ? "" : rawOtp.trim();

        if (!emailPolicy.isValidFormat(email)) {
            return AuthOutcome.error(HttpStatus.BAD_REQUEST, "Email không hợp lệ.");
        }
        if (!otp.matches("^\\d{6}$")) {
            return AuthOutcome.error(HttpStatus.BAD_REQUEST, "Mã OTP phải gồm đúng 6 chữ số.");
        }
        if (!passwordHashService.isStrongResetPassword(newPassword)) {
            return AuthOutcome.error(HttpStatus.BAD_REQUEST, "Mật khẩu mới cần tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và chữ số.");
        }

        Optional<OtpChallenge> challengeOpt = otpChallengeRepository
                .findTopByEmailAndPurposeAndUsedFalseAndInvalidatedFalseOrderByCreatedAtDesc(email, OtpPurpose.RESET_PASSWORD);
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (challengeOpt.isEmpty() || userOpt.isEmpty()) {
            return AuthOutcome.error(HttpStatus.BAD_REQUEST, "Mã xác thực không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu gửi lại mã mới.");
        }

        OtpChallenge challenge = challengeOpt.get();
        Instant now = Instant.now();
        if (now.isAfter(challenge.getExpiresAt())) {
            challenge.setInvalidated(true);
            otpChallengeRepository.save(challenge);
            return AuthOutcome.error(HttpStatus.BAD_REQUEST, "Mã xác thực đã hết hạn sau 15 phút. Vui lòng yêu cầu gửi lại mã mới.");
        }

        if (!emailOtpService.verifyOtpHash(OtpPurpose.RESET_PASSWORD, email, challenge.getChallengeSalt(), otp, challenge.getOtpHash())) {
            return recordFailedAttempt(challenge);
        }

        User user = userOpt.get();
        user.setPassword(passwordHashService.hash(newPassword));
        userRepository.save(user);

        challenge.setUsed(true);
        otpChallengeRepository.save(challenge);
        invalidateOpenChallenges(email, OtpPurpose.RESET_PASSWORD);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("ok", true);
        body.put("message", "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.");
        return AuthOutcome.ok(HttpStatus.OK, body);
    }

    private Optional<AuthOutcome> checkSendLimits(String email, OtpPurpose purpose, Instant now) {
        Optional<OtpChallenge> latestOpt = otpChallengeRepository.findTopByEmailAndPurposeOrderByCreatedAtDesc(email, purpose);
        if (latestOpt.isPresent()) {
            Instant allowedAt = latestOpt.get().getLastSentAt().plusSeconds(RESEND_COOLDOWN_SECONDS);
            if (now.isBefore(allowedAt)) {
                long remaining = Math.max(1L, Duration.between(now, allowedAt).getSeconds());
                return Optional.of(AuthOutcome.rateLimited(
                        "Vui lòng đợi " + remaining + " giây trước khi yêu cầu gửi lại mã OTP.",
                        remaining
                ));
            }
        }
        long recentCount = otpChallengeRepository.countByEmailAndPurposeAndCreatedAtAfter(
                email, purpose, now.minusSeconds(RATE_WINDOW_SECONDS)
        );
        if (recentCount >= MAX_REQUESTS_PER_WINDOW) {
            return Optional.of(AuthOutcome.rateLimited(
                    "Email này đã yêu cầu gửi mã OTP quá nhiều lần trong 1 giờ qua. Vui lòng thử lại sau.",
                    RESEND_COOLDOWN_SECONDS
            ));
        }
        return Optional.empty();
    }

    private void invalidateOpenChallenges(String email, OtpPurpose purpose) {
        List<OtpChallenge> open = otpChallengeRepository.findByEmailAndPurposeAndUsedFalseAndInvalidatedFalse(email, purpose);
        if (!open.isEmpty()) {
            for (OtpChallenge item : open) {
                item.setInvalidated(true);
            }
            otpChallengeRepository.saveAll(open);
        }
    }

    private AuthOutcome recordFailedAttempt(OtpChallenge challenge) {
        int nextAttempts = challenge.getFailedAttempts() + 1;
        challenge.setFailedAttempts(nextAttempts);
        if (nextAttempts >= MAX_FAILED_ATTEMPTS) {
            challenge.setInvalidated(true);
            otpChallengeRepository.save(challenge);
            return AuthOutcome.error(
                    HttpStatus.TOO_MANY_REQUESTS,
                    "Bạn đã nhập sai mã OTP quá 5 lần. Mã hiện tại đã bị vô hiệu hóa, vui lòng gửi lại mã mới."
            );
        }
        otpChallengeRepository.save(challenge);
        int remaining = MAX_FAILED_ATTEMPTS - nextAttempts;
        return AuthOutcome.error(
                HttpStatus.BAD_REQUEST,
                "Mã OTP không chính xác. Bạn còn " + remaining + " lần thử lại trước khi mã bị hủy."
        );
    }

    private AuthOutcome mailConfigErrorOutcome() {
        List<String> missing = emailOtpService.getMissingConfigKeys();
        log.warn("OTP request rejected because server SMTP environment configuration is incomplete; missing keys={}",
                String.join(", ", missing));
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("ok", false);
        body.put("code", "MAIL_NOT_CONFIGURED");
        body.put("error", "Chưa gửi được mã xác thực. Vui lòng thử lại sau.");
        return new AuthOutcome(HttpStatus.SERVICE_UNAVAILABLE, body);
    }

    public record AuthOutcome(HttpStatus status, Map<String, Object> body) {
        public static AuthOutcome ok(HttpStatus status, Map<String, Object> body) {
            return new AuthOutcome(status, body);
        }

        public static AuthOutcome error(HttpStatus status, String message) {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("ok", false);
            map.put("error", message);
            return new AuthOutcome(status, map);
        }

        public static AuthOutcome rateLimited(String message, long retryAfterSeconds) {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("ok", false);
            map.put("error", message);
            map.put("retryAfterSeconds", retryAfterSeconds);
            return new AuthOutcome(HttpStatus.TOO_MANY_REQUESTS, map);
        }
    }
}

