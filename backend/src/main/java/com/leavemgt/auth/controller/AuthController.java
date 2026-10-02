package com.leavemgt.auth.controller;

import com.leavemgt.auth.dto.AuthResponse;
import com.leavemgt.auth.dto.LoginRequest;
import com.leavemgt.auth.dto.RefreshTokenRequest;
import com.leavemgt.auth.dto.RegisterRequest;
import com.leavemgt.auth.service.AuthService;
import com.leavemgt.common.dto.ApiResponse;
import com.leavemgt.identity.entity.User;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    private static final java.util.regex.Pattern IP_PATTERN = java.util.regex.Pattern.compile(
            "^([0-9]{1,3}\\.){3}[0-9]{1,3}$|^([0-9a-fA-F]{0,4}:){1,7}[0-9a-fA-F]{0,4}$"
    );

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<Map<String, Object>>> register(@Valid @RequestBody RegisterRequest request) {
        User registeredUser = authService.register(request);
        java.util.List<String> roleNames = registeredUser.getRoles().stream()
                .map(com.leavemgt.identity.entity.Role::getName)
                .toList();

        String message = "ACTIVE".equalsIgnoreCase(registeredUser.getStatus())
                ? "Registration completed successfully."
                : "Registration submitted successfully. Your account is pending HR verification and will be activated once approved by HR.";

        return ResponseEntity.status(org.springframework.http.HttpStatus.CREATED).body(ApiResponse.success(
                Map.of(
                        "id", registeredUser.getId().toString(),
                        "employeeCode", registeredUser.getEmployeeCode(),
                        "email", registeredUser.getEmail(),
                        "status", registeredUser.getStatus(),
                        "roles", roleNames,
                        "assignedRole", roleNames.isEmpty() ? "EMPLOYEE" : roleNames.get(0)
                ),
                message
        ));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest request,
                                                           HttpServletRequest httpRequest) {
        String clientIp = getClientIp(httpRequest);
        AuthResponse response = authService.login(request, clientIp);
        return ResponseEntity.ok(ApiResponse.success(response, "Login successful"));
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<AuthResponse>> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        AuthResponse response = authService.refreshToken(request);
        return ResponseEntity.ok(ApiResponse.success(response, "Token refreshed successfully"));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(@RequestBody(required = false) RefreshTokenRequest request) {
        if (request != null) {
            authService.logout(request);
        }
        return ResponseEntity.ok(ApiResponse.success(null, "Logged out successfully"));
    }

    private String getClientIp(HttpServletRequest request) {
        String xfHeader = request.getHeader("X-Forwarded-For");
        if (xfHeader != null && !xfHeader.isBlank()) {
            String firstIp = xfHeader.split(",")[0].trim();
            if (firstIp.length() <= 45 && IP_PATTERN.matcher(firstIp).matches()) {
                return firstIp;
            }
        }
        String remoteAddr = request.getRemoteAddr();
        return (remoteAddr != null && !remoteAddr.isBlank() && remoteAddr.length() <= 45) ? remoteAddr : "unknown";
    }
}
