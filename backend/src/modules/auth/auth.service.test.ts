import assert from 'node:assert/strict';
import { test } from 'node:test';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../../core/errors/errors';
import { createAuthService, type AuthStateStore } from './auth.service';

const SECRET = 's'.repeat(40);
const HOUR_MS = 60 * 60 * 1000;

function setup(stored: Date | null = null) {
  const saved: { value: Date | null } = { value: stored };
  const state: AuthStateStore = {
    load: async () => saved.value,
    save: async (moment) => {
      saved.value = moment;
    },
  };
  const service = createAuthService(
    { username: 'adrian', passwordHash: bcrypt.hashSync('clave', 4), jwtSecret: SECRET, expiresDays: 30 },
    state,
  );
  /** A token as the service would have issued it at a given moment. */
  const issuedAt = (moment: Date) =>
    jwt.sign({ sub: 'adrian', iat: Math.floor(moment.getTime() / 1000) }, SECRET, {
      algorithm: 'HS256',
      expiresIn: 3600 * 24 * 30,
    });
  return { service, state, saved, issuedAt };
}

test('the right user and password get a token that is accepted', async () => {
  const { service } = setup();
  const { token } = await service.login({ username: 'adrian', password: 'clave' });
  assert.equal(service.verify(token)?.username, 'adrian');
});

test('a wrong user, a wrong password and a forged token are all rejected', async () => {
  const { service } = setup();
  await assert.rejects(service.login({ username: 'adrian', password: 'otra' }), UnauthorizedError);
  await assert.rejects(service.login({ username: 'otro', password: 'clave' }), UnauthorizedError);
  assert.equal(service.verify('no-es-un-token'), null);
  assert.equal(service.verify(jwt.sign({ sub: 'adrian' }, 'x'.repeat(40), { expiresIn: 60 })), null);
  assert.equal(service.verify(jwt.sign({ sub: 'otro' }, SECRET, { expiresIn: 60 })), null);
});

test('signing out everywhere closes every earlier session and lets a new one in', async () => {
  const { service, issuedAt } = setup();
  // Relative to today so the tokens are never expired when the test runs.
  const now = new Date(Math.floor(Date.now() / 1000) * 1000 - HOUR_MS + 500);
  const old = issuedAt(new Date(now.getTime() - 10 * 24 * HOUR_MS));
  const sameSecond = issuedAt(now);
  assert.ok(service.verify(old));

  await service.revokeAll(now);
  assert.equal(service.verify(old), null);
  assert.equal(service.verify(sameSecond), null);
  assert.ok(service.verify(issuedAt(new Date(now.getTime() + 1000))));
});

test('closed sessions stay closed after a restart', async () => {
  const first = setup();
  const old = first.issuedAt(new Date(Date.now() - 10 * 24 * HOUR_MS));
  await first.service.revokeAll(new Date(Date.now() - HOUR_MS));

  const restarted = setup(first.saved.value);
  // Until the stored state is read the server cannot know; init is awaited before listening.
  await restarted.service.init();
  assert.equal(restarted.service.verify(old), null);
});
