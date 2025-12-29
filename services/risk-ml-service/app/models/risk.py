from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum
from datetime import datetime


class RiskLevel(str, Enum):
    """Risk level classification."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class RiskFactor(BaseModel):
    """Individual risk factor with score and description."""
    name: str = Field(..., description="Risk factor name")
    score: float = Field(..., ge=0, le=1, description="Factor score (0-1)")
    weight: float = Field(default=1.0, description="Factor weight")
    description: str = Field(..., description="Human-readable description")
    triggered: bool = Field(default=False, description="Whether this factor was triggered")


class RiskScoreRequest(BaseModel):
    """Request model for single address risk scoring."""
    address: str = Field(..., min_length=42, max_length=42, description="Ethereum address")
    network: str = Field(default="ethereum", description="Blockchain network")
    include_factors: bool = Field(default=True, description="Include detailed risk factors")


class RiskScoreResponse(BaseModel):
    """Response model for risk scoring."""
    address: str = Field(..., description="Evaluated address")
    network: str = Field(..., description="Blockchain network")
    risk_score: float = Field(..., ge=0, le=1, description="Overall risk score (0-1)")
    risk_level: RiskLevel = Field(..., description="Risk level classification")
    factors: list[RiskFactor] = Field(default_factory=list, description="Detailed risk factors")
    tags: list[str] = Field(default_factory=list, description="Risk tags")
    evaluated_at: datetime = Field(default_factory=datetime.utcnow, description="Evaluation timestamp")
    cached: bool = Field(default=False, description="Whether result was from cache")


class BatchRiskScoreRequest(BaseModel):
    """Request model for batch risk scoring."""
    addresses: list[str] = Field(..., min_length=1, max_length=100, description="List of addresses")
    network: str = Field(default="ethereum", description="Blockchain network")
    include_factors: bool = Field(default=False, description="Include detailed risk factors")


class BatchRiskScoreResponse(BaseModel):
    """Response model for batch risk scoring."""
    results: list[RiskScoreResponse] = Field(..., description="Risk scores for each address")
    total: int = Field(..., description="Total addresses processed")
    failed: int = Field(default=0, description="Number of failed evaluations")


class AddressInfo(BaseModel):
    """Address information from Query Service."""
    address: str
    network: str
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    total_tx_count: int = 0
    sent_tx_count: int = 0
    received_tx_count: int = 0
    unique_interacted: int = 0


class TransferInfo(BaseModel):
    """Transfer information from Query Service."""
    id: int
    tx_hash: str
    block_number: int
    from_address: str
    to_address: str
    value: str
    timestamp: datetime
    transfer_type: str
    network: str
