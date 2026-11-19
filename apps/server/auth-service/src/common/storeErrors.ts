// Job: repository errors that services and the error handler react to, so no MongoDB or
// Mongoose type leaks out of the repositories.
import mongoose from 'mongoose';

// A unique index refused the write. Names the collection only, never the value.
export class DuplicateError extends Error {
  constructor(readonly collection: string) {
    super(`duplicate in ${collection}`);
  }
}

// MongoDB did not answer in time or the connection is gone: the request answers 503.
export class StoreUnavailableError extends Error {
  constructor() {
    super('mongodb unavailable');
  }
}

const STORE_DOWN = new Set([
  'MongooseServerSelectionError',
  'MongoServerSelectionError',
  'MongoNetworkError',
  'MongoNetworkTimeoutError',
  'MongoNotConnectedError',
  'MongoTopologyClosedError',
]);

// Runs one repository call and maps driver errors: duplicate key (11000) to DuplicateError,
// an unreachable MongoDB to StoreUnavailableError. Anything else is rethrown as it is.
export async function mapStoreErrors<T>(collection: string, call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (e) {
    if (e instanceof mongoose.mongo.MongoServerError && e.code === 11000) throw new DuplicateError(collection);
    if (e instanceof Error && STORE_DOWN.has(e.name)) throw new StoreUnavailableError();
    // bufferCommands is off: before the first connect, Mongoose refuses a query at once.
    if (e instanceof mongoose.Error && /before initial connection is complete/.test(e.message)) {
      throw new StoreUnavailableError();
    }
    throw e;
  }
}
