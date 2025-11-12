"""Redis service for caching and status storage"""

import asyncio
import json
from datetime import datetime
from typing import Optional

from redis.asyncio import Redis

from app.core.config import settings
from app.core.logger import logger
from app.schemas.email_schema import NotificationStatus


class RedisService:
    """
    Redis service for:
    - Notification status storage
    - Template caching
    - Idempotency checks
    """
    
    def __init__(self):
        self.client: Optional[Redis] = None
        self._connected = False
        self._connect_lock = asyncio.Lock()
    
    async def connect(self):
        """Connect to Redis if not already connected"""
        if self._connected and self.client is not None:
            return

        try:
            logger.info(f"Connecting to Redis: {settings.redis_host}:{settings.redis_port}")
            
            self.client = Redis.from_url(
                settings.get_redis_url(),
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=5
            )
            
            # Test connection
            await self.client.ping()  # type: ignore
            self._connected = True
            
            logger.info("Connected to Redis successfully")
            
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {str(e)}")
            
            self._connected = False

    async def _ensure_connection(self):
        """Ensure Redis connection exists before performing operations"""
        if self._connected and self.client is not None:
            return

        async with self._connect_lock:
            if self._connected and self.client is not None:
                return
            await self.connect()
    
    async def close(self):
        """Close Redis connection and reset state"""
        if self.client:
            await self.client.close()
            logger.info("Redis connection closed")
        self.client = None
        self._connected = False
    
    async def set_notification_status(
        self,
        notification_id: str,
        status: NotificationStatus,
        error: Optional[str] = None,
        retry_count: int = 0,
        ttl: int = 86400  # 24 hours
    ):
        """
        Store notification status in Redis
        
        Args:
            notification_id: Notification UUID
            status: Current status
            error: Error message if failed
            retry_count: Number of retry attempts
            ttl: Time to live in seconds
        """
        await self._ensure_connection()
        if not self._connected or not self.client:
            logger.warning("Redis not connected, skipping status update")
            return
        
        try:
            key = f"notification:status:{notification_id}"
            
            data = {
                "notification_id": notification_id,
                "status": status.value,
                "error": error,
                "retry_count": retry_count,
                "updated_at": datetime.utcnow().isoformat(),
                "service": "email"
            }
            
            await self.client.setex(key, ttl, json.dumps(data))
            
            logger.info(f"Status stored in Redis: notification_id={notification_id}, status={status.value}")
            
        except Exception as e:
            logger.error(f"Failed to store status in Redis: {str(e)}")
    
    async def get_notification_status(self, notification_id: str) -> Optional[dict]:
        """
        Retrieve notification status from Redis
        
        Args:
            notification_id: Notification UUID
            
        Returns:
            Status dict or None if not found
        """
        await self._ensure_connection()
        if not self._connected or not self.client:
            return None
        
        try:
            key = f"notification:status:{notification_id}"
            data = await self.client.get(key)
            
            if data:
                return json.loads(data)
            return None
            
        except Exception as e:
            logger.error(f"Failed to get status from Redis: {str(e)}")
            return None
    
    async def cache_template(self, template_code: str, template_data: dict, ttl: int = 3600):
        """
        Cache email template
        
        Args:
            template_code: Template identifier
            template_data: Template data
            ttl: Time to live in seconds (default 1 hour)
        """
        await self._ensure_connection()
        if not self._connected or not self.client:
            return
        
        try:
            key = f"template:{template_code}"
            await self.client.setex(key, ttl, json.dumps(template_data))
            
            logger.info(f"Template cached: code={template_code}, ttl={ttl}s")
            
        except Exception as e:
            logger.error(f"Failed to cache template: {str(e)}")
    
    async def get_cached_template(self, template_code: str) -> Optional[dict]:
        """
        Get cached template
        
        Args:
            template_code: Template identifier
            
        Returns:
            Template data or None if not cached
        """
        await self._ensure_connection()
        if not self._connected or not self.client:
            return None
        
        try:
            key = f"template:{template_code}"
            data = await self.client.get(key)
            
            if data:
                logger.info(f"Template cache hit: code={template_code}")
                return json.loads(data)
            
            logger.info(f"Template cache miss: code={template_code}")
            return None
            
        except Exception as e:
            logger.error(f"Failed to get cached template: {str(e)}")
            return None
    
    async def check_idempotency(self, request_id: str) -> bool:
        """
        Check if request has already been processed (idempotency check)
        
        Args:
            request_id: Unique request identifier
            
        Returns:
            True if already processed, False otherwise
        """
        await self._ensure_connection()
        if not self._connected or not self.client:
            return False
        
        try:
            key = f"idempotent:{request_id}"
            exists = await self.client.exists(key)
            return bool(exists)
            
        except Exception as e:
            logger.error(f"Failed to check idempotency: {str(e)}")
            return False
    
    async def mark_processed(self, request_id: str, ttl: int = 86400):
        """
        Mark request as processed for idempotency
        
        Args:
            request_id: Unique request identifier
            ttl: Time to live in seconds (default 24 hours)
        """
        await self._ensure_connection()
        if not self._connected or not self.client:
            return
        
        try:
            key = f"idempotent:{request_id}"
            await self.client.setex(key, ttl, "1")
            
            logger.info(f"Request marked as processed: request_id={request_id}")
            
        except Exception as e:
            logger.error(f"Failed to mark request as processed: {str(e)}")
    
    async def health_check(self) -> bool:
        """Check Redis health"""
        await self._ensure_connection()
        if not self.client:
            return False
        
        try:
            await self.client.ping()  # type: ignore
            return True
        except Exception:
            return False
