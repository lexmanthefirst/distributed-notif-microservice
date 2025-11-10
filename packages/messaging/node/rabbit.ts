import amqp, { Channel, Connection } from "amqplib";

const RABBIT_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq/";

// Connection pooling - reuse connections
let connection: Connection | null = null;
let channel: Channel | null = null;

export async function connectRabbit() {
  if (connection && channel) {
    return { conn: connection, ch: channel };
  }

  connection = await amqp.connect(RABBIT_URL);
  channel = await connection.createChannel();

  // Set prefetch for better load balancing
  await channel.prefetch(10);

  // Declare exchanges
  await channel.assertExchange("notifications.direct", "direct", {
    durable: true,
  });
  await channel.assertExchange("notifications.fanout", "fanout", {
    durable: true,
  });
  await channel.assertExchange("notifications.topic", "topic", {
    durable: true,
  });

  // Declare queues with DLX (Dead Letter Exchange)
  const queueOptions = {
    durable: true,
    arguments: {
      "x-dead-letter-exchange": "notifications.dead_letter",
      "x-message-ttl": 86400000, // 24 hours
    },
  };

  await channel.assertQueue("email.queue", queueOptions);
  await channel.assertQueue("push.queue", queueOptions);
  await channel.assertQueue("failed.queue", { durable: true });

  // Dead letter exchange for failed messages
  await channel.assertExchange("notifications.dead_letter", "direct", {
    durable: true,
  });
  await channel.bindQueue("failed.queue", "notifications.dead_letter", "");

  // Bind queues
  await channel.bindQueue("email.queue", "notifications.direct", "email");
  await channel.bindQueue("push.queue", "notifications.direct", "push");

  // Handle connection errors
  connection.on("error", (err) => {
    console.error("RabbitMQ connection error:", err);
    connection = null;
    channel = null;
  });

  connection.on("close", () => {
    console.log("RabbitMQ connection closed");
    connection = null;
    channel = null;
  });

  return { conn: connection, ch: channel };
}

export async function publish(
  routingKey: string,
  payload: any,
  options?: {
    messageId?: string;
    priority?: number;
    expiration?: string;
  }
) {
  const { ch } = await connectRabbit();

  const message = {
    ...payload,
    timestamp: new Date().toISOString(),
    messageId:
      options?.messageId ||
      `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  };

  ch.publish(
    "notifications.direct",
    routingKey,
    Buffer.from(JSON.stringify(message)),
    {
      persistent: true,
      messageId: message.messageId,
      timestamp: Date.now(),
      priority: options?.priority || 5,
      expiration: options?.expiration,
      contentType: "application/json",
    }
  );
}

export async function consume(
  queueName: string,
  handler: (msg: any) => Promise<void>
) {
  const { ch } = await connectRabbit();

  await ch.consume(queueName, async (msg) => {
    if (!msg) return;

    try {
      const content = JSON.parse(msg.content.toString());
      await handler(content);
      ch.ack(msg);
    } catch (error) {
      console.error(`Error processing message from ${queueName}:`, error);
      // Reject and requeue with limit
      const retryCount = (msg.properties.headers?.["x-retry-count"] || 0) + 1;

      if (retryCount < 3) {
        // Requeue with incremented retry count
        ch.nack(msg, false, true);
      } else {
        // Send to dead letter queue after 3 retries
        ch.nack(msg, false, false);
      }
    }
  });
}

export async function closeRabbit() {
  if (channel) await channel.close();
  if (connection) await connection.close();
  connection = null;
  channel = null;
}
