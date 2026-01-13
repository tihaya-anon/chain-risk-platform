import { Injectable, Logger } from "@nestjs/common";
import {
  ConsecutiveBreaker,
  ExponentialBackoff,
  handleAll,
  retry,
  circuitBreaker,
  wrap,
  timeout,
  TimeoutStrategy,
  CircuitBreakerPolicy,
  IPolicy,
} from "cockatiel";

export interface ResilienceConfig {
  timeout: number;
  retryAttempts: number;
  circuitBreakerThreshold: number;
  circuitBreakerHalfOpenAfter: number;
}

const DEFAULT_CONFIG: ResilienceConfig = {
  timeout: 5000,
  retryAttempts: 3,
  circuitBreakerThreshold: 5,
  circuitBreakerHalfOpenAfter: 30000,
};

interface ServiceBreaker {
  policy: IPolicy;
  breaker: CircuitBreakerPolicy;
  config: ResilienceConfig;
}

export enum BreakerState {
  Closed = "Closed",
  Open = "Open",
  HalfOpen = "HalfOpen",
  Isolated = "Isolated",
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly breakers = new Map<string, ServiceBreaker>();

  getOrCreateBreaker(
    serviceName: string,
    customConfig?: Partial<ResilienceConfig>
  ): ServiceBreaker {
    if (this.breakers.has(serviceName)) {
      return this.breakers.get(serviceName)!;
    }

    const config = { ...DEFAULT_CONFIG, ...customConfig };

    const timeoutPolicy = timeout(config.timeout, TimeoutStrategy.Aggressive);

    const retryPolicy = retry(handleAll, {
      maxAttempts: config.retryAttempts,
      backoff: new ExponentialBackoff({
        initialDelay: 100,
        maxDelay: 2000,
      }),
    });

    const breaker = circuitBreaker(handleAll, {
      halfOpenAfter: config.circuitBreakerHalfOpenAfter,
      breaker: new ConsecutiveBreaker(config.circuitBreakerThreshold),
    });

    breaker.onStateChange((state) => {
      this.logger.warn(
        `Circuit breaker [${serviceName}] state changed to: ${state}`
      );
    });

    breaker.onFailure(({ reason }) => {
      this.logger.debug(`Circuit breaker [${serviceName}] failure: ${reason}`);
    });

    breaker.onSuccess(() => {
      this.logger.debug(`Circuit breaker [${serviceName}] success`);
    });

    const policy = wrap(timeoutPolicy, retryPolicy, breaker);

    const serviceBreaker: ServiceBreaker = { policy, breaker, config };
    this.breakers.set(serviceName, serviceBreaker);

    this.logger.log(`Created circuit breaker for service: ${serviceName}`);
    return serviceBreaker;
  }

  async wrapWithResilience<T>(
    serviceName: string,
    fn: () => Promise<T>,
    customConfig?: Partial<ResilienceConfig>
  ): Promise<T> {
    const { policy } = this.getOrCreateBreaker(serviceName, customConfig);
    return policy.execute(fn);
  }

  getState(serviceName: string): BreakerState | undefined {
    const serviceBreaker = this.breakers.get(serviceName);
    if (!serviceBreaker) return undefined;
    return serviceBreaker.breaker.state as unknown as BreakerState;
  }

  getStats(serviceName: string): {
    state: string;
    config: ResilienceConfig;
  } | null {
    const serviceBreaker = this.breakers.get(serviceName);
    if (!serviceBreaker) return null;

    return {
      state: String(serviceBreaker.breaker.state),
      config: serviceBreaker.config,
    };
  }

  getAllStats(): Record<string, { state: string; config: ResilienceConfig }> {
    const stats: Record<string, { state: string; config: ResilienceConfig }> =
      {};
    for (const [name, breaker] of this.breakers) {
      stats[name] = {
        state: String(breaker.breaker.state),
        config: breaker.config,
      };
    }
    return stats;
  }

  resetBreaker(serviceName: string): boolean {
    const serviceBreaker = this.breakers.get(serviceName);
    if (!serviceBreaker) return false;

    this.breakers.delete(serviceName);
    this.logger.log(`Reset circuit breaker for service: ${serviceName}`);
    return true;
  }
}
