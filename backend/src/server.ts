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

  const container = createContainer(env);
  // Somebody has to be able to sign in: the first time, the admin of the configuration.
  const firstUser = await container.users.ensureFirst({
    username: env.AUTH_USERNAME,
    passwordHash: env.AUTH_PASSWORD_HASH,
  });
  await runMigrations(migrations, container.forEachUser);
  if (firstUser) await container.welcome(firstUser);

  /** The server's own chores have no request behind them: they run for each user in turn. */
  const forEveryUser = (chore: string, work: () => Promise<void>) =>
    container
      .forEachUser(work)
      .catch((error: unknown) => logger.error({ err: error, chore }, 'Chore failed'));

  // The free Render instance sleeps, so the clean-up runs on every start
  // as well as once a day while it stays awake.
  const cleanUp = () =>
    forEveryUser('clean-up', async () => {
      const purged = await container.transactions.purgeTrash();
      const due = await container.transactions.confirmDue();
      const dropped = await container.documents.purgeStale();
      if (purged + due + dropped > 0) logger.info({ purged, due, dropped }, 'Clean-up done');
    });
  // The copy to Drive is checked on waking and every hour; it only writes once a day.
  const backUp = () =>
    forEveryUser('drive-backup', async () => {
      await container.driveBackup.runIfDue();
    });
  // Documents a restart left half-way, or waiting for the AI to have room again, are picked up.
  const resumeDocuments = () => forEveryUser('documents', async () => container.documents.resume());

  await cleanUp();
  setInterval(() => void cleanUp(), DAY_MS).unref();
  void backUp();
  setInterval(() => void backUp(), HOUR_MS).unref();
  setInterval(() => void resumeDocuments(), MINUTE_MS).unref();

  const server = createApp(container, env).listen(env.PORT, () => {
    logger.info(
      {
        port: env.PORT,
        env: env.NODE_ENV,
        ai: env.GEMINI_API_KEY ? env.GEMINI_MODEL : 'off',
        driveBackup: env.DRIVE_CLIENT_ID && env.PUBLIC_API_URL ? 'on' : 'off',
      },
      'Server listening',
    );
    void resumeDocuments();
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    server.close(() => {
      void disconnectDatabase().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), SHUTDOWN_GRACE_MS).unref();
  };
  // A promise nobody waited for failed: it is logged and the server keeps serving. Since Node 15 it
  // would otherwise end the process without a word in our log.
  process.on('unhandledRejection', (reason) => logger.error({ err: reason }, 'Unhandled rejection'));
  // After an exception nobody caught the process state can no longer be trusted: log it and restart.
  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception');
    process.exit(1);
  });
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Server failed to start');
  process.exit(1);
});
