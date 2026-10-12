import { DOCUMENT_IMAGE_TYPES, type UploadableDocumentKind } from '@gastos/shared';

/**
 * Shrinks a photo in the browser before uploading, so it travels fast on
 * mobile data and fits the server's limits. If anything goes wrong the
 * original file is sent as it is.
 */

/** Screenshots are tall and full of small text, so they keep more pixels. */
const MAX_SIDE: Record<UploadableDocumentKind, number> = { receipt: 1800, screenshot: 2400 };
const SMALL_ENOUGH_BYTES = 1_200_000;
/** Small text on receipts stays readable at this quality, at a fraction of the size. */
const JPEG_QUALITY = 0.85;
/** What the server accepts as it is; anything else is converted to JPEG. */
const ACCEPTED: readonly string[] = DOCUMENT_IMAGE_TYPES;

export async function compressImage(file: File, kind: UploadableDocumentKind): Promise<File> {
  if (ACCEPTED.includes(file.type) && file.size <= SMALL_ENOUGH_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE[kind] / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    );
    if (!blob) return file;
    // Keep the original when it is already an accepted type and no bigger.
    if (ACCEPTED.includes(file.type) && blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
