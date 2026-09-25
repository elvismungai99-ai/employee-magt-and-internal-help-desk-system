package com.leavemgt.common.security;

import com.leavemgt.identity.entity.RefreshToken;
import com.leavemgt.identity.entity.User;
import com.leavemgt.identity.repository.RefreshTokenRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.Optional;

@Service
public class RefreshTokenService {

    private final RefreshTokenRepository refreshTokenRepository;
    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${jwt.refresh-token-expiration-ms:604800000}") // Default 7 days
    private long refreshTokenExpirationMs;

    public RefreshTokenService(RefreshTokenRepository refreshTokenRepository) {
        this.refreshTokenRepository = refreshTokenRepository;
    }

    public static class TokenPair {
        private final String rawRefreshToken;
        private final RefreshToken entity;

        public TokenPair(String rawRefreshToken, RefreshToken entity) {
            this.rawRefreshToken = rawRefreshToken;
            this.entity = entity;
        }

        public String getRawRefreshToken() { return rawRefreshToken; }
        public RefreshToken getEntity() { return entity; }
    }

    @Transactional
    public TokenPair createRefreshToken(User user) {
        String rawToken = generateOpaqueToken();
        String tokenHash = hashToken(rawToken);

        RefreshToken refreshToken = RefreshToken.builder()
                .user(user)
                .tokenHash(tokenHash)
                .expiresAt(OffsetDateTime.now().plusSeconds(refreshTokenExpirationMs / 1000))
                .build();

        RefreshToken saved = refreshTokenRepository.save(refreshToken);
        return new TokenPair(rawToken, saved);
    }

    @Transactional
    public Optional<RefreshToken> validateRefreshToken(String rawToken) {
        String tokenHash = hashToken(rawToken);
        Optional<RefreshToken> tokenOpt = refreshTokenRepository.findByTokenHashAndRevokedAtIsNull(tokenHash);

        if (tokenOpt.isPresent()) {
            RefreshToken token = tokenOpt.get();
            if (token.isValid()) {
                return Optional.of(token);
            }
        }
        return Optional.empty();
    }

    @Transactional
    public TokenPair rotateRefreshToken(RefreshToken existingToken) {
        // 1. Revoke existing token
        existingToken.setRevokedAt(OffsetDateTime.now());
        refreshTokenRepository.save(existingToken);

        // 2. Create new fresh token for the user
        return createRefreshToken(existingToken.getUser());
    }

    @Transactional
    public boolean revokeToken(String rawToken) {
        String tokenHash = hashToken(rawToken);
        Optional<RefreshToken> tokenOpt = refreshTokenRepository.findByTokenHash(tokenHash);
        if (tokenOpt.isPresent()) {
            RefreshToken token = tokenOpt.get();
            token.setRevokedAt(OffsetDateTime.now());
            refreshTokenRepository.save(token);
            return true;
        }
        return false;
    }

    public String hashToken(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return bytesToHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not available", e);
        }
    }

    private String generateOpaqueToken() {
        byte[] randomBytes = new byte[48];
        secureRandom.nextBytes(randomBytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder hexString = new StringBuilder();
        for (byte b : bytes) {
            String hex = Integer.toHexString(0xff & b);
            if (hex.length() == 1) hexString.append('0');
            hexString.append(hex);
        }
        return hexString.toString();
    }
}
