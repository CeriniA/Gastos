import { z } from 'zod';
import { CATEGORY_KINDS, type CategoryKind } from '../constants';
import { nameSchema, objectIdSchema } from './common';

export const categoryCreateSchema = z.object({
  name: nameSchema,
  kind: z.enum(CATEGORY_KINDS),
  parentId: objectIdSchema.nullable().default(null),
});
export type CategoryCreate = z.infer<typeof categoryCreateSchema>;

/** The kind is fixed at creation. Changing parentId moves the whole subtree. */
export const categoryUpdateSchema = z
  .object({
    name: nameSchema.optional(),
    parentId: objectIdSchema.nullable().optional(),
    archived: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');
export type CategoryUpdate = z.infer<typeof categoryUpdateSchema>;

export const categoryMergeSchema = z.object({ targetId: objectIdSchema });
export type CategoryMerge = z.infer<typeof categoryMergeSchema>;

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  parentId: string | null;
  /** 1 for a root category, up to MAX_CATEGORY_DEPTH. Computed, never stored. */
  depth: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}
