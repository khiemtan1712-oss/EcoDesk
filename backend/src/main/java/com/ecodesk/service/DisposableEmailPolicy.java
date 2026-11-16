package com.ecodesk.service;

import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Normalizes emails, checks format, and blocks well-known disposable email domains.
 */
@Service
public class DisposableEmailPolicy {

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[a-z0-9._%+\\-]+@[a-z0-9.\\-]+\\.[a-z]{2,}$");

    private static final Set<String> DISPOSABLE_DOMAINS = Set.of(
            "mailinator.com",
            "10minutemail.com",
            "10minutemail.net",
            "guerrillamail.com",
            "guerrillamail.net",
            "guerrillamail.org",
            "sharklasers.com",
            "tempmail.com",
            "temp-mail.org",
            "temp-mail.io",
            "yopmail.com",
            "yopmail.fr",
            "yopmail.net",
            "trashmail.com",
            "trashmail.net",
            "getnada.com",
            "nada.email",
            "dispostable.com",
            "fakeinbox.com",
            "maildrop.cc",
            "mohmal.com",
            "throwawaymail.com",
            "mintemail.com",
            "mytemp.email",
            "emailondeck.com",
            "mailnesia.com",
            "tempail.com"
    );

    public String normalize(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    public boolean isValidFormat(String normalizedEmail) {
        return normalizedEmail != null && !normalizedEmail.isEmpty() && EMAIL_PATTERN.matcher(normalizedEmail).matches();
    }

    public boolean isDisposableDomain(String normalizedEmail) {
        if (normalizedEmail == null) return false;
        int atIndex = normalizedEmail.lastIndexOf('@');
        if (atIndex < 0 || atIndex == normalizedEmail.length() - 1) return false;
        String domain = normalizedEmail.substring(atIndex + 1);
        if (DISPOSABLE_DOMAINS.contains(domain)) {
            return true;
        }
        return DISPOSABLE_DOMAINS.stream().anyMatch(blocked -> domain.endsWith("." + blocked));
    }
}

