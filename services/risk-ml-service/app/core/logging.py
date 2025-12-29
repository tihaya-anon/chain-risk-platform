import sys
from pathlib import Path
from loguru import logger

from app.core.config import get_config

_logging_configured = False


def setup_logging() -> None:
    """Configure logging with loguru."""
    global _logging_configured
    if _logging_configured:
        return

    config = get_config()
    log_config = config.logging

    # Remove default handler
    logger.remove()

    # Determine format
    if log_config.format == "json":
        # JSON format for production
        log_format = "{message}"
        serialize = True
    else:
        # Console format for development
        log_format = (
            "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
            "<level>{level: <8}</level> | "
            "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
            "<level>{message}</level>"
        )
        serialize = False

    # Add handlers based on output_paths
    for output_path in log_config.output_paths:
        if output_path == "stdout":
            # Console output
            logger.add(
                sys.stdout,
                format=log_format,
                level=log_config.level,
                serialize=serialize,
                colorize=not serialize,
            )
        elif output_path == "stderr":
            # Stderr output
            logger.add(
                sys.stderr,
                format=log_format,
                level=log_config.level,
                serialize=serialize,
                colorize=not serialize,
            )
        else:
            # File output
            log_file = Path(output_path)
            
            # Create directory if not exists
            log_file.parent.mkdir(parents=True, exist_ok=True)
            
            # Determine if JSON file based on extension
            file_serialize = serialize or output_path.endswith(".json")
            
            logger.add(
                output_path,
                format=log_format if not file_serialize else "{message}",
                level=log_config.level,
                serialize=file_serialize,
                rotation="100 MB",
                retention="7 days",
                compression="gz",
                encoding="utf-8",
            )

    _logging_configured = True
    logger.info(
        "Logging configured",
        level=log_config.level,
        format=log_config.format,
        outputs=log_config.output_paths,
    )


def get_logger(name: str = __name__):
    """Get a logger instance with context binding."""
    return logger.bind(name=name)
