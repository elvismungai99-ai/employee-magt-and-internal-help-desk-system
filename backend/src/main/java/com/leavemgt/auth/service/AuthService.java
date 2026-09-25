package com.leavemgt.auth.service;

import com.leavemgt.auth.dto.AuthResponse;
import com.leavemgt.auth.dto.LoginRequest;
import com.leavemgt.auth.dto.RefreshTokenRequest;
import com.leavemgt.auth.dto.RegisterRequest;
import com.leavemgt.common.exception.RateLimitExceededException;
import com.leavemgt.common.security.JwtService;
import com.leavemgt.common.security.LoginRateLimiter;
import com.leavemgt.common.security.RefreshTokenService;
import com.leavemgt.identity.entity.Department;
import com.leavemgt.identity.entity.Permission;
import com.leavemgt.identity.entity.Role;
import com.leavemgt.identity.entity.User;
import com.leavemgt.identity.repository.DepartmentRepository;
import com.leavemgt.identity.repository.RoleRepository;
import com.leavemgt.identity.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final DepartmentRepository departmentRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokenService;
    private final LoginRateLimiter loginRateLimiter;

    @Value("${jwt.access-token-expiration-ms:900000}")
    private long accessTokenExpirationMs;

    public AuthService(UserRepository userRepository,
                       RoleRepository roleRepository,
                       DepartmentRepository departmentRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       RefreshTokenService refreshTokenService,
                       LoginRateLimiter loginRateLimiter) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.departmentRepository = departmentRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.refreshTokenService = refreshTokenService;
        this.loginRateLimiter = loginRateLimiter;
    }

    @Transactional
    public User register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail().toLowerCase())) {
            throw new IllegalArgumentException("Email already in use");
        }

        // Always resolve and assign the EMPLOYEE role (ignore any role sent in request body)
        Role employeeRole = roleRepository.findByName("EMPLOYEE")
                .orElseGet(() -> roleRepository.save(Role.builder()
                        .name("EMPLOYEE")
                        .description("Standard employee role")
                        .isSystemRole(true)
                        .build()));

        Department department = null;
        if (request.getDepartmentId() != null) {
            department = departmentRepository.findById(request.getDepartmentId()).orElse(null);
        }

        String employeeCode = "EMP-" + (10000 + new Random().nextInt(90000));
        while (userRepository.existsByEmployeeCode(employeeCode)) {
            employeeCode = "EMP-" + (10000 + new Random().nextInt(90000));
        }

        User user = User.builder()
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .email(request.getEmail().toLowerCase().trim())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .employeeCode(employeeCode)
                .jobTitle(request.getJobTitle() != null ? request.getJobTitle() : "Employee")
                .phone(request.getPhone())
                .department(department)
                .status("ACTIVE")
                .roles(new HashSet<>(Collections.singletonList(employeeRole)))
                .build();

        return userRepository.save(user);
    }

    @Transactional
    public AuthResponse login(LoginRequest request, String clientIp) {
        String rateLimitKey = clientIp + ":" + request.getEmail().toLowerCase().trim();

        if (loginRateLimiter.isBlocked(rateLimitKey)) {
            throw new RateLimitExceededException("Too many failed login attempts. Please try again in 15 minutes.");
        }

        Optional<User> userOpt = userRepository.findByEmail(request.getEmail().toLowerCase().trim());

        if (userOpt.isEmpty() || !passwordEncoder.matches(request.getPassword(), userOpt.get().getPasswordHash())) {
            loginRateLimiter.recordFailedAttempt(rateLimitKey);
            throw new BadCredentialsException("Invalid email or password");
        }

        User user = userOpt.get();

        if (!"ACTIVE".equalsIgnoreCase(user.getStatus())) {
            throw new BadCredentialsException("User account is inactive or suspended");
        }

        // Reset rate limiter on successful authentication
        loginRateLimiter.reset(rateLimitKey);

        return buildAuthResponse(user);
    }

    @Transactional
    public AuthResponse refreshToken(RefreshTokenRequest request) {
        var tokenOpt = refreshTokenService.validateRefreshToken(request.getRefreshToken());

        if (tokenOpt.isEmpty()) {
            throw new BadCredentialsException("Invalid or expired refresh token");
        }

        var existingToken = tokenOpt.get();
        User user = existingToken.getUser();

        if (!"ACTIVE".equalsIgnoreCase(user.getStatus())) {
            throw new BadCredentialsException("User account is inactive or suspended");
        }

        // Rotate: revoke old refresh token and generate a new one
        var rotatedPair = refreshTokenService.rotateRefreshToken(existingToken);

        List<String> roles = user.getRoles().stream().map(Role::getName).collect(Collectors.toList());
        List<String> permissions = user.getRoles().stream()
                .flatMap(r -> r.getPermissions().stream())
                .map(Permission::getPermissionCode)
                .distinct()
                .collect(Collectors.toList());

        String newAccessToken = jwtService.generateAccessToken(
                user.getId(),
                user.getEmail(),
                user.getFullName(),
                roles,
                permissions
        );

        return AuthResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(rotatedPair.getRawRefreshToken())
                .tokenType("Bearer")
                .expiresIn(accessTokenExpirationMs / 1000)
                .userId(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .roles(roles)
                .build();
    }

    @Transactional
    public void logout(RefreshTokenRequest request) {
        if (request != null && request.getRefreshToken() != null && !request.getRefreshToken().isBlank()) {
            refreshTokenService.revokeToken(request.getRefreshToken());
        }
    }

    private AuthResponse buildAuthResponse(User user) {
        List<String> roles = user.getRoles().stream().map(Role::getName).collect(Collectors.toList());
        List<String> permissions = user.getRoles().stream()
                .flatMap(r -> r.getPermissions().stream())
                .map(Permission::getPermissionCode)
                .distinct()
                .collect(Collectors.toList());

        String accessToken = jwtService.generateAccessToken(
                user.getId(),
                user.getEmail(),
                user.getFullName(),
                roles,
                permissions
        );

        var tokenPair = refreshTokenService.createRefreshToken(user);

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(tokenPair.getRawRefreshToken())
                .tokenType("Bearer")
                .expiresIn(accessTokenExpirationMs / 1000)
                .userId(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .roles(roles)
                .build();
    }
}
