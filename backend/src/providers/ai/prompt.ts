import type { ProductGroup } from '@gastos/shared';
import type { ExtractionInput } from './aiExtractor';

/**
 * Bump when the instructions change, so each document records which wording
 * read it and results can be compared across versions.
 */
export const PROMPT_VERSION = 7;

/** What each product group covers, so the model files lines consistently. */
const GROUP_HINTS: Record<ProductGroup, string> = {
  pantry:
    'dry and packaged food (rice, pasta, flour, sugar, oil, yerba, coffee, canned food, snacks, sweets)',
  meat: 'meat, chicken, fish, cold cuts',
  dairy: 'milk, cheese, yoghurt, butter, eggs',
  produce: 'fruit and vegetables',
  bakery: 'bread and pastries',
  beverages: 'water, soft drinks, juice',
  alcohol: 'beer, wine, spirits',
  frozen: 'frozen food and ice cream',
  prepared_food: 'ready meals, takeaway, restaurant dishes',
  cleaning: 'cleaning and laundry products, paper towels, bin bags',
  personal_care: 'toiletries, cosmetics, toilet paper',
  pharmacy: 'medicines and health products',
  baby: 'nappies and baby products',
  pets: 'pet food and supplies',
  household: 'kitchenware, tools, electrical, home goods, clothing',
  other: 'anything else',
};

const KIND_HINTS: Record<ExtractionInput['kind'], string> = {
  receipt:
    'The images are photos of ONE paper receipt or invoice (possibly split across several photos, in order). ' +
    'Return exactly one transaction for the whole receipt, with its line items.',
  screenshot:
    'The images are screenshots from a payment or shopping app (for example MercadoPago or MercadoLibre). ' +
    'A screenshot may show a single operation or a list of movements: return one transaction per movement shown. ' +
    'Several screenshots are parts of the same activity list: they usually overlap, and some may be the same list seen through a filter. ' +
    'Two rows are the same movement when the day, the time, the other party and the amount all match: report it once. ' +
    'In these lists a green amount with "+" is money coming in and an amount with "-" is money going out. ' +
    'Date headers such as "2 de octubre", "Hoy" or "Ayer" apply to the rows below them. ' +
    'Ignore floating buttons, toolbars and small thumbnails of other screenshots that cover part of the image; ' +
    'if they hide part of an amount, return null for it rather than guessing the hidden digits.',
  card_statement: [
    'The document is the text of a credit card statement ("resumen de tarjeta"), copied from its PDF and given after these instructions. Personal data was replaced by "***"; ignore it.',
    'Return one transaction for each charge of THIS statement: purchases, installments, subscriptions, fees, interest and taxes (IVA, sellos, percepciones), all as "expense".',
    'Refunds and credits of a purchase ("devolución", "bonificación", "anulación", or a line with a negative amount) are "expense" with refund true and a positive amount.',
    'Ignore the previous balance ("saldo anterior"), the payments made to the card ("su pago", "pago en pesos", "pago en dólares"), the totals and subtotals.',
    'An installment line ("cuota 03/06", "C.03/06", "03 de 06") is the amount charged this month for that installment: return that amount, installmentNumber and installmentTotal, and the date printed on the line.',
    'Lines in dollars keep the currency "USD"; lines in pesos are "ARS".',
    'Also return "statement": closingDate ("cierre", "cierre actual"), dueDate ("vencimiento", "vencimiento actual"), nextClosingDate ("próximo cierre"), nextDueDate ("próximo vencimiento"), total (the balance to pay in pesos: "saldo actual", "total a pagar"), minimumPayment ("pago mínimo") and currency (of that total). Dates as "YYYY-MM-DD", amounts in the same format as "amount" below, each null if not printed.',
  ].join(' '),
};

/** The extra field a card statement answers with. */
const STATEMENT_SHAPE =
  '"statement": { "closingDate": null, "dueDate": null, "nextClosingDate": null, "nextDueDate": null, "total": null, "minimumPayment": null, "currency": null }';

/**
 * The instructions sent with every document. Written for Argentine receipts
 * and apps; the output format is described here and checked again in code.
 */
