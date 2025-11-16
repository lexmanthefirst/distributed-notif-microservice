"""Structured logging with correlation ID support"""

import logging
import sys
from typing import Optional
from contextvars import ContextVar

# Context variable for correlation ID (for distributed tracing)
correlation_id_context: ContextVar[Optional[str]] = ContextVar('correlation_id', default=None)


class CorrelationIdFilter(logging.Filter):
    """Add correlation ID to log records"""
    
    def filter(self, record):
        record.correlation_id = correlation_id_context.get() or "N/A"
        return True


def setup_logging(level: str = "INFO") -> logging.Logger:
    """Configure structured logging with correlation ID"""
    
    # Create logger
    logger = logging.getLogger("email_service")
    logger.setLevel(getattr(logging, level.upper()))
    
    # Remove existing handlers
    logger.handlers.clear()
    
    # Create console handler
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(getattr(logging, level.upper()))
    
    # Create formatter
    formatter = logging.Formatter(
        '{"timestamp": "%(asctime)s", "level": "%(levelname)s", "correlation_id": "%(correlation_id)s", '
        '"service": "email_service", "message": "%(message)s", "module": "%(module)s", "function": "%(funcName)s"}'
    )
    handler.setFormatter(formatter)
    
    # Add filter for correlation ID
    handler.addFilter(CorrelationIdFilter())
    
    # Add handler to logger
    logger.addHandler(handler)
    
    return logger


# Global logger instance
logger = setup_logging()


def set_correlation_id(correlation_id: str):
    """Set correlation ID for current context"""
    correlation_id_context.set(correlation_id)


def get_correlation_id() -> Optional[str]:
    """Get correlation ID from current context"""
    return correlation_id_context.get()
