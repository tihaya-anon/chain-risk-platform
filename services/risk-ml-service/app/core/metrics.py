"""
Prometheus metrics for Risk ML Service.
Implements USE Method: Utilization, Saturation, Errors.
"""
import threading
import time
import psutil
import os
from prometheus_client import Counter, Histogram, Gauge

# ============== USE: Utilization ==============
CPU_UTILIZATION_RATIO = Gauge(
    "risk_ml_service_cpu_utilization_ratio",
    "CPU utilization ratio (0-1)",
)

MEMORY_UTILIZATION_RATIO = Gauge(
    "risk_ml_service_memory_utilization_ratio",
    "Memory utilization ratio (0-1)",
)

ACTIVE_REQUESTS = Gauge(
    "risk_ml_service_active_requests",
    "Number of currently processing requests",
)

THREAD_POOL_ACTIVE = Gauge(
    "risk_ml_service_thread_pool_active",
    "Number of active threads in thread pool",
)

GPU_UTILIZATION_RATIO = Gauge(
    "risk_ml_service_gpu_utilization_ratio",
    "GPU utilization ratio (0-1) if GPU available",
)

GPU_MEMORY_UTILIZATION = Gauge(
    "risk_ml_service_gpu_memory_utilization",
    "GPU memory utilization ratio",
)

MODEL_BATCH_QUEUE_SIZE = Gauge(
    "risk_ml_service_model_batch_queue_size",
    "Number of requests waiting for batch inference",
)

# ============== USE: Saturation ==============
RATE_LIMIT_EXCEEDED_TOTAL = Counter(
    "risk_ml_service_rate_limit_exceeded_total",
    "Total requests rejected by rate limiter",
)

REQUEST_QUEUE_LENGTH = Gauge(
    "risk_ml_service_request_queue_length",
    "Number of requests waiting in queue",
)

MODEL_INFERENCE_QUEUE_WAIT = Histogram(
    "risk_ml_service_model_inference_queue_wait_seconds",
    "Time spent waiting for model inference slot",
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0],
)

# ============== USE: Errors ==============
ERRORS_TOTAL = Counter(
    "risk_ml_service_errors_total",
    "Total errors by type",
    ["type"],  # model_error, timeout, validation, external_service
)

CIRCUIT_BREAKER_STATE = Gauge(
    "risk_ml_service_circuit_breaker_state",
    "Circuit breaker state (0=closed, 1=half-open, 2=open)",
    ["target"],
)

MODEL_INFERENCE_ERRORS = Counter(
    "risk_ml_service_model_inference_errors_total",
    "Total model inference errors",
    ["model_type", "error_type"],
)

# ============== Business Metrics ==============
RISK_SCORE_DISTRIBUTION = Histogram(
    "risk_score_distribution",
    "Distribution of computed risk scores",
    buckets=[0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
)

RISK_SCORES_COMPUTED = Counter(
    "risk_ml_service_risk_scores_computed_total",
    "Total risk scores computed",
    ["model_type"],
)

RISK_SCORE_LATENCY = Histogram(
    "risk_ml_service_risk_score_latency_seconds",
    "Risk score computation latency",
    ["model_type"],
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0],
)

FEATURE_EXTRACTION_LATENCY = Histogram(
    "risk_ml_service_feature_extraction_latency_seconds",
    "Feature extraction latency",
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0],
)

RULE_EVALUATIONS = Counter(
    "risk_ml_service_rule_evaluations_total",
    "Total rule evaluations",
    ["rule_name", "result"],
)

EXTERNAL_SERVICE_CALLS = Counter(
    "risk_ml_service_external_service_calls_total",
    "Total external service calls",
    ["service", "status"],
)

EXTERNAL_SERVICE_LATENCY = Histogram(
    "risk_ml_service_external_service_latency_seconds",
    "External service call latency",
    ["service"],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5],
)

