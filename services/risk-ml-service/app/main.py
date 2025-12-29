from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.core.logging import setup_logging, get_logger
from app.api.v1.risk import router as risk_router, get_risk_service

settings = get_settings()
setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    logger.info(
        "Starting Risk ML Service",
        app_name=settings.app_name,
        env=settings.app_env,
        port=settings.port,
    )
    yield
    # Cleanup
    logger.info("Shutting down Risk ML Service")
    service = get_risk_service()
    await service.close()


app = FastAPI(
    title="Risk ML Service",
    description="Risk scoring service with rule engine and ML models for blockchain address analysis",
    version="0.1.0",
    docs_url="/docs" if settings.app_env != "production" else None,
    redoc_url="/redoc" if settings.app_env != "production" else None,
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


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": settings.app_name}


@app.get("/")
async def root():
    """Root endpoint with service info."""
    return {
        "service": settings.app_name,
        "version": "0.1.0",
        "docs": "/docs" if settings.app_env != "production" else "disabled",
    }


# Include routers
app.include_router(risk_router, prefix="/api/v1")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
