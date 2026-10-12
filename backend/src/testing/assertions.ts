import assert from 'node:assert/strict';
import { AppError } from '../core/errors/errors';

/** The error code a rejected operation failed with. Fails the test if it did not fail with an AppError. */
export async function codeOf(work: Promise<unknown>): Promise<string> {
  try {
    await work;
  } catch (error) {
    assert.ok(error instanceof AppError, `expected an AppError, got ${String(error)}`);
    return error.code;
  }
  assert.fail('expected the operation to be rejected');
}