CACHE_OPERATIONS = Counter(
    "risk_ml_service_cache_operations_total",
    "Total cache operations",
    ["operation", "result"],
)

MODEL_LOADED = Gauge(
    "risk_ml_service_model_loaded",
    "Whether the model is loaded",
    ["model_type"],
)

# Active request counter (thread-safe)
_active_requests = 0
_active_requests_lock = threading.Lock()


def inc_active_requests():
    """Increment active request count."""
    global _active_requests
    with _active_requests_lock:
        _active_requests += 1
        ACTIVE_REQUESTS.set(_active_requests)


def dec_active_requests():
    """Decrement active request count."""
    global _active_requests
    with _active_requests_lock:
        _active_requests -= 1
        ACTIVE_REQUESTS.set(_active_requests)


def record_error(error_type: str):
    """Record an error by type."""
    ERRORS_TOTAL.labels(type=error_type).inc()


def set_circuit_breaker_state(target: str, state: int):
    """Set circuit breaker state (0=closed, 1=half-open, 2=open)."""
    CIRCUIT_BREAKER_STATE.labels(target=target).set(state)


def record_risk_score(model_type: str, score: float, latency: float):
    """Record risk score computation metrics."""
    RISK_SCORES_COMPUTED.labels(model_type=model_type).inc()
    RISK_SCORE_LATENCY.labels(model_type=model_type).observe(latency)
    RISK_SCORE_DISTRIBUTION.observe(score)


def record_model_error(model_type: str, error_type: str):
    """Record model inference error."""
    MODEL_INFERENCE_ERRORS.labels(model_type=model_type, error_type=error_type).inc()


def record_feature_extraction(latency: float):
    """Record feature extraction latency."""
    FEATURE_EXTRACTION_LATENCY.observe(latency)


def record_rule_evaluation(rule_name: str, triggered: bool):
    """Record rule evaluation result."""
    result = "triggered" if triggered else "not_triggered"
    RULE_EVALUATIONS.labels(rule_name=rule_name, result=result).inc()


def record_external_call(service: str, success: bool, latency: float):
    """Record external service call metrics."""
    status = "success" if success else "error"
    EXTERNAL_SERVICE_CALLS.labels(service=service, status=status).inc()
    EXTERNAL_SERVICE_LATENCY.labels(service=service).observe(latency)


def record_cache_operation(operation: str, result: str):
    """Record cache operation result."""
    CACHE_OPERATIONS.labels(operation=operation, result=result).inc()


def set_model_loaded(model_type: str, loaded: bool):
    """Set model loaded status."""
    MODEL_LOADED.labels(model_type=model_type).set(1 if loaded else 0)


def _collect_system_metrics():
    """Background thread to collect system metrics."""
    process = psutil.Process(os.getpid())
    memory_limit = int(os.getenv("MEMORY_LIMIT", "1073741824"))  # 1GB default
    
    while True:
        try:
            # CPU utilization
            cpu_percent = process.cpu_percent(interval=1.0)
            CPU_UTILIZATION_RATIO.set(cpu_percent / 100.0)
            
            # Memory utilization
            memory_info = process.memory_info()
            MEMORY_UTILIZATION_RATIO.set(memory_info.rss / memory_limit)
            
            # Thread count
            THREAD_POOL_ACTIVE.set(process.num_threads())
            
            # GPU metrics (if available)
            try:
                import pynvml
                pynvml.nvmlInit()
                handle = pynvml.nvmlDeviceGetHandleByIndex(0)
                util = pynvml.nvmlDeviceGetUtilizationRates(handle)
                GPU_UTILIZATION_RATIO.set(util.gpu / 100.0)
                mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
                GPU_MEMORY_UTILIZATION.set(mem_info.used / mem_info.total)
            except Exception:
                pass  # GPU not available
                
        except Exception:
            pass
        
        time.sleep(10)


# Start background metrics collection
_metrics_thread = threading.Thread(target=_collect_system_metrics, daemon=True)
_metrics_thread.start()
