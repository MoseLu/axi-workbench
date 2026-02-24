"""
Logging configuration for Mini-Agent Desktop
"""

import logging
import sys
from pathlib import Path
from datetime import datetime
from logging.handlers import RotatingFileHandler

# Log directory
LOG_DIR = Path.home() / ".mini-agent" / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

# Log file path
LOG_FILE = LOG_DIR / f"mini-agent-{datetime.now().strftime('%Y%m%d')}.log"

# Log format
LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def setup_logger(name: str = "mini-agent", level: int = logging.INFO) -> logging.Logger:
    """Setup and return a configured logger."""
    
    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    # Avoid duplicate handlers
    if logger.handlers:
        return logger
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_formatter = logging.Formatter(LOG_FORMAT, DATE_FORMAT)
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)
    
    # File handler with rotation (10MB max, 5 files kept)
    file_handler = RotatingFileHandler(
        LOG_FILE,
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5,
        encoding="utf-8"
    )
    file_handler.setLevel(level)
    file_formatter = logging.Formatter(LOG_FORMAT, DATE_FORMAT)
    file_handler.setFormatter(file_formatter)
    logger.addHandler(file_handler)
    
    return logger


# Default logger
logger = setup_logger()


class LoggerMixin:
    """Mixin class to add logging capability to any class."""
    
    @property
    def logger(self) -> logging.Logger:
        """Get logger for this class."""
        name = f"mini-agent.{self.__class__.__module__}.{self.__class__.__name__}"
        return logging.getLogger(name)


def log_request(request, logger: logging.Logger = None):
    """Log incoming HTTP request."""
    if logger is None:
        logger = logging.getLogger("mini-agent")
    
    logger.info(
        f"Request: {request.method} {request.url.path} "
        f"from {request.client.host if request.client else 'unknown'}"
    )


def log_response(request, response, duration_ms: float, logger: logging.Logger = None):
    """Log outgoing HTTP response."""
    if logger is None:
        logger = logging.getLogger("mini-agent")
    
    logger.info(
        f"Response: {request.method} {request.url.path} "
        f"status={response.status_code} duration={duration_ms:.2f}ms"
    )
