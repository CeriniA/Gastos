import { z } from 'zod';
import { aliasListSchema } from './alias';
import { nameSchema, objectIdSchema } from './common';

export const productCreateSchema = z.object({
  name: nameSchema,
  categoryId: objectIdSchema,
  aliases: aliasListSchema.default([]),
});
export type ProductCreate = z.infer<typeof productCreateSchema>;

export const productUpdateSchema = z
  .object({
    name: nameSchema.optional(),
    categoryId: objectIdSchema.optional(),
    aliases: aliasListSchema.optional(),
    archived: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');
export type ProductUpdate = z.infer<typeof productUpdateSchema>;

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  /** Known texts: what receipts print for this product. */
  aliases: string[];
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}
