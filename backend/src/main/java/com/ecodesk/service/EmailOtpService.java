package com.ecodesk.service;

import com.ecodesk.entity.OtpPurpose;
import jakarta.mail.internet.AddressException;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Properties;
import java.util.regex.Pattern;

/**
 * Generates CSPRNG 6-digit OTPs, computes salted hashes, and dispatches real
 * verification emails through SMTP credentials supplied via environment variables.
 */
@Service
public class EmailOtpService {

    private static final Logger log = LoggerFactory.getLogger(EmailOtpService.class);
    private static final String DEFAULT_OTP_PEPPER = "ecodesk-server-otp-pepper-v1";
    private static final Pattern RESEND_KEY_PATTERN = Pattern.compile("re_[A-Za-z0-9_-]{8,}");
    private final SecureRandom secureRandom = new SecureRandom();

    private final String smtpHost;
    private final int smtpPort;
    private final String smtpUsername;
    private final String smtpPassword;
    private final boolean smtpAuth;
    private final boolean smtpStartTls;
    private final boolean smtpSsl;
    private final String mailFrom;
    private final String mailFromName;
    private final String otpSecret;
    private JavaMailSender mailSenderOverride;

    public EmailOtpService(
            @Value("${ecodesk.mail.host:}") String smtpHost,
            @Value("${ecodesk.mail.port:587}") int smtpPort,
            @Value("${ecodesk.mail.username:}") String smtpUsername,
            @Value("${ecodesk.mail.password:}") String smtpPassword,
            @Value("${ecodesk.mail.auth:true}") boolean smtpAuth,
            @Value("${ecodesk.mail.starttls:true}") boolean smtpStartTls,
            @Value("${ecodesk.mail.ssl:false}") boolean smtpSsl,
            @Value("${ecodesk.mail.from:}") String mailFrom,
            @Value("${ecodesk.mail.from-name:EcoDesk Studio}") String mailFromName,
            @Value("${ecodesk.otp.secret:}") String otpSecret
    ) {
        this.smtpHost = safeTrim(smtpHost);
        this.smtpPort = smtpPort > 0 ? smtpPort : 587;
        this.smtpUsername = safeTrim(smtpUsername);
        this.smtpPassword = smtpPassword != null ? smtpPassword.trim() : "";
        this.smtpAuth = smtpAuth;
        // Standard SMTPS ports (465, 2465) require implicit SSL; STARTTLS ports (587, 2587) require STARTTLS.
        if (this.smtpPort == 465 || this.smtpPort == 2465) {
            this.smtpSsl = true;
            this.smtpStartTls = false;
        } else if ((this.smtpPort == 587 || this.smtpPort == 2587) && smtpSsl && !smtpStartTls) {
            this.smtpSsl = false;
            this.smtpStartTls = true;
        } else {
            this.smtpStartTls = smtpStartTls;
            this.smtpSsl = smtpSsl;
        }
        String resolvedFrom = safeTrim(mailFrom);
        if (resolvedFrom.isEmpty() && this.smtpUsername.contains("@")) {
            resolvedFrom = this.smtpUsername;
        }
        this.mailFrom = resolvedFrom;
        this.mailFromName = safeTrim(mailFromName).isEmpty() ? "EcoDesk Studio" : safeTrim(mailFromName);
        this.otpSecret = safeTrim(otpSecret);
    }

    boolean isStartTlsEnabled() {
        return smtpStartTls;
    }

    boolean isSslEnabled() {
        return smtpSsl;
    }

    public void setMailSenderOverride(JavaMailSender mailSenderOverride) {
        this.mailSenderOverride = mailSenderOverride;
    }

    public String generateSixDigitOtp() {
        int code = secureRandom.nextInt(1_000_000);
        return String.format(Locale.ROOT, "%06d", code);
    }

