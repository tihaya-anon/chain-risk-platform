import { Injectable, OnModuleInit } from "@nestjs/common";
import * as client from "prom-client";
import * as os from "os";
import * as v8 from "v8";

/**
 * USE Method metrics for BFF service.
 * Utilization, Saturation, Errors.
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  private registry: client.Registry;

  // ============== USE: Utilization ==============
  private cpuUtilizationRatio: client.Gauge<string>;
  private memoryUtilizationRatio: client.Gauge<string>;
  private activeRequests: client.Gauge<string>;
  private eventLoopLag: client.Gauge<string>;
  private heapUsedRatio: client.Gauge<string>;

  // ============== USE: Saturation ==============
  private rateLimitExceededTotal: client.Counter<string>;
  private requestQueueLength: client.Gauge<string>;
  private eventLoopUtilization: client.Gauge<string>;

  // ============== USE: Errors ==============
  private errorsTotal: client.Counter<string>;
  private circuitBreakerState: client.Gauge<string>;

  // ============== HTTP Metrics ==============
  private httpRequestsTotal: client.Counter<string>;
  private httpRequestDuration: client.Histogram<string>;

  // ============== WebSocket Metrics ==============
  private wsConnectionsActive: client.Gauge<string>;
  private wsMessagesTotal: client.Counter<string>;

  // ============== External Service Metrics ==============
  private externalCallsTotal: client.Counter<string>;
  private externalCallDuration: client.Histogram<string>;

  private activeRequestCount = 0;
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.registry = new client.Registry();
    client.collectDefaultMetrics({ register: this.registry });
    this.initializeMetrics();
  }

  onModuleInit() {
    this.startMetricsCollection();
  }

  private initializeMetrics() {
    // USE: Utilization
    this.cpuUtilizationRatio = new client.Gauge({
      name: "bff_cpu_utilization_ratio",
      help: "CPU utilization ratio (0-1)",
      registers: [this.registry],
    });

    this.memoryUtilizationRatio = new client.Gauge({
      name: "bff_memory_utilization_ratio",
      help: "Memory utilization ratio (0-1)",
      registers: [this.registry],
    });

    this.activeRequests = new client.Gauge({
      name: "bff_active_requests",
      help: "Number of currently processing requests",
      registers: [this.registry],
    });

    this.eventLoopLag = new client.Gauge({
      name: "bff_event_loop_lag_seconds",
      help: "Event loop lag in seconds",
      registers: [this.registry],
    });

    this.heapUsedRatio = new client.Gauge({
      name: "bff_heap_used_ratio",
      help: "V8 heap used ratio",
      registers: [this.registry],
    });

    // USE: Saturation
    this.rateLimitExceededTotal = new client.Counter({
      name: "bff_rate_limit_exceeded_total",
      help: "Total requests rejected by rate limiter",
      registers: [this.registry],
    });

    this.requestQueueLength = new client.Gauge({
      name: "bff_request_queue_length",
      help: "Number of requests waiting in queue",
      registers: [this.registry],
    });

    this.eventLoopUtilization = new client.Gauge({
      name: "bff_event_loop_utilization",
      help: "Event loop utilization (0-1)",
      registers: [this.registry],
    });

    // USE: Errors
    this.errorsTotal = new client.Counter({
      name: "bff_errors_total",
      help: "Total errors by type",
      labelNames: ["type"],
      registers: [this.registry],
    });

    this.circuitBreakerState = new client.Gauge({
      name: "bff_circuit_breaker_state",
      help: "Circuit breaker state (0=closed, 1=half-open, 2=open)",
      labelNames: ["target"],
      registers: [this.registry],
    });

    // HTTP Metrics
    this.httpRequestsTotal = new client.Counter({
      name: "bff_http_requests_total",
      help: "Total HTTP requests",
      labelNames: ["method", "path", "status"],
      registers: [this.registry],
    });

    this.httpRequestDuration = new client.Histogram({
      name: "bff_http_request_duration_seconds",
      help: "HTTP request duration in seconds",
      labelNames: ["method", "path"],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });

    // WebSocket Metrics
    this.wsConnectionsActive = new client.Gauge({
      name: "bff_websocket_connections_active",
      help: "Active WebSocket connections",
      registers: [this.registry],
    });

    this.wsMessagesTotal = new client.Counter({
      name: "bff_websocket_messages_total",
      help: "Total WebSocket messages",
      labelNames: ["direction", "type"],
      registers: [this.registry],
    });

    // External Service Metrics
    this.externalCallsTotal = new client.Counter({
      name: "bff_external_calls_total",
      help: "Total external service calls",
      labelNames: ["service", "status"],
      registers: [this.registry],
    });

    this.externalCallDuration = new client.Histogram({
      name: "bff_external_call_duration_seconds",
      help: "External service call duration",
      labelNames: ["service"],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });
  }

  private startMetricsCollection() {
    // Collect system metrics every 10 seconds
    this.metricsInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 10000);
  }

  private collectSystemMetrics() {
    // CPU utilization
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });
    const cpuUsage = 1 - totalIdle / totalTick;
    this.cpuUtilizationRatio.set(cpuUsage);

    // Memory utilization
    const memUsed = process.memoryUsage();
    const totalMem = os.totalmem();
    this.memoryUtilizationRatio.set(memUsed.rss / totalMem);

    // V8 heap
    const heapStats = v8.getHeapStatistics();
    this.heapUsedRatio.set(heapStats.used_heap_size / heapStats.heap_size_limit);

    // Active requests
    this.activeRequests.set(this.activeRequestCount);
  }

  // ============== Public API ==============

  getRegistry(): client.Registry {
    return this.registry;
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  incActiveRequests(): void {
    this.activeRequestCount++;
    this.activeRequests.set(this.activeRequestCount);
  }

  decActiveRequests(): void {
    this.activeRequestCount--;
    this.activeRequests.set(this.activeRequestCount);
  }

  recordHttpRequest(
    method: string,
    path: string,
    status: number,
    duration: number,
  ): void {
    this.httpRequestsTotal.labels(method, path, status.toString()).inc();
    this.httpRequestDuration.labels(method, path).observe(duration);
  }

  recordError(type: string): void {
    this.errorsTotal.labels(type).inc();
  }

  setCircuitBreakerState(target: string, state: number): void {
    this.circuitBreakerState.labels(target).set(state);
  }

  incRateLimitExceeded(): void {
    this.rateLimitExceededTotal.inc();
  }

  setWsConnectionsActive(count: number): void {
    this.wsConnectionsActive.set(count);
  }

  recordWsMessage(direction: "in" | "out", type: string): void {
    this.wsMessagesTotal.labels(direction, type).inc();
  }

  recordExternalCall(
    service: string,
    success: boolean,
    duration: number,
  ): void {
    this.externalCallsTotal.labels(service, success ? "success" : "error").inc();
    this.externalCallDuration.labels(service).observe(duration);
  }

  setEventLoopLag(lagSeconds: number): void {
    this.eventLoopLag.set(lagSeconds);
  }
}
