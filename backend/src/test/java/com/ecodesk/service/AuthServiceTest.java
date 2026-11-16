package com.ecodesk.service;

import com.ecodesk.entity.OtpChallenge;
import com.ecodesk.entity.User;
import com.ecodesk.repository.OtpChallengeRepository;
import com.ecodesk.repository.UserRepository;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;

import java.lang.reflect.Proxy;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;

class AuthServiceTest {

    private Map<String, User> usersById;
    private List<OtpChallenge> challenges;
    private UserRepository userRepository;
    private OtpChallengeRepository challengeRepository;
    private PasswordHashService passwordHashService;
    private DisposableEmailPolicy emailPolicy;
    private EmailOtpService emailOtpService;
    private AuthService authService;
    private List<MimeMessage> sentMessages;

    @BeforeEach
    void setUp() {
        usersById = new LinkedHashMap<>();
        challenges = new ArrayList<>();
        sentMessages = new ArrayList<>();

        userRepository = createUserRepositoryProxy();
        challengeRepository = createChallengeRepositoryProxy();
        passwordHashService = new PasswordHashService();
        emailPolicy = new DisposableEmailPolicy();
        emailOtpService = new EmailOtpService(
                "smtp.example.com", 587, "no-reply@ecodesk.vn", "app-password",
                true, true, false, "no-reply@ecodesk.vn", "EcoDesk Studio", "test-pepper-secret"
        );
        emailOtpService.setMailSenderOverride(new RecordingMailSender(sentMessages));
        authService = new AuthService(userRepository, challengeRepository, passwordHashService, emailPolicy, emailOtpService);
    }

    @Test
    void registerOtp_validFlow_hashesPasswordAndCreatesVerifiedUser() throws Exception {
        AuthService.AuthOutcome req = authService.requestRegistrationOtp(
                "Nguyen Van A", "  NewUser@Example.COM ", "EcoDesk#2026!", "0909123456"
        );
        assertEquals(HttpStatus.OK, req.status());
        assertFalse(req.body().containsKey("otp"));
        assertFalse(req.body().containsKey("token"));
        assertEquals(1, sentMessages.size());
        assertFalse(userRepository.existsByEmail("newuser@example.com"));

        OtpChallenge saved = challenges.get(0);
        assertEquals("newuser@example.com", saved.getEmail());
        assertNotEquals("EcoDesk#2026!", saved.getPendingPasswordHash());
        assertTrue(passwordHashService.isBcryptHash(saved.getPendingPasswordHash()));
        assertFalse(saved.getOtpHash().matches("^\\d{6}$"));

        String otpFromEmail = extractOtpFromMessage(sentMessages.get(0));
        assertTrue(otpFromEmail.matches("^\\d{6}$"));

        AuthService.AuthOutcome verify = authService.verifyRegistrationOtp("newuser@example.com", otpFromEmail);
        assertEquals(HttpStatus.CREATED, verify.status());
        User created = userRepository.findByEmail("newuser@example.com").orElseThrow();
        assertTrue(Boolean.TRUE.equals(created.getEmailVerified()));
        assertTrue(passwordHashService.matches("EcoDesk#2026!", created.getPassword()));

        // Reusing same registration OTP after account creation fails (409 Conflict)
        AuthService.AuthOutcome reuse = authService.verifyRegistrationOtp("newuser@example.com", otpFromEmail);
        assertEquals(HttpStatus.CONFLICT, reuse.status());
    }

    @Test
    void registerOtp_wrongAttemptsLockOutAfterFiveTries() throws Exception {
        authService.requestRegistrationOtp("Tester", "locktest@example.com", "EcoDesk#2026!", "");
        String realOtp = extractOtpFromMessage(sentMessages.get(0));
        String wrongOtp = realOtp.equals("000001") ? "000002" : "000001";

        for (int i = 0; i < 4; i++) {
            AuthService.AuthOutcome bad = authService.verifyRegistrationOtp("locktest@example.com", wrongOtp);
            assertEquals(HttpStatus.BAD_REQUEST, bad.status());
        }
        AuthService.AuthOutcome fifth = authService.verifyRegistrationOtp("locktest@example.com", wrongOtp);
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, fifth.status());

