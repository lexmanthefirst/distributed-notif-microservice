"""Main FastAPI application"""

import asyncio
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logger import logger
from app.routes import health
from app.services.push_sender import PushSender
from app.services.queue_consumer import PushQueueConsumer
from app.services.redis_service import RedisService


# Global instances
push_consumer: Optional[PushQueueConsumer] = None
redis_service: Optional[RedisService] = None
consumer_task: Optional[asyncio.Task] = None
push_sender: Optional[PushSender] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager
    
    Handles startup and shutdown events:
    - Startup: Connect to RabbitMQ, Redis, start queue consumer
    - Shutdown: Stop consumer, close connections
    """
    global push_consumer, redis_service, consumer_task, push_sender
    
    # Startup
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")
    
    try:
        # Initialize shared services
        redis_service = RedisService()
        push_sender = PushSender()
        await redis_service.connect()

        # Initialize and connect push consumer
        push_consumer = PushQueueConsumer(
            redis_service=redis_service,
            push_sender=push_sender,
        )
        await push_consumer.connect()
        
        # Start consuming in background task
        consumer_task = asyncio.create_task(push_consumer.start_consuming())

        # Expose dependencies via application state for API routes
        app.state.redis_service = redis_service
        app.state.push_sender = push_sender
        app.state.push_consumer = push_consumer
        
        logger.info("Push service started successfully")
        
    except Exception as e:
        logger.error(f"Failed to start push service: {str(e)}")
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down push service...")
    
    try:
        # Stop consumer
        if push_consumer:
            await push_consumer.stop_consuming()
            if consumer_task:
                consumer_task.cancel()
                try:
                    await consumer_task
                except asyncio.CancelledError:
                    pass
            await push_consumer.close()
        
        # Close Redis
        if redis_service:
            await redis_service.close()
        
        logger.info("Push service shutdown complete")
        
    except Exception as e:
        logger.error(f"Error during shutdown: {str(e)}")
    finally:
        app.state.redis_service = None
        app.state.push_sender = None
        app.state.push_consumer = None


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Push Notification Service for Distributed Notification System",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

app.state.redis_service = None
app.state.push_sender = None
app.state.push_consumer = None

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