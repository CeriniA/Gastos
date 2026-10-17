import ExcelJS from 'exceljs';
import {
  IMPORT_COLUMNS,
  centsToNumber,
  parseCsv,
  toCsv,
  toExportRecord,
  type ImportRow,
} from '@gastos/shared';

/** Excel column widths, in characters: room for text columns, compact for the rest. */
const WIDE_COLUMN = 32;
const NARROW_COLUMN = 16;

/**
 * Reading and writing the actual files. Kept apart from the service so the
 * import rules do not depend on a spreadsheet library.
 */

export interface TableRow {
  /** Row number as shown in the spreadsheet. */
  line: number;
  cells: unknown[];
}

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const HEADERS = IMPORT_COLUMNS.map((column) => column.header);
const AMOUNT_KEYS = new Set<string>(['amount', 'toAmount']);

/** Reduces the many shapes of an Excel cell (formula, rich text, link) to a plain value. */
function plainValue(value: unknown): unknown {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object' || value instanceof Date) return value;
  const cell = value as Record<string, unknown>;
  if ('result' in cell) return plainValue(cell.result);
  if (Array.isArray(cell.richText)) {
    return cell.richText.map((part: { text?: string }) => part.text ?? '').join('');
  }
  if ('text' in cell) return plainValue(cell.text);
  return '';
}

export function isCsv(fileName: string): boolean {
  return /\.(csv|txt)$/i.test(fileName);
}

export async function readTable(content: Buffer, fileName: string): Promise<TableRow[]> {
  if (isCsv(fileName)) {
    return parseCsv(content.toString('utf8')).map((cells, index) => ({ line: index + 1, cells }));
  }
  return readWorkbook(content);
}

/** The rows of an Excel file's first sheet that have something in them. */
export async function readWorkbook(content: Buffer): Promise<TableRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(content as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const rows: TableRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, line) => {
    // ExcelJS row values are 1-based: index 0 is always empty.
    const cells = (row.values as unknown[]).slice(1).map(plainValue);
    if (cells.some((cell) => String(cell ?? '').trim() !== '')) rows.push({ line, cells });
  });
  return rows;
}

export interface GeneratedFile {
  fileName: string;
  contentType: string;
  content: Buffer;
}

export function writeCsv(rows: readonly ImportRow[], fileName: string): GeneratedFile {
  const lines = rows.map((row) => {
    const record = toExportRecord(row);
    return IMPORT_COLUMNS.map((column) => record[column.key]);
  });
  return {
    fileName,
    contentType: 'text/csv; charset=utf-8',
    content: Buffer.from(toCsv([HEADERS, ...lines]), 'utf8'),
  };
}

export async function writeXlsx(rows: readonly ImportRow[], fileName: string): Promise<GeneratedFile> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Movimientos', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = IMPORT_COLUMNS.map((column) => ({
    header: column.header,
    key: column.key,
    width:
      column.key === 'description' || column.key === 'category' || column.key === 'note'
        ? WIDE_COLUMN
        : NARROW_COLUMN,
    style: AMOUNT_KEYS.has(column.key) ? { numFmt: '#,##0.00' } : {},
  }));
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    const record: Record<string, string | number> = { ...toExportRecord(row) };
    // Amounts go in as numbers so the spreadsheet can add them up.
    record.amount = centsToNumber(row.amountCents);
    if (row.toAmountCents !== null) record.toAmount = centsToNumber(row.toAmountCents);
    sheet.addRow(record);
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return { fileName, contentType: XLSX_TYPE, content: Buffer.from(buffer as ArrayBuffer) };
}
