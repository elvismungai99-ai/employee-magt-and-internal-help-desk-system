package com.leavemgt.common.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;
import java.net.URI;

@Slf4j
@Configuration
public class DatabaseConfig {

    @Value("${spring.datasource.url:}")
    private String configuredUrl;

    @Value("${spring.datasource.username:postgres}")
    private String configuredUsername;

    @Value("${spring.datasource.password:}")
    private String configuredPassword;

    @Value("${spring.datasource.hikari.maximum-pool-size:5}")
    private int maxPoolSize;

    @Value("${spring.datasource.hikari.minimum-idle:1}")
    private int minIdle;

    @Value("${spring.datasource.hikari.idle-timeout:300000}")
    private long idleTimeout;

    @Value("${spring.datasource.hikari.max-lifetime:900000}")
    private long maxLifetime;

    @Value("${spring.datasource.hikari.connection-timeout:20000}")
    private long connectionTimeout;

    public static class ResolvedDbParams {
        public final String jdbcUrl;
        public final String username;
        public final String password;

        public ResolvedDbParams(String jdbcUrl, String username, String password) {
            this.jdbcUrl = jdbcUrl;
            this.username = username;
            this.password = password;
        }
    }

    @Bean
    @Primary
    public DataSource dataSource() {
        ResolvedDbParams params = resolveDbParams();
        log.info("Configuring primary HikariDataSource with JDBC URL: {}", sanitizeUrl(params.jdbcUrl));

        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(params.jdbcUrl);
        config.setUsername(params.username);
        config.setPassword(params.password);
        config.setDriverClassName("org.postgresql.Driver");
        config.setMaximumPoolSize(maxPoolSize);
        config.setMinimumIdle(minIdle);
        config.setIdleTimeout(idleTimeout);
        config.setMaxLifetime(maxLifetime);
        config.setConnectionTimeout(connectionTimeout);

        return new HikariDataSource(config);
    }

    public ResolvedDbParams resolveDbParams() {
        // 1. Check direct environment variables in priority order
        String dbUrl = getEnvFirst("DB_URL", "DATABASE_URL", "DATABASE_PUBLIC_URL", "SPRING_DATASOURCE_URL");

        if (dbUrl != null && !dbUrl.isBlank()) {
            return parseUrl(dbUrl.trim());
        }

        // 2. Check if discrete Postgres env vars exist (e.g. PGHOST provided by Railway)
        String pgHost = getEnvFirst("PGHOST");
        if (pgHost != null && !pgHost.isBlank() && !"localhost".equalsIgnoreCase(pgHost)) {
            String pgPort = getEnvOrDefault("PGPORT", "5432");
            String pgDb = getEnvOrDefault("PGDATABASE", "railway");
            String pgUser = getEnvOrDefault("PGUSER", configuredUsername);
            String pgPass = getEnvOrDefault("PGPASSWORD", configuredPassword);

            String constructedUrl = "jdbc:postgresql://" + pgHost + ":" + pgPort + "/" + pgDb + "?currentSchema=identity,leave,public";
            return new ResolvedDbParams(constructedUrl, pgUser, pgPass);
        }

        // 3. Check application.yml configuredUrl
        if (configuredUrl != null && !configuredUrl.isBlank()) {
            return parseUrl(configuredUrl.trim());
        }

        // 4. Fallback check for cloud deployment vs local development
        boolean isCloud = isCloudEnvironment();
        if (isCloud) {
            String errorMsg = "\n" +
                    "****************************************************************************************\n" +
                    "  CRITICAL CONFIGURATION ERROR: MISSING DATABASE CREDENTIALS IN RAILWAY / CLOUD!\n" +
                    "  The backend cannot find 'DATABASE_URL' or 'DB_URL' in the service environment variables.\n" +
                    "  Attempting to connect to 'localhost:5432' fails because Postgres runs in a separate service.\n" +
                    "\n" +
                    "  ACTION REQUIRED IN RAILWAY DASHBOARD:\n" +
                    "  1. Go to your Railway Project.\n" +
                    "  2. Click on this backend service tile -> Select 'Variables' tab.\n" +
                    "  3. Add variable:\n" +
                    "     Name:  DATABASE_URL\n" +
                    "     Value: ${{Postgres.DATABASE_URL}}  (or copy the Postgres connection string)\n" +
                    "  4. Redeploy.\n" +
                    "****************************************************************************************\n";
            log.error(errorMsg);
            throw new IllegalStateException("Missing database connection URL. Please set DATABASE_URL or DB_URL in Railway environment variables.");
        }

        // Local development fallback
        String localUrl = "jdbc:postgresql://localhost:5432/leave_mgt_db?currentSchema=identity,leave,public";
        return new ResolvedDbParams(localUrl, configuredUsername, configuredPassword);
    }

