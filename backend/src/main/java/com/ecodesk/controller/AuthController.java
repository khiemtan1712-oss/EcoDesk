package com.ecodesk.controller;

import com.ecodesk.service.AuthService;
import com.ecodesk.service.AuthService.AuthOutcome;
import com.ecodesk.service.EmailOtpService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final EmailOtpService emailOtpService;

    public AuthController(AuthService authService, EmailOtpService emailOtpService) {
        this.authService = authService;
        this.emailOtpService = emailOtpService;
    }

    @GetMapping("/mail-status")
    public ResponseEntity<Map<String, Object>> getMailStatus() {
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("configured", emailOtpService.isMailConfigured());
        return ResponseEntity.ok(status);
    }

    @PostMapping("/register/request-otp")
    public ResponseEntity<Map<String, Object>> requestRegisterOtp(@RequestBody Map<String, String> body) {
        try {
            AuthOutcome outcome = authService.requestRegistrationOtp(
                    body.get("name"),
                    body.get("email"),
                    body.get("password"),
                    body.get("phone")
            );
            return ResponseEntity.status(outcome.status()).body(outcome.body());
        } catch (EmailOtpService.MailConfigurationException ex) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("ok", false, "code", "MAIL_NOT_CONFIGURED", "error", ex.getMessage()));
        } catch (EmailOtpService.MailDeliveryException ex) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("ok", false, "code", "MAIL_SEND_FAILED", "error", ex.getMessage()));
        }
    }

    @PostMapping("/register/verify-otp")
    public ResponseEntity<Map<String, Object>> verifyRegisterOtp(@RequestBody Map<String, String> body) {
        AuthOutcome outcome = authService.verifyRegistrationOtp(body.get("email"), body.get("otp"));
        return ResponseEntity.status(outcome.status()).body(outcome.body());
    }

    @PostMapping("/password-reset/request-otp")
    public ResponseEntity<Map<String, Object>> requestPasswordResetOtp(@RequestBody Map<String, String> body) {
        try {
            AuthOutcome outcome = authService.requestPasswordResetOtp(body.get("email"));
            return ResponseEntity.status(outcome.status()).body(outcome.body());
        } catch (EmailOtpService.MailConfigurationException ex) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("ok", false, "code", "MAIL_NOT_CONFIGURED", "error", ex.getMessage()));
        } catch (EmailOtpService.MailDeliveryException ex) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(Map.of("ok", false, "code", "MAIL_SEND_FAILED", "error", ex.getMessage()));
        }
    }

    @PostMapping("/password-reset/verify")
    public ResponseEntity<Map<String, Object>> verifyAndResetPassword(@RequestBody Map<String, String> body) {
        AuthOutcome outcome = authService.verifyAndResetPassword(
                body.get("email"),
                body.get("otp"),
                body.get("newPassword")
        );
        return ResponseEntity.status(outcome.status()).body(outcome.body());
    }
}

