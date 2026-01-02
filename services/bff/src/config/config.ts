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
}

export interface JwtConfig {
  secret: string;
  expiresIn: string;
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

export interface AppConfig {
  server: ServerConfig;
  services: ServicesConfig;
  jwt: JwtConfig;
  rateLimit: RateLimitConfig;
  cors: CorsConfig;
  logging: LoggingConfig;
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
    },
    jwt: {
      secret: yamlConfig.jwt?.secret || "default-secret-change-me",
      expiresIn: yamlConfig.jwt?.expiresIn || "1d",
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

  // JWT
  if (process.env.JWT_SECRET) {
    config.jwt.secret = process.env.JWT_SECRET;
  }
  if (process.env.JWT_EXPIRES_IN) {
    config.jwt.expiresIn = process.env.JWT_EXPIRES_IN;
  }

  // Logging
  if (process.env.LOG_LEVEL) {
    config.logging.level = process.env.LOG_LEVEL;
  }
}

export function getConfig(): AppConfig {
  return loadConfig();
}
