import * as amqplib from "amqplib";

const RABBIT_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@rabbitmq/";

// Connection pooling - reuse connections
let connection: any = null;
let channel: any = null;

export async function connectRabbit(): Promise<{ conn: any; ch: any }> {
  if (connection && channel) {
    return { conn: connection, ch: channel };
  }

  const conn = await amqplib.connect(RABBIT_URL);
  const ch = await conn.createChannel();

  connection = conn;
  channel = ch;

  // Set prefetch for better load balancing
  await ch.prefetch(10);

  // Declare exchanges
  await ch.assertExchange("notifications.direct", "direct", {
    durable: true,
  });
  await ch.assertExchange("notifications.fanout", "fanout", {
    durable: true,
  });
  await ch.assertExchange("notifications.topic", "topic", {
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

  await ch.assertQueue("email.queue", queueOptions);
  await ch.assertQueue("push.queue", queueOptions);
  await ch.assertQueue("failed.queue", { durable: true });

  // Dead letter exchange for failed messages
  await ch.assertExchange("notifications.dead_letter", "direct", {
    durable: true,
  });
  await ch.bindQueue("failed.queue", "notifications.dead_letter", "");

  // Bind queues
  await ch.bindQueue("email.queue", "notifications.direct", "email");
  await ch.bindQueue("push.queue", "notifications.direct", "push");

  // Handle connection errors
  conn.on("error", (err) => {
    console.error("RabbitMQ connection error:", err);
    connection = null;
    channel = null;
  });

  conn.on("close", () => {
    console.log("RabbitMQ connection closed");
    connection = null;
    channel = null;
  });

  return { conn, ch };
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

  if (!ch) {
    throw new Error("RabbitMQ channel not available");
  }

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

  if (!ch) {
    throw new Error("RabbitMQ channel not available");
  }

  await ch.consume(queueName, async (msg: any) => {
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
  try {
    if (channel) await channel.close();
    if (connection) {
      // Cast to any to access close method (amqplib types issue)
      await (connection as any).close();
    }
  } catch (error) {
    console.error("Error closing RabbitMQ connection:", error);
  } finally {
    connection = null;
    channel = null;
  }
}
