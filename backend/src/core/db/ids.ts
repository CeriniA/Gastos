import { Types } from 'mongoose';

export type ObjectId = Types.ObjectId;

/** An ObjectId written as text has this many hexadecimal characters. */
export const OBJECT_ID_LENGTH = 24;

export function toObjectId(id: string): ObjectId {
  return new Types.ObjectId(id);
}

export function toObjectIdOrNull(id: string | null | undefined): ObjectId | null {
  return id ? new Types.ObjectId(id) : null;
}

export function idString(id: ObjectId | null | undefined): string | null {
  return id ? id.toString() : null;
}

export function isoString(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}
