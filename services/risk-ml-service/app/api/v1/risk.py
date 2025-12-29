from fastapi import APIRouter, HTTPException, Depends
from app.models.risk import (
    RiskScoreRequest,
    RiskScoreResponse,
    BatchRiskScoreRequest,
    BatchRiskScoreResponse,
)
from app.services.risk_service import RiskService
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/risk", tags=["risk"])

# Dependency for RiskService
_risk_service: RiskService | None = None


def get_risk_service() -> RiskService:
    global _risk_service
    if _risk_service is None:
        _risk_service = RiskService()
    return _risk_service


@router.post("/score", response_model=RiskScoreResponse)
async def score_address(
    request: RiskScoreRequest,
    service: RiskService = Depends(get_risk_service),
) -> RiskScoreResponse:
    """
    Compute risk score for a single address.

    - **address**: Ethereum address (42 characters, starting with 0x)
    - **network**: Blockchain network (default: ethereum)
    - **include_factors**: Include detailed risk factors in response
    """
    try:
        result = await service.score_address(
            address=request.address,
            network=request.network,
            include_factors=request.include_factors,
        )
        return result
    except Exception as e:
        logger.error("Failed to score address", address=request.address, error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to compute risk score: {str(e)}")


@router.post("/batch", response_model=BatchRiskScoreResponse)
async def score_addresses_batch(
    request: BatchRiskScoreRequest,
    service: RiskService = Depends(get_risk_service),
) -> BatchRiskScoreResponse:
    """
    Compute risk scores for multiple addresses.

    - **addresses**: List of Ethereum addresses (max 100)
    - **network**: Blockchain network (default: ethereum)
    - **include_factors**: Include detailed risk factors (default: false for performance)
    """
    try:
        results, failed = await service.score_addresses_batch(
            addresses=request.addresses,
            network=request.network,
            include_factors=request.include_factors,
        )
        return BatchRiskScoreResponse(
            results=results,
            total=len(request.addresses),
            failed=failed,
        )
    except Exception as e:
        logger.error("Failed to batch score addresses", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to compute batch risk scores: {str(e)}")


@router.get("/rules")
async def list_rules(
    service: RiskService = Depends(get_risk_service),
) -> list[dict]:
    """
    List all registered risk evaluation rules.
    """
    return service.list_rules()
