import { Schema, model } from 'mongoose';
import { COLLECTIONS } from '../../core/db/collections';

/** The single document that holds what the server remembers about sessions. */
export const AUTH_STATE_ID = 'state';

export interface AuthStateDoc {
  _id: string;
  /** Sessions started before this moment are no longer accepted. */
  sessionsValidFrom: Date;
}

export const AuthStateModel = model<AuthStateDoc>(
  'AuthState',
  new Schema<AuthStateDoc>({ _id: String, sessionsValidFrom: { type: Date, required: true } }),
  COLLECTIONS.authState,
);
