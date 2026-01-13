import { Test, TestingModule } from "@nestjs/testing";
import {
  CircuitBreakerService,
  BreakerState,
} from "@/common/resilience/circuit-breaker.service";

describe("CircuitBreakerService", () => {
  let service: CircuitBreakerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CircuitBreakerService],
    }).compile();

    service = module.get<CircuitBreakerService>(CircuitBreakerService);
  });

  afterEach(() => {
    service.resetBreaker("test-service");
    service.resetBreaker("another-service");
    service.resetBreaker("service-a");
    service.resetBreaker("service-b");
  });

  describe("getOrCreateBreaker", () => {
    it("should create a new breaker for a service", () => {
      const breaker = service.getOrCreateBreaker("test-service");
      expect(breaker).toBeDefined();
      expect(breaker.policy).toBeDefined();
      expect(breaker.breaker).toBeDefined();
    });

    it("should return same breaker for same service name", () => {
      const breaker1 = service.getOrCreateBreaker("test-service");
      const breaker2 = service.getOrCreateBreaker("test-service");
      expect(breaker1).toBe(breaker2);
    });

    it("should create different breakers for different services", () => {
      const breaker1 = service.getOrCreateBreaker("service-a");
      const breaker2 = service.getOrCreateBreaker("service-b");
      expect(breaker1).not.toBe(breaker2);
    });

    it("should apply custom config", () => {
      const customConfig = {
        timeout: 10000,
        retryAttempts: 5,
      };
      const breaker = service.getOrCreateBreaker("test-service", customConfig);
      expect(breaker.config.timeout).toBe(10000);
      expect(breaker.config.retryAttempts).toBe(5);
    });
  });

  describe("wrapWithResilience", () => {
    it("should execute successful function", async () => {
      const result = await service.wrapWithResilience(
        "test-service",
        async () => {
          return "success";
        }
      );
      expect(result).toBe("success");
    });

    it("should retry on failure then succeed", async () => {
      let attempts = 0;
      const result = await service.wrapWithResilience(
        "test-service",
        async () => {
          attempts++;
          if (attempts < 2) {
            throw new Error("Temporary failure");
          }
          return "success after retry";
        },
        { retryAttempts: 3, circuitBreakerThreshold: 10 }
      );
      expect(result).toBe("success after retry");
      expect(attempts).toBe(2);
    });

    it("should throw after all retries exhausted", async () => {
      await expect(
        service.wrapWithResilience(
          "test-service",
          async () => {
            throw new Error("Persistent failure");
          },
          { retryAttempts: 2, circuitBreakerThreshold: 10 }
        )
      ).rejects.toThrow("Persistent failure");
    });

    it("should timeout long running operations", async () => {
      await expect(
        service.wrapWithResilience(
          "test-service",
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 10000));
            return "should not reach";
          },
          { timeout: 100, retryAttempts: 1, circuitBreakerThreshold: 10 }
        )
      ).rejects.toThrow();
    }, 15000);
  });

  describe("getState", () => {
    it("should return undefined for non-existent breaker", () => {
      const state = service.getState("non-existent");
      expect(state).toBeUndefined();
    });

    it("should return state for existing breaker", () => {
      service.getOrCreateBreaker("test-service");
      const state = service.getState("test-service");
      expect(state).toBeDefined();
    });
  });

  describe("getStats", () => {
    it("should return null for non-existent service", () => {
      const stats = service.getStats("non-existent");
      expect(stats).toBeNull();
    });

    it("should return stats for existing service", () => {
      service.getOrCreateBreaker("test-service");
      const stats = service.getStats("test-service");
      expect(stats).toBeDefined();
      expect(stats!.state).toBeDefined();
      expect(stats!.config).toBeDefined();
    });
  });

  describe("getAllStats", () => {
    it("should return empty object when no breakers", () => {
      const stats = service.getAllStats();
      expect(stats).toEqual({});
    });

    it("should return all breaker stats", () => {
      service.getOrCreateBreaker("service-a");
      service.getOrCreateBreaker("service-b");
      const stats = service.getAllStats();
      expect(Object.keys(stats)).toHaveLength(2);
      expect(stats["service-a"]).toBeDefined();
      expect(stats["service-b"]).toBeDefined();
    });
  });

  describe("resetBreaker", () => {
    it("should return false for non-existent breaker", () => {
      const result = service.resetBreaker("non-existent");
      expect(result).toBe(false);
    });

    it("should reset existing breaker", () => {
      service.getOrCreateBreaker("test-service");
      const result = service.resetBreaker("test-service");
      expect(result).toBe(true);
      expect(service.getState("test-service")).toBeUndefined();
    });
  });
});
