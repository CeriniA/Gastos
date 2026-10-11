import type { Category, DocumentKind, ExtractionResult } from '@gastos/shared';

/**
 * The app's only view of an AI model: hand over a file, get back a structured
 * extraction. Nothing outside this folder knows which provider is behind it,
 * so swapping Gemini for another service or a local model is one new file
 * plus one line in the composition root.
 *
 * Implementations must:
 * - return data that passes extractionResultSchema (the caller validates it
 *   again and treats a failure as AiProviderError);
 * - throw AiProviderError for network errors, rate limits and refusals;
 * - never return card numbers or personal identifiers.
 */
export interface AiExtractor {
  /** Version of the instructions sent to the model; stored on each document. */
  readonly promptVersion: number;

  extract(input: {
    kind: DocumentKind;
    content: Buffer;
    mimeType: string;
    /** The user's categories: the model may only suggest one of these. */
    categories: readonly Pick<Category, 'id' | 'name' | 'kind' | 'parentId'>[];
  }): Promise<ExtractionResult>;
}
