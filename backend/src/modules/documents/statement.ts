import type { ExtractionResult } from '@gastos/shared';

/**
 * The text of a statement's pages, tidied for the AI and for the user who
 * reads it before sending: no trailing spaces, no runs of empty lines.
 */
export function tidyStatementText(pages: readonly string[]): string {
  return pages
    .map((page) =>
      page
        .split('\n')
        .map((line) => line.trimEnd())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim(),
    )
    .filter((page) => page !== '')
    .join('\n\n');
}

/**
 * A statement prints an installment ("cuota 3 de 6") with the date of the
 * original purchase, months back. What the statement charges now belongs to
 * this statement, so the installment is dated on its closing day: that puts
 * it in this month and makes it paid on this statement's due date.
 * The first installment keeps its own date, which already falls in the period.
 */
export function dateInstallmentsOnClosing(extraction: ExtractionResult): ExtractionResult {
  const closingDate = extraction.statement?.closingDate;
  if (!closingDate) return extraction;
  return {
    ...extraction,
    transactions: extraction.transactions.map((transaction) =>
      transaction.installment && transaction.installment.number > 1
        ? {
            ...transaction,
            date: closingDate,
            uncertainFields: transaction.uncertainFields.filter((field) => field !== 'date'),
          }
        : transaction,
    ),
  };
}
