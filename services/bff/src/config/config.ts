import { readFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import * as yaml from "js-yaml";

export interface ServerConfig {
  name: string;
  port: number;
  env: string;
}

export interface ServiceEndpoint {
  url: string;
  timeout: number;
}

export interface ServicesConfig {
  query: ServiceEndpoint;
  risk: ServiceEndpoint;
  graph: ServiceEndpoint;
  alert: ServiceEndpoint;
}

export interface JwtConfig {
  secret: string;
  expiresIn: string;
  refreshExpiresIn: string;
}

export interface RateLimitConfig {
  ttl: number;
  limit: number;
}

export interface CorsConfig {
  origins: string[];
  credentials: boolean;
}

export interface LoggingConfig {
  level: string;
  format: string;
  outputPaths: string[];
}

export interface VaultConfig {
  enabled: boolean;
  addr: string;
}

export interface KafkaConfig {
  brokers: string[];
  groupId: string;
  alertTopics: string[];
}

export interface AppConfig {
  server: ServerConfig;
  services: ServicesConfig;
  jwt: JwtConfig;
  rateLimit: RateLimitConfig;
  cors: CorsConfig;
  logging: LoggingConfig;
  vault: VaultConfig;
  kafka: KafkaConfig;
}

let cachedConfig: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  // Try to find config file
  const configPaths = [
    join(__dirname, "..", "..", "configs", "config.yaml"),
    join(__dirname, "..", "configs", "config.yaml"),
    join(process.cwd(), "configs", "config.yaml"),
  ];

  let yamlConfig: Record<string, any> = {};
  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      const fileContent = readFileSync(configPath, "utf8");
      yamlConfig = yaml.load(fileContent) as Record<string, any>;
      break;
    }
  }

  // Build config with defaults and YAML values
  const config: AppConfig = {
    server: {
      name: yamlConfig.server?.name || "bff-gateway",
      port: yamlConfig.server?.port || 3000,
      env: yamlConfig.server?.env || "development",
    },
    services: {
      query: {
        url: yamlConfig.services?.query?.url || "http://localhost:8081",
        timeout: yamlConfig.services?.query?.timeout || 10000,
      },
      risk: {
        url: yamlConfig.services?.risk?.url || "http://localhost:8082",
        timeout: yamlConfig.services?.risk?.timeout || 10000,
      },
      graph: {
        url: yamlConfig.services?.graph?.url || "http://localhost:8084",
        timeout: yamlConfig.services?.graph?.timeout || 15000,
      },
      alert: {
        url: yamlConfig.services?.alert?.url || "http://localhost:8083",
        timeout: yamlConfig.services?.alert?.timeout || 10000,
      },
    },
    jwt: {
      secret: yamlConfig.jwt?.secret || "default-secret-change-me",
      expiresIn: yamlConfig.jwt?.expiresIn || "1h",
      refreshExpiresIn: yamlConfig.jwt?.refreshExpiresIn || "7d",
    },
    rateLimit: {
      ttl: yamlConfig.rateLimit?.ttl || 60000,
      limit: yamlConfig.rateLimit?.limit || 100,
    },
    cors: {
      origins: yamlConfig.cors?.origins || ["http://localhost:5173"],
      credentials: yamlConfig.cors?.credentials ?? true,
    },
    logging: {
      level: yamlConfig.logging?.level || "info",
      format: yamlConfig.logging?.format || "console",
      outputPaths: yamlConfig.logging?.outputPaths || ["stdout"],
    },
    vault: {
      enabled: process.env.VAULT_ENABLED === "true",
      addr: process.env.VAULT_ADDR || "http://localhost:18200",
    },
    kafka: {
      brokers: yamlConfig.kafka?.brokers || ["localhost:19092"],
      groupId: yamlConfig.kafka?.groupId || "bff-alert-push-group",
      alertTopics: yamlConfig.kafka?.alertTopics || ["alerts", "alert-notifications"],
    },
  };

  // Override with environment variables
  overrideFromEnv(config);

  // Ensure log directory exists
  for (const outputPath of config.logging.outputPaths) {
    if (outputPath !== "stdout" && outputPath !== "stderr") {
      const dir = dirname(outputPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }

  cachedConfig = config;
  return config;
}

function overrideFromEnv(config: AppConfig): void {
  // Server
  if (process.env.PORT) {
    config.server.port = parseInt(process.env.PORT, 10);
  }
  if (process.env.NODE_ENV) {
    config.server.env = process.env.NODE_ENV;
  }

  // Services
  if (process.env.QUERY_SERVICE_URL) {
    config.services.query.url = process.env.QUERY_SERVICE_URL;
  }
  if (process.env.RISK_SERVICE_URL) {
    config.services.risk.url = process.env.RISK_SERVICE_URL;
  }
  if (process.env.GRAPH_SERVICE_URL) {
    config.services.graph.url = process.env.GRAPH_SERVICE_URL;
  }
  if (process.env.ALERT_SERVICE_URL) {
    config.services.alert.url = process.env.ALERT_SERVICE_URL;
  }

  // JWT (fallback from env if Vault not enabled)
  if (process.env.JWT_SECRET) {
    config.jwt.secret = process.env.JWT_SECRET;
  }
  if (process.env.JWT_EXPIRES_IN) {
    config.jwt.expiresIn = process.env.JWT_EXPIRES_IN;
  }
  if (process.env.JWT_REFRESH_EXPIRES_IN) {
    config.jwt.refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN;
  }

  // Logging
  if (process.env.LOG_LEVEL) {
    config.logging.level = process.env.LOG_LEVEL;
  }

  // Kafka
  if (process.env.KAFKA_BROKERS) {
    config.kafka.brokers = process.env.KAFKA_BROKERS.split(",");
  }
  if (process.env.KAFKA_GROUP_ID) {
    config.kafka.groupId = process.env.KAFKA_GROUP_ID;
  }
}

/**
 * Load JWT config from Vault if enabled, otherwise use static config.
 * This is async because Vault calls are async.
 */
export async function loadJwtConfig(): Promise<JwtConfig> {
  // Lazy import to avoid circular dependency
  const { getVaultClient } = await import("../common/vault.client");
  const { getLogger } = await import("../common/logger");
  const logger = getLogger("Config");

  const vault = getVaultClient();

  if (vault.isEnabled()) {
    try {
      const secrets = await vault.getJWTSecrets();
      logger.info("JWT secrets loaded from Vault");
      return {
        secret: secrets.secret,
        expiresIn: secrets.expiresIn,
        refreshExpiresIn: secrets.refreshExpiresIn,
      };
    } catch (error) {
      logger.warn("Failed to load JWT secrets from Vault, using fallback", {
        error,
      });
    }
  }

  // Fallback to static config
  const config = getConfig();
  return config.jwt;
}

export function getConfig(): AppConfig {
  return loadConfig();
}

export function resetConfig(): void {
  cachedConfig = null;
}
