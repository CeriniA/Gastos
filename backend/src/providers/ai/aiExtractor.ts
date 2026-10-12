import type {
  CategoryKind,
  DocumentErrorCode,
  DocumentKind,
  ExtractionResult,
  IsoDate,
} from '@gastos/shared';
import { AiProviderError } from '../../core/errors/errors';

/**
 * The app's only view of an AI model: hand over the images of a document (or
 * the text of a card statement), get back a structured extraction. Nothing outside this folder knows which
 * provider is behind it, so swapping Gemini for another service or a local
 * model is one new file plus one line in the composition root.
 *
 * Implementations must:
 * - return data that passes extractionResultSchema (the caller validates it
 *   again and treats a failure as an unreadable document);
 * - throw extractionFailure(...) for network errors, rate limits and refusals;
 * - never return card numbers or personal identifiers.
 */
export interface AiExtractor {
  /** Version of the instructions sent to the model; stored on each document. */
  readonly promptVersion: number;

  extract(input: ExtractionInput): Promise<ExtractionResult>;
}

export interface ExtractionInput {
  kind: DocumentKind;
  /** One image, or several parts of the same long receipt, in order. Empty for a card statement. */
  files: readonly { content: Buffer; mimeType: string }[];
  /** A card statement's text, personal data already hidden. */
  text?: string | null;
  /** The user's categories: the model may only suggest one of these. */
  categories: readonly ExtractionCategory[];
  /** Lets the model resolve "hoy", "ayer" and dates printed without a year. */
  today: IsoDate;
}

export interface ExtractionCategory {
  id: string;
  /** Full path, e.g. "Vivienda > Servicios > Luz". */
  path: string;
  kind: CategoryKind;
}

/** The one error providers throw. `reason` ends up on the document for the user to see. */
export function extractionFailure(
  reason: DocumentErrorCode,
  message: string,
  details?: object,
): AiProviderError {
  return new AiProviderError(message, { reason, ...details });
}

export function failureReason(error: unknown): DocumentErrorCode | null {
  if (!(error instanceof AiProviderError)) return null;
  const reason = (error.details as { reason?: DocumentErrorCode } | undefined)?.reason;
  return reason ?? 'unavailable';
}
