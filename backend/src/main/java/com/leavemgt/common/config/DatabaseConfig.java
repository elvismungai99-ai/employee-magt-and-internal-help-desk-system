package com.leavemgt.common.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.core.env.Environment;

import javax.sql.DataSource;

@Slf4j
@Configuration
public class DatabaseConfig {

    private final Environment environment;

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

    public DatabaseConfig(Environment environment) {
        this.environment = environment;
    }

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
        boolean hasDbUrl = hasProp("DB_URL");
        boolean hasDatabaseUrl = hasProp("DATABASE_URL");
        boolean hasDatabasePublicUrl = hasProp("DATABASE_PUBLIC_URL");
        boolean hasPgHost = hasProp("PGHOST");

        log.info("Inspecting database environment variables: DB_URL={}, DATABASE_URL={}, DATABASE_PUBLIC_URL={}, PGHOST={}",
                hasDbUrl, hasDatabaseUrl, hasDatabasePublicUrl, hasPgHost);

        // 1. Check direct environment variables in priority order
        String dbUrl = getPropFirst("DB_URL", "DATABASE_URL", "DATABASE_PUBLIC_URL", "SPRING_DATASOURCE_URL");

        if (dbUrl != null && !dbUrl.isBlank() && !dbUrl.contains("localhost")) {
            return parseUrl(dbUrl.trim());
        }

        // 2. Check if discrete Postgres env vars exist (e.g. PGHOST provided by Railway)
        String pgHost = getPropFirst("PGHOST");
        if (pgHost != null && !pgHost.isBlank() && !"localhost".equalsIgnoreCase(pgHost)) {
            String pgPort = getPropOrDefault("PGPORT", "5432");
            String pgDb = getPropOrDefault("PGDATABASE", "railway");
            String pgUser = getPropOrDefault("PGUSER", configuredUsername);
            String pgPass = getPropOrDefault("PGPASSWORD", configuredPassword);

            String constructedUrl = "jdbc:postgresql://" + pgHost + ":" + pgPort + "/" + pgDb + "?currentSchema=identity,leave,public";
            return new ResolvedDbParams(constructedUrl, pgUser, pgPass);
        }

        // 3. If DB_URL was set but contains localhost in local dev mode
        if (dbUrl != null && !dbUrl.isBlank()) {
            return parseUrl(dbUrl.trim());
        }

        // 4. Check application.yml configuredUrl if non-localhost
        if (configuredUrl != null && !configuredUrl.isBlank() && !configuredUrl.contains("localhost")) {
            return parseUrl(configuredUrl.trim());
        }

        // 5. Check if running in cloud (Railway, Render, container)
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
                    "  2. Click on your backend service -> Select 'Variables' tab.\n" +
                    "  3. Make sure you click the purple 'Deploy' button at the top-left to apply staged variables!\n" +
                    "  4. Ensure DATABASE_URL is added: ${{Postgres.DATABASE_URL}} (or the Postgres connection string).\n" +
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
            int schemeEnd = rawUrl.indexOf("://");
            String afterScheme = rawUrl.substring(schemeEnd + 3);
            int atIndex = afterScheme.lastIndexOf('@');

            if (atIndex != -1) {
                String userPass = afterScheme.substring(0, atIndex);
                int colonIndex = userPass.indexOf(':');
                if (colonIndex != -1) {
                    username = userPass.substring(0, colonIndex);
                    password = userPass.substring(colonIndex + 1);
                } else {
                    username = userPass;
                }

                String hostAndPath = afterScheme.substring(atIndex + 1);
                String jdbcUrl = "jdbc:postgresql://" + hostAndPath;
                if (!jdbcUrl.contains("currentSchema")) {
                    jdbcUrl += (jdbcUrl.contains("?") ? "&" : "?") + "currentSchema=identity,leave,public";
                }
                return new ResolvedDbParams(jdbcUrl, username, password);
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

        // Override username and password if PGUSER/PGPASSWORD or DB_USERNAME/DB_PASSWORD are set
        String envUser = getPropFirst("PGUSER", "DB_USERNAME");
        if (envUser != null && !envUser.isBlank()) {
            username = envUser;
        }

        String envPass = getPropFirst("PGPASSWORD", "DB_PASSWORD");
        if (envPass != null && !envPass.isBlank()) {
            password = envPass;
        }

        return new ResolvedDbParams(finalUrl, username, password);
    }

    private boolean isCloudEnvironment() {
        return environment.getProperty("RAILWAY_ENVIRONMENT") != null
                || environment.getProperty("RAILWAY_PROJECT_ID") != null
                || environment.getProperty("RENDER") != null
                || (environment.getProperty("PORT") != null && !"8080".equals(environment.getProperty("PORT")));
    }

    private boolean hasProp(String key) {
        String val = environment.getProperty(key);
        return val != null && !val.isBlank();
    }

    private String getPropFirst(String... keys) {
        for (String k : keys) {
            String val = environment.getProperty(k);
            if (val != null && !val.isBlank()) {
                return val.trim();
            }
        }
        return null;
    }

    private String getPropOrDefault(String key, String defaultVal) {
        String val = environment.getProperty(key);
        return (val != null && !val.isBlank()) ? val.trim() : defaultVal;
    }

    private String sanitizeUrl(String url) {
        if (url == null) return "null";
        return url.replaceAll("(?i)(password=)[^&;]*", "$1****")
                .replaceAll("(?i)(//[^:]+:)[^@]+@", "$1****@");
    }
}