        // Even real OTP now fails because challenge is invalidated
        AuthService.AuthOutcome afterLock = authService.verifyRegistrationOtp("locktest@example.com", realOtp);
        assertEquals(HttpStatus.BAD_REQUEST, afterLock.status());
        assertFalse(userRepository.existsByEmail("locktest@example.com"));
    }

    @Test
    void registerOtp_expiredChallengeIsRejected() throws Exception {
        authService.requestRegistrationOtp("Expired User", "expired@example.com", "EcoDesk#2026!", "");
        String otp = extractOtpFromMessage(sentMessages.get(0));
        challenges.get(0).setExpiresAt(Instant.now().minusSeconds(5));

        AuthService.AuthOutcome verify = authService.verifyRegistrationOtp("expired@example.com", otp);
        assertEquals(HttpStatus.BAD_REQUEST, verify.status());
        assertTrue(challenges.get(0).isInvalidated());
        assertFalse(userRepository.existsByEmail("expired@example.com"));
    }

    @Test
    void registerOtp_resendCooldownAndOldOtpInvalidation() throws Exception {
        authService.requestRegistrationOtp("Resend User", "resend@example.com", "EcoDesk#2026!", "");
        String firstOtp = extractOtpFromMessage(sentMessages.get(0));

        // Immediate resend blocked by 60s cooldown
        AuthService.AuthOutcome tooFast = authService.requestRegistrationOtp(
                "Resend User", "resend@example.com", "EcoDesk#2026!", ""
        );
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, tooFast.status());
        assertTrue(((Number) tooFast.body().get("retryAfterSeconds")).longValue() > 0);

        // Advance past cooldown & resend
        challenges.get(0).setLastSentAt(Instant.now().minusSeconds(65));
        AuthService.AuthOutcome resent = authService.requestRegistrationOtp(
                "Resend User", "resend@example.com", "EcoDesk#2026!", ""
        );
        assertEquals(HttpStatus.OK, resent.status());
        String secondOtp = extractOtpFromMessage(sentMessages.get(1));

        // First OTP must now fail even if typed instead of second
        if (!firstOtp.equals(secondOtp)) {
            AuthService.AuthOutcome oldAttempt = authService.verifyRegistrationOtp("resend@example.com", firstOtp);
            assertEquals(HttpStatus.BAD_REQUEST, oldAttempt.status());
        }
        AuthService.AuthOutcome newAttempt = authService.verifyRegistrationOtp("resend@example.com", secondOtp);
        assertEquals(HttpStatus.CREATED, newAttempt.status());
    }

    @Test
    void registerOtp_rejectsDisposableAndExistingEmail() {
        AuthService.AuthOutcome disposable = authService.requestRegistrationOtp(
                "Temp User", "foo@mailinator.com", "EcoDesk#2026!", ""
        );
        assertEquals(HttpStatus.BAD_REQUEST, disposable.status());

        User existing = new User();
        existing.setId("U_1");
        existing.setName("Existing");
        existing.setEmail("taken@example.com");
        existing.setPassword("secret");
        userRepository.save(existing);

        AuthService.AuthOutcome conflict = authService.requestRegistrationOtp(
                "Dup", "TAKEN@example.com", "EcoDesk#2026!", ""
        );
        assertEquals(HttpStatus.CONFLICT, conflict.status());
    }

    @Test
    void mailNotConfigured_returns503WithoutCreatingUserOrFakingOtp() {
        EmailOtpService unconfiguredMail = new EmailOtpService("", 587, "", "", true, true, false, "", "EcoDesk", "");
        AuthService unconfiguredAuth = new AuthService(
                userRepository, challengeRepository, passwordHashService, emailPolicy, unconfiguredMail
        );
        AuthService.AuthOutcome out = unconfiguredAuth.requestRegistrationOtp(
                "Real User", "real@example.com", "EcoDesk#2026!", ""
        );
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, out.status());
        assertEquals("MAIL_NOT_CONFIGURED", out.body().get("code"));
        assertTrue(challenges.isEmpty());
    }

    @Test
    void smtpDeliveryFailure_propagatesAndRollsBackEmailSend() {
        emailOtpService.setMailSenderOverride(new RecordingMailSender(sentMessages) {
            @Override
            public void send(MimeMessage mimeMessage) {
                throw new MailSendException("SMTP down");
            }
        });
        assertThrows(EmailOtpService.MailDeliveryException.class, () ->
                authService.requestRegistrationOtp("Fail Mail", "fail@example.com", "EcoDesk#2026!", "")
        );
    }

    @Test
    void passwordReset_nonEnumerationAndSuccessfulReset() throws Exception {
        User existing = new User();
        existing.setId("U_RESET");
        existing.setName("Reset User");
        existing.setEmail("member@example.com");
        existing.setPassword("LegacyPlain123");
        userRepository.save(existing);

        AuthService.AuthOutcome missingEmail = authService.requestPasswordResetOtp("nobody@example.com");
        AuthService.AuthOutcome validEmail = authService.requestPasswordResetOtp("member@example.com");

        assertEquals(HttpStatus.OK, missingEmail.status());
        assertEquals(HttpStatus.OK, validEmail.status());
        assertEquals(missingEmail.body().get("message"), validEmail.body().get("message"));
        assertFalse(validEmail.body().containsKey("otp"));
        assertFalse(validEmail.body().containsKey("token"));
        assertFalse(validEmail.body().containsKey("userFound"));
        assertEquals(1, sentMessages.size());

        String otp = extractOtpFromMessage(sentMessages.get(0));
        AuthService.AuthOutcome resetOk = authService.verifyAndResetPassword("member@example.com", otp, "NewPass123");
        assertEquals(HttpStatus.OK, resetOk.status());

        User updated = userRepository.findByEmail("member@example.com").orElseThrow();
        assertTrue(passwordHashService.matches("NewPass123", updated.getPassword()));
        assertTrue(passwordHashService.isBcryptHash(updated.getPassword()));

        // Reusing single-use password-reset OTP is rejected with 400
        AuthService.AuthOutcome reuseReset = authService.verifyAndResetPassword("member@example.com", otp, "AnotherPass123");
        assertEquals(HttpStatus.BAD_REQUEST, reuseReset.status());
    }

    @Test
    void generateSixDigitOtp_preservesSixDigitZeroPaddedFormat() {
        for (int i = 0; i < 200; i++) {
            String code = emailOtpService.generateSixDigitOtp();
            assertEquals(6, code.length());
            assertTrue(code.matches("^\\d{6}$"));
        }
    }

    @Test
    void resendSmtp_requiresValidMailFromAndNormalizesTlsByPort() {
        EmailOtpService missingFrom = new EmailOtpService(
                "smtp.resend.com", 465, "resend", "re_dummy_key_value_12345",
                true, true, false, "", "EcoDesk Studio", ""
        );
        assertFalse(missingFrom.isMailConfigured());
        assertEquals(List.of("MAIL_FROM"), missingFrom.getMissingConfigKeys());
        assertTrue(missingFrom.isSslEnabled());
        assertFalse(missingFrom.isStartTlsEnabled());

        EmailOtpService placeholderConfig = new EmailOtpService(
                "smtp.resend.com", 465, "resend", "<re_your_api_key>",
                true, false, true, "<địa chỉ gửi thuộc tên miền đã xác minh>", "EcoDesk Studio", ""
        );
        assertFalse(placeholderConfig.isMailConfigured());
        assertEquals(List.of("SMTP_PASSWORD", "MAIL_FROM"), placeholderConfig.getMissingConfigKeys());

        EmailOtpService configuredSsl = new EmailOtpService(
                "smtp.resend.com", 465, "resend", "re_dummy_key_value_12345",
                true, true, false, "no-reply@ecodesk.vn", "EcoDesk Studio", ""
        );
        assertTrue(configuredSsl.isMailConfigured());
        assertTrue(configuredSsl.isSslEnabled());
        assertFalse(configuredSsl.isStartTlsEnabled());

        EmailOtpService configuredStartTls = new EmailOtpService(
                "smtp.resend.com", 587, "resend", "re_dummy_key_value_12345",
                true, false, true, "no-reply@ecodesk.vn", "EcoDesk Studio", ""
        );
        assertTrue(configuredStartTls.isMailConfigured());
        assertTrue(configuredStartTls.isStartTlsEnabled());
        assertFalse(configuredStartTls.isSslEnabled());
    }

    @Test
    void sanitizeErrorMessage_redactsResendKeyAndSmtpPassword() {
        EmailOtpService service = new EmailOtpService(
                "smtp.resend.com", 465, "resend", "super-secret-smtp-pass",
                true, false, true, "no-reply@ecodesk.vn", "EcoDesk Studio", ""
        );
        String sanitized = service.sanitizeErrorMessage(
                "Auth failed with key re_1234567890abcdef and pass super-secret-smtp-pass"
        );
        assertFalse(sanitized.contains("re_1234567890abcdef"));
        assertFalse(sanitized.contains("super-secret-smtp-pass"));
        assertTrue(sanitized.contains("re_***"));
        assertTrue(sanitized.contains("***"));
    }

    private static String extractOtpFromMessage(MimeMessage message) throws Exception {
        String content = String.valueOf(message.getContent());
        Matcher matcher = Pattern.compile(">(\\d{6})<").matcher(content);
        assertTrue(matcher.find(), "Expected 6-digit OTP in email HTML");
        return matcher.group(1);
    }

    private UserRepository createUserRepositoryProxy() {
        return (UserRepository) Proxy.newProxyInstance(
                UserRepository.class.getClassLoader(),
                new Class<?>[]{UserRepository.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "save" -> {
                        User u = (User) args[0];
                        usersById.put(u.getId(), u);
                        yield u;
                    }
                    case "findByEmail" -> usersById.values().stream()
                            .filter(u -> u.getEmail().equalsIgnoreCase((String) args[0]))
                            .findFirst();
                    case "existsByEmail" -> usersById.values().stream()
                            .anyMatch(u -> u.getEmail().equalsIgnoreCase((String) args[0]));
                    case "findById" -> Optional.ofNullable(usersById.get((String) args[0]));
                    case "findAll" -> new ArrayList<>(usersById.values());
                    default -> throw new UnsupportedOperationException(method.getName());
                }
        );
    }

    private OtpChallengeRepository createChallengeRepositoryProxy() {
        return (OtpChallengeRepository) Proxy.newProxyInstance(
                OtpChallengeRepository.class.getClassLoader(),
                new Class<?>[]{OtpChallengeRepository.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "save" -> {
                        OtpChallenge c = (OtpChallenge) args[0];
                        challenges.removeIf(item -> item.getId().equals(c.getId()));
                        challenges.add(c);
                        yield c;
                    }
                    case "saveAll" -> {
                        @SuppressWarnings("unchecked")
                        Iterable<OtpChallenge> list = (Iterable<OtpChallenge>) args[0];
                        for (OtpChallenge c : list) {
                            challenges.removeIf(item -> item.getId().equals(c.getId()));
                            challenges.add(c);
                        }
                        yield list;
                    }
                    case "findTopByEmailAndPurposeAndUsedFalseAndInvalidatedFalseOrderByCreatedAtDesc" ->
                            challenges.stream()
                                    .filter(c -> c.getEmail().equals(args[0]) && c.getPurpose() == args[1] && !c.isUsed() && !c.isInvalidated())
                                    .max(Comparator.comparing(OtpChallenge::getCreatedAt));
                    case "findTopByEmailAndPurposeOrderByCreatedAtDesc" ->
                            challenges.stream()
                                    .filter(c -> c.getEmail().equals(args[0]) && c.getPurpose() == args[1])
                                    .max(Comparator.comparing(OtpChallenge::getCreatedAt));
                    case "findByEmailAndPurposeAndUsedFalseAndInvalidatedFalse" ->
                            challenges.stream()
                                    .filter(c -> c.getEmail().equals(args[0]) && c.getPurpose() == args[1] && !c.isUsed() && !c.isInvalidated())
                                    .toList();
                    case "countByEmailAndPurposeAndCreatedAtAfter" -> {
                        Instant since = (Instant) args[2];
                        yield challenges.stream()
                                .filter(c -> c.getEmail().equals(args[0]) && c.getPurpose() == args[1] && c.getCreatedAt().isAfter(since))
                                .count();
                    }
                    default -> throw new UnsupportedOperationException(method.getName());
                }
        );
    }

    private static class RecordingMailSender implements JavaMailSender {
        private final List<MimeMessage> sent;
        private final AtomicInteger counter = new AtomicInteger();

        RecordingMailSender(List<MimeMessage> sent) {
            this.sent = sent;
        }

        @Override
        public MimeMessage createMimeMessage() {
            return new MimeMessage(Session.getInstance(new Properties()));
        }

        @Override
        public MimeMessage createMimeMessage(java.io.InputStream contentStream) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void send(MimeMessage mimeMessage) {
            counter.incrementAndGet();
            sent.add(mimeMessage);
        }

        @Override
        public void send(MimeMessage... mimeMessages) {
            for (MimeMessage m : mimeMessages) send(m);
        }

        @Override
        public void send(org.springframework.mail.SimpleMailMessage simpleMessage) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void send(org.springframework.mail.SimpleMailMessage... simpleMessages) {
            throw new UnsupportedOperationException();
        }
    }
}
