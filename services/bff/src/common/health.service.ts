import { Injectable, Logger } from "@nestjs/common";
import axios from "axios";

export interface HealthCheckResult {
  name: string;
  status: "up" | "down";
  error?: string;
}

export interface HealthResponse {
  status: "up" | "down";
  checks: Record<string, HealthCheckResult>;
  details: Record<string, unknown>;
}

interface HealthCheck {
  name: string;
  check: () => Promise<void>;
  timeout: number;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private checks: HealthCheck[] = [];
  private details: Record<string, unknown> = {};
  private ready = false;

  addCheck(name: string, check: () => Promise<void>, timeout = 5000): void {
    this.checks.push({ name, check, timeout });
  }

  setDetail(key: string, value: unknown): void {
    this.details[key] = value;
  }

  setReady(ready: boolean): void {
    this.ready = ready;
  }

  isReady(): boolean {
    return this.ready;
  }

  async runChecks(): Promise<HealthResponse> {
    const results: Record<string, HealthCheckResult> = {};
    let overallStatus: "up" | "down" = "up";

    await Promise.all(
      this.checks.map(async (check) => {
        try {
          await Promise.race([
            check.check(),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error(`Timeout after ${check.timeout}ms`)),
                check.timeout,
              ),
            ),
          ]);
          results[check.name] = { name: check.name, status: "up" };
        } catch (error) {
          results[check.name] = {
            name: check.name,
            status: "down",
            error: error instanceof Error ? error.message : String(error),
          };
          overallStatus = "down";
        }
      }),
    );

    return {
      status: overallStatus,
      checks: results,
      details: { ...this.details },
    };
  }

  async getLivenessResponse(): Promise<{ status: string }> {
    return { status: "alive" };
  }

  async getReadinessResponse(): Promise<HealthResponse | { status: string }> {
    if (!this.ready) {
      return { status: "not_ready" };
    }
    return this.runChecks();
  }

  async getHealthResponse(): Promise<HealthResponse> {
    return this.runChecks();
  }

  // Common health check for HTTP services
  static httpCheck(url: string): () => Promise<void> {
    return async () => {
      const response = await axios.get(url, { timeout: 3000 });
      if (response.status >= 400) {
        throw new Error(`HTTP ${response.status}`);
      }
    };
  }
}
