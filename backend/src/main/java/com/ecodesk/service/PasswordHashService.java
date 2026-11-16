package com.ecodesk.service;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.regex.Pattern;

/**
 * Hashes new passwords using BCrypt while preserving verification compatibility
 * with legacy plaintext or 64-hex SHA-256 passwords from older records.
 */
@Service
public class PasswordHashService {

    private static final Pattern SHA256_HEX_PATTERN = Pattern.compile("^[0-9a-f]{64}$");
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(10);

    public String hash(String rawPassword) {
        if (rawPassword == null || rawPassword.isEmpty()) {
            throw new IllegalArgumentException("Password cannot be empty");
        }
        return encoder.encode(rawPassword);
    }

    public boolean isBcryptHash(String storedPassword) {
        if (storedPassword == null) return false;
        return storedPassword.length() == 60 &&
                (storedPassword.startsWith("$2a$") || storedPassword.startsWith("$2b$") || storedPassword.startsWith("$2y$"));
    }

    public boolean matches(String rawPassword, String storedPassword) {
        if (rawPassword == null || storedPassword == null || storedPassword.isEmpty()) {
            return false;
        }
        if (isBcryptHash(storedPassword)) {
            return encoder.matches(rawPassword, storedPassword);
        }
        if (SHA256_HEX_PATTERN.matcher(storedPassword).matches()) {
            String legacySha = sha256Hex(rawPassword);
            return MessageDigest.isEqual(
                    legacySha.getBytes(StandardCharsets.UTF_8),
                    storedPassword.getBytes(StandardCharsets.UTF_8)
            );
        }
        return MessageDigest.isEqual(
                rawPassword.getBytes(StandardCharsets.UTF_8),
                storedPassword.getBytes(StandardCharsets.UTF_8)
        );
    }

    public boolean isStrongRegisterPassword(String password) {
        if (password == null || password.length() < 10) return false;
        boolean hasLower = password.chars().anyMatch(ch -> ch >= 'a' && ch <= 'z');
        boolean hasUpper = password.chars().anyMatch(ch -> ch >= 'A' && ch <= 'Z');
        boolean hasDigit = password.chars().anyMatch(ch -> ch >= '0' && ch <= '9');
        boolean hasSymbol = password.chars().anyMatch(ch -> !(ch >= 'a' && ch <= 'z') && !(ch >= 'A' && ch <= 'Z') && !(ch >= '0' && ch <= '9'));
        return hasLower && hasUpper && hasDigit && hasSymbol;
    }

    public boolean isStrongResetPassword(String password) {
        if (password == null || password.length() < 8) return false;
        boolean hasLower = password.chars().anyMatch(ch -> ch >= 'a' && ch <= 'z');
        boolean hasUpper = password.chars().anyMatch(ch -> ch >= 'A' && ch <= 'Z');
        boolean hasDigit = password.chars().anyMatch(ch -> ch >= '0' && ch <= '9');
        return hasLower && hasUpper && hasDigit;
    }

    private static String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}

