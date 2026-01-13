"""
Risk ML Service - Main Application with Security Integration
"""
import os
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from prometheus_fastapi_instrumentator.metrics import default

from app.api.v1.risk import router as risk_router
from app.audit.middleware import AuditMiddleware
from app.core.config import get_config
from app.core.logging import setup_logging, get_logger
from app.core.telemetry import init_telemetry, shutdown_telemetry
from app.core.tls import TLSConfig, create_ssl_context
from app.middleware.ratelimit import RateLimitMiddleware
from app.services.risk_service import RiskService

# Setup logging
setup_logging()
logger = get_logger(__name__)
config = get_config()

# Global service instance
_risk_service: RiskService | None = None


def get_risk_service() -> RiskService:
    global _risk_service
    if _risk_service is None:
        _risk_service = RiskService()
    return _risk_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    tls_enabled = os.getenv("TLS_ENABLED", "false").lower() == "true"
    logger.info(
        "Starting Risk ML Service",
        version="1.0.0",
        tls_enabled=tls_enabled,
    )
    yield
    logger.info("Shutting down Risk ML Service")
    await shutdown_telemetry()
    if _risk_service:
        await _risk_service.close()


app = FastAPI(
    title="Risk ML Service",
    description="Machine Learning based risk scoring service",
    version="1.0.0",
    lifespan=lifespan,
)

# Initialize OpenTelemetry tracing
init_telemetry(app, service_name="risk-ml-service")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security middleware - Rate limiting
app.add_middleware(RateLimitMiddleware)

# Security middleware - Audit logging
app.add_middleware(AuditMiddleware)

# Prometheus metrics instrumentation
instrumentator = Instrumentator(
    should_group_status_codes=True,
    should_ignore_untemplated=True,
    should_instrument_requests_inprogress=True,
    excluded_handlers=["/health", "/metrics"],
    inprogress_name="risk_ml_service_http_requests_inprogress",
    inprogress_labels=True,
)
instrumentator.add(default()).instrument(app).expose(app, endpoint="/metrics")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    tls_config = TLSConfig.from_env()
    return {
        "status": "ok",
        "service": config.server.name,
        "tls_enabled": tls_config.enabled,
    }


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "risk-ml-service",
        "version": "1.0.0",
        "docs": "/docs",
    }


# Include routers
app.include_router(risk_router, prefix="/api/v1/risk", tags=["risk"])


@app.get("/api/v1/risk/{address}")
async def get_risk_score(address: str):
    """Get risk score for an address."""
    try:
        service = get_risk_service()
        result = await service.score_address(address)
        return result
    except Exception as e:
        logger.error(f"Error getting risk score: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/risk/batch")
async def batch_risk_score(request: dict):
    """Get risk scores for multiple addresses."""
    try:
        addresses = request.get("addresses", [])
        service = get_risk_service()
        results = await service.score_addresses_batch(addresses)
        return {"results": results}
    except Exception as e:
        logger.error(f"Error getting batch risk scores: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def main():
    """Main entry point with TLS support."""
    tls_config = TLSConfig.from_env()
    port = int(os.getenv("PORT", "8082"))
    host = os.getenv("HOST", "0.0.0.0")

    if tls_config.enabled:
        ssl_context = create_ssl_context(tls_config)
        logger.info(
            "Starting HTTPS server with TLS",
            host=host,
            port=port,
            mtls_mode=tls_config.mtls_mode,
        )
        uvicorn.run(
            "app.main:app",
            host=host,
            port=port,
            ssl_certfile=tls_config.cert_path,
            ssl_keyfile=tls_config.key_path,
            ssl_ca_certs=tls_config.ca_path if tls_config.mtls_mode != "disabled" else None,
            reload=False,
        )
    else:
        logger.info(
            "Starting HTTP server (TLS disabled)",
            host=host,
            port=port,
        )
        uvicorn.run(
            "app.main:app",
            host=host,
            port=port,
            reload=False,
        )


if __name__ == "__main__":
    main()
