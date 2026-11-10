import { z } from 'zod';
import { aliasListSchema } from './alias';
import { nameSchema, objectIdSchema } from './common';

export const merchantCreateSchema = z.object({
  name: nameSchema,
  /** Suggested when the merchant is chosen. */
  defaultCategoryId: objectIdSchema.nullable().default(null),
  aliases: aliasListSchema.default([]),
});
export type MerchantCreate = z.infer<typeof merchantCreateSchema>;

export const merchantUpdateSchema = z
  .object({
    name: nameSchema.optional(),
    defaultCategoryId: objectIdSchema.nullable().optional(),
    aliases: aliasListSchema.optional(),
    archived: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');
export type MerchantUpdate = z.infer<typeof merchantUpdateSchema>;

export interface Merchant {
  id: string;
  name: string;
  defaultCategoryId: string | null;
  /** Known texts: what receipts print for this merchant. */
  aliases: string[];
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}
