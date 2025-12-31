from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_config
from app.core.logging import setup_logging, get_logger
from app.core.nacos import get_nacos_client
from app.api.v1.risk import router as risk_router, get_risk_service

# Setup logging first
setup_logging()
logger = get_logger(__name__)
config = get_config()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    logger.info(
        "Starting Risk ML Service",
        app_name=config.server.name,
        env=config.server.env,
        port=config.server.port,
    )
    
    # Initialize Nacos
    nacos_client = get_nacos_client()
    await nacos_client.init()
    
    yield
    
    # Cleanup
    logger.info("Shutting down Risk ML Service")
    
    # Close Nacos
    await nacos_client.close()
    
    # Close risk service
    service = get_risk_service()
    await service.close()


app = FastAPI(
    title="Risk ML Service",
    description="Risk scoring service with rule engine and ML models for blockchain address analysis",
    version="0.1.0",
    docs_url="/docs" if config.server.env != "production" else None,
    redoc_url="/redoc" if config.server.env != "production" else None,
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
    return {"status": "ok", "service": config.server.name}


@app.get("/admin/status")
async def admin_status():
    """Admin status endpoint with Nacos info."""
    nacos_client = get_nacos_client()
    return {
        **nacos_client.get_status(),
        "status": "healthy",
        "timestamp": __import__("time").time() * 1000,
    }


@app.get("/")
async def root():
    """Root endpoint with service info."""
    return {
        "service": config.server.name,
        "version": "0.1.0",
        "docs": "/docs" if config.server.env != "production" else "disabled",
    }


# Include routers
app.include_router(risk_router, prefix="/api/v1")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=config.server.port,
        reload=config.server.env == "development",
    )
