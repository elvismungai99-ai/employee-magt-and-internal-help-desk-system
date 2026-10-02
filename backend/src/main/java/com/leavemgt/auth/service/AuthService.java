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
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class AuthService {

    private static final Set<String> ALLOWED_REGISTRATION_ROLES = Set.of(
            "EMPLOYEE", "LINE_MANAGER", "SUPPORT_AGENT"
    );

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final DepartmentRepository departmentRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokenService;
    private final LoginRateLimiter loginRateLimiter;
    private final com.leavemgt.leave.service.LeaveBalanceService leaveBalanceService;

    @Value("${jwt.access-token-expiration-ms:900000}")
    private long accessTokenExpirationMs;

    @Value("${app.auth.require-registration-approval:true}")
    private boolean requireRegistrationApproval;

    public AuthService(UserRepository userRepository,
                       RoleRepository roleRepository,
                       DepartmentRepository departmentRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       RefreshTokenService refreshTokenService,
                       LoginRateLimiter loginRateLimiter,
                       com.leavemgt.leave.service.LeaveBalanceService leaveBalanceService) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.departmentRepository = departmentRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.refreshTokenService = refreshTokenService;
        this.loginRateLimiter = loginRateLimiter;
        this.leaveBalanceService = leaveBalanceService;
    }

    @Transactional
    public User register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail().toLowerCase())) {
            throw new IllegalArgumentException("Email already in use");
        }

        // Collect requested role(s)
        Set<String> requestedRoleNames = new LinkedHashSet<>();
        if (request.getRoles() != null && !request.getRoles().isEmpty()) {
            requestedRoleNames.addAll(request.getRoles());
        }
        if (request.getRole() != null && !request.getRole().isBlank()) {
            for (String r : request.getRole().split(",")) {
                if (!r.isBlank()) {
                    requestedRoleNames.add(r.trim());
                }
            }
        }

        // Strict role privilege escalation prevention:
        // Anonymous self-registration must NEVER grant administrative privileges (HR_ADMIN, ADMIN).
        Set<String> sanitizedRoleNames = new LinkedHashSet<>();
        for (String rName : requestedRoleNames) {
            String cleanName = rName.toUpperCase().replace("ROLE_", "").trim();
            if ("HR_ADMIN".equals(cleanName) || "ADMIN".equals(cleanName) || "SUPERADMIN".equals(cleanName)) {
                log.warn("SECURITY ALERT: Blocked privilege escalation attempt during registration for email {}. Forbidden role: {}",
                        request.getEmail(), cleanName);
                continue;
            }
            if (ALLOWED_REGISTRATION_ROLES.contains(cleanName)) {
                sanitizedRoleNames.add(cleanName);
            } else {
                log.warn("Ignored unauthorized or unknown registration role '{}' for email {}", cleanName, request.getEmail());
            }
        }

        // Default to EMPLOYEE role if no permitted role was provided
        if (sanitizedRoleNames.isEmpty()) {
            sanitizedRoleNames.add("EMPLOYEE");
        }

        Set<Role> assignedRoles = new HashSet<>();
        for (String rName : sanitizedRoleNames) {
            Role resolvedRole = roleRepository.findByName(rName)
                    .orElseGet(() -> roleRepository.save(Role.builder()
                            .name(rName)
                            .description(rName + " role")
                            .isSystemRole(true)
                            .build()));
            assignedRoles.add(resolvedRole);
        }

        Department department = null;
        if (request.getDepartmentId() != null) {
            department = departmentRepository.findById(request.getDepartmentId()).orElse(null);
        }

        String employeeCode = "EMP-" + (10000 + new Random().nextInt(90000));
        while (userRepository.existsByEmployeeCode(employeeCode)) {
            employeeCode = "EMP-" + (10000 + new Random().nextInt(90000));
        }

        String initialStatus = requireRegistrationApproval ? "PENDING_APPROVAL" : "ACTIVE";

        User user = User.builder()
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .email(request.getEmail().toLowerCase().trim())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .employeeCode(employeeCode)
                .jobTitle(request.getJobTitle() != null ? request.getJobTitle() : "Employee")
                .phone(request.getPhone())
                .department(department)
                .status(initialStatus)
                .roles(assignedRoles)
                .build();

        User savedUser = userRepository.save(user);

        // If registered directly as ACTIVE, initialize current-year leave balances
        if ("ACTIVE".equalsIgnoreCase(initialStatus)) {
            try {
                leaveBalanceService.initializeBalancesForUser(savedUser, java.time.Year.now().getValue());
            } catch (Exception e) {
                log.warn("Could not auto-initialize leave balances for active user {}: {}", savedUser.getEmail(), e.getMessage());
            }
        }

        return savedUser;
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
            if ("PENDING_APPROVAL".equalsIgnoreCase(user.getStatus())) {
                throw new BadCredentialsException("Your account registration is pending HR approval. Please wait for an HR administrator to verify and activate your account.");
            }
            if ("REJECTED".equalsIgnoreCase(user.getStatus())) {
                throw new BadCredentialsException("Your registration request was not approved. Please contact HR for assistance.");
            }
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
