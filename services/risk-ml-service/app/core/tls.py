"""
TLS/mTLS Configuration for Risk ML Service
"""
import os
import ssl
from dataclasses import dataclass
from typing import Optional

from loguru import logger


@dataclass
class TLSConfig:
    """TLS configuration parameters."""
    enabled: bool = False
    cert_path: str = "/certs/cert.pem"
    key_path: str = "/certs/key.pem"
    ca_path: str = "/certs/ca.pem"
    mtls_mode: str = "required"  # "disabled", "optional", "required"
    min_version: str = "1.2"
    
    @classmethod
    def from_env(cls) -> "TLSConfig":
        """Load TLS configuration from environment variables."""
        return cls(
            enabled=os.getenv("TLS_ENABLED", "false").lower() == "true",
            cert_path=os.getenv("TLS_CERT_PATH", "/certs/cert.pem"),
            key_path=os.getenv("TLS_KEY_PATH", "/certs/key.pem"),
            ca_path=os.getenv("TLS_CA_PATH", "/certs/ca.pem"),
            mtls_mode=os.getenv("TLS_MTLS_MODE", "required"),
            min_version=os.getenv("TLS_MIN_VERSION", "1.2"),
        )


def get_min_version(version: str) -> int:
    """Convert version string to ssl constant."""
    versions = {
        "1.0": ssl.TLSVersion.TLSv1,
        "1.1": ssl.TLSVersion.TLSv1_1,
        "1.2": ssl.TLSVersion.TLSv1_2,
        "1.3": ssl.TLSVersion.TLSv1_3,
    }
    return versions.get(version, ssl.TLSVersion.TLSv1_2)


def create_ssl_context(config: TLSConfig) -> Optional[ssl.SSLContext]:
    """
    Create SSL context for server use with mTLS support.
    
    Args:
        config: TLS configuration
        
    Returns:
        SSL context configured for server use, or None if TLS is disabled
    """
    if not config.enabled:
        logger.info("TLS is disabled")
        return None
    
    # Validate cert files exist
    for path, name in [
        (config.cert_path, "certificate"),
        (config.key_path, "private key"),
        (config.ca_path, "CA certificate"),
    ]:
        if not os.path.isfile(path):
            raise FileNotFoundError(f"TLS {name} not found: {path}")
    
    # Create SSL context
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.minimum_version = get_min_version(config.min_version)
    
    # Load server certificate and key
    ctx.load_cert_chain(config.cert_path, config.key_path)
    logger.info(f"Loaded server certificate: {config.cert_path}")
    
    # Configure client authentication (mTLS)
    if config.mtls_mode != "disabled":
        ctx.load_verify_locations(config.ca_path)
        logger.info(f"Loaded CA certificate: {config.ca_path}")
        
        if config.mtls_mode == "required":
            ctx.verify_mode = ssl.CERT_REQUIRED
            logger.info("mTLS mode: REQUIRED (client certificate mandatory)")
        elif config.mtls_mode == "optional":
            ctx.verify_mode = ssl.CERT_OPTIONAL
            logger.info("mTLS mode: OPTIONAL (client certificate optional)")
    else:
        ctx.verify_mode = ssl.CERT_NONE
        logger.info("mTLS mode: DISABLED")
    
    # Set secure cipher suites
    ctx.set_ciphers(
        "ECDHE+AESGCM:DHE+AESGCM:ECDHE+CHACHA20:DHE+CHACHA20"
    )
    
    logger.info(f"TLS context created with min version: TLS {config.min_version}")
    return ctx


def create_client_ssl_context(config: TLSConfig) -> Optional[ssl.SSLContext]:
    """
    Create SSL context for client use (outgoing connections).
    
    Args:
        config: TLS configuration
        
    Returns:
        SSL context configured for client use
    """
    if not config.enabled:
        return None
    
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.minimum_version = get_min_version(config.min_version)
    
    # Load CA for server verification
    if os.path.isfile(config.ca_path):
        ctx.load_verify_locations(config.ca_path)
    
    # Load client certificate for mTLS
    if os.path.isfile(config.cert_path) and os.path.isfile(config.key_path):
        ctx.load_cert_chain(config.cert_path, config.key_path)
        logger.info("Client certificate loaded for mTLS")
    
    ctx.verify_mode = ssl.CERT_REQUIRED
    ctx.check_hostname = True
    
    return ctx