    public String generateSaltHex() {
        byte[] bytes = new byte[16];
        secureRandom.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    public String hashOtp(OtpPurpose purpose, String normalizedEmail, String saltHex, String otpCode) {
        String pepper = otpSecret.isEmpty() ? DEFAULT_OTP_PEPPER : otpSecret;
        String payload = pepper + ":" + purpose.name() + ":" + normalizedEmail + ":" + saltHex + ":" + otpCode;
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    public boolean verifyOtpHash(OtpPurpose purpose, String normalizedEmail, String saltHex, String otpCode, String expectedHash) {
        if (otpCode == null || expectedHash == null) return false;
        String actualHash = hashOtp(purpose, normalizedEmail, saltHex, otpCode);
        return MessageDigest.isEqual(
                actualHash.getBytes(StandardCharsets.UTF_8),
                expectedHash.getBytes(StandardCharsets.UTF_8)
        );
    }

    public List<String> getMissingConfigKeys() {
        List<String> missing = new ArrayList<>();
        if (isPlaceholder(smtpHost)) missing.add("SMTP_HOST");
        if (smtpAuth && isPlaceholder(smtpUsername)) missing.add("SMTP_USERNAME");
        if (smtpAuth && isPlaceholder(smtpPassword)) missing.add("SMTP_PASSWORD");
        if (!isValidSenderAddress(mailFrom)) missing.add("MAIL_FROM");
        return missing;
    }

    public boolean isMailConfigured() {
        return getMissingConfigKeys().isEmpty();
    }

    public void sendOtpEmail(String toEmail, OtpPurpose purpose, String otpCode, int expiryMinutes, String recipientName) {
        List<String> missing = getMissingConfigKeys();
        if (!missing.isEmpty()) {
            log.warn("OTP email skipped for purpose={} because SMTP configuration is incomplete; missing keys={}",
                    purpose, String.join(", ", missing));
            throw new MailConfigurationException("Chưa gửi được mã xác thực. Vui lòng thử lại sau.");
        }

        JavaMailSender sender = mailSenderOverride != null ? mailSenderOverride : buildJavaMailSender();
        String subject = purpose == OtpPurpose.REGISTER
                ? "[EcoDesk Studio] Mã xác thực đăng ký tài khoản"
                : "[EcoDesk Studio] Mã xác thực đặt lại mật khẩu";

        String greeting = (recipientName != null && !recipientName.isBlank())
                ? "Xin chào " + escapeHtml(recipientName.trim()) + ","
                : "Xin chào quý khách,";
        String actionText = purpose == OtpPurpose.REGISTER
                ? "hoàn tất đăng ký tài khoản tại EcoDesk Studio"
                : "đặt lại mật khẩu tài khoản EcoDesk Studio của bạn";

        String htmlBody = """
                <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;color:#1f2937;background:#ffffff;">
                  <div style="font-size:20px;font-weight:700;color:#114b36;margin-bottom:12px;">EcoDesk Studio</div>
                  <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">%s</p>
                  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Bạn vừa yêu cầu mã xác thực OTP để %s. Vui lòng nhập mã gồm 6 chữ số dưới đây:</p>
                  <div style="text-align:center;margin:20px 0;padding:16px;background:#f3f7f5;border:1px dashed #1f6b50;border-radius:10px;">
                    <span style="font-size:30px;font-weight:700;letter-spacing:8px;color:#114b36;font-family:'Courier New',monospace;">%s</span>
                  </div>
                  <p style="margin:0 0 8px;font-size:14px;line-height:1.6;">• Mã OTP có hiệu lực trong <strong>%d phút</strong> và chỉ dùng được <strong>một lần</strong>.</p>
                  <p style="margin:0 0 8px;font-size:14px;line-height:1.6;">• Nếu bạn yêu cầu gửi lại mã, mã cũ sẽ tự động mất hiệu lực.</p>
                  <p style="margin:16px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">Tuyệt đối không chia sẻ mã OTP này cho bất kỳ ai. Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email này.</p>
                </div>
                """.formatted(greeting, actionText, otpCode, expiryMinutes);

        try {
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, StandardCharsets.UTF_8.name());
            helper.setFrom(new InternetAddress(mailFrom, mailFromName, StandardCharsets.UTF_8.name()));
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(htmlBody, true);
            sender.send(message);
            log.info("Dispatched OTP email purpose={} to={} via host={}:{} (starttls={}, ssl={})",
                    purpose, maskEmail(toEmail), smtpHost, smtpPort, smtpStartTls, smtpSsl);
        } catch (MailAuthenticationException e) {
            log.error("SMTP authentication failed for purpose={}, to={}, host={}:{}, starttls={}, ssl={} - {}",
                    purpose, maskEmail(toEmail), smtpHost, smtpPort, smtpStartTls, smtpSsl,
                    sanitizeErrorMessage(e));
            throw new MailDeliveryException("Chưa gửi được mã xác thực. Vui lòng thử lại sau.", e);
        } catch (MailException e) {
            log.error("SMTP delivery failed for purpose={}, to={}, host={}:{}, starttls={}, ssl={} - {}: {}",
                    purpose, maskEmail(toEmail), smtpHost, smtpPort, smtpStartTls, smtpSsl,
                    e.getClass().getSimpleName(), sanitizeErrorMessage(e));
            throw new MailDeliveryException("Chưa gửi được mã xác thực. Vui lòng thử lại sau.", e);
        } catch (Exception e) {
            log.error("Failed to compose OTP email for purpose={}, to={} - {}: {}",
                    purpose, maskEmail(toEmail), e.getClass().getSimpleName(), sanitizeErrorMessage(e));
            throw new MailDeliveryException("Chưa gửi được mã xác thực. Vui lòng thử lại sau.", e);
        }
    }

    private JavaMailSenderImpl buildJavaMailSender() {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(smtpHost);
        sender.setPort(smtpPort);
        sender.setDefaultEncoding(StandardCharsets.UTF_8.name());
        if (smtpAuth) {
            sender.setUsername(smtpUsername);
            sender.setPassword(smtpPassword);
        }
        Properties props = sender.getJavaMailProperties();
        props.put("mail.transport.protocol", "smtp");
        props.put("mail.debug", "false");
        props.put("mail.smtp.auth", Boolean.toString(smtpAuth));
        props.put("mail.smtp.starttls.enable", Boolean.toString(smtpStartTls));
        props.put("mail.smtp.starttls.required", Boolean.toString(smtpStartTls));
        props.put("mail.smtp.ssl.enable", Boolean.toString(smtpSsl));
        props.put("mail.smtp.ssl.checkserveridentity", Boolean.toString(smtpSsl || smtpStartTls));
        props.put("mail.smtp.ssl.protocols", "TLSv1.2 TLSv1.3");
        props.put("mail.smtp.connectiontimeout", "8000");
        props.put("mail.smtp.timeout", "8000");
        props.put("mail.smtp.writetimeout", "8000");
        return sender;
    }

    String sanitizeErrorMessage(Throwable throwable) {
        if (throwable == null) return "Unknown mail error";
        Throwable root = throwable;
        while (root.getCause() != null && root.getCause() != root) {
            root = root.getCause();
        }
        String message = root.getMessage();
        if (message == null || message.isBlank()) {
            message = throwable.getMessage();
        }
        return sanitizeErrorMessage(message);
    }

    String sanitizeErrorMessage(String raw) {
        if (raw == null || raw.isBlank()) return "Unknown mail error";
        String cleaned = RESEND_KEY_PATTERN.matcher(raw).replaceAll("re_***");
        if (!smtpPassword.isEmpty()) {
            cleaned = cleaned.replace(smtpPassword, "***");
        }
        return cleaned;
    }

    private static boolean isPlaceholder(String value) {
        if (value == null || value.isBlank()) {
            return true;
        }
        String lower = value.trim().toLowerCase(Locale.ROOT);
        return (lower.startsWith("<") && lower.endsWith(">"))
                || lower.contains("your_resend_api_key")
                || lower.contains("your-verified-domain");
    }

    private static boolean isValidSenderAddress(String email) {
        if (isPlaceholder(email) || !email.contains("@")) {
            return false;
        }
        try {
            InternetAddress addr = new InternetAddress(email, true);
            addr.validate();
            return true;
        } catch (AddressException e) {
            return false;
        }
    }

    private static String safeTrim(String value) {
        if (value == null) return "";
        String trimmed = value.trim();
        if (trimmed.length() >= 2 && ((trimmed.startsWith("\"") && trimmed.endsWith("\""))
                || (trimmed.startsWith("'") && trimmed.endsWith("'")))) {
            return trimmed.substring(1, trimmed.length() - 1).trim();
        }
        return trimmed;
    }

    private static String maskEmail(String email) {
        if (email == null) return "***";
        int at = email.indexOf('@');
        if (at <= 1) return "***" + (at >= 0 ? email.substring(at) : "");
        return email.substring(0, 2) + "***" + email.substring(at);
    }

    private static String escapeHtml(String value) {
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }

    public static class MailConfigurationException extends RuntimeException {
        public MailConfigurationException(String message) {
            super(message);
        }
    }

    public static class MailDeliveryException extends RuntimeException {
        public MailDeliveryException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}

