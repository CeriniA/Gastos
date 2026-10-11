import { z } from 'zod';
import { nameSchema } from './common';

export const tagInputSchema = z.object({ name: nameSchema });
export type TagInput = z.infer<typeof tagInputSchema>;

export interface Tag {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}
