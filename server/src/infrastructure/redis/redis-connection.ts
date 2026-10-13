import { Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

const logger = new Logger('Redis');

export function createRedis(url: string, name: string): Redis {
  const redis = new Redis(url, {
    connectionName: name,
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 200, 5000),
  });
  redis.on('error', (error) => logger.warn(`[${name}] ${error.message}`));
  return redis;
}
