"""OpenTelemetry initialization for tracing and metrics."""

import os
from typing import Optional

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.propagate import set_global_textmap
from opentelemetry.propagators.b3 import B3MultiFormat
from opentelemetry.sdk.resources import Resource, SERVICE_NAME, SERVICE_VERSION
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.trace.sampling import TraceIdRatioBased

from app.core.config import get_config
from app.core.logging import get_logger

logger = get_logger(__name__)

_tracer_provider: Optional[TracerProvider] = None


def get_tracer(name: str = __name__) -> trace.Tracer:
    """Get a tracer instance."""
    return trace.get_tracer(name)


def init_telemetry(app, service_name: Optional[str] = None) -> None:
    """
    Initialize OpenTelemetry tracing for the application.
    
    Args:
        app: FastAPI application instance
        service_name: Override service name (defaults to config value)
    """
    global _tracer_provider
    
    if _tracer_provider is not None:
        logger.warning("Telemetry already initialized, skipping")
        return
    
    config = get_config()
    svc_name = service_name or config.server.name
    
    # Get OTLP endpoint from env or config
    otlp_endpoint = os.getenv(
        "OTEL_EXPORTER_OTLP_ENDPOINT",
        os.getenv("JAEGER_ENDPOINT", "http://localhost:4317")
    )
    
    # Sampling rate (default 100% for dev, adjust for prod)
    sampling_rate = float(os.getenv("OTEL_SAMPLING_RATE", "1.0"))
    
    logger.info(
        "Initializing OpenTelemetry",
        service=svc_name,
        endpoint=otlp_endpoint,
        sampling_rate=sampling_rate,
    )
    
    # Create resource with service metadata
    resource = Resource.create({
        SERVICE_NAME: svc_name,
        SERVICE_VERSION: "1.0.0",
        "service.namespace": "chain-risk-platform",
        "deployment.environment": os.getenv("ENV", "development"),
    })
    
    # Create tracer provider with sampling
    sampler = TraceIdRatioBased(sampling_rate)
    _tracer_provider = TracerProvider(resource=resource, sampler=sampler)
    
    # Configure OTLP exporter
    otlp_exporter = OTLPSpanExporter(
        endpoint=otlp_endpoint,
        insecure=True,
    )
    
    # Add batch processor for efficient span export
    span_processor = BatchSpanProcessor(
        otlp_exporter,
        max_queue_size=2048,
        max_export_batch_size=512,
        schedule_delay_millis=5000,
    )
    _tracer_provider.add_span_processor(span_processor)
    
    # Set global tracer provider
    trace.set_tracer_provider(_tracer_provider)
    
    # Set B3 propagation format for cross-service tracing
    set_global_textmap(B3MultiFormat())
    
    # Instrument FastAPI
    FastAPIInstrumentor.instrument_app(
        app,
        excluded_urls="health,metrics",
        tracer_provider=_tracer_provider,
    )
    
    # Instrument HTTP client (httpx)
    HTTPXClientInstrumentor().instrument(tracer_provider=_tracer_provider)
    
    # Instrument Redis
    RedisInstrumentor().instrument(tracer_provider=_tracer_provider)
    
    logger.info("OpenTelemetry initialized successfully")


def instrument_sqlalchemy(engine) -> None:
    """Instrument SQLAlchemy engine for tracing."""
    SQLAlchemyInstrumentor().instrument(
        engine=engine,
        tracer_provider=_tracer_provider,
    )
    logger.info("SQLAlchemy instrumented for tracing")


async def shutdown_telemetry() -> None:
    """Shutdown telemetry and flush pending spans."""
    global _tracer_provider
    
    if _tracer_provider is not None:
        logger.info("Shutting down OpenTelemetry")
        _tracer_provider.shutdown()
        _tracer_provider = None
