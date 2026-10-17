import assert from 'node:assert/strict';
import { test } from 'node:test';
import { codeOf } from '../../testing/assertions';
import { createMemoryUsers } from '../../testing/memoryApp';
import { createAiAllowance } from './aiAllowance';
import { createUsersService } from './users.service';

/** What an admin changes on a user, and the daily AI limit, over users kept in memory. */

const PASSWORD = 'clave-larga';
const FAST_HASH_COST = 4;
const DAILY = 2;

async function setup() {
  const calendar = { today: '2026-10-17' };
  const repository = createMemoryUsers();
  const allowance = createAiAllowance(repository, { today: () => calendar.today, dailyReadings: DAILY });
  const users = createUsersService(repository, { hashCost: FAST_HASH_COST, aiAllowance: allowance });
  const admin = await users.create({ username: 'Adrián', password: PASSWORD, role: 'admin' });
  const ana = await users.create({ username: 'Ana', password: PASSWORD, role: 'user' });
  return { users, allowance, admin, ana, calendar };
}

test('an admin renames a user and changes their type; the new name signs in', async () => {
  const { users, admin, ana } = await setup();
  const renamed = await users.update(ana.id, { username: 'Ana María', role: 'admin' }, admin.id);
  assert.deepEqual([renamed.username, renamed.role], ['Ana María', 'admin']);
  assert.ok(await users.authenticate('ana maria', PASSWORD));
  assert.equal(await users.authenticate('Ana', PASSWORD), null);

  // A name somebody else has is refused, whatever its case or accents; keeping one's own is fine.
  assert.equal(await codeOf(users.update(ana.id, { username: 'adrian' }, admin.id)), 'DUPLICATE');
  assert.equal((await users.update(ana.id, { username: 'ANA MARÍA' }, admin.id)).username, 'ANA MARÍA');
});

test('an admin cannot stop being one, so there is always an admin left', async () => {
  const { users, admin } = await setup();
  assert.equal(await codeOf(users.update(admin.id, { role: 'user' }, admin.id)), 'CONFLICT');
  // Saving their own type unchanged, or their own name, is allowed.
  assert.equal(
    (await users.update(admin.id, { role: 'admin', username: 'Adri' }, admin.id)).username,
    'Adri',
  );
});

test('each user sends to the AI up to their daily limit, and a new day starts again', async () => {
  const { users, allowance, admin, ana, calendar } = await setup();
  await allowance.take(ana.id);
  await allowance.take(ana.id);
  assert.equal(await codeOf(allowance.take(ana.id)), 'AI_LIMIT');
  // Somebody else's count is their own.
  await allowance.take(admin.id);
  assert.deepEqual(
    (await users.list()).map((user) => [user.username, user.aiReadingsToday, user.aiLimit]),
    [
      ['Adrián', 1, DAILY],
      ['Ana', DAILY, DAILY],
    ],
  );

  calendar.today = '2026-10-18';
  assert.equal((await users.list())[1]?.aiReadingsToday, 0);
  await allowance.take(ana.id);

  // The admin gives her a limit of her own; zero means no AI at all.
  await users.update(ana.id, { aiDailyLimit: 0 }, admin.id);
  assert.equal(await codeOf(allowance.take(ana.id)), 'AI_LIMIT');
  const back = await users.update(ana.id, { aiDailyLimit: null }, admin.id);
  assert.deepEqual([back.aiDailyLimit, back.aiLimit], [null, DAILY]);
});
