"""Pydantic schemas for push service"""

from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field


class NotificationStatus(str, Enum):
    """Notification status enum"""
    delivered = "delivered"
    pending = "pending"
    failed = "failed"


class PushMessage(BaseModel):
    """Push message from queue (snake_case as per requirements)"""
    notification_id: str = Field(..., description="Unique notification identifier")
    user_id: str = Field(..., description="User UUID")
    push_token: str = Field(..., description="FCM/APNS device token")
    template_code: str = Field(..., description="Template identifier")
    variables: Dict[str, Any] = Field(default_factory=dict, description="Template variables")
    priority: int = Field(default=1, ge=1, le=10, description="Priority (1=lowest, 10=highest)")
    request_id: Optional[str] = Field(None, description="Idempotency key")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Additional metadata")
    platform: Optional[str] = Field(None, description="Platform: 'ios' or 'android'")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    retry_count: int = Field(default=0, description="Current retry attempt")


class PushTemplate(BaseModel):
    """Push template structure"""
    code: str
    title: str  # Push notification title
    body: str   # Push notification message
    variables: list[str]
    language: str = "en"


class PushStatusUpdate(BaseModel):
    """Status update payload (snake_case)"""
    notification_id: str
    status: NotificationStatus
    timestamp: Optional[datetime] = None
    error: Optional[str] = None
    retry_count: int = 0


class ApiResponse(BaseModel):
    """Standard API response format"""
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    message: str
    meta: Optional[Dict[str, Any]] = None


class HealthCheckResponse(BaseModel):
    """Health check response"""
    status: str
    service: str
    version: str
    timestamp: datetime
    checks: Dict[str, str]
