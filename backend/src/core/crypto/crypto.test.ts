import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSecretBox } from './secretBox';
import { createTicketOffice } from './signedTicket';

const SECRET = 's'.repeat(40);

test('what is sealed opens only with the same secret and purpose, and never reads the same twice', () => {
  const box = createSecretBox(SECRET, 'drive-permission');
  const sealed = box.seal('refresh-token-de-google');
  assert.equal(box.open(sealed), 'refresh-token-de-google');
  assert.equal(sealed.includes('refresh-token'), false);
  assert.notEqual(box.seal('refresh-token-de-google'), sealed);

  assert.equal(createSecretBox('x'.repeat(40), 'drive-permission').open(sealed), null);
  assert.equal(createSecretBox(SECRET, 'something-else').open(sealed), null);
  assert.equal(box.open(`${sealed.slice(0, -2)}AA`), null, 'a tampered value is refused');
  assert.equal(box.open('not sealed at all'), null);
});

test('a ticket says who it is about, to whoever issued it, for what it was issued', () => {
  const office = createTicketOffice(SECRET, 'drive-connect', 60);
  const ticket = office.issue('user-1');
  assert.equal(office.read(ticket), 'user-1');

  assert.equal(createTicketOffice(SECRET, 'something-else', 60).read(ticket), null);
  assert.equal(createTicketOffice('x'.repeat(40), 'drive-connect', 60).read(ticket), null);
  assert.equal(office.read(createTicketOffice(SECRET, 'drive-connect', -1).issue('user-1')), null, 'expired');
  assert.equal(office.read('garbage'), null);
});
