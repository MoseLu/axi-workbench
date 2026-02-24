"""
Performance monitoring and error tracking module for Mini-Agent Desktop.
"""

import time
import psutil
import logging
from typing import Dict, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime
import threading

logger = logging.getLogger(__name__)


@dataclass
class PerformanceMetrics:
    """Performance metrics snapshot"""
    timestamp: str
    cpu_percent: float
    memory_mb: float
    memory_percent: float
    active_sessions: int
    total_requests: int
    avg_response_time_ms: float


@dataclass
class ErrorRecord:
    """Error record for tracking"""
    timestamp: str
    error_type: str
    message: str
    stack_trace: Optional[str]
    session_id: Optional[str]


class PerformanceMonitor:
    """Monitor system and application performance"""
    
    def __init__(self):
        self._start_time = time.time()
        self._request_count = 0
        self._response_times: list = []
        self._lock = threading.Lock()
        self._errors: list = []
    
    def record_request(self, response_time_ms: float):
        """Record a request and its response time"""
        with self._lock:
            self._request_count += 1
            self._response_times.append(response_time_ms)
            # Keep only last 1000 response times
            if len(self._response_times) > 1000:
                self._response_times = self._response_times[-1000:]
    
    def record_error(self, error_type: str, message: str, 
                     stack_trace: Optional[str] = None,
                     session_id: Optional[str] = None):
        """Record an error occurrence"""
        with self._lock:
            self._errors.append(ErrorRecord(
                timestamp=datetime.now().isoformat(),
                error_type=error_type,
                message=message,
                stack_trace=stack_trace,
                session_id=session_id
            ))
            # Keep only last 100 errors
            if len(self._errors) > 100:
                self._errors = self._errors[-100:]
    
    def get_metrics(self, active_sessions: int = 0) -> PerformanceMetrics:
        """Get current performance metrics"""
        with self._lock:
            process = psutil.Process()
            memory_info = process.memory_info()
            
            avg_response = 0.0
            if self._response_times:
                avg_response = sum(self._response_times) / len(self._response_times)
            
            return PerformanceMetrics(
                timestamp=datetime.now().isoformat(),
                cpu_percent=process.cpu_percent(interval=0.1),
                memory_mb=memory_info.rss / 1024 / 1024,
                memory_percent=process.memory_percent(),
                active_sessions=active_sessions,
                total_requests=self._request_count,
                avg_response_time_ms=avg_response
            )
    
    def get_errors(self, limit: int = 20) -> list:
        """Get recent errors"""
        with self._lock:
            return [asdict(e) for e in self._errors[-limit:]]
    
    def get_uptime(self) -> float:
        """Get application uptime in seconds"""
        return time.time() - self._start_time
    
    def reset_stats(self):
        """Reset statistics (for testing)"""
        with self._lock:
            self._request_count = 0
            self._response_times.clear()
            self._errors.clear()


# Global performance monitor instance
performance_monitor = PerformanceMonitor()


def record_request_time(func):
    """Decorator to record request response time"""
    def wrapper(*args, **kwargs):
        start = time.time()
        try:
            result = func(*args, **kwargs)
            return result
        finally:
            elapsed_ms = (time.time() - start) * 1000
            performance_monitor.record_request(elapsed_ms)
    return wrapper


def setup_error_handlers(app):
    """Setup global error handlers for FastAPI app"""
    from fastapi import Request, HTTPException
    from fastapi.responses import JSONResponse
    
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        performance_monitor.record_error(
            error_type="HTTPException",
            message=str(exc.detail),
            session_id=request.headers.get("X-Session-ID")
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.detail}
        )
    
    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        import traceback
        performance_monitor.record_error(
            error_type=type(exc).__name__,
            message=str(exc),
            stack_trace=traceback.format_exc(),
            session_id=request.headers.get("X-Session-ID")
        )
        logger.exception("Unhandled exception")
        return JSONResponse(
            status_code=500,
            content={"error": "Internal server error"}
        )
    
    return app
