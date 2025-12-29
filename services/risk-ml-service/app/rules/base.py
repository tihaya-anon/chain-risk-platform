from abc import ABC, abstractmethod
from typing import Optional
from app.models.risk import RiskFactor, AddressInfo, TransferInfo


class BaseRule(ABC):
    """Base class for all risk rules."""

    name: str = "base_rule"
    description: str = "Base rule"
    weight: float = 1.0

    @abstractmethod
    async def evaluate(
        self,
        address: str,
        address_info: Optional[AddressInfo],
        transfers: list[TransferInfo],
    ) -> RiskFactor:
        """Evaluate the rule and return a risk factor."""
        pass


class BlacklistRule(BaseRule):
    """Check if address is in known blacklist."""

    name = "blacklist_check"
    description = "Known malicious address check"
    weight = 2.0

    # Sample blacklist - in production, load from database or external API
    BLACKLIST = {
        # Tornado Cash
        "0x8589427373d6d84e98730d7795d8f6f8731fda16",
        "0x722122df12d4e14e13ac3b6895a86e84145b6967",
        "0xdd4c48c0b24039969fc16d1cdf626eab821d3384",
        # Add more known malicious addresses
    }

    async def evaluate(
        self,
        address: str,
        address_info: Optional[AddressInfo],
        transfers: list[TransferInfo],
    ) -> RiskFactor:
        address_lower = address.lower()
        is_blacklisted = address_lower in self.BLACKLIST

        # Also check if any counterparty is blacklisted
        blacklisted_counterparties = 0
        for tx in transfers:
            counterparty = tx.to_address if tx.from_address.lower() == address_lower else tx.from_address
            if counterparty.lower() in self.BLACKLIST:
                blacklisted_counterparties += 1

        score = 0.0
        triggered = False
        description = "No blacklist matches found"

        if is_blacklisted:
            score = 1.0
            triggered = True
            description = "Address is on known blacklist"
        elif blacklisted_counterparties > 0:
            score = min(0.8, 0.3 * blacklisted_counterparties)
            triggered = True
            description = f"Interacted with {blacklisted_counterparties} blacklisted address(es)"

        return RiskFactor(
            name=self.name,
            score=score,
            weight=self.weight,
            description=description,
            triggered=triggered,
        )


class HighFrequencyRule(BaseRule):
    """Detect unusually high transaction frequency."""

    name = "high_frequency"
    description = "High transaction frequency detection"
    weight = 1.0

    # Thresholds
    HIGH_FREQ_THRESHOLD = 100  # transactions per day
    MEDIUM_FREQ_THRESHOLD = 50

    async def evaluate(
        self,
        address: str,
        address_info: Optional[AddressInfo],
        transfers: list[TransferInfo],
    ) -> RiskFactor:
        if not address_info or address_info.total_tx_count == 0:
            return RiskFactor(
                name=self.name,
                score=0.0,
                weight=self.weight,
                description="Insufficient transaction history",
                triggered=False,
            )

        # Calculate average daily transactions
        if address_info.first_seen and address_info.last_seen:
            days_active = max(1, (address_info.last_seen - address_info.first_seen).days)
            avg_daily_tx = address_info.total_tx_count / days_active
        else:
            avg_daily_tx = address_info.total_tx_count

        score = 0.0
        triggered = False
        description = f"Average {avg_daily_tx:.1f} transactions per day"

        if avg_daily_tx >= self.HIGH_FREQ_THRESHOLD:
            score = 0.7
            triggered = True
            description = f"Very high frequency: {avg_daily_tx:.1f} tx/day"
        elif avg_daily_tx >= self.MEDIUM_FREQ_THRESHOLD:
            score = 0.4
            triggered = True
            description = f"High frequency: {avg_daily_tx:.1f} tx/day"

        return RiskFactor(
            name=self.name,
            score=score,
            weight=self.weight,
            description=description,
            triggered=triggered,
        )


