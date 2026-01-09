"""
Risk ML Service - Main Application
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from prometheus_fastapi_instrumentator.metrics import default

from app.api.v1.risk import router as risk_router
from app.core.config import get_config
from app.core.logging import setup_logging, get_logger
from app.ml.ensemble import EnsembleScorer
from app.services.risk_service import get_risk_service

# Setup logging
setup_logging()
logger = get_logger(__name__)
config = get_config()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    logger.info("Starting Risk ML Service", version="1.0.0")
    
    # Initialize ensemble scorer (preload models if available)
    try:
        scorer = EnsembleScorer()
        app.state.ensemble_scorer = scorer
        logger.info("Ensemble scorer initialized")
    except Exception as e:
        logger.warning(f"Ensemble scorer initialization skipped: {e}")
        app.state.ensemble_scorer = None
    
    yield
    
    logger.info("Shutting down Risk ML Service")


app = FastAPI(
    title="Risk ML Service",
    description="Machine Learning based risk scoring service",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    return {"status": "ok", "service": config.server.name}


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


# Legacy endpoint for backward compatibility
@app.get("/api/v1/risk/{address}")
async def get_risk_score_legacy(address: str):
    """Get risk score for an address."""
    try:
        service = get_risk_service()
        result = await service.get_risk_score(address)
        return result
    except Exception as e:
        logger.error(f"Error getting risk score: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/risk/batch")
async def batch_risk_score(addresses: list[str]):
    """Get risk scores for multiple addresses."""
    try:
        service = get_risk_service()
        results = await service.batch_risk_score(addresses)
        return {"results": results}
    except Exception as e:
        logger.error(f"Error getting batch risk scores: {e}")
        raise HTTPException(status_code=500, detail=str(e))
