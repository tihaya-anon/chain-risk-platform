"""Prometheus metrics for Risk ML Service."""

from prometheus_client import Counter, Histogram, Gauge

# HTTP metrics are handled by prometheus-fastapi-instrumentator

# Business metrics - Risk score distribution (CP-5)
RISK_SCORE_DISTRIBUTION = Histogram(
    "risk_score_distribution",
    "Distribution of computed risk scores (0-1 range)",
    buckets=[0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
)

# Risk scoring metrics
RISK_SCORES_COMPUTED = Counter(
    "risk_ml_service_risk_scores_computed_total",
    "Total risk scores computed",
    ["model_type"],  # xgboost, gnn, ensemble
)

RISK_SCORE_LATENCY = Histogram(
    "risk_ml_service_risk_score_latency_seconds",
    "Risk score computation latency",
    ["model_type"],
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0],
)

# ML model metrics
MODEL_INFERENCE_ERRORS = Counter(
    "risk_ml_service_model_inference_errors_total",
    "Total model inference errors",
    ["model_type", "error_type"],
)

FEATURE_EXTRACTION_LATENCY = Histogram(
    "risk_ml_service_feature_extraction_latency_seconds",
    "Feature extraction latency",
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0],
)

# Rule engine metrics
RULE_EVALUATIONS = Counter(
    "risk_ml_service_rule_evaluations_total",
    "Total rule evaluations",
    ["rule_name", "result"],  # result: triggered/not_triggered
)

# External service call metrics
EXTERNAL_SERVICE_CALLS = Counter(
    "risk_ml_service_external_service_calls_total",
    "Total external service calls",
    ["service", "status"],  # status: success/error
)

EXTERNAL_SERVICE_LATENCY = Histogram(
    "risk_ml_service_external_service_latency_seconds",
    "External service call latency",
    ["service"],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5],
)

# Cache metrics
CACHE_OPERATIONS = Counter(
    "risk_ml_service_cache_operations_total",
    "Total cache operations",
    ["operation", "result"],  # operation: get/set, result: hit/miss/success/error
)

# Model info
MODEL_LOADED = Gauge(
    "risk_ml_service_model_loaded",
    "Whether the model is loaded",
    ["model_type"],
)


def record_risk_score(model_type: str, score: float, latency: float):
    """Record risk score computation metrics."""
    RISK_SCORES_COMPUTED.labels(model_type=model_type).inc()
    RISK_SCORE_LATENCY.labels(model_type=model_type).observe(latency)
    # Record in business metric (CP-5)
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
