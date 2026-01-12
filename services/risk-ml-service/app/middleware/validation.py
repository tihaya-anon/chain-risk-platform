"""
Input validation middleware and utilities for Risk ML Service
"""
import re
from typing import Optional

from fastapi import HTTPException, Request
from pydantic import BaseModel, field_validator

from app.core.logging import get_logger

logger = get_logger(__name__)

# Validation patterns
ETH_ADDRESS_PATTERN = re.compile(r"^0x[a-fA-F0-9]{40}$")

SQL_INJECTION_PATTERNS = [
    "--", ";--", "/*", "*/", "@@",
    "alter ", "create ", "delete ", "drop ",
    "exec(", "execute(", "insert ", "select ",
    "update ", "union ", "xp_",
]

# Request size limits
MAX_BODY_SIZE = 512 * 1024  # 512KB
MAX_URL_LENGTH = 2048


class ValidationError(HTTPException):
    """Exception raised for validation errors"""
    def __init__(self, detail: str):
        super().__init__(status_code=400, detail=detail)


def validate_eth_address(address: str) -> bool:
    """
    Validate Ethereum address format.
    
    Args:
        address: Address to validate
        
    Returns:
        True if valid, False otherwise
    """
    if not address:
        return False
    return bool(ETH_ADDRESS_PATTERN.match(address))


def check_sql_injection(input_str: str) -> bool:
    """
    Check for SQL injection patterns.
    
    Args:
        input_str: Input string to check
        
    Returns:
        True if SQL injection detected, False otherwise
    """
    if not input_str:
        return False
    
    lower_input = input_str.lower()
    for pattern in SQL_INJECTION_PATTERNS:
        if pattern in lower_input:
            logger.warning("Potential SQL injection detected", pattern=pattern)
            return True
    return False


def sanitize_string(input_str: str) -> str:
    """
    Sanitize input string by removing dangerous characters.
    
    Args:
        input_str: String to sanitize
        
    Returns:
        Sanitized string
    """
    if not input_str:
        return ""
    
    # Remove null bytes
    result = input_str.replace("\x00", "")
    # Trim whitespace
    return result.strip()


class AddressRequest(BaseModel):
    """Request model for address-based operations"""
    address: str
    
    @field_validator("address")
    @classmethod
    def validate_address(cls, v: str) -> str:
        v = sanitize_string(v)
        if check_sql_injection(v):
            raise ValueError("Invalid characters in address")
        if not validate_eth_address(v):
            raise ValueError("Invalid Ethereum address format")
        return v.lower()


class BatchAddressRequest(BaseModel):
    """Request model for batch address operations"""
    addresses: list[str]
    
    @field_validator("addresses")
    @classmethod
    def validate_addresses(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("At least one address is required")
        if len(v) > 100:
            raise ValueError("Maximum 100 addresses per batch")
        
        validated = []
        for addr in v:
            addr = sanitize_string(addr)
            if check_sql_injection(addr):
                raise ValueError(f"Invalid characters in address: {addr[:10]}...")
            if not validate_eth_address(addr):
                raise ValueError(f"Invalid Ethereum address: {addr}")
            validated.append(addr.lower())
        return validated


def validate_request_size(request: Request) -> None:
    """
    Validate request size limits.
    
    Args:
        request: FastAPI request object
        
    Raises:
        HTTPException: If request exceeds size limits
    """
    # Check URL length
    url_length = len(str(request.url))
    if url_length > MAX_URL_LENGTH:
        raise HTTPException(
            status_code=414,
            detail="Request URL too long",
        )
    
    # Check content length
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_BODY_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Request body too large",
        )


async def validation_middleware(request: Request, call_next):
    """
    Middleware for request validation.
    
    Validates request size and basic security checks.
    """
    try:
        validate_request_size(request)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Validation error", error=str(e))
        raise HTTPException(status_code=400, detail="Invalid request")
    
    return await call_next(request)


def validate_address_param(address: str) -> str:
    """
    Validate and sanitize an address parameter.
    
    Args:
        address: Address to validate
        
    Returns:
        Validated and lowercased address
        
    Raises:
        ValidationError: If address is invalid
    """
    address = sanitize_string(address)
    
    if check_sql_injection(address):
        raise ValidationError("Invalid characters in address")
    
    if not validate_eth_address(address):
        raise ValidationError(
            "Invalid Ethereum address format. "
            "Must be 0x followed by 40 hex characters."
        )
    
    return address.lower()
