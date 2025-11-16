"""Health check and monitoring endpoints"""

from datetime import datetime

from fastapi import APIRouter, HTTPException, Request

from app.core.config import settings
from app.schemas.email_schema import ApiResponse, HealthCheckResponse
from app.services.email_sender import EmailSender
from app.services.redis_service import RedisService


router = APIRouter()


def _get_services(request: Request) -> tuple[RedisService, EmailSender]:
    redis_service = getattr(request.app.state, "redis_service", None)
    email_sender = getattr(request.app.state, "email_sender", None)

    if redis_service is None or email_sender is None:
        raise HTTPException(status_code=503, detail="Email service is initializing")

    return redis_service, email_sender


@router.get("/health", response_model=HealthCheckResponse)
async def health_check(request: Request):
    """
    Health check endpoint
    
    Checks:
    - Service status
    - Redis connectivity
    - Circuit breaker states
    """
    redis, email_sender = _get_services(request)
    checks = {}
    
    # Check Redis
    try:
        redis_ok = await redis.health_check()
        checks["redis"] = "ok" if redis_ok else "degraded"
    except Exception:
        checks["redis"] = "error"
    
    # Check circuit breakers
    circuit_states = email_sender.get_circuit_states()
    checks["resend_circuit"] = circuit_states["resend"]["state"]
    checks["template_circuit"] = circuit_states["template_service"]["state"]
    
    # Overall status
    status = "healthy" if all(
        v in ["ok", "closed", "degraded"] for v in checks.values()
    ) else "unhealthy"
    
    return HealthCheckResponse(
        status=status,
        service="email_service",
        version=settings.app_version,
        timestamp=datetime.utcnow(),
        checks=checks
    )


@router.get("/status/{notification_id}", response_model=ApiResponse)
async def get_notification_status(notification_id: str, request: Request):
    """
    Get notification status by ID
    
    Args:
        notification_id: Notification UUID
    """
    redis, _ = _get_services(request)
    status_data = await redis.get_notification_status(notification_id)
    
    if status_data:
        return ApiResponse(
            success=True,
            data=status_data,
            message="Status retrieved successfully",
            error=None
        )
    else:
        return ApiResponse(
            success=False,
            data=None,
            message="Status not found",
            error="Notification status not found in cache"
        )


@router.get("/circuits", response_model=ApiResponse)
async def get_circuit_breaker_status(request: Request):
    """Get circuit breaker states for monitoring"""
    _, email_sender = _get_services(request)
    circuit_states = email_sender.get_circuit_states()
    
    return ApiResponse(
        success=True,
        data=circuit_states,
        message="Circuit breaker states retrieved",
        error=None
    )
