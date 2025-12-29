from typing import Optional
from app.models.risk import (
    RiskFactor,
    RiskLevel,
    RiskScoreResponse,
    AddressInfo,
    TransferInfo,
)
from app.rules.base import (
    BaseRule,
    BlacklistRule,
    HighFrequencyRule,
    LargeTransactionRule,
    NewAddressRule,
    RoundAmountRule,
)
from app.core.config import get_config
from app.core.logging import get_logger

logger = get_logger(__name__)


class RuleEngine:
    """Rule engine for evaluating address risk."""

    def __init__(self):
        self.config = get_config()
        self.rules: list[BaseRule] = [
            BlacklistRule(),
            HighFrequencyRule(),
            LargeTransactionRule(),
            NewAddressRule(),
            RoundAmountRule(),
        ]

    async def evaluate(
        self,
        address: str,
        network: str,
        address_info: Optional[AddressInfo],
        transfers: list[TransferInfo],
        include_factors: bool = True,
    ) -> RiskScoreResponse:
        """Evaluate all rules and compute overall risk score."""

        factors: list[RiskFactor] = []
        total_weight = 0.0
        weighted_score = 0.0
        tags: list[str] = []

        for rule in self.rules:
            try:
                factor = await rule.evaluate(address, address_info, transfers)
                factors.append(factor)

                # Accumulate weighted score
                weighted_score += factor.score * factor.weight
                total_weight += factor.weight

                # Collect tags for triggered factors
                if factor.triggered:
                    tags.append(factor.name)

            except Exception as e:
                logger.error(
                    "Rule evaluation failed",
                    rule=rule.name,
                    address=address,
                    error=str(e),
                )
                # Add a neutral factor for failed rules
                factors.append(
                    RiskFactor(
                        name=rule.name,
                        score=0.0,
                        weight=0.0,
                        description=f"Evaluation failed: {str(e)}",
                        triggered=False,
                    )
                )

        # Calculate final score
        risk_score = weighted_score / total_weight if total_weight > 0 else 0.0
        risk_score = min(1.0, max(0.0, risk_score))  # Clamp to [0, 1]

        # Determine risk level
        risk_level = self._determine_risk_level(risk_score)

        logger.info(
            "Risk evaluation completed",
            address=address,
            risk_score=risk_score,
            risk_level=risk_level.value,
            triggered_rules=len(tags),
        )

        return RiskScoreResponse(
            address=address,
            network=network,
            risk_score=round(risk_score, 4),
            risk_level=risk_level,
            factors=factors if include_factors else [],
            tags=tags,
            cached=False,
        )

    def _determine_risk_level(self, score: float) -> RiskLevel:
        """Determine risk level based on score."""
        if score >= 0.8:
            return RiskLevel.CRITICAL
        elif score >= self.config.risk.high_risk_threshold:
            return RiskLevel.HIGH
        elif score >= self.config.risk.medium_risk_threshold:
            return RiskLevel.MEDIUM
        else:
            return RiskLevel.LOW

    def add_rule(self, rule: BaseRule) -> None:
        """Add a custom rule to the engine."""
        self.rules.append(rule)

    def remove_rule(self, rule_name: str) -> bool:
        """Remove a rule by name."""
        for i, rule in enumerate(self.rules):
            if rule.name == rule_name:
                self.rules.pop(i)
                return True
        return False

    def list_rules(self) -> list[dict]:
        """List all registered rules."""
        return [
            {
                "name": rule.name,
                "description": rule.description,
                "weight": rule.weight,
            }
            for rule in self.rules
        ]
