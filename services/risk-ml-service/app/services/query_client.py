from typing import Optional
from datetime import datetime
import httpx
from app.core.config import get_config
from app.core.logging import get_logger
from app.models.risk import AddressInfo, TransferInfo

logger = get_logger(__name__)


class QueryServiceClient:
    """Client for communicating with Query Service."""

    def __init__(self):
        self.config = get_config()
        self.base_url = self.config.query_service.url
        self.timeout = httpx.Timeout(float(self.config.query_service.timeout), connect=5.0)

    async def get_address_info(
        self, address: str, network: str = "ethereum"
    ) -> Optional[AddressInfo]:
        """Get address information from Query Service."""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/api/v1/addresses/{address}",
                    params={"network": network},
                )

                if response.status_code == 404:
                    logger.debug("Address not found", address=address)
                    return None

                response.raise_for_status()
                data = response.json()

                if not data.get("success"):
                    logger.warning("Query service returned error", response=data)
                    return None

                addr_data = data.get("data", {})
                return AddressInfo(
                    address=addr_data.get("address", address),
                    network=addr_data.get("network", network),
                    first_seen=self._parse_datetime(addr_data.get("firstSeen")),
                    last_seen=self._parse_datetime(addr_data.get("lastSeen")),
                    total_tx_count=addr_data.get("totalTxCount", 0),
                    sent_tx_count=addr_data.get("sentTxCount", 0),
                    received_tx_count=addr_data.get("receivedTxCount", 0),
                    unique_interacted=addr_data.get("uniqueInteracted", 0),
                )

        except httpx.HTTPStatusError as e:
            logger.error(
                "HTTP error from Query Service",
                status_code=e.response.status_code,
                address=address,
            )
            return None
        except Exception as e:
            logger.error(
                "Failed to get address info",
                address=address,
                error=str(e),
            )
            return None

    async def get_address_transfers(
        self,
        address: str,
        network: str = "ethereum",
        page: int = 1,
        page_size: int = 100,
    ) -> list[TransferInfo]:
        """Get recent transfers for an address."""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/api/v1/addresses/{address}/transfers",
                    params={
                        "network": network,
                        "page": page,
                        "pageSize": page_size,
                    },
                )

                response.raise_for_status()
                data = response.json()

                if not data.get("success"):
                    logger.warning("Query service returned error", response=data)
                    return []

                transfers_data = data.get("data", [])
                transfers = []

                for tx in transfers_data:
                    try:
                        transfers.append(
                            TransferInfo(
                                id=tx.get("id", 0),
                                tx_hash=tx.get("txHash", ""),
                                block_number=tx.get("blockNumber", 0),
                                from_address=tx.get("fromAddress", ""),
                                to_address=tx.get("toAddress", ""),
                                value=tx.get("value", "0"),
                                timestamp=self._parse_datetime(tx.get("timestamp")) or datetime.utcnow(),
                                transfer_type=tx.get("transferType", "native"),
                                network=tx.get("network", network),
                            )
                        )
                    except Exception as e:
                        logger.warning("Failed to parse transfer", error=str(e), tx=tx)
                        continue

                return transfers

        except httpx.HTTPStatusError as e:
            logger.error(
                "HTTP error from Query Service",
                status_code=e.response.status_code,
                address=address,
            )
            return []
        except Exception as e:
            logger.error(
                "Failed to get address transfers",
                address=address,
                error=str(e),
            )
            return []

    def _parse_datetime(self, value: Optional[str]) -> Optional[datetime]:
        """Parse datetime string from API response."""
        if not value:
            return None
        try:
            # Handle RFC3339 format
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            return None
