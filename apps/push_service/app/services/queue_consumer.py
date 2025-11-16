"""RabbitMQ queue consumer for push messages"""

import asyncio
import json
from datetime import datetime
from typing import Optional

import aio_pika
from aio_pika.abc import AbstractRobustConnection, AbstractChannel, AbstractQueue, AbstractExchange, AbstractIncomingMessage

from app.core.config import settings
from app.core.logger import logger, set_correlation_id
from app.schemas.push_schema import PushMessage, NotificationStatus
from app.services.push_sender import PushSender
from app.services.redis_service import RedisService


class PushQueueConsumer:
    """
    RabbitMQ consumer for push queue
    
    Features:
    - Automatic reconnection
    - Message acknowledgment
    - Dead Letter Queue for failed messages
    - Correlation ID tracking
    """
    
    def __init__(
        self,
        redis_service: Optional[RedisService] = None,
        push_sender: Optional[PushSender] = None,
    ):
        self.connection: Optional[AbstractRobustConnection] = None
        self.channel: Optional[AbstractChannel] = None
        self.queue: Optional[AbstractQueue] = None
        self.failed_queue: Optional[AbstractQueue] = None
        self.exchange: Optional[AbstractExchange] = None
        self.push_sender = push_sender or PushSender()
        self.redis_service = redis_service or RedisService()
        self.is_consuming = False

        logger.info("PushQueueConsumer initialized")
    
    async def connect(self):
        """Establish connection to RabbitMQ"""
        try:
            logger.info(f"Connecting to RabbitMQ: {settings.rabbitmq_host}:{settings.rabbitmq_port}")
            
            # Create robust connection (auto-reconnect)
            self.connection = await aio_pika.connect_robust(
                settings.get_rabbitmq_url(),
                timeout=10,
            )
            
            # Create channel
            self.channel = await self.connection.channel()
            
            # Set QoS (prefetch count)
            await self.channel.set_qos(prefetch_count=settings.queue_prefetch_count)
            
            # Declare exchange
            self.exchange = await self.channel.declare_exchange(
                settings.exchange_name,
                aio_pika.ExchangeType.DIRECT,
                durable=True,
            )
            
            # Declare push queue
            self.queue = await self.channel.declare_queue(
                settings.push_queue_name,
                durable=True,
                arguments={
                    'x-dead-letter-exchange': settings.exchange_name,
                    'x-dead-letter-routing-key': 'failed',
                    'x-message-ttl': 86400000,  # 24 hours
                }
            )
            
            # Bind queue to exchange
            await self.queue.bind(self.exchange, routing_key='push')
            
            # Declare failed queue (Dead Letter Queue)
            self.failed_queue = await self.channel.declare_queue(
                settings.failed_queue_name,
                durable=True,
            )
            await self.failed_queue.bind(self.exchange, routing_key='failed')

            await self.redis_service.connect()
            
            logger.info(
                f"Connected to RabbitMQ: exchange={settings.exchange_name}, "
                f"queue={settings.push_queue_name}, prefetch={settings.queue_prefetch_count}"
            )
            
        except Exception as e:
            logger.error(f"Failed to connect to RabbitMQ: {str(e)}")
            raise
    
    async def start_consuming(self):
        """Start consuming messages from the queue"""
        if not self.queue:
            raise RuntimeError("Not connected to RabbitMQ. Call connect() first.")
        
        logger.info(f"Starting to consume messages from queue: {settings.push_queue_name}")
        self.is_consuming = True
        
        try:
            # Start consuming
            async with self.queue.iterator() as queue_iter:
                async for message in queue_iter:
                    if not self.is_consuming:
                        break
                    
                    await self._process_message(message)
                    
        except asyncio.CancelledError:
            logger.info("Queue consumer cancelled")
            self.is_consuming = False
        except Exception as e:
            logger.error(f"Queue consumer error: {str(e)}")
            self.is_consuming = False
            raise
    
    async def _process_message(self, message: AbstractIncomingMessage):
        """
        Process a single message from the queue
        
        Args:
            message: Incoming RabbitMQ message
        """
        async with message.process():
            try:
                # Parse message body
                push_msg = PushMessage.model_validate_json(message.body.decode())
                
                # Set correlation ID for logging
                correlation_id = push_msg.request_id or push_msg.notification_id
                set_correlation_id(correlation_id)
                
                logger.info(
                    f"Processing push message: notification_id={push_msg.notification_id}, "
                    f"to={push_msg.push_token[:20]}..., retry_count={push_msg.retry_count}"
                )
                
                # Update status to pending
                await self._update_status(
                    push_msg.notification_id,
                    NotificationStatus.pending,
                    retry_count=push_msg.retry_count
                )
                
                # Send push notification
                success, error = await self.push_sender.send_push(push_msg)
                
                if success:
                    # Update status to delivered
                    await self._update_status(
                        push_msg.notification_id,
                        NotificationStatus.delivered,
                        retry_count=push_msg.retry_count
                    )
                    logger.info(f"Push delivered: notification_id={push_msg.notification_id}")
                else:
                    # Update status to failed
                    await self._update_status(
                        push_msg.notification_id,
                        NotificationStatus.failed,
                        error=error,
                        retry_count=push_msg.retry_count
                    )
                    
                    # Check if should retry
                    if push_msg.retry_count < settings.max_retry_attempts:
                        # Requeue with incremented retry count
                        await self._requeue_message(push_msg)
                    else:
                        # Move to DLQ (automatic via message rejection)
                        logger.error(
                            f"Push permanently failed after {settings.max_retry_attempts} attempts: "
                            f"notification_id={push_msg.notification_id}"
                        )
                        await self._send_to_dlq(push_msg, error)
                
            except Exception as e:
                logger.error(f"Error processing message: {str(e)}", exc_info=True)
                # Reject message and send to DLQ
                raise
            finally:
                set_correlation_id("N/A")
    
    async def _update_status(
        self,
        notification_id: str,
        status: NotificationStatus,
        error: Optional[str] = None,
        retry_count: int = 0
    ):
        """Update notification status in Redis"""
        try:
            await self.redis_service.set_notification_status(
                notification_id=notification_id,
                status=status,
                error=error,
                retry_count=retry_count
            )
        except Exception as e:
            logger.error(f"Failed to update status in Redis: {str(e)}")
    
    async def _requeue_message(self, push_msg: PushMessage):
        """Requeue message with incremented retry count"""
        try:
            push_msg.retry_count += 1

            logger.info(
                "Requeuing message notification_id=%s retry_count=%s",
                push_msg.notification_id,
                push_msg.retry_count,
            )

            if self.exchange:
                await self.exchange.publish(
                    aio_pika.Message(
                        body=push_msg.model_dump_json().encode(),
                        delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                    ),
                    routing_key='push',
                )

                logger.info("Message requeued notification_id=%s", push_msg.notification_id)
        except Exception as e:
            logger.error(f"Failed to requeue message: {str(e)}")
    
    async def _send_to_dlq(self, push_msg: PushMessage, error: Optional[str]):
        """Send failed message to Dead Letter Queue"""
        try:
            if self.exchange:
                # Use mode='json' to serialize datetime objects to ISO format strings
                dlq_data = push_msg.model_dump(mode='json')
                dlq_data['final_error'] = error
                dlq_data['failed_at'] = datetime.utcnow().isoformat()

                await self.exchange.publish(
                    aio_pika.Message(
                        body=json.dumps(dlq_data).encode(),
                        delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                    ),
                    routing_key='failed',
                )

                logger.info("Message sent to DLQ notification_id=%s", push_msg.notification_id)
        except Exception as e:
            logger.error(f"Failed to send message to DLQ: {str(e)}")
    
    async def stop_consuming(self):
        """Stop consuming messages"""
        logger.info("Stopping queue consumer...")
        self.is_consuming = False
    
    async def close(self):
        """Close RabbitMQ connection"""
        try:
            if self.connection and not self.connection.is_closed:
                await self.connection.close()
                logger.info("RabbitMQ connection closed")
        except Exception as e:
            logger.error(f"Error closing RabbitMQ connection: {str(e)}")
