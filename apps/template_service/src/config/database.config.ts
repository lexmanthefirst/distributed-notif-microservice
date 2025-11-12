import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { Template } from "../templates/entities";

export const getDatabaseConfig = (): TypeOrmModuleOptions => {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    return {
      type: "postgres",
      url: databaseUrl,
      entities: [Template],
      synchronize: process.env.NODE_ENV !== "production",
      logging: process.env.NODE_ENV === "development",
      ssl: {
        rejectUnauthorized: false,
      },
    };
  }

  // Fallback to individual connection parameters
  return {
    type: "postgres",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    username: process.env.DB_USER || "template_svc",
    password: process.env.DB_PASSWORD || "template_dev_password",
    database: process.env.DB_NAME || "template_service_db",
    entities: [Template],
    synchronize: process.env.NODE_ENV !== "production",
    logging: process.env.NODE_ENV === "development",
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  };
};
