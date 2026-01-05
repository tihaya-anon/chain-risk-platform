"""Logging configuration for ML training pipeline."""

import logging
import sys
from pathlib import Path
from datetime import datetime


def setup_logging(
    name: str = "ml-training",
    level: str = "INFO",
    log_dir: str = "logs",
) -> logging.Logger:
    """Configure logging with console and file handlers.
    
    Args:
        name: Logger name
        level: Log level (DEBUG, INFO, WARNING, ERROR)
        log_dir: Directory for log files
    
    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    
    # Avoid duplicate handlers
    if logger.handlers:
        return logger
    
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))
    
    # Log format
    fmt = "%(asctime)s [%(levelname)s] %(name)s - %(message)s"
    date_fmt = "%Y-%m-%d %H:%M:%S"
    formatter = logging.Formatter(fmt, datefmt=date_fmt)
    
    # Console handler
    console = logging.StreamHandler(sys.stdout)
    console.setLevel(logging.INFO)
    console.setFormatter(formatter)
    logger.addHandler(console)
    
    # File handler
    log_path = Path(log_dir)
    log_path.mkdir(parents=True, exist_ok=True)
    
    date_str = datetime.now().strftime("%Y%m%d")
    file_handler = logging.FileHandler(
        log_path / f"{name}_{date_str}.log",
        encoding="utf-8",
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    
    return logger


def get_logger(name: str) -> logging.Logger:
    """Get or create a child logger.
    
    Args:
        name: Logger name (will be prefixed with 'ml-training.')
    
    Returns:
        Logger instance
    """
    return logging.getLogger(f"ml-training.{name}")
