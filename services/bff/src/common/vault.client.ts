import { getLogger } from "./logger";
import axios, { AxiosInstance } from "axios";

const logger = getLogger("VaultClient");

interface VaultConfig {
  addr: string;
  enabled: boolean;
  roleId?: string;
  secretId?: string;
  token?: string;
}

interface VaultSecretData {
  [key: string]: string;
}

interface VaultKVResponse {
  data: {
    data: VaultSecretData;
    metadata: {
      created_time: string;
      version: number;
    };
  };
}

export class VaultClient {
  private config: VaultConfig;
  private client: AxiosInstance;
  private token: string | null = null;
  private tokenExpiry: Date | null = null;
  private secretCache: Map<string, { data: VaultSecretData; expiry: Date }> =
    new Map();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.config = {
      addr: process.env.VAULT_ADDR || "http://localhost:18200",
      enabled: process.env.VAULT_ENABLED === "true",
      roleId: process.env.VAULT_APPROLE_ROLE_ID,
      secretId: process.env.VAULT_APPROLE_SECRET_ID,
      token: process.env.VAULT_TOKEN,
    };

    this.client = axios.create({
      baseURL: this.config.addr,
      timeout: 5000,
    });

    if (this.config.enabled) {
      logger.info("Vault client initialized", { addr: this.config.addr });
    } else {
      logger.info("Vault disabled, using environment variables for secrets");
    }
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  private async authenticate(): Promise<void> {
    if (this.token && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return;
    }

    // Try direct token first
    if (this.config.token) {
      this.token = this.config.token;
      this.tokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      return;
    }

    // Use AppRole authentication
    if (!this.config.roleId || !this.config.secretId) {
      throw new Error("Vault AppRole credentials not configured");
    }

    try {
      const response = await this.client.post("/v1/auth/approle/login", {
        role_id: this.config.roleId,
        secret_id: this.config.secretId,
      });

      this.token = response.data.auth.client_token;
      const ttl = response.data.auth.lease_duration || 3600;
      this.tokenExpiry = new Date(Date.now() + (ttl - 60) * 1000); // Refresh 1 min early

      logger.debug("Vault authentication successful");
    } catch (error: any) {
      logger.error("Vault authentication failed", { error: error.message });
      throw new Error(`Vault authentication failed: ${error.message}`);
    }
  }

  async getSecret(path: string): Promise<VaultSecretData> {
    if (!this.config.enabled) {
      throw new Error("Vault is not enabled");
    }

    // Check cache
    const cached = this.secretCache.get(path);
    if (cached && new Date() < cached.expiry) {
      return cached.data;
    }

    await this.authenticate();

    try {
      const response = await this.client.get<VaultKVResponse>(
        `/v1/secret/data/${path}`,
        {
          headers: { "X-Vault-Token": this.token },
        },
      );

      const data = response.data.data.data;

      // Cache the secret
      this.secretCache.set(path, {
        data,
        expiry: new Date(Date.now() + this.cacheTTL),
      });

      logger.debug("Secret retrieved from Vault", { path });
      return data;
    } catch (error: any) {
      logger.error("Failed to get secret from Vault", {
        path,
        error: error.message,
      });
      throw new Error(`Failed to get secret from Vault: ${error.message}`);
    }
  }

  async getDatabaseSecrets(): Promise<{
    host: string;
    port: string;
    user: string;
    password: string;
    database: string;
  }> {
    if (!this.config.enabled) {
      return {
        host: process.env.POSTGRES_HOST || "localhost",
        port: process.env.POSTGRES_PORT || "15432",
        user: process.env.POSTGRES_USER || "chainrisk",
        password: process.env.POSTGRES_PASSWORD || "chainrisk123",
        database: process.env.POSTGRES_DB || "chainrisk",
      };
    }

    const secrets = await this.getSecret("chainrisk/database/postgres");
    return {
      host: secrets.host,
      port: secrets.port,
      user: secrets.user,
      password: secrets.password,
      database: secrets.database,
    };
  }

  async getJWTSecrets(): Promise<{
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  }> {
    if (!this.config.enabled) {
      return {
        secret: process.env.JWT_SECRET || "default-secret-change-me",
        expiresIn: process.env.JWT_EXPIRES_IN || "1h",
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
      };
    }

    const secrets = await this.getSecret("chainrisk/jwt/config");
    return {
      secret: secrets.secret,
      expiresIn: secrets.expires_in,
      refreshExpiresIn: secrets.refresh_expires_in,
    };
  }

  async getRedisSecrets(): Promise<{
    host: string;
    port: string;
    password: string;
  }> {
    if (!this.config.enabled) {
      return {
        host: process.env.REDIS_HOST || "localhost",
        port: process.env.REDIS_PORT || "16379",
        password: process.env.REDIS_PASSWORD || "",
      };
    }

    const secrets = await this.getSecret("chainrisk/database/redis");
    return {
      host: secrets.host,
      port: secrets.port,
      password: secrets.password || "",
    };
  }

  async getAPIKey(service: string): Promise<string> {
    if (!this.config.enabled) {
      const envKey = `${service.toUpperCase()}_API_KEY`;
      return process.env[envKey] || "";
    }

    const secrets = await this.getSecret(`chainrisk/api/${service}`);
    return secrets.key;
  }

  clearCache(): void {
    this.secretCache.clear();
    logger.debug("Secret cache cleared");
  }
}

// Singleton instance
let vaultClient: VaultClient | null = null;

export function getVaultClient(): VaultClient {
  if (!vaultClient) {
    vaultClient = new VaultClient();
  }
  return vaultClient;
}

export function resetVaultClient(): void {
  vaultClient = null;
}