class LargeTransactionRule(BaseRule):
    """Detect large value transactions."""

    name = "large_transaction"
    description = "Large transaction detection"
    weight = 1.2

    # 10 ETH in wei
    LARGE_TX_THRESHOLD = 10 * 10**18
    # 100 ETH in wei
    VERY_LARGE_TX_THRESHOLD = 100 * 10**18

    async def evaluate(
        self,
        address: str,
        address_info: Optional[AddressInfo],
        transfers: list[TransferInfo],
    ) -> RiskFactor:
        if not transfers:
            return RiskFactor(
                name=self.name,
                score=0.0,
                weight=self.weight,
                description="No transfers to analyze",
                triggered=False,
            )

        large_tx_count = 0
        very_large_tx_count = 0
        max_value = 0

        for tx in transfers:
            try:
                value = int(tx.value)
                max_value = max(max_value, value)
                if value >= self.VERY_LARGE_TX_THRESHOLD:
                    very_large_tx_count += 1
                elif value >= self.LARGE_TX_THRESHOLD:
                    large_tx_count += 1
            except (ValueError, TypeError):
                continue

        score = 0.0
        triggered = False
        description = "No large transactions detected"

        if very_large_tx_count > 0:
            score = min(0.8, 0.3 + 0.1 * very_large_tx_count)
            triggered = True
            description = f"Found {very_large_tx_count} very large transaction(s) (>100 ETH)"
        elif large_tx_count > 0:
            score = min(0.5, 0.2 + 0.05 * large_tx_count)
            triggered = True
            description = f"Found {large_tx_count} large transaction(s) (>10 ETH)"

        return RiskFactor(
            name=self.name,
            score=score,
            weight=self.weight,
            description=description,
            triggered=triggered,
        )


class NewAddressRule(BaseRule):
    """Flag very new addresses with significant activity."""

    name = "new_address"
    description = "New address with high activity"
    weight = 0.8

    # Address younger than 7 days
    NEW_ADDRESS_DAYS = 7
    # High activity threshold for new address
    HIGH_ACTIVITY_THRESHOLD = 20

    async def evaluate(
        self,
        address: str,
        address_info: Optional[AddressInfo],
        transfers: list[TransferInfo],
    ) -> RiskFactor:
        if not address_info or not address_info.first_seen:
            return RiskFactor(
                name=self.name,
                score=0.0,
                weight=self.weight,
                description="Unable to determine address age",
                triggered=False,
            )

        from datetime import datetime, timezone

        now = datetime.now(timezone.utc)
        first_seen = address_info.first_seen
        if first_seen.tzinfo is None:
            from datetime import timezone
            first_seen = first_seen.replace(tzinfo=timezone.utc)

        age_days = (now - first_seen).days

        score = 0.0
        triggered = False
        description = f"Address is {age_days} days old"

        if age_days <= self.NEW_ADDRESS_DAYS:
            if address_info.total_tx_count >= self.HIGH_ACTIVITY_THRESHOLD:
                score = 0.5
                triggered = True
                description = f"New address ({age_days} days) with high activity ({address_info.total_tx_count} tx)"
            elif address_info.total_tx_count >= 10:
                score = 0.3
                triggered = True
                description = f"New address ({age_days} days) with moderate activity"

        return RiskFactor(
            name=self.name,
            score=score,
            weight=self.weight,
            description=description,
            triggered=triggered,
        )


class RoundAmountRule(BaseRule):
    """Detect suspiciously round transaction amounts."""

    name = "round_amounts"
    description = "Round transaction amount detection"
    weight = 0.6

    async def evaluate(
        self,
        address: str,
        address_info: Optional[AddressInfo],
        transfers: list[TransferInfo],
    ) -> RiskFactor:
        if not transfers:
            return RiskFactor(
                name=self.name,
                score=0.0,
                weight=self.weight,
                description="No transfers to analyze",
                triggered=False,
            )

        round_count = 0
        total_count = len(transfers)

        for tx in transfers:
            try:
                value = int(tx.value)
                # Check if value is a round number (divisible by 1 ETH)
                eth_value = value / 10**18
                if eth_value > 0 and eth_value == int(eth_value):
                    round_count += 1
            except (ValueError, TypeError):
                continue

        round_ratio = round_count / total_count if total_count > 0 else 0

        score = 0.0
        triggered = False
        description = f"{round_count}/{total_count} transactions have round amounts"

        # High ratio of round amounts is suspicious
        if round_ratio >= 0.8 and round_count >= 5:
            score = 0.5
            triggered = True
            description = f"Suspicious: {round_ratio:.0%} of transactions have round amounts"
        elif round_ratio >= 0.5 and round_count >= 3:
            score = 0.3
            triggered = True
            description = f"Notable: {round_ratio:.0%} of transactions have round amounts"

        return RiskFactor(
            name=self.name,
            score=score,
            weight=self.weight,
            description=description,
            triggered=triggered,
        )
