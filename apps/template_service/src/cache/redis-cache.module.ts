import { CacheModule } from "@nestjs/cache-manager";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import Keyv from "keyv";
import KeyvRedis from "@keyv/redis";

@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisUrl =
          configService.get<string>("REDIS_URL") || "redis://localhost:6379";

        // Create Keyv store with Redis
        const keyvRedis = new KeyvRedis(redisUrl);
        const keyv = new Keyv({ store: keyvRedis });

        // Handle connection events
        keyv.on("error", (err) => {
          console.error("Redis connection error:", err);
        });

        return {
          store: keyv,
          ttl: configService.get<number>("CACHE_TTL") || 300, // 5 minutes default
        };
      },
    }),
  ],
  exports: [CacheModule],
})
export class RedisCacheModule {}
