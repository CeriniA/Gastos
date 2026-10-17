import {
  addDays,
  addMonths,
  parseAmountToCents,
  type ExtractedTransaction,
  type ExtractionResult,
} from '@gastos/shared';
import type { ExtractionInput } from '../providers/ai/aiExtractor';

/**
 * What the demo's pretend AI "reads": the same made-up answer for every
 * receipt, every screenshot and every card statement, built to show each thing
 * the review screen can do (doubtful fields, products, repeats, installments,
 * refunds, charges, another currency).
 */

const cents = (amount: string) => parseAmountToCents(amount) ?? 0;

/** The text the demo's pretend PDF library "finds" in any statement. */
export const DEMO_STATEMENT_PAGES = [
  'BANCO DEMO - RESUMEN DE TARJETA\nTitular: JUAN PEREZ\nDomicilio: AV SIEMPRE VIVA 742\nTarjeta 4509 1234 5678 9012\nCUIT 20-12345678-9',
  'Supermercado Demo           25.000,00\nTienda Demo C.03/12         10.000,00\nDevolución Tienda Demo      -5.000,00\nIntereses de financiación    1.500,00\nIVA 21%                        315,00\nStreaming Demo           USD    12,99',
];

function line(overrides: Partial<ExtractedTransaction>): ExtractedTransaction {
  return {
    type: 'expense',
    refund: false,
    financialCharge: false,
    date: null,
    amountCents: null,
    currency: 'ARS',
    merchant: '',
    description: '',
    suggestedCategoryId: null,
    installment: null,
    items: [],
    uncertainFields: [],
    ...overrides,
  };
}

export function demoReading(input: ExtractionInput): ExtractionResult {
  const { today } = input;
  const category = (path: string) =>
    input.categories.find((candidate) => candidate.path === path)?.id ?? null;
  const food = category('Supermercado y alimentos');

  if (input.kind === 'receipt') {
    return {
      documentKind: 'receipt',
      statement: null,
      warnings: ['Lectura inventada por la demo: no se leyó ninguna imagen.'],
      transactions: [
        line({
          date: today,
          amountCents: cents('18450,50'),
          merchant: 'Super Demo',
          description: 'Compra de supermercado',
          suggestedCategoryId: food,
          items: [
            {
              name: 'LECHE ENT 1L',
              amountCents: cents('2400'),
              product: 'Leche',
              group: 'dairy',
              quantity: 2,
            },
            { name: 'YERBA 1KG', amountCents: cents('5200'), product: 'Yerba', group: 'pantry', quantity: 1 },
            { name: 'DETERG 750', amountCents: cents('3100'), product: '', group: null, quantity: null },
          ],
          uncertainFields: ['date'],
        }),
      ],
    };
  }

  if (input.kind === 'screenshot') {
    const yesterday = addDays(today, -1);
    return {
      documentKind: 'screenshot',
      statement: null,
      warnings: [],
      transactions: [
        // The same day and amount as the demo's "Nafta": shown as already stored.
        line({ date: today, amountCents: cents('12500'), merchant: 'YPF', description: 'Nafta' }),
        line({ date: yesterday, amountCents: cents('7300'), merchant: 'Kiosco Demo', description: 'Kiosco' }),
        line({ date: yesterday, amountCents: cents('7300'), merchant: 'Kiosco Demo', description: 'Kiosco' }),
        line({
          type: 'income',
          date: yesterday,
          amountCents: cents('40000'),
          merchant: 'Ana Demo',
          description: 'Transferencia recibida',
        }),
        line({
          date: yesterday,
          merchant: 'Tapado',
          description: 'Monto ilegible',
          uncertainFields: ['amount'],
        }),
      ],
    };
  }

  if (input.kind === 'account_statement') {
    const fromDate = addDays(today, -10);
    return {
      documentKind: 'account_statement',
      statement: {
        closingDate: null,
        dueDate: null,
        nextClosingDate: null,
        nextDueDate: null,
        totalCents: null,
        minimumPaymentCents: null,
        currency: 'ARS',
        fromDate,
        toDate: today,
        openingBalanceCents: cents('200000'),
        closingBalanceCents: cents('1631619,50'),
      },
      warnings: [],
      transactions: [
        // Already loaded by the demo: shown as repeated.
        line({ date: today, amountCents: cents('12500'), merchant: 'YPF', description: 'Nafta' }),
        line({
          date: addDays(today, -1),
          amountCents: cents('42000'),
          merchant: 'Super',
          description: 'Super',
        }),
        line({
          date: addDays(today, -5),
          amountCents: cents('30000'),
          merchant: 'Edesur',
          description: 'Transferencia a Edesur',
        }),
        line({
          type: 'transfer',
          incoming: true,
          date: addDays(today, -8),
          amountCents: cents('100000'),
          merchant: 'Banco Demo',
          description: 'Ingreso de dinero',
        }),
        line({
          type: 'income',
          date: addDays(today, -1),
          amountCents: cents('1520'),
          merchant: 'Mercado Pago',
          description: 'Rendimientos',
        }),
      ],
    };
  }

  const closingDate = addDays(today, -5);
  const dueDate = addDays(today, 7);
  return {
    documentKind: 'card_statement',
    statement: {
      closingDate,
      dueDate,
      nextClosingDate: addMonths(closingDate, 1),
      nextDueDate: addMonths(dueDate, 1),
      totalCents: cents('31815'),
      minimumPaymentCents: cents('5000'),
      currency: 'ARS',
    },
    warnings: [],
    transactions: [
      line({
        date: addDays(closingDate, -10),
        amountCents: cents('25000'),
        merchant: 'Supermercado Demo',
        description: 'Supermercado',
        suggestedCategoryId: food,
      }),
      line({
        date: addDays(closingDate, -12),
        amountCents: cents('10000'),
        merchant: 'Tienda Demo',
        description: 'Zapatillas',
        installment: { number: 3, total: 12 },
      }),
      line({
        date: addDays(closingDate, -3),
        amountCents: cents('5000'),
        merchant: 'Tienda Demo',
        description: 'Devolución',
        refund: true,
      }),
      line({
        date: closingDate,
        amountCents: cents('1500'),
        merchant: 'Intereses de financiación',
        description: 'Intereses',
        financialCharge: true,
      }),
      line({
        date: closingDate,
        amountCents: cents('315'),
        merchant: 'IVA 21%',
        description: 'IVA',
        financialCharge: true,
      }),
      line({
        date: addDays(closingDate, -2),
        amountCents: cents('12,99'),
        currency: 'USD',
        merchant: 'Streaming Demo',
        description: 'Suscripción',
      }),
    ],
  };
}
