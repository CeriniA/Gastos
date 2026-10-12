import { AUTH_STATE_ID, AuthStateModel, type AuthStateDoc } from './auth.model';

/**
 * Where the "sign out everywhere" moment is kept. On purpose this collection
 * has no backup port: it is security state, not the user's data, and
 * restoring an old backup must not bring closed sessions back to life.
 */
export const authStateRepository = {
  async load(): Promise<Date | null> {
    const doc = await AuthStateModel.findById(AUTH_STATE_ID).lean<AuthStateDoc>();
    return doc?.sessionsValidFrom ?? null;
  },

  async save(sessionsValidFrom: Date): Promise<void> {
    await AuthStateModel.updateOne({ _id: AUTH_STATE_ID }, { $set: { sessionsValidFrom } }, { upsert: true });
  },
};

export type AuthStateRepository = typeof authStateRepository;
