"""Logging configuration with trace correlation support."""

import sys
from pathlib import Path
from typing import Any

from loguru import logger
from opentelemetry import trace

from app.core.config import get_config

_logging_configured = False


def _get_trace_context() -> dict[str, str]:
    """Extract trace context from current span for log correlation."""
    span = trace.get_current_span()
    ctx = span.get_span_context()
    
    if ctx.is_valid:
        return {
            "trace_id": format(ctx.trace_id, "032x"),
            "span_id": format(ctx.span_id, "016x"),
        }
    return {"trace_id": "", "span_id": ""}


def _format_record(record: dict[str, Any]) -> str:
    """Format log record with trace context for JSON output."""
    trace_ctx = _get_trace_context()
    record["extra"]["trace_id"] = trace_ctx["trace_id"]
    record["extra"]["span_id"] = trace_ctx["span_id"]
    
    # JSON format template
    return (
        '{{"timestamp":"{time:YYYY-MM-DDTHH:mm:ss.SSSZ}",'
        '"level":"{level}",'
        '"service":"risk-ml-service",'
        '"message":"{message}",'
        '"trace_id":"{extra[trace_id]}",'
        '"span_id":"{extra[span_id]}",'
        '"logger":"{name}",'
        '"function":"{function}",'
        '"line":{line}}}\n'
    )


def _format_console(record: dict[str, Any]) -> str:
    """Format log record with trace context for console output."""
    trace_ctx = _get_trace_context()
    record["extra"]["trace_id"] = trace_ctx["trace_id"]
    record["extra"]["span_id"] = trace_ctx["span_id"]
    
    trace_part = ""
    if trace_ctx["trace_id"]:
        trace_part = f" [trace_id={trace_ctx['trace_id'][:16]}...]"
    
    return (
        "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
        "<level>{level: <8}</level> | "
        "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan>"
        f"{trace_part} | "
        "<level>{message}</level>\n"
    )


def setup_logging() -> None:
    """Configure logging with loguru and trace correlation."""
    global _logging_configured
    if _logging_configured:
        return

    config = get_config()
    log_config = config.logging

    # Remove default handler
    logger.remove()

    # Determine format based on config
    use_json = log_config.format == "json"

    # Add handlers based on output_paths
    for output_path in log_config.output_paths:
        if output_path == "stdout":
            if use_json:
                logger.add(
                    sys.stdout,
                    format=_format_record,
                    level=log_config.level,
                    colorize=False,
                )
            else:
                logger.add(
                    sys.stdout,
                    format=_format_console,
                    level=log_config.level,
                    colorize=True,
                )
        elif output_path == "stderr":
            if use_json:
                logger.add(
                    sys.stderr,
                    format=_format_record,
                    level=log_config.level,
                    colorize=False,
                )
            else:
                logger.add(
                    sys.stderr,
                    format=_format_console,
                    level=log_config.level,
                    colorize=True,
                )
        else:
            # File output - always use JSON for files
            log_file = Path(output_path)
            log_file.parent.mkdir(parents=True, exist_ok=True)
            
            logger.add(
                output_path,
                format=_format_record,
                level=log_config.level,
                rotation="100 MB",
                retention="7 days",
                compression="gz",
                encoding="utf-8",
            )

    _logging_configured = True
    logger.info(
        "Logging configured with trace correlation",
        level=log_config.level,
        format=log_config.format,
        outputs=log_config.output_paths,
    )


def get_logger(name: str = __name__):
    """Get a logger instance with context binding."""
    return logger.bind(name=name)
