import type { IsoDate, User } from '@gastos/shared';
import { currentUserId, runAsUser } from './core/context/owner';
import { createSecretBox } from './core/crypto/secretBox';
import { createTicketOffice } from './core/crypto/signedTicket';
import type { CollectionPort } from './core/db/collectionPort';
import type { ForEachUser } from './core/db/migrations';
import type { TransactionRunner } from './core/db/transaction';
import { createAuthService, type AuthService } from './modules/auth';
import {
  createBackupService,
  createDriveBackup,
  type BackupService,
  type DriveBackup,
} from './modules/backup';
import { createUsersService, type UsersRepository, type UsersService } from './modules/users';
import type { BackupStoreProvider } from './providers/drive/googleDrive';
import { giveStarterData } from './starter';
import type { Services } from './wiring';

/** What each derived key is for: one secret, a different key per use. */
const DRIVE_PERMISSION_PURPOSE = 'drive-permission';
const DRIVE_CONNECT_PURPOSE = 'drive-connect';
/** How long a user has to answer Google's page before having to start again. */
const DRIVE_CONNECT_SECONDS = 600;

/** Everything the HTTP layer and the server's own chores work with. */
export interface Container extends Services {
  auth: AuthService;
  users: UsersService;
  backup: BackupService;
  driveBackup: DriveBackup;
  /** Runs some work once for every user, as that user. */
  forEachUser: ForEachUser;
  /** Gives a user their starting categories and accounts, if they have nothing. */
  welcome(user: User): Promise<void>;
}

export interface ContainerParts {
  services: Services;
  usersRepository: UsersRepository;
  collectionPorts: readonly CollectionPort[];
  runInTransaction: TransactionRunner;
  /** Null when the server has no Google credentials. */
  driveProvider: BackupStoreProvider | null;
  /** Brings a restored backup up to date; receives the migrations it had been through. */
  afterRestore(appliedMigrations: readonly string[]): Promise<void>;
  now(): Date;
  onError(error: unknown, context: object): void;
  /** The server's own secret: it signs sessions and seals what must stay private. */
  secret: string;
  sessionDays: number;
  /** Tests lower it so they do not spend their time hashing. */
  passwordHashCost?: number;
  /** Today's calendar day: the AI limit counts per day. */
  today: () => IsoDate;
  /** Documents a user sends to the AI per day unless the admin gives them another limit. */
  aiDailyReadings: number;
}

/**
 * Puts users, sessions, backup and Drive on top of the wired services. The
 * same assembly runs in production (composition.ts) and in memory
 * (testing/memoryApp.ts); only the parts handed in differ.
 */
export function buildContainer(parts: ContainerParts): Container {
  const { services, secret } = parts;

  const welcome = (user: User) => runAsUser(user.id, () => giveStarterData(services));
  const users = createUsersService(parts.usersRepository, {
    hashCost: parts.passwordHashCost,
    onCreated: welcome,
    today: parts.today,
    aiDailyReadings: parts.aiDailyReadings,
  });
  const auth = createAuthService({ jwtSecret: secret, expiresDays: parts.sessionDays }, users);

  const backup = createBackupService(
    parts.collectionPorts,
    { afterRestore: parts.afterRestore },
    parts.runInTransaction,
  );

  // A user's permission to write in their Drive is stored sealed: a copy of
  // the database alone does not give anybody access to it.
  const permissions = createSecretBox(secret, DRIVE_PERMISSION_PURPOSE);
  const driveBackup = createDriveBackup({
    provider: parts.driveProvider,
    account: {
      id: currentUserId,
      async permission() {
        const sealed = await users.driveToken(currentUserId());
        return sealed ? permissions.open(sealed) : null;
      },
      setPermission: (permission) =>
        users.setDriveToken(currentUserId(), permission ? permissions.seal(permission) : null),
    },
    tickets: createTicketOffice(secret, DRIVE_CONNECT_PURPOSE, DRIVE_CONNECT_SECONDS),
    exportAll: () => backup.exportAll(),
    now: parts.now,
    onError: parts.onError,
  });

  const forEachUser: ForEachUser = async (work) => {
    for (const user of await users.list()) await runAsUser(user.id, work);
  };

  return { ...services, auth, users, backup, driveBackup, forEachUser, welcome };
}
