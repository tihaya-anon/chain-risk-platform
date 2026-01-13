/**
 * TLS Configuration for BFF Service
 *
 * BFF is an edge service, so it uses TLS for external clients
 * but does NOT require mTLS (client certificates) from browsers.
 */
import * as fs from "fs";
import * as https from "https";
import { Logger } from "@nestjs/common";

export interface TLSConfig {
  enabled: boolean;
  certPath: string;
  keyPath: string;
  caPath: string;
  /** BFF doesn't require mTLS for browser clients */
  requestCert: boolean;
  minVersion: string;
}

const logger = new Logger("TLS");

/**
 * Load TLS configuration from environment variables
 */
export function loadTLSConfig(): TLSConfig {
  return {
    enabled: process.env.TLS_ENABLED === "true",
    certPath: process.env.TLS_CERT_PATH || "/certs/cert.pem",
    keyPath: process.env.TLS_KEY_PATH || "/certs/key.pem",
    caPath: process.env.TLS_CA_PATH || "/certs/ca.pem",
    requestCert: process.env.TLS_REQUEST_CERT === "true", // false for BFF
    minVersion: process.env.TLS_MIN_VERSION || "TLSv1.2",
  };
}

/**
 * NestJS HttpsOptions type for HTTPS server
 */
export interface NestHttpsOptions {
  key: Buffer;
  cert: Buffer;
  ca?: Buffer;
  requestCert?: boolean;
  rejectUnauthorized?: boolean;
}

/**
 * Create HTTPS options for NestJS server
 */
export function createHttpsOptions(config: TLSConfig): NestHttpsOptions | null {
  if (!config.enabled) {
    logger.log("TLS is disabled");
    return null;
  }

  // Validate certificate files exist
  const files = [
    { path: config.certPath, name: "certificate" },
    { path: config.keyPath, name: "private key" },
  ];

  for (const file of files) {
    if (!fs.existsSync(file.path)) {
      throw new Error(`TLS ${file.name} not found: ${file.path}`);
    }
  }

  const options: NestHttpsOptions = {
    key: fs.readFileSync(config.keyPath),
    cert: fs.readFileSync(config.certPath),
    // BFF is edge service - no client cert required from browsers
    requestCert: config.requestCert,
    rejectUnauthorized: false,
  };

  // Load CA for internal service calls (mTLS as client)
  if (fs.existsSync(config.caPath)) {
    options.ca = fs.readFileSync(config.caPath);
    logger.log(`Loaded CA certificate: ${config.caPath}`);
  }

  logger.log(`TLS enabled with cert: ${config.certPath}`);
  logger.log(`TLS min version: ${config.minVersion}`);
  logger.log(`Client certificate required: ${config.requestCert}`);

  return options;
}

/**
 * Create Axios HTTPS agent for mTLS client connections
 * Used when BFF calls internal services that require mTLS
 */
export function createMTLSAgent(config: TLSConfig): https.Agent | null {
  if (!config.enabled) {
    return null;
  }

  const files = [
    { path: config.certPath, name: "certificate" },
    { path: config.keyPath, name: "private key" },
    { path: config.caPath, name: "CA certificate" },
  ];

  for (const file of files) {
    if (!fs.existsSync(file.path)) {
      logger.warn(`mTLS agent: ${file.name} not found: ${file.path}`);
      return null;
    }
  }

  return new https.Agent({
    cert: fs.readFileSync(config.certPath),
    key: fs.readFileSync(config.keyPath),
    ca: fs.readFileSync(config.caPath),
    rejectUnauthorized: true,
  });
}
