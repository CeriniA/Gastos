import { createApp } from './app';
import { createContainer } from './composition';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './core/db/connection';
import { runMigrations } from './core/db/migrations';
import { logger } from './core/logger';
import { migrations } from './migrations';

const DAY_MS = 24 * 60 * 60 * 1000;

async function main(): Promise<void> {
  await connectDatabase(env.MONGODB_URI);
  await runMigrations(migrations);

  const container = createContainer(env);

  // The free Render instance sleeps, so the trash is emptied on every start
  // as well as once a day while it stays awake.
  const purgeTrash = async () => {
    try {
      const purged = await container.transactions.purgeTrash();
      if (purged > 0) logger.info({ purged }, 'Trash purged');
    } catch (error) {
      logger.error({ err: error }, 'Trash purge failed');
    }
  };
  await purgeTrash();
  setInterval(() => void purgeTrash(), DAY_MS).unref();

  const server = createApp(container, env).listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Server listening');
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    server.close(() => {
      void disconnectDatabase().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Server failed to start');
  process.exit(1);
});
