import Fastify from "fastify";
import cors from "@fastify/cors";

const fastify = Fastify({
  logger: true,
});

fastify.register(cors);

fastify.get("/health", async () => {
  return { status: "ok", service: "user-service" };
});

fastify.get("/", async () => {
  return { message: "User Service API" };
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || "4001", 10);
    await fastify.listen({ port, host: "0.0.0.0" });
    console.log(`User Service listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
