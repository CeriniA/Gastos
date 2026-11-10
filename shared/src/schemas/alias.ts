import { z } from 'zod';
import { MAX_ALIASES_PER_ITEM, TEXT_LIMITS } from '../constants';

/** The texts a receipt or statement prints for one merchant or product. */
export const aliasListSchema = z
  .array(z.string().trim().min(1).max(TEXT_LIMITS.description))
  .max(MAX_ALIASES_PER_ITEM);
