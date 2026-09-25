package com.leavemgt.common.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class LoginRateLimiter {

    @Value("${app.auth.max-failed-attempts:5}")
    private int maxFailedAttempts;

    @Value("${app.auth.lockout-duration-minutes:15}")
    private int lockoutDurationMinutes;

    private static class AttemptDetails {
        int attempts;
        Instant lockoutUntil;

        AttemptDetails(int attempts) {
            this.attempts = attempts;
            this.lockoutUntil = null;
        }
    }

    private final ConcurrentHashMap<String, AttemptDetails> attemptsMap = new ConcurrentHashMap<>();

    public boolean isBlocked(String key) {
        AttemptDetails details = attemptsMap.get(key);
        if (details == null) {
            return false;
        }

        if (details.lockoutUntil != null) {
            if (Instant.now().isBefore(details.lockoutUntil)) {
                return true; // Still locked out
            } else {
                // Lockout period expired
                attemptsMap.remove(key);
                return false;
            }
        }

        return details.attempts >= maxFailedAttempts;
    }

    public void recordFailedAttempt(String key) {
        attemptsMap.compute(key, (k, details) -> {
            if (details == null) {
                return new AttemptDetails(1);
            }

            details.attempts++;
            if (details.attempts >= maxFailedAttempts) {
                details.lockoutUntil = Instant.now().plusSeconds(lockoutDurationMinutes * 60L);
            }
            return details;
        });
    }

    public void reset(String key) {
        attemptsMap.remove(key);
    }
}
