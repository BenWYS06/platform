// Job: own the MongoDB and Redis clients and ping them. Neither needs the store to be up
// at startup: MongoDB connects on first use, Redis keeps reconnecting in the background.
import { MongoClient, type Db } from 'mongodb';
import { createClient } from 'redis';
import type { Config } from '../config.js';

const TIMEOUT_MS = 2000;

export interface Stores {
  db: Db;
  pingMongo(): Promise<void>;
  pingRedis(): Promise<void>;
  close(): Promise<void>;
}

export function createStores(config: Config): Stores {
  const mongo = new MongoClient(config.mongodbUri, { serverSelectionTimeoutMS: TIMEOUT_MS, appName: 'auth-service' });
  const db = mongo.db(config.mongodbDb);

  const redis = createClient({
    url: config.redisUrl,
    // Commands fail at once while disconnected instead of waiting in a queue.
    disableOfflineQueue: true,
    socket: { connectTimeout: TIMEOUT_MS, reconnectStrategy: (retries) => Math.min(100 * 2 ** retries, 2000) },
  });
  // Without a listener, a connection error would crash the process; health reports it instead.
  redis.on('error', () => {});
  const connectRedis = () => redis.connect().catch(() => {});
  connectRedis();

  return {
    db,
    async pingMongo() {
      await db.command({ ping: 1 });
    },
    async pingRedis() {
      if (!redis.isOpen) {
        connectRedis();
        throw new Error('redis not connected');
      }
      if (!redis.isReady) throw new Error('redis not ready');
      await redis.ping();
    },
    async close() {
      await Promise.allSettled([mongo.close(), redis.isOpen ? redis.close() : Promise.resolve()]);
    },
  };
}
