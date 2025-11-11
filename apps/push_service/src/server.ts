import Fastify from "fastify";
import cors from "@fastify/cors";

const fastify = Fastify({
  logger: true,
});

fastify.register(cors);

fastify.get("/health", async () => {
  return { status: "ok", service: "push-service" };
});

fastify.get("/", async () => {
  return { message: "Push Notification Service API" };
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || "4100", 10);
    await fastify.listen({ port, host: "0.0.0.0" });
    console.log(`Push Service listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
