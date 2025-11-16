"""Circuit Breaker implementation for fault tolerance"""

import time
from enum import Enum
from typing import Callable, Any, Optional
from app.core.logger import logger


class CircuitState(str, Enum):
    """Circuit breaker states"""
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Circuit tripped, failing fast
    HALF_OPEN = "half_open"  # Testing if service recovered


class CircuitBreakerError(Exception):
    """Raised when circuit is open"""
    pass


class CircuitBreaker:
    """
    Circuit Breaker pattern implementation
    
    Prevents cascading failures by temporarily disabling failing operations.
    States:
    - CLOSED: Normal operation, requests pass through
    - OPEN: Too many failures, requests fail immediately
    - HALF_OPEN: Testing if service recovered
    """
    
    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        timeout: int = 60,
        recovery_timeout: int = 30
    ):
        """
        Initialize circuit breaker
        
        Args:
            name: Identifier for this circuit breaker
            failure_threshold: Number of failures before opening circuit
            timeout: Seconds to wait before attempting recovery (OPEN -> HALF_OPEN)
            recovery_timeout: Seconds in HALF_OPEN before testing recovery
        """
        self.name = name
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.recovery_timeout = recovery_timeout
        
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.last_failure_time: Optional[float] = None
        self.last_success_time: Optional[float] = None
        
        logger.info(f"Circuit breaker '{name}' initialized: threshold={failure_threshold}, timeout={timeout}s")
    
    async def call(self, func: Callable, *args, **kwargs) -> Any:
        """
        Execute function with circuit breaker protection
        
        Args:
            func: Async function to execute
            *args, **kwargs: Function arguments
            
        Returns:
            Function result
            
        Raises:
            CircuitBreakerError: If circuit is open
            Exception: Original exception if function fails
        """
        # Check if circuit should transition from OPEN to HALF_OPEN
        if self.state == CircuitState.OPEN:
            if self._should_attempt_reset():
                logger.info(f"Circuit breaker '{self.name}' transitioning to HALF_OPEN (testing recovery)")
                self.state = CircuitState.HALF_OPEN
            else:
                raise CircuitBreakerError(
                    f"Circuit breaker '{self.name}' is OPEN. "
                    f"Service unavailable. Retry after {self._time_until_retry():.0f}s"
                )
        
        try:
            # Execute the function
            result = await func(*args, **kwargs)
            
            # Success - reset failure count
            self._on_success()
            return result
            
        except Exception as e:
            # Failure - increment counter and possibly open circuit
            self._on_failure()
            raise e
    
    def _on_success(self):
        """Handle successful call"""
        self.last_success_time = time.time()
        
        if self.state == CircuitState.HALF_OPEN:
            logger.info(f"Circuit breaker '{self.name}' recovered: HALF_OPEN -> CLOSED")
            self.state = CircuitState.CLOSED
            self.failure_count = 0
        elif self.state == CircuitState.CLOSED:
            # Reset failure count on success
            if self.failure_count > 0:
                logger.info(f"Circuit breaker '{self.name}' reset failure count after success")
                self.failure_count = 0
    
    def _on_failure(self):
        """Handle failed call"""
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        logger.warning(
            f"Circuit breaker '{self.name}' failure {self.failure_count}/{self.failure_threshold}"
        )
        
        # Check if should open circuit
        if self.failure_count >= self.failure_threshold:
            if self.state != CircuitState.OPEN:
                logger.error(
                    f"Circuit breaker '{self.name}' OPENED after {self.failure_count} failures. "
                    f"Failing fast for {self.timeout}s"
                )
                self.state = CircuitState.OPEN
    
    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to attempt recovery"""
        if self.last_failure_time is None:
            return True
        return (time.time() - self.last_failure_time) >= self.timeout
    
    def _time_until_retry(self) -> float:
        """Calculate seconds until circuit can be tested again"""
        if self.last_failure_time is None:
            return 0
        elapsed = time.time() - self.last_failure_time
        return max(0, self.timeout - elapsed)
    
    def get_state(self) -> dict:
        """Get current circuit breaker state for monitoring"""
        return {
            "name": self.name,
            "state": self.state.value,
            "failure_count": self.failure_count,
            "failure_threshold": self.failure_threshold,
            "last_failure_time": self.last_failure_time,
            "last_success_time": self.last_success_time,
            "time_until_retry": self._time_until_retry() if self.state == CircuitState.OPEN else None
        }
    
    def reset(self):
        """Manually reset circuit breaker (for testing/admin)"""
        logger.info(f"Circuit breaker '{self.name}' manually reset")
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.last_failure_time = None
