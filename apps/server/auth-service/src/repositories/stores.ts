// Job: own the MongoDB (Mongoose) and Redis connections and ping them. Neither needs the store
// to be up at startup: MongoDB connects through connectMongo, Redis keeps reconnecting in the
// background.
import mongoose, { type Connection } from 'mongoose';
import { createClient } from 'redis';
import type { Config } from '../config.js';

const TIMEOUT_MS = 2000;

export interface Stores {
  // Mongoose connection for the repositories; open only after connectMongo resolves.
  connection: Connection;
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

export function createStores(config: Config): Stores {
  const mongo = createMongo(config.mongodbUri, config.mongodbDb);

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
    connection: mongo.connection,
    connectMongo: mongo.connect,
    pingMongo: mongo.ping,
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