    private ResolvedDbParams parseUrl(String rawUrl) {
        String username = configuredUsername;
        String password = configuredPassword;

        // If it starts with standard postgres:// or postgresql:// (Railway/Heroku/Render standard)
        if (rawUrl.startsWith("postgres://") || rawUrl.startsWith("postgresql://")) {
            try {
                String uriString = rawUrl.startsWith("postgres://")
                        ? "http://" + rawUrl.substring("postgres://".length())
                        : "http://" + rawUrl.substring("postgresql://".length());

                URI uri = URI.create(uriString);
                String userInfo = uri.getUserInfo();
                if (userInfo != null && !userInfo.isBlank()) {
                    String[] parts = userInfo.split(":", 2);
                    username = parts[0];
                    if (parts.length > 1) {
                        password = parts[1];
                    }
                }

                String host = uri.getHost();
                int port = uri.getPort() > 0 ? uri.getPort() : 5432;
                String path = uri.getPath() != null && !uri.getPath().isBlank() ? uri.getPath() : "/railway";
                String query = uri.getQuery();

                StringBuilder jdbcUrl = new StringBuilder("jdbc:postgresql://")
                        .append(host)
                        .append(":")
                        .append(port)
                        .append(path);

                if (query != null && !query.isBlank()) {
                    jdbcUrl.append("?").append(query);
                    if (!query.contains("currentSchema")) {
                        jdbcUrl.append("&currentSchema=identity,leave,public");
                    }
                } else {
                    jdbcUrl.append("?currentSchema=identity,leave,public");
                }

                return new ResolvedDbParams(jdbcUrl.toString(), username, password);
            } catch (Exception e) {
                log.warn("Could not parse URI from {}: {}", rawUrl, e.getMessage());
            }
        }

        // If it starts with jdbc:
        String finalUrl = rawUrl;
        if (!finalUrl.startsWith("jdbc:")) {
            finalUrl = "jdbc:" + finalUrl;
        }

        if (!finalUrl.contains("currentSchema")) {
            finalUrl += (finalUrl.contains("?") ? "&" : "?") + "currentSchema=identity,leave,public";
        }

        // Override username and password if PGUSER/PGPASSWORD are set in environment
        String envUser = getEnvFirst("PGUSER", "DB_USERNAME");
        if (envUser != null && !envUser.isBlank()) {
            username = envUser;
        }

        String envPass = getEnvFirst("PGPASSWORD", "DB_PASSWORD");
        if (envPass != null && !envPass.isBlank()) {
            password = envPass;
        }

        return new ResolvedDbParams(finalUrl, username, password);
    }

    private boolean isCloudEnvironment() {
        return System.getenv("RAILWAY_ENVIRONMENT") != null
                || System.getenv("RAILWAY_PROJECT_ID") != null
                || System.getenv("RENDER") != null
                || (System.getenv("PORT") != null && !"8080".equals(System.getenv("PORT")));
    }

    private String getEnvFirst(String... keys) {
        for (String k : keys) {
            String val = System.getenv(k);
            if (val != null && !val.isBlank()) {
                return val.trim();
            }
        }
        return null;
    }

    private String getEnvOrDefault(String key, String defaultVal) {
        String val = System.getenv(key);
        return (val != null && !val.isBlank()) ? val.trim() : defaultVal;
    }

    private String sanitizeUrl(String url) {
        if (url == null) return "null";
        return url.replaceAll("(?i)(password=)[^&;]*", "$1****")
                .replaceAll("(?i)(//[^:]+:)[^@]+@", "$1****@");
    }
}
