package com.leavemgt.common.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, authException) -> {
                    response.setContentType("application/json");
                    response.setStatus(jakarta.servlet.http.HttpServletResponse.SC_UNAUTHORIZED);
                    response.getWriter().write("{\"success\":false,\"message\":\"Unauthorized: Missing or invalid token\"}");
                })
            )
            .authorizeHttpRequests(auth -> auth
                // Public authentication endpoints
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/error").permitAll()
                .requestMatchers("/actuator/**").permitAll()
                // HR Admin only: Admin-created accounts & hierarchy assignment
                .requestMatchers(HttpMethod.POST, "/api/identity/users").hasAnyAuthority("ROLE_HR_ADMIN", "HR_ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/identity/hierarchy/assign").hasAnyAuthority("ROLE_HR_ADMIN", "HR_ADMIN")
                .requestMatchers("/api/identity/hierarchy/*/subordinates").hasAnyAuthority("ROLE_HR_ADMIN", "HR_ADMIN")
                // HR Admin only: Leave catalog & policy administration, balance adjustments
                .requestMatchers(HttpMethod.POST, "/api/leave/types").hasAnyAuthority("ROLE_HR_ADMIN", "HR_ADMIN")
                .requestMatchers(HttpMethod.PATCH, "/api/leave/types/**").hasAnyAuthority("ROLE_HR_ADMIN", "HR_ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/leave/policies").hasAnyAuthority("ROLE_HR_ADMIN", "HR_ADMIN")
                .requestMatchers("/api/leave/balances/user/**").hasAnyAuthority("ROLE_HR_ADMIN", "HR_ADMIN")
                .requestMatchers("/api/leave/balances/*/adjust").hasAnyAuthority("ROLE_HR_ADMIN", "HR_ADMIN")
                // HR Admin only: Helpdesk taxonomy administration
                .requestMatchers(HttpMethod.POST, "/api/helpdesk/categories/**", "/api/helpdesk/queues/**", "/api/helpdesk/sla-policies/**").hasAnyAuthority("ROLE_HR_ADMIN", "HR_ADMIN")
                .requestMatchers(HttpMethod.PATCH, "/api/helpdesk/categories/**", "/api/helpdesk/queues/**", "/api/helpdesk/sla-policies/**").hasAnyAuthority("ROLE_HR_ADMIN", "HR_ADMIN")
                .requestMatchers(HttpMethod.DELETE, "/api/helpdesk/categories/**", "/api/helpdesk/queues/**", "/api/helpdesk/sla-policies/**").hasAnyAuthority("ROLE_HR_ADMIN", "HR_ADMIN")
                // All other requests require authentication
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000"
        ));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Requested-With", "Accept"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
