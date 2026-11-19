// Job: own the MongoDB (Mongoose) and Redis connections and ping them. Neither needs the store
// to be up at startup: MongoDB connects through connectMongo, Redis keeps reconnecting in the
// background.
import mongoose, { type Connection } from 'mongoose';
import { createClient } from 'redis';
import type { Config } from '../config.js';

const TIMEOUT_MS = 2000;

// Commands fail at once while disconnected (no offline queue); the client keeps reconnecting.
const newRedisClient = (url: string) =>
  createClient({
    url,
    disableOfflineQueue: true,
    socket: { connectTimeout: TIMEOUT_MS, reconnectStrategy: (retries) => Math.min(100 * 2 ** retries, 2000) },
  });

export type RedisClient = ReturnType<typeof newRedisClient>;

export interface Stores {
  // Mongoose connection for the repositories; open only after connectMongo resolves.
  connection: Connection;
  // Redis client for the repositories (failure counters); commands fail at once while down.
  redis: RedisClient;
  // Call before the first query; safe to call often and from many callers at once.
  connectMongo(): Promise<void>;
  pingMongo(): Promise<void>;
  pingRedis(): Promise<void>;
  close(): Promise<void>;
}

export interface Mongo {
  connection: Connection;
  connect(): Promise<void>;
  ping(): Promise<void>;
  close(): Promise<void>;
}

// One Mongoose connection. No command buffering and a short server selection, so a query
// fails within about 2 s when MongoDB is down (A30). Indexes come from syncIndexes at startup,
// never from autoIndex (A21). A failed first connect is retried by the next connect() call.
export function createMongo(uri: string, dbName: string, serverSelectionTimeoutMS = TIMEOUT_MS): Mongo {
  const connection = mongoose.createConnection();
  let attempt: Promise<void> | undefined;
  const connect = (): Promise<void> => {
    if (connection.readyState === mongoose.ConnectionStates.connected) return Promise.resolve();
    attempt ??= connection
      .openUri(uri, { dbName, serverSelectionTimeoutMS, bufferCommands: false, autoIndex: false, appName: 'auth-service' })
      .then(() => undefined)
      .finally(() => {
        attempt = undefined;
      });
    return attempt;
  };
  return {
    connection,
    connect,
    async ping() {
      await connect();
      if (!connection.db) throw new Error('mongodb not connected');
      await connection.db.command({ ping: 1 });
    },
    close: () => connection.close(),
  };
}

export interface Redis {
  client: RedisClient;
  ping(): Promise<void>;
  close(): Promise<void>;
}

// One Redis client; Redis may be down at startup.
export function createRedis(url: string): Redis {
  const client = newRedisClient(url);
  // Without a listener, a connection error would crash the process; health reports it instead.
  client.on('error', () => {});
  const connect = () => void client.connect().catch(() => {});
  connect();
  return {
    client,
    async ping() {
      if (!client.isOpen) {
        connect();
        throw new Error('redis not connected');
      }
      if (!client.isReady) throw new Error('redis not ready');
      await client.ping();
    },
    // A graceful close waits for Redis; while it is down, drop the socket instead.
    close: async () => {
      if (client.isReady) await client.close();
      else if (client.isOpen) client.destroy();
    },
  };
}

export function createStores(config: Config): Stores {
  const mongo = createMongo(config.mongodbUri, config.mongodbDb);
  const redis = createRedis(config.redisUrl);

  return {
    connection: mongo.connection,
    redis: redis.client,
    connectMongo: mongo.connect,
    pingMongo: mongo.ping,
    pingRedis: redis.ping,
    async close() {
      await Promise.allSettled([mongo.close(), redis.close()]);
    },
  };
}
