import type { DocumentImageType } from '@gastos/shared';

/**
 * The real type of an uploaded file, read from its first bytes. The name and
 * the type the browser declares are not trusted.
 */
export function detectImageType(content: Buffer): DocumentImageType | null {
  if (content.length < 12) return null;
  if (content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff) return 'image/jpeg';
  if (content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return 'image/png';
  if (content.toString('ascii', 0, 4) === 'RIFF' && content.toString('ascii', 8, 12) === 'WEBP')
    return 'image/webp';
  return null;
}
