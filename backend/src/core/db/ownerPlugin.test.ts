import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Schema, model, type Query } from 'mongoose';
import { runAsSystem, runAsUser } from '../context/owner';
import {
  OWNER_FIELD,
  ownBulkOperation,
  ownedByUser,
  ownedModels,
  ownedOnly,
  stampOwner,
} from './ownerPlugin';

/**
 * What keeps one user's data apart from another's, exercised on Mongoose
 * itself but without a database: the hooks run, nothing is sent.
 */

const ANA = 'a'.repeat(24);
const BETO = 'b'.repeat(24);

const schema = new Schema({ name: String });
schema.plugin(ownedByUser);
const Thing = model('OwnedThing', schema);

/** The filter a query would send, after the hooks every query goes through. */
async function filterSent(query: Query<unknown, unknown>): Promise<Record<string, unknown>> {
  const internals = query as unknown as {
    op: string;
    _queryMiddleware: {
      execPre(op: string, context: unknown, args: [], done: (error?: Error) => void): void;
    };
  };
  await new Promise<void>((resolve, reject) => {
    internals._queryMiddleware.execPre(internals.op, query, [], (error) =>
      error ? reject(error) : resolve(),
    );
  });
  return query.getFilter();
}

const QUERIES: Record<string, () => Query<unknown, unknown>> = {
  find: () => Thing.find({ name: 'x' }),
  findOne: () => Thing.findOne({ name: 'x' }),
  findById: () => Thing.findById(ANA),
  countDocuments: () => Thing.countDocuments({ name: 'x' }),
  distinct: () => Thing.distinct('name'),
  updateOne: () => Thing.updateOne({ name: 'x' }, { name: 'y' }),
  updateMany: () => Thing.updateMany({ name: 'x' }, { name: 'y' }),
  findOneAndUpdate: () => Thing.findOneAndUpdate({ name: 'x' }, { name: 'y' }),
  findByIdAndUpdate: () => Thing.findByIdAndUpdate(ANA, { name: 'y' }),
  replaceOne: () => Thing.replaceOne({ name: 'x' }, { name: 'y' }),
  deleteOne: () => Thing.deleteOne({ name: 'x' }),
  deleteMany: () => Thing.deleteMany({ name: 'x' }),
  findOneAndDelete: () => Thing.findOneAndDelete({ name: 'x' }),
};

test("every kind of query only reaches the running user's documents", async () => {
  for (const [name, build] of Object.entries(QUERIES)) {
    const filter = await runAsUser(BETO, () => filterSent(build()));
    assert.equal(String(filter[OWNER_FIELD]), BETO, `${name} is not narrowed to its user`);
  }
});

test('a filter that names another user cannot widen the query', async () => {
  const filter = await runAsUser(BETO, () => filterSent(Thing.find({ [OWNER_FIELD]: ANA })));
  assert.equal(String(filter[OWNER_FIELD]), BETO);
});

test('without a user there is no query at all', async () => {
  for (const [name, build] of Object.entries(QUERIES)) {
    await assert.rejects(filterSent(build()), /without saying whose/, `${name} ran for nobody`);
  }
  assert.throws(() => ownedOnly(), /without saying whose/);
  assert.throws(() => stampOwner({}), /without saying whose/);
});

test('a new document is stamped with the running user, whatever it claimed', async () => {
  const thing = new Thing({ name: 'x', [OWNER_FIELD]: ANA });
  await runAsUser(BETO, () => thing.validate());
  assert.equal(String(thing.get(OWNER_FIELD)), BETO);

  assert.equal(String(runAsUser(BETO, () => stampOwner({ [OWNER_FIELD]: ANA }))[OWNER_FIELD]), BETO);
  // Nobody to stamp it with, and no owner of its own: it is not valid.
  await assert.rejects(
    runAsSystem(() => new Thing({ name: 'x' }).validate()),
    /userId/,
  );
});

test('each operation of a bulk write is narrowed or stamped too', () => {
  const update = { updateOne: { filter: { _id: 1 }, update: { $set: { name: 'y' } } } };
  const remove = { deleteMany: { filter: {} } };
  const insert = { insertOne: { document: { name: 'x' } } };
  runAsUser(BETO, () => [update, remove, insert].forEach(ownBulkOperation));

  assert.equal(String((update.updateOne.filter as Record<string, unknown>)[OWNER_FIELD]), BETO);
  assert.equal(update.updateOne.filter._id, 1);
  assert.equal(String((remove.deleteMany.filter as Record<string, unknown>)[OWNER_FIELD]), BETO);
  assert.equal(String((insert.insertOne.document as Record<string, unknown>)[OWNER_FIELD]), BETO);
});

test("the migrations run over everybody's data: no narrowing, no stamping", async () => {
  const filter = await runAsSystem(() => filterSent(Thing.updateMany({ name: 'x' }, { name: 'y' })));
  assert.deepEqual(filter, { name: 'x' });
  assert.deepEqual(
    runAsSystem(() => ownedOnly()),
    {},
  );
  assert.ok(ownedModels().includes(Thing as never));
});
