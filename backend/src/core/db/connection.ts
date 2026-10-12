import mongoose from 'mongoose';
import { logger } from '../logger';

/** Atlas may take a moment to answer a server that just woke up; longer means it is unreachable. */
const CONNECT_TIMEOUT_MS = 15_000;

export async function connectDatabase(uri: string): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: CONNECT_TIMEOUT_MS });
  logger.info({ database: mongoose.connection.name }, 'Database connected');
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export function isDatabaseUp(): boolean {
  return mongoose.connection.readyState === 1;
}
