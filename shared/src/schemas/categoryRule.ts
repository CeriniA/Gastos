import { z } from 'zod';
import { objectIdSchema } from './common';

/** "This merchant always goes to this category." One rule per merchant. */
export const categoryRuleInputSchema = z.object({
  merchant: z.string().trim().min(1).max(200),
  categoryId: objectIdSchema,
});
export type CategoryRuleInput = z.infer<typeof categoryRuleInputSchema>;

export interface CategoryRule {
  id: string;
  merchant: string;
  categoryId: string;
  createdAt: string;
  updatedAt: string;
}
