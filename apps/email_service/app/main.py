"""Main FastAPI application"""

import asyncio
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logger import logger
from app.api.routes import health
from app.services.email_sender import EmailSender
from app.services.queue_consumer import EmailQueueConsumer
from app.services.redis_service import RedisService


# Global instances
email_consumer: Optional[EmailQueueConsumer] = None
redis_service: Optional[RedisService] = None
consumer_task: Optional[asyncio.Task] = None
email_sender: Optional[EmailSender] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager
    
    Handles startup and shutdown events:
    - Startup: Connect to RabbitMQ, Redis, start queue consumer
    - Shutdown: Stop consumer, close connections
    """
    global email_consumer, redis_service, consumer_task, email_sender
    
    # Startup
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")
    
    try:
        # Initialize shared services
        redis_service = RedisService()
        email_sender = EmailSender()
        await redis_service.connect()

        # Initialize and connect email consumer
        email_consumer = EmailQueueConsumer(
            redis_service=redis_service,
            email_sender=email_sender,
        )
        await email_consumer.connect()
        
        # Start consuming in background task
        consumer_task = asyncio.create_task(email_consumer.start_consuming())

        # Expose dependencies via application state for API routes
        app.state.redis_service = redis_service
        app.state.email_sender = email_sender
        app.state.email_consumer = email_consumer
        
        logger.info("Email service started successfully")
        
    except Exception as e:
        logger.error(f"Failed to start email service: {str(e)}")
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down email service...")
    
    try:
        # Stop consumer
        if email_consumer:
            await email_consumer.stop_consuming()
            if consumer_task:
                consumer_task.cancel()
                try:
                    await consumer_task
                except asyncio.CancelledError:
                    pass
            await email_consumer.close()
        
        # Close Redis
        if redis_service:
            await redis_service.close()
        
        logger.info("Email service shutdown complete")
        
    except Exception as e:
        logger.error(f"Error during shutdown: {str(e)}")
    finally:
        app.state.redis_service = None
        app.state.email_sender = None
        app.state.email_consumer = None


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Email Service for Distributed Notification System",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

app.state.redis_service = None
app.state.email_sender = None
app.state.email_consumer = None

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure properly in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, tags=["Health"])


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "status": "running"
    }
