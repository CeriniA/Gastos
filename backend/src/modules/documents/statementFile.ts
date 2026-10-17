import type { StatementFileType } from '@gastos/shared';

/**
 * A statement's file turned into text. Banks and apps let their movements be
 * downloaded as PDF, Excel or CSV; whichever it is, what the user approves and
 * the AI reads is plain text.
 */

/** Every PDF file starts with these bytes, whatever its name says. */
const PDF_SIGNATURE = '%PDF-';
/** An .xlsx file is a zip archive. */
const ZIP_SIGNATURE = 'PK\u0003\u0004';
/** An old .xls file (Excel 97 to 2003) is an OLE container; the spreadsheet library cannot read it. */
const OLD_EXCEL_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0]);
/** A text file has no NUL bytes in its first kilobytes; a binary file almost always has. */
const SNIFF_BYTES = 4096;
/** What UTF-8 decoding puts where the bytes were not UTF-8. */
const REPLACEMENT_CHAR = '\uFFFD';
/** How cells of a spreadsheet row are told apart in the text. */
const CELL_SEPARATOR = ' | ';

/** What a file is, by its first bytes, not by its name. Null: none the app reads. */
export function statementFileType(content: Buffer): StatementFileType | 'old_excel' | null {
  const head = content.toString('latin1', 0, PDF_SIGNATURE.length);
  if (head.startsWith(PDF_SIGNATURE)) return 'pdf';
  if (head.startsWith(ZIP_SIGNATURE)) return 'xlsx';
  if (content.subarray(0, OLD_EXCEL_SIGNATURE.length).equals(OLD_EXCEL_SIGNATURE)) return 'old_excel';
  return content.subarray(0, SNIFF_BYTES).includes(0) ? null : 'csv';
}

/** A text file as UTF-8, or as Latin-1 when it is not: Excel on Windows saves CSV that way. */
export function decodeText(content: Buffer): string {
  const utf8 = content.toString('utf8').replace(/^\uFEFF/, '');
  return utf8.includes(REPLACEMENT_CHAR) ? content.toString('latin1') : utf8;
}

/** One cell as text: a date as YYYY-MM-DD, anything else as it is written. */
function cellText(cell: unknown): string {
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  return String(cell ?? '').trim();
}

/** A spreadsheet's rows as lines of text, its cells separated by " | ". */
export function rowsToText(rows: readonly { cells: readonly unknown[] }[]): string {
  return rows.map((row) => row.cells.map(cellText).join(CELL_SEPARATOR)).join('\n');
}
