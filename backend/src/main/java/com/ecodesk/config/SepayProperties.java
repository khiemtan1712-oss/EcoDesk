package com.ecodesk.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Locale;

/**
 * Holds server-side SePay API Access & receiving bank settings read strictly
 * from environment / .env configuration. Never expose apiToken to clients or logs.
 */
@Component
public class SepayProperties {

    private final String apiToken;
    private final String environment;
    private final String apiVersion;
    private final String apiBaseUrlOverride;
    private final String bankCode;
    private final String bankName;
    private final String accountNumber;
    private final String accountName;
    private final String paymentPrefix;
    private final boolean syncEnabled;
    private final long syncIntervalMs;
    private final int lookbackDays;

    public SepayProperties(
            @Value("${ecodesk.sepay.api-token:}") String apiToken,
            @Value("${ecodesk.sepay.environment:live}") String environment,
            @Value("${ecodesk.sepay.api-version:v2}") String apiVersion,
            @Value("${ecodesk.sepay.api-base-url:}") String apiBaseUrlOverride,
            @Value("${ecodesk.sepay.bank-code:}") String bankCode,
            @Value("${ecodesk.sepay.bank-name:}") String bankName,
            @Value("${ecodesk.sepay.account-number:}") String accountNumber,
            @Value("${ecodesk.sepay.account-name:}") String accountName,
            @Value("${ecodesk.sepay.payment-prefix:DH}") String paymentPrefix,
            @Value("${ecodesk.sepay.sync-enabled:true}") boolean syncEnabled,
            @Value("${ecodesk.sepay.sync-interval-ms:15000}") long syncIntervalMs,
            @Value("${ecodesk.sepay.lookback-days:1}") int lookbackDays
    ) {
        this.apiToken = trim(apiToken);
        this.environment = normalizeEnvironment(environment);
        this.apiVersion = normalizeApiVersion(apiVersion);
        this.apiBaseUrlOverride = trim(apiBaseUrlOverride);
        this.bankCode = trim(bankCode);
        this.bankName = trim(bankName);
        this.accountNumber = trim(accountNumber);
        this.accountName = trim(accountName);
        this.paymentPrefix = normalizePrefix(paymentPrefix);
        this.syncEnabled = syncEnabled;
        this.syncIntervalMs = Math.max(5000L, syncIntervalMs);
        this.lookbackDays = Math.max(0, Math.min(30, lookbackDays));
    }

    private static String trim(String val) {
        return val == null ? "" : val.trim();
    }

    private static String normalizeEnvironment(String raw) {
        String clean = trim(raw).toLowerCase(Locale.ROOT);
        if ("test".equals(clean) || "sandbox".equals(clean)) {
            return "sandbox";
        }
        if (clean.isEmpty() || "live".equals(clean) || "prod".equals(clean) || "production".equals(clean)) {
            return "live";
        }
        return clean;
    }

    private static String normalizeApiVersion(String raw) {
        String clean = trim(raw).toLowerCase(Locale.ROOT);
        return clean.isEmpty() ? "v2" : clean;
    }

    private static String normalizePrefix(String raw) {
        String clean = trim(raw).toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
        return clean.isEmpty() ? "DH" : clean;
    }

    public boolean isSandbox() {
        return "sandbox".equals(environment);
    }

    public boolean isTokenConfigured() {
        return !apiToken.isEmpty();
    }

    public boolean isReceiverConfigured() {
        return !bankCode.isEmpty() && !normalizeAccountNumber(accountNumber).isEmpty();
    }

    public static String normalizeAccountNumber(String raw) {
        return raw == null ? "" : raw.replaceAll("[^A-Za-z0-9]", "").trim();
    }

    /**
     * Validates environment/version/baseUrl compatibility so a Test Mode token never
     * calls a Live endpoint or vice versa.
     */
    public String resolveTransactionsEndpoint() {
        if (!"live".equals(environment) && !"sandbox".equals(environment)) {
            throw new IllegalStateException("SEPAY_ENVIRONMENT không hợp lệ (chỉ chấp nhận live hoặc sandbox).");
        }
        if (!"v1".equals(apiVersion) && !"v2".equals(apiVersion)) {
            throw new IllegalStateException("SEPAY_API_VERSION không hợp lệ (chỉ chấp nhận v1 hoặc v2).");
        }
        if (isSandbox() && "v1".equals(apiVersion)) {
            throw new IllegalStateException(
                    "SePay Test Mode (sandbox) chỉ hỗ trợ API v2 (userapi-sandbox.sepay.vn/v2); không dùng v1 live endpoint."
            );
        }

        if (!apiBaseUrlOverride.isEmpty()) {
            String lower = apiBaseUrlOverride.toLowerCase(Locale.ROOT);
            if (!lower.startsWith("https://")) {
                throw new IllegalStateException("SEPAY_API_BASE_URL phải sử dụng HTTPS.");
            }
            if (isSandbox() && (lower.contains("userapi.sepay.vn") || lower.contains("my.sepay.vn"))) {
                throw new IllegalStateException("Không được dùng endpoint Live cho SEPAY_ENVIRONMENT=sandbox.");
            }
            if (!isSandbox() && lower.contains("userapi-sandbox.sepay.vn")) {
                throw new IllegalStateException("Không được dùng endpoint Sandbox cho SEPAY_ENVIRONMENT=live.");
            }
            String cleanBase = apiBaseUrlOverride.replaceAll("/+$", "");
            if ("v1".equals(apiVersion)) {
                return cleanBase.endsWith("/transactions/list") ? cleanBase : cleanBase + "/transactions/list";
            }
            return cleanBase.endsWith("/transactions") ? cleanBase : cleanBase + "/transactions";
        }

        if (isSandbox()) {
            return "https://userapi-sandbox.sepay.vn/v2/transactions";
        }
        if ("v1".equals(apiVersion)) {
            return "https://my.sepay.vn/userapi/transactions/list";
        }
        return "https://userapi.sepay.vn/v2/transactions";
    }

    public String getApiToken() {
        return apiToken;
    }

    public String getEnvironment() {
        return environment;
    }

    public String getApiVersion() {
        return apiVersion;
    }

    public String getBankCode() {
        return bankCode;
    }

    public String getBankName() {
        return bankName.isEmpty() ? bankCode : bankName;
    }

    public String getAccountNumber() {
        return accountNumber;
    }

    public String getAccountName() {
        return accountName;
    }

    public String getPaymentPrefix() {
        return paymentPrefix;
    }

    public boolean isSyncEnabled() {
        return syncEnabled;
    }

    public long getSyncIntervalMs() {
        return syncIntervalMs;
    }

    public int getLookbackDays() {
        return lookbackDays;
    }
}

