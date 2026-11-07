import assert from 'node:assert/strict';
import { test } from 'node:test';
import jwt from 'jsonwebtoken';
import { codeOf } from '../../testing/assertions';
import { createMemoryUsers } from '../../testing/memoryApp';
import { createAiAllowance } from '../users/aiAllowance';
import { createUsersService } from '../users/users.service';
import { type UsersRepository } from '../users/users.repository';
import { createAuthService } from './auth.service';

/** Users and their sessions together, as they run in the app, over users kept in memory. */

const SECRET = 's'.repeat(40);
const PASSWORD = 'clave-larga';
const FAST_HASH_COST = 4;
/** Sessions do not depend on the AI limit; any one will do. */
const DAILY_READINGS = 30;

/** Users kept in memory, with the options every users service needs. */
function usersOver(repository: UsersRepository = createMemoryUsers()) {
  const aiAllowance = createAiAllowance(repository, {
    today: () => '2026-10-10',
    dailyReadings: DAILY_READINGS,
  });
  return { repository, options: { hashCost: FAST_HASH_COST, aiAllowance } };
}

async function setup() {
  const welcomed: string[] = [];
  const { repository, options } = usersOver();
  const users = createUsersService(repository, {
    ...options,
    onCreated: async (user) => {
      welcomed.push(user.username);
    },
  });
  const auth = createAuthService({ jwtSecret: SECRET, expiresDays: 30 }, users);
  const admin = await users.create({ username: 'Adrián', password: PASSWORD, role: 'admin' });
  const signIn = async (username: string, password = PASSWORD) =>
    (await auth.login({ username, password })).token;
  return { users, auth, admin, signIn, welcomed };
}

test('the right user and password get a token that says who it is', async () => {
  const { auth, admin, signIn } = await setup();
  const session = await auth.verify(await signIn('adrian'));
  assert.deepEqual(
    [session?.userId, session?.username, session?.role],
    [admin.id, 'Adrián', 'admin'],
    'the name is found whatever its case or accents',
  );
});

test('a wrong user, a wrong password and a forged token are all rejected', async () => {
  const { auth, admin } = await setup();
  assert.equal(
    await codeOf(auth.login({ username: 'adrian', password: 'otra-clave' })),
    'INVALID_CREDENTIALS',
  );
  assert.equal(await codeOf(auth.login({ username: 'otro', password: PASSWORD })), 'INVALID_CREDENTIALS');
  assert.equal(await auth.verify('no-es-un-token'), null);
  const forged = jwt.sign({ sub: admin.id, sv: 0 }, 'x'.repeat(40), { expiresIn: 60 });
  assert.equal(await auth.verify(forged), null);
  // A token from before users existed named the user instead of their id.
  assert.equal(await auth.verify(jwt.sign({ sub: 'adrian' }, SECRET, { expiresIn: 60 })), null);
});

test("signing out everywhere closes that user's sessions and nobody else's", async () => {
  const { users, auth, admin, signIn } = await setup();
  await users.create({ username: 'ana', password: PASSWORD, role: 'user' });
  const [mine, hers] = [await signIn('adrian'), await signIn('ana')];

  await auth.revokeAll(admin.id);
  assert.equal(await auth.verify(mine), null);
  assert.equal((await auth.verify(hers))?.username, 'ana');
  // A new sign-in works at once, even in the same second.
  assert.equal((await auth.verify(await signIn('adrian')))?.userId, admin.id);
});

test('a new password closes the sessions opened with the old one', async () => {
  const { users, auth, admin, signIn } = await setup();
  const before = await signIn('adrian');

  assert.equal(
    await codeOf(users.changePassword(admin.id, { currentPassword: 'no-es', newPassword: 'otra-clave-1' })),
    'VALIDATION',
  );
  await users.changePassword(admin.id, { currentPassword: PASSWORD, newPassword: 'otra-clave-1' });
  assert.equal(await auth.verify(before), null);
  assert.equal(await codeOf(auth.login({ username: 'adrian', password: PASSWORD })), 'INVALID_CREDENTIALS');
  assert.ok(await signIn('adrian', 'otra-clave-1'));
});

test('an admin creates users, resets their password and switches them off', async () => {
  const { users, auth, admin, signIn, welcomed } = await setup();
  const ana = await users.create({ username: 'Ana', password: PASSWORD, role: 'user' });
  assert.deepEqual(welcomed, ['Adrián', 'Ana'], 'each new user is given their starting data');
  assert.equal(
    await codeOf(users.create({ username: 'ANA', password: PASSWORD, role: 'user' })),
    'DUPLICATE',
  );
  assert.deepEqual(
    (await users.list()).map((user) => [user.username, user.role, user.active]),
    [
      ['Adrián', 'admin', true],
      ['Ana', 'user', true],
    ],
  );
  assert.equal(JSON.stringify(await users.list()).includes('passwordHash'), false);

  const hers = await signIn('ana');
  await users.update(ana.id, { password: 'clave-nueva-1' }, admin.id);
  assert.equal(await auth.verify(hers), null);
  const again = await signIn('ana', 'clave-nueva-1');

  await users.update(ana.id, { active: false }, admin.id);
  assert.equal(await auth.verify(again), null);
  assert.equal(
    await codeOf(auth.login({ username: 'ana', password: 'clave-nueva-1' })),
    'INVALID_CREDENTIALS',
  );
  await users.update(ana.id, { active: true }, admin.id);
  assert.ok(await signIn('ana', 'clave-nueva-1'));

  // Nobody locks themselves out, and a user that does not exist is said so.
  assert.equal(await codeOf(users.update(admin.id, { active: false }, admin.id)), 'CONFLICT');
  assert.equal(await codeOf(users.update('f'.repeat(24), { active: false }, admin.id)), 'NOT_FOUND');
});

test('the first user comes from the configuration, once', async () => {
  const { repository, options } = usersOver();
  const users = createUsersService(repository, options);
  const first = await users.ensureFirst({ username: 'dueño', passwordHash: 'hash-de-la-configuracion' });
  assert.equal(first?.role, 'admin');
  assert.equal(await users.ensureFirst({ username: 'otro', passwordHash: 'x' }), null);
  assert.equal((await users.list()).length, 1);
});
