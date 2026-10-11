import mongoose from 'mongoose';
import { logger } from '../logger';

export async function connectDatabase(uri: string): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15_000 });
  logger.info({ database: mongoose.connection.name }, 'Database connected');
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export function isDatabaseUp(): boolean {
  return mongoose.connection.readyState === 1;
}
