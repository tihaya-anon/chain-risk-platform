"""Nacos client for service discovery and configuration."""
import os
import asyncio
from typing import Optional, Callable, Any
import yaml
from loguru import logger

try:
    import nacos
    NACOS_AVAILABLE = True
except ImportError:
    NACOS_AVAILABLE = False
    logger.warning("nacos-sdk-python not installed, Nacos integration disabled")


class PipelineConfig:
    """Pipeline configuration from Nacos."""
    
    def __init__(self, data: dict = None):
        data = data or {}
        pipeline = data.get("pipeline", {})
        risk = data.get("risk", {})
        
        self.pipeline_enabled = pipeline.get("enabled", True)
        self.ingestion_enabled = pipeline.get("ingestion", {}).get("enabled", True)
        self.graph_sync_enabled = pipeline.get("graph-sync", {}).get("enabled", True)
        
        self.high_threshold = risk.get("highThreshold", 0.7)
        self.medium_threshold = risk.get("mediumThreshold", 0.4)
        self.cache_ttl_seconds = risk.get("cacheTtlSeconds", 300)


class NacosClient:
    """Nacos client wrapper for Python services."""
    
    def __init__(self):
        self.enabled = False
        self.client: Optional[Any] = None
        self.config: Optional[PipelineConfig] = None
        self.service_name = "risk-ml-service"
        self.service_ip = os.getenv("SERVICE_IP", "127.0.0.1")
        self.service_port = int(os.getenv("RISK_SERVICE_PORT", "8082"))
        self._config_listeners: list[Callable[[PipelineConfig], None]] = []
        
    async def init(self) -> bool:
        """Initialize Nacos client."""
        nacos_server = os.getenv("NACOS_SERVER", "")
        if not nacos_server:
            logger.info("NACOS_SERVER not set, running without Nacos integration")
            return False
            
        if not NACOS_AVAILABLE:
            logger.warning("nacos-sdk-python not available")
            return False
            
        try:
            # Parse server address
            if ":" in nacos_server:
                host, port_str = nacos_server.split(":")
                port = int(port_str)
            else:
                host = nacos_server
                port = 18848
            
            server_addr = f"{host}:{port}"
            namespace = os.getenv("NACOS_NAMESPACE", "")
            username = os.getenv("NACOS_USERNAME", "")
            password = os.getenv("NACOS_PASSWORD", "")
            
            # Create Nacos client
            self.client = nacos.NacosClient(
                server_addr,
                namespace=namespace,
                username=username if username else None,
                password=password if password else None,
            )
            
            # Register service
            self.client.add_naming_instance(
                self.service_name,
                self.service_ip,
                self.service_port,
                metadata={"version": "0.1.0", "type": "ml-service"},
            )
            logger.info(
                f"Service registered with Nacos: {self.service_name} "
                f"at {self.service_ip}:{self.service_port}"
            )
            
            # Load initial config
            await self._load_config()
            
            # Start config watcher in background
            asyncio.create_task(self._watch_config())
            
            self.enabled = True
            logger.info("Nacos client initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize Nacos client: {e}")
            return False
    
    async def _load_config(self):
        """Load configuration from Nacos."""
        if not self.client:
            return
            
        try:
            content = self.client.get_config(
                "chain-risk-pipeline.yaml",
                "DEFAULT_GROUP",
            )
            if content:
                self._parse_config(content)
        except Exception as e:
            logger.warning(f"Failed to load config from Nacos: {e}")
    
    def _parse_config(self, content: str):
        """Parse YAML configuration."""
        try:
            data = yaml.safe_load(content)
            self.config = PipelineConfig(data)
            logger.info(
                f"Configuration updated from Nacos: "
                f"pipeline_enabled={self.config.pipeline_enabled}, "
                f"cache_ttl={self.config.cache_ttl_seconds}"
            )
            
            # Notify listeners
            for listener in self._config_listeners:
                try:
                    listener(self.config)
                except Exception as e:
                    logger.error(f"Config listener error: {e}")
                    
        except Exception as e:
            logger.error(f"Failed to parse Nacos config: {e}")
    
    async def _watch_config(self):
        """Watch for configuration changes."""
        if not self.client:
            return
            
        def on_change(args):
            content = args.get("content", "")
            if content:
                self._parse_config(content)
        
        try:
            self.client.add_config_watcher(
                "chain-risk-pipeline.yaml",
                "DEFAULT_GROUP",
                on_change,
            )
        except Exception as e:
            logger.error(f"Failed to watch config: {e}")
    
    def on_config_change(self, listener: Callable[[PipelineConfig], None]):
        """Register a config change listener."""
        self._config_listeners.append(listener)
    
    async def close(self):
        """Close Nacos client and deregister service."""
        if not self.client:
            return
            
        try:
            self.client.remove_naming_instance(
                self.service_name,
                self.service_ip,
                self.service_port,
            )
            logger.info("Service deregistered from Nacos")
        except Exception as e:
            logger.error(f"Failed to deregister from Nacos: {e}")
    
    def get_config(self) -> Optional[PipelineConfig]:
        """Get current configuration."""
        return self.config
    
    def get_cache_ttl(self) -> int:
        """Get cache TTL from config."""
        if self.config:
            return self.config.cache_ttl_seconds
        return 300
    
    def get_risk_thresholds(self) -> tuple[float, float]:
        """Get risk thresholds (high, medium)."""
        if self.config:
            return self.config.high_threshold, self.config.medium_threshold
        return 0.7, 0.4
    
    def get_status(self) -> dict:
        """Get Nacos status."""
        return {
            "service": self.service_name,
            "nacos": self.enabled,
            "config": {
                "pipelineEnabled": self.config.pipeline_enabled if self.config else None,
                "cacheTtlSeconds": self.config.cache_ttl_seconds if self.config else None,
                "highThreshold": self.config.high_threshold if self.config else None,
                "mediumThreshold": self.config.medium_threshold if self.config else None,
            } if self.config else None,
        }


# Global instance
_nacos_client: Optional[NacosClient] = None


def get_nacos_client() -> NacosClient:
    """Get global Nacos client instance."""
    global _nacos_client
    if _nacos_client is None:
        _nacos_client = NacosClient()
    return _nacos_client
