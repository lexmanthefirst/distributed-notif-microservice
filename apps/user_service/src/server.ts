process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { Client } from "pg";
import amqp from "amqplib";
import dotenv from "dotenv";

dotenv.config();

const fastify = Fastify({ logger: true });
fastify.register(cors);

// PostgreSQL client
const pgClient = new Client({
  connectionString : process.env.DATABASE_URL,
  ssl:{
    rejectUnauthorized:false,
  }
});

// RabbitMQ channel (we’ll initialize later)
let channel: amqp.Channel;

fastify.get("/health", async () => ({ status: "ok", service: "user-service" }));

fastify.get("/", async () => ({ message: "User Service API" }));

// Register route
fastify.post("/register", async (request, reply) => {
  const { name, email, password, push_token } = request.body as any;

  if (!name || !email || !password) {
    return reply.status(400).send({ success: false, message: "Missing fields" });
  }

  try {
    // Save user to PostgreSQL
    const result = await pgClient.query(
      `INSERT INTO users(name, email, password, push_token) VALUES($1, $2, $3, $4) RETURNING id, name, email`,
      [name, email, password, push_token || null]
    );

    const user = result.rows[0];

    // Publish an event to RabbitMQ for other services
    const eventPayload = {
      type: "USER_REGISTERED",
      user,
      timestamp: new Date().toISOString(),
    };
    channel.sendToQueue("user_queue", Buffer.from(JSON.stringify(eventPayload)), {
      persistent: true,
    });

    return reply.send({ success: true, message: "User registered", data: user });
  } catch (err: any) {
    console.error(err);
    return reply.status(500).send({ success: false, message: "Registration failed" });
  }
});

// Login route (basic example)
fastify.post("/login", async (request, reply) => {
  const { email, password } = request.body as any;
  if (!email || !password) {
    return reply.status(400).send({ success: false, message: "Missing fields" });
  }

  try {
    const result = await pgClient.query(
      "SELECT id, name, email FROM users WHERE email=$1 AND password=$2",
      [email, password]
    );
    if (result.rowCount === 0) {
      return reply.status(401).send({ success: false, message: "Invalid credentials" });
    }

    const user = result.rows[0];
    return reply.send({ success: true, message: "Login successful", data: user });
  } catch (err: any) {
    console.error(err);
    return reply.status(500).send({ success: false, message: "Login failed" });
  }
});

// Initialize services and start server
async function start() {
  try {
    await pgClient.connect();
    console.log("Connected to PostgreSQL");

    const RABBIT_URL = process.env.RABBITMQ_URL || "amqp://TzSC3RZ1JAwfC6Tg:Gq~Ji2T0pm67t435v2~k3ohDtyffmiFq@rabbitmq.railway.internal:5672";
    const conn = await amqp.connect(RABBIT_URL);
    channel = await conn.createChannel();
    await channel.assertQueue("user_queue", { durable: true });
    console.log("Connected to RabbitMQ");

    const port = Number(process.env.PORT) || 4001;
    await fastify.listen({ port, host: "0.0.0.0" });
    console.log(`User Service listening on port ${port}`);
  } catch (err) {
    console.error("Error starting User Service:", err);
    process.exit(1);
  }
}

start();
