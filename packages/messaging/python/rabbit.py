import json
import asyncio
from typing import Dict, Any, Callable
from aio_pika import connect_robust, Message, ExchangeType, IncomingMessage
from datetime import datetime

RABBIT_URL = "amqp://guest:guest@rabbitmq/"

# Connection pooling
_connection = None
_channel = None

async def connect_rabbit():
    global _connection, _channel
    
    if _connection and _channel:
        return _connection, _channel
    
    _connection = await connect_robust(RABBIT_URL)
    _channel = await _connection.channel()
    
    # Set prefetch for better load balancing
    await _channel.set_qos(prefetch_count=10)
    
    # Declare exchanges
    await _channel.declare_exchange("notifications.direct", ExchangeType.DIRECT, durable=True)
    await _channel.declare_exchange("notifications.fanout", ExchangeType.FANOUT, durable=True)
    await _channel.declare_exchange("notifications.topic", ExchangeType.TOPIC, durable=True)
    await _channel.declare_exchange("notifications.dead_letter", ExchangeType.DIRECT, durable=True)
    
    # Declare queues with DLX
    queue_args = {
        "x-dead-letter-exchange": "notifications.dead_letter",
        "x-message-ttl": 86400000,  # 24 hours
    }
    
    email_queue = await _channel.declare_queue("email.queue", durable=True, arguments=queue_args)
    push_queue = await _channel.declare_queue("push.queue", durable=True, arguments=queue_args)
    failed_queue = await _channel.declare_queue("failed.queue", durable=True)
    
    # Get exchanges
    direct_exchange = await _channel.get_exchange("notifications.direct")
    dead_letter_exchange = await _channel.get_exchange("notifications.dead_letter")
    
    # Bind queues
    await email_queue.bind(direct_exchange, routing_key="email")
    await push_queue.bind(direct_exchange, routing_key="push")
    await failed_queue.bind(dead_letter_exchange, routing_key="")
    
    return _connection, _channel

async def publish_message(routing_key: str, payload: Dict[str, Any], message_id: str = None, priority: int = 5):
    _, channel = await connect_rabbit()
    
    exchange = await channel.get_exchange("notifications.direct")
    
    # Add metadata
    enhanced_payload = {
        **payload,
        "timestamp": datetime.utcnow().isoformat(),
        "message_id": message_id or f"msg_{datetime.now().timestamp()}",
    }
    
    msg = Message(
        json.dumps(enhanced_payload).encode(),
        delivery_mode=2,  # Persistent
        content_type="application/json",
        message_id=enhanced_payload["message_id"],
        timestamp=datetime.utcnow(),
        priority=priority,
    )
    
    await exchange.publish(msg, routing_key=routing_key)

async def consume_messages(queue_name: str, handler: Callable[[Dict[str, Any]], Any]):
    _, channel = await connect_rabbit()
    
    queue = await channel.get_queue(queue_name)
    
    async def process_message(message: IncomingMessage):
        async with message.process(requeue=False):
            try:
                content = json.loads(message.body.decode())
                await handler(content)
            except Exception as e:
                print(f"Error processing message from {queue_name}: {e}")
                
                # Retry logic
                retry_count = message.headers.get("x-retry-count", 0) if message.headers else 0
                
                if retry_count < 3:
                    # Requeue with incremented retry count
                    await message.nack(requeue=True)
                else:
                    # Send to dead letter queue
                    await message.nack(requeue=False)
    
    await queue.consume(process_message)

async def close_rabbit():
    global _connection, _channel
    
    if _channel:
        await _channel.close()
    if _connection:
        await _connection.close()
    
    _connection = None
    _channel = None
