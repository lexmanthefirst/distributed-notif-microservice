"""Configuration management using Pydantic Settings"""

import os
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with environment variable support"""
    
    # Application
    app_name: str = "Push Service"
    app_version: str = "1.0.0"
    port: int = 4100
    debug: bool = False
    
    # Database (PostgreSQL) - Use full URL or components
    database_url: Optional[str] = None  # Full connection string (preferred)
    db_host: str = "postgres_push"
    db_port: int = 5432
    db_user: str = "push_svc"
    db_password: str = "push_dev_password"
    db_name: str = "push_service_db"
    
    # RabbitMQ - Use full URL or components
    rabbitmq_url: Optional[str] = None  # Full AMQP URL (preferred)
    rabbitmq_host: str = "rabbitmq"
    rabbitmq_port: int = 5672
    rabbitmq_user: str = "guest"
    rabbitmq_password: str = "guest"
    rabbitmq_vhost: str = "/"
    push_queue_name: str = "push.queue"
    failed_queue_name: str = "failed.queue"
    exchange_name: str = "notifications.direct"
    
    # Redis - Use full URL or components
    redis_url: Optional[str] = None  # Full Redis URL (preferred)
    redis_host: str = "redis"
    redis_port: int = 6379
    redis_password: Optional[str] = None
    redis_db: int = 0
    
    # Firebase Cloud Messaging (FCM) Configuration
    fcm_credentials_path: Optional[str] = None  # Path to firebase-adminsdk.json
    fcm_server_key: Optional[str] = None  # Legacy FCM server key (optional)
    
    # Apple Push Notification Service (APNS) Configuration
    apns_key_id: Optional[str] = None
    apns_team_id: Optional[str] = None
    apns_key_path: Optional[str] = None  # Path to .p8 key file
    apns_bundle_id: str = "com.example.app"
    apns_use_sandbox: bool = True  # True for development, False for production
    
    # Template Service
    template_service_url: str = "http://template_service:4002"
    
    # Circuit Breaker Settings
    circuit_breaker_failure_threshold: int = 5
    circuit_breaker_timeout: int = 60  # seconds
    circuit_breaker_recovery_timeout: int = 30  # seconds
    
    # Retry Settings
    max_retry_attempts: int = 3
    retry_base_delay: int = 2  # seconds (exponential backoff base)
    
    # Queue Consumer Settings
    queue_prefetch_count: int = 10
    
    # Correlation ID for distributed tracing
    correlation_id_header: str = "X-Correlation-ID"
    
    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).parent.parent.parent / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    def get_rabbitmq_url(self) -> str:
        """Get RabbitMQ connection URL - prefers full URL, falls back to components"""
        if self.rabbitmq_url:
            return self.rabbitmq_url
        
        vhost = self.rabbitmq_vhost if self.rabbitmq_vhost != "/" else ""
        return f"amqp://{self.rabbitmq_user}:{self.rabbitmq_password}@{self.rabbitmq_host}:{self.rabbitmq_port}/{vhost}"
    
    def get_redis_url(self) -> str:
        """Get Redis connection URL - prefers full URL, falls back to components"""
        if self.redis_url:
            return self.redis_url
        
        if self.redis_password:
            return f"redis://:{self.redis_password}@{self.redis_host}:{self.redis_port}/{self.redis_db}"
        return f"redis://{self.redis_host}:{self.redis_port}/{self.redis_db}"
    
    def get_database_url(self) -> str:
        """Get PostgreSQL connection URL - prefers full URL, falls back to components"""
        if self.database_url:
            return self.database_url
        
        return f"postgresql://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"


# Global settings instance
settings = Settings()
