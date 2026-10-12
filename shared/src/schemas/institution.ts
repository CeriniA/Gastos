import { z } from 'zod';
import { INSTITUTION_KINDS, type InstitutionKind } from '../constants';
import { nameSchema } from './common';

/** A bank or card brand the user's accounts can be tied to. */
export const institutionCreateSchema = z.object({
  name: nameSchema,
  kind: z.enum(INSTITUTION_KINDS),
});
export type InstitutionCreate = z.infer<typeof institutionCreateSchema>;

/** The kind is fixed at creation: accounts rely on it. */
export const institutionUpdateSchema = z
  .object({ name: nameSchema.optional(), archived: z.boolean().optional() })
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');
export type InstitutionUpdate = z.infer<typeof institutionUpdateSchema>;

export interface Institution {
  id: string;
  name: string;
  kind: InstitutionKind;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}