export function buildPrompt(input: ExtractionInput): string {
  const categories = input.categories.map(
    (category) => `${category.id} | ${category.kind} | ${category.path}`,
  );
  return [
    'You extract personal finance transactions from documents (images, or the text of a card statement) for a bookkeeping app. The user lives in Argentina and also shops in Brazil, so documents are in Spanish or Portuguese.',
    KIND_HINTS[input.kind],
    '',
    `Today is ${input.today}. Dates in the document are day-first (DD/MM/YYYY). If the year is missing, use the most recent past date.`,
    'Amounts use a comma as decimal separator and dots for thousands ("$ 15.400,50" is 15400.50).',
    'Currency is an ISO 4217 code, decided by the symbol and by the language of the DOCUMENT ITSELF, never by where the shop is:',
    '- "R$" or "reais" means BRL. "U$S", "US$" or "USD" means USD.',
    '- "$" alone on a document written in Spanish means ARS. This includes Argentine apps such as MercadoPago showing a payment to a Brazilian shop ("Pago con Pix", a merchant name ending in "Ltda" or "SA"): the app already shows what was charged in pesos, so the currency is ARS.',
    '- "$" alone means BRL only on a document written in Portuguese, such as a Brazilian till receipt ("CUPOM FISCAL", "CNPJ", "VALOR TOTAL").',
    '',
    'For each transaction return:',
    '- type: "expense" (a purchase or payment made, or money sent to another person), "income" (money received from another person, a salary, a sale) or "transfer" (the user moving their own money: adding balance to a wallet such as "Ingreso de dinero", withdrawing it, paying a credit card bill).',
    '- refund: true only when the money comes back for an earlier purchase ("devolución", "reintegro", "anulación", "contracargo", "bonificación"). A refund has type "expense", a positive amount and the category of what was bought. Otherwise false.',
    '- date: "YYYY-MM-DD", or null if it cannot be read.',
    '- amount: the TOTAL actually paid or received, as a plain decimal string with a dot and no thousands separators ("15400.50"), always positive, or null if it cannot be read. Use the final total, after discounts and taxes.',
    '- currency: the ISO code of the currency the amount is printed in (for example "ARS", "BRL", "USD"), or null if unclear. Do not convert amounts between currencies.',
    '- merchant: the shop, company or person on the other side, as printed. Empty string if unknown.',
    '- description: a short description in Spanish of what was bought or what the movement is (max 60 characters), even when the document is in Portuguese.',
    '- categoryId: the id of the single best matching category from the list below, whose kind equals the transaction type, or null if none fits or the type is "transfer". Never invent an id.',
    '- installmentNumber and installmentTotal: for "cuota 3 de 6" return 3 and 6; otherwise null for both.',
    '- items: for receipts, each purchased line as { "name", "amount", "product", "group", "quantity" }; otherwise an empty array.',
    '  - name: the line as printed. amount: what was paid for that line, in the same format as the total.',
    '  - product: what the thing is, as a short generic name in Spanish, singular, capitalised, WITHOUT brand, size or flavour, so the same product bought in different shops gets the same name ("YERB.PLAY 1000" and "ERVA MATE BARAO 1KG" are both "Yerba"; "LEITE INTEGRAL PIRACANJUBA" is "Leche"). Empty string if you cannot tell.',
    `  - group: exactly one of ${Object.keys(GROUP_HINTS).join(', ')}, or null if you cannot tell. Meaning: ${Object.entries(
      GROUP_HINTS,
    )
      .map(([group, hint]) => `${group} = ${hint}`)
      .join('; ')}.`,
    '  - quantity: the number of units, kilos or litres printed for that line, as a number, or null if the receipt does not say.',
    '  - Skip lines that are not products: subtotals, discounts, taxes, payment and change.',
    '- uncertain: the names of the fields you had to guess or could not read clearly, from: "type", "date", "amount", "currency", "merchant", "category", "installment".',
    '',
    'Rules:',
    '- Never guess a value you cannot read: return null and list the field in "uncertain".',
    '- Do not output card numbers, account numbers, CBU/CVU, Pix keys, tax ids (CUIT/CUIL/DNI/CPF/CNPJ), addresses or phone numbers anywhere.',
    '- Ignore balances, available credit and anything that is not a movement of money.',
    '- When several images are given they belong together and may OVERLAP (the same lines photographed or captured twice). Report each movement and each purchased line only once.',
    '- If the images contain no transaction at all, return an empty "transactions" array and explain why in "warnings".',
    '- "warnings" is a list of short notes in Spanish about anything the user should double-check.',
    '',
    'Categories (id | kind | path):',
    categories.length > 0 ? categories.join('\n') : '(none)',
    '',
    'Respond with ONLY a JSON object of this exact shape, no markdown and no commentary:',
    `{ "transactions": [ { "type": "", "refund": false, "date": null, "amount": null, "currency": null, "merchant": "", "description": "", "categoryId": null, "installmentNumber": null, "installmentTotal": null, "items": [ { "name": "", "amount": "", "product": "", "group": null, "quantity": null } ], "uncertain": [] } ], ${
      input.kind === 'card_statement' ? `${STATEMENT_SHAPE}, ` : ''
    }"warnings": [] }`,
  ].join('\n');
}
