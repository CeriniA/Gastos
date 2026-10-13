import { createApp } from './app';
import { createContainer } from './composition';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './core/db/connection';
import { runMigrations } from './core/db/migrations';
import { logger } from './core/logger';
import { migrations } from './migrations';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
/** Time given to finish open requests on shutdown before forcing the exit. */
const SHUTDOWN_GRACE_MS = 10_000;

async function main(): Promise<void> {
  await connectDatabase(env.MONGODB_URI);
  await runMigrations(migrations);

  const container = createContainer(env);
  // Sessions closed with "sign out everywhere" stay closed across restarts.
  await container.auth.init();

  // The free Render instance sleeps, so the clean-up runs on every start
  // as well as once a day while it stays awake.
  const cleanUp = async () => {
    try {
      const purged = await container.transactions.purgeTrash();
      if (purged > 0) logger.info({ purged }, 'Trash purged');
      const due = await container.transactions.confirmDue();
      if (due > 0) logger.info({ due }, 'Installments due confirmed');
      const dropped = await container.documents.purgeStale();
      if (dropped > 0) logger.info({ dropped }, 'Unreviewed uploads dropped');
    } catch (error) {
      logger.error({ err: error }, 'Clean-up failed');
    }
  };
  await cleanUp();
  setInterval(() => void cleanUp(), DAY_MS).unref();
  // The copy to Drive is checked on waking and every hour; it only writes once a day.
  void container.driveBackup.runIfDue();
  setInterval(() => void container.driveBackup.runIfDue(), HOUR_MS).unref();
  // Documents waiting for the AI to have room again are tried when their time comes.
  setInterval(() => container.documents.resume(), MINUTE_MS).unref();

  const server = createApp(container, env).listen(env.PORT, () => {
    logger.info(
      {
        port: env.PORT,
        env: env.NODE_ENV,
        ai: env.GEMINI_API_KEY ? env.GEMINI_MODEL : 'off',
        driveBackup: env.DRIVE_REFRESH_TOKEN ? 'on' : 'off',
      },
      'Server listening',
    );
    // Documents a restart left half-way are picked up again.
    container.documents.resume();
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    server.close(() => {
      void disconnectDatabase().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), SHUTDOWN_GRACE_MS).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Server failed to start');
  process.exit(1);
});
